// 仓库设置页（/owner/repo/settings）的「Creation allowed by」筛选按钮回归。
//
// 边界强度：**维护者给的实机 HTML 片段**（2026-09），不是完整节点 dump——
// 故本文件只锁这两条证据覆盖的节点，不声称覆盖整页（该页绝大多数词条目前
// 仍只有 `check:dict` 与视图骨架层的保护，见 docs/guides/development.md 的节点边界表）。
//
// 实机结构（HTML 片段逐字抄录）：
//   <span class="Button-label">
//     <span class="color-fg-muted">Creation allowed by:</span>
//     <span>\n          所有用户\n</span>
//   </span>
//   <span class="ActionListItem-label">\n          Collaborators only\n</span>
//
// 由此可得的边界事实（都在下方断言里锁住）：
//   1. 按钮标签与「当前值」是**两个独立文本节点**：标签带 muted 类（不是 aria-label，
//      故走普通文本词条），当前值（`All users`）本来就已收录，显示为「所有用户」；
//   2. 展开后的菜单项（`Collaborators only`）是**第三个独立节点**，同样按整节点精确匹配——
//      故标签、当前值、菜单项必须三条键各自成条，合写一句在实机上永不命中；
//   3. 两条实机节点都自带源码缩进与换行，归一化空白后才等于词典键。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

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
