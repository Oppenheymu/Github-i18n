// 开发者模式漏翻收集：内存缓冲 + 纯函数合并 / 排序 / 序列化 + 节流落盘
// 模块顶层不触碰 chrome 与 DOM API（bun 测试可直接导入）；浏览器调用都在函数内

import {
	readMissDropped,
	readMissLog,
	writeMissDropped,
	writeMissLog,
} from "../shared/storage.ts";
import type {
	MissItem,
	MissKind,
} from "../shared/types.ts";
import { hasNonLatinLetter } from "./filters.ts";

/**
 * 内存缓冲上限：满了丢弃新增（单页会话内防爆炸）。
 *
 * 300 → 1200：洞察页实测一页就攒到三百余条，旧上限会让**先逛的那一页占满配额**，
 * 后一页一条都进不来（审计 C-2 的「先到先得」）。每条记录还带 `block`，条数会更高，
 * 故一次抬到四倍；超出部分不再静默消失，见 `dropped`。
 */
export const BUFFER_CAP = 1200;
/** storage 落盘上限：满了保留先收集的（同样抬到四倍，并计数） */
export const MISS_LOG_CAP = 4000;
/**
 * 采集语义版本；变更 count / 筛选规则 / 记录字段时清掉旧格式产生的历史记录。
 * 3：记录里新增 context（元素上下文）；4：记录里新增 block（整句上下文，且参与去重键），
 * 与 3 的条目不再是同一份数据。
 */
export const MISS_LOG_REVISION = 4;
/** 上下文标签上限：只用来判断元素种类，不追求完整选择器 */
const CONTEXT_MAX = 64;
/** 整句块的祖先回溯层数上限：再深的祖先就不是「这一行」了 */
const BLOCK_DEPTH = 6;
/**
 * 整句块文本上限：超过就停（再往上是一整段 / 整页，拼起来没有意义）。
 * 240 大致是 GitHub 最长的一句说明文；超限时用已经取到的较小祖先。
 */
const BLOCK_MAX = 240;

/**
 * 块级容器（「这一行」的边界）。**故意不含 `a` / `span` / `strong` / `em`**：
 * 那些正是长句被切开的位置，遇到它们必须继续往上爬，才能拿到整句
 * （`Type ` + `<kbd>/</kbd>` + ` to search` 就是被 `<span>` 切开的）。
 */
const BLOCK_TAGS: ReadonlySet<string> = new Set([
	"p",
	"li",
	"td",
	"th",
	"dt",
	"dd",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"label",
	"button",
	"summary",
	"figcaption",
	"caption",
	"legend",
	"option",
	"blockquote",
]);
/** 同一份清单的 CSS 形态（判定「这个 div 里是否还有独立的行」） */
const BLOCK_SELECTOR = [...BLOCK_TAGS].join(",");

// 模块单例状态（开关变化靠整页刷新重建，无需运行时切换缓冲）
let enabled = false;
const buffer = new Map<string, MissItem>();
const observedNodes = new WeakMap<Node, Set<string>>();
/** 整句块按节点缓存：同一节点在多轮扫描里 block 必须稳定（它参与去重键） */
const blockCache = new WeakMap<Node, string>();
/** 本会话因缓冲 / 落盘上限被丢弃的条数（落盘时累加进 storage，导出里可见） */
let sessionDropped = 0;

/** 开发者模式是否开启；关闭时所有 record 调用零开销直返 */
export function isEnabled(): boolean {
	return enabled;
}

/** 入口 bootstrap 时设置开关 */
export function setEnabled(value: boolean): void {
	enabled = value;
}

/**
 * 缓冲键包含路径、上下文与整句块：同一文案跨页面 / 跨元素种类 / 跨句子时各自成条。
 * `block` 参与去重是刻意的——`and` 在五个句子里出现时，五句话的上下文都要留下，
 * 否则只能看到第一句（旧版就是这样把「碎片」全糊成一条 `×4 and`）。
 */
export function missKey(
	kind: MissKind,
	text: string,
	path: string,
	context: string,
	block: string,
): string {
	return JSON.stringify([path, kind, text, context, block]);
}

/**
 * 生成一条未翻译记录的上下文标签：`tag` 或 `tag.首类名`。
 *
 * 只取**第一个** class 词：它通常就是组件名（`prc-Button-ButtonBase-9n-Xk`），足够把
 * `<th>` 表头、`<label>` 标签、`<button>` 按钮区分开；CSS Modules 的哈希尾巴随部署变化，
 * 但那不影响判断元素种类，故不做清洗（清洗规则本身会成为新的维护点）。
 * 文本节点取父元素（属性的 target 本身就是元素）。
 */
export function describeContext(node: Node): string {
	const element =
		node.nodeType === 1
			? (node as Element)
			: node.parentElement;
	if (!element) return "";
	const tag = element.tagName.toLowerCase();
	const first = element.classList?.[0] ?? "";
	const raw = first === "" ? tag : `${tag}.${first}`;
	return raw.length <= CONTEXT_MAX
		? raw
		: raw.slice(0, CONTEXT_MAX);
}

/** 折叠空白：整句块与节点文本必须用同一套归一，才能互相 `includes`（与 normalizeKey 同义） */
function collapseWhitespace(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

/**
 * 生成一条未翻译记录的「整句块」：从记录节点往上找到**块级容器**（`p` / `li` /
 * `th` / `h3` / `label` / `button` …）并返回它的全部文本；一直爬到 `BLOCK_DEPTH`
 * 层还没遇到块级容器时，先退回「第一个不含块级后代、文本比节点更长的祖先」
 * （GitHub 的新版 React 组件常常整句只挂在裸 `<div>` 里），再退回最大的祖先文本。
 *
 * 为什么必须有：日志的每条记录只是一个文本节点，长句被 `<a>` / `<strong>` 切开后
 * 每段各成一条。没有块文本，`changed and there have been` 与 `pushed to` 之间
 * 是什么顺序、要不要补「到」全靠猜——那是本轮「日志不如贴 HTML 好用」的根因。
 *
 * 返回空串的情形（表示「这一行就是该节点自己」，整节点即整句、键可直接收）：
 * 最近块级容器的文本与节点自身文本相同；取不到元素（游离文本节点）；一路上都是
 * 超过 `BLOCK_MAX` 的祖先。
 *
 * 注意：**已译的兄弟节点在块文本里显示中文**（翻译按文档序推进，记录时前面的兄弟
 * 已经换掉了）。这不影响判断——要看的正是未翻节点之间的顺序。
 */
export function describeBlock(node: Node): string {
	const cached = blockCache.get(node);
	if (cached !== undefined) return cached;
	const block = computeBlock(node);
	blockCache.set(node, block);
	return block;
}

function computeBlock(node: Node): string {
	const element =
		node.nodeType === 1
			? (node as Element)
			: node.parentElement;
	if (!element) return "";
	const own = collapseWhitespace(element.textContent ?? "");
	let largest = "";
	let fallback = "";
	let current: Element | null = element;
	for (
		let depth = 0;
		current !== null && depth < BLOCK_DEPTH;
		depth++
	) {
		const text = collapseWhitespace(
			current.textContent ?? "",
		);
		// 超长的祖先不再是「一行」：停在这里，用已经找到的上下文（可能为空）
		if (text.length > BLOCK_MAX) break;
		if (text.length > largest.length) largest = text;
		if (BLOCK_TAGS.has(current.tagName.toLowerCase())) {
			return text === own ? "" : text;
		}
		if (
			fallback === "" &&
			text.length > own.length &&
			current.querySelector(BLOCK_SELECTOR) === null
		) {
			fallback = text;
		}
		current = current.parentElement;
	}
	// 裸 div / span 渲染的句子优先；实在没有块级容器时用**最大的祖先文本**兜底：
	// 宁可多给一层上下文（分拣时能看出这是哪张卡片），也不要让碎片彻底没有语序
	const chosen = fallback === "" ? largest : fallback;
	return chosen === own ? "" : chosen;
}

/** 一条新记录的标识字段（count 由缓冲/合并逻辑维护） */
export interface MissDraft {
	readonly kind: MissKind;
	readonly text: string;
	readonly path: string;
	readonly context: string;
	readonly block: string;
}

/**
 * 把一条未命中记录 upsert 进缓冲：相同路径、类型、文案与上下文累加 count。
 * 达到 cap 后丢弃新增键（已存在键的 count 仍累加）。纯函数，不改调用方以外的状态。
 */
export function upsertMiss(
	buffer: Map<string, MissItem>,
	draft: MissDraft,
	cap: number,
): boolean {
	const key = missKey(
		draft.kind,
		draft.text,
		draft.path,
		draft.context,
		draft.block,
	);
	const existing = buffer.get(key);
	if (existing !== undefined) {
		buffer.set(key, {
			...existing,
			count: existing.count + 1,
		});
		return true;
	}
	if (buffer.size >= cap) return false;
	buffer.set(key, { ...draft, count: 1 });
	return true;
}

/** 只记录纯拉丁文本；含非拉丁文字的节点通常已部分本地化，避免把它们报成漏翻。 */
function isCandidateMiss(text: string): boolean {
	return !hasNonLatinLetter(text);
}

/** 同一个 DOM 节点在反复遍历时只计一次；count 因此表示节点数，而非扫描次数。 */
function recordNode(
	node: Node,
	kind: MissKind,
	text: string,
): void {
	if (!enabled) return;
	const normalized = text.trim();
	if (!isCandidateMiss(normalized)) return;
	const path = location.pathname;
	const context = describeContext(node);
	const block = describeBlock(node);
	const key = missKey(
		kind,
		normalized,
		path,
		context,
		block,
	);
	let seen = observedNodes.get(node);
	if (seen === undefined) {
		seen = new Set();
		observedNodes.set(node, seen);
	}
	if (seen.has(key)) return;
	// 先记「这个节点已处理过」：缓冲满时它不会再被重扫一遍灌进 dropped
	seen.add(key);
	if (
		!upsertMiss(
			buffer,
			{ kind, text: normalized, path, context, block },
			BUFFER_CAP,
		)
	) {
		// 不再静默丢弃：条数会随导出一起交出去（审计 C-2）
		sessionDropped++;
	}
}

/** 记录一条未命中的文本节点；调用方已确保可翻译且不在排除容器内。 */
export function recordText(node: Node, text: string): void {
	recordNode(node, "text", text);
}

/** 记录一条未命中词条的属性值（name 为属性名，即 kind） */
export function recordAttr(
	element: Element,
	name: MissKind,
	text: string,
): void {
	recordNode(element, name, text);
}

/** 合并结果：合并后的数组 + 因超上限被丢弃的条数（后者会一路带到导出里） */
export interface MissMerge {
	readonly items: MissItem[];
	readonly dropped: number;
}

/**
 * 把本会话缓冲合并进已持久化日志（upsert：同路径、同类型、同文案累加 count），
 * 超出 cap 丢弃新增键。返回新数组，不改两个入参。
 */
export function mergeMissLogs(
	existing: readonly MissItem[],
	incoming: readonly MissItem[],
	cap: number,
): MissMerge {
	const merged = new Map<string, MissItem>();
	for (const item of existing) {
		merged.set(
			missKey(
				item.kind,
				item.text,
				item.path,
				item.context,
				item.block,
			),
			item,
		);
	}
	let dropped = 0;
	for (const item of incoming) {
		const key = missKey(
			item.kind,
			item.text,
			item.path,
			item.context,
			item.block,
		);
		const prior = merged.get(key);
		if (prior !== undefined) {
			merged.set(key, {
				...prior,
				count: prior.count + item.count,
			});
			continue;
		}
		if (merged.size >= cap) {
			dropped++;
			continue;
		}
		merged.set(key, item);
	}
	return { items: [...merged.values()], dropped };
}

/** 排序：path 升序 → count 降序 → text 升序（导出与展示共用） */
export function sortMisses(
	items: readonly MissItem[],
): MissItem[] {
	return [...items].sort((a, b) => {
		if (a.path !== b.path) return a.path < b.path ? -1 : 1;
		if (a.count !== b.count) return b.count - a.count;
		if (a.text !== b.text) return a.text < b.text ? -1 : 1;
		return 0;
	});
}

/**
 * 序列化为导出 JSON（schema github-zh-misses/3），排序规则见 sortMisses。
 *
 * `dropped` 是「被上限吃掉、没能进这份清单」的条数：旧版把这类记录静默丢掉，
 * 于是 popup 永远停在 500 条、分拣的人看不出「还有多少没导出来」（审计 C-2）。
 */
export function serializeMisses(
	items: readonly MissItem[],
	exportedAt: Date,
	dropped = 0,
): string {
	return JSON.stringify(
		{
			schema: "github-zh-misses/3",
			exportedAt: exportedAt.toISOString(),
			dropped,
			items: sortMisses(items).map((item) => ({
				text: item.text,
				kind: item.kind,
				path: item.path,
				context: item.context,
				block: item.block,
				count: item.count,
			})),
		},
		null,
		2,
	);
}

/**
 * 把缓冲合并落盘到 missLog（读 → 合并 → 写回 → 清空缓冲）。
 * 缓冲为空且本轮没有丢弃时直接返回：这就是落盘节流——无新增不写 storage。
 */
export async function flushMisses(): Promise<void> {
	if (buffer.size === 0 && sessionDropped === 0) return;
	const existing = await readMissLog();
	const merged = mergeMissLogs(
		existing,
		[...buffer.values()],
		MISS_LOG_CAP,
	);
	await writeMissLog(merged.items);
	const lost = sessionDropped + merged.dropped;
	if (lost > 0) {
		await writeMissDropped(
			(await readMissDropped()) + lost,
		);
	}
	sessionDropped = 0;
	buffer.clear();
}

/** 安装自动落盘：每 5 秒 + 页面隐藏 / 卸载时 flush（仅 devMode 开启时由入口调用一次） */
export function startAutoFlush(): void {
	setInterval(() => void flushMisses(), 5000);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden")
			void flushMisses();
	});
	window.addEventListener(
		"pagehide",
		() => void flushMisses(),
	);
}
