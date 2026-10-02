// popup 的交互语义（popup.ts 此前从未被任何测试加载 = 零覆盖，225 行）。
//
// 为什么值得测：popup 是用户唯一能操作扩展控制的界面，而它的失效方式全是**静默**的——
// 语言选择器少一项用户就永远选不到那个语言；开关写错键名则点了没反应且不报错；
// 漏翻面板的复制 / 清空写坏只有开发者模式的人才会遇到。modules 顶层的 9 个
// assertFound 更决定了 popup.html 与 popup.js 一旦脱节就是**整页空白**。
//
// 环境：bun 没有 document / window（实测 undefined），chrome 也要自己装。这里装一套
// 最小 DOM 桩 + chrome 桩（storage 部分与 storage.test.ts 同语义），再动态 import
// 入口——它有顶层副作用（import 即渲染）。模块只加载一次，故用例按生命周期顺序
// 共享状态，不要重排。
import { describe, expect, it } from "bun:test";

// —— 最小 DOM 桩 ——

class StubElement {
	textContent = "";
	className = "";
	lang = "";
	checked = false;
	disabled = false;
	value = "";
	readonly dataset: Record<string, string> = {};
	readonly children: StubElement[] = [];
	readonly listeners = new Map<string, (() => void)[]>();
	readonly classToggles: {
		name: string;
		force: boolean | undefined;
	}[] = [];
	readonly classList = {
		toggle: (name: string, force?: boolean): void => {
			this.classToggles.push({ name, force });
		},
	};
	append(child: StubElement): void {
		this.children.push(child);
	}
	addEventListener(
		type: string,
		handler: () => void,
	): void {
		const list = this.listeners.get(type) ?? [];
		list.push(handler);
		this.listeners.set(type, list);
	}
	dispatch(type: string): void {
		for (const handler of this.listeners.get(type) ?? []) {
			handler();
		}
	}
}

const selectors = [
	"#toggle",
	"#status",
	".version",
	"#dev-toggle",
	"#dev-panel",
	"#dev-count",
	"#dev-copy",
	"#dev-clear",
	"#locale",
] as const;

const elements = new Map<string, StubElement>(
	selectors.map((selector) => [
		selector,
		new StubElement(),
	]),
);

function element(selector: string): StubElement {
	const found = elements.get(selector);
	if (found === undefined) {
		throw new Error(`测试桩缺少选择器 ${selector}`);
	}
	return found;
}

/** popup.html 里带 data-i18n 的占位；末尾那项没有键，用来覆盖防御分支 */
const i18nElements: StubElement[] = [
	"appName",
	"statusLoading",
	"hintPrivacy",
	"localeLabel",
	"localeHint",
	"devTitle",
	"devHint",
	"devCopy",
	"devClear",
	"devWarn",
	"footer",
].map((key) => {
	const node = new StubElement();
	node.dataset["i18n"] = key;
	return node;
});
const keylessElement = new StubElement();
i18nElements.push(keylessElement);

const documentElement = new StubElement();

const globals = globalThis as unknown as Record<
	string,
	unknown
>;
// 合并式挂载，不整体替换 document：walker / engine 的测试在同一进程里也装了
// document（createTreeWalker 等），整体替换会把它们的桩打掉
const documentGlobal = (globals["document"] ??
	{}) as Record<string, unknown>;
documentGlobal["title"] = "";
documentGlobal["documentElement"] = documentElement;
documentGlobal["querySelector"] = (selector: string) =>
	elements.get(selector) ?? null;
documentGlobal["querySelectorAll"] = (selector: string) =>
	selector === "[data-i18n]" ? i18nElements : [];
documentGlobal["createElement"] = () => new StubElement();
globals["document"] = documentGlobal;

// —— 时间与剪贴板 ——

const timeouts: (() => void)[] = [];
globals["window"] = {
	setTimeout: (handler: () => void) => {
		timeouts.push(handler);
		return 0;
	},
};

const clipboardWrites: string[] = [];
let clipboardFails = false;
Object.defineProperty(globalThis, "navigator", {
	value: {
		clipboard: {
			async writeText(text: string): Promise<void> {
				if (clipboardFails) {
					throw new Error("剪贴板被拒绝");
				}
				clipboardWrites.push(text);
			},
		},
	},
	configurable: true,
});

// —— chrome 桩 ——

const MESSAGES = new Map<string, string>([
	["appName", "GitHub UI Localization"],
	["statusLoading", "加载中…"],
	["statusOn", "已启用"],
	["statusOff", "已停用"],
	["hintPrivacy", "隐私说明"],
	["localeLabel", "翻译语言"],
	["localeHint", "语言说明"],
	["localeAuto", "自动"],
	["devTitle", "开发者模式"],
	["devHint", "开发者说明"],
	["devCount", "未翻译 $1 条"],
	["devCopy", "复制"],
	["devClear", "清空"],
	["devCopied", "已复制"],
	["devCopyFailed", "复制失败"],
	["devWarn", "警告"],
	["footer", "页脚"],
]);

type ChangeListener = (
	changes: Record<string, { newValue?: unknown }>,
	area: string,
) => void;

const storageData = new Map<string, unknown>([
	["enabled", true],
]);
const changeListeners: ChangeListener[] = [];

// 只挂自己需要的命名空间，**不整体替换** chrome：globalThis 跨文件共享，入口测试与
// storage 测试在同一个进程里也挂 chrome（i18n / storage），整体替换会互相打掉对方的桩
const chromeGlobal = (globals["chrome"] ?? {}) as Record<
	string,
	unknown
>;
chromeGlobal["i18n"] = {
	getUILanguage: () => "zh-CN",
	getMessage: (name: string, substitutions?: string[]) => {
		const template = MESSAGES.get(name);
		if (template === undefined) return "";
		return (substitutions ?? []).reduce(
			(acc, value, index) =>
				acc.replaceAll(`$${index + 1}`, value),
			template,
		);
	},
};
chromeGlobal["runtime"] = {
	getManifest: () => ({ version: "0.2.0" }),
};
chromeGlobal["storage"] = {
	local: {
		async get(
			key: string,
		): Promise<Record<string, unknown>> {
			return storageData.has(key)
				? { [key]: storageData.get(key) }
				: {};
		},
		async set(values: Record<string, unknown>) {
			for (const [key, value] of Object.entries(values)) {
				storageData.set(key, value);
			}
		},
		async remove(key: string) {
			storageData.delete(key);
		},
	},
	onChanged: {
		addListener(listener: ChangeListener) {
			changeListeners.push(listener);
		},
	},
};
globals["chrome"] = chromeGlobal;

function tick(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

function emit(
	changes: Record<string, { newValue?: unknown }>,
	area = "local",
): void {
	for (const listener of changeListeners) {
		listener(changes, area);
	}
}

await import("../popup.ts");
await tick();

describe("popup 的初始化渲染", () => {
	it("fills every data-i18n placeholder", () => {
		for (const node of i18nElements) {
			const key = node.dataset["i18n"];
			if (key === undefined) {
				expect(node.textContent).toBe("");
				continue;
			}
			// 每个键都在 MESSAGES 里；?? "" 只为收窄类型
			expect(node.textContent).toBe(
				MESSAGES.get(key) ?? "",
			);
		}
	});

	it("back-fills the document title and language", () => {
		const doc = globals["document"] as {
			title: string;
		};
		expect(doc.title).toBe("GitHub UI Localization");
		expect(documentElement.lang).toBe("zh-CN");
	});

	it("back-fills the version from the manifest", () => {
		expect(element(".version").textContent).toBe("0.2.0");
	});

	it("renders the stored enabled state", () => {
		expect(element("#toggle").checked).toBe(true);
		expect(element("#status").textContent).toBe("已启用");
		expect(element("#status").className).toBe("on");
	});

	it("offers 自动 plus every declared locale", () => {
		const options = element("#locale").children;
		// 自动 + zh-CN + ja
		expect(options).toHaveLength(3);
		expect(options.map((option) => option.value)).toEqual([
			"",
			"zh-CN",
			"ja",
		]);
		expect(
			options.map((option) => option.textContent),
		).toEqual(["自动", "简体中文", "日本語"]);
	});

	it("back-fills the locale selector as 自动 when unset", () => {
		expect(element("#locale").value).toBe("");
	});

	it("hides the developer panel while devMode is off", () => {
		expect(element("#dev-toggle").checked).toBe(false);
		expect(element("#dev-panel").classToggles).toEqual([
			{ name: "hidden", force: true },
		]);
	});
});

describe("popup 的翻译开关", () => {
	it("writes the new value and re-renders on change", async () => {
		const toggle = element("#toggle");
		toggle.checked = false;
		toggle.dispatch("change");
		await tick();
		expect(storageData.get("enabled")).toBe(false);
		expect(element("#status").textContent).toBe("已停用");
		expect(element("#status").className).toBe("off");
	});
});

describe("popup 的语言选择器", () => {
	it("persists a declared locale id", async () => {
		const select = element("#locale");
		select.value = "ja";
		select.dispatch("change");
		await tick();
		expect(storageData.get("locale")).toBe("ja");
	});

	it("clears the key when 自动 is selected", async () => {
		const select = element("#locale");
		select.value = "";
		select.dispatch("change");
		await tick();
		// 空值语义是「恢复自动」→ 删除该键，而不是写入空串
		expect(storageData.has("locale")).toBe(false);
	});
});

describe("popup 的开发者区块", () => {
	it("writes devMode and reveals the panel", async () => {
		const toggle = element("#dev-toggle");
		toggle.checked = true;
		toggle.dispatch("change");
		await tick();
		expect(storageData.get("devMode")).toBe(true);
		expect(
			element("#dev-panel").classToggles.at(-1),
		).toEqual({ name: "hidden", force: false });
		expect(element("#dev-count").textContent).toBe(
			"未翻译 0 条",
		);
	});

	it("refreshes the count when the log changes on disk", () => {
		emit({
			missLog: {
				newValue: [
					{
						kind: "text",
						text: "Star",
						path: "/repo",
						count: 1,
					},
					{
						kind: "text",
						text: "Fork",
						path: "/repo",
						count: 2,
					},
				],
			},
		});
		expect(element("#dev-count").textContent).toBe(
			"未翻译 2 条",
		);
	});

	it("copies the serialized log and flashes the button", async () => {
		element("#dev-copy").dispatch("click");
		await tick();
		expect(clipboardWrites).toHaveLength(1);
		expect(clipboardWrites[0]).toContain(
			'"schema": "github-zh-misses/1"',
		);
		expect(element("#dev-copy").textContent).toBe("已复制");
		expect(element("#dev-copy").disabled).toBe(true);

		// 1.5 秒后由 window.setTimeout 还原
		timeouts.at(-1)?.();
		expect(element("#dev-copy").textContent).toBe("复制");
		expect(element("#dev-copy").disabled).toBe(false);
	});

	it("reports a rejected clipboard instead of claiming success", async () => {
		clipboardFails = true;
		element("#dev-copy").dispatch("click");
		await tick();
		expect(element("#dev-copy").textContent).toBe(
			"复制失败",
		);
		clipboardFails = false;
	});

	it("clears the log and the count", async () => {
		element("#dev-clear").dispatch("click");
		await tick();
		expect(storageData.get("missLog")).toEqual([]);
		expect(element("#dev-count").textContent).toBe(
			"未翻译 0 条",
		);
	});

	it("falls back to the message key when a text is missing", () => {
		// renderMessages() 是初始化路径上最早的调用点，任何缺键都不该让 popup 空白
		MESSAGES.delete("devCount");
		const warnings: string[] = [];
		const original = console.warn;
		console.warn = (...args: unknown[]) => {
			warnings.push(args.map(String).join(" "));
		};
		try {
			element("#dev-toggle").dispatch("change");
			expect(element("#dev-count").textContent).toBe(
				"devCount",
			);
			expect(warnings.join("\n")).toContain("devCount");
		} finally {
			console.warn = original;
		}
	});
});
