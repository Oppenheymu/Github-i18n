// 组织项目设置页（/organizations/<组织>/settings/projects）实机回归。
//
// 证据：2026-10-11 维护者贴的整段实机 HTML（从 `Layout-main` 起，采集时扩展仍在运行）。
// 纯 SSR（Rails 表单，无 react-partial），路由挂在 `settings` 前缀下——表单的 `action`
// 是组织根上的 `/organizations/<组织>/projects_enabled`，那是**提交地址**、不是页面地址，
// 别照着它去找路由。页面上自带两条对照物：h2 的 `Projects` 命中本模块既有词条「项目」、
// 空态链接的 `Learn more` 由 global 译作「了解更多」，其余英文才是本批清单。
//
// 本文件锁五件事：
//   ① 路由：命中 pages/org-settings + global，不命中 pages/repo-settings / pages/settings；
//   ② 12 条文本键 + 1 条**属性**键（保存按钮的 `data-disable-with="Saving…"`）全部命中；
//   ③ 节点切分事实：第一条注解被两个 `<strong>`（组织名）夹住，**中间那个文本节点同时含
//      第一句的句尾与第二句的开头**（`organization. Members can create projects … from any`，
//      normalizeKey 把源码换行折成一个空格）；中文把 `-owned repository` 拆成「归 … 所有」，
//      组织名正好落在两个 strong 之间——整句渲染出来的样子由用例钉住；
//   ④ `Saving…`（单字符省略号）与本模块既有的 `Saving...`（三个半角句点）不是同串，
//      两条并存、不能互相顶替（先例：`Updating…` 也是单字符省略号）；
//   ⑤ 反例：组织名、表单 `action` / `name`、checkbox 的 `value`（`0` / `1`）保持英文。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织项目设置页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/projects";
/** 旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const LEGACY_PATH = "/orgs/Koishi-CE/settings/projects";
/** 表单提交地址（组织根上，**不是**页面地址；路由不该因此改变） */
const SUBMIT_PATH =
	"/organizations/Koishi-CE/projects_enabled";

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
	[
		"Projects on GitHub help you organize and prioritize your work. You can create projects for specific feature work, comprehensive roadmaps, or even release checklists.",
		"GitHub 上的项目可帮助你整理工作并确定优先级。你可以为特定的功能开发、完整的路线图，甚至发布清单创建项目。",
	],
	// 第一个复选框
	[
		"Enable Projects for the organization",
		"为此组织启用项目",
	],
	// 它的注解：被两个 `<strong>`（组织名）切成三段
	[
		"This allows members to create projects for the",
		"这使成员可以为",
	],
	[
		"organization. Members can create projects to organize and track issues from any",
		"组织创建项目。成员可以创建项目，用于整理和跟踪任何归",
	],
	["-owned repository.", "所有的仓库中的议题。"],
	// 第二个复选框
	[
		"Allow members to change project visibilities for this organization",
		"允许成员更改此组织的项目可见性",
	],
	[
		"If enabled, members with admin permissions on a project can make the project public or private. If disabled, only organization owners can make the project public or private. All projects are private by default.",
		"如果启用，具有项目管理员权限的成员可以将项目设为公开或私有。如果禁用，只有组织所有者可以将项目设为公开或私有。所有项目默认都是私有的。",
	],
	// 「推荐模板」区块与空态
	["Recommended templates", "推荐模板"],
	[
		"Customize a selection of recommended project templates for this organization. These templates will be surfaced first when a member of the organization creates a new project.",
		"为此组织自定义一组推荐的项目模板。当组织成员创建新项目时，这些模板会优先显示。",
	],
	[
		"Create your first GitHub project template",
		"创建你的第一个 GitHub 项目模板",
	],
	[
		"Templates can be used to quickly get started with a new project.",
		"模板可用于快速开始一个新项目。",
	],
	["New template", "新建模板"],
];

/** 属性键：保存按钮的 in-flight 文案（六个可翻译属性之一） */
const ATTR_KEYS: readonly (readonly [string, string])[] = [
	["Saving…", "正在保存…"],
];

/** 本批之前就已生效的对照物 */
const ALREADY_COVERED: readonly (readonly [
	string,
	string,
])[] = [
	["Projects", "项目"],
	["Learn more", "了解更多"],
	["Save", "保存"],
];

/** 用户内容 / 表单值 / 标识符，必须保持英文 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"Koishi-CE",
	"0",
	"1",
	"put",
	"organization[organization_projects_enabled]",
	"organization[members_can_change_project_visibility]",
	"organization_projects_enabled",
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

describe("组织项目设置页的模块路由", () => {
	it("loads the org-settings shell with the global fallback", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match the per-repository or per-account modules", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).not.toContain("pages/repo-settings");
		expect(names).not.toContain("pages/settings");
	});

	it("covers the legacy prefix and leaves the submit path alone", () => {
		expect(moduleNames(LEGACY_PATH)).toContain(
			"pages/org-settings",
		);
		// 表单提交地址在组织根上、不带 `/settings/`：它**不该**被当成页面路由
		// （本仓的 org-settings 路由只收 `settings` / `billing_managers` / `topics`）
		expect(moduleNames(SUBMIT_PATH)).not.toContain(
			"pages/org-settings",
		);
	});
});

describe("组织项目设置页的实机节点", () => {
	it("translates every node that the real page still showed in English", () => {
		for (const [raw, expected] of NEW_NODES) {
			const translated = translateText(raw, view);
			expect(
				translated,
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
			expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
		}
	});

	it("translates the in-flight label of the save button", () => {
		// `data-disable-with` 是六个可翻译属性之一，属性只走整串精确匹配
		for (const [raw, expected] of ATTR_KEYS) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("keeps the ellipsis and the three-dot variants apart", () => {
		// 同一个按钮文案的两种写法在本模块并存：本页是单字符 `…`，
		// 新建 / 编辑标签表单是三个半角句点（既有键），两条不能互相顶替
		expect(translateText("Saving…", view)).toBe(
			"正在保存…",
		);
		expect(translateText("Saving...", view)).toBe(
			"正在保存...",
		);
		expect(translateText("Saving…", view)).not.toBe(
			translateText("Saving...", view),
		);
	});

	it("keeps the nodes that were already covered before this batch", () => {
		for (const [raw, expected] of ALREADY_COVERED) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("keeps user content, form values and identifiers in English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});

describe("组织项目设置页的节点切分事实", () => {
	it("renders the intro paragraph", () => {
		expect(
			renderNodes([
				"Projects on GitHub help you organize and prioritize your work. You can create projects for specific feature work, comprehensive roadmaps, or even release checklists.",
			]),
		).toBe(
			"GitHub 上的项目可帮助你整理工作并确定优先级。你可以为特定的功能开发、完整的路线图，甚至发布清单创建项目。",
		);
	});

	it("renders the first note across its two organization-name nodes", () => {
		// 实机：`This allows members to create projects for the <strong>Koishi-CE</strong>
		// organization.\n        Members can create projects … from any
		// <strong>Koishi-CE</strong>-owned repository.`——中间那个文本节点横跨两句话；
		// 中文把 `-owned` 拆成「归 … 所有」，组织名落在两个 strong 之间。
		// 末段译文不带前导空格（原文此处也没有空格），故读作「Koishi-CE所有」，
		// 这是中文里拉丁词与汉字相邻的常态，不是漏了空格
		expect(
			renderNodes([
				"This allows members to create projects for the ",
				"Koishi-CE",
				" organization.\n        Members can create projects to organize and track issues from any ",
				"Koishi-CE",
				"-owned repository.",
			]),
		).toBe(
			"这使成员可以为 Koishi-CE 组织创建项目。成员可以创建项目，用于整理和跟踪任何归 Koishi-CE所有的仓库中的议题。",
		);
	});

	it("renders the second checkbox with its single-node note", () => {
		expect(
			renderNodes([
				"Allow members to change project visibilities for this organization",
				"If enabled, members with admin permissions on a project can make the project public or private. If disabled, only organization owners can make the project public or private. All projects are private by default.",
			]),
		).toBe(
			"允许成员更改此组织的项目可见性如果启用，具有项目管理员权限的成员可以将项目设为公开或私有。如果禁用，只有组织所有者可以将项目设为公开或私有。所有项目默认都是私有的。",
		);
	});

	it("renders the recommended-templates blank slate", () => {
		// 空态里的 `Learn more` 链接实机已是「了解更多」（global 的词条），
		// 这里按实机形态原样拼进去
		expect(
			renderNodes([
				"Recommended templates",
				"Customize a selection of recommended project templates for this organization. These templates will be surfaced first when a member of the organization creates a new project.",
				"Create your first GitHub project template",
				"Templates can be used to quickly get started with a new project.",
				"New template",
				"了解更多",
			]),
		).toBe(
			"推荐模板为此组织自定义一组推荐的项目模板。当组织成员创建新项目时，这些模板会优先显示。创建你的第一个 GitHub 项目模板模板可用于快速开始一个新项目。新建模板了解更多",
		);
	});
});
