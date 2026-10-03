// 组织资料页（/organizations/<组织>/settings/profile）实机文本与属性回归。
//
// 证据与强度：2026-10-03 维护者用 popup 开发者模式导出的漏翻清单（**途径 A**），
// 覆盖 /organizations/Koishi-CE/settings/profile。途径 A 只给「文本 + 出现次数 + path」、
// 不给节点边界，故本文件的节点清单里只放**本身就是完整节点**的短标签
// （侧栏项、表单标签、属性），凡是含 `sr-only` 碎片或动态值的句子一律不凭猜登记。
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
//   - 组织名、用户名与头像 alt（`Koishi-CE` / `@Koishi-CE` / `M. Oppenheymu`）；
//   - 小写泛化词 `settings`（可能是仓库名 / 目录名，硬收会误伤用户内容）。
// 未命中即保留英文，这才是正确做法。
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
	// 小写泛化词：可能是仓库名 / 目录名
	"settings",
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

	it("renders the settings-context switcher across its two nodes", () => {
		// 实机：sr-only 的 `Switch` 与可见的 `context` 是两个独立节点
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
});
