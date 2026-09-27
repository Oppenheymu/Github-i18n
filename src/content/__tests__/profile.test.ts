// 个人 / 组织主页的「仓库列表」筛选菜单实机节点回归。
//
// 证据强度：**截图 + 官方 HTML 片段**（2026-09 本页会话），不是完整节点 dump。
//   - 截图 `https://github.com/Oppenheymu?tab=repositories&type=source`：Type 下拉展开后
//     只见 "Can be sponsored" 与 "Templates" 两项仍是英文（其余七项已是中文），
//     故这两条是待补项，其余键只做**回归锁定**，不重复登记；
//   - 同页结果摘要的 HTML（用户提供）：`<strong>5</strong> results for <strong>source</strong>
//     repositories sorted by <strong>last updated</strong>` 与 `a.issues-reset-query` 的
//     `Clear filter`——**节点边界待补采集**，本文件暂不锁这两条（截图不能作登记键的唯一依据，
//     见 docs/guides/development.md「采集结果怎么读」）。
//
// 本页最关键的边界事实（都在下方断言里锁住）：
//   1. 菜单项都是**单节点短词**，与仓库名 / 用户名同形风险高，故必须锁「整节点相等」，
//      而不是「含中文」——后者会放过把菜单项关联到错误译文的情况；
//   2. 菜单里 All / Public / Private / Archived / Forks 由 global 模块覆盖、Sources / Mirrors
//      由 pages/profile 覆盖，Templates / Can be sponsored 本轮才登记进 pages/profile；
//      哪一条被删，下面的用例立刻红；
//   3. 用户内容（仓库名 / 用户名 / 描述）必须保持英文——它们是整节点不收录的（反例断言）。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

/** /Oppenheymu?tab=repositories 命中的模块视图（pages/profile + global） */
const view = buildView(
	"/Oppenheymu",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/**
 * Type 下拉的九个选项：实机文本 → 实机中文渲染（逐字录入，顺序即菜单顺序）。
 * 「实机文本」栏就是词典键，必须与 GitHub 渲染的整节点原文一致。
 */
const TYPE_MENU: readonly (readonly [string, string])[] = [
	["All", "全部"], // global
	["Public", "公开"], // global
	["Private", "私有"], // global
	["Sources", "来源"], // pages/profile
	["Forks", "复刻"], // global
	["Archived", "已归档"], // global
	["Can be sponsored", "可被赞助"], // pages/profile（本轮新增）
	["Mirrors", "镜像"], // pages/profile
	["Templates", "模板"], // pages/profile（本轮新增）
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

describe("pages/profile 的仓库列表筛选菜单", () => {
	it("translates every Type menu option to its rendered Chinese label", () => {
		for (const [node, expected] of TYPE_MENU) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(variant, view);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("pins the two labels whose upstream l10n is missing", () => {
		// 「Can be sponsored」与「Templates」是本轮新登记的两条：上游自己的中文界面没翻这两项，
		// 只能靠本扩展补。断言用合并后的页面视图（pages/profile + global），故这里锁的是
		// 「命中且译文正确」；它们归哪个模块由 tooling/checks/view.ts 的赢家覆盖快照锁。
		expect(translateText("Can be sponsored", view)).toBe(
			"可被赞助",
		);
		expect(translateText("Templates", view)).toBe("模板");
	});

	it("keeps repository names, owners and descriptions in english", () => {
		// 反例：用户内容与纯专名整节点不收录（未命中即保留英文，这是正确行为）。
		// 「Github-i18n」「Oppenheymu」「MyLiteraryWorks」「TypeScript」「MIT License」
		// 都是实机出现在本页的用户内容 / 许可证专名。
		for (const node of [
			"Github-i18n",
			"Oppenheymu",
			"MyLiteraryWorks",
			"hex-iron",
			"MyLab",
			"A browser extension that provides multilingual translation of the GitHub interface, primarily in Chinese.",
			"TypeScript",
			"MIT License",
			"The Unlicense",
		]) {
			expect(translateText(node, view), node).toBeNull();
		}
	});
});
