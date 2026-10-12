// chrome.storage.local 的开关、翻译目标语言与开发者漏翻日志读写
// （content script 与 popup 共用）

import {
	isLocaleId,
	type LocaleId,
	resolveLocale,
} from "../dict/locales.ts";
import type { MissItem, MissKind } from "./types.ts";

const ENABLED_KEY = "enabled";
const DEV_MODE_KEY = "devMode";
const LOCALE_KEY = "locale";
const MISS_LOG_KEY = "missLog";
const MISS_LOG_REVISION_KEY = "missLogRevision";

/** 需要整页刷新联动的开关键（content script 侧任一变化即 reload） */
export type ToggleKey = "enabled" | "devMode";

/** 读取翻译开关；从未写入过（异常数据）时默认开启 */
export async function readEnabled(): Promise<boolean> {
	const data = await chrome.storage.local.get(ENABLED_KEY);
	const value = data[ENABLED_KEY];
	return typeof value === "boolean" ? value : true;
}

/** 写入翻译开关（popup 调用；content 侧经 onChanged 收到变更） */
export async function writeEnabled(
	enabled: boolean,
): Promise<void> {
	await chrome.storage.local.set({
		[ENABLED_KEY]: enabled,
	});
}

/** 读取开发者模式开关；默认关闭（关闭即零收集） */
export async function readDevMode(): Promise<boolean> {
	const data = await chrome.storage.local.get(DEV_MODE_KEY);
	const value = data[DEV_MODE_KEY];
	return typeof value === "boolean" ? value : false;
}

/** 写入开发者模式开关（popup 调用；content 侧经 onChanged 整页刷新生效） */
export async function writeDevMode(
	devMode: boolean,
): Promise<void> {
	await chrome.storage.local.set({
		[DEV_MODE_KEY]: devMode,
	});
}

/** 收窄 storage 取出的语言值：非声明过的 id（含脏数据）一律视为「自动」 */
function narrowLocale(value: unknown): LocaleId | null {
	return isLocaleId(value) ? value : null;
}

/**
 * 读取翻译目标语言；null = 自动（跟随浏览器界面语言）。
 * 从未设置过、或存的值不是声明过的语言 id，都按自动处理。
 */
export async function readLocale(): Promise<LocaleId | null> {
	const data = await chrome.storage.local.get(LOCALE_KEY);
	return narrowLocale(data[LOCALE_KEY]);
}

/** 写入翻译目标语言；传 null 表示恢复「自动」（删除该键） */
export async function writeLocale(
	locale: LocaleId | null,
): Promise<void> {
	if (locale === null) {
		await chrome.storage.local.remove(LOCALE_KEY);
		return;
	}
	await chrome.storage.local.set({ [LOCALE_KEY]: locale });
}

/** 解析最终生效的语言：用户选过就用它，否则跟随浏览器界面语言（未支持即回退） */
export function effectiveLocale(
	selected: LocaleId | null,
	browserLanguage: string,
): LocaleId {
	return selected ?? resolveLocale(browserLanguage);
}

/** 监听翻译目标语言变化（content script 侧收到即整页刷新） */
export function watchLocale(
	callback: (locale: LocaleId | null) => void,
): void {
	chrome.storage.onChanged.addListener((changes, area) => {
		if (area !== "local") return;
		const change = changes[LOCALE_KEY];
		if (!change) return;
		callback(narrowLocale(change.newValue));
	});
}

function isMissKind(value: unknown): value is MissKind {
	return (
		value === "text" ||
		value === "title" ||
		value === "aria-label" ||
		value === "placeholder" ||
		value === "alt"
	);
}

/** 收窄 storage 取出的漏翻日志：仅保留结构合法的条目，脏数据静默丢弃 */
function narrowMissLog(value: unknown): MissItem[] {
	if (!Array.isArray(value)) return [];
	const items: MissItem[] = [];
	for (const raw of value) {
		if (typeof raw !== "object" || raw === null) continue;
		const record = raw as {
			kind?: unknown;
			text?: unknown;
			path?: unknown;
			count?: unknown;
		};
		const { kind, text, path, count } = record;
		if (
			!isMissKind(kind) ||
			typeof text !== "string" ||
			text.length === 0 ||
			typeof path !== "string" ||
			typeof count !== "number" ||
			!Number.isFinite(count) ||
			count < 1
		)
			continue;
		items.push({ kind, text, path, count });
	}
	return items;
}

/** 读取漏翻日志；异常数据视为空 */
export async function readMissLog(): Promise<MissItem[]> {
	const data = await chrome.storage.local.get(MISS_LOG_KEY);
	return narrowMissLog(data[MISS_LOG_KEY]);
}

/** 写入漏翻日志（content flush 落盘与 popup 清空调用） */
export async function writeMissLog(
	items: readonly MissItem[],
): Promise<void> {
	await chrome.storage.local.set({
		[MISS_LOG_KEY]: [...items],
	});
}

/**
 * 采集语义变化时清掉旧日志，避免把旧版重复扫描计数和混合文本继续导出。
 * 版本相同则保留跨页面累积的记录。
 */
export async function ensureMissLogRevision(
	revision: number,
): Promise<void> {
	const data = await chrome.storage.local.get(
		MISS_LOG_REVISION_KEY,
	);
	if (data[MISS_LOG_REVISION_KEY] === revision) return;
	await chrome.storage.local.set({
		[MISS_LOG_KEY]: [],
		[MISS_LOG_REVISION_KEY]: revision,
	});
}

/** 监听漏翻日志变化（popup 打开期间实时刷新计数） */
export function watchMissLog(
	callback: (items: MissItem[]) => void,
): void {
	chrome.storage.onChanged.addListener((changes, area) => {
		if (area !== "local") return;
		const change = changes[MISS_LOG_KEY];
		if (!change) return;
		callback(narrowMissLog(change.newValue));
	});
}

/**
 * 监听开关类键（enabled / devMode）变化；任一变化即回调，
 * 非布尔新值（脏数据）忽略不回调。
 */
export function watchToggles(
	callback: (key: ToggleKey, value: boolean) => void,
): void {
	chrome.storage.onChanged.addListener((changes, area) => {
		if (area !== "local") return;
		for (const key of [
			ENABLED_KEY,
			DEV_MODE_KEY,
		] as const) {
			const change = changes[key];
			if (!change || typeof change.newValue !== "boolean")
				continue;
			callback(key, change.newValue);
		}
	});
}
