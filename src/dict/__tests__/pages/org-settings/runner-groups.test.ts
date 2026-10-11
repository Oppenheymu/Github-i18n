// 组织级运行器组列表页（/organizations/<组织>/settings/actions/runner-groups）实机回归。
//
// 证据：2026-10-11 维护者贴的整段实机 HTML。
// 本页**不缺路由**（挂在 `settings` 前缀下，命中 `pages/org-settings` + `global`），
// 页面上已是中文的三处正好当对照物：页头 h2 与搜索表单的 `aria-label` 都是 `运行器组`
//（既有键 `Runner groups`）、表头第二列的 `运行器`（既有键 `Runners`）。
//
// 三条边界事实：
//   1. `Default` 是 GitHub 自动创建的默认运行器组名，在实机上出现**三次**：组名链接的文字、
//      旁边的二级徽标文字、以及该徽标的 `title` 属性。三处同串，一条键覆盖三处
//      （属性只走词条查表、不应用规则）。它是泛化短词，收下的理由与风险写在 canonical 注释里；
//   2. 默认组下面那行说明（`All repositories, excluding public repositories`）是
//      GitHub 按组自动生成的描述，不是用户内容，照常收录；
//   3. 表头第一列 `Group` 是**单字泛化词**（本模块第一次收它）——同页第二列 `运行器`
//      由既有键覆盖，两列不必互相对齐。实机若出现读不通的「组」就删词条，不加白名单。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织级运行器组列表页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/actions/runner-groups";
/** 旧前缀（`/orgs/<组织>/...`），路由也应覆盖 */
const LEGACY_PATH =
	"/orgs/Koishi-CE/settings/actions/runner-groups";
/** 仓库级的运行器组页面：`Default` 那条键在那边早就有（规则集严重级别下拉），用于断言同译 */
const REPO_PATH =
	"/Oppenheymu/Github-i18n/settings/actions/runner-groups";

const locale = dictForLocale("zh-CN");
const aliases = new Map(Object.entries(dictCore.aliases));
const view = buildView(PAGE_PATH, locale, aliases);
const repoView = buildView(REPO_PATH, locale, aliases);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 本批补的文本节点 */
const NEW_NODES: readonly (readonly [string, string])[] = [
	[
		"Control access to your runners by specifying the repositories that are able to use your shared organization runners. New runners will be automatically assigned to the default group if no other group is specified.",
		"通过指定能够使用你的共享组织运行器的仓库，来控制对运行器的访问。如果未指定其他组，新建的运行器将自动分配到默认组。",
	],
	["New runner group", "新建运行器组"],
	["Group", "组"],
	[
		"All repositories, excluding public repositories",
		"所有仓库，公开仓库除外",
	],
	["Default", "默认"],
];

/** 只出现在属性上的文案（搜索框的 placeholder 与表单的 aria-label） */
const ATTR_NODES: readonly (readonly [string, string])[] = [
	["Search runner groups", "搜索运行器组"],
];

/** 扩展在本页已生效的对照物 */
const ALREADY_COVERED: readonly (readonly [
	string,
	string,
])[] = [
	["Runner groups", "运行器组"],
	["Runners", "运行器"],
];

const MUST_STAY_ENGLISH: readonly string[] = [
	"runner-groups",
	"qr",
	"runner-group-1",
	"Koishi-CE",
	"GitHub",
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

describe("组织级运行器组列表页的模块路由", () => {
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

describe("组织级运行器组列表页的实机节点", () => {
	it("translates every organization-only string", () => {
		for (const [raw, expected] of NEW_NODES) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("translates the search placeholder and keeps the existing accessible names", () => {
		for (const [raw, expected] of ATTR_NODES) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
		for (const [raw, expected] of ALREADY_COVERED) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("translates the default group name exactly like the repository module", () => {
		// 「默认」这条键在 pages/repo-settings 里早有（规则集严重级别下拉），此处同译
		expect(translateText("Default", view)).toBe("默认");
		expect(translateText("Default", repoView)).toBe("默认");
	});

	it("keeps path segments, form names and the organization in English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});

describe("组织级运行器组列表页的节点边界", () => {
	it("covers the default row: name link, badge text and badge title", () => {
		// 三处同串：链接文字、徽标文字、徽标的 title 属性（属性只走词条查表）
		expect(renderNodes(["Default"])).toBe("默认");
		expect(translateText("Default", view)).toBe("默认");
		expect(renderNodes(["Runner groups"])).toBe("运行器组");
	});

	it("renders the table header with its two existing/added columns", () => {
		// 第一列是本批新收的 `Group`，第二列由既有键覆盖（空列没有文本节点）
		expect(renderNodes(["Group", "运行器"])).toBe(
			"组运行器",
		);
	});

	it("renders the row description after the group name", () => {
		expect(
			renderNodes([
				"Default",
				"All repositories, excluding public repositories",
			]),
		).toBe("默认所有仓库，公开仓库除外");
	});
});
