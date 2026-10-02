import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import packageJson from "../../../package.json";
import manifestJson from "../../../public/manifest.json";
import type {
	LocaleMessageEntry,
	LocaleMessages,
	ManifestLike,
} from "../manifest.ts";
import {
	BUILD_OUTPUTS,
	extractI18nKeys,
	extractMessagePlaceholders,
	extractPlaceholders,
	extractPopupSelectors,
	extractVersionText,
	loadLocaleMessages,
	parseMessageEntry,
	readTextOrNull,
	validateLocalePlaceholders,
	validateLocales,
	validateManifest,
	validatePopupSelectors,
} from "../manifest.ts";

const rootDir = join(import.meta.dir, "..", "..", "..");
const publicDir = join(rootDir, "public");
// 版本断言跟随 package.json，升版无需改测试
const packageVersion = packageJson.version;
/** 真实 _locales 目录：品牌文案门禁要按仓库里的实际消息校验 */
const shippedLocales = loadLocaleMessages(
	join(publicDir, "_locales"),
);
const options = {
	publicDir,
	rootDir,
	distDir: null,
	packageVersion,
	locales: shippedLocales.locales,
	popupHtml: readTextOrNull(join(publicDir, "popup.html")),
	popupSource: readTextOrNull(
		join(rootDir, BUILD_OUTPUTS["popup.js"] ?? ""),
	),
};

/** 构造一条 locale（entries 走真实解析路径，供占位符断言复用） */
function localeOf(
	locale: string,
	messages: Record<
		string,
		{
			message: string;
			placeholders?: Record<string, unknown>;
		}
	>,
): LocaleMessages {
	const entries: Record<string, LocaleMessageEntry> = {};
	for (const [key, value] of Object.entries(messages)) {
		const parsed = parseMessageEntry(value);
		if (parsed === null)
			throw new Error(`测试数据缺少 message 文本：${key}`);
		entries[key] = parsed;
	}
	return { locale, keys: Object.keys(messages), entries };
}

const validManifest: ManifestLike = {
	manifest_version: 3,
	default_locale: "en",
	name: "__MSG_appName__",
	version: packageVersion,
	description: "__MSG_appDesc__",
	permissions: ["storage"],
	icons: { "16": "icons/logo-16.jpg" },
	action: {
		default_popup: "popup.html",
		default_title: "__MSG_appName__",
	},
	content_scripts: [
		{
			matches: [
				"https://github.com/*",
				"https://gist.github.com/*",
			],
			js: ["content.js"],
			run_at: "document_start",
		},
	],
};

describe("extractPlaceholders", () => {
	it("collects every __MSG_key__ reference", () => {
		expect(
			extractPlaceholders("__MSG_appName__ / 汉化"),
		).toEqual(["appName"]);
		expect(
			extractPlaceholders("__MSG_a__ __MSG_a__"),
		).toEqual(["a", "a"]);
		expect(extractPlaceholders("plain")).toEqual([]);
	});
});

describe("extractMessagePlaceholders", () => {
	it("collects $NAME$ references once, in order", () => {
		expect(
			extractMessagePlaceholders(
				"Collected $COUNT$ of $TOTAL$ items",
			),
		).toEqual(["COUNT", "TOTAL"]);
		expect(
			extractMessagePlaceholders("$COUNT$ 件 / $COUNT$ 件"),
		).toEqual(["COUNT"]);
		expect(extractMessagePlaceholders("已启用")).toEqual(
			[],
		);
	});

	it("treats $$ as an escaped literal dollar sign", () => {
		expect(extractMessagePlaceholders("价格 $$5")).toEqual(
			[],
		);
		expect(extractMessagePlaceholders("$$COUNT$$")).toEqual(
			[],
		);
		expect(
			extractMessagePlaceholders("$$x$$ 与 $COUNT$"),
		).toEqual(["COUNT"]);
	});
});

describe("parseMessageEntry", () => {
	it("parses message text and declared placeholders", () => {
		expect(
			parseMessageEntry({
				message: "已收集 $COUNT$ 条",
				placeholders: { count: { content: "$1" } },
			}),
		).toEqual({
			message: "已收集 $COUNT$ 条",
			referenced: ["COUNT"],
			declared: ["count"],
		});
	});

	it("returns null when the entry has no message text", () => {
		expect(
			parseMessageEntry({ description: "只有描述" }),
		).toBeNull();
		expect(parseMessageEntry("文本")).toBeNull();
		expect(parseMessageEntry(null)).toBeNull();
	});
});

describe("extractVersionText", () => {
	it('reads the text of the class="version" element', () => {
		expect(
			extractVersionText(
				'<span class="version">0.2.0</span>',
			),
		).toBe("0.2.0");
		expect(
			extractVersionText(
				'<span id="v" class="badge version"> 1.2.3 </span>',
			),
		).toBe("1.2.3");
	});

	it("ignores non-elements and lookalike class names", () => {
		expect(
			extractVersionText(
				'<span class="versioned">x</span>',
			),
		).toBeNull();
		expect(
			extractVersionText("header .version { color: red }"),
		).toBeNull();
		expect(extractVersionText("")).toBeNull();
	});

	it("matches the shipped popup.html version with package.json", () => {
		expect(
			extractVersionText(options.popupHtml ?? ""),
		).toBe(packageVersion);
	});
});

describe("loadLocaleMessages", () => {
	it("reads the shipped locale key sets", () => {
		expect(shippedLocales.errors).toEqual([]);
		expect(
			shippedLocales.locales.map((entry) => entry.locale),
		).toEqual(["en", "ja", "zh_CN"]);
	});

	it("parses message text and placeholder declarations", () => {
		const en = shippedLocales.locales.find(
			(entry) => entry.locale === "en",
		);
		expect(en?.entries?.["devCount"]?.referenced).toEqual([
			"COUNT",
		]);
		expect(en?.entries?.["devCount"]?.declared).toEqual([
			"count",
		]);
	});

	it("reports a missing _locales directory", () => {
		const loaded = loadLocaleMessages(
			join(rootDir, "public", "__missing__"),
		);
		expect(loaded.errors).toHaveLength(1);
	});
});

describe("extractI18nKeys", () => {
	it("collects unique data-i18n keys in order", () => {
		expect(
			extractI18nKeys(
				'<h1 data-i18n="appName"></h1><p data-i18n="footer"></p><span data-i18n="appName"></span>',
			),
		).toEqual(["appName", "footer"]);
	});

	it("finds every key used by the shipped popup.html", () => {
		const keys = extractI18nKeys(options.popupHtml ?? "");
		expect(keys.length).toBeGreaterThan(5);
		const en = shippedLocales.locales.find(
			(entry) => entry.locale === "en",
		);
		for (const key of keys) {
			expect(en?.keys).toContain(key);
		}
	});
});

describe("validateLocales", () => {
	const en: LocaleMessages = {
		locale: "en",
		keys: ["appName", "devCopy"],
	};

	it("accepts identical key sets", () => {
		expect(
			validateLocales(
				[en, { locale: "ja", keys: [...en.keys] }],
				"en",
			),
		).toEqual([]);
	});

	it("reports missing and unknown keys", () => {
		const errors = validateLocales(
			[en, { locale: "ja", keys: ["appName", "extra"] }],
			"en",
		);
		expect(errors.length).toBe(2);
	});

	it("requires default_locale to exist", () => {
		expect(validateLocales([en], undefined)).toHaveLength(
			1,
		);
		expect(validateLocales([en], "de")).toHaveLength(1);
	});
});

describe("validateLocalePlaceholders", () => {
	const withCount = (message: string) => ({
		message,
		placeholders: { count: { content: "$1" } },
	});
	const en = localeOf("en", {
		devCount: withCount("Collected $COUNT$ items"),
		devCopy: { message: "Copy" },
	});
	const ja = localeOf("ja", {
		devCount: withCount("$COUNT$ 件を収集"),
		devCopy: { message: "コピー" },
	});

	it("accepts identical reference sets across locales", () => {
		expect(
			validateLocalePlaceholders([en, ja], "en"),
		).toEqual([]);
	});

	it("matches declared names case-insensitively", () => {
		expect(ja.entries?.["devCount"]?.declared).toEqual([
			"count",
		]);
	});

	it("flags a language that dropped a placeholder", () => {
		const broken = localeOf("ja", {
			devCount: withCount("件を収集"),
			devCopy: { message: "コピー" },
		});
		const errors = validateLocalePlaceholders(
			[en, broken],
			"en",
		);
		expect(errors).toHaveLength(1);
		expect(
			errors.some(
				(error) =>
					error.includes("ja") &&
					error.includes("devCount") &&
					error.includes("$COUNT$"),
			),
		).toBe(true);
	});

	it("flags a language that invented a placeholder", () => {
		const broken = localeOf("ja", {
			devCount: withCount("$COUNT$ 件 / $TOTAL$ 件"),
			devCopy: { message: "コピー" },
		});
		const errors = validateLocalePlaceholders(
			[en, broken],
			"en",
		);
		// 两条：跨语言多出 $TOTAL$，且 $TOTAL$ 没在 placeholders 里声明
		expect(errors).toHaveLength(2);
		expect(
			errors.some(
				(error) =>
					error.includes("多出占位符") &&
					error.includes("$TOTAL$"),
			),
		).toBe(true);
		expect(
			errors.some(
				(error) =>
					error.includes("placeholders") &&
					error.includes("$TOTAL$"),
			),
		).toBe(true);
	});

	it("flags a referenced placeholder with no declaration", () => {
		const undeclared = localeOf("ja", {
			devCount: { message: "$COUNT$ 件を収集" },
			devCopy: { message: "コピー" },
		});
		const errors = validateLocalePlaceholders(
			[en, undeclared],
			"en",
		);
		expect(errors).toHaveLength(1);
		expect(
			errors.some(
				(error) =>
					error.includes("ja") &&
					error.includes("placeholders") &&
					error.includes("$COUNT$"),
			),
		).toBe(true);
	});

	it("skips the declaration assertion when nobody uses placeholders", () => {
		const plainEn = localeOf("en", {
			devCount: { message: "Collected $COUNT$ items" },
		});
		const plainJa = localeOf("ja", {
			devCount: { message: "$COUNT$ 件を収集" },
		});
		expect(
			validateLocalePlaceholders([plainEn, plainJa], "en"),
		).toEqual([]);
	});

	it("is wired into validateLocales", () => {
		const broken = localeOf("ja", {
			devCount: withCount("件を収集"),
			devCopy: { message: "コピー" },
		});
		expect(
			validateLocales([en, broken], "en"),
		).toHaveLength(1);
	});

	it("accepts the shipped locales", () => {
		expect(
			validateLocalePlaceholders(
				shippedLocales.locales,
				"en",
			),
		).toEqual([]);
	});
});

describe("validateManifest", () => {
	it("accepts a complete MV3 manifest", () => {
		expect(
			validateManifest(validManifest, options),
		).toEqual([]);
	});

	it("rejects MV2 and version drift with package.json", () => {
		const errors = validateManifest(
			{
				...validManifest,
				manifest_version: 2,
				version: "9.9.9",
			},
			options,
		);
		expect(errors.length).toBe(2);
	});

	it("requires the storage permission", () => {
		const errors = validateManifest(
			{ ...validManifest, permissions: [] },
			options,
		);
		expect(
			errors.some((error) => error.includes("storage")),
		).toBe(true);
	});

	it("rejects a __MSG_ placeholder with no message behind it", () => {
		const errors = validateManifest(
			{ ...validManifest, name: "__MSG_nope__" },
			options,
		);
		expect(
			errors.some((error) =>
				error.includes("__MSG_nope__"),
			),
		).toBe(true);
	});

	it("requires default_locale once the brand uses __MSG_*__", () => {
		const { default_locale: _dropped, ...withoutDefault } =
			validManifest;
		const errors = validateManifest(
			withoutDefault,
			options,
		);
		expect(
			errors.some((error) =>
				error.includes("default_locale"),
			),
		).toBe(true);
	});

	it("requires github matches and document_start", () => {
		const errors = validateManifest(
			{
				...validManifest,
				content_scripts: [
					{
						matches: ["https://example.com/*"],
						js: ["content.js"],
						run_at: "document_idle",
					},
				],
			},
			options,
		);
		expect(errors.length).toBe(3);
	});

	it("rejects js outputs missing from the build mapping", () => {
		const errors = validateManifest(
			{
				...validManifest,
				content_scripts: [
					{
						...validManifest.content_scripts?.[0],
						js: ["mystery.js"],
					},
				],
			},
			options,
		);
		expect(
			errors.some((error) => error.includes("mystery.js")),
		).toBe(true);
	});

	it("accepts the shipped public/manifest.json", () => {
		expect(
			validateManifest(
				manifestJson as ManifestLike,
				options,
			),
		).toEqual([]);
	});

	it("rejects a popup.html version drifted from package.json", () => {
		const errors = validateManifest(validManifest, {
			...options,
			popupHtml: '<span class="version">9.9.9</span>',
		});
		expect(
			errors.some(
				(error) =>
					error.includes("popup.html") &&
					error.includes("9.9.9"),
			),
		).toBe(true);
	});

	it("skips the popup.html version assertion without that element", () => {
		// 同时把 popupSource 置空：本用例只隔离「没有 version 元素就不比对版本号」
		// 这一条，选择器校验由 validatePopupSelectors 自己的用例覆盖
		expect(
			validateManifest(validManifest, {
				...options,
				popupHtml: "<html><body></body></html>",
				popupSource: null,
			}),
		).toEqual([]);
	});

	it("skips both popup.html assertions when it cannot be read", () => {
		expect(
			validateManifest(validManifest, {
				...options,
				popupHtml: null,
			}),
		).toEqual([]);
	});

	it("maps both build outputs to existing source entries", () => {
		expect(Object.keys(BUILD_OUTPUTS).sort()).toEqual([
			"content.js",
			"popup.js",
		]);
		for (const source of Object.values(BUILD_OUTPUTS)) {
			expect(existsSync(join(rootDir, source))).toBe(true);
		}
	});
});

describe("extractPopupSelectors", () => {
	it("takes querySelector / querySelectorAll literals and dedupes them", () => {
		const source = [
			'document.querySelector<HTMLInputElement>("#toggle");',
			'document.querySelectorAll<HTMLElement>("[data-i18n]");',
			'document.querySelector("#toggle");',
		].join("\n");
		expect(extractPopupSelectors(source)).toEqual([
			"#toggle",
			"[data-i18n]",
		]);
	});
});

describe("validatePopupSelectors", () => {
	it("accepts the shipped popup.html and popup.ts", () => {
		// 锁住真实契约：popup.ts 的元素选择器全部存在于 popup.html
		expect(
			validatePopupSelectors(
				options.popupHtml ?? "",
				options.popupSource ?? "",
			),
		).toEqual([]);
	});

	it("reports an id the html does not have", () => {
		const errors = validatePopupSelectors(
			'<div id="a"></div>',
			'document.querySelector("#b");',
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain("#b");
	});

	it("reports a missing class and a missing attribute", () => {
		const errors = validatePopupSelectors(
			'<div id="a"></div>',
			'document.querySelector(".missing"); document.querySelector("[data-x]");',
		);
		expect(errors).toHaveLength(2);
	});

	it("accepts class and attribute targets found in real markup", () => {
		expect(
			validatePopupSelectors(
				'<select id="locale" class="wide"></select><div data-i18n="k"></div>',
				'document.querySelector("#locale"); document.querySelector(".wide"); document.querySelector("[data-i18n]");',
			),
		).toEqual([]);
	});

	it("reports a selector shape it cannot check statically", () => {
		// 拼出来或组合型的选择器静态看不见，宁可响亮报错也不静默放过
		const errors = validatePopupSelectors(
			"<div></div>",
			'document.querySelector("div > span");',
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain("形态");
	});
});
