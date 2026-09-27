// 仓库设置页的「分支」子页（/owner/repo/settings/branches）实机文本回归。
//
// 证据：维护者 2026-09-27 贴的实机 HTML（页面顶部的经典分支保护横幅，GrowthBanner）。
// 页面级别与同模块的规则集页一致（pages/repo-settings，路由 ^/[^/]+/[^/]+/settings）。
//
// 本页最关键的两个边界事实：
//   1. 说明句被**两个链接**切成五段：前段（以 about 结尾）/ `repository rules` /
//      连词 ` and ` / `protected branches` / 纯符号句点。句点翻不了也不收，
//      ` and ` 由本模块既有的 "and" 词条覆盖，故只登记另外三段 + 标题 + 两个按钮；
//   2. 维护者采集时页面已装扩展，所以贴出来的 HTML 里那句「与」是**既有词条的产物**
//      而不是上游原文——上游原文是 and。这条注释就是防止日后有人照着「与」去登记键。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

/** /Oppenheymu/Github-i18n/settings/branches 命中的模块视图 */
const view = buildView(
	"/Oppenheymu/Github-i18n/settings/branches",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机节点原文 → 期望译文 */
const NODES: readonly (readonly [string, string])[] = [
	[
		"Classic branch protections have not been configured",
		"尚未配置经典分支保护",
	],
	[
		"Define branch rules to disable force pushing, prevent branches from being deleted, or require pull requests before merging. Learn more about",
		"定义分支规则以禁止强制推送、防止分支被删除，或要求合并前先创建拉取请求。进一步了解",
	],
	["repository rules", "仓库规则"],
	["protected branches", "受保护的分支"],
	["Add branch ruleset", "添加分支规则集"],
	[
		"Add classic branch protection rule",
		"添加经典分支保护规则",
	],
];

describe("仓库设置页的分支子页实机节点边界", () => {
	it("translates every node of the banner", () => {
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

	it("reassembles the sentence split by its two links", () => {
		// 复刻 walker 的空白保留语义（见 repo-settings-code-review-limits.test.ts）
		const renderWithWhitespace = (
			nodes: readonly string[],
		) =>
			nodes
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
		expect(
			renderWithWhitespace([
				"Define branch rules to disable force pushing, prevent branches from being deleted, or require pull requests before merging. Learn more about ",
				"repository rules",
				" and ",
				"protected branches",
				".",
			]),
		).toBe(
			"定义分支规则以禁止强制推送、防止分支被删除，或要求合并前先创建拉取请求。进一步了解 仓库规则 与 受保护的分支.",
		);
	});

	it("keeps the repository owner and name in english", () => {
		expect(translateText("Oppenheymu", view)).toBeNull();
		expect(translateText("Github-i18n", view)).toBeNull();
	});

	it("keeps the symbol-only node untranslatable", () => {
		// 句点节点是纯符号：收了也是永不命中的死键
		expect(translateText(".", view)).toBeNull();
	});
});
