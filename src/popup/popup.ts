// popup 逻辑：扩展自身 UI 文案（_locales）+ 开关读写 + 状态文案 + 版本号回填 +
// 开发者模式漏翻面板
//
// 扩展自身 UI 与「翻译目标语言」是两条独立的轴：前者跟随浏览器界面语言，走
// public/_locales/**（manifest 的 __MSG_*__ 也走同一套）；后者是用户在 popup 里
// 选的词典语言，存在 chrome.storage.local，见 src/dict/locales.ts。

import { serializeMisses } from "../content/collector.ts";
import {
	isLocaleId,
	LOCALES,
	type LocaleId,
} from "../dict/locales.ts";
import {
	readDevMode,
	readEnabled,
	readLocale,
	readMissDropped,
	readMissLog,
	watchMissLog,
	writeDevMode,
	writeEnabled,
	writeLocale,
	writeMissDropped,
	writeMissLog,
} from "../shared/storage.ts";
import type { MissItem } from "../shared/types.ts";

/**
 * 取扩展 UI 文案；取不到时记录并降级为消息键本身（例如 devCount），绝不抛错——
 * renderMessages() 是初始化路径上最早的调用点，任何一处缺键都不该让整个 popup
 * 空白（键集合与占位符一致性由 tooling/checks/manifest.ts 门禁保证，这里只兜底）。
 */
function msg(
	name: string,
	substitutions?: string[],
): string {
	const text = chrome.i18n.getMessage(
		name,
		substitutions ?? [],
	);
	if (text.length === 0) {
		console.warn(
			`缺少扩展 UI 文案 ${name}，已降级显示消息键`,
		);
		return name;
	}
	return text;
}

/** 断言元素存在并收窄类型（闭包内不保留 || 链收窄，显式断言最稳） */
function assertFound<T>(
	element: T | null,
	selector: string,
): T {
	if (element === null)
		throw new Error(`popup 结构不完整：缺少 ${selector}`);
	return element;
}

const toggle = assertFound(
	document.querySelector<HTMLInputElement>("#toggle"),
	"#toggle",
);
const status = assertFound(
	document.querySelector<HTMLElement>("#status"),
	"#status",
);
const version = assertFound(
	document.querySelector<HTMLElement>(".version"),
	".version",
);
const devToggle = assertFound(
	document.querySelector<HTMLInputElement>("#dev-toggle"),
	"#dev-toggle",
);
const devPanel = assertFound(
	document.querySelector<HTMLElement>("#dev-panel"),
	"#dev-panel",
);
const devCount = assertFound(
	document.querySelector<HTMLElement>("#dev-count"),
	"#dev-count",
);
const devCopy = assertFound(
	document.querySelector<HTMLButtonElement>("#dev-copy"),
	"#dev-copy",
);
const devClear = assertFound(
	document.querySelector<HTMLButtonElement>("#dev-clear"),
	"#dev-clear",
);
const localeSelect = assertFound(
	document.querySelector<HTMLSelectElement>("#locale"),
	"#locale",
);

/** 当前漏翻日志缓存：watchMissLog 实时同步，复制时同步序列化（用户手势内完成剪贴板写入） */
let misses: readonly MissItem[] = [];
/** 因上限被丢弃的累计条数：随导出一起交出去，避免「刚好 N 条」与「被截断」混淆 */
let dropped = 0;

/**
 * 初始化语言选择器：第一项是「自动」（值空串 → storage 里删除该键），
 * 其余项由 src/dict/locales.ts 的声明生成，选项文案用该语言自身书写。
 */
function buildLocaleSelect(): void {
	const auto = document.createElement("option");
	auto.value = "";
	auto.textContent = msg("localeAuto");
	localeSelect.append(auto);
	for (const meta of LOCALES) {
		const option = document.createElement("option");
		option.value = meta.id;
		option.textContent = meta.name;
		localeSelect.append(option);
	}
}

/** 回填选择器当前值（null = 自动） */
function renderLocale(locale: LocaleId | null): void {
	localeSelect.value = locale ?? "";
}

/** 渲染开关与状态文案（与 popup.html 的 #status.on/.off 样式联动） */
function render(enabled: boolean): void {
	toggle.checked = enabled;
	status.textContent = msg(
		enabled ? "statusOn" : "statusOff",
	);
	status.className = enabled ? "on" : "off";
}

/** 渲染开发者区块：面板显隐 + 计数文案 */
function renderDev(devMode: boolean): void {
	devToggle.checked = devMode;
	devPanel.classList.toggle("hidden", !devMode);
	devCount.textContent = msg("devCount", [
		String(misses.length),
	]);
}

/** 复制按钮临时反馈文案，1.5 秒后还原 */
function flashCopyButton(text: string): void {
	devCopy.textContent = text;
	devCopy.disabled = true;
	window.setTimeout(() => {
		devCopy.textContent = msg("devCopy");
		devCopy.disabled = false;
	}, 1500);
}

/** 初始化开发者区块：读漏翻日志与开关状态 */
async function initDev(): Promise<void> {
	misses = await readMissLog();
	dropped = await readMissDropped();
	renderDev(await readDevMode());
}

/** 把 popup.html 里所有 data-i18n 占位按浏览器界面语言回填 */
function renderMessages(): void {
	for (const element of document.querySelectorAll<HTMLElement>(
		"[data-i18n]",
	)) {
		const key = element.dataset["i18n"];
		if (key === undefined) continue;
		element.textContent = msg(key);
	}
	document.title = msg("appName");
	document.documentElement.lang =
		chrome.i18n.getUILanguage();
}

function main(): void {
	renderMessages();
	version.textContent =
		chrome.runtime.getManifest().version;
	void readEnabled().then(render);
	toggle.addEventListener("change", () => {
		const next = toggle.checked;
		render(next);
		// content script 经 storage.onChanged 收到后整页刷新生效
		void writeEnabled(next);
	});

	buildLocaleSelect();
	void readLocale().then(renderLocale);
	localeSelect.addEventListener("change", () => {
		// 空值 = 恢复「自动」：storage 里删除该键，由 content script 按浏览器语言解析
		const value = localeSelect.value;
		const next: LocaleId | null = isLocaleId(value)
			? value
			: null;
		renderLocale(next);
		void writeLocale(next);
	});

	void initDev();
	// content script 可能在 popup 打开期间落盘，计数实时刷新
	watchMissLog((items) => {
		misses = items;
		renderDev(devToggle.checked);
	});
	devToggle.addEventListener("change", () => {
		void writeDevMode(devToggle.checked);
		renderDev(devToggle.checked);
	});
	devCopy.addEventListener("click", () => {
		const json = serializeMisses(
			misses,
			new Date(),
			dropped,
		);
		void navigator.clipboard.writeText(json).then(
			() => flashCopyButton(msg("devCopied")),
			() => flashCopyButton(msg("devCopyFailed")),
		);
	});
	devClear.addEventListener("click", () => {
		misses = [];
		dropped = 0;
		renderDev(devToggle.checked);
		void writeMissLog([]);
		void writeMissDropped(0);
	});
}

// 最外层兜底：初始化期间任何未预期的同步错误只记日志，不再让 popup 整页空白。
// 注意：模块顶部的 DOM 断言（assertFound）仍在 main() 之外抛出——popup.html 与
// popup.js 同包发布，缺元素属打包错误，且缺了 #toggle / #status 也渲染不出可用界面，
// 故刻意不吞掉它（避免掩盖真实问题）。
try {
	main();
} catch (error) {
	console.error("popup 初始化失败：", error);
}
