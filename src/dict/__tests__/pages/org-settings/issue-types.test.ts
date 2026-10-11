// 组织议题类型页（/organizations/<组织>/settings/issue-types）实机回归。
//
// 证据：2026-10-11 维护者贴的整段实机 HTML（`<react-app app-name="issue-types">`，
// 又是一个独立的 React 应用；路由照旧由 `settings` 前缀命中 pages/org-settings）。
// 对照物：h2 的 `Issue types` 命中本模块既有词条「议题类型」。
//
// 本文件锁五件事：
//   ① 路由：命中 pages/org-settings + global；同前缀下的新建页
//     （`/settings/issue-types/new`）与详情页（`/settings/issue-types/<id>`）也一并覆盖；
//   ② 4 条静态键（`New type` / 说明句 / `(max 25)` / fieldset 的 aria-label）全部命中；
//   ③ **两条动态文案走规则**：列表头计数行 `3 types`（`1 type` 也要接住）与每行 kebab
//      按钮的 tooltip `Open type options for <类型名>`（实机里第一个 tooltip 正展开着、
//      带着算好的坐标，属可见文案）；
//   ④ **组织数据一律不译**：payload `issueTypes[]` 的 `name` / `description`
//      （`Task` / `Bug` / `Feature` 与三句默认描述）可以在页面上改名改描述，
//      与自定义属性页的属性名同类——用例用反例钉住；
//   ⑤ 硬边界：列表项的 `aria-label`（`"Task" Issue type list item`）含动态类型名，
//      而属性只走整串精确匹配、**不走规则**，故只能保持英文（用例正面钉住这条）。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织议题类型页（列表） */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/issue-types";
/** 旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const LEGACY_PATH = "/orgs/Koishi-CE/settings/issue-types";
/** 新建类型页（`New type` 按钮的 href） */
const NEW_PATH =
	"/organizations/Koishi-CE/settings/issue-types/new";
/** 某个类型的详情页（列表项的 href，类型 id 是动态值） */
const DETAIL_PATH =
	"/organizations/Koishi-CE/settings/issue-types/850447458";

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

/** 实机里仍是英文的文本节点（按页面自上而下的顺序） */
const NEW_NODES: readonly (readonly [string, string])[] = [
	// 页头：h2 由既有词条译出，`New type` 按钮是本批新键
	["New type", "新建类型"],
	[
		"Customize your issue types. Issue types can be used to classify and manage issues in your repositories.",
		"自定义你的议题类型。议题类型可用于对仓库中的议题进行分类和管理。",
	],
	// 列表头的上限提示（产品常量，按静态键收；全角括号同 `(Private)` 一类片段）
	["(max 25)", "（最多 25）"],
];

/** 属性键（`aria-label` 只走整串精确匹配） */
const ATTR_KEYS: readonly (readonly [string, string])[] = [
	["List of issue types", "议题类型列表"],
];

/** 列表头的计数行：条数跟着组织配置的类型数走，故走规则 */
const COUNT_NODES: readonly (readonly [string, string])[] =
	[
		["3 types", "3 个类型"],
		["1 type", "1 个类型"],
		["25 types", "25 个类型"],
	];

/** kebab 按钮的 tooltip：类型名是动态值，按原样带回 */
const TOOLTIP_NODES: readonly (readonly [
	string,
	string,
])[] = [
	["Open type options for Task", "打开 Task 的类型选项"],
	["Open type options for Bug", "打开 Bug 的类型选项"],
	// 组织把类型改成中文名也照样接得住（捕获组原样带回）
	["Open type options for 缺陷", "打开 缺陷 的类型选项"],
];

/** 组织数据 / 用户内容 / 标识符，必须保持英文 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// payload `issueTypes[]` 的 name 与 description：可在页面上改名改描述
	"Task",
	"Bug",
	"Feature",
	"A specific piece of work",
	"An unexpected problem or behavior",
	"A request, idea, or new functionality",
	// 列表项的 aria-label 含动态类型名，属性不走规则 ⇒ 只能保持英文
	'"Task" Issue type list item',
	'"Bug" Issue type list item',
	'"Feature" Issue type list item',
	// 标识符与生成 id
	"850447458",
	"_r_1_",
	"issue-types-heading",
	"create-issue-type",
];

/** 规则的锚定反例：不该被这两条规则吃进来 */
const NOT_MATCHED: readonly string[] = [
	// 计数行只认整节点「数字 + type(s)」
	"3 types of repositories",
	"3 Types",
	"No types",
	"types",
	// tooltip 必须整串命中，且捕获组非空
	"Open type options for ",
	"Open options for Task",
	"Open type options",
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

describe("组织议题类型页的模块路由", () => {
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

describe("组织议题类型页的实机节点", () => {
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

	it("translates the accessible name of the list", () => {
		for (const [raw, expected] of ATTR_KEYS) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
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

	it("translates the kebab tooltip and passes the type name through", () => {
		for (const [raw, expected] of TOOLTIP_NODES) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("keeps the two rules anchored", () => {
		for (const raw of NOT_MATCHED) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("keeps organization data, identifiers and the list-label in English", () => {
		// 列表项的 `aria-label` 是**硬边界**：它含动态类型名，而属性不走规则
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});

describe("组织议题类型页的节点切分事实", () => {
	it("renders the page header", () => {
		// h2 的「议题类型」由本模块既有词条译出，是本页的对照物
		expect(
			renderNodes([
				"议题类型",
				"New type",
				"Customize your issue types. Issue types can be used to classify and manage issues in your repositories.",
			]),
		).toBe(
			"议题类型新建类型自定义你的议题类型。议题类型可用于对仓库中的议题进行分类和管理。",
		);
	});

	it("renders the list heading with its limit", () => {
		// 实机：`<span>3 types</span><span>(max 25)</span>`——两个节点，前者走规则
		expect(renderNodes(["3 types", "(max 25)"])).toBe(
			"3 个类型（最多 25）",
		);
	});

	it("renders a list row: organization data stays English, tooltip turns Chinese", () => {
		// 实机一行：类型名 + 描述（都是组织数据）+ kebab 按钮的 tooltip
		expect(
			renderNodes([
				"Task",
				"A specific piece of work",
				"Open type options for Task",
			]),
		).toBe(
			"TaskA specific piece of work打开 Task 的类型选项",
		);
	});
});
