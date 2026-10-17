// 漏翻报告：把开发者模式导出的 `github-zh-misses/3` 日志变成一份能直接开工的清单。
//
// 为什么需要它：日志是「所有未命中的可翻译文本」的原始集合，实测约九成是用户内容、
// 产品名、动态值与文档标题（分类依据见 docs/guides/development.md 的「漏翻日志」一节）。
// 人工逐条判断的成本比「让维护者贴整页 HTML」还高，所以把判断固化成规则：
//
//   产品名          → 有意保留英文
//   同形异义 / 断句  → 架构上限，收了必然在别处译错（见 STRUCTURAL）
//   动态值          → 静态键覆盖不了；属性值连规则都不生效（架构上限）
//   用户内容        → 机密名 / 仓库 / 组织 / 用户名 / 日期样式，绝不该进词典
//   别的模块已收录  → 路由互斥（先把「组织页有、仓库页没有」这类漏翻暴露出来）
//   本路径已收录    → 导出之后词典更新过，属于「已修复」
//   其余            → 候选，按路由给出建议模块
//
// 3 版日志多了一维 `block`（整行拼合文本）：长句被 `<a>` / `<strong>` 切开后，
// 每条记录只是一段碎片，而「整句还原」一节会把这些碎片按块内顺序拼回原句
// （⟦n⟧ 标出每段的位置）——这就是「贴 HTML」原先提供的、日志里缺失的那层信息。
//
// 零依赖 bun 直跑；判定逻辑导出为纯函数供测试复用；失败置 exitCode = 1。
//
// 用法：bun run report:misses <导出的 json 路径>

import {
	buildView,
	matchModules,
} from "../src/content/view.ts";
import {
	buildAliases,
	buildLocaleDict,
	buildModules,
	buildRuleDefs,
} from "../src/dict/load.ts";
import {
	coreRawDict,
	localeRawDicts,
} from "../src/dict/registry.ts";
import { normalizeKey } from "../src/shared/text.ts";
import type {
	DictCore,
	LocaleDict,
} from "../src/shared/types.ts";

// —— 日志的读取与形状校验 ——

/** 日志里的一条记录（context 是 2 版字段、block 是 3 版字段，缺失时按空串处理） */
export interface MissExportItem {
	readonly text: string;
	readonly kind: string;
	readonly path: string;
	readonly context: string;
	/** 记录时所在整行的拼合文本；空串 = 这一行就是该节点自己 */
	readonly block: string;
	readonly count: number;
}

/** 一份导出文件 */
export interface MissExport {
	readonly schema: string;
	readonly exportedAt: string;
	/** 被上限吃掉、没能进 items 的条数（3 版才有） */
	readonly dropped: number;
	readonly items: readonly MissExportItem[];
}

function fail(message: string): never {
	throw new Error(message);
}

function describe(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "数组";
	return typeof value;
}

/**
 * 校验并归一化导出文件。
 *
 * 宽容度是刻意的：只认 schema 前缀与条目必需字段，context / block 缺失按空串补、
 * dropped 缺失按 0 补——维护者可能导出的是旧版（1 版没有 context、2 版没有 block），
 * 不该因为少一个字段就整份拒收；报告里会点明「这份日志看不到整句」。
 */
export function parseExport(raw: unknown): MissExport {
	if (
		raw === null ||
		typeof raw !== "object" ||
		Array.isArray(raw)
	) {
		fail(`导出文件必须是对象，实为 ${describe(raw)}`);
	}
	const record = raw as {
		schema?: unknown;
		exportedAt?: unknown;
		dropped?: unknown;
		items?: unknown;
	};
	const schema = record.schema;
	if (typeof schema !== "string") {
		fail("导出文件缺 schema 字段");
	}
	if (!/^github-zh-misses\/\d+$/.test(schema)) {
		fail(
			`未知的 schema：${JSON.stringify(schema)}（期望 github-zh-misses/<版本>）`,
		);
	}
	if (!Array.isArray(record.items)) {
		fail(
			`items 必须是数组，实为 ${describe(record.items)}`,
		);
	}
	const items: MissExportItem[] = [];
	record.items.forEach((entry, index) => {
		const at = `items[${index}]`;
		if (
			entry === null ||
			typeof entry !== "object" ||
			Array.isArray(entry)
		) {
			fail(`${at} 必须是对象，实为 ${describe(entry)}`);
		}
		const item = entry as {
			text?: unknown;
			kind?: unknown;
			path?: unknown;
			context?: unknown;
			block?: unknown;
			count?: unknown;
		};
		const { text, kind, path, count } = item;
		if (typeof text !== "string" || text.length === 0) {
			fail(`${at} text 必须是非空字符串`);
		}
		if (typeof kind !== "string") {
			fail(`${at} kind 必须是字符串`);
		}
		if (typeof path !== "string" || !path.startsWith("/")) {
			fail(`${at} path 必须是以 / 开头的字符串`);
		}
		if (
			typeof count !== "number" ||
			!Number.isFinite(count)
		) {
			fail(`${at} count 必须是有限数字`);
		}
		items.push({
			text,
			kind,
			path,
			context:
				typeof item.context === "string"
					? item.context
					: "",
			block:
				typeof item.block === "string" ? item.block : "",
			count,
		});
	});
	return {
		schema,
		exportedAt:
			typeof record.exportedAt === "string"
				? record.exportedAt
				: "",
		dropped:
			typeof record.dropped === "number" &&
			Number.isFinite(record.dropped) &&
			record.dropped > 0
				? Math.trunc(record.dropped)
				: 0,
		items,
	};
}

// —— 词典加载（与门禁同一套严格编译） ——

/** 读取语言无关的核心数据（模块顺序、规则、改名映射） */
export function loadCore(): DictCore {
	const modules = buildModules(
		coreRawDict.modules,
		"core/modules.jsonc",
	);
	return {
		modules,
		rules: buildRuleDefs(
			coreRawDict.rules,
			"core/rules.jsonc",
			modules,
		),
		aliases: buildAliases(
			coreRawDict.aliases,
			"core/aliases.jsonc",
		),
	};
}

/** 读取某种语言的完整词典（未声明的语言直接报错） */
export function loadLocaleDict(locale: string): LocaleDict {
	const raw = localeRawDicts.find(
		(entry) => entry.locale === locale,
	);
	if (!raw) fail(`未声明的语言：${JSON.stringify(locale)}`);
	return buildLocaleDict({
		locale: raw.locale,
		core: loadCore(),
		entries: new Map(
			raw.modules.map(([name, data]) => [name, data]),
		),
		rulesRaw: raw.rules,
	});
}

// —— 判定 ——

/**
 * 一条记录的判定结果。
 *
 * candidate      值得收录（本路径上确实没有词条）
 * knownElsewhere 只在别的模块里收录过：路由互斥，本路径拿不到
 * fixed          本路径已能命中（导出之后词典更新过）
 * product        产品名，有意保留英文
 * userContent    用户内容 / 标识符 / 快捷键，不该进词典
 * dynamic        含动态值；属性值连正则规则都不生效
 * structural     同形异义 / 被 `<kbd>` 断句：架构上限，任何模块都不要收
 */
export type Verdict =
	| "candidate"
	| "knownElsewhere"
	| "fixed"
	| "product"
	| "userContent"
	| "dynamic"
	| "structural";

/** 一条判定好了的记录 */
export interface ReportRow {
	readonly item: MissExportItem;
	readonly verdict: Verdict;
	/** candidate = 建议模块；knownElsewhere / fixed = 收录它的模块 */
	readonly modules: readonly string[];
	readonly reason: string;
	/** 这条文本只是所在整行的一块碎片（只有 3 版的 block 判得出） */
	readonly fragment: boolean;
}

/** 判定结果（fragment 由 classifyRow 统一补上，各分支不必重复写） */
type Decision = Omit<ReportRow, "fragment">;

/** 产品名：全仓一致的「不翻译」清单（词典不收，未命中即保留英文） */
export const PRODUCT_NAMES: ReadonlySet<string> = new Set([
	"GitHub",
	"Copilot",
	"Dependabot",
	"OIDC",
	"CodeQL",
	"GitHub Apps",
	"GitHub Actions",
]);

/**
 * 架构上不可译的短词：**不是待办**，任何模块都不要收。
 *
 * 只登记「收了会更糟」的两类，且必须在 value 里说清是哪一类：
 *   · 同形异义：同一个英文词在不同 DOM 区域要译成不同的词，而引擎只按整节点文本
 *     查询、拿不到区域，收了就必然有一处译错（`Type`）；
 *   · 被排除元素断句：整句被 `<kbd>` 之类切成几段，只译其中一段只剩中英残句
 *     （`to search`）。两段的完整论证见 zh-CN 的 `global.jsonc` 注释。
 *
 * **不要往这里加「暂时还没翻译的普通词条」**——那些正是候选该出现的地方。
 * 这张表越长，日志分拣就越像在自欺欺人。
 */
export const STRUCTURAL: ReadonlyMap<string, string> =
	new Map([
		["Type", "同形异义：页头「键入」/ 设置页正文「类型」"],
		["to search", "kbd 断句的后半段，只译它会留中英残句"],
	]);

/** 全大写标识符：机密名 / 变量名（`APP_PRIVATE_KEY`、`TURBO_TEAM`） */
const UPPER_IDENTIFIER = /^[A-Z][A-Z0-9_]*$/;
/** 长随机串：OAuth client id（`Iv23livw6MVbKOSp3ayS`） */
const OPAQUE_ID = /^[A-Za-z0-9]{16,}$/;
/** 路径与提及：`koishi-ce/koishi`、`@Koishi-CE`（单 token，故 `7 / 7 checks OK` 不算） */
const PATH_LIKE = /^@?[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const MENTION = /^@[A-Za-z0-9-]+$/;
/** 小写单词 / 快捷键提示：`koishi`、`oppenheymu`、`alt shift r` */
const LOWER_WORDS =
	/^[a-z][a-z0-9-]*(?: [a-z][a-z0-9-]*)*$/;
/** 日期样式：`Oct 6, 2026, 20:39 GMT+8` */
const DATE_LIKE = /^[A-Z][a-z]{2} \d{1,2}, \d{4}/;
/** 纯数字与符号 */
const NUMBER_LIKE = /^[\d\s.,:+-]+$/;
/** 文档标题：`Actions secrets · Koishi-CE/koishi` */
const DOC_TITLE = /·/;
/**
 * 提交信息（Conventional Commits）：`chore(deps): bump cac from 7.0.0 to 7.0.1`、
 * `fix: typo`。这类串常常不含数字，落进候选就会骗人去收一条**永远不该翻译**的提交信息。
 */
const COMMIT_SUBJECT = /^[a-z][a-z0-9-]*(?:\([^)]*\))?!?: /;

/** 这条文案是否明显是用户内容 / 标识符 / 快捷键（不该进词典） */
export function isUserContent(text: string): boolean {
	return (
		DOC_TITLE.test(text) ||
		UPPER_IDENTIFIER.test(text) ||
		OPAQUE_ID.test(text) ||
		PATH_LIKE.test(text) ||
		MENTION.test(text) ||
		LOWER_WORDS.test(text) ||
		DATE_LIKE.test(text) ||
		NUMBER_LIKE.test(text) ||
		COMMIT_SUBJECT.test(text)
	);
}

/** 路径里的 owner / repo（`/Koishi-CE/koishi/graphs/contributors` → Koishi-CE、koishi） */
export function pathOwnerRepo(
	path: string,
): readonly string[] {
	const [owner = "", repo = ""] = path.split("/").slice(1);
	return [owner, repo].filter((part) => part !== "");
}

/** 这段文本是不是本页路径里的组织名 / 仓库名（大小写不敏感） */
function isOwnerOrRepo(
	item: MissExportItem,
	text: string,
): boolean {
	const lower = text.toLowerCase();
	return pathOwnerRepo(item.path).some(
		(part) => part.toLowerCase() === lower,
	);
}

/** 图片 alt 上的显示名：头像的 alt 是用户名 / 显示名（`Oppenheymu`、`M. Oppenheymu`） */
function isAvatarAlt(item: MissExportItem): boolean {
	return (
		item.kind === "alt" && /^img(?:\.|$)/.test(item.context)
	);
}

/**
 * 像「被行内标签切开的碎片」：单个小写单词（`and` / `to` / `by`）或单字符（`s`）。
 *
 * 这一判定只用于给 `knownElsewhere` **加一句提醒**，不改判定：`and` 这类词在设置模块里
 * 确实各收过一条（拼句用），所以报告会建议「本模块也收一份」——而那正是会让摘要句
 * 变成「…和…和…」的那一步。看到这条提醒就该回去要整句的可见文本。
 */
export function isFragmentLike(text: string): boolean {
	return (
		/^[a-z]{1,8}$/.test(text) || /^[A-Za-z]$/.test(text)
	);
}

/**
 * 用户内容的具体来路：报告里要能说清「为什么这不是漏翻」。
 * 四类词形判定在 `isUserContent`，另两类要靠记录里的 `path` / `context`——
 * 这正是 2 版日志带上 `context` 的用处。
 */
export function userContentReason(
	item: MissExportItem,
	text: string,
): string | undefined {
	if (isUserContent(text))
		return "用户内容 / 标识符 / 快捷键，不该进词典";
	if (isOwnerOrRepo(item, text))
		return "就是本页路径里的组织名 / 仓库名";
	if (isAvatarAlt(item))
		return "图片 alt 上的显示名 / 登录名（头像）";
	return undefined;
}

/** 词条索引：合并视图 + 每个键由哪些模块提供（用于「路由互斥」判定） */
export interface DictIndex {
	/** 该路径命中的模块名（顺序即优先级），用于给出建议模块 */
	readonly modules: readonly string[];
	readonly matched: ReadonlySet<string>;
	readonly owners: ReadonlyMap<string, readonly string[]>;
}

/** 为某个路径建立词条索引 */
export function buildIndex(
	path: string,
	dict: LocaleDict,
	aliases: ReadonlyMap<string, string>,
): DictIndex {
	const view = buildView(path, dict, aliases);
	const matched = new Set(view.entries.keys());
	const modules = matchModules(path, dict.modules).map(
		(module) => module.name,
	);
	const owners = new Map<string, string[]>();
	for (const module of dict.modules) {
		for (const key of Object.keys(module.entries)) {
			const list = owners.get(key);
			if (list === undefined) {
				owners.set(key, [module.name]);
			} else {
				list.push(module.name);
			}
		}
	}
	return { modules, matched, owners };
}

/** 判定一组记录；同一个路径只建一次索引 */
export function classify(
	items: readonly MissExportItem[],
	dict: LocaleDict,
	aliases: ReadonlyMap<string, string>,
): ReportRow[] {
	const indexes = new Map<string, DictIndex>();
	const rows: ReportRow[] = [];
	for (const item of items) {
		let index = indexes.get(item.path);
		if (index === undefined) {
			index = buildIndex(item.path, dict, aliases);
			indexes.set(item.path, index);
		}
		rows.push(classifyRow(item, index));
	}
	return rows;
}

/**
 * 这条记录是不是所在整行的一块碎片：块文本比它长、且包含它。
 *
 * 只看「包含」就够：整节点自带块级容器时（`<h3>Active issues</h3>`、`<th>Value</th>`），
 * `describeBlock` 返回空串（这一行就是它自己），于是卡片里那一堆独立标签**不会**
 * 被误判成碎片——这条规则的正确性依赖采集侧「块边界 = 块级容器」，两处必须一起看。
 */
export function isFragmentOfBlock(
	item: MissExportItem,
	text: string,
): boolean {
	const block = normalizeKey(item.block);
	return (
		block !== "" && block !== text && block.includes(text)
	);
}

function classifyRow(
	item: MissExportItem,
	index: DictIndex,
): ReportRow {
	const text = normalizeKey(item.text);
	return {
		...decide(item, index),
		fragment: isFragmentOfBlock(item, text),
	};
}

function decide(
	item: MissExportItem,
	index: DictIndex,
): Decision {
	const text = normalizeKey(item.text);
	if (PRODUCT_NAMES.has(text)) {
		return {
			item,
			verdict: "product",
			modules: [],
			reason: "产品名，有意保留英文",
		};
	}
	// 必须排在 owners 判定之前：`Type` 在 pages/settings 与 pages/repo-settings 里
	// 都有一条「类型」，落到 knownElsewhere 会给维护者「本模块也收一份」的错误暗示，
	// 而那正是会印出「类型 / 以搜索」的那一步。
	const structural = STRUCTURAL.get(text);
	if (structural !== undefined) {
		return {
			item,
			verdict: "structural",
			modules: [],
			reason: structural,
		};
	}
	const owners = index.owners.get(text) ?? [];
	if (index.matched.has(text)) {
		return {
			item,
			verdict: "fixed",
			modules: owners.filter((name) => name !== "global"),
			reason: "本路径已能命中（导出之后词典更新过）",
		};
	}
	if (owners.length > 0) {
		return {
			item,
			verdict: "knownElsewhere",
			modules: owners,
			reason: isFragmentLike(text)
				? "别的模块已收录，本路径拿不到（路由互斥）；**单个小写单词多是被行内标签切开的碎片**，先要整句再决定"
				: "别的模块已收录，本路径拿不到（路由互斥）",
		};
	}
	const userReason = userContentReason(item, text);
	if (userReason !== undefined) {
		return {
			item,
			verdict: "userContent",
			modules: [],
			reason: userReason,
		};
	}
	if (/\d/.test(text)) {
		return {
			item,
			verdict: "dynamic",
			modules: [],
			reason:
				item.kind === "text"
					? "含动态值，静态键覆盖不了（需要规则）"
					: "属性值含动态值：属性不应用正则规则，架构上不可覆盖",
		};
	}
	return {
		item,
		verdict: "candidate",
		modules: [
			index.modules.find((name) => name !== "global") ??
				"global",
		],
		reason: "本路径没有词条，值得收录",
	};
}

// —— 整句还原（3 版日志的 block） ——

/** 一个整句块：同一 path 下 `block` 文本相同的记录 */
export interface BlockGroup {
	readonly path: string;
	readonly block: string;
	readonly rows: readonly ReportRow[];
}

/** 报告里最多渲染多少个整句块（再多就该分批采集或先清空） */
const BLOCK_REPORT_MAX = 24;

/**
 * 把记录按「整行」聚起来：只有同一 path、同一 block 的记录才是同一句话。
 *
 * 只保留**值得看**的块：块里有两条以上记录（说明句子被切开过），或其中一条只是碎片。
 * 单条且不是碎片的块没有新增信息——它已经在候选 / 噪声小节里列过了。
 */
export function groupBlocks(
	rows: readonly ReportRow[],
): BlockGroup[] {
	const groups = new Map<
		string,
		{ path: string; block: string; rows: ReportRow[] }
	>();
	for (const row of rows) {
		const block = normalizeKey(row.item.block);
		if (block === "") continue;
		const key = `${row.item.path}\u0000${block}`;
		const group = groups.get(key);
		if (group === undefined) {
			groups.set(key, {
				path: row.item.path,
				block,
				rows: [row],
			});
		} else {
			group.rows.push(row);
		}
	}
	return [...groups.values()]
		.filter(
			(group) =>
				group.rows.length >= 2 ||
				group.rows.some((row) => row.fragment),
		)
		.sort((a, b) => {
			if (a.path !== b.path)
				return a.path < b.path ? -1 : 1;
			if (a.rows.length !== b.rows.length)
				return b.rows.length - a.rows.length;
			return a.block < b.block
				? -1
				: a.block > b.block
					? 1
					: 0;
		});
}

/** 一次整句还原的结果 */
export interface BlockLayout {
	/** 块文本，未翻节点所在位置被替换成 ⟦1⟧ / ⟦2⟧ … */
	readonly marked: string;
	/** 标记序号对应的记录下标（`marked` 里第 n 个 ⟦n⟧ ↔ order[n - 1]） */
	readonly order: readonly number[];
	/** 块文本里找不到的记录下标（块被 240 字截断，或记录已被翻译掉） */
	readonly missing: readonly number[];
}

/**
 * 把碎片按块内顺序拼回整句：反复挑「从当前位置起最先出现」的那条记录。
 *
 * 为什么用贪心而不是按记录顺序排：日志里**没有节点顺序**（排序键只有 path / count /
 * text），而块文本是按文档序拼接的，所以「在块里出现的位置」就是节点顺序。
 * 同一段文本在块里出现两次时各自消费一次，结果仍然稳定。
 */
export function reconstructBlock(
	block: string,
	texts: readonly string[],
): BlockLayout {
	const source = normalizeKey(block);
	const pending = texts
		.map((text, index) => ({
			text: normalizeKey(text),
			index,
		}))
		.filter((entry) => entry.text !== "");
	const order: number[] = [];
	let cursor = 0;
	let marked = "";
	while (pending.length > 0) {
		let pick = -1;
		let at = Number.POSITIVE_INFINITY;
		for (let i = 0; i < pending.length; i++) {
			const entry = pending[i];
			if (entry === undefined) continue;
			const found = source.indexOf(entry.text, cursor);
			if (found === -1 || found >= at) continue;
			at = found;
			pick = i;
		}
		if (pick === -1) break;
		const [entry] = pending.splice(pick, 1);
		if (entry === undefined) break;
		const prefix = source.slice(cursor, at);
		marked += prefix;
		// 标记两侧留一个空格，但紧贴标点时不留（`⟦2⟧, and` 比 `⟦2⟧ , and` 顺眼）
		if (marked !== "" && !/\s$/.test(marked)) marked += " ";
		marked += `⟦${order.length + 1}⟧`;
		const next = source[at + entry.text.length];
		if (
			next !== undefined &&
			!/[\s,.;:!?，。；：、)\]]/.test(next)
		) {
			marked += " ";
		}
		order.push(entry.index);
		cursor = at + entry.text.length;
	}
	marked += source.slice(cursor);
	return {
		marked: marked.replace(/\s+/g, " ").trim(),
		order,
		missing: pending.map((entry) => entry.index),
	};
}

// —— 报告渲染 ——

/** 一行记录的统一排版（各小节共用） */
function formatRow(row: ReportRow, suffix: string): string {
	return `    ×${String(row.item.count).padEnd(3)} ${row.item.kind.padEnd(11)} ${(row.item.context || "-").padEnd(24)} ${JSON.stringify(row.item.text)} ${suffix}`.trimEnd();
}

/** 整句还原里的一行：行首是块内序号，其余与普通行一致 */
function formatMarkedRow(
	position: number,
	row: ReportRow,
): string {
	return `      ⟦${position}⟧ ${row.item.kind.padEnd(11)} ${(row.item.context || "-").padEnd(24)} ${JSON.stringify(row.item.text)}`.trimEnd();
}

/** 把判定结果渲染成一份可读报告（无记录时也要有明确结论） */
export function formatReport(
	rows: readonly ReportRow[],
	meta: {
		readonly file: string;
		readonly exportedAt: string;
		/** 日志的 schema（形如 github-zh-misses/3）；旧版没有 block 时报告要说明 */
		readonly schema?: string;
		/** 被上限吃掉、没能进这份日志的条数 */
		readonly dropped?: number;
	},
): string {
	const lines: string[] = [];
	const candidates = rows.filter(
		(row) => row.verdict === "candidate",
	);
	const elsewhere = rows.filter(
		(row) => row.verdict === "knownElsewhere",
	);
	const fixed = rows.filter(
		(row) => row.verdict === "fixed",
	);
	const structural = rows.filter(
		(row) => row.verdict === "structural",
	);
	const noise = rows.filter(
		(row) =>
			row.verdict === "product" ||
			row.verdict === "userContent" ||
			row.verdict === "dynamic",
	);

	lines.push(`漏翻报告：${meta.file}`);
	const head = `导出：${meta.exportedAt || "（未提供）"}；记录 ${rows.length} 条`;
	lines.push(
		meta.dropped !== undefined && meta.dropped > 0
			? `${head}（另有 ${meta.dropped} 条超出上限没进日志：先在 popup 点「清空」再重导一次）`
			: head,
	);
	lines.push("");

	if (
		!rows.some((row) => normalizeKey(row.item.block) !== "")
	) {
		lines.push(
			`⚠️ 这份日志（${meta.schema ?? "未知 schema"}）没有 block 字段：看不到整句，被行内标签切开的碎片只能靠猜。`,
		);
		lines.push(
			"   更新扩展后重新导出一次即可——新版每条记录都带整行拼合文本。",
		);
		lines.push("");
	}

	if (candidates.length === 0) {
		lines.push(
			"候选 0 条：这份日志里没有需要收录的新文案。",
		);
	} else {
		lines.push(
			`候选 ${candidates.length} 条（值得收录）：`,
		);
		appendGroup(lines, candidates, (row) => {
			const module = row.modules[0] ?? "global";
			return `→ ${module}`;
		});
	}
	lines.push("");

	const blocks = groupBlocks(rows);
	if (blocks.length > 0) {
		const shown = blocks.slice(0, BLOCK_REPORT_MAX);
		lines.push(
			`整句还原 ${blocks.length} 块（⟦n⟧ = 该块里未翻的节点，按块内顺序拼回原句；已译的兄弟节点显示中文）：`,
		);
		let currentPath = "";
		for (const group of shown) {
			if (group.path !== currentPath) {
				lines.push(`  ${group.path}`);
				currentPath = group.path;
			}
			const layout = reconstructBlock(
				group.block,
				group.rows.map((row) => row.item.text),
			);
			lines.push(`    「${layout.marked}」`);
			for (const [
				position,
				index,
			] of layout.order.entries()) {
				const row = group.rows[index];
				if (row === undefined) continue;
				lines.push(
					`${formatMarkedRow(position + 1, row)}${
						row.fragment ? "" : "（整节点）"
					}`,
				);
			}
			for (const index of layout.missing) {
				const row = group.rows[index];
				if (row === undefined) continue;
				lines.push(
					`      ⟦?⟧ ${row.item.kind.padEnd(11)} ${(row.item.context || "-").padEnd(24)} ${JSON.stringify(row.item.text)}（块里找不到：块被 240 字截断，或记录之后这段文本又变过）`,
				);
			}
		}
		if (blocks.length > shown.length) {
			lines.push(
				`    …（其余 ${blocks.length - shown.length} 块省略：先「清空」再重导一次，或分批采集）`,
			);
		}
		lines.push("");
	}

	if (structural.length > 0) {
		lines.push(
			`架构上限 ${structural.length} 条（不是待办，任何模块都不要收）：`,
		);
		appendGroup(
			lines,
			structural,
			(row) => `（${row.reason}）`,
		);
		lines.push("");
	}

	if (elsewhere.length > 0) {
		lines.push(
			`路由互斥 ${elsewhere.length} 条（别的模块已收录，本路径拿不到）：`,
		);
		appendGroup(
			lines,
			elsewhere,
			(row) =>
				`← ${row.modules.join("、")}${
					isFragmentLike(normalizeKey(row.item.text))
						? "（⚠️ 单个小写单词，多半是被行内标签切开的碎片，先看「整句还原」再补）"
						: ""
				}`,
		);
		lines.push("");
	}

	if (fixed.length > 0) {
		lines.push(
			`已修复 ${fixed.length} 条（导出之后词典更新过）：`,
		);
		appendGroup(lines, fixed, () => "");
		lines.push("");
	}

	const counts = countByVerdict(noise);
	lines.push(
		`有意保留 ${noise.length} 条：产品名 ${counts.get("product") ?? 0} · 用户内容 ${counts.get("userContent") ?? 0} · 动态值 ${counts.get("dynamic") ?? 0}`,
	);
	lines.push("");
	lines.push(
		`合计：候选 ${candidates.length} / 路由互斥 ${elsewhere.length} / 已修复 ${fixed.length} / 架构上限 ${structural.length} / 噪声 ${noise.length}`,
	);
	return lines.join("\n");
}

function appendGroup(
	lines: string[],
	rows: readonly ReportRow[],
	suffix: (row: ReportRow) => string,
): void {
	const byPath = new Map<string, ReportRow[]>();
	for (const row of rows) {
		const list = byPath.get(row.item.path);
		if (list === undefined) {
			byPath.set(row.item.path, [row]);
		} else {
			list.push(row);
		}
	}
	for (const [path, list] of byPath) {
		lines.push(`  ${path}`);
		for (const row of [...list].sort(
			(a, b) => b.item.count - a.item.count,
		)) {
			const extra = suffix(row);
			// 只有「要不要收」还没定的两类才提示碎片：架构上限已经下过结论了
			const fragment =
				row.fragment &&
				(row.verdict === "candidate" ||
					row.verdict === "knownElsewhere")
					? `${extra === "" ? "" : " "}（碎片，见「整句还原」）`
					: "";
			lines.push(formatRow(row, `${extra}${fragment}`));
		}
	}
}

function countByVerdict(
	rows: readonly ReportRow[],
): ReadonlyMap<Verdict, number> {
	const counts = new Map<Verdict, number>();
	for (const row of rows) {
		counts.set(
			row.verdict,
			(counts.get(row.verdict) ?? 0) + 1,
		);
	}
	return counts;
}

// —— CLI ——

async function main(): Promise<void> {
	const file = Bun.argv[2];
	if (!file) {
		console.error(
			"用法：bun run report:misses <导出的漏翻日志.json>",
		);
		process.exitCode = 1;
		return;
	}
	let text: string;
	try {
		text = await Bun.file(file).text();
	} catch (error) {
		console.error(`读取失败：${file}（${String(error)}）`);
		process.exitCode = 1;
		return;
	}
	let payload: unknown;
	try {
		payload = JSON.parse(text);
	} catch (error) {
		console.error(
			`不是合法 JSON：${file}（${String(error)}）`,
		);
		process.exitCode = 1;
		return;
	}
	try {
		const exported = parseExport(payload);
		const dict = loadLocaleDict("zh-CN");
		const rows = classify(
			exported.items,
			dict,
			new Map(Object.entries(loadCore().aliases)),
		);
		console.log(
			formatReport(rows, {
				file,
				exportedAt: exported.exportedAt,
				schema: exported.schema,
				dropped: exported.dropped,
			}),
		);
	} catch (error) {
		console.error(
			error instanceof Error
				? error.message
				: String(error),
		);
		process.exitCode = 1;
	}
}

if (import.meta.main) {
	await main();
}
