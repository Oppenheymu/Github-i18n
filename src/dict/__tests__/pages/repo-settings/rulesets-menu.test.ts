// 规则集详情页右上角「…」菜单的实机节点边界（/owner/repo/settings/rules/<id>）。
//
// 证据：维护者 2026-10-17 贴的菜单 HTML + 截图。核心事实是**上游改了节点边界**：
// 菜单项标签由整句变成了两个文本节点（`Export` + `ruleset` / `Delete` + `ruleset`），
// 因此早就收录的整句键 `Export ruleset` / `Delete ruleset` 在实机上不再命中——
// 实机渲染出「删除 ruleset」就是直接证据：`Delete` 由 global 命中，
// 而 `ruleset` 在本模块没有词条。本文件把碎片键、整句键与拼接结果一起钉住。
//
// 按钮的 tooltip / aria-label `Ruleset menu`（截图里那条深色提示）是属性 + 文本同串，
// 属性只走精确命中，故收静态键。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** /Oppenheymu/Github-i18n/settings/rules/24064311 命中的模块视图 */
const view = buildView(
	"/Oppenheymu/Github-i18n/settings/rules/24064311",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 复刻 walker 的 lead / trail 保留语义 */
function renderNodes(nodes: readonly string[]): string {
	return nodes
		.map((node) => {
			const translated = translateText(node, view);
			if (translated === null) return node;
			const leading = node.match(/^\s*/)?.[0] ?? "";
			const trailing = node.match(/\s*$/)?.[0] ?? "";
			return leading + translated + trailing;
		})
		.join("");
}

describe("规则集详情页的溢出菜单节点边界", () => {
	it("translates the menu tooltip and the label fragments", () => {
		expect(translateText("Ruleset menu", view)).toBe(
			"规则集菜单",
		);
		expect(translateText("Export", view)).toBe("导出");
		expect(translateText("ruleset", view)).toBe("规则集");
		// `Delete` 由 global 提供，规则集页不重复登记
		expect(translateText("Delete", view)).toBe("删除");
	});

	it("keeps the whole-line entries working for the old node shape", () => {
		// 整句键仍保留：上游若回滚成单节点，这两条会直接命中
		expect(translateText("Export ruleset", view)).toBe(
			"导出规则集",
		);
		expect(translateText("Delete ruleset", view)).toBe(
			"删除规则集",
		);
	});

	it("reassembles the split menu labels", () => {
		// 实机拼接结果：段间空格来自原节点，保持「导出 规则集」「删除 规则集」
		expect(renderNodes(["Export ", "ruleset"])).toBe(
			"导出 规则集",
		);
		expect(renderNodes(["Delete ", "ruleset"])).toBe(
			"删除 规则集",
		);
	});

	it("keeps the ruleset name and shortcut hints in english", () => {
		// 规则名是用户内容，快捷键提示在各语言里都保持英文
		expect(
			translateText("Protect Default Branch", view),
		).toBeNull();
		expect(translateText("alt shift r", view)).toBeNull();
	});
});
