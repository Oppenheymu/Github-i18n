// bun 测试用的真实 DOM 环境。**唯一一份**：需要 DOM 语义的用例都从这里取，
// 不许再各文件内联（历史教训见下）。
//
// 为什么必须是单一来源：
//   * `walker.ts` 用 `root instanceof Element` 判根节点类型，而 `instanceof` 比的是
//     **类身份**——两个文件各造一个窗口，后装的那份会让先装的那份的节点不再
//     `instanceof Element`（2026-10-03 用两份手写桩实际踩到，成片用例变红）；
//   * happy-dom 的 TreeWalker（含 `FILTER_REJECT` 整棵子树跳过）、`closest`（完整
//     选择器语法）、`attributeFilter`、**同值写入也产生变更记录**都按规范实现，
//     手写桩只能近似（旧桩的 `closest` 只认 `.class` 与标签名）。
//
// 三条实现约定：
//   ① 安装是**合并挂载**（只挂 listed 的这几个键），绝不整体替换 globalThis；
//   ② 用例文件收尾必须调用 `restore()`——bun 按文件逐个「加载 → 跑 → 下一个」，
//      还原后下一个文件拿到的仍是它自己期望的全局；
//   ③ 观察器是**真实**的（记录之后照样 `super.observe`），所以断言观察配置与断言
//      观察行为可以是同一份环境。

import { Window as HappyWindow } from "happy-dom";

/** 受管的全局：只挂这几个，其余键一律不碰 */
const MANAGED = [
	"window",
	"document",
	"Node",
	"Element",
	"NodeFilter",
	"MutationObserver",
] as const;

/** 一次 `observe` 调用的留痕（观察器本身仍是真实的） */
export interface ObserveCall {
	readonly target: unknown;
	readonly options: MutationObserverInit;
}

/** `addEventListener` 的类型日志（既记录也真实注册） */
export interface EventHookLog {
	readonly document: string[];
	readonly window: string[];
}

export interface DomEnvironment {
	/**
	 * happy-dom 窗口：真实 DOM 实现的唯一入口，造节点一律从它取。
	 * 对外**以 DOM lib 的 Window 类型看待**（happy-dom 自有类型只在本文件内出现），
	 * 这样才能直接把 `dispatchEvent(env.createEvent(...))` 接上。
	 */
	readonly window: Window;
	/** 以 DOM lib 的类型看待它，免得 happy-dom 自有类型渗进断言 */
	readonly document: Document;
	/**
	 * 每次**被测代码** `new MutationObserver(...)` 之后调用 `observe` 的
	 * target / options。`createObserver` 造的旁观观察器**不**记进来——
	 * 两个信号分开，断言「被测代码观察了什么」时才不会被测试自己的观察器污染。
	 */
	readonly observes: ObserveCall[];
	/** 真实注册过的 `addEventListener` 类型 */
	readonly hooks: EventHookLog;
	/**
	 * 造一个**真实**的观察器给用例当旁观者（DOM lib 类型，内部就是 happy-dom 的
	 * 实现）。它与 `observes` 无关，见上。
	 */
	createObserver(
		callback: MutationCallback,
	): MutationObserver;
	/** 造一个**真实**事件，可直接 dispatch（同样以 DOM lib 的类型看待） */
	createEvent(type: string): Event;
	/** 排空微任务 + 过一次宏任务：观察器回调与引擎 flush 都在微任务里 */
	tick(): Promise<void>;
	/** 还原安装前的全局（用例文件收尾调用） */
	restore(): void;
}

type AddListener = (
	type: string,
	callback: EventListenerOrEventListenerObject | null,
	options?: boolean | AddEventListenerOptions,
) => void;

/** 记录 `addEventListener` 的类型，同时**照常真实注册**（记录不改变行为） */
function recordListeners(
	target: EventTarget,
	log: string[],
): void {
	const original = target.addEventListener.bind(
		target,
	) as AddListener;
	target.addEventListener = ((
		type: string,
		callback: EventListenerOrEventListenerObject | null,
		options?: boolean | AddEventListenerOptions,
	) => {
		log.push(type);
		original(type, callback, options);
	}) as typeof target.addEventListener;
}

/** 合并安装一套真实 DOM 全局；返回的环境最后必须 `restore()` */
export function installDom(
	url = "https://example.com/",
): DomEnvironment {
	const dom = new HappyWindow({ url });
	const globals = globalThis as unknown as Record<
		string,
		unknown
	>;
	const previous = new Map<string, unknown>();
	const observes: ObserveCall[] = [];
	const hooks: EventHookLog = { document: [], window: [] };

	// happy-dom 的构造函数要 window 上下文，故只能用它窗口上的那个，
	// 再以 DOM lib 的类型看待
	const NativeObserver =
		dom.MutationObserver as unknown as typeof MutationObserver;

	/** 真实观察器 + 留痕：断言观察配置与断言观察行为共用同一份环境 */
	class RecordingObserver extends NativeObserver {
		override observe(
			target: Node,
			options?: MutationObserverInit,
		): void {
			observes.push({ target, options: options ?? {} });
			super.observe(target, options);
		}
	}

	const document = dom.document as unknown as Document;
	recordListeners(document, hooks.document);
	recordListeners(
		dom as unknown as EventTarget,
		hooks.window,
	);

	const installed: Record<string, unknown> = {
		window: dom,
		document,
		Node: dom.Node,
		Element: dom.Element,
		NodeFilter: dom.NodeFilter,
		MutationObserver: RecordingObserver,
	};
	for (const key of MANAGED) {
		previous.set(key, globals[key]);
		globals[key] = installed[key];
	}

	return {
		window: dom as unknown as Window,
		document,
		observes,
		hooks,
		createObserver: (callback) =>
			new NativeObserver(callback),
		createEvent: (type) =>
			new dom.Event(type) as unknown as Event,
		tick(): Promise<void> {
			return new Promise((resolve) => {
				setTimeout(resolve, 0);
			});
		},
		restore(): void {
			for (const key of MANAGED) {
				const before = previous.get(key);
				if (before === undefined) {
					delete globals[key];
					continue;
				}
				globals[key] = before;
			}
		},
	};
}
