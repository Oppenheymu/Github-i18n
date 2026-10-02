// manifest 门禁：MV3 字段完整性 / matches / 资产与产物引用存在性 /
// _locales 与 __MSG_*__ 占位符一致性 / 跨语言 $NAME$ 占位符一致性 /
// popup.html 硬编码版本号一致性
// 校验逻辑导出为纯函数供测试复用；失败置 exitCode = 1

import {
	existsSync,
	readdirSync,
	readFileSync,
} from "node:fs";
import { join } from "node:path";
import packageJson from "../../package.json";
import manifestJson from "../../public/manifest.json";

/** 校验用松散类型（真实 manifest 由 JSON 推断类型，测试手工构造缺字段场景） */
export interface ManifestLike {
	manifest_version?: number;
	default_locale?: string;
	name?: string;
	version?: string;
	description?: string;
	permissions?: readonly string[];
	icons?: Readonly<Record<string, string>>;
	action?: {
		default_popup?: string;
		default_title?: string;
	};
	content_scripts?: readonly {
		matches?: readonly string[];
		js?: readonly string[];
		run_at?: string;
	}[];
}

/** 产物文件 → 源码入口映射（改产物名时同步 build.ts 与 public/manifest.json） */
export const BUILD_OUTPUTS: Readonly<
	Record<string, string>
> = {
	"content.js": "src/content/index.ts",
	"popup.js": "src/popup/popup.ts",
};

export interface ValidateOptions {
	/** public/ 目录（静态资产基准） */
	publicDir: string;
	/** 仓库根（BUILD_OUTPUTS 的源码路径基准） */
	rootDir: string;
	/** dist/ 目录；null 表示尚未构建，跳过产物存在性断言 */
	distDir: string | null;
	packageVersion: string;
	/** public/_locales 下各语言的消息键集合与占位符信息（由 loadLocaleMessages 读取） */
	locales: readonly LocaleMessages[];
	/** popup.html 源码；null 表示读不到，跳过 data-i18n 键与版本号校验 */
	popupHtml: string | null;
	/** src/popup/popup.ts 源码；null 表示读不到，跳过「选择器必须存在于 popup.html」校验 */
	popupSource: string | null;
}

/** popup.html 里的 data-i18n="key" 引用 */
const I18N_ATTR = /data-i18n="([A-Za-z0-9_@]+)"/g;

/** 取出 popup.html 引用的全部 i18n 消息键（去重，保持出现顺序） */
export function extractI18nKeys(html: string): string[] {
	const keys: string[] = [];
	for (const match of html.matchAll(I18N_ATTR)) {
		const key = match[1];
		if (key !== undefined && !keys.includes(key))
			keys.push(key);
	}
	return keys;
}

/** popup.html 里带 class 含 version 的元素（含其文本；只看第一个） */
const VERSION_ELEMENT =
	/<[A-Za-z][A-Za-z0-9-]*\b[^>]*\bclass="[^"]*\bversion\b[^"]*"[^>]*>([^<]*)</;

/**
 * 取出 popup.html 里 class="version" 元素内的文本（已 trim）；没有该元素返回 null。
 * 运行时 popup.ts 会用 chrome.runtime.getManifest().version 覆写它，硬编码的值只是
 * 无脚本时的兜底，漏改就会与真实版本号不一致（记 L-07）。
 */
export function extractVersionText(
	html: string,
): string | null {
	const text = VERSION_ELEMENT.exec(html)?.[1];
	if (text === undefined) return null;
	return text.trim();
}

/** 读取文本文件；不存在或读失败返回 null（由调用方转成门禁错误） */
export function readTextOrNull(
	path: string,
): string | null {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return null;
	}
}

/** popup.ts 里的元素选择器字面量：querySelector / querySelectorAll，可带泛型参数 */
const POPUP_SELECTOR =
	/querySelector(?:All)?(?:<[^>]*>)?\(\s*"([^"]+)"\s*\)/g;

/**
 * 取出 popup.ts 用到的全部选择器字面量（去重，保持出现顺序）。
 * 只认字符串字面量：拼出来的选择器静态看不见，门禁会漏（故 popup.ts 里不要那么写）。
 */
export function extractPopupSelectors(
	source: string,
): string[] {
	const selectors: string[] = [];
	for (const match of source.matchAll(POPUP_SELECTOR)) {
		const selector = match[1];
		if (
			selector !== undefined &&
			!selectors.includes(selector)
		) {
			selectors.push(selector);
		}
	}
	return selectors;
}

interface HtmlTargets {
	readonly ids: ReadonlySet<string>;
	readonly classes: ReadonlySet<string>;
	readonly attrs: ReadonlySet<string>;
}

const HTML_TAG = /<[A-Za-z][A-Za-z0-9-]*\b([^>]*)>/g;
const HTML_ID = /\bid="([^"]*)"/;
const HTML_CLASS = /\bclass="([^"]*)"/;
const HTML_ATTR_NAME = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=/g;

/**
 * 零依赖地收集 HTML 里可供选择器命中的目标：id / class 名 / 属性名。
 * 只做「存在性」判断——门禁不需要真的解析 DOM，但足以拦住「HTML 改了、选择器没改」。
 */
export function collectHtmlTargets(
	html: string,
): HtmlTargets {
	const ids = new Set<string>();
	const classes = new Set<string>();
	const attrs = new Set<string>();
	for (const tag of html.matchAll(HTML_TAG)) {
		const segment = tag[1] ?? "";
		const id = HTML_ID.exec(segment)?.[1];
		if (id !== undefined && id.length > 0) ids.add(id);
		const classValue = HTML_CLASS.exec(segment)?.[1];
		if (classValue !== undefined) {
			for (const name of classValue.split(/\s+/)) {
				if (name.length > 0) classes.add(name);
			}
		}
		for (const attr of segment.matchAll(HTML_ATTR_NAME)) {
			const name = attr[1];
			if (name !== undefined) attrs.add(name.toLowerCase());
		}
	}
	return { ids, classes, attrs };
}

/** true = 命中；false = 确定不存在；null = 形态不受支持（门禁宁可响亮报错也不静默放过） */
function isPresentInHtml(
	selector: string,
	targets: HtmlTargets,
): boolean | null {
	if (selector.startsWith("#")) {
		return targets.ids.has(selector.slice(1));
	}
	if (selector.startsWith(".")) {
		return targets.classes.has(selector.slice(1));
	}
	if (selector.startsWith("[") && selector.endsWith("]")) {
		const name =
			selector
				.slice(1, -1)
				.split("=")[0]
				?.trim()
				.toLowerCase() ?? "";
		return targets.attrs.has(name);
	}
	return null;
}

/**
 * 校验 popup.ts 用到的选择器都存在于 popup.html。
 *
 * 为什么需要（记 L-08）：popup.ts 顶层的 assertFound 在缺元素时直接抛错，popup
 * 会整页空白；而 HTML 与 TS 分属两类文件，`check:manifest` 此前只对了
 * data-i18n 键与版本号文本，**元素 id / class 无人对账**——改个 id 或删个容器，
 * 测试与门禁全绿，只有实机点开 popup 才发现。
 */
export function validatePopupSelectors(
	html: string,
	source: string,
): string[] {
	const targets = collectHtmlTargets(html);
	const errors: string[] = [];
	for (const selector of extractPopupSelectors(source)) {
		const present = isPresentInHtml(selector, targets);
		if (present === null) {
			errors.push(
				`popup.ts 的选择器 ${selector} 形态不受门禁支持（只认 #id / .class / [attr]）`,
			);
			continue;
		}
		if (!present) {
			errors.push(
				`popup.ts 的选择器 ${selector} 在 popup.html 里不存在（popup 初始化会因缺少该元素而整页空白）`,
			);
		}
	}
	return errors;
}

/** 一个语言目录的消息键集合与逐条占位符信息（tooling 侧读取 public/_locales/<locale>/messages.json） */
export interface LocaleMessages {
	/** 目录名，即 Chrome 的 locale 标识（en / zh_CN / ja） */
	readonly locale: string;
	readonly keys: readonly string[];
	/**
	 * 消息键 → 条目详情。可选：只关心键集合的调用方可以省略，
	 * 省略时跳过该语言的占位符断言。
	 */
	readonly entries?: Readonly<
		Record<string, LocaleMessageEntry>
	>;
}

/** messages.json 里一条消息的占位符信息 */
export interface LocaleMessageEntry {
	/** message 文本原文 */
	readonly message: string;
	/** message 里引用的 $NAME$ 名单（保持出现顺序、去重、保留原大小写） */
	readonly referenced: readonly string[];
	/** placeholders 里声明的占位符名（保持出现顺序、去重） */
	readonly declared: readonly string[];
}

/**
 * message 文本里的占位符引用：Chrome 的写法是 $NAME$，而 `$$` 是转义的字面美元符
 * （`$$COUNT$$` 渲染成字面 `$COUNT$`，不是引用），故两个分支必须并列匹配。
 */
const MESSAGE_PLACEHOLDER = /\$\$|\$([A-Za-z0-9_]+)\$/g;

/** 取出 message 文本引用的全部 $NAME$（去重，保持出现顺序，保留原大小写） */
export function extractMessagePlaceholders(
	message: string,
): string[] {
	const names: string[] = [];
	for (const match of message.matchAll(
		MESSAGE_PLACEHOLDER,
	)) {
		const name = match[1];
		// 没有捕获组 = 命中的是 $$ 转义，不是占位符引用
		if (name === undefined) continue;
		if (!names.includes(name)) names.push(name);
	}
	return names;
}

/** 是否是可用于索引的普通对象（收窄 JSON 解析结果，避免显式 any） */
function isRecord(
	value: unknown,
): value is Record<string, unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value)
	);
}

/** 解析 placeholders 声明；缺省或形态不对时返回空数组（由引用断言报错） */
function extractDeclaredPlaceholders(
	value: unknown,
): string[] {
	return isRecord(value) ? Object.keys(value) : [];
}

/**
 * 解析一条 messages.json 条目；缺少 message 文本（非对象 / 不是字符串）返回 null，
 * 由调用方转成门禁错误。
 */
export function parseMessageEntry(
	value: unknown,
): LocaleMessageEntry | null {
	if (!isRecord(value)) return null;
	const message = value["message"];
	if (typeof message !== "string") return null;
	return {
		message,
		referenced: extractMessagePlaceholders(message),
		declared: extractDeclaredPlaceholders(
			value["placeholders"],
		),
	};
}

/** manifest 里 __MSG_key__ 形式的占位符 */
const PLACEHOLDER = /__MSG_([A-Za-z0-9_@]+)__/g;

/** 取出一个 manifest 字段里引用的全部 __MSG_key__（无则空数组） */
export function extractPlaceholders(
	value: string,
): string[] {
	const keys: string[] = [];
	for (const match of value.matchAll(PLACEHOLDER)) {
		const key = match[1];
		if (key !== undefined) keys.push(key);
	}
	return keys;
}

/**
 * 读取 public/_locales 下所有语言的消息键集合与逐条占位符信息。
 * 目录不存在 / 文件不合法 / 条目缺少 message 文本即记入 errors（品牌文案整套走
 * _locales，缺了就会显示成裸占位符或空白，必须在门禁里响亮失败）。
 */
export function loadLocaleMessages(localesDir: string): {
	locales: LocaleMessages[];
	errors: string[];
} {
	const errors: string[] = [];
	const locales: LocaleMessages[] = [];
	if (!existsSync(localesDir)) {
		return {
			locales,
			errors: [`_locales 目录不存在：${localesDir}`],
		};
	}
	for (const entry of readdirSync(localesDir, {
		withFileTypes: true,
	})) {
		if (!entry.isDirectory()) continue;
		const file = join(
			localesDir,
			entry.name,
			"messages.json",
		);
		if (!existsSync(file)) {
			errors.push(
				`_locales/${entry.name} 缺少 messages.json`,
			);
			continue;
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(readFileSync(file, "utf8"));
		} catch (error) {
			errors.push(
				`_locales/${entry.name}/messages.json 无法解析：${String(error)}`,
			);
			continue;
		}
		if (!isRecord(parsed)) {
			errors.push(
				`_locales/${entry.name}/messages.json 必须是对象`,
			);
			continue;
		}
		const entries: Record<string, LocaleMessageEntry> = {};
		for (const [key, value] of Object.entries(parsed)) {
			const item = parseMessageEntry(value);
			if (item === null) {
				errors.push(
					`_locales/${entry.name}/messages.json 的 ${key} 条目缺少 message 文本`,
				);
				continue;
			}
			entries[key] = item;
		}
		locales.push({
			locale: entry.name,
			keys: Object.keys(parsed),
			entries,
		});
	}
	locales.sort((a, b) =>
		a.locale < b.locale ? -1 : a.locale > b.locale ? 1 : 0,
	);
	return { locales, errors };
}

/**
 * 大小写不敏感差集（Chrome 的占位符名大小写不敏感：`$COUNT$` 由
 * `placeholders.count` 声明）；返回 names 里的原始写法，报错时保留作者书写的形态。
 */
function difference(
	names: readonly string[],
	others: readonly string[],
): string[] {
	const normalized = others.map((name) =>
		name.toLowerCase(),
	);
	return names.filter(
		(name) => !normalized.includes(name.toLowerCase()),
	);
}

/** 把占位符名渲染成 Chrome 的引用写法（报错文案用） */
function renderPlaceholders(
	names: readonly string[],
): string {
	return names.map((name) => `$${name}$`).join(" / ");
}

/**
 * 校验跨语言的 $NAME$ 占位符一致性（记 M-03）：
 * 1. 同一条消息在所有语言里的 $NAME$ 引用集合必须一致——否则某个语言的文案会静默
 *    丢掉数值（例如 `devCount` 写成「已收集 条」）；
 * 2. 每个被引用的 $NAME$ 都必须在该条目的 placeholders 里声明——未声明的引用在
 *    Chrome 里取不到值。若所有语言都没用过 placeholders（纯静态文案的写法），
 *    则只做第 1 条，不凭空要求补声明。
 * 省略 entries 的语言（只关心键集合的调用方）与缺键的语言跳过（缺键由键集合断言负责）。
 */
export function validateLocalePlaceholders(
	locales: readonly LocaleMessages[],
	defaultLocale: string,
): string[] {
	const errors: string[] = [];
	const base = locales.find(
		(entry) => entry.locale === defaultLocale,
	);
	const baseEntries = base?.entries;
	if (baseEntries === undefined) return errors;
	for (const entry of locales) {
		const entries = entry.entries;
		if (entries === undefined) continue;
		if (entry.locale === defaultLocale) continue;
		for (const [key, baseEntry] of Object.entries(
			baseEntries,
		)) {
			const target = entries[key];
			if (target === undefined) continue;
			const missing = difference(
				baseEntry.referenced,
				target.referenced,
			);
			if (missing.length > 0) {
				errors.push(
					`_locales/${entry.locale} 的消息键 ${key} 缺少占位符：${renderPlaceholders(missing)}`,
				);
			}
			const extra = difference(
				target.referenced,
				baseEntry.referenced,
			);
			if (extra.length > 0) {
				errors.push(
					`_locales/${entry.locale} 的消息键 ${key} 多出占位符（默认语言 ${defaultLocale} 里没有）：${renderPlaceholders(extra)}`,
				);
			}
		}
	}
	const usesPlaceholders = locales.some((entry) =>
		Object.values(entry.entries ?? {}).some(
			(item) => item.declared.length > 0,
		),
	);
	if (!usesPlaceholders) return errors;
	for (const entry of locales) {
		for (const [key, item] of Object.entries(
			entry.entries ?? {},
		)) {
			const undeclared = difference(
				item.referenced,
				item.declared,
			);
			if (undeclared.length > 0) {
				errors.push(
					`_locales/${entry.locale} 的消息键 ${key} 引用了未在 placeholders 里声明的占位符：${renderPlaceholders(undeclared)}`,
				);
			}
		}
	}
	return errors;
}

/**
 * 校验 _locales 的一致性：default_locale 必须有对应目录，manifest 里引用的
 * 每个 __MSG_key__ 必须在默认语言里存在，所有语言的消息键集合完全相同
 * （缺键会让某语言的界面出现空文案；键集合很小，要求翻译齐全是合理的），
 * 且同一条消息的 $NAME$ 占位符引用集合与 placeholders 声明一致。
 */
export function validateLocales(
	locales: readonly LocaleMessages[],
	defaultLocale: string | undefined,
): string[] {
	const errors: string[] = [];
	if (
		typeof defaultLocale !== "string" ||
		defaultLocale.trim().length === 0
	) {
		errors.push(
			"default_locale 缺失（品牌文案走 __MSG_*__ 时必填）",
		);
		return errors;
	}
	const base = locales.find(
		(entry) => entry.locale === defaultLocale,
	);
	if (base === undefined) {
		errors.push(
			`default_locale（${defaultLocale}）没有对应的 _locales/${defaultLocale}/messages.json`,
		);
		return errors;
	}
	for (const entry of locales) {
		if (entry.locale === defaultLocale) continue;
		const missing = base.keys.filter(
			(key) => !entry.keys.includes(key),
		);
		if (missing.length > 0) {
			errors.push(
				`_locales/${entry.locale} 缺少消息键：${missing.join(" / ")}`,
			);
		}
		const extra = entry.keys.filter(
			(key) => !base.keys.includes(key),
		);
		if (extra.length > 0) {
			errors.push(
				`_locales/${entry.locale} 多出消息键（默认语言 ${defaultLocale} 里没有）：${extra.join(" / ")}`,
			);
		}
	}
	errors.push(
		...validateLocalePlaceholders(locales, defaultLocale),
	);
	return errors;
}

export function validateManifest(
	manifest: ManifestLike,
	options: ValidateOptions,
): string[] {
	const errors: string[] = [];
	if (manifest.manifest_version !== 3) {
		errors.push(
			"manifest_version 必须为 3（本项目仅支持 MV3）",
		);
	}
	if (
		typeof manifest.name !== "string" ||
		manifest.name.trim().length === 0
	) {
		errors.push("name 不能为空");
	}
	if (
		typeof manifest.description !== "string" ||
		manifest.description.trim().length === 0
	) {
		errors.push("description 不能为空");
	}
	errors.push(
		...validateLocales(
			options.locales,
			manifest.default_locale,
		),
	);
	// 品牌文案走 __MSG_*__：占位符必须在默认语言里存在，否则商店与工具栏显示裸占位符
	const defaultMessages = options.locales.find(
		(entry) => entry.locale === manifest.default_locale,
	);
	if (defaultMessages !== undefined) {
		const fields: readonly [string, string | undefined][] =
			[
				["name", manifest.name],
				["description", manifest.description],
				[
					"action.default_title",
					manifest.action?.default_title,
				],
			];
		for (const [field, value] of fields) {
			if (typeof value !== "string") continue;
			for (const key of extractPlaceholders(value)) {
				if (defaultMessages.keys.includes(key)) continue;
				errors.push(
					`${field} 引用的 __MSG_${key}__ 在 _locales/${defaultMessages.locale}/messages.json 里不存在`,
				);
			}
		}
		// popup.html 的 data-i18n 键：getMessage 取不到就会抛错，必须在这里拦住
		for (const key of extractI18nKeys(
			options.popupHtml ?? "",
		)) {
			if (defaultMessages.keys.includes(key)) continue;
			errors.push(
				`popup.html 的 data-i18n="${key}" 在 _locales/${defaultMessages.locale}/messages.json 里不存在`,
			);
		}
	}
	if (manifest.version !== options.packageVersion) {
		errors.push(
			`version（${manifest.version}）须与 package.json（${options.packageVersion}）一致`,
		);
	}
	// popup.html 的版本号是运行时覆写前的兜底文案：存在就必须与 package.json 同步（记 L-07）
	if (options.popupHtml !== null) {
		const versionText = extractVersionText(
			options.popupHtml,
		);
		if (
			versionText !== null &&
			versionText !== options.packageVersion
		) {
			errors.push(
				`popup.html 的 class="version" 文本（${versionText}）须与 package.json（${options.packageVersion}）一致`,
			);
		}
	}
	// popup.ts 的选择器必须都存在于 popup.html（记 L-08）
	if (
		options.popupHtml !== null &&
		options.popupSource !== null
	) {
		errors.push(
			...validatePopupSelectors(
				options.popupHtml,
				options.popupSource,
			),
		);
	}
	const permissions = manifest.permissions ?? [];
	if (!permissions.includes("storage")) {
		errors.push(
			"permissions 必须包含 storage（popup 开关状态存取）",
		);
	}
	for (const [size, file] of Object.entries(
		manifest.icons ?? {},
	)) {
		if (!existsSync(join(options.publicDir, file))) {
			errors.push(
				`图标 ${size}x${size} 引用的 ${file} 不存在于 public/`,
			);
		}
	}
	const popup = manifest.action?.default_popup;
	if (typeof popup !== "string" || popup.length === 0) {
		errors.push(
			"action.default_popup 缺失（popup 开关入口）",
		);
	} else if (!existsSync(join(options.publicDir, popup))) {
		errors.push(
			`action.default_popup 引用的 ${popup} 不存在于 public/`,
		);
	}
	const scripts = manifest.content_scripts ?? [];
	if (scripts.length === 0)
		errors.push("content_scripts 不能为空");
	for (const script of scripts) {
		const matches = script.matches ?? [];
		for (const required of [
			"https://github.com/*",
			"https://gist.github.com/*",
		]) {
			if (!matches.includes(required)) {
				errors.push(
					`content_scripts.matches 缺少 ${required}`,
				);
			}
		}
		if (script.run_at !== "document_start") {
			errors.push(
				"content_scripts.run_at 必须为 document_start（尽早挂观察器）",
			);
		}
		for (const file of script.js ?? []) {
			const source = BUILD_OUTPUTS[file];
			if (source === undefined) {
				errors.push(
					`content_scripts.js 引用 ${file} 不在构建映射中（同步本文件 BUILD_OUTPUTS）`,
				);
				continue;
			}
			if (!existsSync(join(options.rootDir, source))) {
				errors.push(
					`产物 ${file} 的源码入口 ${source} 不存在`,
				);
			}
			if (
				options.distDir !== null &&
				!existsSync(join(options.distDir, file))
			) {
				errors.push(
					`dist/${file} 不存在（先 bun run build 再校验）`,
				);
			}
		}
	}
	return errors;
}

function main(): void {
	const root = join(import.meta.dir, "..", "..");
	const publicDir = join(root, "public");
	const distDir = join(root, "dist");
	const loaded = loadLocaleMessages(
		join(publicDir, "_locales"),
	);
	const shipped = manifestJson as ManifestLike;
	const popupFile = shipped.action?.default_popup;
	const popupHtml =
		typeof popupFile === "string"
			? readTextOrNull(join(publicDir, popupFile))
			: null;
	// popup.ts 的源码路径与 build.ts 共用 BUILD_OUTPUTS 映射，避免两处各写一份
	const popupEntry = BUILD_OUTPUTS["popup.js"];
	const popupSource =
		typeof popupEntry === "string"
			? readTextOrNull(join(root, popupEntry))
			: null;
	const errors = [
		...loaded.errors,
		...validateManifest(shipped, {
			publicDir,
			rootDir: root,
			distDir: existsSync(distDir) ? distDir : null,
			packageVersion: packageJson.version,
			locales: loaded.locales,
			popupHtml,
			popupSource,
		}),
	];
	if (errors.length > 0) {
		console.error(
			`manifest 门禁未通过（${errors.length} 处）：`,
		);
		for (const error of errors)
			console.error(`  - ${error}`);
		process.exitCode = 1;
		return;
	}
	console.log(
		`manifest 门禁通过：MV3 字段完整，资产与产物引用有效，_locales ${loaded.locales.map((entry) => entry.locale).join(" / ")} 键集合与占位符一致，popup.html 版本号与 package.json 相符（若存在 class="version"），popup.ts 的元素选择器均存在于 popup.html`,
	);
}

if (import.meta.main) main();
