import { describe, expect, it } from "bun:test";
import canonicalRaw from "../../../src/dict/core/canonical.jsonc";
import {
	buildEntries,
	buildModules,
	buildReplacements,
	buildRuleDefs,
} from "../../../src/dict/load.ts";
import {
	getLocaleMeta,
	LOCALES,
} from "../../../src/dict/locales.ts";
import {
	coreRawDict,
	localeRawDicts,
} from "../../../src/dict/registry.ts";
import type { RuleDef } from "../../../src/shared/types.ts";
import {
	buildCanonical,
	buildCore,
	buildLocaleData,
	countGroups,
	extractTemplateRefs,
	formatCoverage,
	namedGroups,
	validateAliases,
	validateCanonicalKeys,
	validateCanonicalModules,
	validateEntries,
	validateNoIdentity,
	validateRulePatternUniqueness,
	validateRulesRematch,
	validateTemplate,
} from "../dict.ts";

/** 复数 zh / ja 的语言声明（校验逻辑必须靠声明，而不是硬编码汉字） */
const ZH = getLocaleMeta("zh-CN");
const JA = getLocaleMeta("ja");

const modulesRaw = () => ({
	modules: [
		{ name: "pages/issues", route: "^/[^/]+/[^/]+/issues" },
		{ name: "global", route: "^/" },
	],
});

describe("buildModules", () => {
	it("compiles routes and requires global to come last", () => {
		const modules = buildModules(modulesRaw(), "测试");
		expect(modules).toHaveLength(2);
		expect(modules[1]?.route.test("/anything/at/all")).toBe(
			true,
		);
	});

	it("rejects a global module that is not last", () => {
		expect(() =>
			buildModules(
				{
					modules: [
						{ name: "global", route: "^/" },
						{
							name: "pages/x",
							route: "^/x",
						},
					],
				},
				"测试",
			),
		).toThrow(/最后一个模块必须是 global/);
	});

	it("rejects unknown fields and duplicated names", () => {
		expect(() =>
			buildModules({ modules: [], entires: {} }, "测试"),
		).toThrow(/未知字段/);
		expect(() =>
			buildModules(
				{
					modules: [
						{ name: "pages/x", route: "^/x" },
						{ name: "pages/x", route: "^/y" },
					],
				},
				"测试",
			),
		).toThrow(/模块名不得重复/);
	});
});

describe("buildRuleDefs", () => {
	const modules = buildModules(modulesRaw(), "测试");

	it("compiles rule ids and patterns", () => {
		const defs = buildRuleDefs(
			{
				modules: [
					{
						name: "global",
						rules: [
							{
								id: "global/minutes-ago",
								pattern: "^(\\d+) minutes? ago$",
							},
						],
					},
				],
			},
			"测试",
			modules,
		);
		expect(defs).toHaveLength(1);
		expect(defs[0]?.id).toBe("global/minutes-ago");
		expect(defs[0]?.pattern.test("5 minutes ago")).toBe(
			true,
		);
	});

	it("rejects unknown module names, duplicate ids and flags", () => {
		expect(() =>
			buildRuleDefs(
				{
					modules: [
						{
							name: "pages/nope",
							rules: [],
						},
					],
				},
				"测试",
				modules,
			),
		).toThrow(/未在 core\/modules.jsonc 里声明/);
		expect(() =>
			buildRuleDefs(
				{
					modules: [
						{
							name: "global",
							rules: [
								{ id: "a", pattern: "^a$" },
								{ id: "a", pattern: "^b$" },
							],
						},
					],
				},
				"测试",
				modules,
			),
		).toThrow(/规则 id 重复/);
		expect(() =>
			buildRuleDefs(
				{
					modules: [
						{
							name: "global",
							rules: [
								{
									id: "a",
									pattern: "^a$",
									flags: "g",
								},
							],
						},
					],
				},
				"测试",
				modules,
			),
		).toThrow(/flags/);
	});

	it("rejects rule groups that break the module order", () => {
		expect(() =>
			buildRuleDefs(
				{
					modules: [
						{ name: "global", rules: [] },
						{
							name: "pages/issues",
							rules: [],
						},
					],
				},
				"测试",
				modules,
			),
		).toThrow(/分组顺序必须与 core\/modules.jsonc 一致/);
	});
});

describe("buildReplacements", () => {
	const defs: RuleDef[] = [
		{
			id: "global/minutes-ago",
			module: "global",
			pattern: /^(\d+) minutes? ago$/,
		},
	];

	it("accepts known rule ids", () => {
		const replacements = buildReplacements(
			{
				replacements: { "global/minutes-ago": "$1 分钟前" },
			},
			"测试",
			defs,
		);
		expect(replacements["global/minutes-ago"]).toBe(
			"$1 分钟前",
		);
	});

	it("rejects unknown rule ids", () => {
		expect(() =>
			buildReplacements(
				{ replacements: { "global/nope": "甲" } },
				"测试",
				defs,
			),
		).toThrow(/未知规则 id/);
	});
});

describe("validateEntries", () => {
	const keys = new Set(["Star", "Markdown"]);

	it("accepts translations whose keys are canonical", () => {
		expect(
			validateEntries({ Star: "星标" }, "测试", ZH, keys),
		).toEqual([]);
	});

	it("reports keys that are not in the canonical list", () => {
		const errors = validateEntries(
			{ Strar: "星标" },
			"测试",
			ZH,
			keys,
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain("canonical");
	});

	it("requires the target script and accepts kana for japanese", () => {
		expect(
			validateEntries({ Star: "スター" }, "测试", JA, keys),
		).toEqual([]);
		expect(
			validateEntries(
				{ Star: "Star" },
				"测试",
				ZH,
				keys,
			).some((error) => error.includes("文字系统")),
		).toBe(true);
	});
});

describe("template references", () => {
	const def: RuleDef = {
		id: "global/date",
		module: "global",
		pattern: /^Jan (?<day>\d{1,2}), (\d{4})$/,
	};

	it("counts positional and named groups", () => {
		expect(countGroups(def.pattern)).toBe(2);
		expect(namedGroups(def.pattern)).toEqual(["day"]);
	});

	it("extracts both reference styles", () => {
		expect(extractTemplateRefs("$2 年 1 月 $1 日")).toEqual(
			{
				indexes: [2, 1],
				names: [],
			},
		);
		expect(extractTemplateRefs("$<day> 日")).toEqual({
			indexes: [],
			names: ["day"],
		});
	});

	it("accepts in-range references", () => {
		expect(
			validateTemplate(
				"$2 年 1 月 $<day> 日",
				def,
				"测试",
				ZH,
			),
		).toEqual([]);
	});

	it("rejects out-of-range and undeclared group references", () => {
		const errors = validateTemplate(
			"$3 日 $<month> 月",
			def,
			"测试",
			ZH,
		);
		expect(errors).toHaveLength(2);
		expect(errors[0]).toContain("$3");
		expect(errors[1]).toContain("$<month>");
	});

	it("accepts an empty template as the erase-the-node escape hatch", () => {
		// 空模板 = **该节点在目标语言里整个消失**（引擎连它的首尾空白一起清空，
		// 见 src/content/walker.ts 的 applyTextNode）。首例：账单卡片计费周期卡被上游
		// 拆成 `per ` + `month` 两个节点，`per ` 在中文里没有对应词（2026-09）。
		// 空模板没有文本，故「必须含目标文字系统」那条防循环校验对它不适用。
		expect(validateTemplate("", def, "测试", ZH)).toEqual(
			[],
		);
		// 纯空白模板仍按形态非法处理：它不是「消失」，而是会被原样写进节点
		expect(
			validateTemplate("   ", def, "测试", ZH).length,
		).toBeGreaterThan(0);
	});
});

describe("anti-loop gates", () => {
	it("flags a translation that equals some key", () => {
		const errors = validateNoIdentity(
			{ Markdown: "Markdown" },
			"测试",
			new Set(["Markdown", "Star"]),
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain("等于某个键");
	});

	it("has no whitelist: identity translations always fail", () => {
		// 事故回归（2026-09）：曾把 "ORCID iD": "ORCID iD" 放进白名单，
		// 引擎因此每轮命中并对同值重复写 nodeValue，/settings/profile 卡死。
		// 想保留英文原文的唯一正确做法是不收录该词条。
		const errors = validateNoIdentity(
			{ "ORCID iD": "ORCID iD" },
			"测试",
			new Set(["ORCID iD"]),
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain("自我触发");
	});

	it("flags a template that another rule would translate again", () => {
		const defs: RuleDef[] = [
			{
				id: "x/more",
				module: "global",
				pattern: /^Much more$/,
			},
			{
				id: "global/stars",
				module: "global",
				pattern: /^(\d+) stars$/,
			},
		];
		const errors = validateRulesRematch(
			[{ id: "x/more", template: "5 stars" }],
			defs,
			"测试",
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain("global/stars");
	});

	it("accepts existing data (measured 0 hits)", () => {
		const core = buildCore();
		expect(core.errors).toEqual([]);
		expect(core.core).not.toBeNull();
	});
});

describe("validateAliases", () => {
	it("requires an english source and a canonical target", () => {
		expect(
			validateAliases(
				{ "Sign in with GitHub": "Sign in to GitHub" },
				"测试",
				new Set(["Sign in to GitHub"]),
			),
		).toEqual([]);
		const errors = validateAliases(
			{ 登录: "Nope", Same: "Same" },
			"测试",
			new Set(["Nope"]),
		);
		expect(errors).toHaveLength(3);
	});
});

describe("validateCanonicalModules", () => {
	it("requires the same modules in the same order", () => {
		const canonical = [
			{ name: "a", keys: [] },
			{ name: "b", keys: [] },
		];
		expect(
			validateCanonicalModules(canonical, [
				{ name: "a" },
				{ name: "b" },
			]),
		).toEqual([]);
		expect(
			validateCanonicalModules(canonical, [
				{ name: "b" },
				{ name: "a" },
			]),
		).toHaveLength(1);
	});
});

describe("canonical key shape", () => {
	const module = (keys: string[]) => ({ name: "m", keys });

	it("accepts keys already in the engine's normalized form", () => {
		expect(
			validateCanonicalKeys(
				module([
					"Star",
					"Any repository that has not been created or updated during this period will be excluded.",
				]),
				"测试",
			),
		).toEqual([]);
	});

	it("rejects a key that contains a real newline", () => {
		// 引擎查表前会 normalizeKey 节点文本，键里的换行永远对不上（曾经的 insights 词条）
		const errors = validateCanonicalKeys(
			module([
				"Any repository that has not been created or\n    updated during this period will be excluded.",
			]),
			"测试",
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain("归一化");
	});

	it("rejects a key with collapsed-away whitespace", () => {
		expect(
			validateCanonicalKeys(module(["Load  more"]), "测试"),
		).toHaveLength(1);
		expect(
			validateCanonicalKeys(module(["Load\tmore"]), "测试"),
		).toHaveLength(1);
	});
});

describe("validateRulePatternUniqueness", () => {
	const def = (
		id: string,
		module: string,
		pattern: string,
	): RuleDef => ({
		id,
		module,
		pattern: new RegExp(pattern),
	});

	it("reports two identical patterns inside one module", () => {
		const errors = validateRulePatternUniqueness([
			def("m/same-may", "m", "^May (?<d>\\d)$"),
			def("m/short-may", "m", "^May (?<d>\\d)$"),
		]);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain("m/short-may");
		expect(errors[0]).toContain("m/same-may");
	});

	it("keeps cross-module duplicates legal", () => {
		// 路由互斥的模块各自收同形规则是有意设计（settings/month-year-* 与 insights/month-year-*）
		expect(
			validateRulePatternUniqueness([
				def(
					"settings/month-year-jan",
					"pages/settings-billing",
					"^Jan (?<y>\\d{4})$",
				),
				def(
					"insights/month-year-jan",
					"pages/insights",
					"^Jan (?<y>\\d{4})$",
				),
			]),
		).toEqual([]);
	});
});

describe("real dictionaries", () => {
	it("builds the shipped core without errors", () => {
		const core = buildCore();
		expect(core.errors).toEqual([]);
		expect(core.canonical.length).toBe(
			core.core?.modules.length ?? -1,
		);
	});

	it("validates every shipped locale without errors", () => {
		const core = buildCore();
		const dictCore = core.core;
		if (dictCore === null)
			throw new Error("核心数据构建失败");
		expect(localeRawDicts.map((raw) => raw.locale)).toEqual(
			LOCALES.map((meta) => meta.id),
		);
		for (const raw of localeRawDicts) {
			const built = buildLocaleData({
				localeId: raw.locale,
				core: dictCore,
				canonical: core.canonical,
				modules: raw.modules,
				rulesRaw: raw.rules,
			});
			expect(built?.errors ?? []).toEqual([]);
		}
	});

	it("compiles the shipped canonical key list", () => {
		const canonical = buildCanonical(
			canonicalRaw,
			"core/canonical",
		);
		const keys = canonical.flatMap((module) => [
			...module.keys,
		]);
		expect(keys.length).toBeGreaterThan(1600);
	});

	it("reports coverage for the shipped locales", () => {
		const core = buildCore();
		const dictCore = core.core;
		if (dictCore === null)
			throw new Error("核心数据构建失败");
		const report = localeRawDicts.map((raw) => {
			const built = buildLocaleData({
				localeId: raw.locale,
				core: dictCore,
				canonical: core.canonical,
				modules: raw.modules,
				rulesRaw: raw.rules,
			});
			if (built === null) throw new Error("未声明的语言");
			return { built, text: formatCoverage(built) };
		});
		const zh = report.find(
			(entry) => entry.built.locale.id === "zh-CN",
		);
		// 中文是完整词典：覆盖率必须是 100%
		expect(zh?.built.translated).toBe(zh?.built.total);
		const ja = report.find(
			(entry) => entry.built.locale.id === "ja",
		);
		// 日语目前只有样例，覆盖率低但必须被算出来（不是 0 也不是 100）
		expect(ja?.built.translated).toBeGreaterThan(0);
		expect(ja?.text).toContain("待译");
	});

	it("keeps the shipped background data loadable by the loader", () => {
		// 门禁与运行时共用 load.ts：这里再走一遍纯函数入口，防止两侧漂移
		const modules = buildModules(
			coreRawDict.modules,
			"core/modules",
		);
		const defs = buildRuleDefs(
			coreRawDict.rules,
			"core/rules",
			modules,
		);
		expect(defs.length).toBeGreaterThan(200);
		const entries = buildEntries(
			{ entries: { Star: "星标" } },
			"测试",
		);
		expect(entries["Star"]).toBe("星标");
	});
});
