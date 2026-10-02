import { describe, expect, it } from "bun:test";
import {
	EXCLUDE_SELECTOR,
	hasNonLatinLetter,
	isTranslatableText,
} from "../filters.ts";

describe("hasNonLatinLetter", () => {
	it("detects letters outside the latin script", () => {
		expect(hasNonLatinLetter("汉化")).toBe(true);
		expect(hasNonLatinLetter("mixed 中 text")).toBe(true);
		// 语言无关：纯假名（日语）、谚文（韩语）、西里尔都算已非英文
		expect(hasNonLatinLetter("もっと見る")).toBe(true);
		expect(hasNonLatinLetter("더 보기")).toBe(true);
		expect(hasNonLatinLetter("Ещё")).toBe(true);
	});

	it("ignores latin letters, digits, punctuation and symbols", () => {
		expect(hasNonLatinLetter("english only")).toBe(false);
		expect(hasNonLatinLetter("café")).toBe(false);
		expect(hasNonLatinLetter("123 !@#")).toBe(false);
		expect(hasNonLatinLetter("© 2026 GitHub, Inc.")).toBe(
			false,
		);
		expect(hasNonLatinLetter("—— …")).toBe(false);
		expect(hasNonLatinLetter("")).toBe(false);
	});
});

describe("isTranslatableText", () => {
	it("accepts plain UI text", () => {
		expect(isTranslatableText("Pull requests")).toBe(true);
	});

	it("judges on trimmed content", () => {
		expect(isTranslatableText("   Star  ")).toBe(true);
	});

	it("rejects empty or whitespace-only text", () => {
		expect(isTranslatableText("")).toBe(false);
		expect(isTranslatableText("   \n\t ")).toBe(false);
	});

	it("rejects text that is entirely another script", () => {
		expect(isTranslatableText("已合并")).toBe(false);
		// 纯假名的日语译文同样要被拦住（汉字判定会漏掉它）
		expect(isTranslatableText("もっと見る")).toBe(false);
	});

	it("lets half-translated text through so rules can fix the English part", () => {
		// `Optimized for: 均衡` 是 GitHub 中文界面的真实节点：前缀是上游漏翻的英文，
		// 档位名由 GitHub 自己译出。整段跳过会让规则结构上永远看不到它，
		// 前缀就永远翻不掉（2026-10-02 实机报的正是这一处），故混合节点放行。
		// 纯中文 / 纯假名仍被拦住（上一条用例），且混合节点查不中规则时不写回 DOM。
		expect(isTranslatableText("Optimized for: 均衡")).toBe(
			true,
		);
		expect(isTranslatableText("merged 已合并")).toBe(true);
	});

	it("rejects overlong text (likely code or user content)", () => {
		expect(isTranslatableText("a".repeat(501))).toBe(false);
		expect(isTranslatableText("a".repeat(500))).toBe(true);
	});

	it("rejects text without latin letters (numbers / symbols)", () => {
		expect(isTranslatableText("123")).toBe(false);
		expect(isTranslatableText("+-*/")).toBe(false);
	});
});

describe("EXCLUDE_SELECTOR", () => {
	it("guards the essential code and user-content containers", () => {
		const selectors = EXCLUDE_SELECTOR.split(",");
		for (const required of [
			"code",
			"pre",
			"textarea",
			".markdown-body",
			".highlight",
			".blob-code",
			".diff-table",
		]) {
			expect(selectors).toContain(required);
		}
	});
});
