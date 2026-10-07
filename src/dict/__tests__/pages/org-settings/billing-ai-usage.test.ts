// 组织路由下的 AI 用量页（/organizations/<组织>/settings/billing/ai_usage）实机文本回归。
//
// 证据与强度：2026-10-07 维护者贴出的**整页 outerHTML**（`<react-app app-name="billing-app">`
// 里的 AIUsagePage 组件族；采集时扩展仍在运行，故已是中文的节点是扩展产物、仍是英文的才是待补清单）。
//
// 这一页是同一套 billing-app 组件在**新版**渲染下的样子（AIUsagePage / UsageFilters /
// AIUsageSummaryCard），比 2026-09 那张截图多出汇总卡、图表空态标题与「搜索或筛选用量」工具条；
// 本文件锁四件事：
//   ① 该路径必须命中 pages/settings-billing + pages/org-settings + global，账单模块在前
//      （逐键先到先得），且**不得**命中 pages/settings（它的路由 ^/(?:settings|account/billing)
//      要求路径以 /settings 或 /account/billing 开头，组织路由不满足）；
//   ② 同一页在两条路由（组织 / 个人）上的渲染结果必须**逐字一致**：词条在两条路由上分别由
//      pages/org-settings 与 pages/settings 兜底，任何一侧改词都会在这里立刻红；
//   ③ 动态文本的切分：额度条的「/ N AI credits」与说明句的「N days on <日期>」无法从 outerHTML
//      看出节点边界，两种 / 五种切分都锁住（日期由 GitHub 按浏览器语言在客户端格式化，实机已是
//      「2026年11月1日」——这正是「混合节点照常进规则」的实例：引擎只拦整段非拉丁的节点）；
//   ④ 有意不收录的：纯数字 / 纯符号节点（`0`、`.`）、金额（`$0.00`）、整段中文的日期节点，
//      以及 `aria-valuetext="0 of 0 AI credits used"`（该属性不在引擎的六个可翻译属性里，
//      属性值也不应用正则规则，故动态内容结构上翻不了——不是缺词条）。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const ORG_PATH =
	"/organizations/Koishi-CE/settings/billing/ai_usage";
const PERSONAL_PATH = "/account/billing/ai_usage";

const locale = dictForLocale("zh-CN");
const aliases = new Map(Object.entries(dictCore.aliases));

/**
 * 两条路由各自的模块视图。同一页的文案必须逐字一致，故下面所有断言都同时跑两份：
 * 组织路由少了 pages/settings 这一层（它不命中 /organizations/**），相关词条由
 * pages/org-settings 兜底——措辞一旦分家，这里就会报出来。
 */
const VIEWS = [
	{
		label: "组织路由",
		view: buildView(ORG_PATH, locale, aliases),
	},
	{
		label: "个人路由",
		view: buildView(PERSONAL_PATH, locale, aliases),
	},
] as const;

/** 实机 HTML 里仍是英文的文本节点（逐条誊录，顺序即页面顺序） */
const AI_USAGE_NODES: readonly string[] = [
	// —— 页头与筛选工具条 ——
	"Get usage report",
	"Search or filter usage (chart updates as you type)",
	"Clear Search or filter usage (chart updates as you type)",
	"Filter by user or model",
	"Suggestions",
	"Group by: Models",
	"Timeframe: Current month",
	// —— 汇总卡 ——
	"Included credits",
	"/ 0 AI credits",
	"Included AI credits progress",
	"Included AI credits consumed by users in your account. Monthly limit resets in 25 days on 2026年11月1日.",
	"Additional usage",
	"Edit budget",
	"Spend on additional AI credits exceeding your included credits.",
	// —— 图表 ——
	"No usage data found for the selected filters.",
	"Usage grouped by models",
	"No usage found",
];

/** 必须保持英文：纯数字 / 纯符号 / 金额 / 整段中文（守卫按设计跳过） */
const MUST_STAY_ENGLISH: readonly string[] = [
	"0",
	"25",
	"$0.00",
	".",
	"2026年11月1日",
	"AI",
	"GitHub",
	// aria-valuetext 不在六个可翻译属性里，且属性值不应用规则——动态值结构上翻不了
	"0 of 0 AI credits used",
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
function renderNodes(
	nodes: readonly string[],
	view: (typeof VIEWS)[number]["view"],
): string {
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

describe("组织路由下 AI 用量页的模块路由", () => {
	it("loads the billing module ahead of the org-settings shell", () => {
		const names = matchModules(
			ORG_PATH,
			locale.modules,
		).map((module) => module.name);
		expect(names).toContain("pages/settings-billing");
		expect(names).toContain("pages/org-settings");
		expect(
			names.indexOf("pages/settings-billing"),
		).toBeLessThan(names.indexOf("pages/org-settings"));
	});

	it("does not pull in the personal settings module", () => {
		// pages/settings 的路由是 ^/(?:settings|account/billing)：组织路径不满足
		const names = matchModules(
			ORG_PATH,
			locale.modules,
		).map((module) => module.name);
		expect(names).not.toContain("pages/settings");
	});

	it("keeps the personal AI usage page on the billing module", () => {
		expect(
			matchModules(PERSONAL_PATH, locale.modules).map(
				(module) => module.name,
			),
		).toContain("pages/settings-billing");
	});

	it("does not leak the billing module into other org settings pages", () => {
		const names = matchModules(
			"/organizations/Koishi-CE/settings/profile",
			locale.modules,
		).map((module) => module.name);
		expect(names).not.toContain("pages/settings-billing");
	});
});

describe("组织路由下 AI 用量页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const { label, view } of VIEWS) {
			for (const node of AI_USAGE_NODES) {
				for (const variant of withWhitespace(node)) {
					const translated = translateText(variant, view);
					expect(
						translated,
						`${label}未命中：${JSON.stringify(variant)}`,
					).not.toBeNull();
					expect(translated ?? "").toMatch(
						/[\u4e00-\u9fff]/,
					);
				}
			}
		}
	});

	it("renders the same wording on both routes", () => {
		// 组织路由没有 pages/settings 这一层：词条由 pages/org-settings 兜底，
		// 两边一旦分家（改了其中一份译文）本用例立刻红
		const [org, personal] = VIEWS;
		for (const node of AI_USAGE_NODES) {
			expect(
				translateText(node, org.view),
				`两路译文不一致：${JSON.stringify(node)}`,
			).toBe(translateText(node, personal.view));
		}
	});

	it("translates the placeholder and the accessible names", () => {
		for (const { label, view } of VIEWS) {
			expect(
				translateText("Filter by user or model", view),
				`${label}：搜索框 placeholder`,
			).toBe("按用户或模型筛选");
			expect(
				translateText("Included AI credits progress", view),
				`${label}：额度进度条 aria-label`,
			).toBe("所含 AI 点数进度");
			expect(
				translateText("Suggestions", view),
				`${label}：联想列表 aria-label`,
			).toBe("建议");
		}
	});

	it("keeps numbers, amounts and already-Chinese nodes as-is", () => {
		for (const { label, view } of VIEWS) {
			for (const raw of MUST_STAY_ENGLISH) {
				expect(
					translateText(raw, view),
					`${label}不应被翻译：${JSON.stringify(raw)}`,
				).toBeNull();
			}
		}
	});
});

describe("组织路由下 AI 用量页的动态文案", () => {
	it("renders the credits entitlement in both splits", () => {
		// ① 整句一个节点（实机 HTML 就是这个形态）
		for (const { label, view } of VIEWS) {
			expect(
				translateText("/ 0 AI credits", view),
				`${label}：额度条整句`,
			).toBe("/ 共 0 个 AI 点数");
		}
		// ② 「/ 」被切成纯符号节点（翻不了，按设计留下）+ 裸计数节点
		for (const { label, view } of VIEWS) {
			expect(
				renderNodes(["/ ", "2,000 AI credits"], view),
				`${label}：额度条碎片`,
			).toBe("/ 共 2,000 个 AI 点数");
		}
	});

	it("rewrites the included-credits sentence as a whole node", () => {
		for (const { label, view } of VIEWS) {
			expect(
				translateText(
					"Included AI credits consumed by users in your account. Monthly limit resets in 25 days on 2026年11月1日.",
					view,
				),
				`${label}：说明句整句`,
			).toBe(
				"你的账户中用户已消耗的所含 AI 点数。每月限额将在 25 天后于 2026年11月1日 重置。",
			);
		}
	});

	it("keeps the sentence English when the date is still English", () => {
		// 英文日期留在整句里会产出中英残句，故整句形态只认中文日期；宁可整句保留英文
		for (const { label, view } of VIEWS) {
			for (const raw of [
				"Included AI credits consumed by users in your account. Monthly limit resets in 25 days on November 1, 2026.",
				"Monthly limit resets in 25 days on November 1, 2026.",
			]) {
				expect(
					translateText(raw, view),
					`${label}不应被翻译：${JSON.stringify(raw)}`,
				).toBeNull();
			}
		}
	});

	it("covers the finer splits of the sentence", () => {
		const [org] = VIEWS;
		// 第二句自己成节点（第一句走静态词条）
		expect(
			renderNodes(
				[
					"Included AI credits consumed by users in your account.",
					" Monthly limit resets in 25 days on 2026年11月1日.",
				],
				org.view,
			),
		).toBe(
			"你的账户中用户已消耗的所含 AI 点数。 每月限额将在 25 天后于 2026年11月1日 重置。",
		);
		// 前缀 + 数字 + 「days on」碎片 + 日期节点 + 句点节点：数字与句点是纯数字 / 纯符号，
		// 按设计原样留下；日期节点由 global 的 long-date-* 译出
		expect(
			renderNodes(
				[
					"Included AI credits consumed by users in your account. Monthly limit resets in ",
					"25",
					" days on ",
					"November 1, 2026",
					".",
				],
				org.view,
			),
		).toBe(
			"你的账户中用户已消耗的所含 AI 点数。每月限额将在 25 天后于 2026 年 11 月 1 日.",
		);
		// 第二句的前半 + 数字节点 + 「days on」碎片 + 日期节点
		expect(
			renderNodes(
				[
					"Monthly limit resets in ",
					"25",
					" days on ",
					"2026年11月1日",
					".",
				],
				org.view,
			),
		).toBe("每月限额将在 25 天后于 2026年11月1日.");
	});

	it("translates the group-by selector and the chart title for both values", () => {
		for (const { label, view } of VIEWS) {
			expect(
				translateText("Group by: Models", view),
				`${label}：分组切换器`,
			).toBe("分组方式：模型");
			expect(
				translateText("Group by: Days", view),
				`${label}：分组切换器`,
			).toBe("分组方式：天");
			expect(
				translateText("Usage grouped by models", view),
				`${label}：图表标题`,
			).toBe("按模型分组的用量");
			expect(
				translateText("Usage grouped by days", view),
				`${label}：图表标题`,
			).toBe("按天分组的用量");
		}
	});

	it("translates the summary card and the empty states", () => {
		for (const { label, view } of VIEWS) {
			expect(
				translateText(
					"Spend on additional AI credits exceeding your included credits.",
					view,
				),
				`${label}：额外用量说明`,
			).toBe("超出所含点数的额外 AI 点数支出。");
			expect(
				translateText("Edit budget", view),
				`${label}：编辑预算入口`,
			).toBe("编辑预算");
			expect(
				translateText("No usage found", view),
				`${label}：图表空态`,
			).toBe("未找到用量");
			expect(
				translateText(
					"No usage data found for the selected filters.",
					view,
				),
				`${label}：筛选无结果`,
			).toBe("所选筛选条件下未找到用量数据。");
		}
	});
});
