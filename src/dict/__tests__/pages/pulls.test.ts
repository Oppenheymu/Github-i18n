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

// —— PR 详情页合并框的 out-of-date 态（维护者 2026-11-01 实机 HTML）——
//
// 落后说明是五节点：`It’s ` + <a>2 commits</a>（既有 repo/commits-count 规则）
// + ` behind (base commit: ` + <code><a>哈希</a></code>（用户内容原样保留）+ `)`
// （独立纯符号节点不收，右括号保持 ASCII，左括号随碎片节点同用 ASCII 配对）。
// 指引句的基线分支名与合并者用户名动态，走规则。
describe("PR 详情页合并框的 out-of-date 态", () => {
	it("assembles the behind note around the commit count and hash", () => {
		expect(
			translateText(
				"This branch is out-of-date with the base branch",
				view,
			),
		).toBe("此分支落后于基线分支");
		expect(translateText("It’s", view)).toBe("落后");
		// 「2 commits」由既有 repo/commits-count 规则接住，这里锁住拼装链路
		expect(translateText("2 commits", view)).toBe(
			"2 次提交",
		);
		expect(
			translateText(" behind (base commit: ", view),
		).toBe("(基线提交:");
		// 哈希与右括号原样保留
		expect(translateText("42bce3f", view)).toBeNull();
		expect(translateText(")", view)).toBeNull();
	});

	it("translates the merge instruction through the rule", () => {
		// 实机形态：基线分支名与合并者用户名都是动态内容
		expect(
			translateText(
				"Merge the latest changes from main into this branch. This merge commit will be associated with Oppenheymu.",
				view,
			),
		).toBe(
			"将 main 的最新更改合并到此分支。此合并提交将关联到 Oppenheymu。",
		);
	});

	it("has japanese templates for the out-of-date fragments", () => {
		const japanese = buildView(
			"/microsoft/vscode/pulls",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(
			translateText(
				"This branch is out-of-date with the base branch",
				japanese,
			),
		).toBe("このブランチはベースブランチより遅れています");
		expect(translateText("It’s", japanese)).toBe("これは");
		expect(translateText("2 commits", japanese)).toBe(
			"2 件のコミット",
		);
		expect(
			translateText(" behind (base commit: ", japanese),
		).toBe("遅れ (ベースコミット:");
		expect(
			translateText(
				"Merge the latest changes from main into this branch. This merge commit will be associated with Oppenheymu.",
				japanese,
			),
		).toBe(
			"このブランチに main の最新の変更をマージしてください。このマージコミットは Oppenheymu に関連付けられます。",
		);
	});
});

// —— PR 详情页 checks 区部署空态与合并框表单标签（维护者 2026-11-01 实机 HTML）——
//
// 部署空态是 h3（status-heading）与 status-meta 副文本两个整节点，静态收；
// 合并框的 Commit message / Extended description / Commit email 是三个
// FormControl 标签，各自整节点静态收。
describe("PR 详情页 checks 区部署空态与合并框表单标签", () => {
	it("translates the deployment empty state nodes", () => {
		expect(
			translateText(
				"This branch has not been deployed",
				view,
			),
		).toBe("此分支尚未部署");
		expect(translateText("No deployments", view)).toBe(
			"暂无部署记录",
		);
	});

	it("translates the merge-box form labels", () => {
		expect(translateText("Commit message", view)).toBe(
			"提交信息",
		);
		expect(
			translateText("Extended description", view),
		).toBe("扩展描述");
		expect(translateText("Commit email", view)).toBe(
			"提交邮箱",
		);
	});

	it("has japanese templates for both areas", () => {
		const japanese = buildView(
			"/microsoft/vscode/pulls",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(
			translateText(
				"This branch has not been deployed",
				japanese,
			),
		).toBe("このブランチはまだデプロイされていません");
		expect(translateText("No deployments", japanese)).toBe(
			"デプロイはありません",
		);
		expect(translateText("Commit message", japanese)).toBe(
			"コミットメッセージ",
		);
		expect(
			translateText("Extended description", japanese),
		).toBe("拡張説明");
		expect(translateText("Commit email", japanese)).toBe(
			"コミットメールアドレス",
		);
	});
});

// —— 提交签名弹层（维护者 2026-11-02 实机 HTML）——
//
// PR 页与提交页共用同一个签名弹层。句子的 `<strong>verified signature</strong>`
// 是**同一个文本节点**，但前后文有两种来源：
//   GitHub 代签：`This commit was created on GitHub.com and signed with GitHub’s` + …
//   提交者自签：`This commit was signed with the committer’s` + …
// 因此共享片段必须只承担「名词 + 动词」，两种前文各自以「的」收尾。
// 反例：修复前 PR 页渲染成 `This commit was signed with the committer’s 的已验证签名进行签名.`
//（前半句未收录、共享片段自带前导「的」）。
describe("PR 页提交签名弹层的两种来源", () => {
	const prDetail = buildView(
		"/microsoft/vscode/pull/1",
		dictForLocale("zh-CN"),
		new Map(Object.entries(dictCore.aliases)),
	);

	it("assembles the committer-signed sentence from its two nodes", () => {
		expect(
			translateText(
				"This commit was signed with the committer’s",
				prDetail,
			),
		).toBe("此提交由提交者的");
		expect(
			translateText("verified signature", prDetail),
		).toBe("已验证签名签署");
	});

	it("keeps the GitHub-signed sentence readable through the shared fragment", () => {
		expect(
			translateText(
				"This commit was created on GitHub.com and signed with GitHub’s",
				prDetail,
			),
		).toBe("此提交创建于 GitHub.com，并由 GitHub 的");
		expect(
			translateText("verified signature", prDetail),
		).toBe("已验证签名签署");
	});

	it("has japanese fragments for both sources", () => {
		const japanese = buildView(
			"/microsoft/vscode/pull/1",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(
			translateText(
				"This commit was signed with the committer’s",
				japanese,
			),
		).toBe("このコミットはコミッターの");
		expect(
			translateText("verified signature", japanese),
		).toBe("検証済み署名で署名されています");
	});
});

// —— PR 页代码空间警告横幅、侧栏与通知订阅控件（维护者 2026-11-02 实机 HTML）——
//
// 节点边界：
//   · 横幅标题在 `prc-VisuallyHidden` 的 h2 里（sr-only 照常翻译），说明句整节点；
//   · 侧栏 `assign yourself` 是**小写 a**（`js-issue-assign-self`），与 pages/issues 的
//     `Assign yourself`（大写 A）是两个不同键，PR 路由不命中 pages/issues；
//   · `Development` 是侧栏分区标题；`Customize` / `None` 是通知订阅区块的入口与档位；
//   · 代码空间菜单的 `Set up prebuilds` 收在 pages/repo（PR 页同样命中该模块）。
describe("PR 页侧栏、通知订阅控件与代码空间警告横幅", () => {
	it("translates the sidebar and notification nodes", () => {
		expect(translateText("assign yourself", view)).toBe(
			"指派给自己",
		);
		expect(translateText("Development", view)).toBe("开发");
		expect(translateText("Customize", view)).toBe("自定义");
		expect(translateText("None", view)).toBe("无");
	});

	it("translates the codespace warning banner including its sr-only title", () => {
		expect(
			translateText("Pull request warning", view),
		).toBe("拉取请求警告");
		expect(
			translateText(
				"This pull request must be reopened to create new codespaces on it.",
				view,
			),
		).toBe(
			"必须重新打开此拉取请求，才能在其中创建新的代码空间。",
		);
	});

	it("translates the prebuild entry that lives in the repo module", () => {
		expect(translateText("Set up prebuilds", view)).toBe(
			"设置预构建",
		);
	});

	it("has japanese entries for the same nodes", () => {
		const japanese = buildView(
			"/microsoft/vscode/pull/1",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(translateText("None", japanese)).toBe("なし");
		expect(translateText("Customize", japanese)).toBe(
			"カスタマイズ",
		);
		expect(translateText("assign yourself", japanese)).toBe(
			"自分を担当者に設定",
		);
		expect(
			translateText(
				"This pull request must be reopened to create new codespaces on it.",
				japanese,
			),
		).toBe(
			"このプルリクエストで新しいコードスペースを作成するには、再度オープンする必要があります。",
		);
	});
});

// —— Files changed 页与 Finish your review 弹层（维护者 2026-11-03 截图 + 实机 HTML）——
//
// 节点边界：
//   · 审查邀请横幅：`<a>dependabot[bot]</a>` + `requested your review on this pull
//     request.`——用户名是用户内容不收，句号在本节点内；
//   · 代码所有者等待句有两种实机形态：用户名是纯文本时整句一个节点（走规则
//     pulls/code-owner-waiting），用户名是链接时只剩前缀节点（走静态键）；
//   · 生成文件提示被 `<a>` 切成两段，句号是独立纯符号节点（不收，保持 ASCII）；
//   · 文件树的 `Filter files...` 与评论框一样是 placeholder 属性文案；
//   · `Viewed` 与 settings-security 的同名键不同页，两模块路由互斥、同译。
describe("Files changed 页与审查弹层", () => {
	const files = buildView(
		"/microsoft/vscode/pull/54/files",
		dictForLocale("zh-CN"),
		new Map(Object.entries(dictCore.aliases)),
	);

	it("translates the review invitation banner and the approval requirement", () => {
		expect(
			translateText(
				"requested your review on this pull request.",
				files,
			),
		).toBe("请求你审查此拉取请求。");
		expect(
			translateText(
				"At least 1 approving review is required to merge this pull request.",
				files,
			),
		).toBe("合并此拉取请求至少需要 1 个批准审查。");
		// 复数 + are 形态（批准数来自分支保护配置）
		expect(
			translateText(
				"At least 2 approving reviews are required to merge this pull request.",
				files,
			),
		).toBe("合并此拉取请求至少需要 2 个批准审查。");
	});

	it("keeps the code owner name in english while translating the sentence", () => {
		expect(
			translateText(
				"Waiting on code owner review from Oppenheymu.",
				files,
			),
		).toBe("正在等待 Oppenheymu 的代码所有者审查。");
		// 用户名被拆成链接时的前缀节点
		expect(
			translateText(
				"Waiting on code owner review from",
				files,
			),
		).toBe("正在等待代码所有者审查：");
	});

	it("translates the finish your review dialog", () => {
		expect(translateText("Add your review", files)).toBe(
			"添加你的审查",
		);
		expect(translateText("Finish your review", files)).toBe(
			"完成你的审查",
		);
		expect(
			translateText(
				"Submit general feedback without explicit approval.",
				files,
			),
		).toBe("提交总体反馈，不明确批准。");
		expect(
			translateText(
				"Submit feedback and approve merging these changes.",
				files,
			),
		).toBe("提交反馈并批准合并这些更改。");
		expect(
			translateText(
				"Submit feedback suggesting changes.",
				files,
			),
		).toBe("提交反馈，建议修改。");
		// 提交按钮的键早已在页头存在，弹层复用的是同一个节点文案
		expect(translateText("Submit review", files)).toBe(
			"提交审查",
		);
	});

	it("translates the diff toolbar, file menu and diff settings", () => {
		expect(translateText("All commits", files)).toBe(
			"所有提交",
		);
		expect(translateText("Filter files...", files)).toBe(
			"筛选文件…",
		);
		expect(translateText("Viewed", files)).toBe("已查看");
		expect(translateText("0 / 2 viewed", files)).toBe(
			"已查看 0 / 2",
		);
		expect(translateText("Load Diff", files)).toBe(
			"加载差异",
		);
		expect(translateText("Layout", files)).toBe("布局");
		expect(translateText("Unified", files)).toBe("统一");
		expect(translateText("Split", files)).toBe("拆分");
		expect(translateText("Whitespace changes", files)).toBe(
			"空白字符更改",
		);
		expect(translateText("Always show", files)).toBe(
			"始终显示",
		);
		expect(translateText("Minimize comments", files)).toBe(
			"最小化评论",
		);
		expect(
			translateText("Compact line height", files),
		).toBe("紧凑行高");
	});

	it("assembles the generated-files notice from its two nodes", () => {
		expect(
			translateText(
				"Some generated files are not rendered by default. Learn more about",
				files,
			),
		).toBe("默认不会渲染部分生成的文件。了解如何");
		expect(
			translateText(
				"customizing how changed files appear on GitHub",
				files,
			),
		).toBe("自定义 GitHub 上变更文件的显示方式");
	});

	it("translates the commit selection dialog", () => {
		expect(
			translateText("Select commits to view", files),
		).toBe("选择要查看的提交");
		expect(
			translateText(
				"Changes since your last review",
				files,
			),
		).toBe("自你上次审查以来的更改");
		expect(
			translateText("No previous review found", files),
		).toBe("未找到之前的审查");
		expect(
			translateText("Select a range of commits", files),
		).toBe("选择提交范围");
	});

	it("has japanese entries for the same nodes", () => {
		const japanese = buildView(
			"/microsoft/vscode/pull/54/files",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(
			translateText(
				"Waiting on code owner review from Oppenheymu.",
				japanese,
			),
		).toBe(
			"Oppenheymu によるコードオーナーレビューを待機しています。",
		);
		expect(
			translateText(
				"At least 1 approving review is required to merge this pull request.",
				japanese,
			),
		).toBe(
			"このプルリクエストをマージするには、少なくとも 1 件の承認レビューが必要です。",
		);
		expect(translateText("0 / 2 viewed", japanese)).toBe(
			"0 / 2 確認済み",
		);
		expect(
			translateText(
				"Some generated files are not rendered by default. Learn more about",
				japanese,
			),
		).toBe(
			"一部の生成ファイルは既定ではレンダリングされません。詳しくは",
		);
		expect(translateText("Load Diff", japanese)).toBe(
			"差分を読み込む",
		);
		expect(translateText("Filter files...", japanese)).toBe(
			"ファイルを絞り込む…",
		);
	});
});

// —— 会话页时间线事件、已关闭态与评论菜单（维护者 2026-11-03 截图 + 实机 HTML）——
//
// 节点边界：
//   · 时间线事件是多节点拼装：用户名 / 分支名 / 哈希 / 时间戳都是用户内容或
//     <relative-time>（会自行重渲染），只收中间的功能碎片；
//   · 「dismissed <user>’s stale review via <sha>」两段语序不同：zh 谓语在前段、
//     ja 谓语在后段（引擎不重排节点）；
//   · 「commented on behalf of <组织>」里的 <strong>github</strong> 是用户内容；
//   · protip 的 `.patch` / `.diff` 是两个链接，尾段是一整个文本节点。
describe("会话页时间线事件与已关闭态", () => {
	it("translates the closed merge box", () => {
		expect(
			translateText("Closed with unmerged commits", view),
		).toBe("已关闭，存在未合并的提交");
		expect(
			translateText("This pull request is closed.", view),
		).toBe("此拉取请求已关闭。");
		expect(translateText("Restore branch", view)).toBe(
			"恢复分支",
		);
		// data-disable-with 在提交中替换按钮文案
		expect(translateText("Restoring...", view)).toBe(
			"正在恢复…",
		);
	});

	it("translates the merge box loading state", () => {
		expect(
			translateText(
				"Checking for the ability to merge automatically...",
				view,
			),
		).toBe("正在检查能否自动合并…");
		expect(
			translateText(
				"Hang in there while we check the branch's status.",
				view,
			),
		).toBe("请稍候，我们正在检查此分支的状态。");
	});

	it("translates the review and merge-queue timeline events", () => {
		expect(
			translateText(
				"previously approved these changes",
				view,
			),
		).toBe("曾批准这些更改");
		expect(
			translateText("View reviewed changes", view),
		).toBe("查看审查过的更改");
		expect(
			translateText("added this pull request to the", view),
		).toBe("将此拉取请求添加到");
		expect(
			translateText(
				"removed this pull request from the",
				view,
			),
		).toBe("将此拉取请求从");
		expect(
			translateText(
				"due to a conflict with the base branch",
				view,
			),
		).toBe("中移除，因为与基线分支存在冲突");
	});

	it("keeps the dismissal sentence readable across its fragments", () => {
		expect(translateText("dismissed", view)).toBe("驳回了");
		// 弯撇号是实机形态（`’s stale review via`）
		expect(translateText("'s stale review via", view)).toBe(
			"的过期审查，依据",
		);
	});

	it("translates both force-push fragments and the closed event", () => {
		expect(translateText("force-pushed the", view)).toBe(
			"强制推送了",
		);
		expect(translateText("branch from", view)).toBe(
			"分支，从",
		);
		expect(translateText("to", view)).toBe("到");
		expect(translateText("closed this", view)).toBe(
			"关闭了此拉取请求",
		);
	});

	it("translates the comment header and the review request", () => {
		// commented 与 on behalf of 之间只有换行，实机是**同一个文本节点**
		expect(
			translateText(
				"\n\n      commented\n\n        on behalf of ",
				view,
			),
		).toBe("评论了，代表");
		expect(translateText("edited", view)).toBe("已编辑");
		expect(
			translateText("requested a review from", view),
		).toBe("请求以下人员审查：");
		expect(translateText("as a code owner", view)).toBe(
			"作为代码所有者",
		);
	});

	it("translates the comment menu", () => {
		expect(translateText("Quote reply", view)).toBe(
			"引用回复",
		);
		expect(translateText("Report content", view)).toBe(
			"举报内容",
		);
		expect(translateText("Block user", view)).toBe(
			"屏蔽用户",
		);
		expect(
			translateText("View repo at this time", view),
		).toBe("查看此时间点的仓库");
	});

	it("translates the protip tail after the .diff link", () => {
		expect(
			translateText(
				"to the end of URLs for Git’s plaintext views.",
				view,
			),
		).toBe("到 URL 末尾即可查看 Git 的纯文本视图。");
	});

	it("has japanese entries for the same fragments", () => {
		const japanese = buildView(
			"/microsoft/vscode/pull/54",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(translateText("dismissed", japanese)).toBe("が");
		expect(
			translateText("'s stale review via", japanese),
		).toBe("の古いレビューを却下しました:");
		expect(translateText("closed this", japanese)).toBe(
			"がクローズしました",
		);
		expect(
			translateText(
				"Closed with unmerged commits",
				japanese,
			),
		).toBe(
			"未マージのコミットがある状態でクローズされました",
		);
		expect(translateText("Restoring...", japanese)).toBe(
			"復元中…",
		);
	});
});

// 2026-11-04 维护者贴的 PR 时间线 HTML（「action 页面」）暴露的漏翻：
// 合并框就绪态、批准审查事件、代码所有者审查请求的拆节点，以及
// 「added the <标签> label」的三段式。
//
// 边界强度：**实机 HTML 实证**（节点边界直接可见）：
//   · `added` 与 `the` 之间只有换行 ⇒ 同属一个文本节点，整句前缀是 `added the`；
//   · 标签名在链接里，尾巴是小写 `label`（大写 `Label` 是侧栏那条既有键）；
//   · `as a ` 与链接文本 `code owner` 是两个节点，整句键 `as a code owner`
//     只在模拟上游未拆开时命中，两种形态都必须可用。
/** 按 walker 的语义拼接相邻节点（保留每个节点的首尾空白） */
function render(nodes: readonly string[]): string {
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

describe("PR 时间线的合并框就绪态与审查事件", () => {
	it("translates the merge box ready state and the merge button", () => {
		expect(
			translateText("No conflicts with base branch", view),
		).toBe("与基础分支无冲突");
		expect(
			translateText(
				"Merging can be performed automatically.",
				view,
			),
		).toBe("可以自动执行合并。");
		expect(
			translateText("Confirm merge when ready", view),
		).toBe("准备就绪后确认合并");
	});

	it("translates the approval event and keeps the previous-approval one apart", () => {
		expect(
			translateText("approved these changes", view),
		).toBe("批准了这些更改");
		// 两条是**不同的键**：一条首次批准、一条「曾批准」
		expect(
			translateText(
				"previously approved these changes",
				view,
			),
		).toBe("曾批准这些更改");
	});

	it("renders the code-owner review request across its four nodes", () => {
		expect(
			render([
				"请求以下人员审查：",
				"Oppenheymu",
				" as a ",
				"code owner",
			]),
		).toBe("请求以下人员审查：Oppenheymu 作为 代码所有者");
		// 上游若回滚成单节点，整句键仍然可用
		expect(translateText("as a code owner", view)).toBe(
			"作为代码所有者",
		);
	});

	it("renders the label-added event across its three nodes", () => {
		// 标签名是用户内容，原样保留
		expect(
			render(["added the", " 范围:工具链与构建 ", "label"]),
		).toBe("添加了 范围:工具链与构建 标签");
	});
});

// 2026-11-04 维护者贴的第二批 HTML（审查弹层 + 合并面板 + 时间线）。
//
// 两条诊断记录：
//   · `Submit review` 与 `Add your comment here, be kind` **本来就有键**（前者在
//     合并框按钮组、后者在评论框 placeholder），下面的用例先钉住它们可用——
//     截图里仍是英文只可能是加载了旧构建，或该弹层另有节点形态；
//   · `viewed` 是小写、与 Files changed 页的 `Viewed`（大写）是两条键；
//     `codeowner` 在这里是**连写**，与 `code owner` 也是两条键。
describe("PR 审查弹层、合并面板与 codeowner 事件", () => {
	it("already covers the review dialog and its placeholder", () => {
		expect(translateText("Submit review", view)).toBe(
			"提交审查",
		);
		expect(
			translateText("Add your comment here, be kind", view),
		).toBe("在这里添加你的评论，请友善");
	});

	it("translates the lowercase viewed event and the diff settings tooltip", () => {
		expect(translateText("viewed", view)).toBe("已查看");
		expect(translateText("Viewed", view)).toBe("已查看");
		expect(
			translateText("Open diff view settings", view),
		).toBe("打开差异视图设置");
	});

	it("translates the merge panel hints", () => {
		expect(
			translateText(
				"Waiting for a reviewer's approval. Click to view details in the merge panel.",
				view,
			),
		).toBe(
			"正在等待审查者批准。点击以在合并面板中查看详细信息。",
		);
		expect(
			translateText("Not planning to merge?", view),
		).toBe("不打算合并？");
	});

	it("renders the pending review count through the rule", () => {
		expect(translateText("1 pending review", view)).toBe(
			"1 个待处理的审查",
		);
		expect(translateText("3 pending reviews", view)).toBe(
			"3 个待处理的审查",
		);
	});

	it("translates the codeowner review request event", () => {
		// 用户名是用户内容（链接节点），句子骨架整条命中
		expect(
			render([
				"dependabot",
				" was requested for review as a codeowner",
			]),
		).toBe("dependabot 被请求以代码所有者身份进行审查");
	});
});

// 2026-11-05 维护者贴的 PR 页 HTML：推送被分支保护拒绝时的 flash 横幅，以及通知订阅
// 说明的「修改了打开/关闭状态」原因。
//
// 横幅是**三节点**：「…Visit 」+ 链接文本（文本就是个 docs.github.com 的 URL，
// 原样保留）+「 for more information.」；两个碎片键都不能带首尾空格——节点自带的
// 空白由引擎原样保留（`render` 复刻同一逻辑）。
const PUSH_DENIED_URL =
	"https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches";

describe("PR 页的推送拒绝横幅与通知订阅原因", () => {
	it("renders the push-denied flash across its three nodes", () => {
		expect(
			render([
				"You're not authorized to push to this branch. Visit ",
				PUSH_DENIED_URL,
				" for more information.",
			]),
		).toBe(
			`你没有权限推送到此分支。访问 ${PUSH_DENIED_URL} 以了解更多。`,
		);
	});

	it("translates the modified open/close state notification reason", () => {
		// 直撇号是规范键形态
		expect(
			translateText(
				"You're receiving notifications because you modified the open/close state.",
				view,
			),
		).toBe("你正在接收通知，因为你修改了打开/关闭状态。");
		// 实机 DOM 里是弯撇号（’ U+2019），走 aliases 复用同一译文
		expect(
			translateText(
				"You’re receiving notifications because you modified the open/close state.",
				view,
			),
		).toBe("你正在接收通知，因为你修改了打开/关闭状态。");
	});

	it("has japanese entries for both", () => {
		const japanese = buildView(
			"/microsoft/vscode/pull/54",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(
			translateText(
				"You're not authorized to push to this branch. Visit",
				japanese,
			),
		).toBe(
			"このブランチにプッシュする権限がありません。詳細は",
		);
		expect(
			translateText("for more information.", japanese),
		).toBe("をご覧ください。");
		expect(
			translateText(
				"You’re receiving notifications because you modified the open/close state.",
				japanese,
			),
		).toBe(
			"オープン/クローズ状態を変更したため、通知が届いています。",
		);
	});
});

// 2026-11-09 维护者贴的 PR 页实机 HTML（合并框 checks 摘要区）：
//   `<h3 class="MergeBoxSectionHeading__tjMMZz prc-Heading-…">Some checks were not successful</h3>`
//   `<p class="fgColor-muted mb-0">1 failing, 4 skipped, 7 successful checks</p>`
//
// 两条都是**普通文本节点**：维护者右键抓到的 `<button aria-label="Expand checks" …>`
// 是图标按钮（里面只有 `::after` 画的图标），摘要在它的兄弟节点里，不是 SVG 也不是
// 伪元素。标题是独立整节点；计数行**整行就是一个节点**，数字动态，走 rules 的
// pulls/checks-status-* 各组合（同时出现三种状态的那行实证了顺序：失败 → 跳过 → 成功）。
describe("PR 页 checks 摘要标题与计数行", () => {
	it("translates both heading states", () => {
		expect(
			translateText("All checks have passed", view),
		).toBe("所有检查均已通过");
		expect(
			translateText(
				"Some checks were not successful",
				view,
			),
		).toBe("部分检查未成功");
		// 实机节点带源码缩进与换行：translateText 只查表（返回去掉首尾空白的译文），
		// 节点自身的空白由 walker 写回时原样保留（render 复刻同一语义）
		expect(
			translateText(
				"\n      All checks have passed\n    ",
				view,
			),
		).toBe("所有检查均已通过");
		expect(
			render(["\n      All checks have passed\n    "]),
		).toBe("\n      所有检查均已通过\n    ");
	});

	it("translates the count line through the per-combination rules", () => {
		// 实机那行（三种状态同时出现，顺序即 rules 里的顺序）
		expect(
			translateText(
				"1 failing, 4 skipped, 7 successful checks",
				view,
			),
		).toBe("失败 1 项、已跳过 4 项、成功 7 项检查");
		// 双状态组合
		expect(
			translateText("4 skipped, 9 successful checks", view),
		).toBe("已跳过 4 项、成功 9 项检查");
		expect(
			translateText("1 failing, 2 successful checks", view),
		).toBe("失败 1 项、成功 2 项检查");
		expect(
			translateText("1 failing, 2 skipped checks", view),
		).toBe("失败 1 项、已跳过 2 项检查");
		// 单状态（单数 check 也要命中）
		expect(
			translateText("13 successful checks", view),
		).toBe("成功 13 项检查");
		expect(translateText("1 successful check", view)).toBe(
			"成功 1 项检查",
		);
		expect(translateText("2 expected checks", view)).toBe(
			"待运行 2 项检查",
		);
		expect(translateText("1 neutral check", view)).toBe(
			"中性 1 项检查",
		);
	});

	it("leaves the combinations of unknown order in english", () => {
		// expected / neutral 与其他状态**同时出现**时的先后没有实机样张，
		// 宁可留英文，也不写出把数字与状态对错位的规则
		expect(
			translateText(
				"1 failing, 2 expected, 3 successful checks",
				view,
			),
		).toBeNull();
		expect(
			translateText("1 expected, 2 neutral checks", view),
		).toBeNull();
	});

	it("translates the verified-signature line as one node", () => {
		expect(
			translateText(
				"Commits must have verified signatures.",
				view,
			),
		).toBe("提交必须具有已验证的签名。");
		// 句号在节点内部，半句话结构上不可能命中
		expect(
			translateText("Commits must have verified", view),
		).toBeNull();
	});

	it("has japanese entries for the heading, the count line and the signature note", () => {
		const japanese = buildView(
			"/microsoft/vscode/pull/54",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(
			translateText("All checks have passed", japanese),
		).toBe("すべてのチェックが成功しました");
		expect(
			translateText(
				"Some checks were not successful",
				japanese,
			),
		).toBe("一部のチェックが失敗しました");
		expect(
			translateText(
				"1 failing, 4 skipped, 7 successful checks",
				japanese,
			),
		).toBe("失敗 1 件、スキップ 4 件、成功 7 件のチェック");
		expect(
			translateText(
				"Commits must have verified signatures.",
				japanese,
			),
		).toBe("コミットには検証済みの署名が必要です。");
	});
});
