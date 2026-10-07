// 组织成员权限页（/organizations/<组织>/settings/member_privileges）实机文本回归。
//
// 证据与强度：2026-10-07 维护者贴出的**整页实机 HTML**（采集时扩展仍在运行，故页面上
// 已是中文的节点——标题「成员权限」、五个角色名、`公开` / `私有` / `保存` / `关闭` /
// `GitHub 应用`——都是既有键的产物，仍是英文的才是本批清单）。本页同样是服务端渲染的
// 传统 Primer 页面（`Subhead` + `ActionList` + `<dialog>`），长句里没有内联元素时就是
// 一个整文本节点，故说明句按整节点收。
//
// 本文件锁六件事：
//   ① 本页只命中 `pages/org-settings` + `global`，**不命中** `pages/settings` /
//      `pages/settings-billing` / `pages/repo-settings`；旧前缀 `/orgs/...` 同样命中；
//   ② 本批 76 条新键在实机的真实节点上全部命中（含带源码缩进与换行的形态）；
//   ③ 三处被内联元素切开的句子：说明句里的链接各自成节点、仓库删除那句被
//      `<strong>public</strong>` / `<strong>private</strong>` 切成**五个节点**、
//      议题删除那句的链接后面还跟着一个独立的句号节点；
//   ④ 两个动态值走规则：仓库讨论说明句里的组织名（`in Koishi-CE’s repositories`）与
//      基础权限确认对话框正文里的成员数 / 仓库数（整句形态与五段形态都覆盖）；
//   ⑤ 已由既有键覆盖的节点译文逐字不变（本模块的 `Pages` 是「页面」而不是 global 的「页码」）；
//   ⑥ 与页面同形的拼接结果逐字正确（五段句、五段对话框正文）。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织成员权限页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/member_privileges";
/** 旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const LEGACY_PATH =
	"/orgs/Koishi-CE/settings/member_privileges";

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

/** 本轮新补的文本节点（按实机 HTML 的标签嵌套誊录） */
const NEW_NODES: readonly string[] = [
	// —— 基础权限 ——
	"Base permissions",
	"Base permissions to the organization’s repositories apply to all members and excludes outside collaborators. Since organization members can have permissions from multiple sources, members and collaborators who have been granted a higher level of access than the base permissions will retain their higher permission privileges.",
	"No permission",
	"Organization member permissions",
	"Members will only be able to clone and pull public repositories. To give a member additional access, you’ll need to add them to an authorized team or make them a collaborator on individual repositories.",
	"Members will be able to clone and pull all repositories.",
	"Members will be able to clone, pull, and push all repositories.",
	"Members will be able to clone, pull, push, and add new collaborators to all repositories.",
	'Change base permission to "No permission"',
	'Change base permission to "Read"',
	'Change base permission to "Write"',
	'Change base permission to "Admin"',
	"You are about to change the base repository permission for this organization.",
	"This may change the permission that the organization’s",
	"members have on its",
	"repositories.",
	// —— 仓库创建 ——
	"Repository creation",
	"Members will be able to create only selected repository types. Outside collaborators can never create repositories.",
	"Members will be able to create public repositories, visible to anyone.",
	"Members will be able to create private repositories, visible to organization members with permission.",
	"Why is this option disabled?",
	// —— 仓库复刻 ——
	"Repository forking",
	"Allow forking of private repositories",
	"If enabled, forking is allowed on private and public repositories. If disabled, forking is only allowed on public repositories. This setting is also configurable per-repository.",
	// —— 仓库讨论 ——
	"Repository discussions",
	"Allow users with read access to create discussions",
	"If disabled, discussion creation is limited to users with at least triage permission. Users with read access can still comment on discussions.",
	// —— 项目基础权限 ——
	"Projects base permissions",
	"Projects created by members will default to the selected role below.",
	"No access",
	"Members will only be able to see projects that are made public. To give an organization member additional access, they can be added as part of a team or as a collaborator.",
	"Members can see projects.",
	"Members can see and make changes to projects.",
	"Members can see, make changes to, and add new collaborators to projects.",
	'Change base permissions to "No access"',
	'Change base permissions to "Read"',
	'Change base permissions to "Write"',
	'Change base permissions to "Admin"',
	"You are about to change the base projects permission for this organization.",
	"This won't affect any existing projects.",
	// —— Pages 创建 ——
	"Pages creation",
	"Members will be able to publish sites with only the selected access controls.",
	"Members will be able to create public sites, visible to anyone.",
	"Members will be able to create private sites, visible to anyone with permission.",
	// —— 应用访问请求 ——
	"App access requests",
	"Choose who can request GitHub or OAuth apps to use with resources in this organization",
	"Members and outside collaborators",
	"Both members and outside collaborators can request apps for this organization.",
	"Members only",
	"Members can request apps, while outside collaborators cannot.",
	"Disable app access requests",
	"Neither members nor outside collaborators can request apps.",
	// —— GitHub 应用 ——
	"Allow repository admins to install GitHub Apps for their repositories.",
	"Repository admins will be able to install and configure GitHub Apps on their repositories without requesting first, if the app doesn't require organization or repository administration permissions.",
	// —— 管理员仓库权限 ——
	"Admin repository permissions",
	"Repository visibility change",
	"Allow members to change repository visibilities for this organization",
	"If enabled, members with admin permissions for the repository will be able to change its visibility. If disabled, only organization owners can change repository visibilities.",
	"Repository deletion and transfer",
	"Allow members to delete or transfer repositories for this organization",
	"If enabled, members with admin permissions for the repository will be able to delete or transfer",
	"public",
	"and",
	"private",
	"repositories. If disabled, only organization owners can delete or transfer repositories.",
	"Issue deletion",
	"Allow repository administrators to delete issues for this organization",
	"If enabled, members with admin permissions for the repository will be able to delete issues. If disabled, only organization owners can delete issues.",
	"Learn more about allowing people to delete issues in your organization",
	"Branch renames",
	"Allow repository administrators to rename branches protected by organization rules",
	"If enabled, members with admin permissions for the repository will be able to rename branches targeted by organization-level rulesets, provided the new name is still covered by those same rulesets or the repository admin has bypass permission. If disabled, only organization owners can rename such branches.",
	// —— 成员团队权限 ——
	"Member team permissions",
	"Team creation rules",
	"Allow members to create teams",
	"If enabled, any member of the organization will be able to create new teams. If disabled, only organization owners can create new teams.",
];

/** 本页渲染时已由既有键覆盖的节点（本批之前就是中文） */
const ALREADY_COVERED: readonly (readonly [
	string,
	string,
])[] = [
	["Member privileges", "成员权限"],
	// 五个角色名（本模块的既有键，见 org-roles.test.ts）
	["Read", "读取"],
	["Write", "写入"],
	["Admin", "管理员"],
	// 表单标签、按钮与 aria-label 由 global / 本模块的既有键命中
	["Public", "公开"],
	["Private", "私有"],
	["Save", "保存"],
	["Close", "关闭"],
	["GitHub Apps", "GitHub 应用"],
	["Cancel", "取消"],
];

/** 必须保持英文：纯数字节点、纯符号节点与用户内容 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// 对话框正文里的动态计数是独立节点（`2` / `5`）：不含拉丁字母，判定直接跳过
	"2",
	"5",
	// 议题删除说明句末尾那个独立句号节点
	".",
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

describe("组织成员权限页的模块路由", () => {
	it("loads the org-settings shell with the global fallback", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match the personal or per-repository settings modules", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).not.toContain("pages/settings");
		expect(names).not.toContain("pages/settings-billing");
		expect(names).not.toContain("pages/repo-settings");
	});

	it("covers the legacy orgs prefix as well", () => {
		expect(moduleNames(LEGACY_PATH)).toContain(
			"pages/org-settings",
		);
	});
});

describe("组织成员权限页的实机节点", () => {
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

	it("keeps the dynamic numbers, the period node and the org name as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("translates the section headings verbatim", () => {
		expect(translateText("Base permissions", view)).toBe(
			"基础权限",
		);
		expect(
			translateText("Admin repository permissions", view),
		).toBe("管理员仓库权限");
		expect(
			translateText("Member team permissions", view),
		).toBe("成员团队权限");
		// 本模块的 `Pages` 是「页面」，不复用 global 的「页码」
		expect(translateText("Pages creation", view)).toBe(
			"页面创建",
		);
	});

	it("translates the four base-permission dialogs verbatim", () => {
		expect(
			translateText(
				'Change base permission to "No permission"',
				view,
			),
		).toBe("将基础权限更改为“无权限”");
		expect(
			translateText(
				'Change base permission to "Admin"',
				view,
			),
		).toBe("将基础权限更改为“管理员”");
		// 「permission」与「permissions」是两组不同的上游串，不得互相吃掉
		expect(
			translateText(
				'Change base permissions to "Admin"',
				view,
			),
		).toBe("将基础权限更改为“管理员”");
		expect(
			translateText(
				'Change base permissions to "No access"',
				view,
			),
		).toBe("将基础权限更改为“无访问权限”");
	});
});

describe("组织成员权限页的节点切分事实", () => {
	it("requires the deletion note to be split in five nodes", () => {
		// `<strong>public</strong>` 与 `<strong>private</strong>` 把整句切成五段；
		// 整句作为一个节点时任何键都不该命中（反例钉住）
		expect(
			translateText(
				"If enabled, members with admin permissions for the repository will be able to delete or transfer public and private repositories. If disabled, only organization owners can delete or transfer repositories.",
				view,
			),
		).toBeNull();
		expect(translateText("public", view)).toBe("公开");
		expect(translateText("and", view)).toBe("和");
		expect(translateText("private", view)).toBe("私有");
		// 小写 `public` / `private` 只收在「片段」这一个形态上，
		// 大写标签仍由 global 的既有键负责（两条互不干扰）
		expect(translateText("Public", view)).toBe("公开");
		expect(translateText("Private", view)).toBe("私有");
	});

	it("keeps the issue-deletion link and its trailing period apart", () => {
		// 链接文本 + 独立句号节点：句号不含拉丁字母，判定直接跳过
		expect(
			translateText(
				"Learn more about allowing people to delete issues in your organization",
				view,
			),
		).toBe("进一步了解如何允许人们删除你组织中的议题");
		expect(translateText(".", view)).toBeNull();
	});

	it("keeps the two disabled-option links as one shared key", () => {
		// 仓库创建与 Pages 创建两处是同一串上游文案
		expect(
			translateText("Why is this option disabled?", view),
		).toBe("为什么此选项被禁用？");
	});
});

describe("组织成员权限页的动态值规则", () => {
	it("brings the organization name back through the discussions rule", () => {
		expect(
			translateText(
				"If enabled, all users with read access can create and comment on discussions in Koishi-CE’s repositories.",
				view,
			),
		).toBe(
			"如果启用，所有具有读取访问权限的用户都可以在 Koishi-CE 的仓库中创建和评论讨论。",
		);
		// 组织名是动态值：换一个组织同样命中，且名字原样带回
		expect(
			translateText(
				"If enabled, all users with read access can create and comment on discussions in octocat’s repositories.",
				view,
			),
		).toContain("octocat");
		// 锚定：只是以 `repositories.` 结尾的别的句子不该被部分替换成残句
		expect(
			translateText(
				"All users can create and comment on discussions in Koishi-CE’s repositories.",
				view,
			),
		).toBeNull();
	});

	it("covers the whole-sentence form of the base-permission dialog note", () => {
		// 上游若把正文渲染成一个文本节点，整句走规则（成员数 / 仓库数都是动态值）
		expect(
			translateText(
				"This may change the permission that the organization’s 2 members have on its 5 repositories.",
				view,
			),
		).toBe(
			"这可能会改变该组织的 2 名成员在其 5 个仓库上的权限。",
		);
		expect(
			translateText(
				"This may change the permission that the organization’s 12 members have on its 3 repositories.",
				view,
			),
		).toBe(
			"这可能会改变该组织的 12 名成员在其 3 个仓库上的权限。",
		);
		// 千位逗号（成员数上万时上游会渲染成 `1,234`）
		expect(
			translateText(
				"This may change the permission that the organization’s 1,234 members have on its 5 repositories.",
				view,
			),
		).toBe(
			"这可能会改变该组织的 1,234 名成员在其 5 个仓库上的权限。",
		);
		// 锚定：没有计数的形态不该命中（它也不是上游的文案）
		expect(
			translateText(
				"This may change the permission that the organization’s members have on its repositories.",
				view,
			),
		).toBeNull();
	});

	it("covers the split form of the base-permission dialog note", () => {
		// ERB 插值把两个计数拆成独立节点时的五个文本节点：
		// 常量句首 / 数字 / 常量中段 / 数字 / 常量句尾
		expect(
			translateText(
				"This may change the permission that the organization’s",
				view,
			),
		).toBe("这可能会改变该组织的");
		expect(translateText("members have on its", view)).toBe(
			"名成员在其",
		);
		expect(translateText("repositories.", view)).toBe(
			"个仓库上拥有的权限。",
		);
	});
});

describe("组织成员权限页的拼接结果", () => {
	it("renders the deletion note from its five nodes", () => {
		expect(
			renderNodes([
				"If enabled, members with admin permissions for the repository will be able to delete or transfer ",
				"public",
				" and ",
				"private",
				" repositories. If disabled, only organization owners can delete or transfer repositories.",
			]),
		).toBe(
			"如果启用，具有该仓库管理员权限的成员将能够删除或转移 公开 和 私有 仓库。如果禁用，只有组织所有者可以删除或转移仓库。",
		);
	});

	it("renders the dialog note from its five nodes", () => {
		// 数字节点不含拉丁字母、原样留下；三段常量的首尾空白由 walker 保留
		expect(
			renderNodes([
				"This may change the permission that the organization’s\n                  ",
				"2",
				" members have on its\n                  ",
				"5",
				" repositories.\n\n\n                  ",
			]),
		).toBe(
			"这可能会改变该组织的\n                  2 名成员在其\n                  5 个仓库上拥有的权限。\n\n\n                  ",
		);
	});

	it("renders the repository creation block", () => {
		expect(
			renderNodes([
				"\n        ",
				"Members will be able to create only selected repository types. Outside collaborators can never create repositories.",
				"\n      ",
			]),
		).toBe(
			"\n        成员只能创建选定的仓库类型。外部协作者永远不能创建仓库。\n      ",
		);
	});

	it("renders the issue deletion note with its link and period", () => {
		expect(
			renderNodes([
				"If enabled, members with admin permissions for the repository will be able to delete issues. If disabled, only organization owners can delete issues.\n            ",
				"Learn more about allowing people to delete issues in your organization",
				".",
			]),
		).toBe(
			"如果启用，具有该仓库管理员权限的成员将能够删除议题。如果禁用，只有组织所有者可以删除议题。\n            进一步了解如何允许人们删除你组织中的议题.",
		);
	});
});
