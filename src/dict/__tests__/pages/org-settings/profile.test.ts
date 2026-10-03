// 组织资料页（/organizations/<组织>/settings/profile）实机文本与属性回归。
//
// 证据与强度：2026-10-03 维护者用 popup 开发者模式导出的漏翻清单（**途径 A**），
// 覆盖 /organizations/Koishi-CE/settings/profile；同日又贴了两段该页的
// **实机 HTML**（账单邮箱与头像区块、以及下半页的产品内消息 / Patreon / 开发者计划 /
// 服务条款 / 危险区域）。那两段是装了扩展后复制的，故中文节点是扩展产物、
// 英文节点才是待补项，本文件按标签的真实嵌套逐条登记，并断言拼接后的整句。
// 途径 A 只给「文本 + 出现次数 + path」、不给节点边界，故本文件的节点清单里只放
// **本身就是完整节点**的短标签（侧栏项、表单标签、属性），凡是含 `sr-only` 碎片或
// 动态值的句子一律不凭猜登记；实机 HTML 那批则按标签的真实嵌套逐条登记。
//
// 这一页同时也是 `pages/repo-settings` 路由排除的回归：排除前组织设置页会被注入整包
// 仓库设置词条（实机表现：`Actions` →「Actions 工作流」由仓库模块提供），排除后
// `Actions` / `GitHub Apps` 由本模块自己提供——两条都收在下方的节点清单里。
//
// 刻意**不收录**（下方反例断言钉住）：
//   - 国家与地区下拉的名称：属用户可选的数据值，整节点精确匹配会误伤同名的 location
//     文本与仓库名，维护者 2026-10-03 明确拍板暂不收录；
//   - 社交平台品牌名（Bluesky / Facebook / X / YouTube…）与产品名 / 缩写
//     （Dependabot / Copilot / OIDC / GitHub Team）；
//   - 组织名、用户名与头像 alt（`Koishi-CE` / `@Koishi-CE` / `M. Oppenheymu`）。
// 未命中即保留英文，这才是正确做法。（小写泛化词 `settings` 原本也在这张清单上，
// 2026-10-03 维护者指出设置范围切换器里的它必须译出，已改为收录——见下方切换器用例。）
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** /organizations/<组织>/settings/profile 命中的模块视图（pages/org-settings + global） */
const view = buildView(
	"/organizations/Koishi-CE/settings/profile",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机文本节点（途径 A 清单逐条录入，顺序沿页面自上而下） */
const PROFILE_NODES: readonly string[] = [
	// —— 设置外壳：上下文切换器、侧栏标题、组织导航 ——
	"Organization settings",
	"Organization",
	"Select settings context",
	"Switch",
	"context",
	"Settings menu",
	"Menu",
	"General Organization Settings",
	"Organization navigation",
	"People",
	"Insights",
	// —— 组织设置侧栏 ——
	"Member privileges",
	"Repository policies",
	"Repository roles",
	"Organization roles",
	"Role assignments",
	"Role management",
	"Repository properties",
	"Custom properties",
	"Projects",
	"Configurations",
	"Caches",
	"Code review",
	"Issue fields",
	"Issue types",
	"Ruleset dashboard",
	"Ruleset insights",
	"Runner groups",
	"Authentication security",
	"Compliance",
	"Moderators",
	"Logs",
	"Audit log",
	"Active tokens",
	"Pending requests",
	"Private registries",
	"Deleted repositories",
	"OAuth app policy",
	"OAuth Apps",
	"Personal access tokens",
	"Third-party Access",
	"GitHub Apps",
	"Publisher Verification",
	"Verified and approved domains",
	"Sandboxes",
	"Import/Export",
	"Scheduled reminders",
	"Global settings",
	"Billing and licensing",
	"Payment information",
	"Payment history",
	"Additional billing details",
	"Budgets and alerts",
	"AI usage",
	"Sponsorship log",
	"Licensing",
	"Usage",
	"Blocked users",
	"Developer settings",
	// 排除 repo-settings 注入后由本模块自己提供，措辞与仓库设置保持一致
	"Actions",
	// —— 组织资料表单 ——
	"Organization display name",
	"Email (will be public)",
	"Location",
	"URL",
	"Social accounts",
	"Social account",
	// Location 搜索框的 placeholder（实机原文用半角省略号）
	"Find a location...",
	// —— 账单邮箱与头像区块（实机 HTML 证据）——
	"Billing email",
	// `<small>(Private)</small>` 独立成节点，与标签文本分开
	"(Private)",
	"Gravatar email",
	"Sponsors update email",
	"The developers and organizations that your organization sponsors can send you updates to this email.",
	"Update profile",
	"Profile picture",
	"Upload new picture",
	"Uploading...",
	"Note: To apply for a publisher verification your organization's profile picture should not be irrelevant, abusive or vulgar. It should not be a default image provided by GitHub.",
	"This file is empty.",
	"Please upload a picture smaller than 1 MB.",
	"Please upload a picture smaller than 10,000x10,000.",
	"We only support PNG, GIF, or JPG pictures.",
	"Something went really wrong and we can’t process that picture.",
	"File contents don’t match the file extension.",
	"Clear Location",
];

/** 账单说明句在 `<a>billing page</a>` 处被拆开：链接前的片段与链接文本各成一条 */
const BILLING_NOTICE_NODES: readonly string[] = [
	"Add more billing email recipients in the",
	"billing page",
];

/** 社交账号输入框的属性：aria-label 与 placeholder 同串同键 */
const SOCIAL_PROFILE_ATTRS: readonly string[] = [
	"Link to social profile 1",
	"Link to social profile 2",
	"Link to social profile 3",
	"Link to social profile 4",
];

/** 预览标签：同一串在 title 与 aria-label 两处渲染 */
const PREVIEW_LABELS: readonly string[] = [
	"Feature Release Label: Preview",
	"Feature Release Label: Public preview",
];

/**
 * 同日实机 HTML 的下半页（产品内消息 / Patreon / 开发者计划 / 服务条款 / 危险区域）。
 * 清单里每一条都是实机**真实存在的节点或属性**，含被 `<strong>`、`<a>` 拆出来的碎片；
 * 拼接后的整句断言见下方 renderNodes 用例。
 */
const PROFILE_FOOTER_NODES: readonly string[] = [
	// —— 产品内消息 ——
	"In-product messages",
	"Promotions",
	"Notify account admins about exclusive GitHub products, services, offers, and events.",
	// 两个状态 span 同时存在于 DOM（data-hidden 控制显隐），都会被遍历到
	"On",
	"Off",
	"Member requests",
	"Allow members in your organization to request access to products, budget, or features.",
	"Tips",
	"Show your organization members tips about enabled products and features.",
	"Customer Research",
	"Allow GitHub to contact members in your organization for research and feedback surveys.",
	// —— Patreon ——
	"Link Patreon account",
	"Connect a Patreon account for",
	"to sponsor maintainers with. Get recognition on GitHub for sponsorships made on Patreon when the sponsored person has linked Patreon and GitHub, too, and has a public GitHub Sponsors profile.",
	"Connect with Patreon",
	// —— GitHub Developer Program ——
	"GitHub Developer Program",
	"Building an application, service, or tool that integrates with GitHub?",
	"Join the GitHub Developer Program",
	", or read more about it at our",
	"GitHub developer program",
	// —— 服务条款 ——
	"Terms of Service",
	"Standard",
	"Best for individuals wanting the freedom to move data and remain independent of a corporation.",
	"Read the Standard Terms of Service",
	"Corporate",
	"Best for businesses that need to protect their intellectual property and secure visibility into their data.",
	"Read the GitHub customer agreement",
	"Sign GitHub customer terms",
	"Accept GitHub customer agreement",
	"Do you want to give ownership of your organization to your business?",
	"Yes, I want to sign the GitHub customer agreement on behalf of my business.",
	"What is the name of the business that owns this account?",
	"e.g, Acme, Inc.",
	"The name of the company that owns this account",
	"This business — not",
	"(your user account), will own and/or control any content posted to the organization",
	"Accepting terms...",
	"Accept terms",
	"By clicking “Accept terms”, you agree to the",
	"GitHub customer agreement",
	"and the",
	"privacy statement",
	// —— 客户协议里的企业账单信息表单 ——
	"GitHub's customer agreement requires you to transfer the ownership of your organization to your business. Enter your business details below to continue. You can change these at any time by accessing your organization’s billing information.",
	"Business/Institution name",
	"VAT/GST ID",
	"Address",
	"(Street, P.O. box)",
	"Address line 2",
	"(Apartment, suite, unit)",
	"City",
	"Country/Region",
	"Choose your country/region",
	"State/Province",
	"Select state",
	"Select province",
	"Required for certain countries",
	"Postal/Zip code",
	"(9-digit zip code for US)",
	"I agree to the",
	"Corporate Terms of Service",
	"cancel",
	// —— 危险区域 ——
	"Danger zone",
	"Rename organization",
	"Renaming your organization can have",
	"unintended side effects",
	"Rename your organization?",
	"Unexpected bad things will happen if you don’t read this!",
	"We",
	"will",
	"create redirects for your repositories (web and git access).",
	"You will need to update your local repositories to point to the new location.",
	"Renaming may take a few minutes to complete.",
	"Enter a new name",
	"Change organization’s name",
	"Archive organization",
	"Archive this organization",
	"This organization will be archived.",
	"Modifying settings will be limited and creating new repositories will be blocked.",
	"All repositories will be",
	"archived",
	"and be read-only.",
	"Before you archive, please consider:",
	"Updating any organization settings",
	"Making a note in your",
	"organization README",
	"Please type",
	"to confirm.",
	"Type in the name of the organization to confirm that you want to archive this organization.",
	"I understand the consequences, archive this organization",
	"Mark this organization and all its repositories as archived and read-only.",
	"Delete this organization",
	"Are you sure you want to delete this?",
	"Delete organization",
	"Deleting the",
	"organization will delete all of its repositories. The",
	"username will be unavailable for 90 days.",
	"Before proceeding, please be sure to review the",
	"regarding account deletion.",
	"Enter this organization’s name to confirm",
	"Cancel plan and delete the organization",
	"Once deleted, it will be gone forever. Please be certain.",
];

/** 下半页仍必须保持英文的实机文本：用户名与刻意不收录的数据值 */
const FOOTER_MUST_STAY_ENGLISH: readonly string[] = [
	// 危险区域/服务条款里的用户名（用户内容）
	"Oppenheymu",
	// 州 / 省下拉的名称，与国名同样暂不收录
	"Alabama",
	"Alberta",
	// 隐藏 span 上的 data-wording：data-* 不在引擎翻译的六个属性里
	"on behalf of",
];

/** 必须保持英文的实机文本：用户内容、产品名与刻意不收录的数据值 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// 国家与地区下拉的名称（暂不收录，见文件头）
	"China",
	"Georgia",
	"Puerto Rico",
	"Åland",
	// 社交平台品牌名
	"Bluesky",
	"Facebook",
	"Hometown",
	"Instagram",
	"LinkedIn",
	"Mastodon",
	"Npm",
	"Reddit",
	"Threads",
	"Twitch",
	"X",
	"YouTube",
	// 产品名与缩写
	"Dependabot",
	"Copilot",
	"OIDC",
	"GitHub Team",
	// 组织名、用户名与头像 alt（用户内容）
	"Koishi-CE",
	"@Koishi-CE",
	"M. Oppenheymu",
	// 位置下拉的 data-default-message（不在引擎翻译的六个属性里，有意不登记）
	"Select a location",
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

describe("组织资料页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of PROFILE_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(variant, view);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				// 译文必须是中文（防「收录了键但值还是英文」这类静默失效）
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("translates the social-account and preview-label attributes", () => {
		for (const key of [
			...SOCIAL_PROFILE_ATTRS,
			...PREVIEW_LABELS,
			...BILLING_NOTICE_NODES,
		]) {
			const translated = translateText(key, view);
			expect(
				translated,
				`属性未命中：${JSON.stringify(key)}`,
			).not.toBeNull();
			expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
		}
	});

	it("keeps user content, brand names and unexported values as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders the settings-context switcher across its three nodes", () => {
		// 实机：`切换 <span class="d-none d-md-inline">settings </span>上下文`，
		// 走到 walker 面前是三个文本节点（sr-only 的 `Switch`、可见的 `settings`、`context`）。
		// `settings` 是小写泛化词，2026-10-03 维护者指出这里必须译出，
		// 与 pages/settings 的同一句保持一致。
		expect(
			renderNodes(["Switch ", "settings ", "context"]),
		).toBe("切换 设置 上下文");
		// 窄屏（`d-none d-md-inline` 隐藏）时中间那段不参与渲染
		expect(renderNodes(["Switch", " ", "context"])).toBe(
			"切换 上下文",
		);
	});

	it("renders the sidebar labels with the existing wording", () => {
		// 与 pages/settings 的同键译文一致（跨模块同键异译会被骨架门禁点名）
		expect(translateText("Blocked users", view)).toBe(
			"已屏蔽用户",
		);
		expect(translateText("Audit log", view)).toBe(
			"审计日志",
		);
		expect(translateText("Scheduled reminders", view)).toBe(
			"定时提醒",
		);
		// 与 pages/actions 的侧栏不同：这里是组织设置的 `Caches`，不是 Actions 页的缓存
		expect(translateText("Caches", view)).toBe("缓存");
		// 排除 repo-settings 后仍由本模块提供，措辞保持不变
		expect(translateText("Actions", view)).toBe(
			"Actions 工作流",
		);
		expect(translateText("GitHub Apps", view)).toBe(
			"GitHub 应用",
		);
	});

	it("renders the profile form labels", () => {
		expect(
			translateText("Organization display name", view),
		).toBe("组织显示名称");
		expect(
			translateText("Email (will be public)", view),
		).toBe("电子邮箱（将公开）");
		expect(translateText("Find a location...", view)).toBe(
			"查找位置...",
		);
		expect(
			translateText("Link to social profile 1", view),
		).toBe("社交资料链接 1");
	});

	it("renders the billing-email notice across its link boundary", () => {
		// 实机：`Add more billing email recipients in the <a>billing page</a>.`
		// ——链接外的句点是纯符号节点（引擎按「含拉丁字母」判定，翻不了），原样保留
		expect(
			renderNodes([
				"Add more billing email recipients in the",
				" ",
				"billing page",
				".",
			]),
		).toBe("要添加更多账单邮箱收件人，请前往 账单页面.");
	});

	it("renders the private marker next to its three email labels", () => {
		// 实机：`<label>Billing email <small>(Private)</small></label>` 是两个节点
		expect(
			renderNodes(["Billing email ", "(Private)"]),
		).toBe("账单邮箱 （私密）");
		expect(
			renderNodes(["Gravatar email ", "(Private)"]),
		).toBe("Gravatar 邮箱 （私密）");
		expect(
			renderNodes(["Sponsors update email ", "(Private)"]),
		).toBe("赞助更新邮箱 （私密）");
	});

	it("renders the avatar uploader and its validation states", () => {
		expect(translateText("Profile picture", view)).toBe(
			"头像",
		);
		expect(translateText("Upload new picture", view)).toBe(
			"上传新图片",
		);
		// 上传中的文案与 global 的 sr-only「加载中」是两个节点
		expect(
			renderNodes(["加载中", " ", "Uploading..."]),
		).toBe("加载中 上传中...");
		expect(translateText("This file is empty.", view)).toBe(
			"文件为空。",
		);
		expect(
			translateText(
				"Note: To apply for a publisher verification your organization's profile picture should not be irrelevant, abusive or vulgar. It should not be a default image provided by GitHub.",
				view,
			),
		).toBe(
			"注意：申请发布者验证时，你组织的资料图片不应与组织无关，也不应包含辱骂或低俗内容，并且不能使用 GitHub 提供的默认图片。",
		);
	});
});

describe("组织资料页下半页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of PROFILE_FOOTER_NODES) {
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

	it("keeps user names and the unexported dropdown values as-is", () => {
		for (const raw of FOOTER_MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders the Patreon paragraph across its strong boundary", () => {
		// 实机：`Connect a Patreon account for <strong>@Koishi-CE</strong> to sponsor…`
		// ——英文语序在中英之间对不上，靠首段只做介词、次段承接的办法拼成
		// 「为 @Koishi-CE 关联一个 Patreon 账户，用于赞助维护者。…」
		expect(
			renderNodes([
				"Connect a Patreon account for ",
				"@Koishi-CE",
				" to sponsor maintainers with. Get recognition on GitHub for sponsorships made on Patreon when the sponsored person has linked Patreon and GitHub, too, and has a public GitHub Sponsors profile.",
			]),
		).toBe(
			"为 @Koishi-CE 关联一个 Patreon 账户，用于赞助维护者。当被赞助者同时关联了 Patreon 与 GitHub、并拥有公开的 GitHub Sponsors 个人资料时，你在 Patreon 上进行的赞助也会在 GitHub 上获得认可。",
		);
	});

	it("renders the developer-program sentence with its dangling period", () => {
		// 句末的 `.` 是链接之外的纯符号节点（引擎按「含拉丁字母」判定，翻不了），原样保留
		expect(
			renderNodes([
				"Building an application, service, or tool that integrates with GitHub?",
				" ",
				"Join the GitHub Developer Program",
				", or read more about it at our",
				" ",
				"GitHub developer program",
				".",
			]),
		).toBe(
			"正在构建与 GitHub 集成的应用、服务或工具？ 加入 GitHub 开发者计划，更多信息请见我们的 GitHub 开发者计划.",
		);
	});

	it("renders both terms-checkbox sentences across their links", () => {
		expect(
			renderNodes([
				"By clicking “Accept terms”, you agree to the",
				" ",
				"GitHub customer agreement",
				" and the",
				" ",
				"privacy statement",
				".",
			]),
		).toBe(
			"点击“接受条款”即表示你同意 GitHub 客户协议 以及 隐私声明.",
		);
		expect(
			renderNodes([
				"I agree to the",
				" ",
				"Corporate Terms of Service",
				" and the",
				" ",
				"privacy statement",
				".",
			]),
		).toBe("我同意 企业服务条款 以及 隐私声明.");
	});

	it("renders the business-ownership note across its strong boundary", () => {
		// 实机：`This business — not <strong>Oppenheymu</strong> (your user account), will own…`
		expect(
			renderNodes([
				"This business — not ",
				"Oppenheymu",
				" (your user account), will own and/or control any content posted to the organization",
			]),
		).toBe(
			"该企业——而不是 Oppenheymu （你的用户账户），将拥有和/或控制发布到该组织的任何内容",
		);
	});

	it("renders the billing address labels with their parenthetical hints", () => {
		expect(
			renderNodes(["Address ", "(Street, P.O. box)"]),
		).toBe("地址 （街道、邮政信箱）");
		expect(
			renderNodes([
				"Postal/Zip code ",
				"(9-digit zip code for US)",
			]),
		).toBe("邮政编码 （美国为 9 位 ZIP 码）");
		// 必填星号是纯符号节点，翻不了也不该翻
		expect(
			renderNodes(["Address ", "(Street, P.O. box)", " *"]),
		).toBe("地址 （街道、邮政信箱） *");
	});

	it("renders the rename warning list items across their strong boundary", () => {
		// 实机：`<li>We <strong>will</strong> create redirects for your repositories (web and git access).</li>`
		expect(
			renderNodes([
				"We ",
				"will",
				" create redirects for your repositories (web and git access).",
			]),
		).toBe(
			"我们 将 为你的仓库创建重定向（Web 与 Git 访问）。",
		);
	});

	it("renders the archive dialog confirmations", () => {
		expect(
			renderNodes([
				"Please type ",
				"Koishi-CE",
				" to confirm.",
			]),
		).toBe("请输入 Koishi-CE 以确认。");
		expect(
			renderNodes([
				"All repositories will be ",
				"archived",
				" and be read-only.",
			]),
		).toBe("所有仓库都将被 归档 并变为只读。");
		expect(
			renderNodes([
				"Making a note in your ",
				"organization README",
			]),
		).toBe("在你的 组织 README");
	});

	it("renders the delete banner across its two name boundaries", () => {
		// 同一句里组织名出现两次（两个 `<strong>`），四个文本节点拼成两句中文
		expect(
			renderNodes([
				"Deleting the ",
				"Koishi-CE",
				" organization will delete all of its repositories. The ",
				"Koishi-CE",
				" username will be unavailable for 90 days.",
			]),
		).toBe(
			"删除 Koishi-CE 组织会同时删除其所有仓库，并且该 Koishi-CE 用户名将在 90 天内不可用。",
		);
	});
});
