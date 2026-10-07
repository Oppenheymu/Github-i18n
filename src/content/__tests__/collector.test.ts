import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import type { MissItem } from "../../shared/types.ts";
import {
	type DomEnvironment,
	installDom,
} from "../../test-support/dom.ts";
import {
	flushMisses,
	isEnabled,
	mergeMissLogs,
	missKey,
	recordAttr,
	recordText,
	serializeMisses,
	setEnabled,
	sortMisses,
	startAutoFlush,
	upsertMiss,
} from "../collector.ts";

// —— 落盘链路的环境 ——
// 本文件大部分用例是纯函数，但 flushMisses / startAutoFlush 的挂载点必须是**真实的
// EventTarget**，才能「派发事件 → 断言真的落盘」，而不是只断言「注册过监听器」。
const env: DomEnvironment = installDom();
const globals = globalThis as unknown as Record<
	string,
	unknown
>;
globals["location"] = { pathname: "/owner/repo/pulls" };

/** chrome.storage.local 桩（合并挂载；落盘链路要能看见写进去的内容） */
const stored = new Map<string, unknown>();
const chromeGlobal = (globals["chrome"] ?? {}) as Record<
	string,
	unknown
>;
chromeGlobal["storage"] = {
	local: {
		async get(
			key: string,
		): Promise<Record<string, unknown>> {
			return stored.has(key)
				? { [key]: stored.get(key) }
				: {};
		},
		async set(values: Record<string, unknown>) {
			for (const [key, value] of Object.entries(values)) {
				stored.set(key, value);
			}
		},
		async remove(key: string) {
			stored.delete(key);
		},
	},
};
globals["chrome"] = chromeGlobal;

// 模块单例（enabled + 缓冲）与 globalThis 一样**跨测试文件共享**：跑过真实入口的
// 文件（index.test.ts）会把开关打开，并在缓冲里留下未落盘的漏翻。这里先把状态收回
// 基线，后面的断言才与 bun 的文件发现顺序无关——本机 Windows 按目录字母序把本文件
// 排在 index 之前（一直绿），CI 的 Linux readdir 顺序把它排在 index 之后（2026-10-02
// 起 CI 一直红在下面两条上）。flush 顺带清空缓冲，写的是本文件自己的 storage 桩。
setEnabled(false);
await flushMisses();

const intervals: (() => void)[] = [];
globals["setInterval"] = (handler: () => void) => {
	intervals.push(handler);
	return 0;
};

afterAll(() => {
	env.restore();
});

function item(overrides: Partial<MissItem> = {}): MissItem {
	return {
		kind: "text",
		text: "Some English Text",
		path: "/owner/repo",
		count: 1,
		...overrides,
	};
}

describe("missKey", () => {
	it("separates kinds sharing the same text", () => {
		expect(missKey("text", "Star")).not.toBe(
			missKey("title", "Star"),
		);
		expect(missKey("text", "Star")).toBe("text\u0000Star");
	});
});

describe("upsertMiss", () => {
	it("inserts a new entry with count 1", () => {
		const buffer = new Map<string, MissItem>();
		upsertMiss(buffer, "text", "Star", "/repo", 10);
		expect(buffer.size).toBe(1);
		expect(buffer.get(missKey("text", "Star"))).toEqual(
			item({ text: "Star", path: "/repo" }),
		);
	});

	it("accumulates count and keeps the first path", () => {
		const buffer = new Map<string, MissItem>();
		upsertMiss(buffer, "text", "Star", "/repo/pulls", 10);
		upsertMiss(buffer, "text", "Star", "/repo/issues", 10);
		expect(buffer.get(missKey("text", "Star"))).toEqual(
			item({ text: "Star", path: "/repo/pulls", count: 2 }),
		);
	});

	it("distinguishes kinds of the same text", () => {
		const buffer = new Map<string, MissItem>();
		upsertMiss(buffer, "text", "Star", "/repo", 10);
		upsertMiss(buffer, "title", "Star", "/repo", 10);
		expect(buffer.size).toBe(2);
	});

	it("drops new keys at cap but still counts existing ones", () => {
		const buffer = new Map<string, MissItem>();
		upsertMiss(buffer, "text", "First", "/repo", 2);
		upsertMiss(buffer, "text", "Second", "/repo", 2);
		expect(buffer.size).toBe(2);
		upsertMiss(buffer, "text", "Third", "/repo", 2);
		expect(buffer.size).toBe(2);
		upsertMiss(buffer, "text", "First", "/repo", 2);
		expect(
			buffer.get(missKey("text", "First"))?.count,
		).toBe(2);
	});
});

describe("mergeMissLogs", () => {
	it("accumulates counts and keeps the persisted path", () => {
		const existing = [item({ path: "/repo", count: 3 })];
		const incoming = [
			item({ path: "/repo/pulls", count: 2 }),
		];
		const merged = mergeMissLogs(existing, incoming, 10);
		expect(merged).toEqual([
			item({ path: "/repo", count: 5 }),
		]);
	});

	it("appends unseen entries", () => {
		const existing = [item({ text: "First" })];
		const incoming = [item({ text: "Second", path: "/x" })];
		const merged = mergeMissLogs(existing, incoming, 10);
		expect(merged).toHaveLength(2);
		expect(merged).toContainEqual(
			item({ text: "Second", path: "/x" }),
		);
	});

	it("keeps previously collected entries at cap", () => {
		const existing = [item({ text: "First" })];
		const incoming = [
			item({ text: "Second" }),
			item({ text: "Third" }),
		];
		const merged = mergeMissLogs(existing, incoming, 2);
		expect(merged).toHaveLength(2);
		const texts = merged.map((entry) => entry.text);
		expect(texts).toContain("First");
		expect(texts).toContain("Second");
		expect(texts).not.toContain("Third");
	});

	it("does not mutate its inputs", () => {
		const existing = [item({ count: 1 })];
		const incoming = [item({ count: 1 })];
		mergeMissLogs(existing, incoming, 10);
		expect(existing[0]?.count).toBe(1);
		expect(incoming[0]?.count).toBe(1);
	});
});

describe("sortMisses", () => {
	it("sorts by path asc, then count desc, then text asc", () => {
		const sorted = sortMisses([
			item({ path: "/b", text: "Zeta", count: 1 }),
			item({ path: "/a", text: "Beta", count: 1 }),
			item({ path: "/b", text: "Alpha", count: 3 }),
			item({ path: "/b", text: "Alpha", count: 2 }),
			item({ path: "/a", text: "Alpha", count: 1 }),
		]);
		expect(sorted.map((entry) => entry.text)).toEqual([
			"Alpha",
			"Beta",
			"Alpha",
			"Alpha",
			"Zeta",
		]);
	});

	it("keeps the original order for entries that tie on all three keys", () => {
		// 同一段文案可能同时以 text 与 title 两种 kind 记录（三个排序键完全相同），
		// 此时保持插入顺序——kind 不参与排序，导出结果才是稳定的
		const sorted = sortMisses([
			item({ path: "/a", text: "Star", count: 1 }),
			item({
				path: "/a",
				text: "Star",
				count: 1,
				kind: "title",
			}),
		]);
		expect(sorted.map((entry) => entry.kind)).toEqual([
			"text",
			"title",
		]);
	});
});

describe("serializeMisses", () => {
	it("emits the github-zh-misses/1 schema in sorted key order", () => {
		const json = serializeMisses(
			[item({ text: "Zeta", path: "/b", count: 1 })],
			new Date("2026-09-25T12:00:00.000Z"),
		);
		const parsed = JSON.parse(json) as {
			schema: string;
			exportedAt: string;
			items: {
				text: string;
				kind: string;
				path: string;
				count: number;
			}[];
		};
		expect(parsed.schema).toBe("github-zh-misses/1");
		expect(parsed.exportedAt).toBe(
			"2026-09-25T12:00:00.000Z",
		);
		expect(parsed.items).toEqual([
			{
				text: "Zeta",
				kind: "text",
				path: "/b",
				count: 1,
			},
		]);
		expect(json).toContain('"text": "Zeta",');
	});

	it("sorts items by path asc, then count desc", () => {
		const json = serializeMisses(
			[
				item({ text: "B", path: "/b", count: 5 }),
				item({ text: "A", path: "/a", count: 1 }),
			],
			new Date("2026-09-25T12:00:00.000Z"),
		);
		const parsed = JSON.parse(json) as {
			items: { text: string }[];
		};
		expect(parsed.items.map((entry) => entry.text)).toEqual(
			["A", "B"],
		);
	});
});

describe("module state", () => {
	it("starts disabled", async () => {
		// 「默认关闭」是模块**初始化器**的性质，只能对着全新实例断言：单例在一个
		// 进程里只初始化一次，别的文件先跑过真实入口时共享单例早已不是初始值
		// （见文件头对跨文件共享的说明）。带查询串的 import 在 Bun 里是新实例。
		const freshSpecifier =
			"../collector.ts?fresh-default-state";
		const fresh = (await import(
			freshSpecifier
		)) as typeof import("../collector.ts");
		expect(fresh.isEnabled()).toBe(false);
	});

	it("toggles via setEnabled", () => {
		setEnabled(true);
		expect(isEnabled()).toBe(true);
		setEnabled(false);
		expect(isEnabled()).toBe(false);
	});
});

// 模块单例（enabled + 缓冲）是共享状态，但本 describe 自己建立基线：beforeEach 打开
// 开关，afterEach 落盘清缓冲 + 还原开关，故与文件内、文件外的用例顺序都无关。
describe("漏翻缓冲的落盘链路", () => {
	beforeAll(() => {
		// 只装一次：真实注册 5 秒定时器 + visibilitychange / pagehide 两个卸载钩子
		startAutoFlush();
	});

	beforeEach(() => {
		stored.clear();
		setEnabled(true);
	});

	afterEach(async () => {
		// flush 顺带清空模块缓冲，避免把收集到的条目漏给后续用例
		await flushMisses();
		setEnabled(false);
		stored.clear();
	});

	it("records text and attribute misses under the current path", async () => {
		// 调用方传来的文本可能带首尾空白（walker 传的是 trimmed 原文，这里防回归）
		recordText("  Untranslated  ");
		recordText("Untranslated");
		recordAttr("placeholder", "Ask anything");
		await flushMisses();
		expect(stored.get("missLog")).toEqual([
			{
				kind: "text",
				text: "Untranslated",
				path: "/owner/repo/pulls",
				count: 2,
			},
			{
				kind: "placeholder",
				text: "Ask anything",
				path: "/owner/repo/pulls",
				count: 1,
			},
		]);
	});

	it("ignores records while disabled", async () => {
		setEnabled(false);
		recordText("Untranslated");
		recordAttr("title", "Untranslated");
		await flushMisses();
		// 缓冲为空 → 连一次 storage 写都没有（关闭即零开销，改动也不落盘）
		expect(stored.size).toBe(0);
	});

	it("does not touch storage when nothing was collected", async () => {
		// 这就是落盘节流：无新增不写 storage（否则 5 秒一次的定时器会一直写）
		await flushMisses();
		expect(stored.size).toBe(0);
	});

	it("merges into the persisted log instead of overwriting it", async () => {
		stored.set("missLog", [
			{
				kind: "text",
				text: "Untranslated",
				path: "/old",
				count: 3,
			},
			{
				kind: "title",
				text: "Kept",
				path: "/old",
				count: 1,
			},
		]);
		recordText("Untranslated");
		recordText("Fresh");
		await flushMisses();
		// 同键累加且 path 保留首次，新键追加在后
		expect(stored.get("missLog")).toEqual([
			{
				kind: "text",
				text: "Untranslated",
				path: "/old",
				count: 4,
			},
			{
				kind: "title",
				text: "Kept",
				path: "/old",
				count: 1,
			},
			{
				kind: "text",
				text: "Fresh",
				path: "/owner/repo/pulls",
				count: 1,
			},
		]);
	});

	it("flushes on the 5 second interval", async () => {
		recordText("Untranslated");
		expect(stored.size).toBe(0);
		intervals.at(-1)?.();
		await env.tick();
		expect(stored.has("missLog")).toBe(true);
	});

	it("flushes when the page becomes hidden", async () => {
		recordText("Untranslated");
		Object.defineProperty(env.document, "visibilityState", {
			value: "hidden",
			configurable: true,
		});
		env.document.dispatchEvent(
			env.createEvent("visibilitychange"),
		);
		await env.tick();
		expect(stored.has("missLog")).toBe(true);
	});

	it("flushes when the page is unloaded", async () => {
		recordText("Untranslated");
		env.window.dispatchEvent(env.createEvent("pagehide"));
		await env.tick();
		expect(stored.has("missLog")).toBe(true);
	});
});
