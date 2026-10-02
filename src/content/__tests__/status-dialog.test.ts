// 头像菜单（用户导航弹层）与「编辑状态」对话框的实机节点回归。
//
// 证据来源：维护者 2026-10-02 贴出的**实机 HTML**（未加载扩展的原始英文页）——
// 一份是头像弹层的 outerHTML（Top repositories 那批的同页），一份是状态对话框的 dialog。
// 两份都属于**全站可见的头部 UI**（任意页面点开头像都会出现），故词条全部登记在 global；
// 截图仅用于核对语义与数量，节点边界一律以 HTML 为准。
//
// 本组用例锁三类事实：
//   1. 「状态弹层里的状态词」是**独立单节点**（`open` / `Focusing` / `Never` …），
//      与用户自己填写的状态内容同形——用户内容不收录，只有固定选项收（反例见末尾用例）；
//   2. `characters remaining` 是**动态计数**，两个下拉选项是静态单节点；
//   3. emoji 工具提示里的 `:dart:` 是上游别名（专名），只能由规则原样搬进译文。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

/** 任意路径都命中 global；这里用个人主页视图（pages/profile + global），与实机一致 */
const view = buildView(
	"/Oppenheymu",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n            ${node}\n          `];
}

/** 实机文本 → 实机应渲染的译文（逐字录入，顺序即页面出现顺序） */
const STATIC_NODES: readonly (readonly [string, string])[] =
	[
		// —— 用户导航弹层（头像菜单）——
		["Personal profile", "个人资料"],
		["Switch account", "切换账户"],
		["Add account", "添加账户"],
		["Set status", "设置状态"],
		// —— 状态对话框：标题与分组 ——
		["Edit status", "编辑状态"],
		["What's happening", "在做什么"],
		// —— 状态对话框：四个建议状态 ——
		["On vacation", "休假中"],
		["Out sick", "生病请假"],
		["Working from home", "在家办公"],
		["Focusing", "专注中"],
		// —— 状态对话框：忙碌复选与说明 ——
		["Busy", "忙碌"],
		[
			"When others mention you, assign you, or request your review, GitHub will let them know that you have limited availability.",
			"当他人提及你、指派你或请求你审查时，GitHub 会告知对方你当前可支配时间有限。",
		],
		// —— 状态对话框：过期时间下拉 ——
		["Expiration", "过期时间"],
		["Never", "永不"],
		["In 30 minutes", "30 分钟后"],
		["In 1 hour", "1 小时后"],
		["In 4 hours", "4 小时后"],
		["After today", "今天之后"],
		["After this week", "本周之后"],
		["After a month", "一个月后"],
		[
			"Your status will be cleared after the selected time.",
			"到达所选时间后，你的状态将被清除。",
		],
		// —— 状态对话框：可见范围下拉 ——
		["Visible to", "可见范围"],
		["Everyone", "所有人"],
		[
			"Limit status visibility to a single organization.",
			"将状态可见范围限制为单个组织。",
		],
		// —— 状态对话框：页脚动作 ——
		["Clear status", "清除状态"],
	];

describe("头像菜单与状态对话框的实机节点边界", () => {
	it("translates every node the dialog HTML shows", () => {
		for (const [node, expected] of STATIC_NODES) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, view),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("translates the dynamic character counter and limit through rules", () => {
		// 实机里同一句渲染两次（可视区 span 与 aria 描述），计数随输入变化
		expect(
			translateText("72 characters remaining", view),
		).toBe("还可输入 72 个字符");
		expect(
			translateText("1 character remaining", view),
		).toBe("还可输入 1 个字符");
		expect(
			translateText(
				"You can enter up to 80 characters",
				view,
			),
		).toBe("最多可输入 80 个字符");
	});

	it("keeps the emoji alias while translating the tooltip", () => {
		// `:dart:` 是上游的 emoji 别名（专名），规则只翻提示语本身
		expect(
			translateText("Select an emoji: :dart:", view),
		).toBe("选择表情：:dart:");
	});

	it("keeps the user's own status text and account names in english", () => {
		// 反例：用户自己填写的状态（输入框 value 与展示胶囊）与账户名是用户内容。
		// 「Focusing」恰好是固定建议词才会被收录，用户改写成别的词就必须保持英文。
		expect(
			translateText("Shipping a release", view),
		).toBeNull();
		expect(translateText("Oppenheymu", view)).toBeNull();
		expect(translateText("M. Oppenheymu", view)).toBeNull();
	});
});
