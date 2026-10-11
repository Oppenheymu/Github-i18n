// 组织代码空间设置页（/organizations/<组织>/settings/codespaces）实机回归。
//
// 证据：2026-10-11 维护者贴的整段实机 HTML（从 `Layout-main` 起，采集时扩展仍在运行）。
// 本页是**两套应用**拼起来的：SSR 表单（Rails，`organization[...]` 命名，`<form>` 直出）
// 加一个独立的 `<react-partial partial-name="codespaces-organization-ownership-setting">`
//（`data-ssr="true"`，payload 里带 `submitUrl` / `currentValue`），所以「代码空间访问」
// 与「代码空间所有权」两块文案要一起收。页面上自带对照物：h2 的 `Codespaces` 已由 global
// 译成「代码空间」、SSR 表单与 react-partial 各有一个 `Save` 按钮且都已是「保存」——
// 说明扩展在本页生效，其余英文才是本批清单。
//
// 本文件锁四件事：
//   ① 路由：命中 pages/org-settings + global，不命中 pages/repo-settings / pages/settings；
//   ② 23 条键（flash 三段 + 正文两句 + 条款三段 + 单选组五条 + 按钮可访问名 +
//      所有权区块六条）在实机节点上全部命中；
//   ③ 节点切分事实：flash 与条款句都被 `<a>` 切成三个文本节点，所有权区块的标签里又内嵌
//      `<p class="note">`（标签名与注解各成一个文本节点）——两处都按 walker 语义拼成整行钉住；
//   ④ 反例：radio 的 `value`（`disabled` / `selected_users` / `all_users` /
//      `all_users_and_outside_collaborators`）与 React 的生成 id、payload 里的 `user`
//      都是表单值 / 标识符，必须保持英文；同一句话的**另一种撇号**形态不收录
//      （实机逐字抄：SSR 段直角撇号、React 段弯撇号，抄错一个字符该节点就永不命中）。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织代码空间设置页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/codespaces";
/** 旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const LEGACY_PATH = "/orgs/Koishi-CE/settings/codespaces";

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
	// 顶部 flash：整句被 `<a>` 切成三段
	[
		"To manage Codespace ownership settings, please",
		"要管理代码空间所有权设置，请",
	],
	["upgrade your plan", "升级你的方案"],
	["to enable your organization.", "以启用你的组织。"],
	// 「代码空间访问」区块
	["Codespaces access", "代码空间访问"],
	[
		"Manage access to GitHub Codespaces for your organization's members on private and internal repositories. Codespaces are always available on public repositories.",
		"管理组织成员在私有和内部仓库上访问 GitHub 代码空间的权限。代码空间在公共仓库上始终可用。",
	],
	// 条款句：同样被 `<a>` 切成三段
	[
		"By enabling Codespaces, you agree to GitHub’s",
		"启用代码空间即表示你同意 GitHub 的",
	],
	[
		"additional products and features terms",
		"附加产品与功能条款",
	],
	[
		"and approve of these terms on behalf of your organization.",
		"并代表你的组织认可这些条款。",
	],
	// 单选组的四个可见标签 + 四条注解
	["Disabled", "禁用"],
	[
		"Disable GitHub Codespaces for all organization owned private and internal repositories",
		"对所有组织拥有的私有和内部仓库禁用 GitHub 代码空间",
	],
	[
		"Enable for specific members or teams",
		"为特定成员或团队启用",
	],
	[
		"Enable GitHub Codespaces for specific organization members or teams on all organization owned private and internal repositories",
		"为特定组织成员或团队在所有组织拥有的私有和内部仓库上启用 GitHub 代码空间",
	],
	["Enable for all members", "为所有成员启用"],
	[
		"Enable GitHub Codespaces for all organization members on all organization owned private and internal repositories",
		"为所有组织成员在所有组织拥有的私有和内部仓库上启用 GitHub 代码空间",
	],
	[
		"Enable for all members and outside collaborators",
		"为所有成员和外部协作者启用",
	],
	[
		"Enable GitHub Codespaces for all organization members and outside collaborators on all organization owned private and internal repositories",
		"为所有组织成员和外部协作者在所有组织拥有的私有和内部仓库上启用 GitHub 代码空间",
	],
	// 保存按钮的可访问名（按钮的可见文案 `Save` 早已由 global 译出）
	["Save user access settings", "保存用户访问设置"],
	// react-partial：代码空间所有权
	["Codespace ownership", "代码空间所有权"],
	[
		"Control who owns codespaces created by your organization’s members on organization owned repositories. Codespace ownership dictates who is billed for usage, whose policies apply, and where audit logs are sent.",
		"控制组织成员在组织拥有的仓库上创建的代码空间归谁所有。代码空间所有权决定由谁支付用量费用、适用哪些策略，以及审计日志发送到哪里。",
	],
	["Organization ownership", "组织所有权"],
	[
		"All codespaces created by your organization’s members on your organization’s repositories are owned by the organization",
		"组织成员在你的组织仓库上创建的所有代码空间都归组织所有",
	],
	["User ownership", "用户所有权"],
	[
		"All codespaces created by your organization’s members on your organization’s repositories are owned by the creating member",
		"组织成员在你的组织仓库上创建的所有代码空间都归创建它的成员所有",
	],
];

/** 本批之前就已生效的对照物（证明扩展在本页运行） */
const ALREADY_COVERED: readonly (readonly [
	string,
	string,
])[] = [
	["Codespaces", "代码空间"],
	["Save", "保存"],
];

/** 表单值 / 标识符 / 产品名 / 用户内容，必须保持英文 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"disabled",
	"selected_users",
	"all_users",
	"all_users_and_outside_collaborators",
	"codespaces-ownership-setting",
	"_r_1m_",
	"user",
	"currentValue",
	"submitUrl",
	"GitHub",
	"Koishi-CE",
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

describe("组织代码空间设置页的模块路由", () => {
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

	it("covers the legacy prefix", () => {
		expect(moduleNames(LEGACY_PATH)).toContain(
			"pages/org-settings",
		);
	});
});

describe("组织代码空间设置页的实机节点", () => {
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

	it("keeps the nodes that were already covered before this batch", () => {
		for (const [raw, expected] of ALREADY_COVERED) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("keeps form values, identifiers and user content in English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("does not fold the two apostrophe forms of the same sentence together", () => {
		// 实机 React 段用的是弯撇号（U+2019）。词典是整串精确匹配，所以同一句话
		// 写成直角撇号**不该**命中——本仓两种形态都真实存在（canonical 里各 7 处），
		// 只能按实机逐字抄。这条是「逐字抄」的哨兵：真机上若换成直角撇号，
		// NEW_NODES 那条会红，而不是悄悄漏翻。
		const curly = NEW_NODES.find(([raw]) =>
			raw.startsWith("Control who owns codespaces"),
		);
		expect(curly).toBeDefined();
		const straight = (curly?.[0] ?? "").replaceAll(
			"\u2019",
			"'",
		);
		expect(straight).not.toBe(curly?.[0]);
		expect(translateText(straight, view)).toBeNull();
	});
});

describe("组织代码空间设置页的节点切分事实", () => {
	it("renders the flash message split by its link", () => {
		// 实机：`<div class="flash">\n  To manage … please <a>upgrade your plan</a>
		// to enable …</div>`——三段各自成键，walker 保留每段的首尾空白，
		// 故中文里链接两侧原样留着空格
		expect(
			renderNodes([
				"\n  To manage Codespace ownership settings, please ",
				"upgrade your plan",
				" to enable your organization.\n",
			]),
		).toBe(
			"\n  要管理代码空间所有权设置，请 升级你的方案 以启用你的组织。\n",
		);
	});

	it("renders the terms sentence split by its link", () => {
		expect(
			renderNodes([
				"By enabling Codespaces, you agree to GitHub’s ",
				"additional products and features terms",
				" and approve of these terms on behalf of your organization.",
			]),
		).toBe(
			"启用代码空间即表示你同意 GitHub 的 附加产品与功能条款 并代表你的组织认可这些条款。",
		);
	});

	it("renders the label column of the radio group", () => {
		expect(
			renderNodes([
				"Disabled",
				"Enable for specific members or teams",
				"Enable for all members",
				"Enable for all members and outside collaborators",
			]),
		).toBe(
			"禁用为特定成员或团队启用为所有成员启用为所有成员和外部协作者启用",
		);
	});

	it("renders the ownership block where each label wraps a note", () => {
		// 实机是 `<label>Organization ownership<p class="note">All codespaces …</p></label>`：
		// DOM 上标签名与注解是两个文本节点，各查各的键
		expect(
			renderNodes([
				"Codespace ownership",
				"Control who owns codespaces created by your organization’s members on organization owned repositories. Codespace ownership dictates who is billed for usage, whose policies apply, and where audit logs are sent.",
				"Organization ownership",
				"All codespaces created by your organization’s members on your organization’s repositories are owned by the organization",
				"User ownership",
				"All codespaces created by your organization’s members on your organization’s repositories are owned by the creating member",
			]),
		).toBe(
			"代码空间所有权控制组织成员在组织拥有的仓库上创建的代码空间归谁所有。代码空间所有权决定由谁支付用量费用、适用哪些策略，以及审计日志发送到哪里。组织所有权组织成员在你的组织仓库上创建的所有代码空间都归组织所有用户所有权组织成员在你的组织仓库上创建的所有代码空间都归创建它的成员所有",
		);
	});

	it("renders the two save buttons and the already-translated heading", () => {
		// 对照物：h2 由 global 的 `Codespaces` 译出，两个按钮（SSR 表单 / react-partial）
		// 都命中 global 的 `Save`——这也是「walker 会走进 react-partial 的 light DOM」
		// 的直接证据（第二个按钮在 `react-partial.reactRoot` 里，实机已是「保存」）
		expect(
			renderNodes(["Codespaces", "保存", "Save"]),
		).toBe("代码空间保存保存");
	});
});
