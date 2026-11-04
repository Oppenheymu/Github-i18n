// 组织 GitHub Apps 管理页（/organizations/<组织>/settings/apps）实机回归。
//
// 证据与强度：2026-11-04 维护者贴的**整页截图**（扩展仍在运行）+ 两段说明的
// **实机 outerHTML**（未加载扩展）。
//
// 本文件锁四件事：
//   ① 路由：命中 pages/org-settings + global，且不命中 repo-settings / settings /
//      settings-billing / repo / profile——`New GitHub App` 与 sudo 弹层的词条都在
//      pages/settings / pages/repo-settings 里，那两条路由不命中 /organizations/**，
//      这正是「明明翻译过却漏翻」的根因；
//   ② 说明段的**真实节点边界**：两段都在链接处断开，链接后的尾段以句点开头
//      （句点属于尾段文本节点、不是纯符号节点），整句键在实机上永不命中；
//   ③ sudo 身份确认弹层（与仓库设置 Access 子页同一款组件）在本模块逐项有译文，
//      包括此前两处都漏收的底部小贴士尾段；
//   ④ 用户内容（应用名 NapukettoBot）保持英文。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织 GitHub Apps 管理页 */
const PAGE_PATH =
	"/organizations/NapukettoDev/settings/apps";

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

/** 说明段与 sudo 弹层里必须译出的节点（译文逐条钉死） */
const TRANSLATED: readonly (readonly [string, string])[] = [
	// —— 页头与说明段（HTML 实证的节点边界）——
	["New GitHub App", "新建 GitHub 应用"],
	[
		"A GitHub App can act on its own behalf, taking actions via the API directly instead of impersonating a user. Read more in our",
		"GitHub 应用可以自行运作，直接通过 API 执行操作，而无需冒充用户。如需了解更多，请参阅我们的",
	],
	["developer documentation", "开发者文档"],
	["Management", "管理"],
	[
		"To see or change who can manage GitHub Apps belonging to your organization, see",
		"要查看或更改谁可以管理属于你组织的 GitHub 应用，请参阅",
	],
	["organization role assignments", "组织角色分配"],
	[
		". All organization owners can manage Apps, as well as users and teams with one or more of the app management permissions.",
		"。所有组织所有者都可以管理应用，拥有一个或多个应用管理权限的用户和团队也可以。",
	],
	// —— sudo 身份确认弹层（与仓库设置 Access 子页同译）——
	["Confirm access", "确认访问"],
	["Passkey", "通行密钥"],
	[
		"When you are ready, authenticate using the button below.",
		"准备就绪后，点击下方按钮进行身份验证。",
	],
	["Use passkey", "使用通行密钥"],
	["Having problems?", "遇到问题？"],
	["Use GitHub Mobile", "使用 GitHub Mobile"],
	["Use your authenticator app", "使用你的验证器应用"],
	["Send a code via email", "通过电子邮件发送验证码"],
	["Tip:", "提示："],
	["You are entering", "你正在进入"],
	["sudo mode", "sudo 模式"],
	[
		". After you've performed a sudo-protected action, you'll only be asked to re-authenticate again after a few hours of inactivity.",
		"。执行受 sudo 保护的操作后，只有在你闲置几个小时后，系统才会再次要求你重新验证身份。",
	],
	["Contact GitHub Support", "联系 GitHub 支持"],
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n          ${node}\n        `];
}

describe("组织 GitHub Apps 管理页的模块路由", () => {
	it("loads the org-settings shell with the global fallback", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match the personal or per-repository modules", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).not.toContain("pages/repo-settings");
		expect(names).not.toContain("pages/settings");
		expect(names).not.toContain("pages/settings-billing");
		expect(names).not.toContain("pages/repo");
		expect(names).not.toContain("pages/profile");
	});

	it("covers the legacy organizations prefix as well", () => {
		expect(
			moduleNames("/orgs/NapukettoDev/settings/apps"),
		).toContain("pages/org-settings");
	});
});

describe("组织 GitHub Apps 管理页的说明段与 sudo 弹层", () => {
	it("translates every node the screenshot still showed in English", () => {
		for (const [raw, expected] of TRANSLATED) {
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

	it("keeps the app name and other user content as-is", () => {
		expect(translateText("NapukettoBot", view)).toBeNull();
		// 说明段里的组织名在真实 DOM 里若是独立节点，同样保持英文
		expect(translateText("NapukettoDev", view)).toBeNull();
	});
});
