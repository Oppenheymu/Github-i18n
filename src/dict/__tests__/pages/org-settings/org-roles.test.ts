// 组织角色管理页（/organizations/<组织>/settings/org_roles）实机文本回归。
//
// 证据与强度：2026-10-07 维护者贴出的**整页实机 HTML**（整段 outerHTML；采集时扩展仍在运行，
// 故已是中文的节点是扩展产物、仍是英文的才是待补清单）。本页渲染成中文的只有五处：
// `Role management`（本模块侧栏键）、`Repository` / `Security` / `Discussions`（global 的
// 通用短键）与 `Write`（global 的「编写」）——其余 129 条全部保留英文，即本批补的清单。
//
// 本文件锁六件事：
//   ① 该路径只命中 `pages/org-settings` + `global`，**不命中** `pages/settings` /
//      `pages/settings-billing` / `pages/repo-settings`（后者的路由显式排除了 organizations）；
//   ② 129 条新键全部按实机节点原文命中（含只在 `<span>` 内部的 `• ` 项目符号）；
//   ③ 四条节点边界事实：说明段是**单节点整段**、项目符号**落在文本节点内部**、
//      tooltip 是独立文本节点、基础角色标签是独立节点；
//   ④ `Write` 在本模块覆盖 global：权限级别语境下是「写入」而非「编写」；
//   ⑤ 装饰性 `aria-label`（`Repository icon`…）与 `CI/CD` 有意不收录；
//   ⑥ 与页面同形的拼接结果（页首说明段、角色行、权限行、基础角色行）逐字正确。
//
// 两条必须记住的边界事实：
//   1. 列表项的项目符号在**文本节点内部**：实机是 `<span>• Assign or remove a user</span>`，
//      裸短语 `Assign or remove a user` 永不命中。这与 pages/insights 的 `Security policy •`
//      （符号在尾部）是同一类坑，只是方向相反；
//   2. 页首说明段的两句话之间**没有任何标签**（只有换行与缩进），所以它是一个整节点，
//      按句拆成两条键会双双永不命中。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const ORG_PATH =
	"/organizations/Koishi-CE/settings/org_roles";
/** 同一页的旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const ORG_LEGACY_PATH =
	"/orgs/Koishi-CE/settings/org_roles";
/** 仓库页：只命中 pages/repo + global，用来对照 global 里的 `Write` */
const REPO_PATH = "/octocat/hello-world";

const locale = dictForLocale("zh-CN");

/** 组织角色页命中的模块视图（pages/org-settings + global） */
const view = buildView(
	ORG_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

/** 仓库页视图：`Write` 在这里只能由 global 提供 */
const repoView = buildView(
	REPO_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 本轮新补的文本节点（逐条誊录实机 HTML，顺序即页面顺序） */
const NEW_NODES: readonly string[] = [
	// —— 页首说明段（单节点整段）——
	"Organization roles are used to grant access to specific organization and repository settings. Repository permissions are granted across every repository in the organization.",
	// —— 九张角色卡片的标题 ——
	"All-repository read",
	"All-repository write",
	"All-repository triage",
	"All-repository maintain",
	"All-repository admin",
	"Apps manager",
	"CI/CD Admin",
	"Security manager",
	"Open-source license manager",
	// —— 九条角色说明句 ——
	"Grants read access to all repositories in the organization.",
	"Grants write access to all repositories in the organization.",
	"Grants triage access to all repositories in the organization.",
	"Grants maintenance access to all repositories in the organization.",
	"Grants admin access to all repositories in the organization.",
	"Grants the ability to manage all GitHub Apps owned by an organization.",
	"Grants admin access to manage Actions policies, runners, runner groups, network configurations, secrets, variables, and usage metrics for an organization.",
	"Grants the ability to manage security policies, security alerts, and security configurations for an organization and all its repositories.",
	"Grants the ability to review open-source license compliance closure requests and update repository license policies.",
	// —— 展开 / 收起按钮上的两个 tooltip（`<tool-tip>` 内的独立文本节点）——
	"Show role permissions",
	"Hide role permissions",
	// —— 角色详情面板的表头 ——
	"Base repository role:",
	"All read permissions plus…",
	// —— 权限清单的分组标题 ——
	"Issue and Pull Request",
	"Issue",
	"Pull Request",
	"Merge Queue",
	"Apps and automation",
	// —— 权限清单：议题与拉取请求 ——
	"• Assign or remove a user",
	"• Add or remove a label",
	"• Create a milestone",
	"• Create a label",
	"• Remove an assigned user",
	"• Remove a label",
	"• Edit a milestone",
	"• Edit a label",
	// —— 权限清单：议题 ——
	"• Close an issue",
	"• Comment on a locked issue",
	"• Edit an issue title and body",
	"• Edit a comment on an issue",
	"• Lock and unlock an issue conversation",
	"• Mark an issue as a duplicate",
	"• Minimize an issue comment",
	"• Reopen a closed issue",
	"• Set an issue type",
	"• Transfer an issue",
	"• Unminimize an issue comment",
	"• Delete an issue",
	// —— 权限清单：拉取请求 ——
	"• Close a pull request",
	"• Reopen a closed pull request",
	"• Request a pull request review",
	// —— 权限清单：合并队列 ——
	"• Request a solo merge",
	"• Jump to the front of the queue",
	// —— 权限清单：仓库 ——
	"• Set milestones",
	"• Create a protected tag",
	"• Delete a protected tag",
	"• Edit repository announcement banners",
	"• Edit repository custom properties values at the repository level",
	"• Edit repository metadata",
	"• Edit repository rules",
	"• Manage deploy keys",
	"• Manage pull request merging settings",
	"• Manage GitHub Page settings",
	"• Manage project settings",
	"• Manage wiki settings",
	"• Manage topics",
	"• Manage webhooks",
	"• Push commits to protected branches",
	"• Bypass branch protections",
	"• Set interaction limits",
	"• Set the social preview",
	// —— 权限清单：安全 ——
	"• View code quality alerts",
	"• View code scanning alerts",
	"• View secret scanning alerts",
	"• View Dependabot alerts",
	"• View security advisories",
	"• Dismiss or reopen Dependabot alerts",
	"• Dismiss or reopen code quality alerts",
	"• Dismiss or reopen code scanning alerts",
	"• Dismiss, reopen, or assign secret scanning alerts",
	"• Delete code scanning analyses",
	"• Publish security advisories",
	"• Create, edit, and manage security advisories",
	"• Triage private vulnerability reports for security advisories",
	"• Bypass code scanning alert dismissal requests",
	"• Bypass Dependabot alert dismissal requests",
	"• Bypass secret scanning alert closure requests",
	"• Review and manage secret scanning bypass requests",
	"• Review and manage secret scanning alert dismissal requests",
	"• Review code scanning alert dismissal requests",
	"• Review Dependabot alert dismissal requests",
	"• View code scanning alert dismissal requests",
	"• View Dependabot alert dismissal requests",
	"• Review license compliance closure requests",
	"• View license compliance closure requests",
	"• View repository license policy",
	// —— 权限清单：讨论区 ——
	"• Close a discussion",
	"• Convert issues to discussions",
	"• Create a discussion category",
	"• Delete a discussion",
	"• Delete a discussion comment",
	"• Edit category on a discussion",
	"• Edit a discussion category",
	"• Edit a discussion comment",
	"• Award and revoke discussion badges",
	"• Reopen a discussion",
	"• Mark or unmark discussion answers",
	"• Hide or unhide discussion comments",
	// —— 权限清单：CI/CD（仓库面板与组织面板两套）——
	"• Manage repository Actions secrets",
	"• Manage repository Actions variables",
	"• Manage repository Actions runners",
	"• Manage repository Actions policies",
	"• Manage repository environments, environment secrets and variables",
	"• View organization Actions usage metrics",
	"• Manage organization Actions secrets",
	"• Manage organization Actions policies",
	"• Manage organization Actions variables",
	"• Edit organization hosted compute network configurations",
	"• Manage organization hosted runner custom images",
	"• Manage organization runners and runner groups",
	// —— 权限清单：应用与自动化 ——
	"• Create organization owned integrations",
	"• Delete organization owned integrations",
	"• Edit organization owned integrations",
	"• View all organization owned integrations",
];

/** 基础角色标签：五个都收（`Write` 由本模块覆盖 global） */
const BASE_ROLE_LABELS: readonly [string, string][] = [
	["Read", "读取"],
	["Write", "写入"],
	["Triage", "分类"],
	["Maintain", "维护"],
	["Admin", "管理员"],
];

/** 本页渲染时已由既有键覆盖的节点（新增本批之前就是中文） */
const ALREADY_COVERED: readonly [string, string][] = [
	["Role management", "角色管理"],
	["Repository", "仓库"],
	["Security", "安全"],
	["Discussions", "讨论区"],
	["Organization", "组织"],
];

/** 必须保持英文：产品缩写、装饰性图标标签与用户内容 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// 纯英文缩写：译文只能与键同形（`validateNoIdentity` 会直接报错），故有意不收录
	"CI/CD",
	// 装饰性 SVG 的 aria-label：屏显不可见，且 `Repository icon` / `Organization icon`
	// 是全站通用的泛化短串（全仓只收过两条产品专属的 `* icon`）
	"Repository icon",
	"Organization icon",
	"all_repo_read icon",
	"All-repository write icon",
	// 组织名（用户内容）
	"Koishi-CE",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/**
 * 把一段实机节点序列按 walker 的语义过一遍：未命中的节点按原样保留，
 * 命中的节点写回译文并保留其首尾空白（**整节点被判空时不留空白**，与
 * walker.applyTextNode 的 erased 语义一致），最后拼接成页面上真实看到的那一行。
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

describe("组织角色管理页的模块路由", () => {
	it("loads the org-settings shell with the global fallback", () => {
		const names = moduleNames(ORG_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match the personal or per-repository settings modules", () => {
		const names = moduleNames(ORG_PATH);
		expect(names).not.toContain("pages/settings");
		expect(names).not.toContain("pages/settings-billing");
		expect(names).not.toContain("pages/repo-settings");
	});

	it("covers the legacy orgs prefix as well", () => {
		expect(moduleNames(ORG_LEGACY_PATH)).toContain(
			"pages/org-settings",
		);
	});
});

describe("组织角色管理页的实机节点边界", () => {
	it("translates every newly registered node", () => {
		for (const node of NEW_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(variant, view);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("keeps the nodes that were already covered before this batch", () => {
		for (const [raw, expected] of ALREADY_COVERED) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("translates the five base role labels", () => {
		for (const [raw, expected] of BASE_ROLE_LABELS) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("keeps the abbreviations and icon labels as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});

describe("组织角色管理页的节点切分事实", () => {
	it("requires the bullet inside the text node", () => {
		// 实机是 `<span>• Assign or remove a user</span>`：符号与文字同属一个文本节点，
		// 裸短语（去掉 `• `）永不命中——把它当成两条键收进来是白费功夫
		expect(
			translateText("• Assign or remove a user", view),
		).toBe("• 指派或移除用户");
		expect(
			translateText("Assign or remove a user", view),
		).toBeNull();
		expect(
			translateText("• Assign or remove a user ", view),
		).toBe("• 指派或移除用户");
	});

	it("treats the intro as one node, not two sentences", () => {
		const whole =
			"Organization roles are used to grant access to specific organization and repository settings. Repository permissions are granted across every repository in the organization.";
		expect(translateText(whole, view)).toBe(
			"组织角色用于授予对特定组织和仓库设置的访问权限。仓库权限会授予组织中的每个仓库。",
		);
		// 两句话之间没有标签，按句拆开的键不存在（也不该存在）
		expect(
			translateText(
				"Organization roles are used to grant access to specific organization and repository settings.",
				view,
			),
		).toBeNull();
		expect(
			translateText(
				"Repository permissions are granted across every repository in the organization.",
				view,
			),
		).toBeNull();
	});

	it("overrides the global wording of the permission-level Write", () => {
		// 本模块收的 `Write` 是权限级别（Label 组件里的基础角色名），按 pages/repo-settings
		// 的既有口径译作「写入」；global 的 `Write` 是编辑动作，译作「编写」
		expect(translateText("Write", view)).toBe("写入");
		expect(translateText("Write", repoView)).toBe("编写");
	});
});

describe("组织角色管理页的拼接结果", () => {
	it("renders a role card with its description", () => {
		expect(
			renderNodes([
				"\n            ",
				"All-repository triage",
				"\n            ",
				"Grants triage access to all repositories in the organization.",
				"\n          ",
			]),
		).toBe(
			"\n            所有仓库分类\n            授予对组织中所有仓库的分类访问权限。\n          ",
		);
	});

	it("renders the intro paragraph with its own indentation", () => {
		expect(
			renderNodes([
				"\n  Organization roles are used to grant access to specific organization and repository settings.\n  Repository permissions are granted across every repository in the organization.\n",
			]),
		).toBe(
			"\n  组织角色用于授予对特定组织和仓库设置的访问权限。仓库权限会授予组织中的每个仓库。\n",
		);
	});

	it("renders a base repository role row", () => {
		expect(
			renderNodes([
				"仓库",
				" ",
				"Base repository role:",
				" ",
				"Admin",
			]),
		).toBe("仓库 基础仓库角色： 管理员");
	});

	it("renders a permission list row", () => {
		expect(
			renderNodes([
				"\n              ",
				"• Dismiss, reopen, or assign secret scanning alerts",
				"\n            ",
			]),
		).toBe(
			"\n              • 忽略、重新打开或指派机密扫描警报\n            ",
		);
	});
});
