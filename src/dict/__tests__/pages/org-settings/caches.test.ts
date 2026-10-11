// 组织级缓存页（/organizations/<组织>/settings/actions/caches）实机回归。
//
// 证据：2026-10-11 维护者贴的整段实机 HTML。
// 本页**不缺路由**（挂在 `settings` 前缀下，命中 `pages/org-settings` + `global`），
// 页面上已是中文的四处正好当对照物：页头 h2 `缓存`（既有键 `Caches`）、搜索框的
// `placeholder` 与 `aria-label` 都是 `搜索仓库`（既有键 `Search repositories`）、
// 仓库名右侧的 `公开` 徽标（global 的 `Public`）。
//
// 三条边界事实：
//   1. 两处计数都是**单个文本节点**（数字与文案同节点）⇒ 只能走规则：
//      `1 repository with 12 active caches`（两个动态数字 + 两处单复数）与
//      `722 MB out of 10 GB • 12 active caches`（两个动态体积 + 一个动态数字，
//      分隔符是中点，体积小到字节时上游渲染 `0 B`，故单位部分允许缺 K/M/G）；
//   2. 排序按钮的前缀与当前值是**两个相邻文本节点**（`Sort:` + `Largest size`），
//      下拉里的候选项与当前值同串，故一条 `Largest size` 同时覆盖按钮与菜单项；
//   3. 仓库名（`koishi`）是用户内容，照例不收录；右侧徽标的 `公开` 由 global 覆盖。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织级缓存页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/actions/caches";
/** 旧前缀（`/orgs/<组织>/...`），路由也应覆盖 */
const LEGACY_PATH =
	"/orgs/Koishi-CE/settings/actions/caches";

const locale = dictForLocale("zh-CN");
const aliases = new Map(Object.entries(dictCore.aliases));
const view = buildView(PAGE_PATH, locale, aliases);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 本批补的文本节点 */
const NEW_NODES: readonly (readonly [string, string])[] = [
	[
		"You can use caches for dependencies and other commonly reused files to speed up your workflows. The data on this page have at least 5 minutes of latency.",
		"你可以用缓存存放依赖项和其他经常复用的文件，以加速工作流。此页数据至少有 5 分钟的延迟。",
	],
	["Learn more about caches", "进一步了解缓存"],
	["Sort:", "排序："],
	["Largest size", "最大大小"],
	["Smallest size", "最小大小"],
];

/** 含动态数字的两行，走本模块的两条规则 */
const RULE_NODES: readonly (readonly [string, string])[] = [
	[
		"1 repository with 12 active caches",
		"1 个仓库，共 12 个活动缓存",
	],
	[
		"2 repositories with 3 active caches",
		"2 个仓库，共 3 个活动缓存",
	],
	[
		"1 repository with 1 active cache",
		"1 个仓库，共 1 个活动缓存",
	],
	[
		"722 MB out of 10 GB • 12 active caches",
		"10 GB 中的 722 MB • 12 个活动缓存",
	],
	[
		"0 B out of 10 GB • 1 active cache",
		"10 GB 中的 0 B • 1 个活动缓存",
	],
	[
		"1.5 GB out of 10 GB • 7 active caches",
		"10 GB 中的 1.5 GB • 7 个活动缓存",
	],
];

/** 扩展在本页已生效的对照物 */
const ALREADY_COVERED: readonly (readonly [
	string,
	string,
])[] = [
	["Caches", "缓存"],
	["Search repositories", "搜索仓库"],
	["Public", "公开"],
];

const MUST_STAY_ENGLISH: readonly string[] = [
	// 仓库名与表单参数都是用户内容 / 提交值
	"koishi",
	"qr",
	"size-desc",
	"size-asc",
	"action-menu-b1281f78-9d26-4287-8cd2-9f3ca87a1ff1-button",
	"Koishi-CE",
];

/** 按 walker 语义翻译节点，保留原文首尾空白后拼接 */
function renderNodes(nodes: readonly string[]): string {
	return nodes
		.map((node) => {
			const translated = translateText(node, view);
			if (translated === null) return node;
			if (translated.trim() === "") return translated;
			const lead = node.slice(
				0,
				node.length - node.trimStart().length,
			);
			const trail = node.slice(node.trimEnd().length);
			return `${lead}${translated}${trail}`;
		})
		.join("");
}

describe("组织级缓存页的模块路由", () => {
	it("loads org-settings and the global fallback", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match repository or account settings", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).not.toContain("pages/repo-settings");
		expect(names).not.toContain("pages/settings");
	});

	it("covers the legacy organization prefix", () => {
		expect(moduleNames(LEGACY_PATH)).toContain(
			"pages/org-settings",
		);
	});
});

describe("组织级缓存页的实机节点", () => {
	it("translates every static English node", () => {
		for (const [raw, expected] of NEW_NODES) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("covers both dynamic lines through the two rules", () => {
		for (const [raw, expected] of RULE_NODES) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("keeps the already translated contrast objects working", () => {
		for (const [raw, expected] of ALREADY_COVERED) {
			expect(
				translateText(raw, view),
				`对照物失效：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("keeps repository names and form parameters in English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("leaves unenumerated size units in English instead of half-translating", () => {
		// 体积单位故意只收 B / KB / MB / GB / TB 这一类形态：上游若换成别的写法
		//（例如 `722MB` 不带空格），整行保留英文，而不是渲染出中英残句
		for (const raw of [
			"722MB out of 10GB • 12 active caches",
			"722 MB out of 10 GB - 12 active caches",
		]) {
			expect(translateText(raw, view)).toBeNull();
		}
	});
});

describe("组织级缓存页的节点边界", () => {
	it("renders the introduction with its existing documentation link", () => {
		// 链接右上方的句点是独立节点（纯符号，引擎跳过），故中文末尾留着半角句点
		expect(
			renderNodes([
				"You can use caches for dependencies and other commonly reused files to speed up your workflows. The data on this page have at least 5 minutes of latency. ",
				"Learn more about caches",
				".",
			]),
		).toBe(
			"你可以用缓存存放依赖项和其他经常复用的文件，以加速工作流。此页数据至少有 5 分钟的延迟。 进一步了解缓存.",
		);
	});

	it("renders the sort button as prefix plus current value", () => {
		expect(renderNodes(["Sort:", "Largest size"])).toBe(
			"排序：最大大小",
		);
	});

	it("renders the repository row: name, badge and usage line", () => {
		expect(
			renderNodes([
				"koishi",
				"公开",
				"722 MB out of 10 GB • 12 active caches",
			]),
		).toBe("koishi公开10 GB 中的 722 MB • 12 个活动缓存");
	});
});
