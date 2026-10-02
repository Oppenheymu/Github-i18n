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
});
