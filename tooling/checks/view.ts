// 合并视图骨架门禁：把「视图语义」固化成仓内 golden 快照，纳入 bun run check。
//
// 为什么只锁骨架、不做全量快照：全量视图是 33 条探针 × 2086 个规范键槽位（探针数直接数
// PROBE_PATHS，键数看 bun run check:dict 的输出；两者都随词典增长），词典每加一条词条就
// 产生巨大 diff，没人会认真看，最后必然被无脑 --update 掉。这里只锁**语义骨架**——
// 那些一旦变了就必须有人类看一眼的东西：
//   1. 模块顺序（core/modules.jsonc 的序列）与「global 兜底必须在最后」；
//   2. 每个探针 pathname 命中的模块名序列（顺序即优先级的直接证据）；
//   3. 每个 pathname 的**赢家覆盖**：只记「同一键被 ≥2 个命中模块提供」的键及其最终
//      胜出来源——这是「有意同键异译」的回归保护，也让意外新增的同键异译立刻可见；
//   4. 每个 pathname 生效的规则 id 序列（顺序即语义的证据）。**记 id 不记 pattern 源串**：
//      上游改 pattern 不必动快照，与「规则改命名捕获组」这类改动解耦。
// 每 pathname 的词条数与规则数由本门禁运行时统计并打印，不进快照——它们纯粹随词典增长
// 而变化，进快照只会制造无意义的 diff。
//
// 数据来源：registry.ts + load.ts 的**严格**路径（与词典门禁同一套编译），不 import
// src/dict/index.ts——那边是软失败，坏数据被静默跳过后门禁反而会变绿。
//
// 快照按语言逐份存（view-skeleton.<语言>.json），理由是「有意同键异译」是分语言的事实：
// 某种语言少译了被压过的那个键，跨模块同键就不成立，那是该语言覆盖率的真实状态。
//
// 零依赖 bun 直跑；骨架生成与比对都是纯函数（供测试复用）；失败置 exitCode = 1。

import { matchModules } from "../../src/content/view.ts";
import { GLOBAL_MODULE } from "../../src/dict/load.ts";
import {
	LOCALES,
	type LocaleId,
} from "../../src/dict/locales.ts";
import { localeRawDicts } from "../../src/dict/registry.ts";
import type {
	LocaleDict,
	ModuleDict,
	RuleDef,
} from "../../src/shared/types.ts";
import { buildCore, buildLocaleData } from "./dict.ts";

/**
 * 探针路径集合：覆盖每个模块的代表路由 + 兜底路径 + 一条不存在的页面。
 * 它是快照的「坐标」——改这里等于重新定义快照覆盖面，必须与 --update 一起提交。
 */
export const PROBE_PATHS: readonly string[] = [
	"/",
	// 登录后首页的另一个地址：`/` 与 `/dashboard` 渲染同一页，但路由曾只覆盖前者，
	// 于是「往 pages/dashboard 加了词条、从 /dashboard 访问却看不到」——
	// 只保留 `/` 这条探针，这类回归在骨架里完全不可见（2026-10-02 修复后补）
	"/dashboard",
	"/octocat",
	"/microsoft/vscode",
	"/microsoft/vscode/issues",
	"/microsoft/vscode/issues/1",
	"/microsoft/vscode/pull/1",
	"/microsoft/vscode/pulls",
	"/microsoft/vscode/settings",
	// 规则集页（/owner/repo/settings/rules）与仓库设置总览同属 pages/repo-settings，
	// 但它是另一页：自带一组只在该页生效的规则（repo-settings/ruleset-*），
	// 故单独列一条探针——否则「规则加了却没生效」在这条路径上完全不可见
	"/microsoft/vscode/settings/rules",
	// 举报内容页（/owner/repo/reported_content）不在 settings 前缀下，是 pages/repo-settings
	// 的第二支路由：它同时命中 pages/repo，两支的词条「先到先得」谁胜出、规则序列如何，
	// 只有单独一条探针能钉住（2026-09-27 实机发现漏路由后补）
	"/microsoft/vscode/reported_content",
	"/settings/profile",
	"/settings/accessibility",
	"/settings/notifications",
	// 账号安全页单独成模块（pages/settings-security，路由与 pages/settings 重叠）：
	// 它自带一百多条「通行密钥行 / 2FA 截止日」的日期规则，必须单独一条探针，
	// 否则「规则加了却没生效」在这条路径上完全不可见（见 core/modules.jsonc）
	"/settings/security",
	// 会话页（/settings/sessions）：与账号安全页同属「页面词条挂在 pages/settings、
	// 动态值靠规则」的形态，但它自带 settings/session-seen-in 规则与一整组会话卡词条，
	// 故单独列一条探针——否则这页的命中序列与赢家覆盖没有任何回归保护
	"/settings/sessions",
	"/settings/billing",
	// 个人账单已于 2026-09 迁到 /account/billing/**（/settings/billing 实测 404，仅
	// /settings/billing/licensing 尚存），两条路由按「新路径为主、旧路径兼容」写在一起。
	// 下面四条探针走新路径，紧邻的 /settings/billing 这条是**旧路径兼容锚点**：它对不上
	// 任何现存页面，但必须是同一条骨架——哪次改动把路由里的 /settings 分支删了，这里立刻报警
	"/account/billing",
	// AI 用量页与账单总览同属 ^/(?:settings|account)/billing，但它是**另一页**（模型用量表 +
	// 账期选择器 + AI 点数单价脚注），自带一组只在该页出现的规则（settings/month-year-*），
	// 故单独列一条探针——否则「规则加了却没生效」在这条路径上完全不可见
	"/account/billing/ai_usage",
	// 预算与提醒页同理：同模块的第三个页面，自带 settings/budget-* 规则
	"/account/billing/budgets",
	// 许可页：同模块的第四个页面，自带 settings/licensing-* 四条配额规则
	"/account/billing/licensing",
	"/microsoft/vscode/actions",
	"/microsoft/vscode/agents",
	"/microsoft/vscode/commits",
	"/microsoft/vscode/discussions",
	"/microsoft/vscode/wiki",
	"/microsoft/vscode/pulse",
	"/microsoft/vscode/graphs",
	"/microsoft/vscode/forks",
	"/microsoft/vscode/security",
	"/microsoft/vscode/projects",
	"/microsoft/vscode/tags",
	"/microsoft/vscode/branches",
	"/microsoft/vscode/compare",
	"/search",
	"/topics",
	"/features",
	"/pricing",
	"/not-a-real-page/x",
];

/** 一个键被 ≥2 个命中模块提供时的胜出记录（只记来源模块名，不记译文） */
export interface Winner {
	readonly key: string;
	readonly module: string;
}

/** 一个探针路径的骨架 */
export interface PathSkeleton {
	/** 快照里的短名（去掉仓库 / 用户名部分，便于人读） */
	readonly name: string;
	/** location.pathname：比对的主键，探针清单的坐标 */
	readonly path: string;
	/** 命中的模块名序列（顺序 = 优先级） */
	readonly matched: readonly string[];
	/** 仅含被 ≥2 个模块提供的键，按键名排序保证快照稳定 */
	readonly collisions: readonly Winner[];
	/** 该路径生效的规则 id 序列（顺序 = 规则顺序 = 首条命中生效的优先级） */
	readonly rules: readonly string[];
	/**
	 * 该路径**本应生效但本语言尚未翻译**的规则 id 序列（core 声明了、本语言没给模板）。
	 * 单独记一笔的理由：只记 rules 的话，「往 core/rules.jsonc 加一条规则、忘了给模板」
	 * 在视图里完全不可见（缺模板 = 规则不生效），快照看不出任何变化——而这恰恰是最常见
	 * 的回归。它同时是该语言分路径规则覆盖率的可读视图。
	 */
	readonly notTranslated: readonly string[];
}

/** 视图骨架：模块顺序 + 各探针路径的命中、赢家与规则序列 */
export interface ViewSkeleton {
	readonly modules: readonly string[];
	readonly probes: readonly PathSkeleton[];
}

/** 探针路径在快照里的短名，去掉仓库 / 用户名部分（快照可读性） */
export function probeName(pathname: string): string {
	return pathname
		.split("/")
		.filter((segment) => segment.length > 0)
		.join("/");
}

/**
 * 纯函数：core 的规则定义 → 「模块名 + pattern 源串 → 规则 id」。
 *
 * 运行时的规则是「pattern + 模板」，不带 id（id 只活在语言无关的 core/rules.jsonc 里，
 * 用来让各语言对齐模板）。骨架要记 id 而不记 pattern 源串，故按同一份 core 反查。
 *
 * **必须带上模块名**：pattern 完全相同的两条规则可以分属两个模块（合法，见
 * validateRulePatternUniqueness 只查同模块内），例如 `^([\\d,]+) results?$` 同时是
 * pages/search 与 pages/profile 的规则。只按 pattern 反查会让后声明的那条覆盖前一条，
 * 于是 /search 的规则序列被记成 profile 的 id——骨架看着「变了」，实际运行时毫无变化
 * （2026-09 实测）。键里的 \0 是分隔符，模块名与 pattern 都不可能含它。
 */
export function ruleIdMap(
	defs: readonly RuleDef[],
): ReadonlyMap<string, string> {
	return new Map(
		defs.map((def) => [
			`${def.module}\u0000${def.pattern.source}`,
			def.id,
		]),
	);
}

/** 视图里出现的规则必须能在 core/rules.jsonc 里反查到 id，否则结构已错，响亮失败 */
function lookupRuleId(
	ruleIds: ReadonlyMap<string, string>,
	moduleName: string,
	rule: { readonly pattern: RegExp },
): string {
	const id = ruleIds.get(
		`${moduleName}\u0000${rule.pattern.source}`,
	);
	if (id === undefined) {
		throw new Error(
			`视图里出现了 core/rules.jsonc 未声明的规则（模块 ${JSON.stringify(moduleName)}，pattern ${JSON.stringify(rule.pattern.source)}）：无法记入骨架`,
		);
	}
	return id;
}

/**
 * 纯函数：生成一份语言的视图骨架。
 * 输入是**已经编译好的**模块词典（与运行时同一份结构），输出可直接 JSON 序列化。
 * ruleIds 是规则 pattern 源串 → id；pending 是「本语言还没给模板」的规则 id 序列
 * （由 core.rules 与 dict 里实际生效的规则求差得到，见 pendingRuleIds）。
 * 模块归属直接取自 core 的 RuleDef.module，不必反查 pattern。
 */
export function buildSkeleton(
	modules: readonly string[],
	dictModules: readonly ModuleDict[],
	ruleIds: ReadonlyMap<string, string>,
	pending: ReadonlyMap<
		string,
		readonly string[]
	> = new Map(),
): ViewSkeleton {
	const probes = PROBE_PATHS.map((pathname) => {
		const matched = matchModules(pathname, dictModules);
		// 逐键收集提供者：提供者 ≥2 才记录；胜者是「先到先得」里第一个提供的模块
		const providers = new Map<string, string[]>();
		for (const module of matched) {
			for (const key of Object.keys(module.entries)) {
				const list = providers.get(key);
				if (list === undefined) {
					providers.set(key, [module.name]);
				} else {
					list.push(module.name);
				}
			}
		}
		const collisions: Winner[] = [];
		for (const [key, sources] of providers) {
			const winner = sources[0];
			if (sources.length < 2 || winner === undefined)
				continue;
			collisions.push({ key, module: winner });
		}
		collisions.sort((left, right) =>
			compareText(left.key, right.key),
		);
		return {
			name: probeName(pathname),
			path: pathname,
			matched: matched.map((module) => module.name),
			collisions,
			rules: matched.flatMap((module) =>
				module.rules.map((rule) =>
					lookupRuleId(ruleIds, module.name, rule),
				),
			),
			// 顺序与 rules 一致：模块顺序、组内保持 core 的声明顺序
			notTranslated: matched.flatMap(
				(module) => pending.get(module.name) ?? [],
			),
		};
	});
	return { modules: [...modules], probes };
}

/**
 * 纯函数：core 声明的规则里，本语言**没有给模板**的那些 → 模块名 → 规则 id 序列。
 * 缺模板 = 该规则在本语言不生效（见 docs/guides/development.md「稀疏覆盖」），
 * 但它是「本应有、暂时没有」的规则，必须能在骨架里被看见。
 */
export function pendingRuleIds(
	defs: readonly RuleDef[],
	dictModules: readonly ModuleDict[],
): ReadonlyMap<string, readonly string[]> {
	const active = new Set<string>();
	for (const module of dictModules) {
		for (const rule of module.rules) {
			active.add(rule.pattern.source);
		}
	}
	const pending = new Map<string, string[]>();
	for (const def of defs) {
		if (active.has(def.pattern.source)) continue;
		const list = pending.get(def.module);
		if (list === undefined)
			pending.set(def.module, [def.id]);
		else list.push(def.id);
	}
	return pending;
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

/**
 * 稳定序列化：字段顺序固定、tab 缩进、数组/对象超过行宽就竖排（每个元素一行）、末尾换行。
 * --update 写出的文件必须逐字节可复现，否则快照会因字段顺序或空白抖动。
 *
 * 为什么手写而不是 JSON.stringify(…, null, "\t")：本仓的格式权威是 Biome，而 Biome 会把
 * 超过 lineWidth(60) 的数组**竖排**（每项一行），JSON.stringify 只会整条写在一行。
 * 两者产物不一致时，`--update` 生成的文件会被随后的 `biome check .` 报格式错误——
 * 于是「用 --update 重生成快照」这条流程本身是坏的（历史快照是生成后手工跑过 biome format 的）。
 * 这里按 Biome 的规则自己排版：探测容器内联与竖排两种形态，内联产物的最长行不超过行宽就用内联，
 * 对象键值对同理。行宽与缩进改动必须同步 biome.json。
 */
const SNAPSHOT_INDENT = "\t";
const SNAPSHOT_LINE_WIDTH = 60;

/** 容器的排版结果：head 为空串表示这不是容器（调用方按标量处理） */
interface ContainerLayout {
	/** 首行：内联容器就是整行，竖排容器就是开括号 */
	readonly head: string;
	/** 竖排时的每个元素（已带缩进） */
	readonly body: readonly string[];
	/** 闭括号：`]` 或 `}`；内联容器用不到 */
	readonly close: string;
	/** 这个值是否为容器（数组 / 对象） */
	readonly isContainer: boolean;
}

/**
 * 一个值的「内联写法」：容器用 Biome 的空格风格（`{ "k": v }`），标量用 JSON.stringify。
 * 行宽探测必须按这个形态量，否则会把「按字符串长度算放得下、按空格风格算放不下」的
 * 容器误判成内联（实测：matched 数组差的就是对象花括号里的两个空格）。
 */
function inlineText(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map((item) => inlineText(item)).join(", ")}]`;
	}
	if (value !== null && typeof value === "object") {
		return `{ ${Object.entries(value)
			.map(
				([key, item]) =>
					`${JSON.stringify(key)}: ${inlineText(item)}`,
			)
			.join(", ")} }`;
	}
	return JSON.stringify(value);
}

/**
 * 容器（数组 / 对象）**竖排**排版：开括号作为首行单独返回，让调用方决定是否把它接到
 * 上一行末尾（Biome 写作 `"rules": [` + 元素同行）。
 * 是否内联由调用方判断（它才知道这一行前面还有多长的键名前缀，见 fitsInline）。
 */
function formatContainer(
	value: unknown,
	indent: string,
): ContainerLayout {
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return {
				head: "[]",
				body: [],
				close: "]",
				isContainer: true,
			};
		}
		const inner = `${indent}${SNAPSHOT_INDENT}`;
		return {
			head: "[",
			// 逗号由容器加在**每个元素的最后一行**末尾（元素本身可能是多行）。
			// 行宽判定也必须把它算进去：Biome 量的是含逗号的行宽，漏算会让
			// 「内联后正好 60 列 + 逗号 = 61 列」的元素被误判成内联，
			// 于是 `bun run check:view --update` 的产物过不了 `biome check`
			//（2026-09-27 实测：collisions 里第一次出现 `{ "key": …, "module": … }` 就踩到了）
			body: value.map((item, index) => {
				const comma = index < value.length - 1 ? "," : "";
				return `${inner}${formatValue(item, inner, comma)}${comma}`;
			}),
			close: "]",
			isContainer: true,
		};
	}
	if (value !== null && typeof value === "object") {
		const entries = Object.entries(value);
		if (entries.length === 0) {
			return {
				head: "{}",
				body: [],
				close: "}",
				isContainer: true,
			};
		}
		const inner = `${indent}${SNAPSHOT_INDENT}`;
		return {
			head: "{",
			body: entries.map(([key, item], index) =>
				formatMember(
					key,
					item,
					inner,
					index < entries.length - 1,
				),
			),
			close: "}",
			isContainer: true,
		};
	}
	return {
		head: "",
		body: [],
		close: "",
		isContainer: false,
	};
}

/**
 * 缩进占的**列数**：Biome 量行宽时按 indentWidth 折算（tab 算 2 列，见 biome.json 的
 * 默认 indentWidth = 2），不是按字符数算 1。实测依据：`"matched": [...],` 那一行
 * 字符数 58（3 个 tab 按 1 算是 3 列）本该内联，Biome 却断开；按 tab = 2 列算就是 61 列，
 * 超过 lineWidth 60，断开才自洽。
 */
const INDENT_COLUMNS = 2;

/** 这一行（缩进 + 前缀 + 内联值 + 可能的逗号）放得下吗 */
function fitsInline(
	indent: string,
	prefix: string,
	inline: string,
	comma: string,
): boolean {
	const columns = indent.length * INDENT_COLUMNS;
	return (
		columns +
			prefix.length +
			inline.length +
			comma.length <=
		SNAPSHOT_LINE_WIDTH
	);
}

/**
 * 一个键值对成员的排版。
 * 值的竖排容器把首行接在键后（`"rules": [` + 元素同行），其余行原样跟在后面——
 * 这正是 Biome 的排版，也是与 JSON.stringify 的差别所在。
 * 逗号由容器决定（见 trailing），因为它该加在这个成员**最后一行**的末尾。
 */
function formatMember(
	key: string,
	value: unknown,
	indent: string,
	trailing: boolean,
): string {
	const comma = trailing ? "," : "";
	const label = `${JSON.stringify(key)}: `;
	const inline = inlineText(value);
	if (
		!isContainer(value) ||
		fitsInline(indent, label, inline, comma)
	) {
		// 标量，或放得下的内联容器：整行输出
		return `${indent}${label}${inline}${comma}`;
	}
	// 竖排容器：开括号接在键后，元素与闭括号跟在后面
	const container = formatContainer(value, indent);
	const lines = [`${indent}${label}${container.head}`];
	for (const line of container.body) lines.push(line);
	lines.push(`${indent}${container.close}${comma}`);
	return lines.join("\n");
}

/** 一个值的 JSON 文本：标量 / 短容器内联，长容器竖排 */
function formatValue(
	value: unknown,
	indent: string,
	comma = "",
): string {
	const inline = inlineText(value);
	if (
		!isContainer(value) ||
		fitsInline(indent, "", inline, comma)
	) {
		return inline;
	}
	const container = formatContainer(value, indent);
	const lines = [container.head];
	for (const line of container.body) lines.push(line);
	lines.push(`${indent}${container.close}`);
	return lines.join("\n");
}

/** 值是否为 JSON 容器（数组 / 对象） */
function isContainer(value: unknown): boolean {
	return (
		Array.isArray(value) ||
		(value !== null && typeof value === "object")
	);
}

export function serializeSkeleton(
	skeleton: ViewSkeleton,
): string {
	const normalized: ViewSkeleton = {
		modules: [...skeleton.modules],
		probes: skeleton.probes.map((probe) => ({
			name: probe.name,
			path: probe.path,
			matched: [...probe.matched],
			collisions: probe.collisions.map((collision) => ({
				key: collision.key,
				module: collision.module,
			})),
			rules: [...probe.rules],
			notTranslated: [...probe.notTranslated],
		})),
	};
	return `${formatValue(normalized, "")}\n`;
}

/** 数组逐位比较，返回第一条差异的可读说明；完全相同返回 null */
function diffList(
	actual: readonly string[],
	expected: readonly string[],
): string | null {
	const length = Math.max(actual.length, expected.length);
	for (let index = 0; index < length; index += 1) {
		if (actual[index] === expected[index]) continue;
		const want = expected[index];
		const got = actual[index];
		return `第 ${index + 1} 项期望 ${want === undefined ? "（无）" : JSON.stringify(want)}，实为 ${got === undefined ? "（无）" : JSON.stringify(got)}`;
	}
	return null;
}

/**
 * 取「实际 → 期望」的差异说明。
 *
 * 刻意**只报首处差异 + 差异条数**，不整表打印：规则 id 序列一条路径就有上百项
 * （/microsoft/vscode/settings 有 98 条），整表打印会把终端刷满、真正的信息被淹掉。
 * 首处差异已足够定位（位置 + 期望值 + 实际值），要看全貌用 --update 前后比 diff。
 */
function listChange(
	actual: readonly string[],
	expected: readonly string[],
): string | null {
	const diff = diffList(actual, expected);
	if (diff === null) return null;
	const dropped = expected.filter(
		(item) => !actual.includes(item),
	).length;
	const added = actual.filter(
		(item) => !expected.includes(item),
	).length;
	const tail =
		dropped + added > 0
			? `；快照有 ${dropped} 项不见了，实际多出 ${added} 项`
			: "";
	return `${diff}${tail}`;
}

/**
 * 纯函数：比对实际骨架与快照，返回中文错误列表（空数组 = 一致）。
 * 每条错误都指出「哪条路径的哪一项变了、期望什么、实为什么」。
 */
export function diffSkeleton(
	actual: ViewSkeleton,
	snapshot: ViewSkeleton,
	locale: string,
): string[] {
	const errors: string[] = [];
	if (snapshot.modules.length === 0) {
		return [
			`${locale}：快照里没有模块清单（生成：bun run check:view --update）`,
		];
	}
	const modules = listChange(
		actual.modules,
		snapshot.modules,
	);
	if (modules !== null) {
		errors.push(
			`${locale}：模块顺序变了（core/modules.jsonc 的顺序即优先级）——${modules}`,
		);
	}
	const last = actual.modules[actual.modules.length - 1];
	if (last !== GLOBAL_MODULE) {
		errors.push(
			`${locale}：最后一个模块必须是 ${GLOBAL_MODULE}（兜底模块，route 命中一切），实为 ${last === undefined ? "（无）" : JSON.stringify(last)}`,
		);
	}
	if (actual.probes.length !== snapshot.probes.length) {
		errors.push(
			`${locale}：探针路径数量变了——期望 ${snapshot.probes.length} 条，实为 ${actual.probes.length} 条`,
		);
	}
	const actualByPath = new Map(
		actual.probes.map((probe) => [probe.path, probe]),
	);
	for (const expected of snapshot.probes) {
		const got = actualByPath.get(expected.path);
		if (got === undefined) {
			errors.push(
				`${locale} ${expected.path}：快照里有这条探针路径，实际数据里没有（探针清单被改动？）`,
			);
			continue;
		}
		const matched = listChange(
			got.matched,
			expected.matched,
		);
		if (matched !== null) {
			errors.push(
				`${locale} ${expected.path}：命中模块序列变了——${matched}`,
			);
		}
		const rules = listChange(got.rules, expected.rules);
		if (rules !== null) {
			errors.push(
				`${locale} ${expected.path}：生效规则 id 序列变了——${rules}`,
			);
		}
		const pending = listChange(
			got.notTranslated,
			expected.notTranslated,
		);
		if (pending !== null) {
			errors.push(
				`${locale} ${expected.path}：尚未翻译的规则 id 序列变了——${pending}（往 core/rules.jsonc 加了规则却没给本语言模板？或某条模板被删除 / id 改名）`,
			);
		}
		errors.push(
			...diffCollisions(
				got.collisions,
				expected.collisions,
				{
					locale,
					path: expected.path,
				},
			),
		);
	}
	return errors;
}

/** 赢家覆盖的比对：消失 / 改主 / 新增，三种情况都要有人看 */
function diffCollisions(
	actual: readonly Winner[],
	expected: readonly Winner[],
	where: { readonly locale: string; readonly path: string },
): string[] {
	const errors: string[] = [];
	const expectedByKey = new Map(
		expected.map((collision) => [
			collision.key,
			collision.module,
		]),
	);
	const actualByKey = new Map(
		actual.map((collision) => [
			collision.key,
			collision.module,
		]),
	);
	for (const [key, winner] of expectedByKey) {
		const got = actualByKey.get(key);
		if (got === undefined) {
			errors.push(
				`${where.locale} ${where.path}：键 ${JSON.stringify(key)} 不再由 ≥2 个命中模块提供（原本 ${JSON.stringify(winner)} 胜出——某个模块少译了这个键？）`,
			);
			continue;
		}
		if (got !== winner) {
			errors.push(
				`${where.locale} ${where.path}：键 ${JSON.stringify(key)} 的胜出模块变了——期望 ${JSON.stringify(winner)}，实为 ${JSON.stringify(got)}（模块顺序或词条改动导致）`,
			);
		}
	}
	for (const [key, winner] of actualByKey) {
		if (expectedByKey.has(key)) continue;
		errors.push(
			`${where.locale} ${where.path}：新增同键异译——键 ${JSON.stringify(key)} 现在由 ≥2 个命中模块提供，${JSON.stringify(winner)} 胜出（确认是有意的再 --update）`,
		);
	}
	return errors;
}

// —— 数据加载与主流程 ——

const FIXTURE_DIR = "tooling/fixtures";

/** 快照按语言一份：同键异译是分语言的事实（见文件头说明） */
export function fixturePath(locale: LocaleId): string {
	return `${FIXTURE_DIR}/view-skeleton.${locale}.json`;
}

export interface LoadedLocale {
	readonly locale: LocaleId;
	readonly dict: LocaleDict;
	readonly skeleton: ViewSkeleton;
}

/**
 * 严格构建所有语言的骨架（问题一次列全，不 import 软失败的 index.ts）。
 * 词典本身有问题时返回错误而不是抛异常——门禁要把「数据坏了」与「骨架变了」分开报。
 */
export function loadSkeletons(): {
	readonly loaded: readonly LoadedLocale[];
	readonly errors: readonly string[];
} {
	const errors: string[] = [];
	const builtCore = buildCore();
	errors.push(...builtCore.errors);
	if (builtCore.core === null)
		return { loaded: [], errors };
	const core = builtCore.core;
	const ruleIds = ruleIdMap(core.rules);
	const coreModules = core.modules.map(
		(module) => module.name,
	);
	const loaded: LoadedLocale[] = [];
	for (const raw of localeRawDicts) {
		const localeData = buildLocaleData({
			localeId: raw.locale,
			core,
			canonical: builtCore.canonical,
			modules: raw.modules,
			rulesRaw: raw.rules,
		});
		if (localeData === null || localeData.dict === null) {
			errors.push(
				`${raw.locale}：词典无法严格编译（先跑 bun run check:dict 看原因），骨架无从生成`,
			);
			continue;
		}
		// 数据本身有错时不生成骨架：否则会把坏数据固化进快照
		if (localeData.errors.length > 0) {
			errors.push(
				...localeData.errors.map(
					(error) => `${raw.locale}：${error}`,
				),
			);
			continue;
		}
		try {
			loaded.push({
				locale: raw.locale,
				dict: localeData.dict,
				skeleton: buildSkeleton(
					coreModules,
					localeData.dict.modules,
					ruleIds,
					pendingRuleIds(
						core.rules,
						localeData.dict.modules,
					),
				),
			});
		} catch (error) {
			errors.push(
				error instanceof Error
					? error.message
					: String(error),
			);
		}
	}
	// 声明了却没数据：与词典门禁同一套配置校验
	const shipped = new Set(
		localeRawDicts.map((raw) => raw.locale),
	);
	for (const meta of LOCALES) {
		if (!shipped.has(meta.id)) {
			errors.push(
				`${meta.id}：src/dict/locales.ts 声明了该语言，但 registry.ts 里没有它的数据`,
			);
		}
	}
	return { loaded, errors };
}

/** 某条探针路径合并后的词条数 / 规则数：纯统计，不进快照，只打印给人看 */
export function pathCounts(
	pathname: string,
	modules: readonly ModuleDict[],
): { readonly entries: number; readonly rules: number } {
	const matched = matchModules(pathname, modules);
	const keys = new Set<string>();
	let rules = 0;
	for (const module of matched) {
		for (const key of Object.keys(module.entries))
			keys.add(key);
		rules += module.rules.length;
	}
	return { entries: keys.size, rules };
}

function printCounts(dict: LocaleDict): void {
	for (const pathname of PROBE_PATHS) {
		const counts = pathCounts(pathname, dict.modules);
		const matched = matchModules(pathname, dict.modules)
			.map((module) => module.name)
			.join(" + ");
		console.log(
			`  ${probeName(pathname) || "（根路径）"}：${counts.entries} 词条 / ${counts.rules} 规则 [${matched}]`,
		);
	}
}

/** 读快照：文件不存在返回 null（是否算失败由调用方决定，--update 下不算） */
async function readSnapshot(
	locale: LocaleId,
): Promise<ViewSkeleton | null> {
	const file = Bun.file(fixturePath(locale));
	if (!(await file.exists())) return null;
	const raw: unknown = await file.json();
	if (raw === null || typeof raw !== "object") {
		throw new Error(
			`${fixturePath(locale)}：快照必须是 JSON 对象，实为 ${typeof raw}`,
		);
	}
	return raw as ViewSkeleton;
}

async function run(update: boolean): Promise<void> {
	const { loaded, errors } = loadSkeletons();
	if (errors.length > 0) {
		console.error(
			`视图骨架门禁未通过：词典数据本身有问题（${errors.length} 处）——先跑 bun run check:dict 修数据：`,
		);
		for (const error of errors)
			console.error(`  - ${error}`);
		process.exitCode = 1;
		return;
	}
	if (update) {
		for (const { locale, skeleton } of loaded) {
			const path = fixturePath(locale);
			await Bun.write(path, serializeSkeleton(skeleton));
			console.log(`已更新快照 ${path}`);
		}
		return;
	}
	const problems: string[] = [];
	for (const { locale, skeleton } of loaded) {
		const snapshot = await readSnapshot(locale);
		if (snapshot === null) {
			problems.push(
				`${locale}：缺少快照 ${fixturePath(locale)}（生成：bun run check:view --update）`,
			);
			continue;
		}
		problems.push(
			...diffSkeleton(skeleton, snapshot, locale),
		);
	}
	if (problems.length > 0) {
		console.error(
			`视图骨架门禁未通过（${problems.length} 处）：`,
		);
		for (const problem of problems) {
			console.error(`  - ${problem}`);
		}
		console.error(
			"若改动是有意的（例如有意新增同键异译或调整模块顺序），用 bun run check:view --update 重新生成快照，并在提交信息里说明原因。",
		);
		process.exitCode = 1;
		return;
	}
	console.log(
		`视图骨架一致：${loaded
			.map(({ locale }) => locale)
			.join(" / ")}`,
	);
	for (const { locale, dict } of loaded) {
		console.log(`  ${locale}：`);
		printCounts(dict);
	}
}

if (import.meta.main) {
	await run(process.argv.includes("--update"));
}
