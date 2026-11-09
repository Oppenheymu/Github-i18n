// 语言元数据表：已支持的目标语言、显示名与文字系统声明
//
// 为什么需要它：词典门禁要判断「译文是否真的译成了目标语言」，而语言相关的判定
// 绝不能写死汉字——纯假名的日语译文（「もっと見る」）在 CJK 判定下会被直接拒绝，
// 韩语 / 俄语更是一条都过不了。因此把「目标语言用什么文字系统」集中声明在这里，
// 业务代码只消费声明，不内联任何具体文字系统。
//
// 基线语言（BASELINE_LOCALE）是简体中文：新键一律先在 core/canonical.jsonc 登记、
// 再补基线的译文，其余语言按需跟进。缺键 = 尚未翻译（引擎保留英文），**门禁不要求
// 其它语言与基线同步**；只有基线的 100% 覆盖率由 bun test 强制（见
// tooling/checks/__tests__/dict.test.ts 的「real dictionaries」）。

/**
 * 目标语言使用的 Unicode 文字系统（即 `\p{Script=X}` 的 X）。
 * 只登记当前确实使用的项；新增语言需要新字系时在这里补一个名字即可。
 */
export type Script =
	| "Han"
	| "Hiragana"
	| "Katakana"
	| "Cyrillic"
	| "Hangul";

/** 已支持的目标语言 id（即 BCP 47 标签的规范写法） */
export type LocaleId =
	| "zh-CN"
	| "zh-TW"
	| "ja"
	| "ko"
	| "es"
	| "fr"
	| "de"
	| "pt-BR"
	| "pt-PT"
	| "ru";

export interface LocaleMeta {
	/** 语言 id：同时是 locales/<id>/ 目录名与 storage 里存的值 */
	readonly id: LocaleId;
	/** 显示名：用该语言自身书写，供 popup 语言选择器展示 */
	readonly name: string;
	/**
	 * 该语言的译文至少应命中的文字系统之一，门禁据此校验译文形态。
	 * 空数组 = 拉丁语系目标：它与源语言共用拉丁字母，无法凭字系区分
	 * 「已翻译」与「英文原文」，防循环只能靠「译文不得等于任何键」的结构门禁
	 * （见 tooling/checks/dict.ts）——这是已知边界，不是遗漏。
	 */
	readonly scripts: readonly Script[];
	/**
	 * 是否达到可上架质量（通常 = 词条与规则模板 100% 覆盖）。
	 *
	 * 只有 ready 的语言会出现在 popup 的翻译语言选择器里：把 0% 的语言摆给用户，
	 * 选了之后整页仍显示英文，等于欺骗。空骨架语言继续留在 LOCALES / registry 里
	 * （自动语言解析、覆盖率报告、后续开译都要用），只是不再作为可选项展示。
	 *
	 * 门禁 check:dict 强制本字段与真实覆盖率一致：ready 但没译满、或译满了却没
	 * 标 ready，都会红灯——这样「开译完成」与「上架可见」不会悄悄脱节。
	 */
	readonly ready: boolean;
}

/**
 * 支持的语言：顺序即 LOCALES 的展示顺序；popup 只展示其中 `ready` 的项。
 *
 * 分组：基线 / 繁体 / 日 / 韩（非拉丁文字，门禁可校验字系），
 * 再是拉丁语系（西 / 法 / 德 / 葡）与俄语。新语言排在原有语言之后即可，
 * 顺序不影响翻译能力，只影响选择器的展示顺序。
 */
export const LOCALES: readonly LocaleMeta[] = [
	{
		id: "zh-CN",
		name: "简体中文",
		scripts: ["Han"],
		ready: true,
	},
	{
		id: "zh-TW",
		name: "繁體中文",
		scripts: ["Han"],
		ready: false,
	},
	{
		id: "ja",
		name: "日本語",
		scripts: ["Han", "Hiragana", "Katakana"],
		ready: true,
	},
	{
		id: "ko",
		name: "한국어",
		scripts: ["Hangul"],
		ready: false,
	},
	{
		id: "es",
		name: "Español",
		scripts: [],
		ready: false,
	},
	{
		id: "fr",
		name: "Français",
		scripts: [],
		ready: false,
	},
	{
		id: "de",
		name: "Deutsch",
		scripts: [],
		ready: false,
	},
	{
		id: "pt-BR",
		name: "Português (Brasil)",
		scripts: [],
		ready: false,
	},
	{
		id: "pt-PT",
		name: "Português (Portugal)",
		scripts: [],
		ready: false,
	},
	{
		id: "ru",
		name: "Русский",
		scripts: ["Cyrillic"],
		ready: false,
	},
];

/**
 * 基线语言：新键先登记、先翻译的对象。
 *
 * 它同时是「翻译工作流」的基准与其它语言的参照：基线没译的键，其它语言一般也
 * 不必先译（但门禁不禁止）。改动这里等于改变「中文先行」的约定，须同步
 * tooling/checks/dict.ts 的覆盖率输出与 docs/guides/development.md。
 */
export const BASELINE_LOCALE: LocaleId = "zh-CN";

/** 未指定 / 识别不出浏览器语言时的回退语言（也是本扩展的传统默认） */
export const FALLBACK_LOCALE: LocaleId = BASELINE_LOCALE;

export function isLocaleId(
	value: unknown,
): value is LocaleId {
	return (
		typeof value === "string" &&
		LOCALES.some((meta) => meta.id === value)
	);
}

/** 取语言元数据；id 不存在即抛错（防类型与注册表脱节） */
export function getLocaleMeta(id: LocaleId): LocaleMeta {
	const meta = LOCALES.find(
		(candidate) => candidate.id === id,
	);
	if (meta === undefined) {
		throw new Error(`未声明的语言：${id}`);
	}
	return meta;
}

/** 浏览器标签里「尾随子标签」的脚本 / 地区形态（主语言之后的 4 字母 / 2 字母 / 3 位数字） */
const SCRIPT_SUBTAG = /^[a-z]{4}$/;
const REGION_SUBTAG = /^(?:[a-z]{2}|\d{3})$/;

/**
 * 浏览器语言标签 → 已支持的语言 id。
 *
 * 顺序：忽略大小写精确匹配（`zh-cn` / `zh_CN` 都算）→ 中文 / 葡语按脚本 / 地区
 * 选变体 → 同一主语言子标签的第一个声明（`es-MX` → es、`fr-CA` → fr）→ 回退。
 *
 * 为什么中文 / 葡语要特判：它们各有多个已声明变体，若只按主语言取第一个，
 * `zh-Hant-HK` 会被判成简体、`pt-PT` 会被判成巴西葡语——文字或语区用词都不同，
 * 错判比保留英文更糟。其余语言目前只有一个变体，按主语言匹配即可。
 */
export function resolveLocale(tag: string): LocaleId {
	const normalized = tag
		.trim()
		.toLowerCase()
		.replaceAll("_", "-");
	if (normalized.length === 0) return FALLBACK_LOCALE;
	for (const meta of LOCALES) {
		if (meta.id.toLowerCase() === normalized)
			return meta.id;
	}
	const parts = normalized.split("-");
	const language = parts[0] ?? "";
	const tail = parts.slice(1);
	const script = tail.find((part) =>
		SCRIPT_SUBTAG.test(part),
	);
	const region = tail.find((part) =>
		REGION_SUBTAG.test(part),
	);
	if (language === "zh") {
		// 脚本优先于地区（BCP 47 语义）：zh-Hans-HK 仍是简体
		const traditional =
			script === "hant" ||
			(script === undefined &&
				(region === "tw" ||
					region === "hk" ||
					region === "mo"));
		return traditional ? "zh-TW" : "zh-CN";
	}
	if (language === "pt") {
		// 无地区（pt）与巴西按 pt-BR；其余地区（pt-PT / pt-AO…）按欧洲葡语
		return region === undefined || region === "br"
			? "pt-BR"
			: "pt-PT";
	}
	const primary = LOCALES.find(
		(meta) =>
			meta.id.toLowerCase().split("-")[0] === language,
	);
	return primary?.id ?? FALLBACK_LOCALE;
}
