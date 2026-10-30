// Actions 用量·性能指标页（/owner/repo/actions/metrics/usage 与
// /owner/repo/actions/metrics/performance）的实机节点回归。
//
// 节点来源：维护者 2026-10-29 贴的 `github-zh-misses/3` 导出（Koishi-CE/koishi
// 两页，三百余条记录）。两页共用一套组件（指标卡 + 排序表格 + 分页），词条按
// 两页并集登记在 pages/actions 里（路由 ^/[^/]+/[^/]+/actions 命中）。
// 页面同时渲染洞察侧栏（「Admin insights」），那批词条在本模块登记同译——
// 这里一并断言，并逐字对照 pages/insights 的译文。
//
// 明确不收（见反例用例）：工作流文件名（ci.yml 等）、运行器值（hosted / linux）、
// 时长值（1m）、relative-time 的 title 绝对时间戳、头像 alt、用户名、
// 分页 sr-only 的裸「page」碎片（「上一页 page」收「页」会渲染成「上一页 页」，
// 两害相权取其轻）。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

const aliases = new Map(Object.entries(dictCore.aliases));

/** 本页路径命中的模块：pages/actions + pages/insights（侧栏）+ global */
const view = buildView(
	"/Koishi-CE/koishi/actions/metrics/performance",
	dictForLocale("zh-CN"),
	aliases,
);

/** 对照视图：侧栏词条在 pages/insights 另有一份，必须逐字同译 */
const insightsView = buildView(
	"/Koishi-CE/koishi/pulse",
	dictForLocale("zh-CN"),
	aliases,
);

/** 实机节点在源码里通常带换行与缩进；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/**
 * 按引擎行为渲染一串文本节点：逐节点翻译，命中时保留原文首尾空白。
 * 分页 sr-only 与卡片描述句都是「数字独立成节点」的拼接结构。
 */
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

/** 洞察侧栏（本模块登记的同译，与 pages/insights 逐字一致） */
const SIDEBAR: readonly (readonly [string, string])[] = [
	["Traffic", "流量"],
	["People", "成员"],
	["Dependency graph", "依赖项关系图"],
	["Network", "网络"],
	["Code frequency", "代码频率"],
	["Community standards", "社区标准"],
	["Actions performance metrics", "Actions 性能指标"],
	["Actions usage metrics", "Actions 用量指标"],
];

/** 指标卡的标题与说明句（两页并集） */
const CARDS: readonly (readonly [string, string])[] = [
	["Avg job queue time", "作业平均排队时间"],
	[
		"Average queue time of jobs in this repository for current month",
		"本月此仓库中作业的平均排队时间",
	],
	["Avg job run time", "作业平均运行时间"],
	[
		"Average run time of jobs in this repository for current month",
		"本月此仓库中作业的平均运行时间",
	],
	["Total job runs", "作业运行总数"],
	[
		"Total job runs across all workflows in this repository for current month",
		"本月此仓库中所有工作流的作业运行总数",
	],
	["Total minutes", "总分钟数"],
	[
		"Total minutes across all workflows in this repository for current month",
		"本月此仓库中所有工作流消耗的总分钟数",
	],
	["Job failure rate", "作业失败率"],
	[
		"Failure rate across jobs in this repository for current month",
		"本月此仓库中各作业的失败率",
	],
	["Failed job usage", "失败作业用量"],
	[
		"Total minutes used across failed jobs in this repository for current month",
		"本月此仓库中失败作业消耗的总分钟数",
	],
];

/** 表头与排序按钮同串（th.TableHeader / button.TableSortButton） */
const TABLE: readonly (readonly [string, string])[] = [
	["Runner type", "运行器类型"],
	["Runtime OS", "运行器操作系统"],
	["Jobs", "作业"],
	["Workflow runs", "工作流运行"],
	["Total minutes", "总分钟数"],
	["Avg run time", "平均运行时间"],
	["Has job failures", "存在作业失败"],
];

describe("Actions 指标页的实机节点边界", () => {
	it("translates the sidebar with wording identical to pages/insights", () => {
		for (const [node, expected] of SIDEBAR) {
			expect(translateText(node, view), node).toBe(
				expected,
			);
			expect(
				translateText(node, insightsView),
				`${node}（insights 对照）`,
			).toBe(expected);
		}
		expect(translateText("Admin insights", view)).toBe(
			"管理洞察",
		);
	});

	it("translates the page headers and toolbar", () => {
		for (const [node, expected] of [
			["Actions Performance Metrics", "Actions 性能指标"],
			["Actions Usage Metrics", "Actions 用量指标"],
			["Period: Current month", "时间段：本月"],
			["Download report", "下载报告"],
			["Advanced filter dialog", "高级筛选对话框"],
			["Row Actions", "行操作"],
			["Metrics navigation", "指标导航"],
			["Metrics", "指标"],
		] as const) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, view),
					JSON.stringify(variant),
				).toBe(expected);
			}
		}
	});

	it("translates the metric cards and their descriptions", () => {
		for (const [node, expected] of CARDS) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, view),
					JSON.stringify(variant),
				).toBe(expected);
			}
		}
	});

	it("translates the sortable table headers", () => {
		for (const [node, expected] of TABLE) {
			expect(translateText(node, view), node).toBe(
				expected,
			);
		}
	});

	it("translates the filter box and the table pagination landmarks", () => {
		expect(translateText("Search or filter", view)).toBe(
			"搜索或筛选",
		);
		expect(translateText("Suggestions", view)).toBe("建议");
		expect(
			translateText("Pagination for table", view),
		).toBe("表格分页");
	});

	it("reassembles the pagination sr-only sentences from their number nodes", () => {
		// 实机：数字与「‒」各自成节点，三条碎片拼回整句
		expect(
			renderNodes([
				"Showing",
				" ",
				"1",
				" ",
				"through",
				" ",
				"6",
				" ",
				"of",
				" ",
				"6",
			]),
		).toBe("显示 1 至 6 ，共 6");
		expect(renderNodes(["Page", " ", "1"])).toBe("页码 1");
		// 裸「page」碎片有意不收：上一页 / 下一页之后的 page 独立节点保持英文
		expect(translateText("page", view)).toBeNull();
	});

	it("translates the data-range intro through the rule", () => {
		// 实机：「Showing data from <开始> to」+ 结束日期是相邻两个节点，
		// 模板不闭合句子，拼回「显示从 2026/10/1 到 Oct 29, 2026」
		expect(
			translateText("Showing data from 2026/10/1 to", view),
		).toBe("显示从 2026/10/1 到");
	});

	it("translates the shared sr-only h1 through the module-local rule", () => {
		expect(
			translateText("Insights: Koishi-CE/koishi", view),
		).toBe("洞察：Koishi-CE/koishi");
	});
});

describe("Actions 指标页里「日志有、词典不该收」的节点", () => {
	it("keeps data values, file names, user names and timestamps in english", () => {
		for (const node of [
			// 工作流文件名与运行器值是数据列
			"ci.yml",
			"release.yml",
			"codeql",
			"hosted",
			"linux",
			// 时长值
			"1m",
			// 用户内容
			"koishi",
			"Koishi-CE",
			"M. Oppenheymu",
			"@Koishi-CE",
			// relative-time 的 title 绝对时间戳（属性只精确匹配，动态值永不命中）
			"Oct 30, 2026, 06:08 GMT+8",
			// <link rel="icon"> 的 title（head 元数据）
			"GitHub",
			// 切换仓库的快捷键 sr-only 片段
			"alt shift r",
		]) {
			expect(translateText(node, view), node).toBeNull();
		}
	});
});
