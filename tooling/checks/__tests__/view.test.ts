import { describe, expect, it } from "bun:test";
import { localeRawDicts } from "../../../src/dict/registry.ts";
import type { ModuleDict } from "../../../src/shared/types.ts";
import {
	buildSkeleton,
	diffSkeleton,
	fixturePath,
	loadSkeletons,
	PROBE_PATHS,
	pathCounts,
	probeName,
	ruleIdMap,
	serializeSkeleton,
	type ViewSkeleton,
} from "../view.ts";

/** 合成模块：只需要 name / route / entries / rules 四个字段 */
function moduleDict(input: {
	readonly name: string;
	readonly route: RegExp;
	readonly entries: Record<string, string>;
	readonly rules?: readonly {
		readonly pattern: RegExp;
		readonly replacement: string;
	}[];
}): ModuleDict {
	return {
		name: input.name,
		route: input.route,
		entries: input.entries,
		rules: input.rules ?? [],
	};
}

/**
 * 合成规则 id 表：**模块名 + \0 + pattern 源串** → id。
 * 键的形态必须与 view.ts 的 ruleIdMap 一致（只按 pattern 建键会让两个模块的同形规则
 * 互相覆盖，那正是下面那条回归用例挡住的缺陷），故这里显式拼出复合键。
 */
function ruleIds(
	module: string,
	entries: readonly (readonly [string, string])[],
): ReadonlyMap<string, string> {
	return new Map(
		entries.map(([pattern, id]) => [
			`${module}\u0000${pattern}`,
			id,
		]),
	);
}

const CORE_MODULES = [
	"pages/settings",
	"pages/repo",
	"global",
];

/** 合成一套「设置页压过仓库页、仓库页压过 global」的词典 */
function syntheticModules(): ModuleDict[] {
	return [
		moduleDict({
			name: "pages/settings",
			route: /^\/settings/,
			entries: { Name: "姓名" },
		}),
		moduleDict({
			name: "pages/repo",
			route: /^\/[^/]+\/[^/]+$/,
			entries: { Name: "名称", Code: "代码" },
			rules: [
				{ pattern: /^now$/, replacement: "刚刚" },
				{ pattern: /^(\d+) stars?$/, replacement: "$1 星" },
			],
		}),
		moduleDict({
			name: "global",
			route: /^\//,
			entries: { Name: "全局名称", Code: "全局代码" },
			rules: [{ pattern: /^soon$/, replacement: "即将" }],
		}),
	];
}

const IDS = new Map([
	...ruleIds("pages/repo", [
		["^now$", "repo/now"],
		["^(\\d+) stars?$", "repo/stars"],
	]),
	...ruleIds("global", [["^soon$", "global/soon"]]),
]);

describe("buildSkeleton", () => {
	it("records the module order and every probe path", () => {
		const skeleton = buildSkeleton(
			CORE_MODULES,
			syntheticModules(),
			IDS,
		);
		expect(skeleton.modules).toEqual(CORE_MODULES);
		expect(
			skeleton.probes.map((probe) => probe.path),
		).toEqual([...PROBE_PATHS]);
		// 根路径的短名是空串（去掉斜杠后没有分段），仅影响可读性
		expect(skeleton.probes[0]?.name).toBe("");
		expect(probeName("/a/b")).toBe("a/b");
	});

	it("records only keys provided by two or more matching modules", () => {
		const skeleton = buildSkeleton(
			CORE_MODULES,
			syntheticModules(),
			IDS,
		);
		const repo = skeleton.probes.find(
			(probe) => probe.path === "/octocat",
		);
		// 该路径只命中 global，没有跨模块同键
		expect(repo?.matched).toEqual(["global"]);
		expect(repo?.collisions).toEqual([]);
	});

	it("records the winner as the first provider in module order", () => {
		// 注意：探针集合是固定的 27 条，必须挑一条真的命中目标模块的路径。
		// pages/settings 的路由是 ^/settings，故 /settings/profile 同时命中它与其后的 global。
		const modules = [
			moduleDict({
				name: "pages/settings",
				route: /^\/settings/,
				entries: { Shared: "设置页", OnlyA: "甲" },
			}),
			moduleDict({
				name: "global",
				route: /^\//,
				entries: { Shared: "全局", OnlyB: "乙" },
			}),
		];
		const skeleton = buildSkeleton(
			["pages/settings", "global"],
			modules,
			new Map(),
		);
		const probe = skeleton.probes.find(
			(item) => item.path === "/settings/profile",
		);
		// OnlyA / OnlyB 各只有一个提供者，不进赢家覆盖
		expect(probe?.collisions).toEqual([
			{ key: "Shared", module: "pages/settings" },
		]);
	});

	it("keeps collisions sorted by key regardless of entry order", () => {
		const modules = [
			moduleDict({
				name: "pages/settings",
				route: /^\/settings/,
				entries: { Zebra: "z", Alpha: "a" },
			}),
			moduleDict({
				name: "global",
				route: /^\//,
				entries: { Zebra: "Z", Alpha: "A" },
			}),
		];
		const skeleton = buildSkeleton(
			["pages/settings", "global"],
			modules,
			new Map(),
		);
		const probe = skeleton.probes.find(
			(item) => item.path === "/settings/profile",
		);
		expect(
			probe?.collisions.map((collision) => collision.key),
		).toEqual(["Alpha", "Zebra"]);
	});

	it("records rule ids in effect order, not pattern sources", () => {
		const skeleton = buildSkeleton(
			CORE_MODULES,
			syntheticModules(),
			IDS,
		);
		const probe = skeleton.probes.find(
			(item) => item.path === "/octocat",
		);
		// global 兜底排最后，故 global 的规则在序列末尾
		expect(probe?.rules).toEqual(["global/soon"]);
	});

	it("fails loudly on a rule that core does not declare", () => {
		const modules = [
			moduleDict({
				name: "global",
				route: /^\//,
				entries: {},
				rules: [
					{ pattern: /^unknown$/, replacement: "未知" },
				],
			}),
		];
		expect(() =>
			buildSkeleton(["global"], modules, new Map()),
		).toThrow(/未声明的规则/);
	});

	it("keeps same-pattern rules of different modules apart", () => {
		// 两个模块可以各有一条 pattern 完全相同的规则（合法，门禁只查同模块内唯一）。
		// 若 ruleIdMap 只按 pattern 建键，后声明的那条会覆盖前一条，
		// /search 的规则序列就会被记成 profile 的 id——快照「变了」而运行时毫无变化。
		const modules = [
			moduleDict({
				name: "pages/profile",
				route: /^\/octocat$/,
				entries: {},
				rules: [
					{
						pattern: /^([\d,]+) results?$/,
						replacement: "$1 个结果",
					},
				],
			}),
			moduleDict({
				name: "pages/search",
				route: /^\/search$/,
				entries: {},
				rules: [
					{
						pattern: /^([\d,]+) results?$/,
						replacement: "$1 个结果",
					},
				],
			}),
		];
		const ids = ruleIdMap([
			{
				module: "pages/profile",
				id: "profile/repo-results-count",
				pattern: /^([\d,]+) results?$/,
			},
			{
				module: "pages/search",
				id: "search/results-count",
				pattern: /^([\d,]+) results?$/,
			},
		]);
		const skeleton = buildSkeleton(
			["pages/profile", "pages/search"],
			modules,
			ids,
		);
		expect(
			skeleton.probes.find(
				(probe) => probe.path === "/octocat",
			)?.rules,
		).toEqual(["profile/repo-results-count"]);
		expect(
			skeleton.probes.find(
				(probe) => probe.path === "/search",
			)?.rules,
		).toEqual(["search/results-count"]);
	});
});

describe("serializeSkeleton", () => {
	it("is stable and round-trips through JSON", () => {
		const skeleton = buildSkeleton(
			CORE_MODULES,
			syntheticModules(),
			IDS,
		);
		const text = serializeSkeleton(skeleton);
		expect(text.endsWith("\n")).toBe(true);
		expect(JSON.parse(text)).toEqual(
			JSON.parse(serializeSkeleton(skeleton)),
		);
		// 正常化后的对象字段顺序固定（modules → probes，path → matched → collisions → rules）
		expect(Object.keys(JSON.parse(text))).toEqual([
			"modules",
			"probes",
		]);
		const first = JSON.parse(text).probes[0];
		expect(Object.keys(first)).toEqual([
			"name",
			"path",
			"matched",
			"collisions",
			"rules",
			"notTranslated",
		]);
	});

	it("does not mutate the skeleton it serializes", () => {
		const skeleton = buildSkeleton(
			CORE_MODULES,
			syntheticModules(),
			IDS,
		);
		const before = JSON.stringify(skeleton);
		serializeSkeleton(skeleton);
		expect(JSON.stringify(skeleton)).toBe(before);
	});
});

describe("pathCounts", () => {
	it("counts merged entries and rules of a path", () => {
		const modules = syntheticModules();
		// /octocat 只命中 pages/profile（合成数据里没有该模块）与 global
		expect(pathCounts("/octocat", modules)).toEqual({
			entries: 2,
			rules: 1,
		});
		// /settings/profile 命中 pages/settings + global（合成数据的仓库页路由只匹配两段
		// `/x/y`，这条路径是三段，故不命中）：
		// 词条 = { Name（设置页胜出）, Code（只来自 global）}；
		// 规则按序拼接：仓库页未命中，故只有 global 的 1 条？—— 不，设置页没有规则，
		// 命中的是 pages/settings + global，故规则数 = global 的 1 条 + 仓库页未命中。
		expect(
			pathCounts("/settings/profile", modules),
		).toEqual({
			entries: 2,
			rules: 3,
		});
	});
});

describe("diffSkeleton", () => {
	/**
	 * 以固定的单条探针为骨架；override 覆盖探针字段，overrides.modules 覆盖模块序列。
	 * 只报 `actual → 快照` 的差异，故测试里必须显式给出「改动后的骨架」与「原快照」。
	 */
	const baseWith = (input?: {
		readonly probe?: Partial<
			ViewSkeleton["probes"][number]
		>;
		readonly modules?: readonly string[];
	}): ViewSkeleton => ({
		modules: input?.modules ?? ["pages/a", "global"],
		probes: [
			{
				name: "a",
				path: "/a",
				matched: ["pages/a", "global"],
				collisions: [{ key: "Shared", module: "pages/a" }],
				rules: ["a/one", "global/two"],
				notTranslated: [],
				...input?.probe,
			},
		],
	});

	/** 只改探针字段的常用形态 */
	const withProbe = (
		probe: Partial<ViewSkeleton["probes"][number]>,
	): ViewSkeleton => baseWith({ probe });

	const base = (): ViewSkeleton => baseWith();

	it("reports nothing when the skeleton is unchanged", () => {
		expect(diffSkeleton(base(), base(), "zh-CN")).toEqual(
			[],
		);
	});

	it("reports a swapped module order", () => {
		const actual = base();
		const swapped: ViewSkeleton = {
			...actual,
			modules: ["global", "pages/a"],
		};
		const errors = diffSkeleton(swapped, base(), "zh-CN");
		expect(
			errors.some((error) =>
				error.includes("模块顺序变了"),
			),
		).toBe(true);
		expect(
			errors.some((error) =>
				error.includes("必须是 global"),
			),
		).toBe(true);
	});

	it("reports global when it is no longer last", () => {
		const actual: ViewSkeleton = {
			modules: ["global", "pages/a"],
			probes: base().probes,
		};
		const errors = diffSkeleton(actual, base(), "zh-CN");
		expect(
			errors.some((error) =>
				error.includes(
					"最后一个模块必须是 global（兜底模块，route 命中一切）",
				),
			),
		).toBe(true);
	});

	it("reports a changed matched module sequence", () => {
		const changed = withProbe({
			matched: ["global"],
			collisions: [],
			rules: ["global/two"],
		});
		const errors = diffSkeleton(changed, base(), "zh-CN");
		expect(
			errors.some((error) =>
				error.includes("命中模块序列变了"),
			),
		).toBe(true);
	});

	it("reports an inserted rule as a rule id sequence change", () => {
		const changed = withProbe({
			rules: ["a/one", "a/added", "global/two"],
		});
		const errors = diffSkeleton(changed, base(), "zh-CN");
		expect(
			errors.some((error) =>
				error.includes("生效规则 id 序列变了"),
			),
		).toBe(true);
		expect(
			errors.some((error) => error.includes("a/added")),
		).toBe(true);
	});

	it("reports a rule added to core without a template", () => {
		// 最常见的回归：往 core/rules.jsonc 加了规则、忘了给本语言模板。
		// 此时视图里根本没有这条规则（缺模板 = 不生效），只有 notTranslated 能暴露它。
		const changed = withProbe({
			notTranslated: ["a/fresh"],
		});
		const errors = diffSkeleton(changed, base(), "zh-CN");
		expect(
			errors.some((error) =>
				error.includes("尚未翻译的规则 id 序列变了"),
			),
		).toBe(true);
		expect(
			errors.some((error) => error.includes("a/fresh")),
		).toBe(true);
	});

	it("keeps the report short for long rule sequences", () => {
		// 一条路径的规则序列可达上百项：报首处差异 + 差异条数，不整表刷屏。
		// 快照一侧也是长序列，只在第 61 项被改掉，这样差异最贴近真实回归。
		const long = Array.from(
			{ length: 120 },
			(_item, index) => `r/${String(index)}`,
		);
		const snapshot = withProbe({ rules: long });
		const changed = withProbe({
			rules: [
				...long.slice(0, 60),
				"r/changed",
				...long.slice(61),
			],
		});
		const errors = diffSkeleton(changed, snapshot, "zh-CN");
		const report = errors.join("\n");
		expect(report.length).toBeLessThan(400);
		expect(report).toContain("第 61 项");
		expect(report).toContain(
			"快照有 1 项不见了，实际多出 1 项",
		);
	});

	it("reports a changed collision winner", () => {
		const changed = withProbe({
			collisions: [{ key: "Shared", module: "global" }],
		});
		const errors = diffSkeleton(changed, base(), "zh-CN");
		expect(
			errors.some((error) =>
				error.includes("胜出模块变了"),
			),
		).toBe(true);
	});

	it("reports a collision that vanished", () => {
		const changed = withProbe({ collisions: [] });
		const errors = diffSkeleton(changed, base(), "zh-CN");
		expect(
			errors.some((error) =>
				error.includes("不再由 ≥2 个命中模块提供"),
			),
		).toBe(true);
	});

	it("reports a newly added cross-module collision", () => {
		const changed = withProbe({
			collisions: [
				{ key: "Shared", module: "pages/a" },
				{ key: "Fresh", module: "global" },
			],
		});
		const errors = diffSkeleton(changed, base(), "zh-CN");
		expect(
			errors.some((error) =>
				error.includes("新增同键异译"),
			),
		).toBe(true);
	});

	it("reports a missing probe path", () => {
		const actual: ViewSkeleton = {
			modules: base().modules,
			probes: [],
		};
		const errors = diffSkeleton(actual, base(), "zh-CN");
		expect(
			errors.some((error) =>
				error.includes("探针路径数量变了"),
			),
		).toBe(true);
		expect(
			errors.some((error) =>
				error.includes("实际数据里没有"),
			),
		).toBe(true);
	});

	it("asks for generation when the snapshot has no modules", () => {
		const errors = diffSkeleton(
			base(),
			{ modules: [], probes: [] },
			"zh",
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain("--update");
	});
});

describe("有意同键异译（跨模块同键的胜出）", () => {
	// 与 src/dict/registry.ts 注释里的清单对应：这几条是**有意**的，勿当重复键清理。
	// 骨架里的赢家覆盖天然覆盖它们，但这里直白命名，便于日后 review 一眼看懂。
	const skeletons = loadSkeletons();
	const zh = skeletons.loaded.find(
		(entry) => entry.locale === "zh-CN",
	);

	function winner(
		pathname: string,
		key: string,
	): string | undefined {
		const probe = zh?.skeleton.probes.find(
			(item) => item.path === pathname,
		);
		return probe?.collisions.find(
			(collision) => collision.key === key,
		)?.module;
	}

	it("loads every locale's skeleton from the strict path", () => {
		expect(skeletons.errors).toEqual([]);
		expect(
			skeletons.loaded.map((entry) => entry.locale),
		).toEqual(localeRawDicts.map((raw) => raw.locale));
		for (const entry of skeletons.loaded) {
			expect(entry.skeleton.modules.at(-1)).toBe("global");
			expect(entry.skeleton.probes).toHaveLength(
				PROBE_PATHS.length,
			);
		}
	});

	it("has a snapshot per locale with exactly this skeleton", () => {
		for (const entry of skeletons.loaded) {
			expect(fixturePath(entry.locale)).toBe(
				`tooling/fixtures/view-skeleton.${entry.locale}.json`,
			);
		}
	});

	it("keeps Name free of cross-module collisions on /settings/profile", () => {
		// 2026-09 修掉 pages/repo 的越界路由之前，「Name」在用户设置页是同键异译
		// （pages/settings 的「姓名」压过 pages/repo 的「名称」）；越界修好后它只由
		// pages/settings 提供，不再是碰撞键——这条用例锁的正是「越界不再回来」
		expect(
			winner("/settings/profile", "Name"),
		).toBeUndefined();
		// 越界清单不该顺手删掉**有意**的同键异译：设置页自己的栏目名仍压过 global
		expect(
			winner("/settings/profile", "Accessibility"),
		).toBe("pages/settings");
		// 仓库设置页仍是真正的同键异译，赢家固定（越界清单同样不该误伤它）
		expect(
			winner("/microsoft/vscode/settings", "Write"),
		).toBe("pages/repo-settings");
	});

	it("resolves Actions to pages/repo-settings on /owner/repo/settings", () => {
		expect(
			winner("/microsoft/vscode/settings", "Actions"),
		).toBe("pages/repo-settings");
	});

	it("resolves Pages to pages/repo-settings on /owner/repo/settings", () => {
		expect(
			winner("/microsoft/vscode/settings", "Pages"),
		).toBe("pages/repo-settings");
	});

	it("resolves Write to pages/repo-settings on /owner/repo/settings", () => {
		expect(
			winner("/microsoft/vscode/settings", "Write"),
		).toBe("pages/repo-settings");
	});

	it("keeps the marketing GitHub Apps collision unobservable", () => {
		// marketing 的路由是 ^/(features|pricing)，与 repo-settings 永不共存，
		// 故这两处 GitHub Apps 的先后不影响任何路径的结果——不写断言，只在此说明。
		expect(
			winner("/features", "GitHub Apps"),
		).toBeUndefined();
		expect(
			winner("/microsoft/vscode/settings", "GitHub Apps"),
		).toBe(undefined);
	});
});
