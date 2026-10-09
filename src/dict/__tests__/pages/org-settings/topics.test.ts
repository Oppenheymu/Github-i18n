// 组织主题页（/orgs/<组织>/topics）实机回归。
//
// 证据与强度：2026-10-09 维护者贴的**整页截图**（扩展仍在运行）。这一页本身文案很少
// （页头标题 + 四行仓库 + 话题标签），它的价值在于**暴露了一条路由缺口**：
// 路径不在 `/settings/` 前缀下，此前没有任何模块覆盖它，只有 global 兜底 ⇒ 页头的
// 上下文切换器与**整个组织设置侧栏**保留英文，而 global 的既有键是中文
//（`主题` / `代码空间` / `讨论区` / `页码` / `预览` / `公开` / `公开归档`）
// ——这正是维护者报的「点开此页面翻译会退化」。
// 本批把 `/orgs/<组织>/topics` 并进 pages/org-settings 的**第四支路由**
//（前一支是同样在组织根上的 `billing_managers`），侧栏与外壳随即逐项恢复中文；
// **尚待维护者重载 dist/ 后实机复测**。
//
// 本文件锁五件事：
//   ① 路由：两个前缀都命中 pages/org-settings + global，且不命中 repo-settings /
//      settings / settings-billing / repo / profile；公共话题页 `/topics` 不受影响，
//      组织下的其它非设置页（repositories / people / teams）也不会被注入设置外壳；
//   ② 截图里仍是英文的侧栏项与页头，在本路由下逐项有中文译文（含 global 提供的
//      `Repository` / `Topics` / `Codespaces` / `Discussions` / `Preview`，以及
//      org-settings 对 global 的定点纠正 `Pages`：截图里是 global 的「页码」，
//      本页应为「页面」）；
//   ③ 页头标题 `Koishi-CE repositories you contribute to` 的**两种可能切分**都覆盖：
//      词条兜「组织名是独立节点、只剩半句」的碎片形态，规则
//      `org-settings/topics-heading` 兜「整句渲染成一个文本节点」的形态；
//   ④ 话题标签与仓库名（用户内容）必须保持英文；
//   ⑤ 规则整串锚定：同页仓库描述里的近似句子不会被误伤（反例断言钉住）。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织主题页（新前缀） */
const PAGE_PATH = "/orgs/Koishi-CE/topics";
/** 旧前缀（`/organizations/<组织>/...`），路由里也覆盖着 */
const LEGACY_PATH = "/organizations/Koishi-CE/topics";

const locale = dictForLocale("zh-CN");

/** 本页命中的模块视图（pages/org-settings + global） */
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

/**
 * 截图里仍是英文的侧栏项与页头（译文逐条钉死；这些键多数是 2026-10-03 那次
 * `Layout-sidebar` 采集补的，此前在本页完全不生效）。
 */
const SIDEBAR_AND_SHELL: readonly (readonly [
	string,
	string,
])[] = [
	// 顶部的个人资料项与折叠分组
	["General", "常规"],
	["Policies", "策略"],
	// Access 分组
	["Access", "访问权限"],
	["Billing and licensing", "账单与许可"],
	["Organization roles", "组织角色"],
	["Repository roles", "仓库角色"],
	["Member privileges", "成员权限"],
	["Import/Export", "导入/导出"],
	["Moderation", "审核"],
	// Code, planning, and automation 分组（截图里 `仓库` 已展开）
	["Code, planning, and automation", "代码、规划与自动化"],
	["Rulesets", "规则集"],
	["Ruleset insights", "规则集洞察"],
	["Ruleset dashboard", "规则集仪表板"],
	["Custom properties", "自定义属性"],
	["Sandboxes", "沙盒"],
	["Planning", "规划"],
	["Actions", "Actions 工作流"],
	["Webhooks", "网络钩子"],
	["Packages", "软件包"],
	// 页头的上下文切换器与组织副标题
	["Organization", "组织"],
];

/** 本页由 global 提供的既有键（截图里就已是中文的那几项） */
const FROM_GLOBAL: readonly (readonly [string, string])[] =
	[
		["Repository", "仓库"],
		["Topics", "主题"],
		["Codespaces", "代码空间"],
		["Discussions", "讨论区"],
		["Preview", "预览"],
		["Public", "公开"],
		["Public archive", "公开归档"],
	];

/** 必须保持英文：产品名与用户内容（话题标签、仓库名） */
const MUST_STAY_ENGLISH: readonly string[] = [
	// 产品名（有意不收录）
	"Copilot",
	// 话题标签（用户内容，`koishi` 仓库上的真实话题）
	"bot",
	"framework",
	"sdk",
	"telegram",
	"discord",
	"matrix",
	"chatbot",
	"lark",
	"onebot",
	"koishi",
	"plugin",
	"services",
	"koishi-plugin",
	"puppeteer",
	"tools",
	"feishu",
	"koishijs",
	"koishi-ce",
	// 仓库名（用户内容）
	".github",
	"koishi-plugin-market-tracker",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n          ${node}\n        `];
}

describe("组织主题页的模块路由", () => {
	it("loads the org-settings shell with the global fallback", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match the personal, billing or per-repository modules", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).not.toContain("pages/repo-settings");
		expect(names).not.toContain("pages/settings");
		expect(names).not.toContain("pages/settings-billing");
		expect(names).not.toContain("pages/repo");
		expect(names).not.toContain("pages/profile");
	});

	it("covers the legacy organizations prefix as well", () => {
		expect(moduleNames(LEGACY_PATH)).toContain(
			"pages/org-settings",
		);
	});

	it("keeps the public topics page on its own module", () => {
		// `/topics`（GitHub 的公共话题页）与 `/orgs/<组织>/topics` 无关，
		// 新支路由不得把它拉进组织设置模块
		expect(moduleNames("/topics")).toEqual([
			"pages/search",
			"global",
		]);
	});

	it("does not leak the settings shell into other org pages", () => {
		// `topics` 是第四支里唯一的短路径；同级的组织页（仓库列表 / 成员 / 团队）
		// 是**公开页**，注入设置外壳会整页误译
		for (const path of [
			"/orgs/Koishi-CE/repositories",
			"/orgs/Koishi-CE/people",
			"/orgs/Koishi-CE/teams",
		]) {
			expect(
				moduleNames(path),
				`不应命中：${path}`,
			).not.toContain("pages/org-settings");
		}
	});
});

describe("组织主题页的侧栏与页头", () => {
	it("translates every item that the screenshot still showed in English", () => {
		for (const [raw, expected] of SIDEBAR_AND_SHELL) {
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

	it("translates the shell items global already provides", () => {
		for (const [raw, expected] of FROM_GLOBAL) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("overrides the global wording of GitHub Pages on this page too", () => {
		// 截图里 `页码` 正是 global 的译法——它就是「本页此前只吃 global 兜底」的铁证；
		// 补上路由后本模块把它纠正为「页面」（与仓库设置、wiki 一致）
		expect(translateText("Pages", view)).toBe("页面");
	});

	it("translates the three nodes of the settings-context switcher", () => {
		// 实机是 `Switch <span>settings </span>context` 三个节点（2026-10-03 采集）：
		// 截图里整串英文同样只是「模块没命中」；节点之间的空白由上游决定，故逐个断言
		expect(translateText("Switch", view)).toBe("切换");
		expect(translateText("settings", view)).toBe("设置");
		expect(translateText("context", view)).toBe("上下文");
	});
});

describe("组织主题页的页头标题", () => {
	it("translates the whole-node form through the rule", () => {
		// 组织名是动态值（截图里是 Koishi-CE）：整句一个文本节点时只有规则接得住
		expect(
			translateText(
				"Koishi-CE repositories you contribute to",
				view,
			),
		).toBe("你在 Koishi-CE 中贡献的仓库");
		// 登录名允许数字与连字符
		expect(
			translateText(
				"cli-2 repositories you contribute to",
				view,
			),
		).toBe("你在 cli-2 中贡献的仓库");
	});

	it("translates the tail fragment when the owner is its own node", () => {
		for (const variant of withWhitespace(
			"repositories you contribute to",
		)) {
			expect(translateText(variant, view)).toBe(
				"你贡献的仓库",
			);
		}
		// 组织名是用户内容：引擎不认得它，原样保留（两段拼起来读作「Koishi-CE 你贡献的仓库」）
		expect(translateText("Koishi-CE", view)).toBeNull();
	});

	it("anchors the rule so neighbouring sentences stay English", () => {
		// 同页的仓库描述是用户内容，规则必须整串命中才算——带前缀 / 后缀的句子一律不动
		expect(
			translateText(
				"A list of repositories you contribute to",
				view,
			),
		).toBeNull();
		expect(
			translateText(
				"Framework for repositories you contribute to",
				view,
			),
		).toBeNull();
		expect(
			translateText(
				"repositories you contribute to in this organization",
				view,
			),
		).toBeNull();
		// 组织名带斜杠（`owner/repo` 形态）不是登录名，不匹配
		expect(
			translateText(
				"Koishi-CE/repositories you contribute to",
				view,
			),
		).toBeNull();
	});
});

describe("组织主题页的用户内容", () => {
	it("keeps product names, topic tags and repository names as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});
