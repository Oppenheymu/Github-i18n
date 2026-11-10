// src/shared/text.ts 的归一化语义。
//
// 这个函数是「键能否命中」的**唯一标准**：运行时（walker）与门禁（check:dict）都用它，
// 所以它的每条行为都同时等价于一条词典纪律。这里钉住两类边界：
//   1. trim + 折叠空白（键里带换行 / 连续空格 = 永不命中的死词条）；
//   2. 剥掉不可见格式字符（2026-11-10 实机线索：`Archive pull request` 节点与键逐字
//      相同却不命中，同菜单相邻词条都已译出——零宽 / 双向隔离符在 HTML 里看不见，
//      `trim()` 与 `\s` 也不认，只能显式剥除）。
import { describe, expect, it } from "bun:test";
import { normalizeKey } from "../text.ts";

describe("normalizeKey", () => {
	it("trims and collapses whitespace", () => {
		expect(
			normalizeKey("  Archive   pull\n\trequest "),
		).toBe("Archive pull request");
		// \u00a0（NBSP）在 \s 里，折叠成普通空格
		expect(normalizeKey("Archive\u00a0pull request")).toBe(
			"Archive pull request",
		);
	});

	it("strips invisible format characters", () => {
		// ZWSP / WORD JOINER / LRM / 双向隔离符 / 软连字符
		expect(
			normalizeKey(
				"\u200bArchive\u2060 pull\u200e request\u2069\u00ad",
			),
		).toBe("Archive pull request");
		// 只由不可见字符构成的文本归一后是空串（可翻译判定会先跳过这类节点）
		expect(normalizeKey("\u200b\u2060")).toBe("");
	});

	it("keeps visible punctuation and symbols untouched", () => {
		expect(normalizeKey("8h ago")).toBe("8h ago");
		expect(
			normalizeKey("— This check has started..."),
		).toBe("— This check has started...");
	});
});
