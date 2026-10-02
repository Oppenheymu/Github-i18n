// 仓库设置页的代码空间子页（/owner/repo/settings/codespaces）里「预构建配置」区块的实机文本回归。
//
// 边界强度：**实机 outerHTML 实证**（2026-09-27 维护者提供）。该区块只有 5 个独立节点：
// 区块标题 `<h3>`、页头按钮、空态标题 `<h4>`、空态说明 `<p class="color-fg-subtle">`、
// 文档链接。`Set up prebuild` 在页头与空态底部各出现一次，实机是同一个文本串，
// 故一条键覆盖两处（不需要为「第二个按钮」另立词条）。
//
// 刻意**不收录**（下方反例断言）：仓库名 `Github-i18n`、用户名 `Oppenheymu`、产品名
// `GitHub`。`Codespaces` 另有 global 词条（「代码空间」），不属反例。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** /Oppenheymu/Github-i18n/settings/codespaces 命中的模块视图 */
const view = buildView(
	"/Oppenheymu/Github-i18n/settings/codespaces",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机片段里的节点（原文 → 期望译文），顺序与页面出现顺序一致 */
const NODES: readonly (readonly [string, string])[] = [
	["Prebuild configuration", "预构建配置"],
	["Set up prebuild", "设置预构建"],
	[
		"There are no prebuilds configured for this repository",
		"此仓库未配置任何预构建",
	],
	[
		"Prebuild configurations speed up Codespace creations significantly by pre-executing all the tasks required to build your development environment.",
		"预构建配置会预先执行构建开发环境所需的全部任务，从而显著加快代码空间的创建速度。",
	],
	[
		"Learn more about setting up prebuilds",
		"进一步了解如何设置预构建",
	],
];

describe("仓库设置页的代码空间预构建区块的实机节点边界", () => {
	it("translates every text node of the prebuild section", () => {
		for (const [node, expected] of NODES) {
			// 两种形态都要命中：实机常带源码缩进，归一化空白后等于词典键
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

	it("keeps user content and brand names in english", () => {
		for (const raw of [
			"Oppenheymu",
			"Github-i18n",
			"GitHub",
		]) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("covers both Set up prebuild buttons with a single key", () => {
		// 页头按钮与空态底部的按钮是同一个串，两次查询必须给出同一译文
		const first = translateText("Set up prebuild", view);
		const second = translateText(
			"\n    Set up prebuild\n",
			view,
		);
		expect(first).toBe("设置预构建");
		expect(second).toBe(first);
	});
});
