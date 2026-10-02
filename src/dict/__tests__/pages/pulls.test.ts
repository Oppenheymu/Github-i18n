// 拉取请求列表页（/owner/repo/pulls）实机文本节点回归。
//
// 节点清单来源：2026-09 无头 Edge 抓 https://github.com/microsoft/vscode/pulls 的
// 真实渲染 DOM（逐节点记录 nodeValue 与父元素路径，再用该路径的 buildView 判定命中）。
//
// 与议题页的差别：PR 页多出「审查状态」这一整组筛选项（Reviews / Review required /
// Approved）与显示密度切换，它们各自是独立文本节点，且只在 PR 页出现。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

/** /microsoft/vscode/pulls 命中的模块视图（pages/pulls + pages/repo + global） */
const view = buildView(
	"/microsoft/vscode/pulls",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机渲染的文本节点原文（逐字录入；末尾是实机译文） */
const PULLS_NODES: readonly string[] = [
	// —— 搜索与筛选 ——
	"Search pull requests", // → 搜索拉取请求
	"Clear filter", // → 清除筛选
	"Author", // → 作者
	"Label", // → 标签
	"Reviews", // → 审查
	"Assignee", // → 指派人
	"Milestones", // → 里程碑
	"Projects", // → 项目
	// —— 排序与密度 ——
	"Newest", // → 最新
	"descending", // → 降序
	"More items", // → 更多条目
	"Comfortable display density", // → 宽松显示密度
	"Compact display density", // → 紧凑显示密度
	// —— 审查状态（PR 页独有）——
	"Review required", // → 需要审查
	"Review required before merging", // → 合并前需要审查
	"Approved", // → 已批准
	// —— 分页 ——
	"Previous", // → 上一页
	"Next", // → 下一页
];

/** 用户内容：仓库名、分支名与 PR 标题必须保留英文 */
const USER_CONTENT: readonly string[] = [
	"microsoft",
	"vscode",
	"main",
	"bug",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

describe("拉取请求列表页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of PULLS_NODES) {
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

	it("keeps owner, branch and label names in english", () => {
		for (const raw of USER_CONTENT) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("translates the trailing counter fragment of a status line", () => {
		// PR 行尾的 "128 Open" 这类计数由规则处理（global/open-count），不是静态词条
		expect(translateText("128 Open", view)).toBe(
			"128 打开",
		);
	});
});
