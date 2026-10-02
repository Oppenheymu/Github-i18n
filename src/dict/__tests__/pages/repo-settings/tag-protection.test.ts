// 仓库设置页的「标签保护」子页（/owner/repo/settings/tag_protection）实机文本回归。
//
// 证据：维护者 2026-09-27 贴的整页截图（弃用横幅 + Protected tags 空状态）。
// 页面级别与同模块的规则集 / 分支页一致（pages/repo-settings）。
//
// 本页最关键的两个边界事实：
//   1. 横幅说明句里的 `changelog` 是链接，链接会把一句切成三个文本节点，
//      故整句键（截图文字形态）只作兜底，真正命中的是「前段 / changelog / 后段」三条；
//   2. `Protected tags`（页面标题）与 `Protected tags have been deprecated`（空状态标题）
//      是两条不同的键——整节点精确匹配不会互相吃掉。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** /Oppenheymu/Github-i18n/settings/tag_protection 命中的模块视图 */
const view = buildView(
	"/Oppenheymu/Github-i18n/settings/tag_protection",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机节点原文 → 期望译文 */
const NODES: readonly (readonly [string, string])[] = [
	[
		"Level up your tag protections with Repository Rules",
		"使用仓库规则提升你的标签保护",
	],
	[
		"Protected tags are being deprecated. To continue protecting tags, please migrate to a tag ruleset by August 30th. You can learn more about the sunset in our changelog and can get started now by migrating to rulesets.",
		"受保护的标签即将弃用。要继续保护标签，请在 8 月 30 日前迁移到标签规则集。你可以在我们的更新日志中进一步了解此次停用，现在就可以迁移到规则集开始使用。",
	],
	[
		"Protected tags are being deprecated. To continue protecting tags, please migrate to a tag ruleset by August 30th. You can learn more about the sunset in our",
		"受保护的标签即将弃用。要继续保护标签，请在 8 月 30 日前迁移到标签规则集。你可以在我们的",
	],
	["changelog", "更新日志"],
	[
		"and can get started now by migrating to rulesets.",
		"中进一步了解此次停用，现在就可以迁移到规则集开始使用。",
	],
	["Protected tags", "受保护的标签"],
	[
		"Protected tags have been deprecated",
		"受保护的标签已弃用",
	],
	[
		"Go to rulesets to create new tag rules",
		"前往规则集创建新的标签规则",
	],
];

describe("仓库设置页的标签保护子页实机节点边界", () => {
	it("translates every node of the screenshot", () => {
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

	it("reassembles the sentence split by its changelog link", () => {
		// 复刻 walker 的空白保留语义（见 repo-settings/code-review-limits.test.ts）
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
				"Protected tags are being deprecated. To continue protecting tags, please migrate to a tag ruleset by August 30th. You can learn more about the sunset in our ",
				"changelog",
				" and can get started now by migrating to rulesets.",
			]),
		).toBe(
			"受保护的标签即将弃用。要继续保护标签，请在 8 月 30 日前迁移到标签规则集。你可以在我们的 更新日志 中进一步了解此次停用，现在就可以迁移到规则集开始使用。",
		);
	});

	it("keeps the page title apart from the blankslate title", () => {
		// 两条键都以 Protected tags 开头，但整节点精确匹配，短的那条不得吃掉长的那条
		expect(translateText("Protected tags", view)).toBe(
			"受保护的标签",
		);
		expect(
			translateText(
				"Protected tags have been deprecated",
				view,
			),
		).toBe("受保护的标签已弃用");
	});

	it("keeps the repository owner and name in english", () => {
		expect(translateText("Oppenheymu", view)).toBeNull();
		expect(translateText("Github-i18n", view)).toBeNull();
	});
});
