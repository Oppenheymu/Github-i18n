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
/** 采集语义版本；变更 count / 筛选规则时清掉旧格式产生的历史记录。 */
export const MISS_LOG_REVISION = 2;

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

/** 缓冲键包含路径，避免同一文案跨页面时把次数和 path 错误合并。 */
export function missKey(
	kind: MissKind,
	text: string,
	path: string,
): string {
	return JSON.stringify([path, kind, text]);
}

/**
 * 把一条未命中记录 upsert 进缓冲：相同路径、类型和文案累加 count。
 * 达到 cap 后丢弃新增键（已存在键的 count 仍累加）。纯函数，不改调用方以外的状态。
 */
export function upsertMiss(
	buffer: Map<string, MissItem>,
	kind: MissKind,
	text: string,
	path: string,
	cap: number,
): boolean {
	const key = missKey(kind, text, path);
	const existing = buffer.get(key);
	if (existing !== undefined) {
		buffer.set(key, {
			kind: existing.kind,
			text: existing.text,
			path: existing.path,
			count: existing.count + 1,
		});
		return true;
	}
	if (buffer.size >= cap) return false;
	buffer.set(key, { kind, text, path, count: 1 });
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
	const key = missKey(kind, normalized, path);
	let seen = observedNodes.get(node);
	if (seen === undefined) {
		seen = new Set();
		observedNodes.set(node, seen);
	}
	if (seen.has(key)) return;
	if (
		!upsertMiss(buffer, kind, normalized, path, BUFFER_CAP)
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
			missKey(item.kind, item.text, item.path),
			item,
		);
	}
	for (const item of incoming) {
		const key = missKey(item.kind, item.text, item.path);
		const prior = merged.get(key);
		if (prior !== undefined) {
			merged.set(key, {
				kind: prior.kind,
				text: prior.text,
				path: prior.path,
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

/** 序列化为导出 JSON（schema github-zh-misses/1），排序规则见 sortMisses */
export function serializeMisses(
	items: readonly MissItem[],
	exportedAt: Date,
): string {
	return JSON.stringify(
		{
			schema: "github-zh-misses/1",
			exportedAt: exportedAt.toISOString(),
			items: sortMisses(items).map((item) => ({
				text: item.text,
				kind: item.kind,
				path: item.path,
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
