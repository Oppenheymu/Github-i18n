// 仓库设置页的「代码审查限制」子页（/owner/repo/settings/code_review_limits）实机文本回归。
//
// 边界强度：**维护者贴的实机文本**（2026-09-27），只有三处证据，故本文件只锁这三处，
// 不声称覆盖整页。整页仍属「未采集」（见 docs/guides/development.md 的节点边界表）。
//
// 页面级别同上一页（交互限制子页）：措辞是 **this repository**（单数）与
// **explicitly granted access to this repository**，与账户级 /settings/code_review_limits 的
// your public repositories / explicitly granted access to each repository（复数）互斥，
// 故三条键登记在 pages/repo-settings；账户级那套仍在 pages/settings（回归见
// src/content/__tests__/settings-limits.test.ts）。
// 两页译文用词保持一致（「限制为明确获得读取或更高权限的用户」等），免得同一功能两种说法。
//
// 本页最关键的两个边界事实：
//   1. 说明句与开关的解释段在实机都是**含源码换行的单节点**（账户级那份实测形如
//      `… permit only\n            users who …`），键必须按 normalizeKey 折叠空白后的形态写；
//   2. 解释段里的 `"approve"` / `"request changes"` 带**直引号**，与键里的引号必须逐字符一致。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

/** /Oppenheymu/Github-i18n/settings/code_review_limits 命中的模块视图 */
const view = buildView(
	"/Oppenheymu/Github-i18n/settings/code_review_limits",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机节点原文 → 期望译文 */
const NODES: readonly (readonly [string, string])[] = [
	[
		"Restrict users who are permitted to approve or request changes on pull requests in this repository.",
		"限制哪些用户可以在仓库中对拉取请求进行批准或请求更改。",
	],
	[
		"Limit to users explicitly granted read or higher access",
		"限制为明确获得读取或更高权限的用户",
	],
	[
		'When enabled, only users explicitly granted access to this repository will be able to submit pull request reviews that "approve" or "request changes". All users able to submit comment pull request reviews will continue to be able to do so.',
		"启用后，只有明确获得此仓库访问权限的用户才能提交「批准」或「请求更改」的拉取请求审查。所有能够提交评论式拉取请求审查的用户仍可继续这样做。",
	],
];

describe("仓库设置页的代码审查限制子页的实机节点边界", () => {
	it("translates the three nodes the maintainer pasted", () => {
		for (const [node, expected] of NODES) {
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

	it("keeps the account-level plural wording out of this page", () => {
		// 账户级那两条是复数措辞 + 另一段说明；本页视图不得命中它们，
		// 免得日后有人「顺手统一」把两页的串合并（两页路由互斥，合并会让另一页漏翻）
		expect(
			translateText(
				"Restrict users who are permitted to approve or request changes on pull requests in your public repositories.",
				view,
			),
		).toBeNull();
		expect(
			translateText(
				"Code review limits are currently managed individually for all repositories.",
				view,
			),
		).toBeNull();
	});

	it("keeps the repository owner and name in english", () => {
		expect(translateText("Oppenheymu", view)).toBeNull();
		expect(translateText("Github-i18n", view)).toBeNull();
	});
});
