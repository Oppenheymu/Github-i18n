// 组织赞助订阅页（/organizations/<组织>/settings/billing/subscriptions）实机文本回归。
//
// 证据与强度：2026-10-07 维护者贴出的**整页实机 HTML**（整段 outerHTML；采集时扩展仍在运行，
// 故已是中文的节点是扩展产物、仍是英文的才是待补清单）。这一页**不缺路由**：
// `/organizations/<组织>/settings/billing/**` 早已由 settings/billing 那一支覆盖，
// 页面上半部分新出现的「账单联系人」区块才是本轮补的内容（GitHub 新加的组织侧 UI）。
// 页面下半部分的赞助区块此前已译（`Sponsorships` / `Start sponsoring` / 空态），
// 本文件把它一并锁住，因为它是判定「扩展在这一页上确实生效」的对照物——没有它就无法
// 区分「整页漏翻」与「只漏了一块」。
//
// 本文件锁四件事：
//   ① 该路径命中 pages/settings-billing + pages/org-settings + global，账单模块在前，
//      且**不命中** pages/settings（后者路由是 ^/(?:settings|account/billing)）；
//   ② 新收的 16 条键全部按实机节点原文命中（含只出现在属性上的几条）；
//   ③ 说明句、对话框标题、`Add` 按钮各自在实机里出现两次/两处，同一个键必须都命中；
//   ④ 产品名与用户内容（GitHub Sponsors / 金额 / 邮箱）必须保持英文。
//
// 两条必须记住的边界事实：
//   1. `Add` / `Update` / `Primary` / `Close dialog` 是**跨模块同键同值**：个人侧由
//      pages/settings 提供，组织侧由本模块提供（那条路由不命中 /organizations/**）。
//      值必须逐字一致，否则视图骨架的同键赢家会立刻报「同键异译」；
//   2. 空态那句在实机里是 `You're currently not sponsoring anyone.`（直撇号），
//      由 core/rules.jsonc 的 settings/sponsoring-none 覆盖（模板不含撇号）。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const ORG_PATH =
	"/organizations/Koishi-CE/settings/billing/subscriptions";
/** 组织账单的**非 settings 支**：同一套组件，路由也已覆盖（防御性锁定） */
const ORG_NON_SETTINGS_PATH =
	"/organizations/Koishi-CE/billing/subscriptions";
const PERSONAL_PATH = "/account/billing/subscriptions";

/** 组织路径命中的模块视图（pages/settings-billing + pages/org-settings + global） */
const view = buildView(
	ORG_PATH,
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 个人路径视图：共享节点在两条路由上必须译得**逐字一样** */
const personalView = buildView(
	PERSONAL_PATH,
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 本轮新补的键（逐条誊录实机 HTML，顺序即页面顺序） */
const NEW_NODES: readonly string[] = [
	// —— 账单联系人 ——
	"Billing Contacts",
	"Receipts are sent to billing managers and email recipients.",
	"Billing managers",
	"Invite",
	"You have not invited any billing managers",
	"Email recipients",
	"Add",
	// —— 添加收件人对话框（默认不展开，但仍在 DOM 里，照常翻译）——
	"Add billing recipient",
	"Add billing recipient email",
	// —— 编辑主账单邮箱 ——
	"Billing primary email",
	"Primary",
	"Label: Primary",
	"Edit billing email address",
	"Close dialog",
	"Update",
	// —— 赞助区块里的发票结算入口 ——
	"Switch to invoiced billing",
];

/** 属性上的键：属性只走词条查表（不应用规则），译文必须与文本节点一致 */
const ATTRIBUTE_NODES: readonly [string, string][] = [
	// 按钮 / 输入框的无障碍文案与占位符，三处同一个键
	["Add billing recipient email", "添加账单收件人邮箱"],
	// `<details-dialog>` 与它的 `Box-title` 共用
	["Edit billing email address", "编辑账单邮箱地址"],
	// 编辑对话框右上角的关闭按钮
	["Close dialog", "关闭对话框"],
	// `<span class="Label">` 的悬浮提示
	["Label: Primary", "标签：主邮箱"],
];

/** 本轮之前就已有译文、在组织路径上必须照常命中的节点（实机 HTML 里已是中文） */
const SHARED_NODES: readonly [string, string][] = [
	["Sponsorships", "赞助"],
	["Manage your organizations", "管理你的组织"],
	[
		"Connect with the community that builds the tools you use",
		"与构建你所使用工具的社区建立联系",
	],
	["Start sponsoring", "开始赞助"],
	[
		"Learn more about GitHub Sponsors",
		"详细了解 GitHub Sponsors",
	],
];

/** 跨模块同键同值：个人侧由 pages/settings 提供，值必须与本模块逐字一致 */
const CROSS_MODULE_NODES: readonly [string, string][] = [
	["Add", "添加"],
	["Update", "更新"],
	["Primary", "主邮箱"],
	["Close dialog", "关闭对话框"],
];

/** 必须保持英文：产品名、金额与用户内容 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// 产品名（与本模块 Sponsorships 区块、组织设置页 Sponsor 邮箱区块同一口径）
	"GitHub Sponsors",
	// 金额与组织名
	"$0.00",
	"Koishi-CE",
	// 用户内容：收件人邮箱
	"oppenheymu@gmail.com",
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

describe("组织赞助订阅页的模块路由", () => {
	it("loads the billing module ahead of the org-settings shell", () => {
		const names = matchModules(
			ORG_PATH,
			dictForLocale("zh-CN").modules,
		).map((module) => module.name);
		expect(names).toContain("pages/settings-billing");
		expect(names).toContain("pages/org-settings");
		expect(
			names.indexOf("pages/settings-billing"),
		).toBeLessThan(names.indexOf("pages/org-settings"));
	});

	it("does not match the personal settings module", () => {
		// pages/settings 的路由是 ^/(?:settings|account/billing)，不覆盖 /organizations/**
		const names = matchModules(
			ORG_PATH,
			dictForLocale("zh-CN").modules,
		).map((module) => module.name);
		expect(names).not.toContain("pages/settings");
	});

	it("keeps the personal subscriptions route working", () => {
		const names = matchModules(
			PERSONAL_PATH,
			dictForLocale("zh-CN").modules,
		).map((module) => module.name);
		expect(names).toContain("pages/settings-billing");
		expect(names).toContain("pages/settings");
	});

	it("covers the non-settings organization billing branch", () => {
		const names = matchModules(
			ORG_NON_SETTINGS_PATH,
			dictForLocale("zh-CN").modules,
		).map((module) => module.name);
		expect(names).toContain("pages/settings-billing");
	});
});

describe("组织赞助订阅页的实机节点边界", () => {
	it("translates every newly registered node", () => {
		for (const node of NEW_NODES) {
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

	it("translates the attribute-only keys", () => {
		for (const [raw, expected] of ATTRIBUTE_NODES) {
			expect(
				translateText(raw, view),
				`属性未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("reuses the sponsorship wording already registered for this module", () => {
		for (const [raw, expected] of SHARED_NODES) {
			expect(
				translateText(raw, view),
				`未命中：${raw}`,
			).toBe(expected);
		}
	});

	it("keeps the cross-module keys identical on both routes", () => {
		// 个人侧由 pages/settings 先命中，组织侧由本模块提供；
		// 两条路由的译文必须逐字一致（骨架的同键赢家会盯住同一个值）
		for (const [raw, expected] of CROSS_MODULE_NODES) {
			expect(
				translateText(raw, view),
				`组织侧：${raw}`,
			).toBe(expected);
			expect(
				translateText(raw, personalView),
				`个人侧：${raw}`,
			).toBe(expected);
		}
	});

	it("renders every new key identically on the personal route", () => {
		for (const node of NEW_NODES) {
			expect(
				translateText(node, view),
				`两条路由译文不一致：${JSON.stringify(node)}`,
			).toBe(translateText(node, personalView));
		}
	});

	it("keeps product names, amounts and user content as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});

describe("组织赞助订阅页的跨节点文本", () => {
	it("renders the sponsorship empty state through its rule", () => {
		// 空态整句由 core/rules.jsonc 的 settings/sponsoring-none 覆盖：
		// 直撇号与弯撇号两种形态都命中，模板里不含撇号
		expect(
			translateText(
				"You're currently not sponsoring anyone.",
				view,
			),
		).toBe("你目前没有赞助任何人。");
		expect(
			translateText(
				"You\u2019re currently not sponsoring anyone.",
				view,
			),
		).toBe("你目前没有赞助任何人。");
		// 空态 + 紧随其后的文档链接：walker 保留节点的首尾空白，故句末仍有一个空格
		expect(
			renderNodes([
				"\n             You're currently not sponsoring anyone. ",
				"Learn more about GitHub Sponsors",
			]),
		).toBe(
			"\n             你目前没有赞助任何人。 详细了解 GitHub Sponsors",
		);
	});

	it("renders the billing-contacts banner as one sentence", () => {
		// 说明句在页面上（<p>）与对话框里（<span>）各渲染一次，译文只有一句
		expect(
			translateText(
				"Receipts are sent to billing managers and email recipients.",
				view,
			),
		).toBe("收据会发送给账单管理员和邮件收件人。");
	});

	it("keeps the generic short keys exact-match only", () => {
		// `Primary` / `Invite` 都是泛化短词：只有整节点精确相等才命中，相邻词不命中——
		// 这正是它们可以安全收录的前提（收录泛化短词前先三思，见 AGENTS.md 硬性约束 3）
		expect(translateText("Primary", view)).toBe("主邮箱");
		expect(translateText("Primary email", view)).toBeNull();
		expect(translateText("Invite", view)).toBe("邀请");
		expect(translateText("Invite member", view)).toBeNull();
	});
});
