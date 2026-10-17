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
	BUFFER_CAP,
	describeBlock,
	flushMisses,
	isEnabled,
	type MissDraft,
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
		context: "",
		block: "",
		count: 1,
		...overrides,
	};
}

describe("missKey", () => {
	it("separates kinds sharing the same text", () => {
		expect(
			missKey("text", "Star", "/repo", "", ""),
		).not.toBe(missKey("title", "Star", "/repo", "", ""));
		expect(missKey("text", "Star", "/repo", "", "")).toBe(
			'["/repo","text","Star","",""]',
		);
	});

	it("separates element contexts sharing the same text", () => {
		// 同一个 `Value` 可能长在表头（th）与表单标签（label）里，两处本该分开判断
		expect(
			missKey("text", "Value", "/repo", "th", ""),
		).not.toBe(
			missKey("text", "Value", "/repo", "label", ""),
		);
	});

	it("separates the same fragment across different sentences", () => {
		// `and` 在五个句子里出现时，五句的上下文都要留下；旧版把它们糊成一条 `×4 and`，
		// 于是分拣时只看到第一句、其余四句的语序全靠猜（2026-10-17 的洞察日志）
		expect(
			missKey("text", "and", "/pulse", "span", "A and B"),
		).not.toBe(
			missKey("text", "and", "/pulse", "span", "C and D"),
		);
	});
});

describe("upsertMiss", () => {
	const draft = (
		overrides: Partial<MissDraft> = {},
	): MissDraft => ({
		kind: "text",
		text: "Star",
		path: "/repo",
		context: "",
		block: "",
		...overrides,
	});

	it("inserts a new entry with count 1", () => {
		const buffer = new Map<string, MissItem>();
		upsertMiss(buffer, draft(), 10);
		expect(buffer.size).toBe(1);
		expect(
			buffer.get(missKey("text", "Star", "/repo", "", "")),
		).toEqual(item({ text: "Star", path: "/repo" }));
	});

	it("keeps the same text separate for different paths", () => {
		const buffer = new Map<string, MissItem>();
		upsertMiss(buffer, draft({ path: "/repo/pulls" }), 10);
		upsertMiss(buffer, draft({ path: "/repo/issues" }), 10);
		expect(buffer.size).toBe(2);
	});

	it("distinguishes kinds of the same text", () => {
		const buffer = new Map<string, MissItem>();
		upsertMiss(buffer, draft(), 10);
		upsertMiss(buffer, draft({ kind: "title" }), 10);
		expect(buffer.size).toBe(2);
	});

	it("distinguishes element contexts of the same text", () => {
		const buffer = new Map<string, MissItem>();
		upsertMiss(
			buffer,
			draft({ text: "Value", context: "th" }),
			10,
		);
		upsertMiss(
			buffer,
			draft({ text: "Value", context: "label" }),
			10,
		);
		expect(buffer.size).toBe(2);
	});

	it("drops new keys at cap but still counts existing ones", () => {
		const buffer = new Map<string, MissItem>();
		upsertMiss(buffer, draft({ text: "First" }), 2);
		upsertMiss(buffer, draft({ text: "Second" }), 2);
		expect(buffer.size).toBe(2);
		upsertMiss(buffer, draft({ text: "Third" }), 2);
		expect(buffer.size).toBe(2);
		upsertMiss(buffer, draft({ text: "First" }), 2);
		expect(
			buffer.get(missKey("text", "First", "/repo", "", ""))
				?.count,
		).toBe(2);
	});
});

describe("mergeMissLogs", () => {
	it("keeps counts separate across paths", () => {
		const existing = [item({ path: "/repo", count: 3 })];
		const incoming = [
			item({ path: "/repo/pulls", count: 2 }),
		];
		const merged = mergeMissLogs(existing, incoming, 10);
		expect(merged.items).toEqual(existing.concat(incoming));
	});

	it("accumulates counts for the same path", () => {
		const existing = [
			item({ path: "/repo/pulls", count: 3 }),
		];
		const incoming = [
			item({ path: "/repo/pulls", count: 2 }),
		];
		expect(
			mergeMissLogs(existing, incoming, 10).items,
		).toEqual([item({ path: "/repo/pulls", count: 5 })]);
	});

	it("appends unseen entries", () => {
		const existing = [item({ text: "First" })];
		const incoming = [item({ text: "Second", path: "/x" })];
		const merged = mergeMissLogs(
			existing,
			incoming,
			10,
		).items;
		expect(merged).toHaveLength(2);
		expect(merged).toContainEqual(
			item({ text: "Second", path: "/x" }),
		);
	});

	it("keeps previously collected entries at cap and counts the drops", () => {
		const existing = [item({ text: "First" })];
		const incoming = [
			item({ text: "Second" }),
			item({ text: "Third" }),
		];
		const merged = mergeMissLogs(existing, incoming, 2);
		expect(merged.items).toHaveLength(2);
		const texts = merged.items.map((entry) => entry.text);
		expect(texts).toContain("First");
		expect(texts).toContain("Second");
		expect(texts).not.toContain("Third");
		// 超限的条数不再静默消失：它随导出一起交出去（审计 C-2）
		expect(merged.dropped).toBe(1);
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
	it("emits the github-zh-misses/3 schema in sorted key order", () => {
		const json = serializeMisses(
			[item({ text: "Zeta", path: "/b", count: 1 })],
			new Date("2026-09-25T12:00:00.000Z"),
		);
		const parsed = JSON.parse(json) as {
			schema: string;
			exportedAt: string;
			dropped: number;
			items: {
				text: string;
				kind: string;
				path: string;
				context: string;
				block: string;
				count: number;
			}[];
		};
		expect(parsed.schema).toBe("github-zh-misses/3");
		expect(parsed.exportedAt).toBe(
			"2026-09-25T12:00:00.000Z",
		);
		// 没有丢弃时也显式写 0：报告要靠它区分「刚好 N 条」与「被截断」
		expect(parsed.dropped).toBe(0);
		expect(parsed.items).toEqual([
			{
				text: "Zeta",
				kind: "text",
				path: "/b",
				context: "",
				block: "",
				count: 1,
			},
		]);
		expect(json).toContain('"text": "Zeta",');
	});

	it("carries the dropped count and the sentence block", () => {
		const json = serializeMisses(
			[
				item({
					text: "pushed to",
					path: "/pulse",
					block:
						"3 authors changed and there have been 12 commits pushed to main",
				}),
			],
			new Date("2026-09-25T12:00:00.000Z"),
			7,
		);
		const parsed = JSON.parse(json) as {
			dropped: number;
			items: { block: string }[];
		};
		expect(parsed.dropped).toBe(7);
		expect(parsed.items[0]?.block).toContain(
			"pushed to main",
		);
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

// 整句块是 3 版日志的核心新增字段：它把「一条记录 = 一段碎片」变成「一条记录 = 一段碎片
// + 它所在的那一行」，分拣时才能像看 HTML 一样判断语序（见 docs/guides/development.md）
describe("describeBlock（整句上下文）", () => {
	it("returns the whole line when the sentence is split by inline elements", () => {
		const paragraph = env.document.createElement("p");
		paragraph.innerHTML =
			'3 authors <a href="#">changed and there have been</a> 12 commits pushed to <a href="#">main</a>';
		const fragment =
			paragraph.querySelector("a")?.firstChild;
		expect(fragment).not.toBeNull();
		expect(describeBlock(fragment as Node)).toBe(
			"3 authors changed and there have been 12 commits pushed to main",
		);
	});

	it("returns an empty string when the node is its own line", () => {
		// 表头 / 表单标签这类整节点就是整句：整节点即整句，键可以直接收
		const cell = env.document.createElement("th");
		cell.textContent = "Last updated";
		const text = cell.firstChild;
		expect(describeBlock(text as Node)).toBe("");
	});

	it("falls back to a bare div that holds a single sentence", () => {
		// 新版 React 组件常常整句只挂在裸 <div> 里，没有 <p> / <li> 可依
		const card = env.document.createElement("div");
		card.innerHTML =
			"<div>2 contributors <strong>and</strong> 4 commits</div>";
		const fragment =
			card.querySelector("strong")?.firstChild;
		expect(describeBlock(fragment as Node)).toBe(
			"2 contributors and 4 commits",
		);
	});

	it("does not treat a label inside a card as a sentence fragment", () => {
		// 卡片里有独立的块级容器时，标签的「整行」就是它自己。判错了报告会把
		// `Active issues` 这种整标签误标成摘要句的碎片
		const card = env.document.createElement("div");
		card.innerHTML =
			"<h3>Active issues</h3><p>There are 3 active issues</p>";
		const heading = card.querySelector("h3")?.firstChild;
		expect(describeBlock(heading as Node)).toBe("");
	});

	it("collapses whitespace so fragments can be matched against the block", () => {
		const cell = env.document.createElement("td");
		cell.innerHTML =
			"  \n  1 author  \n  <span>changed</span>  ";
		const fragment = cell.querySelector("span")?.firstChild;
		expect(describeBlock(fragment as Node)).toBe(
			"1 author changed",
		);
	});

	it("gives up instead of returning an oversized ancestor", () => {
		// 超过 240 字就不是「一行」而是整段：宁可没有上下文，也不给错上下文
		const long = `Start ${"x".repeat(300)} end`;
		const paragraph = env.document.createElement("p");
		paragraph.innerHTML = `${long} <span>tail</span>`;
		const fragment =
			paragraph.querySelector("span")?.firstChild;
		expect(describeBlock(fragment as Node)).toBe("");
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
		const firstNode = env.document.createTextNode(
			"  Untranslated  ",
		);
		const secondNode =
			env.document.createTextNode("Untranslated");
		const input = env.document.createElement("input");
		recordText(firstNode, "  Untranslated  ");
		recordText(firstNode, "Untranslated");
		recordText(secondNode, "Untranslated");
		recordAttr(input, "placeholder", "Ask anything");
		await flushMisses();
		expect(stored.get("missLog")).toEqual([
			{
				kind: "text",
				text: "Untranslated",
				path: "/owner/repo/pulls",
				context: "",
				block: "",
				count: 2,
			},
			{
				kind: "placeholder",
				text: "Ask anything",
				path: "/owner/repo/pulls",
				context: "input",
				block: "",
				count: 1,
			},
		]);
	});

	it("records the sentence block with every fragment of it", async () => {
		// 这正是「日志不如贴 HTML 好用」的根因：被行内标签切开的碎片必须带上整句，
		// 否则 `pushed to` 与 `main` 之间是什么关系只能靠猜
		const paragraph = env.document.createElement("p");
		paragraph.innerHTML =
			'<span>changed and there have been</span> <a href="#">pushed to</a> main';
		env.document.body.append(paragraph);
		const fragment =
			paragraph.querySelector("span")?.firstChild;
		const link = paragraph.querySelector("a")?.firstChild;
		recordText(
			fragment as Node,
			"changed and there have been",
		);
		recordText(link as Node, "pushed to");
		await flushMisses();
		const log = stored.get("missLog") as {
			text: string;
			block: string;
		}[];
		expect(log.map((entry) => entry.text)).toEqual([
			"changed and there have been",
			"pushed to",
		]);
		// 两条碎片共享同一个整句块（块文本是记录时的实时 DOM，故含块内全部文本）
		expect(
			new Set(log.map((entry) => entry.block)),
		).toEqual(
			new Set([
				"changed and there have been pushed to main",
			]),
		);
	});

	it("persists how many records the caps swallowed", async () => {
		for (let index = 0; index < BUFFER_CAP + 3; index++) {
			const text = `Filler ${index}`;
			recordText(env.document.createTextNode(text), text);
		}
		await flushMisses();
		const log = stored.get("missLog") as unknown[];
		expect(log).toHaveLength(BUFFER_CAP);
		// 旧版把超限的记录静默丢掉，面板会永远停在 500 条也看不出截断（审计 C-2）
		expect(stored.get("missLogDropped")).toBe(3);
	});

	it("counts unique nodes once and ignores mixed-language nodes", async () => {
		const repeated =
			env.document.createTextNode("Untranslated");
		const mixed = env.document.createTextNode(
			"Actions 工作流",
		);
		const mixedAttr = env.document.createElement("button");
		recordText(repeated, "Untranslated");
		recordText(repeated, "Untranslated");
		recordText(mixed, "Actions 工作流");
		recordAttr(mixedAttr, "aria-label", "打开 Copilot…");
		await flushMisses();
		expect(stored.get("missLog")).toEqual([
			{
				kind: "text",
				text: "Untranslated",
				path: "/owner/repo/pulls",
				context: "",
				block: "",
				count: 1,
			},
		]);
	});

	it("ignores records while disabled", async () => {
		setEnabled(false);
		recordText(
			env.document.createTextNode("Untranslated"),
			"Untranslated",
		);
		recordAttr(
			env.document.createElement("div"),
			"title",
			"Untranslated",
		);
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
		recordText(
			env.document.createTextNode("Untranslated"),
			"Untranslated",
		);
		recordText(
			env.document.createTextNode("Fresh"),
			"Fresh",
		);
		await flushMisses();
		// 同一路径同文案累加，不同路径彼此独立；新键追加在后
		expect(stored.get("missLog")).toEqual([
			{
				kind: "text",
				text: "Untranslated",
				path: "/old",
				context: "",
				block: "",
				count: 3,
			},
			{
				kind: "title",
				text: "Kept",
				path: "/old",
				context: "",
				block: "",
				count: 1,
			},
			{
				kind: "text",
				text: "Untranslated",
				path: "/owner/repo/pulls",
				context: "",
				block: "",
				count: 1,
			},
			{
				kind: "text",
				text: "Fresh",
				path: "/owner/repo/pulls",
				context: "",
				block: "",
				count: 1,
			},
		]);
	});

	it("flushes on the 5 second interval", async () => {
		recordText(
			env.document.createTextNode("Untranslated"),
			"Untranslated",
		);
		expect(stored.size).toBe(0);
		intervals.at(-1)?.();
		await env.tick();
		expect(stored.has("missLog")).toBe(true);
	});

	it("flushes when the page becomes hidden", async () => {
		recordText(
			env.document.createTextNode("Untranslated"),
			"Untranslated",
		);
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
		recordText(
			env.document.createTextNode("Untranslated"),
			"Untranslated",
		);
		env.window.dispatchEvent(env.createEvent("pagehide"));
		await env.tick();
		expect(stored.has("missLog")).toBe(true);
	});
});
