// 组织仓库默认设置页（/organizations/<组织>/settings/repository-defaults）实机文本回归。
//
// 证据与强度：2026-10-09 维护者贴出的**整页实机 HTML**（采集时扩展仍在运行，故页面上
// 已是中文的节点——`所有仓库` / `标签` / `描述` / `编辑` / `删除` / `取消` / `加载中`
// ——都是既有键的产物，用作「扩展确实在这一页生效」的对照物；仍是英文的才是本批清单）。
// 本页是**服务端渲染的传统 Primer 页面**（`Subhead` + `Box` + Rails 的
// `<details><summary>` select-menu），另有 React 的 `action-menu` / `action-list` 组件。
//
// 本文件锁七件事：
//   ① 本页只命中 `pages/org-settings` + `global`，**不命中** `pages/settings` /
//      `pages/settings-billing` / `pages/repo-settings`；旧前缀 `/orgs/...` 同样命中；
//   ② 本批 44 条新键在实机的真实节点上全部命中（含带源码缩进与换行的形态），
//      其中 `Default branch name` / `Updating…` / `Saving...` 只出现在属性上；
//   ③ 前两个区块（Repository default branch / Commit comments）与**个人设置页
//      /settings/repositories** 的成串几乎逐字相同，而那条路由不命中 /organizations/**，
//      故本模块各收一份并**逐字同译**——用例对同串节点断言两份视图的译文逐字相等；
//      组织侧独有的两处措辞与后三个区块（Commit signoff / Releases / Repository labels）
//      是新键而不是别名（个人页的变体在本页必须不命中）；
//   ④ 说明段的节点切分：默认分支段被链接切成两段；Commit signoff 段被两个链接切成五段
//      （其中 `. ` 与收尾的 `.` 两个节点翻不了）；Commit comments 段被链接切成三段；
//   ⑤ 输入框下方的剩余字数是动态值（`data-suffix="remaining"` 拼出的 `50 remaining`），
//      走新规则 `org-settings/remaining-count`，与屏蔽用户页那条带句点的
//      `characters remaining.` 是不同的形态（两条 pattern 互不覆盖）；
//   ⑥ 列表标题的计数行是「数字」与 `labels` 两个节点（数字节点被引擎跳过），
//      单数形态 `label` 也收（上游按 `data-singular-string` 换词）；
//   ⑦ 有意不收录：16 个色板按钮的 `Color #<hex>`（属性 + 数据值 + 屏显不可见）、
//      `data-confirm` 等 `data-*`、输入框 value 与标签行里的用户内容。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织仓库默认设置页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/repository-defaults";
/** 旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const LEGACY_PATH =
	"/orgs/Koishi-CE/settings/repository-defaults";

const locale = dictForLocale("zh-CN");

/** 本页命中的模块视图（pages/org-settings + global） */
const view = buildView(
	PAGE_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

/** 个人设置页那条路由的视图（用于断言两页同译；它**不**命中本页路径） */
const PERSONAL_VIEW = buildView(
	"/settings/repositories",
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 本批新补的文本节点（按实机 HTML 的标签嵌套誊录） */
const NEW_NODES: readonly string[] = [
	// —— Repository default branch ——
	"Repository default branch",
	"Choose the default branch for new repositories in this organization. You might want to change the default name due to different workflows, or because your integrations still require “master” as the default branch name. You can always change the default branch name on individual repositories.",
	"Learn more about default branches.",
	"Update",
	// —— Commit signoff（组织侧独有）——
	"Commit signoff",
	"Choose whether repositories will require contributors to sign off on commits they make through GitHub's web interface. Signing off is a way for contributors to affirm that their commit complies with the repository's terms, commonly the",
	"Developer Certificate of Origin (DCO)",
	"Learn more about signing off on commits",
	"Require signoff on web-based commits for all repositories in this organization",
	"No policy",
	"Each repository chooses whether to require signoff on web-based commits",
	// —— Commit comments ——
	"Commit comments",
	"Choose whether",
	"commit comments",
	"are enabled or disabled by default for repositories in this organization. Individual repositories can override this default. Existing commit comments are not affected by this setting and will remain viewable, editable, and deletable.",
	"Commit comments:",
	"Enabled by default",
	"Disabled by default",
	// —— Releases（组织侧独有）——
	"Releases",
	"Choose whether repositories will publish immutable releases. Immutable releases improve security by disallowing changes to assets and tags after the release is published.",
	"Require immutable releases for all repositories",
	"Selected repositories",
	"Require immutable releases for specifically selected repositories",
	"Each repository chooses whether to make releases immutable",
	// —— Repository labels ——
	"Repository labels",
	"Set the labels that will be included when a new repository is created in this organization.",
	"Learn more about managing default labels for your organization.",
	"New label",
	"Label preview",
	"Label name",
	"Description (optional)",
	"Color",
	"Get a new color",
	"Hex colors should only contain numbers and letters from a-f",
	"Choose from default colors:",
	"Create label",
	"Save changes",
	"No labels!",
	'There aren’t any labels for this organization quite yet. Click on the "New Label" button above to create one.',
	"labels",
	"label",
];

/** 只出现在属性上的键（属性只走精确命中） */
const ATTRS: readonly string[] = [
	// 默认分支名输入框
	"Default branch name",
	// 提交按钮的 `data-disable-with`
	"Updating…",
	// 新建 / 编辑标签表单的 placeholder
	"Label name",
	"Description (optional)",
	// 保存按钮的 `data-disable-with`
	"Saving...",
];

/** 页面上已是中文的节点（global 的既有键，用作「扩展确实在这一页生效」的对照物） */
const ALREADY_COVERED: readonly (readonly [
	string,
	string,
])[] = [
	["All repositories", "所有仓库"],
	["Labels", "标签"],
	["Description", "描述"],
	["Edit", "编辑"],
	["Delete", "删除"],
	["Cancel", "取消"],
	["Loading", "加载中"],
];

/**
 * 必须保持英文：有意不收录的串、个人页 / 仓库级页面的变体，以及用户内容。
 * 中间那两条同时是**路由互斥**的回归——同一个词在别的模块有译文，不代表这一页有。
 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// 文本输入框里的默认分支名（用户内容）
	"main",
	// 色板按钮的 aria-label：属性不适用规则，且是带数据值的屏显不可见标签（有意不收录）
	"Color #b60205",
	"Color #f9d0c4",
	// `data-confirm` 的内容（`data-*` 不在引擎翻译的六个属性里）
	"Are you sure? Deleting a label will remove as a default, and no future repositories will receive this label when created.",
	// 标签行里的标签名（用户内容；描述本身已是中文，不是本扩展写的）
	"Area: Bun",
	"Type: Bug",
	// 个人设置页 /settings/repositories 的措辞（本页各收了组织侧的新键）
	"Choose the default branch for your new personal repositories. You might want to change the default name due to different workflows, or because your integrations still require “master” as the default branch name. You can always change the default branch name on individual repositories.",
	"are enabled or disabled by default for repositories you own. Individual repositories can override this default. Existing commit comments are not affected by this setting and will remain viewable, editable, and deletable.",
	// 仓库级子页（pages/repo-settings）的提交签署措辞
	"Enabling this setting will require contributors to sign off on commits made through GitHub’s web interface. Signing off is a way for contributors to affirm that their commit complies with the repository's terms, commonly the Developer Certificate of Origin (DCO).",
	"Require contributors to sign off on web-based commits",
];

/** 与个人设置页**同串**的节点：本模块各收一份并逐字同译 */
const SHARED_WITH_PERSONAL: readonly string[] = [
	"Repository default branch",
	"Learn more about default branches.",
	"Update",
	"Commit comments",
	"Choose whether",
	"commit comments",
	"Commit comments:",
	"Enabled by default",
	"Disabled by default",
	"Selected repositories",
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

describe("组织仓库默认设置页的模块路由", () => {
	it("loads the org-settings shell with the global fallback", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match the personal, billing or per-repository modules", () => {
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

describe("组织仓库默认设置页的实机节点", () => {
	it("translates every newly registered node", () => {
		for (const node of [...NEW_NODES, ...ATTRS]) {
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

	it("keeps the strings that must stay English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("translates the shared strings exactly like the personal settings page", () => {
		for (const raw of SHARED_WITH_PERSONAL) {
			const here = translateText(raw, view);
			expect(
				here,
				`本页未命中：${JSON.stringify(raw)}`,
			).not.toBeNull();
			expect(
				here,
				`两页译文不一致：${JSON.stringify(raw)}`,
			).toBe(translateText(raw, PERSONAL_VIEW));
		}
	});

	it("gives the organization wording its own keys", () => {
		expect(
			translateText(
				"Choose the default branch for new repositories in this organization. You might want to change the default name due to different workflows, or because your integrations still require “master” as the default branch name. You can always change the default branch name on individual repositories.",
				view,
			),
		).toBe(
			"为此组织中的新仓库选择默认分支。由于不同的工作流，或因为你的集成仍需要将 “master” 作为默认分支名，你可能想更改默认名称。你随时可以在单个仓库上更改默认分支名。",
		);
		// 个人页那条 `repositories you own` 在本页必须不命中
		expect(
			translateText(
				"are enabled or disabled by default for repositories you own. Individual repositories can override this default. Existing commit comments are not affected by this setting and will remain viewable, editable, and deletable.",
				view,
			),
		).toBeNull();
		expect(
			translateText(
				"are enabled or disabled by default for repositories in this organization. Individual repositories can override this default. Existing commit comments are not affected by this setting and will remain viewable, editable, and deletable.",
				view,
			),
		).toBe(
			"在此组织的仓库中默认启用或禁用。各个仓库可以覆盖此默认设置。现有的提交评论不受此设置影响，仍可查看、编辑和删除。",
		);
	});

	it("translates the three organization-only sections", () => {
		expect(translateText("Commit signoff", view)).toBe(
			"提交签署",
		);
		expect(translateText("No policy", view)).toBe("无策略");
		expect(translateText("Releases", view)).toBe("发布");
		expect(
			translateText(
				"Require immutable releases for all repositories",
				view,
			),
		).toBe("要求所有仓库使用不可变发布");
		expect(
			translateText(
				"Each repository chooses whether to make releases immutable",
				view,
			),
		).toBe("由各个仓库自行决定是否使发布不可变");
		expect(translateText("Repository labels", view)).toBe(
			"仓库标签",
		);
		expect(translateText("New label", view)).toBe(
			"新建标签",
		);
		expect(translateText("Label name", view)).toBe(
			"标签名称",
		);
		expect(translateText("Create label", view)).toBe(
			"创建标签",
		);
		expect(translateText("Save changes", view)).toBe(
			"保存更改",
		);
	});
});

describe("组织仓库默认设置页的节点切分事实", () => {
	it("reassembles the default-branch blurb across its link", () => {
		// 实机：`… on individual repositories. <a>Learn more about default branches.</a>`
		// ——句号属于链接文本（与个人页同形）
		expect(
			renderNodes([
				"Choose the default branch for new repositories in this organization. You might want to change the default name due to different workflows, or because your integrations still require “master” as the default branch name. You can always change the default branch name on individual repositories.",
				" ",
				"Learn more about default branches.",
			]),
		).toBe(
			"为此组织中的新仓库选择默认分支。由于不同的工作流，或因为你的集成仍需要将 “master” 作为默认分支名，你可能想更改默认名称。你随时可以在单个仓库上更改默认分支名。 详细了解默认分支。",
		);
	});

	it("reassembles the commit-signoff blurb across its two links", () => {
		// 实机五段：前段 + 证书链接 + `. `（纯符号，翻不了）+ 说明链接 + `.`
		// ——链接近旁是仓库级设置页的同义句，两处措辞保持一致；两个纯句点节点
		// 都不含拉丁字母、引擎直接跳过，故中文后面仍跟着半角句点
		expect(
			renderNodes([
				"Choose whether repositories will require contributors to sign off on commits they make through GitHub's web interface. Signing off is a way for contributors to affirm that their commit complies with the repository's terms, commonly the",
				" ",
				"Developer Certificate of Origin (DCO)",
				". ",
				"Learn more about signing off on commits",
				".",
			]),
		).toBe(
			"选择仓库是否要求贡献者对他们通过 GitHub 网页界面所做的提交进行签署。签署是贡献者确认其提交符合仓库条款的一种方式，通常为 开发者原创证书（DCO）. 进一步了解提交签署.",
		);
	});

	it("reassembles the commit-comments blurb across its link", () => {
		// 实机：`Choose whether <a>commit comments</a> are enabled or disabled by default for …`
		expect(
			renderNodes([
				"Choose whether",
				" ",
				"commit comments",
				" ",
				"are enabled or disabled by default for repositories in this organization. Individual repositories can override this default. Existing commit comments are not affected by this setting and will remain viewable, editable, and deletable.",
			]),
		).toBe(
			"选择是否 提交评论 在此组织的仓库中默认启用或禁用。各个仓库可以覆盖此默认设置。现有的提交评论不受此设置影响，仍可查看、编辑和删除。",
		);
	});

	it("renders the two select menus as label plus current value", () => {
		// Commit comments 的按钮：静音标签（含冒号）+ 当前值两个节点
		expect(
			renderNodes([
				"Commit comments:",
				" ",
				"Enabled by default",
			]),
		).toBe("提交评论： 默认启用");
		expect(
			renderNodes([
				"Commit comments:",
				" ",
				"Disabled by default",
			]),
		).toBe("提交评论： 默认禁用");
		// Commit signoff 与 Releases 两个下拉没有可见标签，按钮文本就是当前值
		//（`所有仓库` 由 global 的 `All repositories` 覆盖）
		expect(renderNodes(["所有仓库"])).toBe("所有仓库");
		expect(renderNodes(["Selected repositories"])).toBe(
			"已选仓库",
		);
	});

	it("renders a label menu item as label plus description", () => {
		expect(
			renderNodes([
				"Require signoff on web-based commits for all repositories in this organization",
				"Each repository chooses whether to require signoff on web-based commits",
			]),
		).toBe(
			"要求此组织中的所有仓库对网页端提交进行签署由各个仓库自行决定是否要求对网页端提交进行签署",
		);
	});

	it("counts the labels through the rule and the two count forms", () => {
		// 实机：`<span class="js-labels-count">15</span>` 与
		// `<span class="js-labels-label" data-singular-string="label" …>labels</span>`
		// 是两个节点，浏览器把两节点之间的换行折叠成一个空格，读作「15 个标签」
		expect(
			renderNodes([
				"\n              ",
				"15",
				"\n              ",
				"labels",
				"\n            ",
			]),
		).toBe(
			"\n              15\n              个标签\n            ",
		);
		// 计数为 1 时上游按 `data-singular-string` 换成单数形态
		expect(renderNodes(["1", " ", "label"])).toBe(
			"1 个标签",
		);
		// 标签表单下方的剩余字数（数字动态）：正则锚定、不带句点
		expect(translateText("50 remaining", view)).toBe(
			"剩余 50 个字符",
		);
		expect(translateText("1 remaining", view)).toBe(
			"剩余 1 个字符",
		);
		// 与屏蔽用户页那条带句点的 `characters remaining.`、以及 global 那条
		// `characters remaining`（状态编辑对话框）划清边界：三条 pattern 互不覆盖
		expect(translateText("50 remaining.", view)).toBeNull();
		expect(
			translateText("50 characters remaining", view),
		).toBe("还可输入 50 个字符");
	});

	it("renders the labels blankslate", () => {
		expect(
			renderNodes([
				"No labels!",
				'There aren’t any labels for this organization quite yet. Click on the "New Label" button above to create one.',
			]),
		).toBe(
			"没有标签！此组织还没有任何标签。点击上方的「新建标签」按钮即可创建一个。",
		);
	});
});
