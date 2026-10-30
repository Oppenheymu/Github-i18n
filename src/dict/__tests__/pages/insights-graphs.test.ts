// 图表页（/graphs/code-frequency、/graphs/commit-activity、/graphs/contributors、
// /graphs/traffic）的实机节点回归。词条都在 pages/insights 模块。
//
// 节点来源：维护者 2026-10-29 贴的 `github-zh-misses/3` 导出（Koishi-CE/koishi，
// 导出里相邻图表页的记录因 SPA 软导航互相错标路径，词条按组件归属归并）。
// 动态串走九条规则：traffic 卡片描述句的四条计数行、Highcharts 读屏句两条
//（「N data points / series」，与既有 chart-bar 的「N bars」是不同串）、
// 文档标题三条（Insights 族新格式，无「· GitHub」后缀）。
// 明确不收（2026-10-17 的决策，见 insights-pulse.test.ts）：轴刻度数字、
// 数据点 aria（Sunday, … . Commits. 等）、Week of … 数据表表头、
// 贡献者用户名（含 sr-only 与复数尾 s 节点）。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

const aliases = new Map(Object.entries(dictCore.aliases));

/** 本页路径命中的模块：pages/insights + pages/repo + global */
const view = buildView(
	"/Koishi-CE/koishi/graphs/code-frequency",
	dictForLocale("zh-CN"),
	aliases,
);

/** traffic 页（同一模块，规则与词条按并集共享） */
const trafficView = buildView(
	"/Koishi-CE/koishi/graphs/traffic",
	dictForLocale("zh-CN"),
	aliases,
);

/** 实机节点在源码里通常带换行与缩进；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/** 按引擎行为渲染一串文本节点，命中时保留原文首尾空白 */
function renderNodes(nodes: readonly string[]): string {
	return nodes
		.map((raw) => {
			const translated = translateText(raw, view);
			if (translated === null) return raw;
			const lead = raw.slice(
				0,
				raw.length - raw.trimStart().length,
			);
			const trail = raw.slice(raw.trimEnd().length);
			return `${lead}${translated}${trail}`;
		})
		.join("");
}

/** 月份轴刻度（SVG text 节点，整节点精确匹配） */
const MONTHS: readonly (readonly [string, string])[] = [
	["Jan", "1月"],
	["Feb", "2月"],
	["Mar", "3月"],
	["Apr", "4月"],
	["May", "5月"],
	["Jun", "6月"],
	["Jul", "7月"],
	["Aug", "8月"],
	["Sep", "9月"],
	["Oct", "10月"],
	["Nov", "11月"],
	["Dec", "12月"],
];

describe("图表页的实机节点边界", () => {
	it("translates the code-frequency and commit-activity card copy", () => {
		for (const [node, expected] of [
			["Number of commits per week", "每周提交数"],
			[
				"Additions and deletions per week",
				"每周新增与删除行数",
			],
			[
				"Code frequency. Interactive chart.",
				"代码频率。交互式图表。",
			],
			["Commits. Interactive chart.", "提交。交互式图表。"],
			["Frequency", "频率"],
			["Additions", "新增"],
			["Deletions", "删除"],
			["Show Additions", "显示新增"],
			["Show Deletions", "显示删除"],
			[
				"Toggle series visibility, Chart",
				"切换系列可见性，图表",
			],
		] as const) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, view),
					JSON.stringify(variant),
				).toBe(expected);
			}
		}
	});

	it("reassembles the card description sentences with the repo names intact", () => {
		// 仓库名是 strong 包裹的独立节点（组织名 / 仓库名各一），原样保留；
		// 前段节点尾部的空格按引擎惯例原样保留在冒号之后
		expect(
			renderNodes([
				"Code frequency over the history of ",
				"Koishi-CE",
				"/koishi",
			]),
		).toBe("整个仓库历史中的代码频率： Koishi-CE/koishi");
		expect(
			renderNodes([
				"Commits over the last year of ",
				"Koishi-CE",
				"/koishi",
			]),
		).toBe("过去一年的提交： Koishi-CE/koishi");
	});

	it("translates the month axis ticks", () => {
		for (const [node, expected] of MONTHS) {
			expect(translateText(node, view), node).toBe(
				expected,
			);
		}
	});

	it("translates the traffic page headings, tables and axis titles", () => {
		for (const [node, expected] of [
			["Git clones", "Git 克隆"],
			["Popular content", "热门内容"],
			["Referring sites", "引荐站点"],
			["Visitors", "访客"],
			["Clones in last 14 days", "最近 14 天的克隆"],
			[
				"Unique cloners in last 14 days",
				"最近 14 天的独立克隆者",
			],
			[
				"Total views in last 14 days",
				"最近 14 天的总浏览量",
			],
			[
				"Unique visitors in last 14 days",
				"最近 14 天的独立访客",
			],
			[
				"Clones in last 14 days. Interactive chart.",
				"最近 14 天的克隆。交互式图表。",
			],
			[
				"Total views in last 14 days. Interactive chart.",
				"最近 14 天的总浏览量。交互式图表。",
			],
			["Cloners", "克隆者"],
			["Clones", "克隆"],
			["Total views", "总浏览量"],
			["Unique visitors", "独立访客"],
			["Views", "浏览"],
			["Unique Visitors", "独立访客"],
			["Total", "总计"],
			["Unique", "独立"],
			["Content", "内容"],
			["Site", "站点"],
			["Last month", "上个月"],
		] as const) {
			expect(translateText(node, trafficView), node).toBe(
				expected,
			);
		}
	});

	it("translates the traffic summary counts through rules", () => {
		// 卡片描述句的计数行（数字随仓库变化）
		expect(translateText("244 Views", trafficView)).toBe(
			"244 次浏览",
		);
		expect(translateText("811 Clones", trafficView)).toBe(
			"811 次克隆",
		);
		expect(
			translateText("178 Unique cloners", trafficView),
		).toBe("178 位独立克隆者");
		expect(
			translateText("8 Unique visitors", trafficView),
		).toBe("8 位独立访客");
	});

	it("translates the Highcharts screen-reader shape sentences through rules", () => {
		expect(
			translateText(
				"Line chart with 14 data points.",
				trafficView,
			),
		).toBe("含 14 个数据点的折线图。");
		expect(
			translateText("Bar chart with 2 data series.", view),
		).toBe("含 2 个数据系列的柱状图。");
	});

	it("translates the document titles through the new-format rules", () => {
		// 2026-10-29：Insights 族的文档标题去掉了「· GitHub」后缀
		expect(
			translateText(
				"Traffic · Koishi-CE/koishi",
				trafficView,
			),
		).toBe("流量 · Koishi-CE/koishi");
		expect(
			translateText("Commits · Koishi-CE/koishi", view),
		).toBe("提交 · Koishi-CE/koishi");
		expect(
			translateText(
				"Code frequency · Koishi-CE/koishi",
				view,
			),
		).toBe("代码频率 · Koishi-CE/koishi");
		expect(
			translateText("Insights: Koishi-CE/koishi", view),
		).toBe("洞察：Koishi-CE/koishi");
	});

	it("keeps axis numbers, data-point labels, table headers and user names in english", () => {
		for (const node of [
			// 轴刻度数字（纯数字 / 符号，isTranslatableText 直接滤掉）
			"-100k",
			"239,215",
			// Highcharts 数据点 aria（2026-10-17 锁定不收，属性只精确匹配年代
			// 的论据已过时，但要翻案先更新 insights-pulse.test.ts 的负例）
			"Sunday, Oct 25, 2026, 8. Commits.",
			"Sunday, Aug 23, 2026, -185,376. Deletions.",
			"Oppenheymu, 7. Commits.",
			"10/16, 1. Total.",
			"10/16, 1. Unique.",
			// 数据表表头（同上锁定）
			"Week of 23 Aug, 2026",
			// 系列描述（含数据点个数与轴 id）
			"Commits, series 1 of 2. Bar series with 10 bars. Y axis, Contributions. X axis, Time.",
			// 用户内容
			"Oppenheymu",
			"dependabot[bot]",
			"Koishi-CE",
			"koishi",
			// 复数尾 s 节点
			"s",
		]) {
			expect(translateText(node, view), node).toBeNull();
		}
	});
});
