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
//   ④ 摘要句的**孤立连词**（`have` / `to` / `pushed` / `main` / `by`）——单收会在
//      中英混排里乱插词，正确做法是把连词并进相邻片段。
//
// 2026-10-17 晚维护者补贴了 /pulse 的**可见文本**，摘要句的节点顺序第一次可见：
// `Excluding merges, ` + `3` + ` authors` + ` have pushed ` + `23 commits` +
// ` to main and ` + `23 commits` + ` to all branches.`，第二句同理。于是这一组
// 从「故意不补」升级为**按节点补碎片、再用拼回的整句回归**（见「拼回整句」用例）。
// 仍然不收的只剩上面 ④ 里的真·孤立词，以及用户名 / 属性 / 数据点那三类。
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

/** Pulse 明细页（摘要句只在 /pulse 上渲染；模块与 graphs 同属 pages/insights） */
const pulseView = buildView(
	"/Koishi-CE/koishi/pulse",
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

/**
 * 按引擎行为渲染一串文本节点：逐节点翻译，命中时保留原文首尾空白。
 * 摘要句在实机就是被 `<strong>` / `<a>` 切开的独立节点，只有按节点拼回去才能
 * 验证中文语序——一条一条断言看不出整句是否通顺（空格是中英混排的既有形态，
 * 见 org-settings 的 `and` 先例）。
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

	it("translates the Y-axis screen-reader sentence of the committers chart", () => {
		// 实机文案：轴名是系列名 Commits（页面上的轴标题已单独译为「提交」）
		expect(
			translateText(
				"The chart has 1 Y axis displaying Commits. Data ranges from 3 to 14.",
				view,
			),
		).toBe(
			"图表有 1 条 Y 轴，显示提交。数据范围从 3 到 14。",
		);
		// 通用形态兜住别的系列名：系列名原样保留，句子仍是中文
		expect(
			translateText(
				"The chart has 2 Y axes displaying Issues. Data ranges from 0 to 5.",
				view,
			),
		).toBe(
			"图表有 2 条 Y 轴，显示 Issues 系列。数据范围从 0 到 5。",
		);
	});

	it("translates the pulse period header without mistaking the year for the end day", () => {
		// 2026-10-17 实机 bug：模板引用了 $4（endYear），渲染成
		// 「2026 年 10 月 10 日 – 2026 日」；结束日必须用 $3（endDay）
		expect(
			translateText(
				"October 10, 2026 – October 17, 2026",
				pulseView,
			),
		).toBe("2026 年 10 月 10 日 – 17 日");
	});

	it("reassembles the pulse summary sentence from its interpolated nodes", () => {
		// 实机是**每个占位符一个裸文本节点**（计数、复数标签、分支名各自成节点），
		// 连接词夹在中间也各自成节点——`outerHTML` 里完全看不出这些边界。
		// 第一句：`Excluding merges, 3 authors have pushed 23 commits to main and
		// 23 commits to all branches.`
		expect(
			renderNodes([
				"Excluding merges, ",
				"3",
				" ",
				"authors",
				" have pushed ",
				"23",
				" ",
				"commits",
				" to ",
				"main",
				" and ",
				"23",
				" ",
				"commits",
				" to all branches.",
			]),
		).toBe(
			"不含合并提交， 3 位作者 共推送了 23 次提交 到 main 和 23 次提交 推送到所有分支。",
		);
		// 第二句：`On main, 106 files have changed and there have been 2,119
		// additions and 602 deletions.`——分支名 `main` 与逗号（只有标点、不可翻译）
		// 都是独立节点，所以中文里会看到一个半角逗号
		expect(
			renderNodes([
				"On ",
				"main",
				", ",
				"106",
				" ",
				"files",
				" have changed and there have been ",
				"2,119",
				" ",
				"additions",
				" and ",
				"602",
				" ",
				"deletions",
			]),
		).toBe(
			"在 main, 106 个文件 有改动，其中 2,119 行新增 和 602 行删除。",
		);
		// 上游若把整段渲染回一个文本节点，规则与 global 的既有键仍然兜住
		expect(translateText(" to main and ", pulseView)).toBe(
			"到 main 分支，另有",
		);
		expect(translateText("On main,", pulseView)).toBe(
			"在 main 分支上，",
		);
		expect(translateText("3 authors", pulseView)).toBe(
			"3 位作者",
		);
		expect(translateText("106 files", pulseView)).toBe(
			"106 个文件",
		);
	});

	it("reassembles the merged-pull-requests heading from its interpolated nodes", () => {
		// 实机（2026-10-17 22:35）：`13` + ` ` + `pull requests` + ` merged by ` +
		// `2` + ` ` + `people`。整句键 `pull requests merged by` 在实机永不命中，
		// 只有 ` people` 被译出（「2 人合并」）——正好反证标签与连接词都是独立节点
		expect(
			renderNodes([
				"13",
				" ",
				"pull requests",
				" merged by ",
				"2",
				" ",
				"people",
			]),
		).toBe("13 个拉取请求 由 2 人合并");
		// 整段单节点形态的兜底
		expect(
			translateText(" pull requests merged by ", pulseView),
		).toBe("个拉取请求由");
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
			// 「7 / 7 checks OK」原走 actions 模块规则，2026-10-25 起由 global/checks-ok
			// 翻译（见 global.test.ts），不再列为「不该收」的反例
		]) {
			expect(translateText(node, view), node).toBeNull();
		}
	});

	it("keeps the still-isolated split words out of the dictionary", () => {
		// 摘要句与已合并标题的碎片已按节点补齐（见「拼回整句」用例）；这里只留
		// **真正孤立**的虚词：单收它们会在任意中英混排句子里乱插词。`to` / `On`
		// 不在此列——它们只在「分支名被插值切开」的固定句式里出现，已随该句式
		// 一起收进本模块（模块按路由限定，见 insights.jsonc 的注释）。
		for (const node of [
			"have",
			"pushed",
			"main",
			"by",
			"s",
			"items",
			"pull requests merged",
			", excluding merge commits",
		]) {
			expect(translateText(node, view), node).toBeNull();
		}
	});

	it("keeps the search placeholder fragments out of the dictionary", () => {
		// 实机是 `span.placeholder__MIdoN6` 里的 `Type ` + `<kbd>/</kbd>` + ` to search`：
		// 整句由引擎按三段结构回填（见 walker.test.ts 的「三段标签」），两个**碎片**
		// 仍然不能收——`Type` 在设置页正文另有「类型」，收了就必然有一处译错
		expect(translateText("Type", view)).toBeNull();
		expect(translateText("to search", view)).toBeNull();
	});
});
