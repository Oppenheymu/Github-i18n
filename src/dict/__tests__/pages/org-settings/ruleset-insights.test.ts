// 组织规则集洞察页（/organizations/<组织>/settings/rules/insights）实机回归。
//
// 证据：2026-10-10 维护者贴的实机 outerHTML（采集时扩展仍在运行——页面已有一半是中文：
// `organization` 命中本模块的小写词条「组织」、链接的 `Learn more` 命中 global，
// 这两处正好当「扩展确实在这一页生效」的对照物；仍是英文的四条才是本批清单）。
//
// 与前两页同源：HTML 里的 `<react-app app-name="repos-rules" …>` 说明它与仓库级
// `/owner/repo/settings/rules/**` 是同一个 React 应用，而 pages/repo-settings 的路由
// 排除了 `organizations`/`orgs`，故同一批文案要在本模块各收一份并**逐字同译**。
//
// 本文件锁四件事：
//   ① 路由：本页只命中 pages/org-settings + global，不命中 pages/repo-settings；
//   ② 四条仍是英文的节点全部命中（H1 / 说明段 / 试用按钮，以及被 React 拆开的
//      `See how rulesets are affecting this` 前半句）；
//   ③ 节点切分：`See how rulesets are affecting this` + `organization` 是两个节点
//      （名词由 payload 的 `sourceType` 决定），拼接后带一个空格——空格是原文节点自带的，
//      与仓库级那批（拼 `repository`）同形；
//   ④ 反例：`repository` 是仓库级那条路径的名词，本模块**没有**这条键（组织页用
//      `organization`），另外 H1 的译文与侧栏项 `Ruleset insights` 不是同串。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织规则集洞察页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/rules/insights";
/** 旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const LEGACY_PATH =
	"/orgs/Koishi-CE/settings/rules/insights";
/** 仓库级那条路径的视图（同一批文案的既有译文在这里） */
const REPO_PATH =
	"/microsoft/vscode/settings/actions/rules/insights";

const locale = dictForLocale("zh-CN");

const view = buildView(
	PAGE_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

const REPO_VIEW = buildView(
	REPO_PATH,
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
	// 页头 H1：单数 `ruleset`，与侧栏项 `Ruleset insights` 不是同串
	["Repository ruleset insights", "仓库规则集洞察"],
	// 空态大标题的前半句；名词节点（`organization` → 组织）由既有词条覆盖
	[
		"See how rulesets are affecting this",
		"查看规则集如何影响此",
	],
	[
		"Enterprise accounts enable you to review commits against rulesets to track pass, fail, or bypass status for greater oversight and understanding.",
		"企业账户让你可以对照规则集审查提交，以跟踪通过、失败或绕过状态，从而获得更强的监督与理解。",
	],
	["Try GitHub Enterprise", "试用 GitHub Enterprise"],
];

/** 页面上已是中文的节点（既有键的产物，用作对照物） */
const ALREADY_COVERED: readonly (readonly [
	string,
	string,
])[] = [
	// 大标题里那个由 payload `sourceType` 决定的名词（小写词条，本模块既有）
	["organization", "组织"],
	// 页面底部的文档链接
	["Learn more", "了解更多"],
];

/**
 * 必须保持英文：仓库级那条路径的名词（本模块没有这条键——组织页用 `organization`）
 * 与用户内容。中间那条同时是**路由互斥**的回归：同一个词在别的模块有译文，
 * 不代表这一页有。
 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"repository",
	"Koishi-CE",
];

/** 两页必须逐字同译的串（同款 React 应用、两条互斥路由） */
const SHARED_WITH_REPO_PAGE: readonly string[] = [
	"See how rulesets are affecting this",
	"Enterprise accounts enable you to review commits against rulesets to track pass, fail, or bypass status for greater oversight and understanding.",
	"Try GitHub Enterprise",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

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

describe("组织规则集洞察页的模块路由", () => {
	it("loads the org-settings shell with the global fallback", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match the per-repository module that owns the same strings", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).not.toContain("pages/repo-settings");
		expect(names).not.toContain("pages/settings");
	});

	it("covers the legacy orgs prefix as well", () => {
		expect(moduleNames(LEGACY_PATH)).toContain(
			"pages/org-settings",
		);
	});
});

describe("组织规则集洞察页的实机节点", () => {
	it("translates every node that the real page still showed in English", () => {
		for (const [raw, expected] of NEW_NODES) {
			for (const variant of withWhitespace(raw)) {
				const translated = translateText(variant, view);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("keeps the nodes that were already covered before this batch", () => {
		for (const [raw, expected] of ALREADY_COVERED) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("keeps the repository-level noun and user content in English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
		// 同一句话的名词在仓库级视图里是另一条键——两页各用各的
		expect(translateText("repository", REPO_VIEW)).toBe(
			"仓库",
		);
	});

	it("translates the shared strings exactly like the repository settings page", () => {
		for (const raw of SHARED_WITH_REPO_PAGE) {
			const here = translateText(raw, view);
			expect(
				here,
				`本页未命中：${JSON.stringify(raw)}`,
			).not.toBeNull();
			expect(
				here,
				`两页译文不一致：${JSON.stringify(raw)}`,
			).toBe(translateText(raw, REPO_VIEW));
		}
	});

	it("does not reuse the sidebar wording for the page heading", () => {
		// 侧栏项与页面 H1 是两个串：`Ruleset insights`（规则集洞察）/
		// `Repository ruleset insights`（仓库规则集洞察，单数 ruleset）
		expect(translateText("Ruleset insights", view)).toBe(
			"规则集洞察",
		);
		expect(translateText("Repository rulesets", view)).toBe(
			"仓库规则集",
		);
	});
});

describe("组织规则集洞察页的节点切分事实", () => {
	it("renders the empty-state heading as phrase plus noun", () => {
		// 实机：`<h1>See how rulesets are affecting this 组织</h1>` —— React 把名词
		// （payload 的 `sourceType`）拆成独立节点，空格是前半句节点自带的
		expect(
			renderNodes([
				"See how rulesets are affecting this ",
				"organization",
			]),
		).toBe("查看规则集如何影响此 组织");
	});

	it("renders the whole empty state as heading, blurb, button and link", () => {
		expect(
			renderNodes([
				"Repository ruleset insights",
				"See how rulesets are affecting this ",
				"organization",
				"Enterprise accounts enable you to review commits against rulesets to track pass, fail, or bypass status for greater oversight and understanding.",
				"Try GitHub Enterprise",
				"Learn more",
			]),
		).toBe(
			"仓库规则集洞察查看规则集如何影响此 组织企业账户让你可以对照规则集审查提交，以跟踪通过、失败或绕过状态，从而获得更强的监督与理解。试用 GitHub Enterprise了解更多",
		);
	});
});
