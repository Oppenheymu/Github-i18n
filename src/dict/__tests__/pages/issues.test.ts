// 议题列表页（/owner/repo/issues）实机文本节点回归。
//
// 节点清单来源：2026-09 无头 Edge 抓 https://github.com/microsoft/vscode/issues 的
// 真实渲染 DOM（逐节点记录 nodeValue 与父元素路径，再用该路径的 buildView 判定命中）。
//
// 这一页的价值在于它把自己**拆得极碎**：侧栏折叠、视图下拉、筛选按钮各自成节点，
// 同一句话在窄屏/宽屏是两组不同节点（带不带源码缩进）。整句键在这里必然落空，
// 所以这些清单就是本模块「哪些原文真的存在于 DOM」的唯一依据。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

/** /microsoft/vscode/issues 命中的模块视图（pages/issues + pages/repo + global） */
const view = buildView(
	"/microsoft/vscode/issues",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机渲染的文本节点原文（逐字录入；末尾是实机译文） */
const ISSUES_NODES: readonly string[] = [
	// —— 侧栏与视图切换 ——
	"Issues", // → 议题
	"Assigned to me", // → 指派给我的
	"Created by me", // → 我创建的
	"Mentioned", // → 提及我的
	"Recent activity", // → 最近动态
	"Views", // → 视图
	"Projects", // → 项目
	"Milestones", // → 里程碑
	"Labels", // → 标签
	"Collapse sidebar", // → 收起侧栏
	"Open Issues sidebar navigation", // → 打开议题侧栏导航
	// —— 顶部动作与筛选 ——
	"New issue", // → 新建议题
	"Search Issues", // → 搜索议题
	"Author", // → 作者
	"Issue creation is restricted in this repository",
	// —— 列表行里的状态片段（整句被拆成「用户 / opened / 相对时间」）——
	"opened ",
	" opened ",
	// —— 无障碍播报（sr-only，实机上照常翻译）——
	"Status: Open.",
	"\n    To pick up a draggable item, press the space bar.\n    While dragging, use the arrow keys to move the item.\n    Press space again to drop the item in its new position, or press escape to cancel.\n  ",
	// —— 标签选择器里的标签**描述**（实机确实是这些原文，词典有意收录）——
	"Issues found in a recent release of VS Code",
	"Issue requires more information from poster",
	"Issue identified by VS Code Team member as probable bug",
];

/** 用户内容：仓库名、议题标题、自定义标签名与搜索语句必须保留英文 */
const USER_CONTENT: readonly string[] = [
	"microsoft",
	"vscode",
	// 标签**名字**由维护者自定义，不收（描述收，见上）
	"bug",
	// 议题标题（含 VS Code 字样，但整句是用户内容）
	"Evolving the VS Code Interface",
	"Extension host did not start (debugBrk: true) on macOS — js-debug polls ::1 while the extension host listens on 127.0.0.1",
	// 搜索框里的过滤语句与裸 token
	"is:issue state:open ",
	"issue",
];

/**
 * 新版 React 议题页的工具栏与空结果态（2026-10-23 维护者贴的实机 DOM）。
 * 与上面 2026-09 的旧列表页不同：筛选面板标题用单数（Filter by label /
 * project / milestone），排序菜单也换成了「Created on / Last updated /
 * Total comments / Best match / Reactions」这一组，旧键一条都命不中。
 */
const REACT_TOOLBAR_NODES: readonly string[] = [
	// —— 空结果态（Blankslate）——
	"No results matched your search",
	"Try a different search query.",
	// 2026-10-24 实机：下面这条**链接文本**在新版里被 React 拆成三段（见
	// 「renders the empty-state link across its split nodes」），整句只是旧版
	// 渲染（2026-09 抓取）的形态——两种并存，各自的词条都要命中。
	"Learn more about searching and filtering issues and pull requests.",
	// —— 标签面板 ——
	"Filter by label",
	"Recent",
	// —— 项目面板 ——
	"Filter by project",
	"No projects were found",
	"Please try a different search query.",
	// —— 里程碑面板 ——
	"Filter by milestone",
	"No milestone",
	"Milestone results",
	// —— 指派面板 ——
	"No assignees",
	// —— 排序菜单 ——
	"Created on",
	"Last updated",
	"Total comments",
	"Best match",
	"Reactions",
];

/** 只出现在 placeholder 上的文案（属性只走整串精确匹配，实机按归一化后的键命中） */
const REACT_TOOLBAR_ATTRS: readonly string[] = [
	"Filter authors",
	"Filter labels",
	"Filter projects",
	"Filter milestones", // 实机原文带尾随空格
	"Filter assignees",
];

/**
 * 议题视图管理页（/issues/views，2026-10-24 维护者实机 HTML）。
 * 路由被 pages/issues 的前缀路由覆盖。页头 h1「视图」、侧栏 tooltip、
 * 「私有」分组标题由 GitHub 自译（不登记）；Shared 分组标题上游没译。
 */
const VIEWS_PAGE_NODES: readonly (readonly [
	string,
	string,
])[] = [
	["New view", "新建视图"],
	["Collapse Private", "收起私有"],
	["Collapse Shared", "收起共享"],
	["Shared", "共享"],
	["No private views yet", "还没有私有视图"],
	["Create a private view", "创建私有视图"],
	["to track your work.", "以跟踪你的工作。"],
	["No shared views yet", "还没有共享视图"],
	["Create a shared view", "创建共享视图"],
	[
		"for everyone in this repository.",
		"供此仓库的所有人使用。",
	],
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/** 把一段实机节点序列按 walker 的语义拼回页面上真实看到的那一行 */
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

describe("议题列表页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of ISSUES_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(variant, view);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("keeps the repository name and maintainer labels in english", () => {
		for (const raw of USER_CONTENT) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("keeps the fragment's own whitespace meaning: opened + relative time", () => {
		// 列表行是「用户名 / "opened " / 相对时间」三个节点；"opened " 这条
		// 带尾部空格，译文必须能在后面接上相对时间节点
		expect(translateText("opened ", view)).toBe("打开");
		expect(translateText(" opened ", view)).toBe("打开");
	});

	it("translates the filters that live in the overflow menu", () => {
		// 同一批筛选项在窄屏与宽屏下是两组节点（一组带源码缩进）
		expect(translateText("Labels", view)).toBe("标签");
		expect(translateText("\nLabels\n", view)).toBe("标签");
		expect(translateText("Milestones", view)).toBe(
			"里程碑",
		);
	});

	it("translates the new React filter panels, sort menu and empty state", () => {
		for (const node of [
			...REACT_TOOLBAR_NODES,
			...REACT_TOOLBAR_ATTRS,
		]) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(variant, view);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("renders the empty-state sentence as one readable line", () => {
		// 实机是两个节点：说明句（带尾随空格）+ 链接文本
		expect(
			renderNodes([
				"Try a different search query. ",
				"Learn more about searching and filtering issues and pull requests.",
			]),
		).toBe(
			"请尝试其他搜索查询。 详细了解如何搜索和筛选议题与拉取请求。",
		);
	});

	it("renders the empty-state link across its split nodes", () => {
		// 2026-10-24 实机：同一链接在新版里被 React 拆成三段——前段（尾带一个空格）、
		// 中段（无句号）、句号（独立纯符号节点，按判定规则 3 不收录，保持英文）。
		// 整句键在实机永不命中，必须靠碎片词条。前段尾随空格由引擎保留
		// （applyTextNode / renderNodes 的 lead + trail），译文不得自带首尾空白。
		expect(
			translateText(
				"Learn more about searching and filtering ",
				view,
			),
		).toBe("详细了解如何搜索和筛选");
		expect(
			translateText("issues and pull requests", view),
		).toBe("议题与拉取请求");
		expect(translateText(".", view)).toBeNull();
		expect(
			renderNodes([
				"Learn more about searching and filtering ",
				"issues and pull requests",
				".",
			]),
		).toBe("详细了解如何搜索和筛选 议题与拉取请求.");
	});

	it("covers the views management page", () => {
		// /issues/views 被 pages/issues 的前缀路由覆盖（若上游改路由，
		// 这里会先红——视图页整页回退英文就是路由断了）
		expect(
			matchModules(
				"/Koishi-CE/koishi/issues/views",
				dictForLocale("zh-CN").modules,
			).map((module) => module.name),
		).toContain("pages/issues");
		for (const [node, expected] of VIEWS_PAGE_NODES) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, view),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
		// 两个空状态的说明句：链接 + 后续说明两节点，后续说明原文带前导空格
		// （引擎保留）；句号在节点**内部**（不同于上面那条的独立句号节点），
		// 随节点一起译成中文句号
		expect(
			renderNodes([
				"Create a private view",
				" to track your work.",
			]),
		).toBe("创建私有视图 以跟踪你的工作。");
		expect(
			renderNodes([
				"Create a shared view",
				" for everyone in this repository.",
			]),
		).toBe("创建共享视图 供此仓库的所有人使用。");
		// 分组标题旁的 sr-only 计数「(0)」是纯符号 + 数字节点，不收录
		expect(translateText("(0)", view)).toBeNull();
		// 「Collapse Private / Shared」tooltip 是固定文案整节点（分组名非用户内容）
		expect(translateText("Collapse Private", view)).toBe(
			"收起私有",
		);
	});

	it("keeps the sort menu's meaning clear", () => {
		expect(translateText("Created on", view)).toBe(
			"创建时间",
		);
		expect(translateText("Last updated", view)).toBe(
			"最近更新",
		);
		expect(translateText("Total comments", view)).toBe(
			"评论总数",
		);
		expect(translateText("Reactions", view)).toBe("回应");
	});
});
