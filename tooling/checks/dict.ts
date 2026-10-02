// 词典门禁：结构编译（严格）+ 跨文件交叉引用 + 词条与规则的语义约束 + 覆盖率报告
//
// 分工说明（改本文件前先读）：
// - 结构合法性（字段白名单、route 以 ^/ 锚定、正则可编译、规则不得带 flags）由
//   src/dict/load.ts 负责——本门禁走严格路径调用同一套函数，故校验逻辑只有一份；
// - 单文件内的重复键由 Biome 的 lint/suspicious/noDuplicateObjectKeys 负责
//   （biome check . 会扫 .jsonc，两种引号写法都能报），故这里不再扫源码；
// - 跨模块同键异译是「先到先得 + 模块顺序」的有意设计，不作错误（见 registry.ts 注释）；
// - 本文件补 loader 管不到的语义约束：
//   * core/canonical.jsonc 是键的权威清单——各语言词条的键不在清单里即报错（拼错即报），
//     它同时是覆盖率的分母与「译文不得等于任何键」的键集合；
//   * 译文必须含目标语言的文字系统（语言声明见 src/dict/locales.ts，不写死汉字）；
//   * 规范键必须等于引擎 normalizeKey 后的形态——带换行 / 制表符 / 连续空格的键永不命中，
//     只会虚高覆盖率（引擎自己的 normalizeKey 是唯一真源）；
//   * 同模块内规则 pattern 必须唯一——同模块首条命中生效，重复的那条永不生效；
//   * 规则模板引用的捕获组（$1 / $<name>）必须在对应 pattern 里存在；
//   * 防翻译循环的两条结构门禁（译文≠键、替换产物不再命中规则）。
//
// 零依赖 bun 直跑；校验逻辑导出为纯函数供测试复用；失败置 exitCode = 1。

import { hasNonLatinLetter } from "../../src/content/filters.ts";
import canonicalRaw from "../../src/dict/core/canonical.jsonc";
import {
	buildAliases,
	buildEntries,
	buildLocaleDict,
	buildModules,
	buildReplacements,
	buildRuleDefs,
} from "../../src/dict/load.ts";
import {
	getLocaleMeta,
	isLocaleId,
	LOCALES,
	type LocaleMeta,
	type Script,
} from "../../src/dict/locales.ts";
import {
	coreRawDict,
	localeRawDicts,
} from "../../src/dict/registry.ts";
// 用引擎自己的归一化函数判定规范键形态（唯一真源，避免两套判定标准）。
// 它住在无 DOM 依赖的 shared/text.ts——脚本侧 tsconfig 不含 DOM，不能 import walker.ts
import { normalizeKey } from "../../src/shared/text.ts";
import type {
	DictCore,
	LocaleDict,
	RuleDef,
} from "../../src/shared/types.ts";

// —— core/canonical.jsonc ——

/** 一个字系一个正则；门禁调用量小，无需缓存池 */
function scriptPattern(script: Script): RegExp {
	return new RegExp(`\\p{Script=${script}}`, "u");
}

/** 文本是否含指定语言文字系统的字母（scripts 为空 = 拉丁语系目标，无从判定） */
function hasAnyScript(
	text: string,
	scripts: readonly Script[],
): boolean {
	if (scripts.length === 0) return false;
	return scripts.some((script) =>
		scriptPattern(script).test(text),
	);
}

/**
 * 还原正则源里的 \uXXXX / \u{...} 转义。
 * Bun 会把正则源中的非 ASCII 字符规范化为转义序列，
 * 直接对 source 查字系会漏检。
 */
function decodeUnicodeEscapes(source: string): string {
	return source.replaceAll(
		/\\u\{?([0-9a-fA-F]{4,6})\}?/g,
		(_match, hex: string) =>
			String.fromCodePoint(Number.parseInt(hex, 16)),
	);
}

// —— core/canonical.jsonc ——

export interface CanonicalModule {
	readonly name: string;
	readonly keys: readonly string[];
}

const CANONICAL_KEYS: readonly string[] = ["modules"];

/** 编译 core/canonical.jsonc（仅门禁使用的键清单），非法即抛中文错误 */
export function buildCanonical(
	raw: unknown,
	where: string,
): readonly CanonicalModule[] {
	if (raw === null || typeof raw !== "object") {
		throw new Error(`${where}：必须是对象`);
	}
	const source = raw as Record<string, unknown>;
	for (const key of Object.keys(source)) {
		if (key === "$schema") continue;
		if (!CANONICAL_KEYS.includes(key)) {
			throw new Error(
				`${where}：未知字段 ${JSON.stringify(key)}`,
			);
		}
	}
	const modules = source["modules"];
	if (!Array.isArray(modules)) {
		throw new Error(`${where} modules：必须是数组`);
	}
	return modules.map((item, index) => {
		const at = `${where} modules[${index}]`;
		if (item === null || typeof item !== "object") {
			throw new Error(`${at}：必须是对象`);
		}
		const record = item as Record<string, unknown>;
		const name = record["name"];
		if (typeof name !== "string" || name.length === 0) {
			throw new Error(`${at} name：必须是非空字符串`);
		}
		const keys = record["keys"];
		if (!Array.isArray(keys)) {
			throw new Error(`${at} keys：必须是数组`);
		}
		return {
			name,
			keys: keys.map((key, keyIndex) => {
				if (typeof key !== "string") {
					throw new Error(
						`${at} keys[${keyIndex}]：必须是字符串`,
					);
				}
				return key;
			}),
		};
	});
}

/**
 * 校验规范键自身形态（键是英文原文，不得含目标语言文字系统）。
 *
 * 其中「键必须等于引擎归一化后的形态」这条是 2026-09 事故的补丁：键里若带换行符 /
 * 制表符 / 连续空格，引擎查表前会先对**节点文本**做 normalizeKey（trim + 折叠空白），
 * 归一化后的文本永远不可能等于这样的键——于是该词条在实机永不命中，却仍然计入
 * 覆盖率分母（`insights` 的过滤说明句就是这样混进 100% 的）。这里用引擎自己的
 * normalizeKey 判定，保证「门禁认的形态」与「引擎查的形态」是同一个。
 */
export function validateCanonicalKeys(
	module: CanonicalModule,
	where: string,
): string[] {
	const errors: string[] = [];
	const seen = new Set<string>();
	for (const key of module.keys) {
		const label = `${where} 键 ${JSON.stringify(key)}`;
		if (key.trim().length === 0)
			errors.push(`${label}：键不能为空`);
		if (key !== key.trim())
			errors.push(`${label}：键不得含首尾空白`);
		if (normalizeKey(key) !== key) {
			errors.push(
				`${label}：键必须是引擎归一化后的形态（trim + 连续空白折叠为单空格），实为 ${JSON.stringify(normalizeKey(key))}——带换行符 / 制表符 / 连续空格的键永不命中，只会虚高覆盖率`,
			);
		}
		if (hasNonLatinLetter(key))
			errors.push(
				`${label}：键必须保持英文原文，不得含非拉丁字母`,
			);
		if (!/[a-z]/i.test(key)) {
			errors.push(
				`${label}：键不含拉丁字母（疑似误收录纯符号 / 数字）`,
			);
		}
		if (seen.has(key))
			errors.push(`${label}：同一模块内键重复`);
		seen.add(key);
	}
	return errors;
}

/**
 * 同模块内的规则 pattern 必须唯一。
 *
 * 运行时的规则按模块顺序排列，**同模块内首条命中即返回**（见 walker.ts 的 translateText），
 * 因此同模块里两条 pattern 相同的规则，后者是永不生效的死规则——它照样占着
 * core/rules.jsonc 与各语言模板，还会让「规则总数」这个数字失真
 * （2026-09 实例：5 月的全称与缩写同形，`usage-range-same-month-may` 与
 * `usage-range-short-same-month-may` 逐字符相同）。
 *
 * 跨模块重复是**合法**的：路由互斥的模块可以各自收同形规则
 * （例如 settings/month-year-* 与 insights/month-year-*），故只查同模块内。
 */
export function validateRulePatternUniqueness(
	defs: readonly RuleDef[],
): string[] {
	const errors: string[] = [];
	const firstByModuleAndPattern = new Map<string, string>();
	for (const def of defs) {
		const at = `${def.module}\u0000${def.pattern.source}`;
		const first = firstByModuleAndPattern.get(at);
		if (first === undefined) {
			firstByModuleAndPattern.set(at, def.id);
			continue;
		}
		errors.push(
			`core/rules ${JSON.stringify(def.id)}：pattern 与同模块的 ${JSON.stringify(first)} 完全相同（${JSON.stringify(def.pattern.source)}）——同模块内首条命中生效，这条永不生效（May 这类全称与缩写同形的月份，只留一条）`,
		);
	}
	return errors;
}

/** 规范键清单与模块清单必须逐一对应（名字与顺序都一致） */
export function validateCanonicalModules(
	canonical: readonly CanonicalModule[],
	modules: readonly { name: string }[],
): string[] {
	const expected = modules.map((module) => module.name);
	const actual = canonical.map((module) => module.name);
	if (expected.join("\u0000") === actual.join("\u0000")) {
		return [];
	}
	return [
		`core/canonical.jsonc 的模块必须与 core/modules.jsonc 同名同序：期望 [${expected.join(", ")}]，实为 [${actual.join(", ")}]`,
	];
}

// —— 词条与规则 ——

/** 校验一组词条：键必须在规范键清单里，值必须含目标语言文字系统 */
export function validateEntries(
	entries: Readonly<Record<string, string>>,
	where: string,
	locale: LocaleMeta,
	canonicalKeys: ReadonlySet<string>,
): string[] {
	const errors: string[] = [];
	for (const [key, value] of Object.entries(entries)) {
		const label = `${where} 词条 ${JSON.stringify(key)}`;
		if (!canonicalKeys.has(key)) {
			errors.push(
				`${label}：键不在 core/canonical.jsonc 里（拼错了？上游改了原文就该改清单或加别名）`,
			);
		}
		if (
			typeof value !== "string" ||
			value.trim().length === 0
		) {
			errors.push(`${label}：值不能为空`);
			continue;
		}
		if (
			locale.scripts.length > 0 &&
			!hasAnyScript(value, locale.scripts)
		) {
			errors.push(
				`${label}：值必须含 ${locale.name} 的文字系统（${locale.scripts.join(" / ")}）`,
			);
		}
	}
	return errors;
}

/** 取出替换模板引用的捕获组：位置引用 $1 与命名引用 $<name> / $<name:默认值> */
export function extractTemplateRefs(template: string): {
	readonly indexes: readonly number[];
	readonly names: readonly string[];
} {
	const indexes: number[] = [];
	const names: string[] = [];
	for (const match of template.matchAll(
		/\$(?:(\d+)|<([^>:]*)>)/g,
	)) {
		if (match[1] !== undefined) {
			indexes.push(Number.parseInt(match[1], 10));
		} else if (match[2] !== undefined) {
			names.push(match[2]);
		}
	}
	return { indexes, names };
}

/** pattern 的捕获组总数（追加空分支是 JS 里数捕获组的惯用技巧） */
export function countGroups(pattern: RegExp): number {
	const probe = new RegExp(`${pattern.source}|`);
	const match = probe.exec("");
	return (match?.length ?? 1) - 1;
}

/** pattern 里声明的命名捕获组名 */
export function namedGroups(pattern: RegExp): string[] {
	const names: string[] = [];
	for (const match of pattern.source.matchAll(
		/\(\?<([A-Za-z_$][A-Za-z0-9_$]*)>/g,
	)) {
		if (match[1] !== undefined) names.push(match[1]);
	}
	return names;
}

/** 校验一条规则模板：形态（含目标文字系统）+ 捕获组引用完整性 */
export function validateTemplate(
	template: string,
	def: RuleDef,
	where: string,
	locale: LocaleMeta,
): string[] {
	const errors: string[] = [];
	// 空模板是合法语义：**该节点在目标语言里整个消失**（引擎会连同它的首尾空白一起
	// 清空，见 src/content/walker.ts 的 applyTextNode）。首例是账单卡片计费周期后缀
	// 被上游拆成 `per ` + `month` 两个节点，前者在中文里没有对应词（2026-09）。
	// 空模板没有文本，故跳过下面的「必须含目标文字系统」校验（那里是防翻译循环的，
	// 对空模板没有对象）；捕获组引用检查照常走。
	if (template.length === 0) return errors;
	if (
		locale.scripts.length > 0 &&
		!hasAnyScript(template, locale.scripts)
	) {
		errors.push(
			`${where}：模板必须含 ${locale.name} 的文字系统（${locale.scripts.join(" / ")}），防翻译循环`,
		);
	}
	const refs = extractTemplateRefs(template);
	const total = countGroups(def.pattern);
	for (const index of refs.indexes) {
		if (index >= 1 && index <= total) continue;
		errors.push(
			`${where}：模板引用了 $${index}，但 pattern 只有 ${total} 个捕获组（${JSON.stringify(def.pattern.source)}）`,
		);
	}
	const declared = new Set(namedGroups(def.pattern));
	for (const name of refs.names) {
		if (declared.has(name)) continue;
		errors.push(
			`${where}：模板引用了 $<${name}>，但 pattern 未声明该命名组（已声明：${[...declared].join(" / ") || "无"}）`,
		);
	}
	return errors;
}

/** 校验共享规则 pattern 的非英文字系（输入恒为英文原文） */
export function validateRuleDef(
	def: RuleDef,
	where: string,
): string[] {
	if (def.pattern.source.length === 0) {
		return [`${where}：pattern 不能为空`];
	}
	if (
		hasNonLatinLetter(
			decodeUnicodeEscapes(def.pattern.source),
		)
	) {
		return [
			`${where}：pattern 不得含非拉丁字母（输入恒为英文原文）`,
		];
	}
	return [];
}

/**
 * 防翻译循环的结构门禁（形状与语言无关的一半）：译文不得等于任何键。
 *
 * **这条检查没有白名单，也不该有。** 译文与键同形时，引擎会在每一轮都「命中」，
 * 并对同一个值反复执行 `node.nodeValue = 同值`：DOM 规范规定赋相同字符串也会产生
 * characterData 变更记录，观察器于是把它再入队——微任务队列无限自转，页面不报错
 * 但主线程被榨干（2026-09 真实事故：`"ORCID iD": "ORCID iD"` 让 /settings/profile 卡死）。
 * 想保留英文原文的专名，正确做法是**不收录该词条**（未命中即保留英文），而不是让
 * 译文等于键。
 *
 * 翻译循环的真实条件是两条同时成立：(a) 脚本守卫没拦住译文，(b) 译文本身又是
 * 一个键、或能命中某条规则。这里从结构上让 (b) 不可能发生，于是各语言拿到同一
 * 套保证——包括拉丁语系目标（脚本守卫对它们结构上失效）。
 * 别名源文本也算「键」：它是引擎的另一种输入，译文等于它同样会被二次翻译。
 */
export function validateNoIdentity(
	entries: Readonly<Record<string, string>>,
	where: string,
	keys: ReadonlySet<string>,
): string[] {
	const errors: string[] = [];
	for (const [key, value] of Object.entries(entries)) {
		const trimmed = value.trim();
		if (!keys.has(trimmed)) continue;
		errors.push(
			`${where} 词条 ${JSON.stringify(key)}：译文 ${JSON.stringify(trimmed)} 等于某个键（或别名源文本），会在每一轮被再翻一次并自我触发观察器（防循环）。保留英文原文的正确做法是不收录该词条`,
		);
	}
	return errors;
}

/**
 * 防翻译循环的结构门禁（另一半）：规则的替换产物不得再命中任何规则。
 * 校验对象是替换模板本身——真实产物含捕获组取值，无法穷举，但所有规则都以英文
 * 字面量为锚，模板能命中即说明有循环风险（实测现有数据命中数为 0）。
 */
export function validateRulesRematch(
	templates: readonly { id: string; template: string }[],
	defs: readonly RuleDef[],
	where: string,
): string[] {
	const errors: string[] = [];
	for (const { id, template } of templates) {
		if (template.trim().length === 0) continue;
		for (const def of defs) {
			if (!def.pattern.test(template)) continue;
			errors.push(
				`${where} 规则模板 ${JSON.stringify(id)} 会被规则 ${JSON.stringify(def.id)} 再次命中（${JSON.stringify(template)}）：防循环`,
			);
			break;
		}
	}
	return errors;
}

/** 校验别名：源必须是英文原文，目标必须是规范键，且两者不能相同 */
export function validateAliases(
	aliases: Readonly<Record<string, string>>,
	where: string,
	canonicalKeys: ReadonlySet<string>,
): string[] {
	const errors: string[] = [];
	for (const [source, target] of Object.entries(aliases)) {
		if (hasNonLatinLetter(source)) {
			errors.push(
				`${where} 别名 ${JSON.stringify(source)}：源文本必须是 GitHub 渲染的英文原文`,
			);
		}
		if (!canonicalKeys.has(target)) {
			errors.push(
				`${where} 别名 ${JSON.stringify(source)}：目标 ${JSON.stringify(target)} 不在 core/canonical.jsonc 里`,
			);
		}
		if (source === target) {
			errors.push(
				`${where} 别名 ${JSON.stringify(source)}：源与目标相同，无需别名`,
			);
		}
	}
	return errors;
}

// —— 汇总与主流程 ——

export interface BuiltCore {
	readonly core: DictCore | null;
	readonly canonical: readonly CanonicalModule[];
	readonly errors: readonly string[];
}

/** 严格构建语言无关的核心数据 + 键清单（一次列全所有问题） */
export function buildCore(raw?: {
	readonly modules: unknown;
	readonly rules: unknown;
	readonly aliases: unknown;
	readonly canonical: unknown;
}): BuiltCore {
	const input = raw ?? {
		modules: coreRawDict.modules,
		rules: coreRawDict.rules,
		aliases: coreRawDict.aliases,
		canonical: canonicalRaw,
	};
	const errors: string[] = [];
	let core: DictCore | null = null;
	try {
		const modules = buildModules(
			input.modules,
			"core/modules",
		);
		core = {
			modules,
			rules: buildRuleDefs(
				input.rules,
				"core/rules",
				modules,
			),
			aliases: buildAliases(input.aliases, "core/aliases"),
		};
		for (const def of core.rules) {
			errors.push(
				...validateRuleDef(def, `core/rules ${def.id}`),
			);
		}
	} catch (error) {
		errors.push(
			error instanceof Error
				? error.message
				: String(error),
		);
	}
	let canonical: readonly CanonicalModule[] = [];
	try {
		canonical = buildCanonical(
			input.canonical,
			"core/canonical",
		);
	} catch (error) {
		errors.push(
			error instanceof Error
				? error.message
				: String(error),
		);
	}
	for (const module of canonical) {
		errors.push(
			...validateCanonicalKeys(
				module,
				`core/canonical ${module.name}`,
			),
		);
	}
	if (core !== null) {
		errors.push(
			...validateRulePatternUniqueness(core.rules),
		);
	}
	if (core !== null && canonical.length > 0) {
		errors.push(
			...validateCanonicalModules(canonical, core.modules),
		);
		errors.push(
			...validateAliases(
				core.aliases,
				"core/aliases",
				new Set(
					canonical.flatMap((module) => [...module.keys]),
				),
			),
		);
	}
	return { core, canonical, errors };
}

export interface BuiltLocale {
	readonly locale: LocaleMeta;
	readonly dict: LocaleDict | null;
	readonly errors: readonly string[];
	/** 已翻译键数 / 规范键总数（分母来自 core/canonical.jsonc） */
	readonly translated: number;
	readonly total: number;
	/** 各模块缺译情况：模块名 → { 已译, 总数 } */
	readonly perModule: readonly (readonly [
		string,
		number,
		number,
	])[];
}

/** 严格构建并校验一个语言的数据 */
export function buildLocaleData(input: {
	readonly localeId: string;
	readonly core: DictCore;
	readonly canonical: readonly CanonicalModule[];
	readonly modules: readonly (readonly [string, unknown])[];
	readonly rulesRaw: unknown | null;
}): BuiltLocale | null {
	const { localeId } = input;
	if (!isLocaleId(localeId)) return null;
	const locale = getLocaleMeta(localeId);
	const errors: string[] = [];
	const where = `locales/${localeId}`;
	const canonicalByModule = new Map(
		input.canonical.map((module) => [
			module.name,
			new Set(module.keys),
		]),
	);
	// 「键集合」= 规范键 ∪ 别名源文本（两者都是引擎输入，译文等于它们都会被再翻一次）
	const allKeys = new Set<string>(
		input.canonical.flatMap((module) => [...module.keys]),
	);
	for (const source of Object.keys(input.core.aliases)) {
		allKeys.add(source);
	}

	for (const [moduleName, raw] of input.modules) {
		const keys = canonicalByModule.get(moduleName);
		if (keys === undefined) {
			errors.push(
				`${where}/${moduleName}：模块未在 core/modules.jsonc 里声明`,
			);
			continue;
		}
		try {
			const entries = buildEntries(
				raw,
				`${where}/${moduleName}`,
			);
			errors.push(
				...validateEntries(
					entries,
					`${where}/${moduleName}`,
					locale,
					keys,
				),
				...validateNoIdentity(
					entries,
					`${where}/${moduleName}`,
					allKeys,
				),
			);
		} catch (error) {
			errors.push(
				error instanceof Error
					? error.message
					: String(error),
			);
		}
	}

	let replacements: Readonly<Record<string, string>> = {};
	if (input.rulesRaw !== null) {
		try {
			replacements = buildReplacements(
				input.rulesRaw,
				`${where}/rules`,
				input.core.rules,
			);
		} catch (error) {
			errors.push(
				error instanceof Error
					? error.message
					: String(error),
			);
		}
	}
	const byId = new Map(
		input.core.rules.map((def) => [def.id, def]),
	);
	const templates: { id: string; template: string }[] = [];
	for (const [id, template] of Object.entries(
		replacements,
	)) {
		const def = byId.get(id);
		if (def === undefined) continue;
		templates.push({ id, template });
		errors.push(
			...validateTemplate(
				template,
				def,
				`${where}/rules ${id}`,
				locale,
			),
			...validateNoIdentity(
				{ [id]: template },
				`${where}/rules`,
				allKeys,
			),
		);
	}
	errors.push(
		...validateRulesRematch(
			templates,
			input.core.rules,
			where,
		),
	);

	// 严格组装一次：结构与交叉引用问题也要能在这里暴露
	let dict: LocaleDict | null = null;
	try {
		dict = buildLocaleDict({
			locale: localeId,
			core: input.core,
			entries: new Map(input.modules),
			rulesRaw: input.rulesRaw,
		});
	} catch (error) {
		errors.push(
			error instanceof Error
				? error.message
				: String(error),
		);
	}

	const perModule: (readonly [string, number, number])[] =
		[];
	let translated = 0;
	let total = 0;
	const shipped = new Map(input.modules);
	for (const module of input.canonical) {
		const totalKeys = module.keys.length;
		total += totalKeys;
		const raw = shipped.get(module.name);
		let done = 0;
		if (raw !== undefined) {
			try {
				const entries = buildEntries(
					raw,
					`${where}/${module.name}`,
				);
				done = Object.keys(entries).filter((key) =>
					module.keys.includes(key),
				).length;
			} catch {
				done = 0;
			}
		}
		translated += done;
		perModule.push([module.name, done, totalKeys]);
	}
	return {
		locale,
		dict,
		errors,
		translated,
		total,
		perModule,
	};
}

/** 覆盖率报告：总覆盖率 + 尚未开译的模块（稀疏覆盖不是错误，缺多少要看得见） */
export function formatCoverage(built: BuiltLocale): string {
	if (built.total === 0)
		return `${built.locale.id}：无规范键`;
	const percent = (
		(built.translated / built.total) *
		100
	).toFixed(1);
	const pending = built.perModule
		.filter(([, done, total]) => done < total)
		.map(
			([name, done, total]) => `${name} ${done}/${total}`,
		);
	const tail =
		pending.length === 0
			? "全部已译"
			: `${pending.length} 个模块待译`;
	return `${built.locale.id} ${built.translated}/${built.total}（${percent}%，${tail}）`;
}

function report(errors: readonly string[]): void {
	console.error(`词典门禁未通过（${errors.length} 处）：`);
	for (const error of errors) console.error(`  - ${error}`);
	process.exitCode = 1;
}

function main(): void {
	// 语言表自身的完整性：任一字系名必须能编译成正则（防手写错名字静默失效）
	for (const meta of LOCALES) {
		for (const script of meta.scripts) {
			try {
				scriptPattern(script);
			} catch (error) {
				console.error(
					`语言 ${meta.id} 声明了无法识别的文字系统 ${script}：${String(error)}`,
				);
				process.exitCode = 1;
				return;
			}
		}
	}

	const builtCore = buildCore();
	const errors = [...builtCore.errors];
	if (builtCore.core === null) {
		report(errors);
		return;
	}
	const core = builtCore.core;

	// 声明了却没数据 / 有数据却没声明，都是配置错误
	const declared = new Set<string>(
		LOCALES.map((meta) => meta.id),
	);
	const shipped = new Set<string>(
		localeRawDicts.map((raw) => raw.locale),
	);
	for (const id of declared) {
		if (!shipped.has(id)) {
			errors.push(
				`${id}：src/dict/locales.ts 声明了该语言，但 src/dict/registry.ts 里没有它的数据`,
			);
		}
	}
	for (const id of shipped) {
		if (!declared.has(id)) {
			errors.push(
				`${id}：src/dict/registry.ts 里有数据，但 src/dict/locales.ts 未声明该语言`,
			);
		}
	}

	const built: BuiltLocale[] = [];
	for (const raw of localeRawDicts) {
		const localeData = buildLocaleData({
			localeId: raw.locale,
			core,
			canonical: builtCore.canonical,
			modules: raw.modules,
			rulesRaw: raw.rules,
		});
		if (localeData === null) {
			errors.push(
				`${raw.locale}：不是 src/dict/locales.ts 里声明的语言 id`,
			);
			continue;
		}
		errors.push(...localeData.errors);
		built.push(localeData);
	}

	if (errors.length > 0) {
		report(errors);
		return;
	}
	const canonicalKeys = builtCore.canonical.reduce(
		(sum, module) => sum + module.keys.length,
		0,
	);
	const translated = built.reduce(
		(sum, localeData) => sum + localeData.translated,
		0,
	);
	console.log(
		`词典门禁通过：${core.modules.length} 模块 / ${canonicalKeys} 规范键 / ${core.rules.length} 条共享规则 / ${translated} 条译文`,
	);
	console.log(
		`覆盖率：${built.map((localeData) => formatCoverage(localeData)).join(" | ")}`,
	);
}

if (import.meta.main) main();
