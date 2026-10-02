// 议题列表页（/owner/repo/issues）实机文本节点回归。
//
// 节点清单来源：2026-09 无头 Edge 抓 https://github.com/microsoft/vscode/issues 的
// 真实渲染 DOM（逐节点记录 nodeValue 与父元素路径，再用该路径的 buildView 判定命中）。
//
// 这一页的价值在于它把自己**拆得极碎**：侧栏折叠、视图下拉、筛选按钮各自成节点，
// 同一句话在窄屏/宽屏是两组不同节点（带不带源码缩进）。整句键在这里必然落空，
// 所以这些清单就是本模块「哪些原文真的存在于 DOM」的唯一依据。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
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

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
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
});
