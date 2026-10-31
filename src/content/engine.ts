// Mutation 批量调度：收集 → 微任务合并 → 统一 flush
// MutationObserver 挂在 documentElement 上，天然覆盖 Turbo SPA 导航；
// shadow root（walker 穿透时发现的）由 #watchShadow 对每个单独 observe——
// shadow tree 内部的变更不冒泡到 light DOM 的观察器

import type { DictView } from "../shared/types.ts";
import { translateTree } from "./walker.ts";

/**
 * light root 与 shadow root 共用的观察配置。
 * attributeFilter 是降噪的核心：只有 value / data-disable-with（按钮类
 * `<input>` 的可见文案，Turbo 快照 / data-disable-with 会把它改回英文）才产生
 * 记录，其余属性（class / style 等）静默。
 */
const OBSERVE_OPTIONS: MutationObserverInit = {
	childList: true,
	subtree: true,
	characterData: true,
	attributes: true,
	attributeFilter: ["value", "data-disable-with"],
};

/** 引擎宿主：由入口注入词典视图来源与开关状态（便于解耦测试） */
export interface EngineHost {
	/** 取当前词典视图（入口侧按 location.pathname 单槽缓存切换） */
	getView(): DictView;
	/** 翻译总开关；关闭时 flush 只清空队列不翻译 */
	isEnabled(): boolean;
}

export class TranslationEngine {
	readonly #host: EngineHost;
	readonly #observer: MutationObserver;
	readonly #pending = new Set<Node>();
	/** 已注册观察的 shadow root：flush 每轮都会重新发现同一批，去重避免反复 observe */
	#watchedShadowRoots = new WeakSet<ShadowRoot>();
	/**
	 * 已登记「等 define」的标签。按标签登记而不是按元素：复查时用
	 * querySelectorAll 重新收集，不持有任何元素引用——React 卸载了元素也不会
	 * 阻碍回收；从未被 define 的标签（用户内容里的同名元素）只是留一个
	 * 永挂的 promise 和一个字符串，代价可忽略。
	 */
	#pendingCustomTags = new Set<string>();
	#flushScheduled = false;

	constructor(host: EngineHost) {
		this.#host = host;
		this.#observer = new MutationObserver((records) => {
			this.#collect(records);
		});
	}

	/** 开始观察 root 子树，并把 root 入队做首轮全量翻译 */
	start(root: Node): void {
		this.#observer.observe(root, OBSERVE_OPTIONS);
		this.#enqueue(root);
	}

	/** 停止观察并清空待处理队列（当前开关流程用整页刷新，此方法备用） */
	stop(): void {
		this.#observer.disconnect();
		// disconnect 会撤销包括 shadow root 在内的全部观察，WeakSet 记录一并作废：
		// 重新 start 后要让 flush 重新注册（WeakSet 不可枚举，整只替换）
		this.#watchedShadowRoots = new WeakSet();
		this.#pending.clear();
		this.#flushScheduled = false;
	}

	#enqueue(node: Node): void {
		this.#pending.add(node);
		if (this.#flushScheduled) return;
		this.#flushScheduled = true;
		queueMicrotask(() => {
			this.#flush();
		});
	}

	#collect(records: readonly MutationRecord[]): void {
		for (const record of records) {
			// childList 的 target（父节点）子树已覆盖新增节点；
			// characterData 的 target 是文本节点本身
			this.#enqueue(record.target);
		}
	}

	#flush(): void {
		this.#flushScheduled = false;
		if (!this.#host.isEnabled()) {
			this.#pending.clear();
			return;
		}
		const view = this.#host.getView();
		for (const node of this.#pending) {
			// 已脱离文档的节点跳过，避免无谓遍历
			if (node.isConnected) {
				translateTree(
					node,
					view,
					(shadow) => {
						this.#watchShadow(shadow);
					},
					this.#onPendingCustomElement,
				);
			}
		}
		this.#pending.clear();
	}

	/**
	 * 给首次发现的 shadow root 挂上与 light root 相同的观察器。relative-time
	 * 类组件每分钟 tick 把 shadow 内的文本改回英文——document 级观察器看不见
	 * 这种变更，重翻只能靠这份注册。同一 shadow root 只注册一次（组件原地
	 * 更新 span、不换 shadow root）；脱离文档的 shadow root 断连后不再产生
	 * 记录，WeakSet 条目随后随节点一起被回收。
	 */
	#watchShadow(shadow: ShadowRoot): void {
		if (this.#watchedShadowRoots.has(shadow)) return;
		this.#watchedShadowRoots.add(shadow);
		this.#observer.observe(shadow, OBSERVE_OPTIONS);
	}

	/**
	 * 补「define 晚于首轮扫描」的敞口（walker 只通知、不做调度，故住在这里）。
	 *
	 * content script 在 document_start 启动，而 GitHub 的懒加载 chunk 可能晚于
	 * 首轮扫描才 `customElements.define`：那之前元素没有 shadow root，穿透无从
	 * 谈起；define 之后组件把英文写进 shadow，全程不产生 light DOM 可见的变更
	 * 记录——引擎没有任何通道得知新 shadow root 出现了。数值形态（「4 minutes
	 * ago」）每分钟 tick 重写文本总能触发重翻，模糊形态（「last month」）重算
	 * 结果不变、组件什么都不写，会永远停在英文（维护者 2026-10-31 实机：文件
	 * 列表的 last month / last week 长期英文，刷新才恢复）。
	 *
	 * 所以在 define 时刻补一轮全量穿透：此刻存量元素已被 upgrade（constructor
	 * 同步挂 shadow），内容已写的当场翻；组件若还要异步写，则由这一轮注册的
	 * shadow 观察器在写入时接住——两种时序都闭环。
	 */
	#onPendingCustomElement = (element: Element): void => {
		const tag = element.localName;
		if (this.#pendingCustomTags.has(tag)) return;
		this.#pendingCustomTags.add(tag);
		// whenDefined 对非法名字 reject 为 SyntaxError（不同步抛），
		// catch 兜住即可；正常路径 resolve 于 define 调用时
		void customElements
			.whenDefined(tag)
			.then(() => {
				this.#pendingCustomTags.delete(tag);
				// 开关已关（整页刷新流程）就不翻了
				if (!this.#host.isEnabled()) return;
				const view = this.#host.getView();
				for (const el of document.querySelectorAll(tag)) {
					translateTree(
						el,
						view,
						(shadow) => {
							this.#watchShadow(shadow);
						},
						this.#onPendingCustomElement,
					);
				}
			})
			.catch(() => {});
	};
}
