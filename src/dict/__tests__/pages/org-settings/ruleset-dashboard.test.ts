// 组织规则集仪表盘页（/organizations/<组织>/settings/rules/dashboard）实机回归。
//
// 证据：2026-10-10 维护者贴的实机 outerHTML（采集时扩展仍在运行——页面已有一半是中文：
// 表头的 `仓库`（`Repository` 命中既有键）与搜索按钮的 tooltip「搜索」正好当「扩展确实
// 在这一页生效」的对照物；仍是英文的才是本批清单）。
//
// 它与前两页**不是**同一款 React 应用：本页是 `<react-app app-name="rule-insights-dashboard"
// initial-path="/organizations/Koishi-CE/settings/rules/dashboard">`（规则集页 / 洞察页是
// `repos-rules`），故页头、指标卡、图表文案都是本模块的新串，没有仓库级同串可对。
//
// 本文件锁五件事：
//   ① 路由：本页只命中 pages/org-settings + global，不命中 pages/repo-settings /
//      pages/settings / pages/settings-billing / pages/insights / pages/agents——
//      最后两个尤其重要：Highcharts 的读屏规则在 pages/insights 里有一份、
//      `Search or filter` 在 pages/agents 里有一条同译键，那两条路由都不命中组织设置页，
//      正是「明明翻译过却漏翻」的成因，故本模块必须各收一份；
//   ② 实机里仍是英文的文本节点全部命中（页头 / 筛选框 / 图表卡外壳 / 指标卡 / 柱状图 /
//      表格），逐条断言译文；
//   ③ 属性只走整串精确匹配，不走规则：`Filter rule insights dashboard`（表单 aria-label
//      与 sr-only 标签同串）、`Search or filter`（placeholder）、`Interactive chart`
//      （SVG 的 aria-label）三条都要能查到；
//   ④ Highcharts 的动态读屏文案由本模块的 7 条规则接住（单复数、条数、轴数、数据范围
//      都是动态值），并与 pages/insights 的同款文案**逐字一致**；
//   ⑤ 反例：拼了动态系列名的属性（`Rule Suites. Interactive chart.` / `Show Passes` /
//      数据点 aria-label）、纯日期与纯数字节点、用户内容（仓库名 / 组织名）保持英文。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织规则集仪表盘页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/rules/dashboard";
/** 旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const LEGACY_PATH =
	"/orgs/Koishi-CE/settings/rules/dashboard";
/** pages/insights 的探针路径：同款 Highcharts 文案的既有译文在这里 */
const INSIGHTS_PATH = "/microsoft/vscode/pulse";

const locale = dictForLocale("zh-CN");
const aliases = new Map(Object.entries(dictCore.aliases));

const view = buildView(PAGE_PATH, locale, aliases);
const INSIGHTS_VIEW = buildView(
	INSIGHTS_PATH,
	locale,
	aliases,
);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 实机里仍是英文的文本节点（按页面自上而下的顺序） */
const NEW_NODES: readonly (readonly [string, string])[] = [
	// 页头 H1：与洞察页的 `Repository ruleset insights` 不是同串
	["Repository ruleset dashboard", "仓库规则集仪表盘"],
	// 筛选表单：aria-label 与 sr-only 标签同串
	["Filter rule insights dashboard", "筛选规则洞察仪表盘"],
	// 清除按钮的 tooltip（popover 里的文本节点）
	["Clear filter", "清除筛选"],
	// 图表卡外壳（两张图共用）
	["Rule Suites", "规则套件"],
	["Chart options", "图表选项"],
	["Customization settings", "自定义设置"],
	// 折线图的轴标题与图例
	["Values", "数值"],
	["Passes", "通过"],
	["Failures", "失败"],
	["Bypasses", "绕过"],
	// 指标卡（payload 的 `metrics[].name` 与 `link.displayText`）
	["Allowed", "已允许"],
	["View allowed runs", "查看已允许的运行"],
	["in the time period", "在该时间段内"],
	["Failed", "失败"],
	["View failed runs", "查看失败的运行"],
	["Bypassed", "已绕过"],
	["View bypassed runs", "查看已绕过的运行"],
	// 柱状图「Bypasses by actor」
	["Bypasses by actor", "按操作者统计的绕过"],
	[
		"Members who have bypassed the most",
		"绕过次数最多的成员",
	],
	["Actor", "操作者"],
	["Number of bypasses", "绕过次数"],
	// 表格「Top repositories by bypasses」
	["Top repositories by bypasses", "绕过次数最多的仓库"],
	[
		"Displays Rule Bypasses at the Organization, Repository, and Enterprise levels, limited to Active Rules only",
		"显示组织、仓库和企业层级的规则绕过情况，仅限活动中的规则",
	],
	// 筛选联想菜单（点开筛选框后弹出）的两项可见文本
	["Creation date", "创建日期"],
	["Evaluate status", "评估状态"],
];

/**
 * 可翻译属性（属性只走整串精确匹配，不走规则）：
 * 筛选框的 aria-label / sr-only 文本同串、placeholder 在 pages/agents 里另有同译键、
 * SVG 根的 aria-label、联想列表自身的 aria-label，以及静态的组合型 aria-label。
 */
const ATTR_KEYS: readonly (readonly [string, string])[] = [
	["Filter rule insights dashboard", "筛选规则洞察仪表盘"],
	["Search or filter", "搜索或筛选"],
	["Interactive chart", "交互式图表"],
	["Suggestions", "建议"],
	[
		"Creation date, Filter, Creation date",
		"创建日期，筛选，创建日期",
	],
];

/** Highcharts 读屏区的动态文案 → 本模块规则的产物（实机原文逐条誊录） */
const CHART_RULES: readonly (readonly [string, string])[] =
	[
		["Line chart with 3 lines.", "包含 3 条折线的折线图。"],
		// 单数形态（Highcharts 按数据点数量变格）
		["Line chart with 1 line.", "包含 1 条折线的折线图。"],
		["Bar chart with 0 bars.", "包含 0 根柱条的柱状图。"],
		[
			"Created with Highcharts 13.0.0",
			"使用 Highcharts 13.0.0 创建",
		],
		[
			"The chart has 1 X axis displaying Time. Data ranges from 2026-10-03 00:00:00 to 2026-10-10 00:00:00.",
			"图表有 1 条 X 轴，显示时间。数据范围从 2026-10-03 00:00:00 到 2026-10-10 00:00:00。",
		],
		// 复数形态（`X axes`）
		[
			"The chart has 2 X axes displaying Time. Data ranges from 2026-10-03 00:00:00 to 2026-10-10 00:00:00.",
			"图表有 2 条 X 轴，显示时间。数据范围从 2026-10-03 00:00:00 到 2026-10-10 00:00:00。",
		],
		[
			"The chart has 1 Y axis displaying Values. Data ranges from -0.5 to 0.5.",
			"图表有 1 条 Y 轴，显示数值。数据范围从 -0.5 到 0.5。",
		],
		[
			"The chart has 1 X axis displaying Actor.",
			"图表有 1 条 X 轴，显示操作者。",
		],
		[
			"The chart has 1 Y axis displaying Number of bypasses. Data ranges from 0 to 0.",
			"图表有 1 条 Y 轴，显示绕过次数。数据范围从 0 到 0。",
		],
	];

/** 同一批 Highcharts 文案必须与 pages/insights 逐字一致（那条路由有一份同款规则） */
const SHARED_WITH_INSIGHTS: readonly string[] = [
	"Chart options",
	"Customization settings",
	"View as data table, Chart",
	"Interactive chart",
	"End of interactive chart.",
	"Bar chart with 0 bars.",
	"Created with Highcharts 13.0.0",
];

/**
 * 必须保持英文：拼了动态系列名的属性（属性不走规则）、筛选框里已生效的查询串
 * （GitHub 自己的筛选语法，翻了用户就看不懂自己在筛什么）、纯日期 / 纯数字
 * （守卫按设计跳过，节点里没有拉丁字母）、用户内容。
 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// 系列名拼进串里，整串永远命中不了
	"Rule Suites. Interactive chart.",
	"Bypasses by actor. Interactive chart.",
	"Toggle series visibility, Chart",
	"Show Passes",
	"Saturday, Oct 3, 2026, 0. Passes.",
	// 联想项的组合型 aria-label 里尾段像动态值（冒号 + 竖线连接的一组值），
	// 本页只采到一个样本，判定为不可收——实证它恒定后再收
	"Evaluate status, Filter, Evaluate status: active | evaluate | all",
	// 筛选框里已生效的查询串：`created` / `evaluate-status` 是 GitHub 的筛选键名，
	// 值是 `>@today-1w` 这样的 DS 语法，翻了只会让人看不懂自己在筛什么
	"created",
	"evaluate-status",
	">@today-1w",
	"created:>@today-1w evaluate-status:active",
	// 日期与数字节点：不含拉丁字母，守卫直接跳过
	"2026-10-03",
	"0",
	// 用户内容
	"koishi",
	"Koishi-CE",
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

describe("组织规则集仪表盘页的模块路由", () => {
	it("loads the org-settings shell with the global fallback", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match the modules that own the same-looking strings", () => {
		// 仓库设置的路由显式排除了 organizations/orgs；其余模块的文案
		//（Highcharts 在 pages/insights、`Search or filter` 在 pages/agents）
		// 都只在各自的路由上生效——本页必须自己收一份
		const names = moduleNames(PAGE_PATH);
		expect(names).not.toContain("pages/repo-settings");
		expect(names).not.toContain("pages/settings");
		expect(names).not.toContain("pages/settings-billing");
		expect(names).not.toContain("pages/insights");
		expect(names).not.toContain("pages/agents");
	});

	it("covers the legacy orgs prefix as well", () => {
		expect(moduleNames(LEGACY_PATH)).toContain(
			"pages/org-settings",
		);
	});
});

describe("组织规则集仪表盘页的实机节点", () => {
	it("translates every node that the real page still showed in English", () => {
		for (const [raw, expected] of NEW_NODES) {
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

	it("translates the accessible names and the placeholder", () => {
		for (const [raw, expected] of ATTR_KEYS) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("keeps the strings whose meaning is only meaningful with a dynamic value", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("translates the already-covered shell keys as before", () => {
		// 页面上已是中文的两处对照物：表头的 `仓库` 与搜索按钮的 tooltip「搜索」
		expect(translateText("Repository", view)).toBe("仓库");
		expect(translateText("Search", view)).toBe("搜索");
		// 侧栏项与两个页头是三串不同的文案
		expect(translateText("Repository rulesets", view)).toBe(
			"仓库规则集",
		);
		expect(
			translateText("Repository ruleset insights", view),
		).toBe("仓库规则集洞察");
	});
});

describe("组织规则集仪表盘页的图表读屏文案", () => {
	it("covers the dynamic Highcharts descriptions with rules", () => {
		for (const [raw, expected] of CHART_RULES) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("uses the same wording as the insights module for the shared strings", () => {
		for (const raw of SHARED_WITH_INSIGHTS) {
			const here = translateText(raw, view);
			expect(
				here,
				`本页未命中：${JSON.stringify(raw)}`,
			).not.toBeNull();
			expect(
				here,
				`两模块译文不一致：${JSON.stringify(raw)}`,
			).toBe(translateText(raw, INSIGHTS_VIEW));
		}
	});

	it("renders the clipped screen-reader region of the line chart", () => {
		expect(
			renderNodes([
				"Line chart with 3 lines.",
				"View as data table, Chart",
				"The chart has 1 X axis displaying Time. Data ranges from 2026-10-03 00:00:00 to 2026-10-10 00:00:00.",
				"The chart has 1 Y axis displaying Values. Data ranges from -0.5 to 0.5.",
				"End of interactive chart.",
			]),
		).toBe(
			"包含 3 条折线的折线图。以数据表查看，图表图表有 1 条 X 轴，显示时间。数据范围从 2026-10-03 00:00:00 到 2026-10-10 00:00:00。图表有 1 条 Y 轴，显示数值。数据范围从 -0.5 到 0.5。交互式图表结束。",
		);
	});
});

describe("组织规则集仪表盘页的节点切分事实", () => {
	it("renders the metric cards row", () => {
		// 三张指标卡：标题 + 链接 + 计数 + 时间范围说明（计数与日期是独立节点）
		expect(
			renderNodes([
				"Allowed",
				"View allowed runs",
				"0",
				"in the time period",
			]),
		).toBe("已允许查看已允许的运行0在该时间段内");
	});

	it("renders the chart legend and the axis titles", () => {
		expect(
			renderNodes([
				"Rule Suites",
				"Values",
				"Passes",
				"Failures",
				"Bypasses",
				"Bypasses by actor",
				"Members who have bypassed the most",
				"Actor",
				"Number of bypasses",
			]),
		).toBe(
			"规则套件数值通过失败绕过按操作者统计的绕过绕过次数最多的成员操作者绕过次数",
		);
	});

	it("renders the top-repositories table with its heading and blurb", () => {
		expect(
			renderNodes([
				"Top repositories by bypasses",
				"Displays Rule Bypasses at the Organization, Repository, and Enterprise levels, limited to Active Rules only",
				"仓库",
				"Bypasses",
				"koishi",
				"8",
			]),
		).toBe(
			"绕过次数最多的仓库显示组织、仓库和企业层级的规则绕过情况，仅限活动中的规则仓库绕过koishi8",
		);
	});
});

describe("组织规则集仪表盘页的筛选联想菜单", () => {
	it("translates the two suggestion labels in place", () => {
		// 实机：两项各是 `ActionList.Item.Label` 里的一个 span 文本节点
		expect(
			renderNodes(["Creation date", "Evaluate status"]),
		).toBe("创建日期评估状态");
	});

	it("translates the list label and the static combined aria-label", () => {
		// 列表自身与第一项各有一个 aria-label，都是属性（只走整串精确匹配）
		expect(translateText("Suggestions", view)).toBe("建议");
		expect(
			translateText(
				"Creation date, Filter, Creation date",
				view,
			),
		).toBe("创建日期，筛选，创建日期");
	});

	it("keeps the raw filter query and the dynamic aria-label in English", () => {
		// 查询串是 GitHub 的筛选语法；第二项 aria-label 的尾段看着像随筛选值变化
		for (const raw of [
			"Evaluate status, Filter, Evaluate status: active | evaluate | all",
			"created:>@today-1w evaluate-status:active",
			"created",
			"evaluate-status",
			">@today-1w",
		]) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});
