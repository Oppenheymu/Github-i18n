// 组织账单页（/organizations/<组织>/settings/billing）实机文本回归。
//
// 证据与强度：2026-10-03 维护者贴出的**实机 HTML**（`<react-app app-name="billing-app">`
// 的整段 outerHTML；采集时扩展仍在运行，故已是中文的节点是扩展产物、仍是英文的才是待补清单）。
//
// 这一页此前整页保留英文的根因不是缺词条，而是**缺路由**：它在组织设置路由下，却整页渲染
// billing-app 组件（SummaryCardContainer / IncludedUsageTile / ProductUsage…），文案与个人
// 账单页（pages/settings-billing）逐字相同。2026-10-03 把 pages/settings-billing 的路由扩成
// 两支（见 core/modules.jsonc），本文件锁四件事：
//   ① 该路径必须命中 pages/settings-billing + pages/org-settings + global，且**账单模块在前**
//      （逐键先到先得：账单词条由前者提供，组织设置外壳由后者兜底）；
//   ② 那批早就有译文的账单文案在该路径上真的生效（路由通了，词条才谈得上命中）；
//   ③ 说明句里的**整句日期区间**（`Gross metered usage for October 1 - October 30, 2026.`）
//      由 core/rules.jsonc 新展开的整句规则覆盖：settings/usage-range-* 只覆盖「区间单独成
//      节点」的形态，整句形态在实机上是**一个**文本节点（个人账单页的漏翻导出记录的就是整句）；
//   ④ 用户内容与产品名（仓库名、Git LFS / Sandbox / Spark / items）必须保持英文。
//
// 三条必须记住的边界事实：
//   1. outerHTML 把相邻文本节点拼在一起输出，**节点边界看不出**。凡是有两种可能切分的句子
//      （日期区间、重置天数）都在这里把两种形态锁住；
//   2. 计费周期后缀「per month」实机是 `per ` + `month` 两个节点（2026-09 Console 实证），
//      整短语键永不命中，由 settings/per-word + settings/billing-period-word 两条碎片规则覆盖；
//   3. 组织账单页与个人账单页共用同一套组件，但**侧栏不同**（组织设置侧栏来自
//      pages/org-settings），故本页的命中序列必须是三模块。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const PATH = "/organizations/Koishi-CE/settings/billing";

/** 该路径命中的模块视图（pages/settings-billing + pages/org-settings + global） */
const view = buildView(
	PATH,
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机 HTML 里仍是英文的文本节点（逐条誊录，顺序即页面顺序） */
const BILLING_NODES: readonly string[] = [
	// —— 汇总卡 ——
	"Current metered usage",
	"Gross metered usage for October 1 - October 30, 2026.",
	"Current included usage",
	"More details",
	"Included usage discounts for October 1 - October 30, 2026.",
	"Next payment due",
	// —— 订阅与按量计费用量 ——
	"Subscriptions",
	"Manage subscriptions",
	"GitHub Free",
	"Metered usage",
	"Timeframe: Current month",
	"Usage by products",
	"Products selector navigation",
	"Products selector",
	"Billable usage",
	"View details",
	"Total billable usage after subtracting discounts from consumed usage",
	"consumed usage",
	"Minus",
	"discounts",
	"Billable spend for Actions and Actions Runners for the selected timeframe. Applicable discounts cover Actions usage in public repositories and included usage for Actions minutes and storage.",
	"Included usage",
	"Manage budgets",
	"Actions minutes",
	"0 min used / 2,000 min included",
	"Actions and Packages storage",
	"0 GB used / 0.5 GB included",
	"Included usage limits reset in 29 days.",
	// —— 按仓库查看用量 ——
	"Usage by repository",
	"Top two repositories this month",
	"Open repository usage options",
	"Gross amount",
];

/**
 * 可翻译的**属性**（本页实机 HTML 里的 aria-label / tooltip 文案）。
 * 「Actions and Packages storage」同时是进度条的 aria-label，故它一处登记、两处生效。
 */
const ATTRIBUTE_NODES: readonly string[] = [
	"Products selector",
	"Products selector navigation",
	"Minus",
	"Actions minutes",
	"Actions and Packages storage",
	"Open repository usage options",
];

/** 必须保持英文：用户内容、产品名与泛化短词 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"koishi",
	"services",
	"$0.04",
	"<$0.01",
	"Git LFS",
	"Sandbox",
	"Spark",
	"items",
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

describe("组织账单页的模块路由", () => {
	it("loads the billing module ahead of the org-settings shell", () => {
		const names = matchModules(
			PATH,
			dictForLocale("zh-CN").modules,
		).map((module) => module.name);
		expect(names).toContain("pages/settings-billing");
		// 组织设置外壳（侧栏等）同样命中，靠模块顺序决定逐键先到先得
		expect(names).toContain("pages/org-settings");
		expect(
			names.indexOf("pages/settings-billing"),
		).toBeLessThan(names.indexOf("pages/org-settings"));
	});

	it("keeps the personal billing routes working", () => {
		for (const path of [
			"/account/billing",
			"/account/billing/usage",
			"/settings/billing/licensing",
		]) {
			expect(
				matchModules(
					path,
					dictForLocale("zh-CN").modules,
				).map((module) => module.name),
				`${path} 应命中账单模块`,
			).toContain("pages/settings-billing");
		}
	});

	it("does not leak the billing module into other org settings pages", () => {
		// 账单词条（Manage budgets / View details…）不得注入组织资料页等其它子页
		const names = matchModules(
			"/organizations/Koishi-CE/settings/profile",
			dictForLocale("zh-CN").modules,
		).map((module) => module.name);
		expect(names).not.toContain("pages/settings-billing");
	});
});

describe("组织账单页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of BILLING_NODES) {
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

	it("translates the aria-label and tooltip text", () => {
		for (const node of ATTRIBUTE_NODES) {
			const translated = translateText(node, view);
			expect(
				translated,
				`属性未命中：${JSON.stringify(node)}`,
			).not.toBeNull();
			expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
		}
	});

	it("keeps user content, product names and generic words as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("translates the block headings registered for this route", () => {
		// 同键在 pages/settings 也有词条，但那条路由不命中 /organizations/**，
		// 故本模块另收一份（译文逐字一致）
		expect(translateText("Subscriptions", view)).toBe(
			"订阅",
		);
		expect(
			translateText("Actions and Packages storage", view),
		).toBe("Actions 与 Packages 存储");
	});

	it("renders the split per / month nodes as 每月", () => {
		// 实机：PlanCard 把计费周期后缀渲染成 `per ` + `month` 两个文本节点
		expect(renderNodes(["per ", "month"])).toBe("每月");
	});
});

describe("组织账单页的整句日期区间与天数", () => {
	it("rewrites the metered usage blurb as a whole sentence", () => {
		// 实机形态（本页 HTML）：说明句与日期区间在同一个文本节点里
		expect(
			translateText(
				"Gross metered usage for October 1 - October 30, 2026.",
				view,
			),
		).toBe(
			"2026 年 10 月 1 日 – 10 月 30 日的毛按量计费用量。",
		);
		expect(
			translateText(
				"Included usage discounts for October 1 - October 30, 2026.",
				view,
			),
		).toBe(
			"2026 年 10 月 1 日 – 10 月 30 日的所含用量折扣。",
		);
	});

	it("covers every month of the same-month form", () => {
		// 时间范围下拉的 Current month / Last month 两个选项都是同月区间，
		// 规则按月全展开（12 条 × 2 句），故换个月份也必须成立
		expect(
			translateText(
				"Gross metered usage for March 1 - March 31, 2027.",
				view,
			),
		).toBe(
			"2027 年 3 月 1 日 – 3 月 31 日的毛按量计费用量。",
		);
		expect(
			translateText(
				"Included usage discounts for January 1 - January 31, 2027.",
				view,
			),
		).toBe(
			"2027 年 1 月 1 日 – 1 月 31 日的所含用量折扣。",
		);
	});

	it("covers the cross-month forms the timeframe selector can produce", () => {
		// 只有 This year（1 月 1 日 → 当月）与 Last year（1 月 1 日 → 12 月 31 日）跨月，
		// 起点恒为 1 月，规则按 January → 各月展开 11 条
		expect(
			translateText(
				"Gross metered usage for January 1 - October 30, 2026.",
				view,
			),
		).toBe(
			"2026 年 1 月 1 日 – 10 月 30 日的毛按量计费用量。",
		);
		expect(
			translateText(
				"Included usage discounts for January 1 - December 31, 2025.",
				view,
			),
		).toBe(
			"2025 年 1 月 1 日 – 12 月 31 日的所含用量折扣。",
		);
		// 未覆盖的跨月组合（本页下拉产不出来）**整句保留英文**，不会被部分替换成残句
		expect(
			translateText(
				"Gross metered usage for September 15 - October 14, 2026.",
				view,
			),
		).toBeNull();
	});

	it("still rewrites a bare date range when it is its own node", () => {
		// 另一种可能的切分（区间独立成节点）由既有的 settings/usage-range-* 覆盖：
		// 规则以「, 年份」收尾，句点留给纯符号节点，故拼接结果末尾是「日」而不是「日。」
		expect(
			translateText("October 1 - October 30, 2026", view),
		).toBe("2026 年 10 月 1 日 – 30 日");
		expect(
			renderNodes([
				"Gross metered usage for ",
				"October 1 - October 30, 2026",
				".",
			]),
		).toBe(
			"Gross metered usage for 2026 年 10 月 1 日 – 30 日.",
		);
	});

	it("translates the included-usage reset count in every split", () => {
		// ① 整句一个节点
		expect(
			translateText(
				"Included usage limits reset in 29 days.",
				view,
			),
		).toBe("所含用量限额将在 29 天后重置。");
		// ② 前缀一个节点 + 天数一个节点（前缀走静态词条，尾节点走规则）
		expect(
			renderNodes([
				"Included usage limits reset in ",
				"29 days.",
			]),
		).toBe("所含用量限额将在 29 天后。");
		// ③ 前缀与天数之间再插一层数字节点
		expect(
			renderNodes([
				"Included usage limits reset in ",
				"29",
				" days.",
			]),
		).toBe("所含用量限额将在 29 天。");
	});
});
