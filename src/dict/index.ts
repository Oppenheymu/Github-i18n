// 词典汇总：把注册表里的 JSONC 原始数据编译成运行时词典（按语言切分）。
//
// 数据在 core/**（语言无关）与 locales/<语言>/**（只有译文），形状翻译统一走 load.ts，
// 与门禁共用同一套编译逻辑；门禁另走严格路径（见 tooling/checks/dict.ts）。
// 本模块刻意容错：某个模块编译失败只跳过该模块并打印错误，不拖垮整站翻译。

import type {
	DictCore,
	LocaleDict,
} from "../shared/types.ts";
import {
	buildAliases,
	buildLocaleDict,
	buildModules,
	buildRuleDefs,
} from "./load.ts";
import {
	FALLBACK_LOCALE,
	type LocaleId,
} from "./locales.ts";
import { coreRawDict, localeRawDicts } from "./registry.ts";

/**
 * 构建失败即返回 null 并打印错误。
 * 词典数据出错时「少翻一个模块」远好于「整站翻译全失效」，因此运行时不做硬失败；
 * 但错误照打，且门禁会在提交前以非零码拦住同一份数据，故不会有坏数据被发布。
 */
function loadOrSkip<T>(
	where: string,
	build: () => T,
): T | null {
	try {
		return build();
	} catch (error) {
		console.error(
			`[Github-i18n] 词典模块加载失败，已跳过（${where}）：${String(error)}`,
		);
		return null;
	}
}

/**
 * 语言无关的核心数据。模块清单编译失败时退化为空——此时没有模块就没有任何翻译，
 * 但页面照常工作（宁可完全不翻，也不要半个坏视图）。
 */
export const dictCore: DictCore = loadOrSkip("core", () => {
	const modules = buildModules(
		coreRawDict.modules,
		"core/modules",
	);
	return {
		modules,
		rules: buildRuleDefs(
			coreRawDict.rules,
			"core/rules",
			modules,
		),
		aliases: buildAliases(
			coreRawDict.aliases,
			"core/aliases",
		),
	};
}) ?? { modules: [], rules: [], aliases: {} };

/** 各语言的词典；构建失败的语言退化为空词典（该语言一页不翻，但不影响其他语言） */
export const localeDicts: readonly LocaleDict[] =
	localeRawDicts.map((raw) => {
		const entries = new Map<string, unknown>(raw.modules);
		return (
			loadOrSkip(`locales/${raw.locale}`, () =>
				buildLocaleDict({
					locale: raw.locale,
					core: dictCore,
					entries,
					rulesRaw: raw.rules,
				}),
			) ?? { locale: raw.locale, modules: [] }
		);
	});

/** 取某语言的词典；未声明的语言回退到默认语言，默认语言也缺失时返回空词典 */
export function dictForLocale(
	locale: LocaleId,
): LocaleDict {
	const found = localeDicts.find(
		(dict) => dict.locale === locale,
	);
	if (found !== undefined) return found;
	return (
		localeDicts.find(
			(dict) => dict.locale === FALLBACK_LOCALE,
		) ?? { locale: FALLBACK_LOCALE, modules: [] }
	);
}
