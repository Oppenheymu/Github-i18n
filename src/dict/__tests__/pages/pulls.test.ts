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

	it("renders the empty-state link across its split nodes", () => {
		// 2026-10-25 实机截图：同一帮助链接在新版里被拆成三段——前段（尾带一个空格）、
		// 中段（无句号）、句号（独立纯符号节点，不收录，保持英文）。整句键在实机
		// 永不命中，必须靠碎片词条。前段与 issues 模块的同名键同译；前段尾随空格
		// 由引擎保留（applyTextNode 的 lead + trail）
		expect(
			translateText(
				"Learn more about searching and filtering ",
				view,
			),
		).toBe("详细了解如何搜索和筛选");
		expect(translateText("pull requests", view)).toBe(
			"拉取请求",
		);
		expect(translateText(".", view)).toBeNull();
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
		// 拆节点形态的日语模板：「詳しくは、」+「プルリクエストの検索と絞り込み」
		// （语序决策与 issues 同款：谓语整体放进中段）
		expect(
			translateText(
				"Learn more about searching and filtering ",
				japanese,
			),
		).toBe("詳しくは、");
		expect(translateText("pull requests", japanese)).toBe(
			"プルリクエストの検索と絞り込み",
		);
	});
});

// —— PR 详情页的合并区与各下拉（维护者 2026-10-31 实机 HTML + 截图）——
//
// 快捷键提示是**五节点**结构：`Press ` + <kbd>h</kbd> + ` to cycle through
// filters, ` + <br> + ` even when the dropdown is closed`——applyKbdLabel 只管
// 三段结构，三段碎片各自查表；<br> 是元素节点（不产生文本），kbd 内文本由排除
// 清单保护（此处 h 无词条，等价）。审查者弹层标题的数字动态，走规则。
describe("PR 详情页的合并区与各下拉", () => {
	it("translates the five-node shortcut hint through its fragments", () => {
		// zh 按节点顺序直排。translateText 是纯函数只返回译文，节点首尾空白的
		// 保留发生在 applyTextNode 写回时（renderNodes 型 helper 才复刻它）
		expect(translateText("Press", view)).toBe("按");
		expect(
			translateText(" to cycle through filters, ", view),
		).toBe("循环切换筛选器，");
		expect(
			translateText(
				" even when the dropdown is closed",
				view,
			),
		).toBe("即使下拉菜单处于关闭状态");
		// kbd 内文本与 <br> 都不产生可翻译文本
		expect(translateText("h", view)).toBeNull();
	});

	it("renders the reviewer request dialog title through the rule", () => {
		// 实机形态（维护者 2026-10-31 HTML：「Request up to 15 reviewers」）
		expect(
			translateText("Request up to 15 reviewers", view),
		).toBe("请求最多 15 位审查者");
		// 单数 reviewers? 按 hours? 先例放宽；英文单数形态无实机证据，
		// 这里只锁规则本身的放宽行为
		expect(
			translateText("Request up to 1 reviewer", view),
		).toBe("请求最多 1 位审查者");
	});

	it("translates the merge box, dropdowns and sidebar entries", () => {
		const NODES: readonly (readonly [string, string])[] = [
			["Show all activities", "显示全部动态"],
			["Hide events", "隐藏事件"],
			[
				"Hide events, bots, collapsed comments",
				"隐藏事件、机器人、折叠的评论",
			],
			[
				"Merge without waiting for requirements to be met (bypass rules)",
				"无需等待满足条件即可合并（绕过规则）",
			],
			[
				"Bypass rules and merge (squash)",
				"绕过规则并合并（squash）",
			],
			["Update branch", "更新分支"],
			["Update with merge commit", "用合并提交更新"],
			[
				"The merge commit will be associated with your account.",
				"合并提交将关联到你的帐户。",
			],
			["Update with rebase", "用变基更新"],
			[
				"This pull request will be rebased on top of the latest changes and then force pushed.",
				"此拉取请求将变基到最新更改之上，然后强制推送。",
			],
			["Merge status", "合并状态"],
			["Checkout with GitHub CLI", "使用 GitHub CLI 检出"],
			[
				"Work fast with our official CLI.",
				"用我们的官方 CLI 快速工作。",
			],
			[
				"Open in GitHub Copilot app",
				"在 GitHub Copilot 应用中打开",
			],
			[
				"Checkout with GitHub Desktop",
				"使用 GitHub Desktop 检出",
			],
			// 通知 shelf 顶栏（Back to notifications 在 global，见 global.test.ts）
			["Mark as unread", "标记为未读"],
			["Mark as read", "标记为已读"],
			// merge 区与右侧栏
			["Merge when ready", "就绪后合并"],
			["Merging is blocked", "合并被阻止"],
			[
				"At least 1 approving review is required by reviewers with write access.",
				"需要至少 1 名具有写权限的审查者批准。",
			],
			[
				"No reviews—at least 1 approving review is required.",
				"暂无审查——至少需要 1 个批准审查。",
			],
			["Still in progress?", "仍在进行中？"],
			["Convert to draft", "转换为草稿"],
			["Lock conversation", "锁定对话"],
			["Archive pull request", "归档拉取请求"],
			[
				"Add your comment here, be kind",
				"在这里添加你的评论，请友善",
			],
			[
				"You're receiving notifications because you're watching this repository.",
				"你正在接收通知，因为你正在关注此仓库。",
			],
		];
		for (const [node, expected] of NODES) {
			expect(
				translateText(node, view),
				`节点 ${JSON.stringify(node)}`,
			).toBe(expected);
		}
	});

	it("has japanese templates too", () => {
		const japanese = buildView(
			"/microsoft/vscode/pulls",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		// ja 端点承载「次のキーを押すと…同様です」框架（语序倒装）
		expect(translateText("Press", japanese)).toBe(
			"次のキーを押すと ",
		);
		expect(
			translateText(
				" to cycle through filters, ",
				japanese,
			),
		).toBe("でフィルターを順に切り替えられ、");
		expect(
			translateText(
				" even when the dropdown is closed",
				japanese,
			),
		).toBe("ドロップダウンが閉じていても同様です");
		expect(
			translateText("Request up to 15 reviewers", japanese),
		).toBe("最大 15 名のレビュアーにリクエスト");
		expect(
			translateText(
				"Bypass rules and merge (squash)",
				japanese,
			),
		).toBe("ルールをバイパスしてマージ（squash）");
		expect(translateText("Update branch", japanese)).toBe(
			"ブランチを更新",
		);
		expect(translateText("Mark as unread", japanese)).toBe(
			"未読としてマーク",
		);
	});
});

// —— PR 详情页合并后横幅、时间线事件与侧栏下拉（维护者 2026-10-31 第二批实机
// HTML + 截图）——
//
// 通知订阅说明的撇号被上游改成弯撇号（’ U+2019），原直线撇号键在实机永不命中，
// 走 aliases 映射复用旧译文；合并队列提示是五节点（text + link + text +
// <code>main</code> + text），main 是分支名用户内容原样保留；时间线事件的用户名、
// 哈希与标签徽章同理。「Pro tip!」GitHub 已自译（专业提示！），不重复登记。
describe("PR 详情页合并后横幅、时间线事件与侧栏下拉", () => {
	it("maps the reworded notification reason through the alias", () => {
		// 弯撇号（U+2019）是当前实机 DOM 形态；直线撇号（U+0027）是历史渲染形态
		expect(
			translateText(
				"You’re receiving notifications because you’re watching this repository.",
				view,
			),
		).toBe("你正在接收通知，因为你正在关注此仓库。");
		expect(
			translateText(
				"You're receiving notifications because you're watching this repository.",
				view,
			),
		).toBe("你正在接收通知，因为你正在关注此仓库。");
	});

	it("translates the merged banner and the command line note", () => {
		const NODES: readonly (readonly [string, string])[] = [
			[
				"Pull request successfully merged and closed",
				"拉取请求已成功合并并关闭",
			],
			[
				"You're all set — the branch has been merged.",
				"一切就绪——分支已合并。",
			],
			[
				"You can also merge this with the command line.",
				"也可以通过命令行合并。",
			],
			[
				"View command line instructions.",
				"查看命令行说明。",
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

	it("assembles the merge queue note around the branch name", () => {
		// 五节点：「This repository uses the 」+ <a>merge queue</a> +
		// 「 for all merges into the 」+ <code>main</code> + 「 branch.」——
		// main 是分支名（用户内容）原样保留，末节点句号随节点译出
		expect(
			translateText("This repository uses the ", view),
		).toBe("本仓库使用");
		expect(translateText("merge queue", view)).toBe(
			"合并队列",
		);
		expect(
			translateText("for all merges into the ", view),
		).toBe("来完成对");
		expect(translateText("main", view)).toBeNull();
		expect(translateText(" branch.", view)).toBe(
			"分支的所有合并。",
		);
	});

	it("translates the timeline event fragments around user content", () => {
		// 「Oppenheymu merged commit 695e017 into main」：哈希与分支名原样保留
		expect(translateText("merged commit", view)).toBe(
			"合并了提交",
		);
		expect(translateText("into", view)).toBe("至");
		expect(translateText("695e017", view)).toBeNull();
		// 「github-actions assigned Oppenheymu」
		expect(translateText("assigned", view)).toBe("指派了");
		// 「github-actions added <徽章> labels」
		expect(translateText("added", view)).toBe("添加了");
		expect(translateText("labels", view)).toBe("标签");
		// 「deleted the <ref> branch」的收尾节点
		expect(translateText(" branch", view)).toBe("分支");
		// 检查摘要数字动态（「13 checks passed」实机截图）；单数按 reviewers? 先例放宽
		expect(translateText("13 checks passed", view)).toBe(
			"已通过 13 项检查",
		);
		expect(translateText("1 check passed", view)).toBe(
			"已通过 1 项检查",
		);
	});

	it("translates the sidebar dropdowns and the bypass confirm button", () => {
		const NODES: readonly (readonly [string, string])[] = [
			[
				"Assign up to 10 people to this pull request",
				"最多可将 10 人指派给此拉取请求",
			],
			["Clear assignees", "清除指派人"],
			[
				"Apply labels to this pull request",
				"为此拉取请求应用标签",
			],
			[
				"Confirm bypass rules and merge (squash)",
				"确认绕过规则并合并（squash）",
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

	it("renders the comment footer across its split nodes", () => {
		// 「Remember, contributions … its + contributing guidelines + , +
		// security policy + , and + code of conduct + .」——逗号与句号是独立纯符号
		// 节点不收录（保持英文），连接节点 , and 单独收
		expect(
			translateText(
				"Remember, contributions to this repository should follow its",
				view,
			),
		).toBe("请记住，对本仓库的贡献应遵循其");
		expect(
			translateText("contributing guidelines", view),
		).toBe("贡献指南");
		expect(translateText("security policy", view)).toBe(
			"安全策略",
		);
		expect(translateText("code of conduct", view)).toBe(
			"行为准则",
		);
		expect(translateText(", and", view)).toBe("和");
		expect(translateText(", ", view)).toBeNull();
		expect(translateText(".", view)).toBeNull();
		// protip 行：「Pro tip!」GitHub 已自译；链接文本 Files changed 本模块已有
		expect(
			translateText(
				"Add comments to specific lines under",
				view,
			),
		).toBe("在以下位置对具体行添加评论：");
	});

	it("has japanese templates for the new fragments", () => {
		const japanese = buildView(
			"/microsoft/vscode/pulls",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(
			translateText(
				"You’re receiving notifications because you’re watching this repository.",
				japanese,
			),
		).toBe(
			"このリポジトリをウォッチしているため、通知が届いています。",
		);
		// マージキュー注記：語序の都合で末ノードに述語を置く（端点承载）
		expect(
			translateText("This repository uses the ", japanese),
		).toBe("このリポジトリでは");
		expect(translateText("merge queue", japanese)).toBe(
			"マージキュー",
		);
		expect(
			translateText("for all merges into the ", japanese),
		).toBe("を、");
		expect(translateText(" branch.", japanese)).toBe(
			" ブランチへのすべてのマージに使用します。",
		);
		expect(translateText("merged commit", japanese)).toBe(
			"がマージしたコミット",
		);
		expect(translateText("into", japanese)).toBe(
			"のマージ先：",
		);
		expect(translateText("assigned", japanese)).toBe(
			"がアサイン：",
		);
		expect(translateText("added", japanese)).toBe("が");
		expect(translateText("labels", japanese)).toBe(
			"のラベルを追加",
		);
		expect(translateText(" branch", japanese)).toBe(
			"ブランチ",
		);
		expect(
			translateText("13 checks passed", japanese),
		).toBe("チェック 13 件に合格");
		expect(translateText(", and", japanese)).toBe("および");
		expect(
			translateText(
				"Add comments to specific lines under",
				japanese,
			),
		).toBe(
			"次のタブで具体的な行にコメントを追加できます：",
		);
	});
});
