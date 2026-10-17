// 洞察页（/owner/repo/pulse 与 /owner/repo/graphs/contributors）的实机节点回归。
//
// 节点来源：维护者 2026-10-17 贴的 `github-zh-misses/2` 导出（同一仓库两页、三百余条
// 记录）。这份日志把两个长期没人补的区域暴露出来：
//   ① **新版洞察侧栏**——`nav.menu` 的 aria-label 分组标题 + `a.js-selected-navigation-item`
//      的可见文本，五个洞察子页（pulse / graphs / forks / security / projects）共用，
//      补一次覆盖五支，是本文件最大的杠杆；
//   ② **Highcharts 的卡片标题与读屏文案**。
//
// 同时钉住「日志里出现、但不该收」的四类节点（最后一组用例）：
//   ① 用户名 / 机器人名 / 提交信息（`Oppenheymu`、`dependabot[bot]`、`chore(deps): …`）；
//   ② `title` 属性上的绝对时间（`Oct 12, 2026, 19:33 GMT+8`）——属性只做精确匹配；
//   ③ 数据点 aria-label（`Sunday, Aug 23, 2026, 170. Commits.`）——纯动态值，
//      且属性不应用正则规则，架构上救不了；
//   ④ 摘要句的碎片（`and` / `have` / `to` / `main` / `by` / `people` / `s` / `items`…）——
//      它们是同一个句子被 `<strong>` / `<a>` 切开的连词与量词，**不能单独收**：
//      单收会在中英混排里乱插词（`and` 收成「和」就会在每个句子里插一个「和」）。
//      整句形态要等可见文本贴出来再按节点补；这份日志只能证明「碎片存在」，
//      证明不了「整句长什么样」，所以本轮**故意不补**。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

const aliases = new Map(Object.entries(dictCore.aliases));

/** 本页路径命中的模块：pages/insights + pages/repo + global */
const view = buildView(
	"/Koishi-CE/koishi/graphs/contributors",
	dictForLocale("zh-CN"),
	aliases,
);

/** 对照视图：`People` / `Dependency graph` 在别的模块里也有词条，必须同译 */
const profileView = buildView(
	"/Oppenheymu",
	dictForLocale("zh-CN"),
	aliases,
);
const settingsView = buildView(
	"/settings/profile",
	dictForLocale("zh-CN"),
	aliases,
);

/** 实机节点在源码里通常带换行与缩进；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/** 洞察侧栏（五个子页共用；`nav.menu` 的 aria-label 单独一条） */
const SIDEBAR: readonly (readonly [string, string])[] = [
	["Traffic", "流量"],
	["People", "成员"],
	["Dependency graph", "依赖项关系图"],
	["Network", "网络"],
	["Actions performance metrics", "Actions 性能指标"],
	["Actions usage metrics", "Actions 用量指标"],
	["Code frequency", "代码频率"],
	["Community standards", "社区标准"],
];

/** Pulse 概览卡：可见文本（`div.mt-2`）与进度条 aria-label 是同一条键 */
const PULSE_CARDS: readonly (readonly [string, string])[] =
	[
		["Active issues", "活跃的议题"],
		["Closed issues", "已关闭的议题"],
		["New issues", "新建议题"],
		["Active pull requests", "活跃的拉取请求"],
		["Merged pull requests", "已合并的拉取请求"],
	];

/** 图表卡片标题与 Highcharts 读屏文案 */
const CHART: readonly (readonly [string, string])[] = [
	["Contributions:", "贡献："],
	["Top committers", "提交最多的贡献者"],
	[
		"Commits over time. Interactive chart.",
		"随时间变化的提交。交互式图表。",
	],
	[
		"Top committers. Interactive chart.",
		"提交最多的贡献者。交互式图表。",
	],
	["Start of selected range", "所选范围的起点"],
	["End of selected range", "所选范围的终点"],
	[
		"The chart has 1 X axis displaying categories.",
		"图表有 1 个 X 轴，显示类别。",
	],
	// 既有条目：这两条覆盖纯图表区域的节点，与上面的卡片整句是两条键
	["Interactive chart.", "交互式图表。"],
	["End of interactive chart.", "交互式图表结束。"],
];

describe("洞察页的实机节点边界", () => {
	it("translates every sidebar item GitHub renders on the five insights pages", () => {
		for (const [node, expected] of SIDEBAR) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, view),
					`侧栏项 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("translates the sidebar group label, which lives in an aria-label", () => {
		expect(translateText("Admin insights", view)).toBe(
			"管理洞察",
		);
	});

	it("keeps the sidebar wording identical to the other modules that render the same words", () => {
		// 同键同译：pages/profile 与 pages/settings 里早有 `People` / `Dependency graph`，
		// 洞察页必须逐字一致，否则同一句话在两个页面读起来不同（也正是 check:view
		// 的「同键异译赢家」记录存在的意义）
		expect(translateText("People", view)).toBe(
			translateText("People", profileView),
		);
		expect(translateText("Dependency graph", view)).toBe(
			translateText("Dependency graph", settingsView),
		);
	});

	it("translates the pulse overview cards", () => {
		for (const [node, expected] of PULSE_CARDS) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, view),
					`概览卡 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("translates the chart titles and the screen-reader copy", () => {
		for (const [node, expected] of CHART) {
			expect(
				translateText(node, view),
				`图表 ${JSON.stringify(node)}`,
			).toBe(expected);
		}
	});

	it("renders the navigator aria-label through the existing rule", () => {
		// 这条**已经**有规则（`insights/navigator-*`）：日志里出现它不是因为漏翻，
		// 而是导出发生在词典更新之前。锁住它是为了防止有人把规则当死代码删掉
		expect(
			translateText(
				"Navigator 1, series 2 of 2 with 8 data points. Y axis, navigator-y-axis. X axis, navigator-x-axis.",
				view,
			),
		).toBe(
			"导航器 1，系列 2/2，共 8 个数据点。Y 轴：navigator-y-axis。X 轴：navigator-x-axis。",
		);
	});
});

describe("洞察页里「日志有、词典不该收」的节点", () => {
	it("keeps user names, bot names and commit subjects in english", () => {
		for (const node of [
			"Oppenheymu",
			"M. Oppenheymu",
			"dependabot[bot]",
			"github-actions[bot]",
			"Koishi-CE",
			"koishi",
			"chore(deps): bump cac from 7.0.0 to 7.0.1",
			"chore(deps-dev): bump @biomejs/biome from 2.5.14 to 2.5.15",
			"Contributors to Koishi-CE/koishi",
			"Pulse · Koishi-CE/koishi",
			// 头像 alt 上的显示名与登录名同样是用户内容
			"@Koishi-CE",
		]) {
			expect(translateText(node, view), node).toBeNull();
		}
	});

	it("never half-translates the Highcharts data point labels or the title dates", () => {
		for (const node of [
			"Sunday, Aug 23, 2026, 170. Commits.",
			"Sunday, Sep 27, 2026, 20. Navigator 1.",
			"Oppenheymu, 14. Commits.",
			"Commits, series 1 of 2. Bar series with 8 bars. Y axis, Contributions. X axis, Time.",
			"Oct 12, 2026, 19:33 GMT+8",
			"Week of 23 Aug, 2026",
			"7 / 7 checks OK",
			"Repository starred by 7 people, including you",
		]) {
			expect(translateText(node, view), node).toBeNull();
		}
	});

	it("keeps the split summary words out of the dictionary", () => {
		// 反例的意义：这些词一收，就会在**所有**中英混排的句子里乱插；
		// 正确做法是把连词并进相邻片段（见 docs/guides/development.md 的边界事实第 1 条），
		// 而那需要整句的节点顺序——只能由维护者贴可见文本
		for (const node of [
			"and",
			"have",
			"to",
			"On",
			"pushed",
			"main",
			"by",
			"people",
			"authors",
			"s",
			"items",
			"additions",
			"deletions",
			"files",
			"pull requests merged",
			"to all branches.",
			"changed and there have been",
			"Excluding merges,",
			", excluding merge commits",
		]) {
			expect(translateText(node, view), node).toBeNull();
		}
	});

	it("keeps the search placeholder english, as decided for the kbd-split surface", () => {
		// 同一条结论的另一处证据：这页的日志里它也是 `span.placeholder__MIdoN6` 的 `Type`
		expect(translateText("Type", view)).toBeNull();
		expect(translateText("to search", view)).toBeNull();
	});
});
