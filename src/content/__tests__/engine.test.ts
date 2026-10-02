// src/content/engine.ts 的调度语义（此前构造函数回调 / #collect / stop 无覆盖）。
//
// 为什么值得测：这是「观察器 → 微任务合并 → 统一 flush」的唯一调度器。防翻译
// 循环的三道防线有两道挂在它的两个端点上——入口的 attributeFilter（只观察
// value / data-disable-with，把噪音压到最小）与出口的 isConnected 跳过 + 把它
// 交给 walker 的同值不写入守卫。任一处写错都表现为「开关关了还在翻」「Turbo
// 把按钮 value 改回英文后不再重翻」或「页面卡死」，而这三类失效在别的测试里
// 完全看不见。
//
// 环境：bun 没有 MutationObserver（实测 undefined），故装观察器桩；DOM 桩来自
// stub-dom.ts——**必须与 walker 的测试共用同一份类**，否则 `instanceof Element`
// 会因类身份不同而失效（2026-10-03 踩过：两处内联桩互相顶替，节点边界测试成片变红）。
import { describe, expect, it } from "bun:test";
import type { DictView } from "../../shared/types.ts";
import type { EngineHost } from "../engine.ts";
import { TranslationEngine } from "../engine.ts";
import {
	installDomStubs,
	StubElement,
} from "./stub-dom.ts";

/** 排空微任务：setTimeout(0) 是宏任务，保证此前排队的 queueMicrotask 全部跑完 */
function flushMicrotasks(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

interface ObserveCall {
	readonly target: unknown;
	readonly options: Record<string, unknown>;
}

class StubObserver {
	static readonly instances: StubObserver[] = [];
	readonly observed: ObserveCall[] = [];
	disconnected = false;
	readonly #callback: (records: MutationRecord[]) => void;
	constructor(
		callback: (records: MutationRecord[]) => void,
	) {
		this.#callback = callback;
		StubObserver.instances.push(this);
	}
	observe(
		target: unknown,
		options: Record<string, unknown>,
	): void {
		this.observed.push({ target, options });
	}
	disconnect(): void {
		this.disconnected = true;
	}
	/** 伪造一批 mutation 记录驱动回调（观察器本身不被 bun 实现） */
	trigger(targets: readonly unknown[]): void {
		this.#callback(
			targets.map((target) => ({
				target,
			})) as unknown as MutationRecord[],
		);
	}
}

const view: DictView = {
	entries: new Map([
		["Star", "星标"],
		["Fork", "复刻"],
	]),
	aliases: new Map(),
	rules: [],
};

function asNode(value: unknown): Node {
	return value as unknown as Node;
}

interface Harness {
	readonly engine: TranslationEngine;
	readonly observer: StubObserver;
	/** getView 的调用次数：每次 flush 恰好一次，用来断言「入队合并」 */
	viewCalls(): number;
}

function makeEngine(
	options: { enabled?: boolean } = {},
): Harness {
	installDomStubs();
	(globalThis as unknown as Record<string, unknown>)[
		"MutationObserver"
	] = StubObserver;
	StubObserver.instances.length = 0;
	let calls = 0;
	const host: EngineHost = {
		getView: () => {
			calls++;
			return view;
		},
		isEnabled: () => options.enabled ?? true,
	};
	const engine = new TranslationEngine(host);
	const observer = StubObserver.instances[0];
	if (observer === undefined) {
		throw new Error("引擎未创建观察器");
	}
	return { engine, observer, viewCalls: () => calls };
}

describe("TranslationEngine 的调度语义", () => {
	it("observes the root subtree with the minimal attribute filter", () => {
		const { engine, observer } = makeEngine();
		const root = new StubElement("div");
		engine.start(asNode(root));
		expect(observer.observed).toHaveLength(1);
		expect(observer.observed[0]?.target).toBe(root);
		// attributeFilter 是降噪的核心：没有它，GitHub 每次改 class / style
		// 都会产生记录并把整棵子树重翻一遍
		expect(observer.observed[0]?.options).toMatchObject({
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
			attributeFilter: ["value", "data-disable-with"],
		});
	});

	it("translates the root on the first flush", async () => {
		const { engine } = makeEngine();
		const root = new StubElement("div");
		const node = root.addText("Star");
		engine.start(asNode(root));
		await flushMicrotasks();
		expect(node.nodeValue).toBe("星标");
	});

	it("translates the target of every mutation record", async () => {
		const { engine, observer } = makeEngine();
		const root = new StubElement("div");
		engine.start(asNode(root));
		await flushMicrotasks();

		// Turbo 导航后新插入的子树：characterData / childList 的 target 都被入队
		const inserted = new StubElement("section");
		const node = inserted.addText("Fork");
		observer.trigger([inserted]);
		await flushMicrotasks();
		expect(node.nodeValue).toBe("复刻");
	});

	it("coalesces many records in one tick into a single flush", async () => {
		const { engine, observer, viewCalls } = makeEngine();
		engine.start(asNode(new StubElement("div")));
		await flushMicrotasks();
		expect(viewCalls()).toBe(1);

		// 同一微任务窗口内的三次入队必须只换一次视图（#flushScheduled 守卫）
		observer.trigger([new StubElement("a")]);
		observer.trigger([new StubElement("b")]);
		observer.trigger([new StubElement("c")]);
		await flushMicrotasks();
		expect(viewCalls()).toBe(2);
	});

	it("clears the queue without translating when disabled", async () => {
		const { engine, viewCalls } = makeEngine({
			enabled: false,
		});
		const root = new StubElement("div");
		const node = root.addText("Star");
		engine.start(asNode(root));
		await flushMicrotasks();
		// 关闭时连视图都不该构建（否则每次 mutation 都白跑一遍路由匹配）
		expect(viewCalls()).toBe(0);
		expect(node.nodeValue).toBe("Star");
	});

	it("skips nodes detached from the document", async () => {
		const { engine, observer } = makeEngine();
		engine.start(asNode(new StubElement("div")));
		await flushMicrotasks();

		const detached = new StubElement("div");
		detached.isConnected = false;
		const node = detached.addText("Fork");
		observer.trigger([detached]);
		await flushMicrotasks();
		expect(node.nodeValue).toBe("Fork");
	});

	it("disconnects and drops pended nodes on stop", async () => {
		const { engine, observer } = makeEngine();
		engine.start(asNode(new StubElement("div")));
		await flushMicrotasks();

		const later = new StubElement("div");
		const node = later.addText("Fork");
		observer.trigger([later]);
		// 队列里还压着节点时停止：它不该再被翻译
		engine.stop();
		await flushMicrotasks();
		expect(observer.disconnected).toBe(true);
		expect(node.nodeValue).toBe("Fork");
	});
});
