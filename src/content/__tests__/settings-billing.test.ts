// 账单页（/account/billing）与用量页（/account/billing/usage）实机文本节点回归。
//
// 路径迁移（2026-09 实测）：这几个页面原本都在 /settings/billing/**，GitHub 已把**个人账单整支**
// 迁到 /account/billing/**（/settings/billing 及其子页实测 404，仅 /settings/billing/licensing 尚存）。
// 迁移只换路径、不换节点原文，故下面誊录的清单原样沿用，只把构建视图的 pathname 换成新路径。
// 两条路由由 core/modules.jsonc 同时覆盖新老路径：pages/settings → ^/(?:settings|account/billing)、
// pages/settings-billing → ^/(?:settings|account)/billing，因此这里锁的行为在新路径上必须成立。
//
// 为什么单独锁这两页：
//   1. 键整批来自开发者模式导出的漏翻 JSON（2026-09 该页会话），导出记录的是
//      **逐个文本节点的 trimmed 原文**——账单总览被拆成一堆卡片、下拉与说明句碎片，
//      这是「不凭视觉整句登记键」的唯一依据，故把这份清单原样锁在这里；
//   2. 本页有三类动态文本，只能靠 core/rules.jsonc 的规则覆盖，且规则顺序有语义：
//      时间范围（同月 / 跨月）、计费周期后缀（/month）、额度摘要（N GB used / N included）。
//      裸日期区间必须排在 global 的 long-date-* 之前，否则「September 1 - September 30, 2026」
//      会被 long-date-september 做**部分替换**，产出「2026 年 9 月 1 日 - September 30, 2026」
//      这种中英混合的残句——下面有专门一条用例盯住它；
//   3. 用户内容与纯专名**必须不被翻译**：仓库名、@用户名、头像 alt、Copilot / Spark /
//      GitHub Models / Packages / Git LFS，以及 per / month / items / usage 这类泛化短词。
//      门禁要求译文含中文字系，这类词条的正确做法就是不收录（未命中即保留英文），
//      这里反向断言，防止后人「补」成死键或造出翻译循环；
//   4. 用量页（/account/billing/usage）是**同一路由下的另一页**，实机截图逐行誊录的
//      节点清单在下面的 USAGE_NODES：除了静态词条，它还要两个下拉（Group by / Timeframe）
//      与**短月份**账期（「Sep 1 - Sep 30, 2026」，与账单总览的长月份是两套写法）。
//
// 实机节点清单来源：账单总览是 popup 开发者模式导出的 github-zh-misses/1 JSON（导出时该页
// 路径还是 /settings/billing，迁移发生在采集之后）；用量页需登录、未进导出，按 2026-09 的实机截图誊录。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

/** /account/billing 命中的模块视图（pages/settings + pages/settings-billing + global） */
const view = buildView(
	"/account/billing",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/**
 * 导出的漏翻文本节点（原文逐字录入，不做 trim——引擎自己会归一空白）。
 * 顺序按页面上出现的先后排列，便于人工对照实机。
 */
const BILLING_NODES: readonly string[] = [
	// —— 页面外壳与账号行 ——
	"Billing Overview",
	"User navigation",
	"Manage subscriptions",
	// 卡片右上角入口（原导出里 count 21，当时的会话漏收，导致点开后整块英文）
	"More details",
	// —— 账期与金额 ——
	"Next payment due",
	"Current metered usage",
	"Current included usage",
	"Metered usage",
	"Included usage",
	"Billable usage",
	"Included usage limits reset in",
	"Gross amount",
	"Minus",
	"discounts",
	"consumed usage",
	"Total billable usage after subtracting discounts from consumed usage",
	"Total gross spend on Copilot for the selected timeframe including licenses and AI Credits.",
	"Manage budgets",
	"View details",
	// —— 时间范围下拉 ——
	"Current month",
	"Last month",
	"Last year (2025)",
	"This year (2026)",
	// —— 用量区块与产品选择器 ——
	"Usage by products",
	"Usage by repository",
	"Additional usage",
	"Top two repositories this month",
	"Products selector",
	"Products selector navigation",
	"Open repository usage options",
	"Copilot usage",
	"About Copilot AI credits",
	"About GitHub Models rate limits",
	"About GitHub Actions storage billing",
	"Models",
	"Spark AI credits",
	// —— 各产品的计费说明 ——
	"Billable spend for Git LFS for the selected timeframe. Applicable discounts cover included usage for Git LFS bandwidth and storage.",
	"Billable spend for Packages for the selected timeframe. Applicable discounts cover Packages usage in public repositories and included usage for Packages data transfer and storage.",
	"Billable spend for Sandbox for the selected timeframe.",
	"Billable spend for Actions and Actions Runners for the selected timeframe. Applicable discounts cover Actions usage in public repositories and included usage for Actions minutes and storage.",
	"Billable spend for Codespaces for the selected timeframe.",
	"Based on 0 additional AI credits beyond your included usage.",
	"Cost calculated based on 0 Spark AI credits that exceed the AI credits usage included with your Copilot licenses.",
	"Cost calculated based on additional 0 token units",
	// —— 用量明细行 ——
	"Actions minutes",
	"Actions storage",
	"Git LFS bandwidth",
	"Git LFS storage",
	"Packages data transfer",
	"Packages storage",
	// —— 含完整日期区间的说明句（实机里日期也可能被拆成独立节点，见下方规则用例）——
	"Gross metered usage for September 1 - September 30, 2026.",
	"Included usage discounts for September 1 - September 30, 2026.",
	"Gross metered usage for September 1 - September 29, 2026.",
	"Included usage discounts for September 1 - September 29, 2026.",
];

/**
 * 订阅卡片（SubscriptionsContainer → PlanCard）的实机文本节点。
 *
 * 边界是**实机 HTML 实证**（维护者 2026-09 从 /settings/billing 提供，节点原文逐字照抄）：
 *
 * ```html
 * <p class="PlanCard-module__cardHeading__UIO8J">GitHub Free</p>
 * <span class="PlanCard-module__perPeriod__G4_YG">per month</span>
 * ```
 *
 * 三条必须记住的事实：
 *   1.「per month」是**一个完整节点**（不是 per + month 两个节点，也不带首尾空白），
 *      故按短语收静态键；它原来由规则 settings/per-month（`^/month$`）覆盖，上游把后缀
 *      从「/month」改成文字形态后规则失配——这正是当时漏翻的根因；
 *   2. 同一张卡片上有两处「per month」（当前方案卡 + Copilot 卡），故下面按原文收两条；
 *   3.「GitHub Free」是方案名，与同模块「Copilot Free」→「Copilot 免费版」统一口径，
 *      改译「GitHub 免费版」（旧约定是保持英文，2026-09 起改为译出）。
 */
const PLAN_CARD_NODES: readonly string[] = [
	"GitHub Free",
	"per month",
	"per month",
];

describe("订阅卡片（PlanCard）的实机节点边界", () => {
	it("translates the plan name and the billing period suffix GitHub actually renders", () => {
		for (const node of PLAN_CARD_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(variant, view);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
		// 两处必须各自译成页面上的那个词，而不是「收录了但值不对」
		expect(translateText("per month", view)).toBe("每月");
		expect(translateText("GitHub Free", view)).toBe(
			"GitHub 免费版",
		);
	});

	it("keeps the bare words per / month as-is", () => {
		// 收的是整短语「per month」；单词形态仍不收录，避免误伤用量页的零散节点
		expect(translateText("per", view)).toBeNull();
		expect(translateText("month", view)).toBeNull();
	});
});

/**
 * 用户内容与纯专名 / 泛化短词：字面上含拉丁字母，会通过「可翻译判定」，
 * 但**必须**保持英文——收录它们要么让译文与键同形（自触发循环，门禁也会拒），
 * 要么把用户名 / 仓库名 / 产品名当成 UI 文案改坏。
 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"M. Oppenheymu",
	"(Oppenheymu)",
	"@Oppenheymu",
	"Oppenheymu",
	"GitHub",
	"OppenApps",
	"Github-i18n",
	"Koishi-CE",
	"Kuro-Bridge",
	"NapukettoDev",
	"TextCraft-War",
	"Copilot",
	"Spark",
	"Git LFS",
	"GitHub Models",
	"per",
	"month",
	"items",
	"usage",
];

/**
 * 账单页的功能卡片里的共享产品名。
 *
 * 「Packages」曾经靠 pages/repo 的**越界路由**（`^/[^/]+/[^/]+` 也命中 `/settings/**`）
 * 顺带生效；2026-09 修掉那个越界后，它已下沉登记进 pages/settings-billing 自己
 * （见 core/canonical.jsonc 该模块末尾的说明）。这里锁住「本页仍能译出同一个词」，
 * 防止后人误以为它又是别人提供的。
 */
const SHARED_PRODUCT_NAMES: readonly [string, string][] = [
	["Packages", "软件包"],
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

describe("账单页的实机节点边界", () => {
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

	it("keeps user content, product names and generic words as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("translates the shared product names registered in this module", () => {
		for (const [raw, expected] of SHARED_PRODUCT_NAMES) {
			expect(
				translateText(raw, view),
				`期望由 pages/settings-billing 提供译文：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("renders the metered usage blurb split around its date range", () => {
		// 实机边界（可能的一种形态）：说明句 + 日期区间各自成节点。
		// 区间规则以「, 年份」收尾，句点留给纯符号节点（翻不了，保持英文句点）——
		// 故拼接结果末尾是「日」而不是「日。」，与 GitHub 的英文句点衔接
		expect(
			renderNodes([
				"Gross metered usage for ",
				"September 1 - September 30, 2026",
				".",
			]),
		).toBe(
			"Gross metered usage for 2026 年 9 月 1 日 – 30 日.",
		);
		expect(
			renderNodes([
				"Included usage discounts for ",
				"September 1 - September 29, 2026",
				".",
			]),
		).toBe(
			"Included usage discounts for 2026 年 9 月 1 日 – 29 日.",
		);
		// 整句成节点时的形态（静态词条先命中，产物与规则一致）
		expect(
			translateText(
				"Gross metered usage for September 1 - September 30, 2026.",
				view,
			),
		).toBe(
			"2026 年 9 月 1 日 – 9 月 30 日的毛按量计费用量。",
		);
	});

	it("rewrites date ranges as a whole instead of partially", () => {
		// 关键回归：global 的 long-date-* 以 ^ 锚定但不以 $ 收尾，若本模块的区间规则
		// 排在它之后（或缺失），这里会产出「2026 年 9 月 1 日 - September 30, 2026」
		const sameMonth = translateText(
			"September 1 - September 30, 2026",
			view,
		);
		expect(sameMonth).toBe("2026 年 9 月 1 日 – 30 日");
		expect(sameMonth ?? "").not.toContain("September");
		// 跨月区间要写出两个月份
		const crossMonth = translateText(
			"September 15 - October 14, 2026",
			view,
		);
		expect(crossMonth).toBe(
			"2026 年 9 月 15 日 – 10 月 14 日",
		);
		expect(crossMonth ?? "").not.toContain("October");
		// 跨年（12 月 → 次年 1 月）也要成立
		expect(
			translateText("December 15 - January 14, 2026", view),
		).toBe("2026 年 12 月 15 日 – 1 月 14 日");
		// 带时刻的绝对日期仍由 global 规则接手（区间规则不得把它截断）
		expect(
			translateText("November 27, 2014 16:57", view),
		).toBe("2014 年 11 月 27 日 16:57");
	});

	it("translates the billing period suffix", () => {
		// 规则形态（`^/month$`）保留作旧形态兜底：2026-09 的实机证据显示订阅卡片
		// 已改用文字形态「per month」（由 PLAN_CARD_NODES 的静态键覆盖），这里的
		// `/month` 不再代表当下的实机渲染——若上游回退或别处仍用斜杠形态，它仍生效
		expect(translateText("/month", view)).toBe("每月");
		expect(translateText("/year", view)).toBe("每年");
		expect(translateText("/day", view)).toBe("每天");
	});

	it("keeps the quota summaries dynamic", () => {
		expect(
			translateText("0 GB used / 10 GB included", view),
		).toBe("已用 0 GB / 包含 10 GB");
		expect(
			translateText("2.4 GB used / 1 GB included", view),
		).toBe("已用 2.4 GB / 包含 1 GB");
		expect(
			translateText(
				"0 min used / 2,000 min included",
				view,
			),
		).toBe("已用 0 分钟 / 包含 2,000 分钟");
		// 单位不同的形态不命中（pattern 用 \\k<unit> 要求两处单位相同），保留英文
		expect(
			translateText("1 GB used / 500 MB included", view),
		).toBeNull();
	});

	it("rewrites the included AI credits sentence like the page does", () => {
		expect(
			translateText(
				"Based on 0 additional AI credits beyond your included usage.",
				view,
			),
		).toBe("基于超出所含用量的 0 个额外 AI 点数。");
		expect(
			translateText(
				"Cost calculated based on 0 Spark AI credits that exceed the AI credits usage included with your Copilot licenses.",
				view,
			),
		).toContain("Spark AI 点数");
	});
});

/**
 * 「More details」弹窗的实机文本节点。
 *
 * 这份清单的边界比页身弱一档：弹窗只在点开后才渲染，**没进开发者模式导出**，
 * 节点原文按截图逐行誊录（GitHub 的弹窗每行自成一个文本节点），未经 DevTools 复核。
 * 若实机出现漏翻，第一步是把弹窗里的节点原文抓下来，按此处格式替换。
 */
const PANEL_NODES: readonly string[] = [
	"More details",
	"Included usage and credits",
	"Showing currently applied usage and credits for your account.",
	"Current usage for Sep 1 - Sep 30, 2026. Monthly quota resets in 5 day(s).",
	"Included usage*",
	"2,000 included Actions minutes",
	"~$12.00 off*",
	".5 GB included Actions storage",
	"~$0.125 off*",
	"10 GB included Git LFS bandwidth",
	"~$0.875 off*",
	"10 GB included Git LFS storage",
	"~$0.70 off*",
	"1 GB included Packages data transfer",
	"~$0.50 off*",
	".5 GB included Packages storage",
	"~$0.125 off*",
	"Free usage**",
	"100% off per month",
	"15 GB included Codespaces storage",
	"~$1.05 off*",
	"120 included Codespaces core hours",
	"~$10.80 off*",
	"* Included usage is an approximate amount based on current pricing.",
];

describe("「More details」弹窗的实机节点边界", () => {
	it("translates every panel row", () => {
		for (const node of PANEL_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(variant, view);
				// 弹窗里每一行都含英文词，「翻不了」在实机上就等于整块漏翻
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("keeps the quota rows dynamic", () => {
		expect(
			translateText("2,000 included Actions minutes", view),
		).toBe("包含 2,000 分钟 Actions 用量");
		expect(
			translateText(
				"15 GB included Codespaces storage",
				view,
			),
		).toBe("包含 15 GB 代码空间存储");
		expect(
			translateText(
				"120 included Codespaces core hours",
				view,
			),
		).toBe("包含 120 个代码空间核心小时");
		// 数量变化不影响匹配
		expect(
			translateText("20 GB included Git LFS storage", view),
		).toBe("包含 20 GB Git LFS 存储");
	});

	it("translates the discount column", () => {
		expect(translateText("~$12.00 off*", view)).toBe(
			"约 12.00 抵扣",
		);
		expect(translateText("$0.125 off*", view)).toBe(
			"0.125 抵扣",
		);
		expect(translateText("~$10.80 off", view)).toBe(
			"约 10.80 抵扣",
		);
	});

	it("renders the panel footnote with its inline link", () => {
		// 实机节点原文（Console 实测）：**脚注标记在同一个文本节点里**
		// ——「** GitHub Packages usage is free for public packages. For details on free
		// Actions usage, see」是整串，故带标记的形态必须单独收键（引擎是整节点精确匹配）。
		// 链接后的句点是纯符号节点（翻不了，保持英文句点）
		expect(
			renderNodes([
				"** GitHub Packages usage is free for public packages. For details on free Actions usage, see ",
				"Free use of GitHub Actions",
				".",
			]),
		).toBe(
			"** 公共软件包的 GitHub Packages 用量免费。免费 Actions 用量的详情见 免费使用 GitHub Actions.",
		);
		// 标记若独立成节点（另一种渲染），不带标记的键顶上来
		expect(
			renderNodes([
				"GitHub Packages usage is free for public packages. For details on free Actions usage, see ",
				"Free use of GitHub Actions",
				".",
			]),
		).toBe(
			"公共软件包的 GitHub Packages 用量免费。免费 Actions 用量的详情见 免费使用 GitHub Actions.",
		);
		// 脚注首行的单星标记同理
		expect(
			translateText(
				"* Included usage is an approximate amount based on current pricing.",
				view,
			),
		).toBe("* 所含用量是按当前价格估算的近似金额。");
	});

	it("leaves bare amounts untouched", () => {
		for (const raw of ["$0.72", "$0", "$12.00"]) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});

/**
 * 用量页（/account/billing/usage）的实机文本节点。
 *
 * 这份清单的边界强度分两档：
 *   - **已实测**：说明句「Usage for Sep 1 - Sep 30, 2026. 」（span.UsageTable-module__hintText__）
 *     由维护者在实机 Console 取回原文，节点边界确定；
 *   - **按截图誊录**：其余行（标题、按钮、搜索框 placeholder、两个下拉、表头）取自 2026-09 的
 *     实机截图，每行假定为一个独立文本节点，未经 Console 复核。
 * 因此这里只断言「确实收录且译成中文」，不断言每个节点的确切边界；若实机出现漏翻，第一步是
 * 把用量页的漏翻 JSON（popup 开发者模式）或 Console 取的节点原文贴回来，按此处格式替换。
 */
const USAGE_NODES: readonly string[] = [
	// —— 页头与工具条 ——
	"Get usage report",
	"Search or filter usage",
	"Group by: None",
	"Timeframe: Current month",
	// —— 图表卡片（标题「按量计费用量」与副标题「Sep 1 - Sep 30, 2026」分别由
	//    静态词条「Metered usage」与 usage-range-same-month-* 规则覆盖，此处不重复列）——
	"Usage",
	// —— 用量明细区块 ——
	// 说明句在实机里是**一个整节点**（Console 实测，见下方 renderNodes 用例的注释）：
	// 「Usage for <区间>.」，故这里列的是整句而不是「Usage for」片段
	"Usage breakdown",
	"Usage for Sep 1 - Sep 30, 2026.",
	"For license-based products, the price/unit is a prorated portion of the monthly price.",
	"Date",
	"Gross amount",
	"Billed amount",
	// —— 「获取用量报告」弹窗（点按钮才渲染，键来自产品文案，尚未实机核对）——
	"Generate usage report",
	"Download a CSV or JSON report of your usage for the selected timeframe.",
	"Select the date range for your report.",
	"Report format",
	"Generate report",
	"The start date must be before the end date.",
];

/** 用量页命中的模块视图（pages/settings + pages/settings-billing + pages/repo + global） */
const usageView = buildView(
	"/account/billing/usage",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

describe("用量页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of USAGE_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(
					variant,
					usageView,
				);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("translates both dropdowns for every option they offer", () => {
		// 下拉「标签: 当前值」的候选值逐条由 core/rules.jsonc 覆盖（模板写死中文，
		// 因为引擎的替换模板不支持「捕获组 → 中文」的映射）
		for (const [raw, expected] of [
			["Group by: None", "分组方式：无"],
			["Group by: Repository", "分组方式：仓库"],
			["Group by: Product", "分组方式：产品"],
			["Timeframe: Current month", "时间范围：本月"],
			["Timeframe: Last month", "时间范围：上个月"],
			["Timeframe: Last 3 months", "时间范围：近 3 个月"],
			["Timeframe: Last 6 months", "时间范围：近 6 个月"],
			["Timeframe: Last 12 months", "时间范围：近 12 个月"],
		] as const) {
			expect(
				translateText(raw, usageView),
				`下拉值未覆盖：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
		// 未列出的值（上游新增候选）原样保留，不得被规则截断成半句中文
		expect(
			translateText("Timeframe: Last 24 months", usageView),
		).toBeNull();
	});

	it("translates the usage breakdown table and its dates", () => {
		expect(
			translateText("Usage breakdown", usageView),
		).toBe("用量明细");
		expect(translateText("Billed amount", usageView)).toBe(
			"计费金额",
		);
		// 明细行的日期由 global 的短日期规则覆盖（Sep 1, 2026 → 2026 年 9 月 1 日）
		expect(translateText("Sep 1, 2026", usageView)).toBe(
			"2026 年 9 月 1 日",
		);
		// 图表卡片的副标题：短月份账期，由本模块的 usage-range-short-same-month-* 覆盖
		// （同月只写一次月份，与长月份那组同一形态）
		expect(
			translateText("Sep 1 - Sep 30, 2026", usageView),
		).toBe("2026 年 9 月 1 日 – 30 日");
		// 跨月的短月份区间暂无实证、未收规则：必须**原样保留**（不得被 global 的短日期
		// 规则做部分替换而产出「2026 年 9 月 1 日 - Oct 1, 2026」这类残句）
		expect(
			translateText("Sep 1 - Oct 1, 2026", usageView),
		).toBeNull();
		// 表格里的金额节点（纯符号 + 数字）保持原样——它们本来就翻不了，也不该翻
		for (const raw of ["$0", "<$0.01", "$1"]) {
			expect(
				translateText(raw, usageView),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders the usage breakdown blurb as GitHub actually renders it", () => {
		// 实机原文（Console 实测，用户提供）：
		//   "Usage for Sep 1 - Sep 30, 2026. " | SPAN UsageTable-module__hintText__BIrRL
		// 关键：说明句与账期区间**在同一个文本节点里**，所以静态键「Usage for」与只匹配
		// 裸区间的 usage-range-short-* 都套不上，必须由 settings/usage-hint-same-month-*
		// 整句覆盖；句点在节点内，模板自带「。」，尾随空格由 walker 保留。
		expect(
			renderNodes([
				"Usage for Sep 1 - Sep 30, 2026. ",
				"For license-based products, the price/unit is a prorated portion of the monthly price.",
			]),
		).toBe(
			"用量统计：2026 年 9 月 1 日 – 30 日。 对于基于许可证的产品，单价是按月价格折算后的部分金额。",
		);
		// 不带尾随空格的形态（另一个渲染分支）同样命中，且句号不会丢
		expect(
			translateText(
				"Usage for Sep 1 - Sep 30, 2026.",
				usageView,
			),
		).toBe("用量统计：2026 年 9 月 1 日 – 30 日。");
		// 其它月份也要命中有句点的整句形态
		expect(
			translateText(
				"Usage for Oct 1 - Oct 31, 2026.",
				usageView,
			),
		).toBe("用量统计：2026 年 10 月 1 日 – 31 日。");
		// 「Usage for」被上游拆成独立节点的渲染分支：静态键兜底（收着不亏）
		expect(translateText("Usage for", usageView)).toBe(
			"用量统计：",
		);
		// 跨月区间仍是未收形态：必须原样保留，不得被区间规则截成半句
		expect(
			translateText(
				"Usage for Sep 1 - Oct 1, 2026.",
				usageView,
			),
		).toBeNull();
	});

	it("keeps the Cancel button on the global dictionary", () => {
		// 弹窗的「Cancel」不在本模块登记，靠 global 词条生效——重复登记会制造同键异译
		expect(translateText("Cancel", usageView)).toBe("取消");
	});
});

/**
 * AI 用量页（/account/billing/ai_usage）的实机文本节点。
 *
 * 边界强度与上面的 USAGE_NODES 同档：该页同样由 ^/(?:settings|account)/billing 覆盖，页面需登录、
 * **未进开发者模式导出**，节点原文按 2026-09 的实机截图逐行誊录，每行假定为一个独立文本节点
 * （表格两行表头的「英文列名 / 另一种写法」在截图里各自成列，故按两个节点收录）。
 * 若实机出现漏翻，第一步是把该页的漏翻 JSON（popup 开发者模式）或 Console 取的节点原文
 * 贴回来，按此处格式替换。
 */
const AI_USAGE_NODES: readonly string[] = [
	// 页面标题来自 pages/settings 的同一键（模块更靠前），本模块不重复登记
	"AI usage",
	// 图表分组切换器（截图里 Days 为选中态；Models 沿用本模块既有的「模型」词条）
	"Models",
	"Days",
	// 账期选择器（未展开时「月份 年份」，由 settings/month-year-* 规则覆盖）
	"Sep 2026",
	// 额外用量限额卡片
	"Extra usage",
	"Not enabled",
	"If enabled, your enterprise will be billed for additional AI credits usage after your included credits have been exhausted.",
	// 图表空状态
	"No usage",
	// 模型用量表的英文列名（第二行的「所含用量」「额外用量」由既有词条译出）
	"Model",
	"Included credits",
	"Additional credits",
	// 表脚注
	"Each GitHub AI credit costs $0.01.",
];

/** AI 用量页命中的模块视图（与用量页同一组模块：settings + settings-billing + repo + global） */
const aiUsageView = buildView(
	"/account/billing/ai_usage",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

describe("AI 用量页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of AI_USAGE_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(
					variant,
					aiUsageView,
				);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("translates the account-period selector for every month", () => {
		// 账期选择器未展开时是「月份缩写 年份」，逐月由 settings/month-year-* 覆盖
		// （模板写死中文月份，理由同上面的账期区间：模板不支持捕获组 → 中文的映射）
		for (const [raw, expected] of [
			["Jan 2026", "2026 年 1 月"],
			["May 2026", "2026 年 5 月"],
			["Sep 2026", "2026 年 9 月"],
			["Dec 2026", "2026 年 12 月"],
			// 跨年同样只换年份
			["Sep 2025", "2025 年 9 月"],
		] as const) {
			expect(
				translateText(raw, aiUsageView),
				`账期未覆盖：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
		// 未收的形态必须**原样保留**，不得被规则截成半句中文：
		// 长月份（"September 2026"）与非法月份（"Foo 2026"）都不在规则里
		for (const raw of ["September 2026", "Foo 2026"]) {
			expect(
				translateText(raw, aiUsageView),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("keeps the AI credit price in the footnote dynamic", () => {
		// 单价随定价变化：静态词条只覆盖截图里的 $0.01，其余金额靠规则补上
		expect(
			translateText(
				"Each GitHub AI credit costs $0.02.",
				aiUsageView,
			),
		).toBe("每个 GitHub AI 点数费用为 $0.02。");
		// 规则以英文锚定，替换产物（已含中文）不会再命中任何规则
		expect(
			translateText(
				"每个 GitHub AI 点数费用为 $0.02。",
				aiUsageView,
			),
		).toBeNull();
	});

	it("keeps the table headers bilingual row as separate nodes", () => {
		// 截图边界：英文列名与第二行写法分属两列（各自成节点），
		// 故「Included credits」这类单节点键必须在词典里；
		// 若实机把两者渲染进**同一个**文本节点（"Included credits 所含用量"），
		// 该节点含非拉丁字母，引擎按设计整节点跳过——这是节点边界问题，不是缺词条
		expect(translateText("Model", aiUsageView)).toBe(
			"模型",
		);
		expect(
			translateText("Included credits", aiUsageView),
		).toBe("所含点数");
		expect(
			translateText("Additional credits", aiUsageView),
		).toBe("额外点数");
	});
});

/**
 * 预算与提醒页（/account/billing/budgets）的实机文本节点。
 *
 * 边界强度与 AI 用量页同档：路由同上（^/(?:settings|account)/billing），页面需登录、
 * **未进开发者模式导出**，节点原文按 2026-09 的实机截图逐行誊录。截图里
 * 「账户」「代码空间」「软件包」「Actions 工作流」「预算与提醒（标题）」已经由既有词条译出，
 * 故这里只收当时仍是英文的那些节点。
 */
const BUDGETS_NODES: readonly string[] = [
	// 页面标题「Budgets and alerts」与表格里的「Account」「Name」由既有词条覆盖，不在此列
	"New budget",
	"Included usage alerts",
	"Budgets let you set monthly usage limits for specific GitHub products or SKUs. If no budget is set, usage for that product is unlimited.",
	"Learn more",
	// 表格列名（SKU 按门禁不收录，保持原文）
	"Name",
	"Account",
	"Product",
	"Stop usage",
	"budget",
	// 预算行
	"Yes",
	"Codespaces",
	"Packages",
	"Actions",
	// 标题行计数与预算行金额是动态文本，节点原文长这样
	"5 Account budgets",
	"$0 spent",
	"$0 budget",
];

/** 预算页命中的模块视图（与账单页同一组模块） */
const budgetsView = buildView(
	"/account/billing/budgets",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

describe("预算与提醒页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of BUDGETS_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(
					variant,
					budgetsView,
				);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("keeps the generic English words the page would otherwise mangle", () => {
		// 「SKU」是缩写、中文界面沿用原文：收录它必然让译文与键同形（门禁也拒），
		// 正确做法是不收录——这里反向断言，防止后人「补」成死键或造出翻译循环
		expect(translateText("SKU", budgetsView)).toBeNull();
		// 预算归属是用户内容，必须原样保留
		for (const raw of ["Oppenheymu", "@Oppenheymu"]) {
			expect(
				translateText(raw, budgetsView),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("translates the budget count and amounts dynamically", () => {
		// 标题行「N Account budgets」：数字随条数变化，单复数都要命中
		expect(
			translateText("5 Account budgets", budgetsView),
		).toBe("5 条账户预算");
		expect(
			translateText("1 Account budget", budgetsView),
		).toBe("1 条账户预算");
		// 金额形态：美元符号由捕获组带出，模板不另写 $（见 core/rules.jsonc 的说明）
		expect(translateText("$0 spent", budgetsView)).toBe(
			"已支出 $0",
		);
		expect(translateText("$12.50 spent", budgetsView)).toBe(
			"已支出 $12.50",
		);
		expect(translateText("$100 budget", budgetsView)).toBe(
			"$100 预算",
		);
		// 非金额形态必须原样保留，不得被规则截成半句中文
		expect(
			translateText("0 spent", budgetsView),
		).toBeNull();
	});

	it("reuses the settings modules' labels instead of duplicating them", () => {
		// 标题、账户 / 名称列名与产品名来自更靠前的模块：跨模块复用正是不重复登记的理由。
		// 「Name」在本路由由 pages/settings 胜出（「姓名」），不是仓库页的「名称」——
		// 这正是视图骨架里「赢家覆盖」锁住的那类事实。
		// 「Packages」原先靠 pages/repo 越界顺带生效，2026-09 起已登记在本模块（见上）
		const expectations: readonly [string, string][] = [
			["Budgets and alerts", "预算与提醒"],
			["Account", "账户"],
			["Name", "姓名"],
			["Codespaces", "代码空间"],
			["Packages", "软件包"],
		];
		for (const [raw, expected] of expectations) {
			expect(
				translateText(raw, budgetsView),
				`期望复用既有译文：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});
});

/**
 * 许可页（/account/billing/licensing）的实机文本节点。
 *
 * 边界强度与其它账单子页同档：路由同上（^/(?:settings|account)/billing），页面需登录、
 * **未进开发者模式导出**，节点原文按 2026-09 的实机截图逐行誊录。
 * 截图里「许可（标题）」「GitHub Copilot」「Community support」「Web-based support」
 * 「Code owners」「Required reviewers」「Multiple reviewers in pull requests」
 * 「Protected branches」已由既有词条译出，故这里只收当时仍是英文的那些节点。
 */
const LICENSING_NODES: readonly string[] = [
	"Upgrade Individual Plan",
	"Upgrade to Business",
	"Your AI pair programmer",
	"Active subscription",
	"Copilot Free",
	"You can upgrade to Copilot Pro at any time. Check out this",
	// 实机 HTML 实测：说明句是「…Check out this 」「documentation」「 for more details.」三段
	// 链接节点「documentation」刻意不收录（译文必然与键同形），故只收首尾两段
	"for more details.",
	"Current GitHub base plan",
	"Compare base plans",
	"Upgrade to GitHub Pro",
	"The basics for all developers",
	"Unlimited public/private repos",
	"Unlimited collaborators",
	"2,000 Actions minutes/month",
	"500MB of Packages storage",
	"120 core-hours of Codespaces compute per developer",
	"15GB of Codespaces storage per developer",
	"Community support",
	// 实机里这串是每行删除图标的 alt="Not included"（不是清单小标题）
	"Not included",
	"Free Codespaces usage per organization",
	"Increase Codespaces",
	"spend limits",
	"Protected branches on all repos",
	"Pages for static website hosting",
	"See all features and compare plans",
];

/** 许可页命中的模块视图（与其它账单子页同一组模块） */
const licensingView = buildView(
	"/account/billing/licensing",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

describe("许可页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of LICENSING_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(
					variant,
					licensingView,
				);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("keeps the product names and the docs link as-is", () => {
		// 纯专名与域名式链接词条不收录：收录只会让译文与键同形（门禁也拒）。
		//「GitHub Free」是唯一的例外——它是方案名，2026-09 起与「Copilot 免费版」
		// 统一口径改译「GitHub 免费版」（见 PLAN_CARD_NODES），故不在下面这张表里
		for (const raw of [
			"GitHub Copilot",
			"GitHub",
			"Copilot",
			"documentation",
		]) {
			expect(
				translateText(raw, licensingView),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
		// 本页的基础方案标题同样译出（与计费卡同一个键、同一个模块）
		expect(
			translateText("GitHub Free", licensingView),
		).toBe("GitHub 免费版");
	});

	it("rewrites the plan quota lines with their numbers", () => {
		// 四条配额清单：数值与单位原样保留，英文结构换成中文语序
		expect(
			translateText(
				"2,000 Actions minutes/month",
				licensingView,
			),
		).toBe("2,000 分钟 Actions/月");
		expect(
			translateText(
				"500MB of Packages storage",
				licensingView,
			),
		).toBe("500MB Packages 存储");
		expect(
			translateText(
				"120 core-hours of Codespaces compute per developer",
				licensingView,
			),
		).toBe("每位开发者 120 个代码空间核心小时");
		expect(
			translateText(
				"15GB of Codespaces storage per developer",
				licensingView,
			),
		).toBe("每位开发者 15GB 代码空间存储");
		// 数量变化不影响匹配
		expect(
			translateText(
				"3,000 Actions minutes/month",
				licensingView,
			),
		).toBe("3,000 分钟 Actions/月");
		// 缺「of」「per developer」等结构的形态不命中，保留原文而不是截成半句
		expect(
			translateText(
				"500MB Packages storage",
				licensingView,
			),
		).toBeNull();
		expect(
			translateText(
				"120 core-hours of compute",
				licensingView,
			),
		).toBeNull();
	});

	it("reuses the settings module for the page title", () => {
		// 页面标题由 pages/settings 提供（模块更靠前），本模块不重复登记
		expect(translateText("Licensing", licensingView)).toBe(
			"许可",
		);
	});

	it("renders the upgrade blurb around its docs link", () => {
		// 实机 HTML 的节点边界：说明句 + 链接 + 尾句三段，链接文本保持英文
		expect(
			renderNodes([
				"You can upgrade to Copilot Pro at any time. Check out this ",
				"documentation",
				" for more details.",
			]),
		).toBe(
			"你可以随时升级到 Copilot Pro。详情请查阅 documentation 了解更多详情。",
		);
	});
});

/**
 * 付款信息页（/account/billing/payment_information）的实机文本节点。
 *
 * 节点边界分两档：
 *   - **实机 HTML 实证**（用户提供）：地址 / 地址第二行 / 邮编三个标签被 `.text-normal`
 *     拆成「主标签 + 括号说明」两个节点，故此处按拆分形态列，不列整行键；
 *   - 其余行按 2026-09 的实机截图誊录。
 * 该页同样由 ^/(?:settings|account)/billing 覆盖，故词条归 pages/settings-billing 模块；
 * 页面标题「Payment information」由 pages/settings 提供（模块更靠前），不在此重复登记。
 *
 * 刻意不收录的内容：
 *   - 国家/地区下拉**展开后的选项名**（几百个国家名）：它们是随表单提交的值，
 *     改显示文案会坏功能，且必然撞用户内容；
 *   - 必填星号「*」：纯符号节点，可翻译判定就过不了（也不该翻）。
 */
const PAYMENT_NODES: readonly string[] = [
	"Billing information",
	"Add your information to show on every invoice",
	"First name",
	"Last name",
	// 实机 HTML：`Address <span class="text-normal">(Street, P.O. box)</span>`
	"Address",
	"(Street, P.O. box)",
	"Address line 2",
	"(Apartment, suite, unit)",
	"City",
	"Country/Region",
	"Choose your country/region",
	"State/Province",
	"Postal/Zip code",
	"(9-digit zip code for US)",
	"Required for certain countries",
	"VAT/GST ID",
	"Save billing information",
	"Coupon",
	"Redeem a coupon",
	"You don't have an active coupon.",
	// `<h3 class="f4 d-inline">` 标题 + 问号图标的 tool-tip（sr-only，悬浮可见）
	"Additional information",
	"Add specific contact or tax information to your receipts, like your full business name, VAT/GST identification number, or address of record here. We’ll make sure it shows up on every receipt.",
	"Add information",
	"No additional information added to your receipts.",
];

/** 付款信息页命中的模块视图（与其它账单子页同一组模块） */
const paymentView = buildView(
	"/account/billing/payment_information",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

describe("付款信息页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of PAYMENT_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(
					variant,
					paymentView,
				);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("keeps the required-field asterisks and inert text as-is", () => {
		// 必填星号是纯符号节点：可翻译判定要求含拉丁字母，故翻不了；也不该翻
		for (const raw of ["*", "ID", "US"]) {
			expect(
				translateText(raw, paymentView),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("leaves the country/region options untranslated", () => {
		// 下拉选项名是表单值：翻了会改坏提交内容（这是**有意漏翻**，不是缺词条）
		for (const raw of [
			"China",
			"United States of America",
			"Hong Kong SAR China",
		]) {
			expect(
				translateText(raw, paymentView),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders the required-field label and the asterisk in order", () => {
		// 实机渲染：标签节点 + 星号节点（星号保持原样，标签译出）
		expect(renderNodes(["First name", " ", "*"])).toBe(
			"名 *",
		);
	});

	it("renders the split labels around their text-normal spans", () => {
		// 实机 HTML，逐字对应本轮修的三处边界（整行键在实机上永不命中）
		expect(
			renderNodes(["Address", " ", "(Street, P.O. box)"]),
		).toBe("地址 （街道、邮政信箱）");
		expect(
			renderNodes([
				"Address line 2",
				"  ",
				"(Apartment, suite, unit)",
			]),
		).toBe("地址第二行  （公寓、套房、单元）");
		expect(
			renderNodes([
				"Postal/Zip code",
				" ",
				"(9-digit zip code for US)",
			]),
		).toBe("邮政编码 （美国为 9 位 ZIP 码）");
		// 整行形态**必须原样保留**：它不是实机形态，收了只会是死键
		expect(
			translateText(
				"Address (Street, P.O. box)",
				paymentView,
			),
		).toBeNull();
		// 截图里的小写形态「Postal/zip code」同理（实机是大写 Z）
		expect(
			translateText("Postal/zip code", paymentView),
		).toBeNull();
	});

	it("translates the additional-information heading and its tooltip", () => {
		// 标题是独立节点；tooltip 在 <tool-tip class="sr-only"> 里，按既定边界照常翻译
		expect(
			translateText("Additional information", paymentView),
		).toBe("附加信息");
		expect(
			translateText(
				"Add specific contact or tax information to your receipts, like your full business name, VAT/GST identification number, or address of record here. We’ll make sure it shows up on every receipt.",
				paymentView,
			),
		).toContain("收据");
	});

	it("reuses the settings module for the page title", () => {
		expect(
			translateText("Payment information", paymentView),
		).toBe("付款信息");
	});
});

/**
 * 付款历史页（/account/billing/history）的空态。
 *
 * 实机 HTML（维护者提供，2026-09）：
 *   <h2 data-view-component="true" class="blankslate-heading">        You have not made any payments.
 *   <p class="note">Amounts shown in USD</p>
 * 两条键都归 pages/settings-billing（与该页同一路由），故默认的账单总览视图 view 就能代表它。
 */
const HISTORY_NODES: readonly string[] = [
	"You have not made any payments.",
	"Amounts shown in USD",
];

describe("付款历史页（/account/billing/history）的空态", () => {
	it("translates every empty-state node", () => {
		for (const node of HISTORY_NODES) {
			const translated = translateText(node, view);
			expect(
				translated,
				`未命中：${JSON.stringify(node)}`,
			).not.toBeNull();
			expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
		}
	});

	it("keeps the heading whitespace when the node is replaced", () => {
		// 实机 h2 的文本节点是「8 个空格 + 整句 + 行尾缩进」：替换必须原样保留首尾空白，
		// 否则标题排版会塌；这条同时钉住「键按归一后的形态收」这个前提
		expect(
			renderNodes([
				"        You have not made any payments.\n",
			]),
		).toBe("        你尚未进行任何付款。\n");
		expect(
			translateText("Amounts shown in USD", view),
		).toBe("金额以美元显示");
	});
});

/**
 * 赞助订阅页（/settings/billing/subscriptions）的实机文本节点。
 *
 * 边界强度：**实机 HTML 实证**（维护者 2026-09 提供，逐字照抄节点原文）+ 截图补充。
 * 该页仍在 /settings/billing/** 这一支（实测 302 存活），与 /account/billing/** 由同一条
 * 路由覆盖，故用默认视图即可。
 *
 * 实证到的三条边界事实（都写进了下面的用例）：
 *   1. 组织数那句是 `<div class="tmp-mb-4">` 的**首个文本节点**，带源码缩进与换行——
 *      归一空白后是单行整句，规则两端 ^…$ 锚定成立；
 *   2. `Manage your organizations` 在 `<summary>` 里带缩进，在
 *      `<span class="SelectMenu-title">` 里是裸文本，两种形态都必须命中；
 *   3. 空态那句是 `"You're currently not sponsoring anyone. "`（**直撇号 + 尾随空格**），
 *      紧随其后的 `<a>` 链接文字 `Learn more about GitHub Sponsors` 是另一个节点。
 */
const SUBSCRIPTION_NODES: readonly string[] = [
	"Sponsorships",
	"Manage your organizations",
	"Connect with the community that builds the tools you use",
	"Start sponsoring",
	"Learn more about GitHub Sponsors",
];

describe("赞助订阅页（/settings/billing/subscriptions）", () => {
	it("matches the real node boundaries taken from the live HTML", () => {
		// 逐字照抄实机 HTML 的文本节点（含 \n 与源码缩进）
		expect(
			translateText(
				"\n    In addition to your personal account, you manage 5 organizations.\n    ",
				view,
			),
		).toBe("除个人账户外，你还管理 5 个组织。");
		expect(
			translateText(
				"\n        Manage your organizations\n        ",
				view,
			),
		).toBe("管理你的组织");
		expect(
			translateText("Manage your organizations", view),
		).toBe("管理你的组织");
		expect(
			translateText(
				"\n              Connect with the community that builds the tools you use\n            ",
				view,
			),
		).toBe("与构建你所使用工具的社区建立联系");
		// 空态：直撇号 + 尾随空格（链接文字是紧随其后的另一个节点）
		expect(
			translateText(
				"\n            You're currently not sponsoring anyone. ",
				view,
			),
		).toBe("你目前没有赞助任何人。");
		expect(
			translateText(
				"Learn more about GitHub Sponsors",
				view,
			),
		).toBe("详细了解 GitHub Sponsors");
	});

	it("leaves the pure product name alone", () => {
		// `<div>GitHub Sponsors</div>` 是纯专名：不收录、保留英文即正确做法
		//（收录成同形译文会触发自我循环，词典门禁也直接拒）
		expect(
			translateText("GitHub Sponsors", view),
		).toBeNull();
	});

	it("translates every node the screenshot shows", () => {
		for (const node of SUBSCRIPTION_NODES) {
			const translated = translateText(node, view);
			expect(
				translated,
				`未命中：${JSON.stringify(node)}`,
			).not.toBeNull();
			expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
		}
	});

	it("translates the organizations line through a rule", () => {
		// 组织数随账号变化，只能做规则（两端 ^…$ 锚定，不做部分替换）
		expect(
			translateText(
				"In addition to your personal account, you manage 5 organizations.",
				view,
			),
		).toBe("除个人账户外，你还管理 5 个组织。");
		expect(
			translateText(
				"In addition to your personal account, you manage 1 organization.",
				view,
			),
		).toBe("除个人账户外，你还管理 1 个组织。");
	});

	it("covers both apostrophe shapes in the sponsoring empty state", () => {
		// 截图无法判定撇号是直是弯：两种形态必须命中同一条规则，
		// 且模板里不含撇号（不可能产出中英混杂的残句）
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
	});
});
