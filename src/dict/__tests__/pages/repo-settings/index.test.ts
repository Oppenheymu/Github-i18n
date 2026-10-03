// 仓库设置页（/owner/repo/settings）的实机节点回归。
//
// 证据有两批（都是维护者给的**原版 HTML 片段**，不是完整节点 dump，
// 故本文件只锁这些片段覆盖的节点，不声称覆盖整页）：
//   1. 2026-09：「Creation allowed by」筛选按钮——标签、当前值、菜单项三个独立节点；
//   2. 2026-10-03：`/Oppenheymu/Github-i18n/settings` 的议题创建策略 action-list
//      （`action="…/settings/issue_creation_policy"`）与保留期一节（`<h2 id="retention-header">`
//      + `retention-form`）。这一批全是上游改版后**新出现或改了措辞**的文案。
//
// 实机结构（HTML 片段逐字抄录）：
//   <span class="Button-label">
//     <span class="color-fg-muted">Creation allowed by:</span>
//     <span>\n          所有用户\n</span>
//   </span>
//   <span class="ActionListItem-label">\n          Collaborators only\n</span>
//   <span class="ActionListItem-description">Anyone can create an issue</span>
//   <h2 class="mb-2" id="retention-header">Check, workflow run, status, artifact and log retention</h2>
//
// 由此可得的边界事实（都在下方断言里锁住）：
//   1. 按钮标签与「当前值」是**两个独立文本节点**：标签带 muted 类（不是 aria-label，
//      故走普通文本词条），当前值（`All users`）本来就已收录，显示为「所有用户」；
//   2. 展开后的菜单项（`Collaborators only`）是**第三个独立节点**，同样按整节点精确匹配——
//      故标签、当前值、菜单项必须三条键各自成条，合写一句在实机上永不命中；
//   3. action-list 每个选项是「标签 + 说明」两个节点（`ActionListItem-label` /
//      `ActionListItem-description`），标签复用 All users / Collaborators only，
//      说明句必须各自成条；
//   4. 保留期标题在**同一段 HTML 里出现两次**（`<h2>` 与 `<strong id="artifact-retention-subheading">`），
//      文案逐字相同，故一条键覆盖两处；旧版短文案（Artifact and log retention）仍留在词典里，
//      由 actions.test.ts 覆盖——两批文案是不同的键，互不替代；
//   5. 所有实机节点都自带源码缩进与换行，归一化空白后才等于词典键。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** /Oppenheymu/Github-i18n/settings 命中的模块视图（pages/repo-settings + pages/repo + global） */
const view = buildView(
	"/Oppenheymu/Github-i18n/settings",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机节点原文（含真实换行缩进）→ 期望译文 */
const NODES: readonly (readonly [string, string])[] = [
	// 按钮标签（`<span class="color-fg-muted">`）
	["Creation allowed by:", "允许创建者："],
	// 按钮里的当前值：该键早在「推送」一节里就登记过（当时是推送上限的取值），
	// 实机里扩展已经把这一段渲染成了「所有用户」（维护者给的片段里就是中文），
	// 故这里按**归一化后的英文原文**断言，锁住两条路径共用同一条键
	["All users", "所有用户"],
	// 展开后的菜单项（`<span class="ActionListItem-label">`）
	["\n          Collaborators only\n", "仅协作者"],
];

describe("仓库设置页的 Creation allowed by 筛选按钮", () => {
	it("translates the label and the menu item as separate nodes", () => {
		for (const [node, expected] of NODES) {
			expect(
				translateText(node, view),
				`节点 ${JSON.stringify(node)}`,
			).toBe(expected);
		}
	});

	it("keeps the engine matching whole nodes, not merged sentences", () => {
		// 合写整句在实机上不存在（标签与值是相邻的两个节点），故这里断言它**不**命中：
		// 若哪天有人为了「看起来完整」把三条键并成一句，这条用例会立刻红
		expect(
			translateText("Creation allowed by: All users", view),
		).toBeNull();
	});

	it("keeps the repository owner and name in english", () => {
		// 反例：仓库标识是用户内容，整节点不收录
		expect(translateText("Oppenheymu", view)).toBeNull();
		expect(translateText("Github-i18n", view)).toBeNull();
	});
});

/**
 * 2026-10-03 维护者贴的 `/Oppenheymu/Github-i18n/settings` 原版 HTML 里
 * **尚未翻译**的节点（标签已是中文、说明句与保留期一节仍是英文）。
 * 这些是上游改版后的新文案，全部登记在 pages/repo-settings 模块。
 */
const NEW_COPY: readonly (readonly [string, string])[] = [
	// —— 议题创建策略的 action-list（`…/settings/issue_creation_policy`）——
	["Anyone can create an issue", "任何人都可以创建议题"],
	[
		"Only collaborators can create issues",
		"仅协作者可以创建议题",
	],
	// —— 保留期一节（<h2 id="retention-header"> 与同段的 <strong> 共用这一条）——
	[
		"Check, workflow run, status, artifact and log retention",
		"检查、工作流运行、状态、构件与日志保留期",
	],
	[
		"Choose the repository settings for checks, workflow runs, statuses, artifacts, and logs.",
		"选择检查、工作流运行、状态、构件与日志的仓库设置。",
	],
	[
		"Learn more about the check, workflow run, status, artifact and log retention policy.",
		"进一步了解检查、工作流运行、状态、构件与日志的保留政策。",
	],
];

describe("仓库设置页 2026-10-03 采集的新文案", () => {
	it("translates every node the maintainer's HTML shows as english", () => {
		for (const [node, expected] of NEW_COPY) {
			for (const variant of [
				node,
				`\n        ${node}\n      `,
			]) {
				expect(
					translateText(variant, view),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("keeps the rewritten retention copy apart from the older one", () => {
		// 改版前后是两条不同的键：旧文案只提构件与日志，译文里**不得**冒出
		// 「检查 / 工作流运行 / 状态」——上游没写的词不许加；新文案则必须五项俱全。
		expect(
			translateText("Artifact and log retention", view),
		).toBe("构件与日志保留期");
		expect(
			translateText(
				"Check, workflow run, status, artifact and log retention",
				view,
			),
		).toBe("检查、工作流运行、状态、构件与日志保留期");
	});

	it("leaves the parts the extension already translated alone", () => {
		// 同一段 HTML 里这些节点本来就是中文（扩展已生效），这里锁住它们**没有**
		// 被新词条误改：它们是独立节点，且已是译文（含非拉丁字母，脚本守卫会跳过）
		for (const node of [
			"所有用户",
			"仅协作者",
			"天",
			"最大上限为",
			"天。",
			"时长必须为 1 或更大。",
			"时长必须为 90 或更小",
			"保存构件与日志保留期设置",
		]) {
			expect(translateText(node, view), node).toBeNull();
		}
	});
});
