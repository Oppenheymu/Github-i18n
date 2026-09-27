// 仓库设置页的「环境」子页（/owner/repo/settings/environments）实机文本回归。
//
// 边界强度：**实机 outerHTML 实证**（2026-09-27 维护者提供）。
// 页头「环境」由设置侧边栏词条（Environments）覆盖，故本页正文只剩两个节点：
// 空态标题 `<h2 class="blankslate-heading">` 与说明句 `<p class="blankslate-description">`，
// 两者各自成条，不能合并；操作按钮 `New environment` 是第三个节点。
//
// 刻意**不收录**（下方反例断言）：仓库名 `Github-i18n`、用户名 `Oppenheymu` 与产品名
// `GitHub`——未命中即保留英文，这才是正确做法。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

/** /Oppenheymu/Github-i18n/settings/environments 命中的模块视图 */
const view = buildView(
	"/Oppenheymu/Github-i18n/settings/environments",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机片段里的节点（原文 → 期望译文），顺序与页面出现顺序一致 */
const NODES: readonly (readonly [string, string])[] = [
	["New environment", "新建环境"],
	[
		"There are no environments for this repository",
		"此仓库没有环境",
	],
	[
		"Environments are used by your workflows for deployments.",
		"环境供工作流用于部署。",
	],
];

describe("仓库设置页的环境子页的实机节点边界", () => {
	it("translates the action button and both blankslate nodes", () => {
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

	it("does not treat the empty-state heading and its description as one node", () => {
		expect(
			translateText(
				"There are no environments for this repository Environments are used by your workflows for deployments.",
				view,
			),
		).toBeNull();
	});
});
