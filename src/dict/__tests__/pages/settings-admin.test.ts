// 账号管理页（/settings/admin）实机文本节点回归。
//
// 为什么单独锁这一页：该页（Turbo frame 渲染）几乎每句都被内联链接 / strong 切成
// 多个文本节点，而引擎是「整节点精确匹配」——只要碎片边界对不上就静默保留英文，
// 且看代码完全看不出来。这里的 node 值**逐字抄自实机 DOM**（含首尾换行与缩进），
// 是「按真实边界收录」这条约定的回归保护：上游改结构、或有人顺手"整理"了键，
// 这批用例会立刻变红。新增碎片键时按同样格式补一条。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

/** /settings 子树命中的模块视图（pages/settings + pages/repo + global） */
const view = buildView(
	"/settings/admin",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机文本节点：值逐字抄自 DOM dump，不做 trim（引擎自己会归一空白） */
const ACCOUNT_ADMIN_NODES: readonly string[] = [
	// 「更改用户名」：实机是 `Changing your username can have` 一整个文本节点 +
	// <a>unintended side effects</a> + `.`（Change 不是链接，没有独立节点）
	"\n          Changing your username can have\n          ",
	"\n            unintended side effects",
	// 「密码与身份验证」链接之后的尾片段
	"page.",
	// 导出：句号属于用户名链接节点，故可用天数那句以 ". " 开头
	"Export all repositories and profile metadata for",
	".\n      Exports will be available for 7 days.\n    ",
	// 删除账户：句子节点不含清单（清单是同级 <strong>）
	"\n            Your account is currently an owner in these organizations:\n            ",
	// 继承声明：192 字符长节点 + <span> 尾段 + <a> 链接 + <button> 按钮
	'\n  By clicking "Add Successor" below, I acknowledge that I am the owner of the @Oppenheymu account, and am\n  authorizing GitHub to transfer content within that account to my GitHub Successor, ',
	", in the event\n  of my death. I understand that this appointment of a successor does not override legally binding next-of-kin rules\n  or estate laws of any relevant jurisdiction, and does not create a binding will.\n  ",
	" Learn more about account successors. ",
	"    Add Successor\n",
	// 删除账户的说明句：You must <a>…</a>, <a>…</a>, or <a>…</a> before you can delete your user.
	"You must ",
	"remove yourself from these organizations",
	"transfer ownership",
	"delete these organizations",
	" before you can delete your user.",
];

describe("账号管理页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of ACCOUNT_ADMIN_NODES) {
			const translated = translateText(node, view);
			expect(
				translated,
				`未命中：${JSON.stringify(node)}`,
			).not.toBeNull();
			// 译文必须是中文（防「收录了键但值还是英文」这类静默失效）
			expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
		}
	});

	it("keeps the export sentence working with and without the leading period", () => {
		// 纯句号节点属于用户名链接，翻不了（此处不断言）；同一句在无前导句号时也要命中，
		// 避免规则退化成只认一种节点边界
		expect(
			translateText(
				"Exports will be available for 7 days.",
				view,
			),
		).toBe("导出数据将在 7 天内可用。");
		expect(
			translateText(
				".\n      Exports will be available for 7 days.\n    ",
				view,
			),
		).toContain("7 天");
	});

	it("keeps organization names out of the replacement", () => {
		// 清单是独立 <strong>，句子节点翻译后不得吃掉清单内容
		const translated = translateText(
			"\n            Your account is currently an owner in these organizations:\n            ",
			view,
		);
		expect(translated).toBe(
			"你的账户目前是以下组织的所有者：",
		);
	});
});
