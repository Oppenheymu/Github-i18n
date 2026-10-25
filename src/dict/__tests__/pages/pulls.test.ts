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

/**
 * closed 态列表页（维护者 2026-10-25 实机 HTML）：侧栏五项 + Feedback +
 * Collapse sidebar + 空状态 + React 新版结果行动词碎片。
 *
 * 大半与 pages/issues 同键同译——侧栏是 issues / pulls 两族各自渲染的组件，
 * /pulls 路由吃不到 issues 的键（与「Your personal account」同型的路由互斥）；
 * Authored by me 对应 issues 版 Created by me（GitHub 改了措辞），同语义同译。
 * 空状态的 Learn more 在 PR 页是**单节点整句**（issues 页是三节点碎片，见
 * issues.test.ts），句号在节点内部 → 译文用中文句号收尾。
 */
describe("closed 态列表页的侧栏空状态与结果行", () => {
	it("translates the sidebar entries and the blankslate", () => {
		const NODES: readonly (readonly [string, string])[] = [
			["Authored by me", "我创建的"],
			["Assigned to me", "指派给我的"],
			["Involves me", "与我相关"],
			["Review requests", "审查请求"],
			["Feedback", "反馈"],
			["Collapse sidebar", "收起侧栏"],
			[
				"No pull requests matched your search",
				"没有与你的搜索匹配的拉取请求",
			],
			[
				"Try a different search query.",
				"请尝试其他搜索查询。",
			],
			[
				"Learn more about searching and filtering pull requests.",
				"详细了解如何搜索和筛选拉取请求。",
			],
		];
		for (const [node, expected] of NODES) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, view),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("assembles the merged result line around the bot author", () => {
		// 「by dependabot[bot] was merged <相对时间>」：作者名用户内容原样保留
		expect(translateText("by", view)).toBe("由");
		expect(translateText("was merged", view)).toBe(
			"合并于",
		);
		expect(
			translateText("dependabot[bot]", view),
		).toBeNull();
	});

	it("translates the author filter aria-label through the rule", () => {
		// aria-label 带动态用户名，静态键只覆盖无尾随内容形态
		expect(
			translateText(
				"Filter by author dependabot[bot]",
				view,
			),
		).toBe("按作者 dependabot[bot] 筛选");
		expect(translateText("Filter by author", view)).toBe(
			"按作者筛选",
		);
	});

	it("has japanese templates for the new fragments", () => {
		const japanese = buildView(
			"/microsoft/vscode/pulls",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(translateText("Authored by me", japanese)).toBe(
			"自分が作成",
		);
		expect(translateText("was merged", japanese)).toBe(
			"がマージ済み",
		);
		expect(
			translateText(
				"Filter by author dependabot[bot]",
				japanese,
			),
		).toBe("作成者 dependabot[bot] でフィルター");
	});
});
