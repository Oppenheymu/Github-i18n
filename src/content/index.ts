// content script 入口：document_start 启动观察器，storage 开关联动
// 产物为 IIFE 经典脚本（MV3 content_scripts 不支持 module）

import {
	FALLBACK_LOCALE,
	type LocaleId,
} from "../dict/locales.ts";
import {
	EXTENSION_MARKER,
	EXTENSION_MARKER_KEY,
} from "../shared/identity.ts";
import {
	effectiveLocale,
	ensureMissLogRevision,
	readDevMode,
	readEnabled,
	readLocale,
	watchLocale,
	watchToggles,
} from "../shared/storage.ts";
import {
	MISS_LOG_REVISION,
	setEnabled as setCollectorEnabled,
	startAutoFlush,
} from "./collector.ts";
import { TranslationEngine } from "./engine.ts";
import { viewForPath } from "./pages.ts";

// 在 isolated world 的全局上留下身份标记，供（待重建的）实机探针识别本扩展上下文。
// 必须同步执行、早于任何 await：探针在页面加载后立即求值，晚了会被判成「扩展未注入」。
Object.defineProperty(globalThis, EXTENSION_MARKER_KEY, {
	value: EXTENSION_MARKER,
	configurable: true,
});

let enabled = false;
let devMode = false;
/** 用户在 popup 里选的语言；null = 自动跟随浏览器界面语言 */
let selectedLocale: LocaleId | null = null;
let targetLocale: LocaleId = FALLBACK_LOCALE;

const engine = new TranslationEngine({
	getView: () =>
		viewForPath(location.pathname, targetLocale),
	isEnabled: () => enabled,
});

async function bootstrap(): Promise<void> {
	[enabled, devMode, selectedLocale] = await Promise.all([
		readEnabled(),
		readDevMode(),
		readLocale(),
	]);
	await ensureMissLogRevision(MISS_LOG_REVISION);
	targetLocale = effectiveLocale(
		selectedLocale,
		chrome.i18n.getUILanguage(),
	);
	setCollectorEnabled(devMode);
	// 关闭状态下不启动观察器；等待 popup 切换后经 storage 联动整页刷新
	if (enabled) engine.start(document.documentElement);
	// 开发者模式开启时启动漏翻收集与节流落盘
	if (devMode) startAutoFlush();
}

// 开关（翻译 / 开发者）任一变化一律整页刷新：
// 开启时重建翻译与收集，关闭时还原英文并停止收集（简单可靠）
watchToggles((key, value) => {
	const current = key === "enabled" ? enabled : devMode;
	if (value !== current) location.reload();
});

// 目标语言变化同样整页刷新：词典视图按语言构建，重建比增量替换可靠
watchLocale((next) => {
	if (next !== selectedLocale) location.reload();
});

void bootstrap();
