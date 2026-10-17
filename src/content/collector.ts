// 开发者模式漏翻收集：内存缓冲 + 纯函数合并 / 排序 / 序列化 + 节流落盘
// 模块顶层不触碰 chrome 与 DOM API（bun 测试可直接导入）；浏览器调用都在函数内

import {
	readMissLog,
	writeMissLog,
} from "../shared/storage.ts";
import type {
	MissItem,
	MissKind,
} from "../shared/types.ts";
import { hasNonLatinLetter } from "./filters.ts";

/** 内存缓冲上限：满了丢弃新增（单页会话内防爆炸） */
export const BUFFER_CAP = 300;
/** storage 落盘上限：满了保留先收集的 */
export const MISS_LOG_CAP = 500;
/**
 * 采集语义版本；变更 count / 筛选规则 / 记录字段时清掉旧格式产生的历史记录。
 * 3：记录里新增 context（元素上下文），与 2 的条目不再是同一份数据。
 */
export const MISS_LOG_REVISION = 3;
/** 上下文标签上限：只用来判断元素种类，不追求完整选择器 */
const CONTEXT_MAX = 64;

// 模块单例状态（开关变化靠整页刷新重建，无需运行时切换缓冲）
let enabled = false;
const buffer = new Map<string, MissItem>();
const observedNodes = new WeakMap<Node, Set<string>>();

/** 开发者模式是否开启；关闭时所有 record 调用零开销直返 */
export function isEnabled(): boolean {
	return enabled;
}

/** 入口 bootstrap 时设置开关 */
export function setEnabled(value: boolean): void {
	enabled = value;
}

/** 缓冲键包含路径与上下文，避免同一文案跨页面 / 跨元素种类时把次数和 path 错误合并。 */
export function missKey(
	kind: MissKind,
	text: string,
	path: string,
	context: string,
): string {
	return JSON.stringify([path, kind, text, context]);
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

/** 一条新记录的四个标识字段（count 由缓冲/合并逻辑维护） */
export interface MissDraft {
	readonly kind: MissKind;
	readonly text: string;
	readonly path: string;
	readonly context: string;
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
	const key = missKey(kind, normalized, path, context);
	let seen = observedNodes.get(node);
	if (seen === undefined) {
		seen = new Set();
		observedNodes.set(node, seen);
	}
	if (seen.has(key)) return;
	if (
		!upsertMiss(
			buffer,
			{ kind, text: normalized, path, context },
			BUFFER_CAP,
		)
	)
		return;
	seen.add(key);
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

/**
 * 把本会话缓冲合并进已持久化日志（upsert：同路径、同类型、同文案累加 count），
 * 超出 cap 丢弃新增键。返回新数组，不改两个入参。
 */
export function mergeMissLogs(
	existing: readonly MissItem[],
	incoming: readonly MissItem[],
	cap: number,
): MissItem[] {
	const merged = new Map<string, MissItem>();
	for (const item of existing) {
		merged.set(
			missKey(
				item.kind,
				item.text,
				item.path,
				item.context,
			),
			item,
		);
	}
	for (const item of incoming) {
		const key = missKey(
			item.kind,
			item.text,
			item.path,
			item.context,
		);
		const prior = merged.get(key);
		if (prior !== undefined) {
			merged.set(key, {
				...prior,
				count: prior.count + item.count,
			});
			continue;
		}
		if (merged.size >= cap) continue;
		merged.set(key, item);
	}
	return [...merged.values()];
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

/** 序列化为导出 JSON（schema github-zh-misses/2），排序规则见 sortMisses */
export function serializeMisses(
	items: readonly MissItem[],
	exportedAt: Date,
): string {
	return JSON.stringify(
		{
			schema: "github-zh-misses/2",
			exportedAt: exportedAt.toISOString(),
			items: sortMisses(items).map((item) => ({
				text: item.text,
				kind: item.kind,
				path: item.path,
				context: item.context,
				count: item.count,
			})),
		},
		null,
		2,
	);
}

/**
 * 把缓冲合并落盘到 missLog（读 → 合并 → 写回 → 清空缓冲）。
 * 缓冲为空时直接返回：这就是落盘节流——无新增不写 storage。
 */
export async function flushMisses(): Promise<void> {
	if (buffer.size === 0) return;
	const existing = await readMissLog();
	const merged = mergeMissLogs(
		existing,
		[...buffer.values()],
		MISS_LOG_CAP,
	);
	await writeMissLog(merged);
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
