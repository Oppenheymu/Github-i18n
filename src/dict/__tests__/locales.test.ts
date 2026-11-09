// src/dict/locales.ts 的纯函数测试。
//
// 为什么单独测：resolveLocale 是「自动语言」体验的唯一入口——用户在 popup 里选
// 「自动」时，最终翻成哪种语言完全由它决定。它此前只有隐式覆盖（别的测试顺带
// import 了 LOCALES 常量），而 zh-Hant-HK / pt-PT / es-MX 这类真实浏览器标签
// 的归属从来没有被断言过。
import { describe, expect, it } from "bun:test";
import {
	BASELINE_LOCALE,
	FALLBACK_LOCALE,
	getLocaleMeta,
	isLocaleId,
	LOCALES,
	type LocaleId,
	resolveLocale,
} from "../locales.ts";

/** 拉丁语系目标：与源语言同字系，门禁无法校验「译文是否已翻译」 */
const LATIN_LOCALES: ReadonlySet<LocaleId> = new Set([
	"es",
	"fr",
	"de",
	"pt-BR",
	"pt-PT",
]);

describe("isLocaleId", () => {
	it("accepts only the declared locale ids", () => {
		expect(isLocaleId("zh-CN")).toBe(true);
		expect(isLocaleId("zh-TW")).toBe(true);
		expect(isLocaleId("ja")).toBe(true);
		expect(isLocaleId("ko")).toBe(true);
		expect(isLocaleId("es")).toBe(true);
		expect(isLocaleId("fr")).toBe(true);
		expect(isLocaleId("de")).toBe(true);
		expect(isLocaleId("pt-BR")).toBe(true);
		expect(isLocaleId("pt-PT")).toBe(true);
		expect(isLocaleId("ru")).toBe(true);
		// 下划线写法是浏览器标签的常见形态，但不是本项目的语言 id
		expect(isLocaleId("zh_CN")).toBe(false);
		// 泛葡语不是声明过的变体 id（解析时再归一，见 resolveLocale）
		expect(isLocaleId("pt")).toBe(false);
		expect(isLocaleId("en")).toBe(false);
		expect(isLocaleId("")).toBe(false);
		expect(isLocaleId(123)).toBe(false);
		expect(isLocaleId(null)).toBe(false);
		expect(isLocaleId(undefined)).toBe(false);
	});
});

describe("resolveLocale", () => {
	it("matches ids case-insensitively and tolerates underscores", () => {
		expect(resolveLocale("zh-cn")).toBe("zh-CN");
		expect(resolveLocale("zh_CN")).toBe("zh-CN");
		expect(resolveLocale("zh_tw")).toBe("zh-TW");
		expect(resolveLocale("JA")).toBe("ja");
		expect(resolveLocale("PT-br")).toBe("pt-BR");
		expect(resolveLocale("  de  ")).toBe("de");
	});

	it("picks the Chinese variant by script or region", () => {
		expect(resolveLocale("zh-Hans-CN")).toBe("zh-CN");
		expect(resolveLocale("zh-Hans-HK")).toBe("zh-CN");
		expect(resolveLocale("zh-TW")).toBe("zh-TW");
		expect(resolveLocale("zh-HK")).toBe("zh-TW");
		expect(resolveLocale("zh-MO")).toBe("zh-TW");
		expect(resolveLocale("zh-Hant-HK")).toBe("zh-TW");
		expect(resolveLocale("zh-Hant")).toBe("zh-TW");
		expect(resolveLocale("zh")).toBe("zh-CN");
	});

	it("separates Brazilian and European Portuguese", () => {
		expect(resolveLocale("pt-BR")).toBe("pt-BR");
		expect(resolveLocale("pt")).toBe("pt-BR");
		expect(resolveLocale("pt-PT")).toBe("pt-PT");
		// 非巴西的葡语地区按欧洲葡语（巴西之外的葡语国家都用欧洲规范）
		expect(resolveLocale("pt-AO")).toBe("pt-PT");
	});

	it("falls back to the primary language subtag", () => {
		expect(resolveLocale("ja-JP")).toBe("ja");
		expect(resolveLocale("ko-KR")).toBe("ko");
		expect(resolveLocale("es-MX")).toBe("es");
		expect(resolveLocale("es-419")).toBe("es");
		expect(resolveLocale("fr-CA")).toBe("fr");
		expect(resolveLocale("de-AT")).toBe("de");
		expect(resolveLocale("ru-RU")).toBe("ru");
	});

	it("returns the fallback locale for unknown or empty tags", () => {
		expect(resolveLocale("en-US")).toBe(FALLBACK_LOCALE);
		expect(resolveLocale("it-IT")).toBe(FALLBACK_LOCALE);
		expect(resolveLocale("")).toBe(FALLBACK_LOCALE);
		expect(resolveLocale("   ")).toBe(FALLBACK_LOCALE);
	});

	it("always returns a declared locale id", () => {
		for (const tag of [
			"",
			"en",
			"ja-JP",
			"zh-Hant-HK",
			"pt-AO",
			"xx-YY",
			"ZH_hant_TW",
		]) {
			expect(isLocaleId(resolveLocale(tag))).toBe(true);
		}
	});
});

describe("getLocaleMeta", () => {
	it("returns the declared metadata", () => {
		expect(getLocaleMeta("zh-CN").name).toBe("简体中文");
		expect(getLocaleMeta("zh-TW").scripts).toEqual(["Han"]);
		expect(getLocaleMeta("ja").scripts).toEqual([
			"Han",
			"Hiragana",
			"Katakana",
		]);
		expect(getLocaleMeta("ko").scripts).toEqual(["Hangul"]);
		expect(getLocaleMeta("ru").scripts).toEqual([
			"Cyrillic",
		]);
		expect(getLocaleMeta("es").scripts).toEqual([]);
	});

	it("throws for an id that is not declared", () => {
		// 类型上不可能传入未声明的 id；这里模拟配置脱节（例如 registry 里多了一种语言）
		expect(() => getLocaleMeta("en" as LocaleId)).toThrow(
			"未声明的语言",
		);
	});

	it("declares a script for every non-Latin locale", () => {
		// 拉丁语系目标允许 scripts 为空（与源语言同字系，无从判定）；
		// 其余语言必须声明，否则门禁的译文形态校验会整段失效
		for (const meta of LOCALES) {
			if (LATIN_LOCALES.has(meta.id)) {
				expect(meta.scripts).toEqual([]);
				continue;
			}
			expect(meta.scripts.length).toBeGreaterThan(0);
		}
	});

	it("only exposes fully translated locales in the popup", () => {
		// 当前只有简中基线 + 日语全量译完；其它语言是空骨架。
		// 真实覆盖率由 check:dict 对着数据强制，这里钉住 popup 的可见集合，
		// 防止有人把空语言重新标 ready、让选择器出现「选了没反应」的选项。
		expect(
			LOCALES.filter((meta) => meta.ready).map(
				(meta) => meta.id,
			),
		).toEqual(["zh-CN", "ja"]);
	});

	it("uses zh-CN as both baseline and fallback", () => {
		expect(BASELINE_LOCALE).toBe("zh-CN");
		expect(FALLBACK_LOCALE).toBe(BASELINE_LOCALE);
		expect(isLocaleId(BASELINE_LOCALE)).toBe(true);
	});
});
