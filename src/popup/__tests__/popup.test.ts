// popup 的交互语义（popup.ts 此前从未被任何测试加载 = 零覆盖，225 行）。
//
// 为什么用**真实的 popup.html + 真实 DOM**：popup 的失效方式有两层——
//   ① 逻辑写错（开关没写回 storage、语言选择器少一项）；
//   ② **结构与代码脱节**：popup.ts 顶层的 assertFound 在缺元素时直接抛错，popup
//      整页空白，而 popup.html 与 popup.ts 分属两类文件。用手写桩 DOM 时，桩里的
//      选择器列表是**抄**来的——HTML 改了测试照样全绿。改用 happy-dom 直接加载
//      仓库里的 public/popup.html，这条契约就被真正锁住了（另有一条零依赖门禁
//      check:manifest 的 validatePopupSelectors 对同一契约做静态校验：一道锁结构、
//      一道锁行为）。
//
// 环境：bun 没有 document / window（实测 undefined），故用 test-support/dom.ts 装一套
// **真实 DOM**（happy-dom，含 MutationObserver / createTreeWalker，均为规范语义）；
// chrome 是扩展侧注入的全局，仍需自桩，且**只补自己的命名空间、不整体替换**
// （bun test 的 globalThis 跨文件共享，见 AGENTS.md 已知坑）。
//
// 覆盖边界：popup.ts 末尾的 `try { main() } catch`（最外层兜底）在本仓库里**测不到**——
// popup.ts 的顶层副作用一个进程只跑一次，姊妹文件会因模块缓存而复用第一次的装配结果，
// 造不出第二个「main() 抛错」的装配场景（与 index.test.ts 的 enabled=false 同理）。
// 它是纯粹的兜底分支，代价可接受；真要覆盖得让模块可重复装配，那是另一件事。
import { afterAll, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { installDom } from "../../test-support/dom.ts";

const rootDir = join(import.meta.dir, "..", "..", "..");
// DOM 环境与其他用例共用一份（见 test-support/dom.ts 的说明）
const env = installDom();
const dom = env.window;
const document = env.document;

afterAll(() => {
	env.restore();
});

document.write(
	readFileSync(
		join(rootDir, "public", "popup.html"),
		"utf8",
	),
);

/** 取元素；找不到即测试桩自身有问题（真实 HTML 缺元素会先被 check:manifest 拦住） */
function element(selector: string): HTMLElement {
	const found = document.querySelector(selector);
	if (found === null) {
		throw new Error(`popup.html 里没有 ${selector}`);
	}
	return found as HTMLElement;
}

function input(selector: string): HTMLInputElement {
	return element(selector) as HTMLInputElement;
}

function fire(selector: string, type: string): void {
	element(selector).dispatchEvent(env.createEvent(type));
}

// —— 时间与剪贴板 ——

const timeouts: (() => void)[] = [];
// flashCopyButton 的 1.5 秒还原：记录下来手动触发，别让用例真等
(dom as unknown as Record<string, unknown>)["setTimeout"] =
	(handler: () => void) => {
		timeouts.push(handler);
		return 0;
	};

const clipboardWrites: string[] = [];
let clipboardFails = false;

// —— chrome 桩（合并挂载） ——

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

const globals = globalThis as unknown as Record<
	string,
	unknown
>;
// window / document 由 installDom 装好，这里只补扩展侧注入的 navigator
globals["navigator"] = {
	clipboard: {
		async writeText(text: string): Promise<void> {
			if (clipboardFails) throw new Error("剪贴板被拒绝");
			clipboardWrites.push(text);
		},
	},
};

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
	it("fills every data-i18n placeholder the html declares", () => {
		const nodes = [
			...document.querySelectorAll<HTMLElement>(
				"[data-i18n]",
			),
		];
		// 真实 HTML 里现有 11 处；数量变化本身就该进测试视野
		expect(nodes.length).toBe(11);
		// #status 是**双重身份**元素：HTML 里它的兜底文案是 statusLoading，但启动
		// 后立刻被开关状态覆写（statusOn / statusOff）。它的语义由下面的
		// 「renders the stored enabled state」专门覆盖——用手写桩时这两个身份被拆成
		// 两个对象，这条真实约束反而看不见了
		const placeholders = nodes.filter(
			(node) => node.id !== "status",
		);
		expect(placeholders.length).toBe(10);
		for (const node of placeholders) {
			const key = node.dataset["i18n"];
			expect(key).toBeDefined();
			expect(node.textContent).toBe(
				MESSAGES.get(key ?? "") ?? "",
			);
		}
	});

	it("back-fills the document title and language", () => {
		expect(document.title).toBe("GitHub UI Localization");
		expect(document.documentElement.lang).toBe("zh-CN");
	});

	it("back-fills the version from the manifest", () => {
		expect(element(".version").textContent).toBe("0.2.0");
	});

	it("renders the stored enabled state", () => {
		expect(input("#toggle").checked).toBe(true);
		expect(element("#status").textContent).toBe("已启用");
		expect(element("#status").className).toBe("on");
	});

	it("offers 自动 plus every declared locale", () => {
		const options = [
			...document.querySelectorAll<HTMLOptionElement>(
				"#locale option",
			),
		];
		// 自动 + zh-CN + ja
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
		expect(
			(element("#locale") as HTMLSelectElement).value,
		).toBe("");
	});

	it("hides the developer panel while devMode is off", () => {
		expect(input("#dev-toggle").checked).toBe(false);
		// 真实 classList：断言的是 HTML 里那个 class 的最终状态
		expect(
			element("#dev-panel").classList.contains("hidden"),
		).toBe(true);
	});
});

describe("popup 的翻译开关", () => {
	it("writes the new value and re-renders on change", async () => {
		input("#toggle").checked = false;
		fire("#toggle", "change");
		await tick();
		expect(storageData.get("enabled")).toBe(false);
		expect(element("#status").textContent).toBe("已停用");
		expect(element("#status").className).toBe("off");
	});
});

describe("popup 的语言选择器", () => {
	it("persists a declared locale id", async () => {
		const select = element("#locale") as HTMLSelectElement;
		select.value = "ja";
		fire("#locale", "change");
		await tick();
		expect(storageData.get("locale")).toBe("ja");
	});

	it("clears the key when 自动 is selected", async () => {
		const select = element("#locale") as HTMLSelectElement;
		select.value = "";
		fire("#locale", "change");
		await tick();
		// 空值语义是「恢复自动」→ 删除该键，而不是写入空串
		expect(storageData.has("locale")).toBe(false);
	});
});

describe("popup 的开发者区块", () => {
	it("writes devMode and reveals the panel", async () => {
		input("#dev-toggle").checked = true;
		fire("#dev-toggle", "change");
		await tick();
		expect(storageData.get("devMode")).toBe(true);
		expect(
			element("#dev-panel").classList.contains("hidden"),
		).toBe(false);
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
		fire("#dev-copy", "click");
		await tick();
		expect(clipboardWrites).toHaveLength(1);
		expect(clipboardWrites[0]).toContain(
			'"schema": "github-zh-misses/1"',
		);
		const copy = element("#dev-copy") as HTMLButtonElement;
		expect(copy.textContent).toBe("已复制");
		expect(copy.disabled).toBe(true);

		// 1.5 秒后由 window.setTimeout 还原
		timeouts.at(-1)?.();
		expect(copy.textContent).toBe("复制");
		expect(copy.disabled).toBe(false);
	});

	it("reports a rejected clipboard instead of claiming success", async () => {
		clipboardFails = true;
		fire("#dev-copy", "click");
		await tick();
		expect(element("#dev-copy").textContent).toBe(
			"复制失败",
		);
		clipboardFails = false;
	});

	it("clears the log and the count", async () => {
		fire("#dev-clear", "click");
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
			fire("#dev-toggle", "change");
			expect(element("#dev-count").textContent).toBe(
				"devCount",
			);
			expect(warnings.join("\n")).toContain("devCount");
		} finally {
			console.warn = original;
		}
	});
});
