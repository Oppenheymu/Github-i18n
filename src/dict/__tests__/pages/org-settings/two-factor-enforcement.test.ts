import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** /organizations/<组织>/settings/two_factor_enforcement 命中的模块视图 */
const view = buildView(
	"/organizations/Koishi-CE/settings/two_factor_enforcement",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

const TWO_FACTOR_TEXT: readonly (readonly [
	string,
	string,
])[] = [
	["Two-factor authentication", "双因素认证"],
	[
		"Two-factor authentication adds another level of security for your organization.",
		"双因素认证可为你的组织增添一层安全保障。",
	],
	[
		"Learn more about requiring two-factor authentication in your organization.",
		"进一步了解如何要求组织成员启用双因素认证。",
	],
	[
		"Organization members who do not have two-factor authentication enabled will be unable to access resources owned by the",
		"未启用双因素认证的组织成员将无法访问",
	],
	[
		"organization, but will remain a member of",
		"组织拥有的资源，但在更新设置前仍会是",
	],
	[
		"until they update their settings. Outside collaborators who do not have two-factor authentication enabled will be removed from the organization and notified.",
		"的成员。未启用双因素认证的外部协作者将从组织中移除，并收到通知。",
	],
	[
		"Only allow secure two-factor methods",
		"仅允许使用安全的双因素认证方式",
	],
	[
		"Users can only use secure two-factor methods: authenticator apps, passkeys, security keys, and the GitHub mobile app.",
		"用户只能使用安全的双因素认证方式：身份验证器应用、通行密钥、安全密钥和 GitHub Mobile 应用。",
	],
	[
		"Existing members will lose access to organization resources if they disable two-factor authentication. Outside collaborators will be removed from the organization if they disable two-factor authentication.",
		"现有成员若关闭双因素认证，将无法访问组织资源。外部协作者若关闭双因素认证，将从组织中移除。",
	],
	[
		"Users' two-factor authentication methods will not be affected.",
		"用户的双因素认证方式不会受到影响。",
	],
	[
		"Secure your data and people with GitHub Enterprise",
		"使用 GitHub Enterprise 保护数据与人员",
	],
	["SAML single sign-on (SSO)", "SAML 单点登录（SSO）"],
	[
		"SAML single sign-on (SSO) gives GitHub Enterprise accounts a way to control and secure access to organization resources like repositories, issues, and pull requests.",
		"SAML 单点登录（SSO）让 GitHub Enterprise 账户能够控制并保护对组织资源（如仓库、议题和拉取请求）的访问。",
	],
	["SSH certificate authorities", "SSH 证书颁发机构"],
	[
		"With an SSH certificate authority, enterprise accounts can provide SSH certificates that members can use to access your resources with Git.",
		"通过 SSH 证书颁发机构，企业账户可以提供 SSH 证书，让成员使用 Git 访问你的资源。",
	],
	["Certified for compliance", "通过合规认证"],
	[
		"GitHub Enterprise Cloud is certified for SOC 1 Type 2, SOC 2 Type 2, FedRAMP LiSaaS. Enterprise customers can download these reports, and more, at any time.",
		"GitHub Enterprise Cloud 已通过 SOC 1 Type 2、SOC 2 Type 2 和 FedRAMP LiSaaS 认证。企业客户可随时下载这些报告及其他报告。",
	],
	["Team Synchronization", "团队同步"],
	[
		"Enable and disable team synchronization between your identity provider (IdP) and your organizations on GitHub Enterprise accounts.",
		"在 GitHub Enterprise 账户中，启用或禁用身份提供商（IdP）与组织之间的团队同步。",
	],
	["IP allow list", "IP 允许列表"],
	[
		"GitHub Enterprise accounts can restrict access to private organization assets by configuring an allow list for specific IP addresses.",
		"GitHub Enterprise 账户可以通过为特定 IP 地址配置允许列表，限制对组织私有资源的访问。",
	],
	["Close dialog", "关闭对话框"],
	["View organization membership", "查看组织成员"],
	[
		"to see which users will be impacted.",
		"即可查看哪些用户会受到影响。",
	],
];

/** 按 walker 语义保留每个原始节点的首尾空白后拼接 */
function renderNodes(nodes: readonly string[]): string {
	return nodes
		.map((node) => {
			const translated = translateText(node, view);
			if (translated === null) return node;
			const lead = node.slice(
				0,
				node.length - node.trimStart().length,
			);
			const trail = node.slice(node.trimEnd().length);
			return `${lead}${translated}${trail}`;
		})
		.join("");
}

describe("pages/org-settings 的组织双因素认证设置页", () => {
	it("translates every supplied English text node and aria label", () => {
		for (const [source, translated] of TWO_FACTOR_TEXT) {
			expect(
				translateText(source, view),
				`未命中：${source}`,
			).toBe(translated);
		}
	});

	it("reassembles the notice around organization names in strong nodes", () => {
		expect(
			renderNodes([
				"Organization members who do not have two-factor authentication enabled will be unable to access resources owned by the ",
				"Koishi-CE",
				" organization, but will remain a member of ",
				"Koishi-CE",
				" until they update their settings. Outside collaborators who do not have two-factor authentication enabled will be removed from the organization and notified.\n      ",
			]),
		).toBe(
			"未启用双因素认证的组织成员将无法访问 Koishi-CE 组织拥有的资源，但在更新设置前仍会是 Koishi-CE 的成员。未启用双因素认证的外部协作者将从组织中移除，并收到通知。\n      ",
		);
	});

	it("keeps dynamic organization names in policy and confirmation messages", () => {
		expect(
			translateText(
				"Require two-factor authentication for everyone in the Koishi-CE organization.",
				view,
			),
		).toBe("为 Koishi-CE 组织中的所有人启用双因素认证。");
		expect(
			translateText(
				"Are you sure you want to remove the two-factor authentication for all users in Koishi 社区版?",
				view,
			),
		).toBe(
			"确定要取消对 Koishi 社区版 的所有用户的双因素认证要求吗？",
		);
		expect(translateText("Koishi-CE", view)).toBeNull();
	});

	it("translates each organization-specific confirmation state", () => {
		expect(
			translateText(
				"Two-factor authentication will no longer be required to access any resources in the Koishi-CE organization.",
				view,
			),
		).toBe(
			"Koishi-CE 组织的所有资源将不再要求使用双因素认证才能访问。",
		);
		expect(
			translateText(
				"Users will be required to set up two-factor authentication using a secure method in order to access the Koishi-CE organization.",
				view,
			),
		).toBe(
			"用户必须设置双因素认证并使用安全方式，才能访问 Koishi-CE 组织。",
		);
		expect(
			translateText(
				"Users will be required to set up two-factor authentication in order to access the Koishi-CE organization.",
				view,
			),
		).toBe(
			"用户必须设置双因素认证才能访问 Koishi-CE 组织。",
		);
		expect(
			translateText(
				"Secure methods of two-factor authentication will no longer be required to access any organization's resources in the Koishi-CE organization.",
				view,
			),
		).toBe(
			"访问 Koishi-CE 组织的资源将不再要求使用安全的双因素认证方式。",
		);
	});
});
