// src/content/engine.ts 的调度语义。
//
// 为什么值得测：这是「观察器 → 微任务合并 → 统一 flush」的唯一调度器。防翻译
// 循环的三道防线有两道挂在它的两个端点上——入口的 attributeFilter（只观察
// value / data-disable-with，把噪音压到最小）与出口的 isConnected 跳过 + 把它
// 交给 walker 的同值不写入守卫。任一处写错都表现为「开关关了还在翻」「Turbo
// 把按钮 value 改回英文后不再重翻」或「页面卡死」，而这三类失效在别的测试里
// 完全看不见。
//
// 环境：**真实 MutationObserver + 真实 DOM**（happy-dom，见 test-support/dom.ts）。
// 这一点是本文件的关键——变更记录的过滤、投递时机、disconnect 丢弃队列、脱离文档
// 的节点是否仍产生记录，全是规范行为，桩观察器只能「假装」：它记录得下 observe 的
// 配置，却证明不了配置真的生效。其中「同值写入也产生 characterData 记录」这条规范
// 事实是本文件第一次真正验证到的，而它正是「页面不报错但卡死」那次事故的成因。
import {
	afterAll,
	beforeAll,
	describe,
	expect,
	it,
} from "bun:test";
import type { DictView } from "../../shared/types.ts";
import {
	type DomEnvironment,
	installDom,
} from "../../test-support/dom.ts";
import type { EngineHost } from "../engine.ts";
import { TranslationEngine } from "../engine.ts";

let env: DomEnvironment;

beforeAll(() => {
	env = installDom();
});

afterAll(() => {
	env.restore();
});

const view: DictView = {
	entries: new Map([
		["Star", "星标"],
		["Fork", "复刻"],
	]),
	aliases: new Map(),
	rules: [],
};

interface Harness {
	readonly engine: TranslationEngine;
	/** 已挂进文档的观察根 */
	readonly root: HTMLElement;
	/** getView 的调用次数：每次 flush 恰好一次，用来断言「入队合并」 */
	viewCalls(): number;
}

function makeEngine(
	options: { enabled?: boolean } = {},
): Harness {
	env.observes.length = 0;
	let calls = 0;
	const host: EngineHost = {
		getView: () => {
			calls++;
			return view;
		},
		isEnabled: () => options.enabled ?? true,
	};
	const engine = new TranslationEngine(host);
	const root = env.document.createElement("div");
	env.document.body.appendChild(root);
	return { engine, root, viewCalls: () => calls };
}

/** 造一段文本挂到 parent 下 */
function addText(parent: Node, value: string): Text {
	const node = env.document.createTextNode(value);
	parent.appendChild(node);
	return node;
}

describe("TranslationEngine 的调度语义", () => {
	it("observes the root subtree with the minimal attribute filter", () => {
		const { engine, root } = makeEngine();
		engine.start(root);
		expect(env.observes).toHaveLength(1);
		expect(env.observes[0]?.target).toBe(root);
		// attributeFilter 是降噪的核心：没有它，GitHub 每次改 class / style
		// 都会产生记录并把整棵子树重翻一遍（下面「噪音」那条用例验证它真的生效）
		expect(env.observes[0]?.options).toMatchObject({
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
			attributeFilter: ["value", "data-disable-with"],
		});
	});

	it("translates the root on the first flush", async () => {
		const { engine, root } = makeEngine();
		const node = addText(root, "Star");
		engine.start(root);
		await env.tick();
		expect(node.nodeValue).toBe("星标");
	});

	it("translates the target of every mutation record", async () => {
		const { engine, root } = makeEngine();
		engine.start(root);
		await env.tick();

		// childList 的记录 target 是**父元素**：新插入的整棵子树靠父元素覆盖
		const inserted = env.document.createElement("section");
		const node = addText(inserted, "Fork");
		root.appendChild(inserted);
		await env.tick();
		expect(node.nodeValue).toBe("复刻");

		// characterData 的记录 target 是**文本节点本身**：上游把文本改回英文
		// （Turbo 快照）时走的就是这条路
		node.nodeValue = "Fork";
		await env.tick();
		expect(node.nodeValue).toBe("复刻");
	});

	it("coalesces many records in one tick into a single flush", async () => {
		const { engine, root, viewCalls } = makeEngine();
		engine.start(root);
		await env.tick();
		expect(viewCalls()).toBe(1);

		// 同一微任务窗口内的三次改动必须只换一次视图（#flushScheduled 守卫）
		for (const text of ["a", "b", "c"]) {
			root.appendChild(env.document.createTextNode(text));
		}
		await env.tick();
		expect(viewCalls()).toBe(2);
	});

	it("clears the queue without translating when disabled", async () => {
		const { engine, root, viewCalls } = makeEngine({
			enabled: false,
		});
		const node = addText(root, "Star");
		engine.start(root);
		await env.tick();
		// 关闭时连视图都不该构建（否则每次 mutation 都白跑一遍路由匹配）
		expect(viewCalls()).toBe(0);
		expect(node.nodeValue).toBe("Star");
	});

	it("skips nodes detached from the document", async () => {
		const { engine, viewCalls } = makeEngine();
		const orphan = env.document.createElement("div");
		const node = addText(orphan, "Fork");
		engine.start(orphan);
		await env.tick();
		// 记录照常产生、flush 照常跑（视图取到了），只是脱离文档的节点被跳过
		expect(viewCalls()).toBe(1);
		expect(node.nodeValue).toBe("Fork");

		// 同一个节点、同一种记录，唯一的差别是它连上了文档
		env.document.body.appendChild(orphan);
		orphan.appendChild(env.document.createElement("span"));
		await env.tick();
		expect(node.nodeValue).toBe("复刻");
	});

	it("disconnects and drops pended nodes on stop", async () => {
		const { engine, root, viewCalls } = makeEngine();
		engine.start(root);
		const node = addText(root, "Fork");
		await env.tick();
		await env.tick();
		expect(node.nodeValue).toBe("复刻");
		const settled = viewCalls();

		// 页面改回英文：记录已经产生、回调还没派发，此刻停止
		node.nodeValue = "Fork";
		engine.stop();
		await env.tick();
		expect(node.nodeValue).toBe("Fork");
		expect(viewCalls()).toBe(settled);

		// 断开之后的新改动同样没有任何反应
		root.appendChild(env.document.createTextNode("Star"));
		await env.tick();
		expect(viewCalls()).toBe(settled);
	});

	it("re-translates an attribute the page rewrote, and ignores unfiltered noise", async () => {
		const { engine, root, viewCalls } = makeEngine();
		const input = env.document.createElement("input");
		input.setAttribute("type", "submit");
		input.setAttribute("value", "Star");
		root.appendChild(input);
		engine.start(root);
		await env.tick();
		await env.tick();
		expect(input.getAttribute("value")).toBe("星标");
		const settled = viewCalls();

		// 上游把按钮文案改回英文（Turbo 快照 / data-disable-with）→ 必须重翻。
		// 这是 attributeFilter 里放 value 的唯一理由，也是桩观察器证明不了的
		input.setAttribute("value", "Star");
		await env.tick();
		await env.tick();
		expect(input.getAttribute("value")).toBe("星标");
		const afterRewrite = viewCalls();
		expect(afterRewrite).toBeGreaterThan(settled);

		// class 不在 attributeFilter 里：改它连记录都不产生，也就不会换视图
		input.setAttribute("class", "btn");
		await env.tick();
		expect(viewCalls()).toBe(afterRewrite);
	});

	it("writes nothing for a dictionary entry that maps to itself", async () => {
		// 「命中 → 写入 → 再命中 → 再写入」会在微任务队列里无限自转：页面不报错
		// 但卡死。2026-09 的真实事故是 `"ORCID iD": "ORCID iD"` 让 /settings/profile
		// 卡死，只有含该标签的页面命中。这里用真实观察器验证收敛。
		const identity: DictView = {
			entries: new Map([["ORCID iD", "ORCID iD"]]),
			aliases: new Map(),
			rules: [],
		};
		let calls = 0;
		const engine = new TranslationEngine({
			getView: () => {
				calls++;
				return identity;
			},
			isEnabled: () => true,
		});
		const root = env.document.createElement("div");
		env.document.body.appendChild(root);
		const node = addText(root, "ORCID iD");

		// 先证明这条守卫为什么必须有：**同值写入也产生 characterData 记录**，
		// 观察器会把它再入队——自我触发是结构上成立的，只能靠守卫拦住
		const seen: MutationRecord[] = [];
		const spy = env.createObserver((records) => {
			seen.push(...records);
		});
		spy.observe(root, {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
		});
		node.nodeValue = "ORCID iD";
		await env.tick();
		expect(seen).toHaveLength(1);
		const baseline = seen.length;

		// 引擎跑完整轮之后 DOM 上一条新记录都没有 → 自我触发在物理上不成立
		engine.start(root);
		await env.tick();
		await env.tick();
		expect(node.nodeValue).toBe("ORCID iD");
		expect(calls).toBe(1);
		expect(seen.length).toBe(baseline);
	});

	it("watches an open shadow root and re-translates its tick rewrites", async () => {
		const { engine, root } = makeEngine();
		// relative-time 的实机形态（2026-10-30）：可见文本在 shadow root 内的
		// `<span part="root">` 里，组件每分钟 tick 原地把它改回英文
		const host =
			env.document.createElement("relative-time");
		const shadow = host.attachShadow({ mode: "open" });
		const label = env.document.createElement("span");
		label.setAttribute("part", "root");
		label.textContent = "Fork";
		shadow.appendChild(label);
		root.appendChild(host);

		engine.start(root);
		await env.tick();
		// 首轮全量翻译穿透到了 shadow 内
		expect(label.textContent).toBe("复刻");
		// 发现的 shadow root 被单独注册观察，配置与 light root 相同
		const shadowObserves = () =>
			env.observes.filter((call) => call.target === shadow);
		expect(shadowObserves()).toHaveLength(1);
		expect(shadowObserves()[0]?.options).toMatchObject({
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
			attributeFilter: ["value", "data-disable-with"],
		});

		// 组件 tick 把 shadow 内文本改回英文——shadow 内部变更不冒泡到
		// light root 的观察器，重翻只能靠上面那份注册
		label.textContent = "Fork";
		await env.tick();
		expect(label.textContent).toBe("复刻");

		// 之后每轮 flush 都会重新发现同一个 shadow root：不得反复 observe
		root.appendChild(env.document.createTextNode("noise"));
		await env.tick();
		expect(shadowObserves()).toHaveLength(1);

		// stop 撤销全部观察（含 shadow）：重新 start 后要能重新注册
		engine.stop();
		engine.start(root);
		await env.tick();
		expect(shadowObserves()).toHaveLength(2);
	});

	it("re-translates custom elements defined after the first scan", async () => {
		// define 晚于首轮扫描（维护者 2026-10-31 实机：文件列表的 last month /
		// last week 长期英文，刷新才恢复）：首轮时时间戳元素还是未知元素，组件
		// upgrade 后把英文写进 shadow，全程不产生 light DOM 可见的变更记录。
		// 引擎必须在 define 时刻补一轮穿透——模糊形态（last month）没有
		// relative-time 的 tick 重写，否则永远等不到触发。
		// 标签名用 deferred-time：define 会 upgrade 文档里全部存量同名元素，
		// 本文件前述用例的手动 shadow host 若同名会在 upgrade 时撞车
		const fuzzyView: DictView = {
			entries: new Map([["last month", "上个月"]]),
			aliases: new Map(),
			rules: [],
		};
		const engine = new TranslationEngine({
			getView: () => fuzzyView,
			isEnabled: () => true,
		});
		const root = env.document.createElement("div");
		env.document.body.appendChild(root);
		const host =
			env.document.createElement("deferred-time");
		root.appendChild(host);

		engine.start(root);
		await env.tick();
		// 首轮扫描时元素尚未升级：没有 shadow 可穿透，但已登记等 define
		expect(host.shadowRoot).toBeNull();

		// chunk 到达：define，constructor 同步挂 shadow 并渲染英文。
		// 基类必须是 registry 所属窗口的 HTMLElement——dom.ts 没把构造函数
		// 挂进全局，从窗口上取（env.window 的静态类型是裸 Window，cast 一下）
		const base = (
			env.window as unknown as {
				HTMLElement: typeof HTMLElement;
			}
		).HTMLElement;
		class DeferredTime extends base {
			constructor() {
				super();
				const shadow = this.attachShadow({ mode: "open" });
				const label = env.document.createElement("span");
				label.setAttribute("part", "root");
				label.textContent = "last month";
				shadow.appendChild(label);
			}
		}
		customElements.define("deferred-time", DeferredTime);
		await env.tick();

		// whenDefined 复查穿透到了 upgrade 后的 shadow
		const label = host.shadowRoot?.querySelector("span");
		expect(label?.textContent).toBe("上个月");
		// 复查同时给新 shadow root 注册了观察器（tick 重写靠它收敛）
		const shadow = host.shadowRoot;
		expect(
			env.observes.some(
				(call) =>
					call.target === shadow &&
					call.options.childList === true,
			),
		).toBe(true);
	});
});
