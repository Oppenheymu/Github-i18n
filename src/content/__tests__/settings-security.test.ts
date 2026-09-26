// 账号安全页（/settings/security）实机文本与属性回归。
//
// 边界强度：**实机漏翻清单实证**（2026-09-26 该页会话，popup 开发者模式导出，
// schema github-zh-misses/1，path 全为 /settings/security，共 102 条）。该清单给出的是
// 每个未命中**文本节点**的原文（trim 后、空白已折叠），因此下面每条的形态就是实机形态；
// 与 settings-emails 那次「节点原文 + 整理后 HTML + 截图」三证据相比，本页缺 HTML 一档，
// 故**长句的拆分点只能按清单推断**：清单里出现的独立条目就是独立节点。
//
// 本页最关键的三处边界事实（都在下方断言里锁住）：
//   1. 通行密钥行的「Added on <日期> [|] Last used <相对时间>」是**单个含换行的文本节点**
//      （清单里三段连在一起），整句都含动态值，只能走规则（月份与相对时间无法用捕获组
//      映射成中文，故 core/rules.jsonc 里按月 × 相对时间全展开）；
//   2. 强制启用 2FA 的横幅被 `<a>now required</a>` 切成三段，第三段跨两行且含动态截止日；
//   3. 密码强度提示是**六个独立节点**（Make sure it's / at least 15 characters / OR /
//      at least 8 characters / including a number / and a lowercase letter），
//      译文必须能逐段拼起来读通。
//
// 刻意**不收录**（下方反例断言）：
//   - 用户内容：用户自命名的通行密钥名（`CanoKey Main` / `CanoKey Backup`）、
//     `M. Oppenheymu`、`(Oppenheymu)`、头像 alt `@Oppenheymu`；
//   - 纯专名：`GitHub`、`Copilot`、`Apple`、`Google`、`GitHub Mobile`
//     （截图页 / 通知页 / 邮件页的既有测试都反向断言它们保持英文）。
// 未命中即保留英文，这才是正确做法；收录它们要么误伤用户内容，要么译文与键同形（自触发循环）。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

/** /settings/security 命中的模块视图（pages/settings-security + pages/settings + global） */
const view = buildView(
	"/settings/security",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机文本节点（漏翻清单原文逐字录入，trim 后形态；顺序按页面出现先后） */
const SECURITY_NODES: readonly string[] = [
	// —— 页面标题与密码区块 ——
	"Account security",
	"Change password",
	"Old password",
	"New password",
	"Confirm new password",
	"Update password",
	"I forgot my password",
	// 强度提示的六个独立节点
	"Make sure it's",
	"at least 15 characters",
	"OR",
	"at least 8 characters",
	"including a number",
	"and a lowercase letter",
	// 强度指示条的档位文案（实机采集到的是最低档）
	"Less secure",
	"Hide",
	"Show",
	// —— 通行密钥 ——
	"Passkeys",
	"2 passkeys configured",
	"Add passkey",
	"Nickname:",
	"Edit passkey nickname",
	"An error occurred while renaming your passkey.",
	"Seen from this browser",
	"Passkeys should be used primarily for standalone, password-less authentication.",
	"Delete passkey?",
	"Note: You may continue to see this passkey as an option during sign-in until you also delete it from your browser, device or associated account's password management settings.",
	"You will no longer be able to use it to sign-in to your account.",
	// 通行密钥行的动态文本：实机是单个含源码换行的节点
	"Added on Mar 6, 2026\n                                | Last used\n                                  6 days ago",
	"Added on Mar 6, 2026\n                                | Last used\n                                  less than an hour ago",
	"Configured",
	"Manage",
	"Delete `CanoKey Backup` passkey",
	"Delete `CanoKey Main` passkey",
	"Are you sure you want to delete your `CanoKey Backup` passkey?",
	"Are you sure you want to delete your `CanoKey Main` passkey?",
	// —— 双因素认证 ——
	"Two-factor methods",
	"Two-factor authentication adds an additional layer of security to your account by requiring more than just a password to sign in.",
	"GitHub highly recommends that you keep two-factor authentication enabled on your account. If you need to change your configuration, or generate new recovery codes, you can do that in the settings below.",
	"Disable",
	"Are you sure you want to disable two-factor authentication?",
	"Authenticator app",
	"Use an authentication app or browser extension to get two-factor authentication codes when prompted.",
	"Viewed",
	"1 verified email configured",
	"SMS/Text message",
	"Get one-time codes sent to your phone via SMS to complete authentication requests. We strongly advise against using SMS because it is susceptible to interception, does not provide resistance against phishing attacks, and deliverability can be unreliable. It is recommended to use an Authenticator app instead of SMS.",
	"Security keys",
	"Register new security key",
	"Security keys are webauthn credentials that can only be used as a second factor of authentication.",
	"Security key registration failed.",
	"This security key has already been registered.",
	"This browser doesn't support security keys yet.",
	"Try again",
	"Waiting for input from browser interaction...",
	"Show GitHub Mobile",
	"GitHub Mobile can be used for two-factor authentication by installing the GitHub Mobile app and signing in to your account.",
	"1 account connected",
	"2 devices",
	"Add account",
	"Connect",
	"View",
	"Recovery codes",
	"Recovery codes can be used to access your account in the event you lose access to your device and cannot receive two-factor authentication codes.",
	"Recovery options",
	// —— 首选 2FA 方式 ——
	"Preferred 2FA method",
	"Set your preferred method to use for two-factor authentication when signing into GitHub.",
	// —— 登录方式 ——
	"Sign in methods",
	"Sign in with your Apple account",
	// —— 强制启用 2FA 的横幅（三段）——
	"Because of your contributions on GitHub, two-factor authentication is required for your account. Thank you for helping keep the ecosystem safe!",
	"Some GitHub users are",
	"now required",
	"to enable two-factor authentication as an additional security measure. Your activity on GitHub includes you in this requirement.\n        You will need to re-enable two-factor authentication on your account before April 30, 2026, otherwise your account will be restricted on that date.",
];

/** 实机里被翻译的属性值（精确命中语义，不走规则）：aria-label 与 placeholder */
const SECURITY_ATTRS: readonly string[] = [
	"Change password",
	"Passkey nickname",
	"Cancel changes to passkey nickname",
	"Save changes to passkey nickname",
	"Delete `CanoKey Main` passkey",
	"Cancel `CanoKey Main` passkey delete",
	"Confirm delete `CanoKey Main` passkey",
	"Confirm delete of `CanoKey Main` passkey",
	"Add SMS/Text message",
	"Edit Authenticator app",
	"Edit Security keys",
	"Learn more about strong passwords",
	"Learn more about two-factor authentication",
	"Learn more about our two-factor authentication initiative",
	"View Recovery codes",
	"Show GitHub Mobile",
	"Google sign in method dropdown",
	"Enter a nickname for this security key",
];

/**
 * 必须保持英文的实机节点：用户内容与纯专名 / 纯缩写。
 * 它们都含拉丁字母、会通过「可翻译判定」，但收录即错。
 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// 用户自命名的通行密钥（规则只吞含整句的模板，裸名字必须原样留着）
	"CanoKey Main",
	"CanoKey Backup",
	// 用户内容
	"M. Oppenheymu",
	"(Oppenheymu)",
	"@Oppenheymu",
	// 纯专名 / 产品名
	"GitHub",
	"Copilot",
	"Apple",
	"Google",
	"GitHub Mobile",
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
			const lead = node.slice(
				0,
				node.length - node.trimStart().length,
			);
			const trail = node.slice(node.trimEnd().length);
			return `${lead}${translated}${trail}`;
		})
		.join("");
}

describe("账号安全页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of [
			...SECURITY_NODES,
			...SECURITY_ATTRS,
		]) {
			for (const variant of withWhitespace(node)) {
				expect(translateText(variant, view)).not.toBeNull();
			}
		}
	});

	it("keeps user content and brand names in English", () => {
		for (const node of MUST_STAY_ENGLISH) {
			for (const variant of withWhitespace(node)) {
				expect(translateText(variant, view)).toBeNull();
			}
		}
	});

	it("renders the password strength hint as one readable sentence", () => {
		// 实机是六个独立节点（中间是列表项 / 强调元素），译文必须能逐段拼通
		const nodes = [
			"Make sure it's ",
			"at least 15 characters",
			" OR ",
			"at least 8 characters",
			" including a number",
			" and a lowercase letter",
		];
		expect(renderNodes(nodes)).toBe(
			"请确保密码 至少 15 个字符 或 至少 8 个字符 包含数字 和小写字母",
		);
	});

	it("renders the required-2FA banner as one readable sentence", () => {
		// 实机边界：`Some GitHub users are` + <a>now required</a> + 第三段（跨两行、含截止日）
		const nodes = [
			"Some GitHub users are ",
			"now required",
			" to enable two-factor authentication as an additional security measure. Your activity on GitHub includes you in this requirement.\n        You will need to re-enable two-factor authentication on your account before April 30, 2026, otherwise your account will be restricted on that date.",
		];
		expect(renderNodes(nodes)).toBe(
			"部分 GitHub 用户 现在必须 启用双因素认证作为额外的安全措施。你在 GitHub 上的活动使你被纳入此要求。你需要在 2026 年 4 月 30 日前重新为你的账户启用双因素认证，否则你的账户将在该日期受到限制。",
		);
	});

	it("renders the passkey meta line through the month rules", () => {
		const node =
			"Added on Mar 6, 2026\n                                | Last used\n                                  6 days ago";
		expect(translateText(node, view)).toBe(
			"添加于 2026 年 3 月 6 日 | 上次使用 6 天前",
		);
	});

	it("keeps the passkey name inside the translated sentence", () => {
		expect(
			translateText(
				"Are you sure you want to delete your `CanoKey Main` passkey?",
				view,
			),
		).toBe("确定要删除你的 `CanoKey Main` 通行密钥吗？");
		expect(
			translateText(
				"Delete `CanoKey Backup` passkey",
				view,
			),
		).toBe("删除 `CanoKey Backup` 通行密钥");
	});

	it("covers every month of the passkey meta line and the deadline banner", () => {
		const months = [
			["Jan", "1"],
			["Feb", "2"],
			["Mar", "3"],
			["Apr", "4"],
			["May", "5"],
			["Jun", "6"],
			["Jul", "7"],
			["Aug", "8"],
			["Sep", "9"],
			["Oct", "10"],
			["Nov", "11"],
			["Dec", "12"],
		] as const;
		const longMonths = [
			["January", "1"],
			["February", "2"],
			["March", "3"],
			["April", "4"],
			["May", "5"],
			["June", "6"],
			["July", "7"],
			["August", "8"],
			["September", "9"],
			["October", "10"],
			["November", "11"],
			["December", "12"],
		] as const;
		for (const [month, cn] of months) {
			expect(
				translateText(
					`Added on ${month} 1, 2027 | Last used 12 minutes ago`,
					view,
				),
			).toBe(
				`添加于 2027 年 ${cn} 月 1 日 | 上次使用 12 分钟前`,
			);
		}
		for (const [month, cn] of longMonths) {
			expect(
				translateText(
					`to enable two-factor authentication as an additional security measure. Your activity on GitHub includes you in this requirement. You will need to re-enable two-factor authentication on your account before ${month} 30, 2027, otherwise your account will be restricted on that date.`,
					view,
				),
			).toBe(
				`启用双因素认证作为额外的安全措施。你在 GitHub 上的活动使你被纳入此要求。你需要在 2027 年 ${cn} 月 30 日前重新为你的账户启用双因素认证，否则你的账户将在该日期受到限制。`,
			);
		}
	});

	it("leaves unenumerated relative times in English instead of half-translating", () => {
		// 未枚举的形态（last week）整节点保留英文：规则两端锚定，不做部分替换
		expect(
			translateText(
				"Added on Mar 6, 2026 | Last used last week",
				view,
			),
		).toBeNull();
	});

	it("covers the counts of every section header", () => {
		expect(
			translateText("2 passkeys configured", view),
		).toBe("已配置 2 个通行密钥");
		expect(
			translateText("1 verified email configured", view),
		).toBe("已配置 1 个已验证邮箱");
		expect(translateText("1 account connected", view)).toBe(
			"已连接 1 个账户",
		);
		expect(translateText("2 devices", view)).toBe(
			"2 台设备",
		);
	});
});
