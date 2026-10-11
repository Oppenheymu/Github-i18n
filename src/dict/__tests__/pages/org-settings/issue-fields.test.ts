// 组织议题字段页（/organizations/<组织>/settings/issue-fields）实机回归。
//
// 证据：2026-10-11 维护者贴的整段实机 HTML（`<react-app app-name="issue-fields-settings">`）。
// 它与议题类型页**不是同一款应用**，但显然是同一套模板改的：标题区、说明区、
// 列表头 + 每行 kebab 的句式完全对称（上游甚至把 `<form aria-labelledby="issue-types-heading">`
// 这个指向议题类型页 id 的引用照抄了过来，而本页 h2 根本没带那个 id）。
// 对照物：h2 的 `Issue fields` 命中本模块既有词条「议题字段」。
//
// 本文件锁五件事：
//   ① 路由：命中 pages/org-settings + global；`new` 与详情子页也一并覆盖；
//   ② 2 条静态键（`New field` / 说明句）全部命中；
//   ③ **两条动态文案走规则**，且与议题类型页那两条**只是句式对称、pattern 不同**：
//      列表头 `4 Issue fields`（注意大写 I，单数 `1 Issue field` 也要接住）与
//      每行 kebab 按钮的 tooltip `Open field options for <字段名>`；
//   ④ **组织数据一律不译**：payload `fields[]` 的 `name` / `description` 与
//      `<a title="…">` 的 `title`（`Priority` / `Start date` / `Target date` / `Effort`
//      与四句默认描述）都可在页面上改名改描述；
//   ⑤ 硬边界：列表项的 `aria-label`（`Issue field: Priority`）含动态字段名，
//      而属性只走整串精确匹配、**不走规则**，只能保持英文（用例正面钉住）。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织议题字段页（列表） */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/issue-fields";
/** 旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const LEGACY_PATH = "/orgs/Koishi-CE/settings/issue-fields";
/** 新建字段页（`New field` 按钮的 href） */
const NEW_PATH =
	"/organizations/Koishi-CE/settings/issue-fields/new";
/** 某个字段的详情页（列表项的 href，字段 id 是动态值） */
const DETAIL_PATH =
	"/organizations/Koishi-CE/settings/issue-fields/46147971";

const locale = dictForLocale("zh-CN");

const view = buildView(
	PAGE_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 实机里仍是英文的静态节点（按页面自上而下的顺序） */
const NEW_NODES: readonly (readonly [string, string])[] = [
	["New field", "新建字段"],
	[
		"Issue fields let you define structured data to capture for each issue, helping you keep information consistent across all of your repositories.",
		"议题字段让你可以为每个议题定义要采集的结构化数据，帮助你在所有仓库中保持信息一致。",
	],
];

/** 列表头的计数行：条数跟着组织配置的字段数走，故走规则 */
const COUNT_NODES: readonly (readonly [string, string])[] =
	[
		["4 Issue fields", "4 个议题字段"],
		["1 Issue field", "1 个议题字段"],
		["25 Issue fields", "25 个议题字段"],
	];

/** kebab 按钮的 tooltip：字段名是动态值，按原样带回 */
const TOOLTIP_NODES: readonly (readonly [
	string,
	string,
])[] = [
	[
		"Open field options for Priority",
		"打开 Priority 的字段选项",
	],
	[
		"Open field options for Start date",
		"打开 Start date 的字段选项",
	],
	// 组织把字段改成中文名也照样接得住（捕获组原样带回）
	[
		"Open field options for 优先级",
		"打开 优先级 的字段选项",
	],
];

/** 组织数据 / 用户内容 / 标识符，必须保持英文 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// payload `fields[]` 的 name / description：可在页面上改名改描述
	"Priority",
	"Start date",
	"Target date",
	"Effort",
	"Current importance level assigned to this issue",
	"Date when work on issue will begin",
	"Expected completion date for this issue",
	"Relative level of effort for completing this issue",
	// 列表项的 aria-label 含动态字段名，属性不走规则 ⇒ 只能保持英文
	"Issue field: Priority",
	"Issue field: Start date",
	"Issue field: Target date",
	"Issue field: Effort",
	// 标识符与生成 id
	"46147971",
	"_r_1_",
	"single_select",
	"restricted",
];

/** 规则的锚定反例：不该被这两条规则吃进来 */
const NOT_MATCHED: readonly string[] = [
	// 计数行只认整节点「数字 + Issue field(s)」，且**大写 I**
	"4 issue fields",
	"4 Issue fields of data",
	"4 Issue Fields",
	"Issue field",
	// tooltip 必须整串命中，且捕获组非空
	"Open field options for ",
	"Open options for Priority",
	"Open field options",
];

/**
 * 把一段实机节点序列按 walker 的语义过一遍：未命中的节点按原样保留，
 * 命中的节点写回译文并保留其首尾空白，最后拼接成页面上真实看到的那一行。
 */
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

describe("组织议题字段页的模块路由", () => {
	it("loads the org-settings shell with the global fallback", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match the per-repository or per-account modules", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).not.toContain("pages/repo-settings");
		expect(names).not.toContain("pages/settings");
		expect(names).not.toContain("pages/issues");
	});

	it("covers the legacy prefix and the new / detail sub-pages", () => {
		for (const path of [
			LEGACY_PATH,
			NEW_PATH,
			DETAIL_PATH,
		]) {
			expect(moduleNames(path)).toContain(
				"pages/org-settings",
			);
		}
	});
});

describe("组织议题字段页的实机节点", () => {
	it("translates every static node that was still English", () => {
		for (const [raw, expected] of NEW_NODES) {
			const translated = translateText(raw, view);
			expect(
				translated,
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
			expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
		}
	});

	it("translates the count line for every number and both numbers", () => {
		for (const [raw, expected] of COUNT_NODES) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("translates the kebab tooltip and passes the field name through", () => {
		for (const [raw, expected] of TOOLTIP_NODES) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("keeps the two rules anchored", () => {
		// 尤其要钉住大写 I：上游渲染的是 `4 Issue fields`，小写形态不该被吃
		for (const raw of NOT_MATCHED) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("keeps organization data, identifiers and the list-label in English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});

describe("组织议题字段页的节点切分事实", () => {
	it("renders the page header", () => {
		// h2 的「议题字段」由本模块既有词条译出，是本页的对照物
		expect(
			renderNodes([
				"议题字段",
				"New field",
				"Issue fields let you define structured data to capture for each issue, helping you keep information consistent across all of your repositories.",
			]),
		).toBe(
			"议题字段新建字段议题字段让你可以为每个议题定义要采集的结构化数据，帮助你在所有仓库中保持信息一致。",
		);
	});

	it("renders the list heading with its count", () => {
		// 实机是单个 `<span>4 Issue fields</span>`（本页没有 issue-types 那边的 `(max 25)`）
		expect(renderNodes(["4 Issue fields"])).toBe(
			"4 个议题字段",
		);
	});

	it("renders a list row: organization data stays English, tooltip turns Chinese", () => {
		// 实机一行：字段名 + 描述（都是组织数据）+ kebab 按钮的 tooltip
		expect(
			renderNodes([
				"Priority",
				"Current importance level assigned to this issue",
				"Open field options for Priority",
			]),
		).toBe(
			"PriorityCurrent importance level assigned to this issue打开 Priority 的字段选项",
		);
	});
});
