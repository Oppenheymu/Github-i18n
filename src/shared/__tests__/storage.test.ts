// src/shared/storage.ts 的测试（此前零直接覆盖）。
//
// 为什么值得测：这个模块是「脏数据不进引擎」的唯一关口——storage 里的值可能来自
// 旧版本、被用户手改、或被别的扩展写坏。narrowMissLog / narrowLocale 的收窄逻辑
// 决定了脏数据是被静默丢弃还是被当成合法配置用；watchToggles / watchLocale 则决定
// 开关与语言切换会不会真的整页生效。
//
// chrome 是 content script 注入的全局：这里塞一个最小桩，覆盖 local.get/set/remove
// 与 onChanged.addListener，行为按 chrome.storage 的语义实现（get 只返回存在的键）。
import { beforeEach, describe, expect, it } from "bun:test";
import {
	effectiveLocale,
	readDevMode,
	readEnabled,
	readLocale,
	readMissLog,
	watchLocale,
	watchToggles,
	writeDevMode,
	writeEnabled,
	writeLocale,
	writeMissLog,
} from "../storage.ts";
import type { MissItem } from "../types.ts";

type ChangeListener = (
	changes: Record<string, { newValue?: unknown }>,
	area: string,
) => void;

const stub: {
	readonly data: Map<string, unknown>;
	readonly listeners: ChangeListener[];
} = { data: new Map(), listeners: [] };

function installChromeStub(): void {
	const globals = globalThis as unknown as Record<
		string,
		unknown
	>;
	// 只挂 storage 命名空间，**别整体替换 chrome**：bun test 的 globalThis 跨文件
	// 共享，入口测试与 popup 测试在同一个进程里也挂 chrome.i18n / chrome.runtime，
	// 整体替换会把它们的桩打掉（实测：storage 用例会成片失败）
	const chromeStub = (globals["chrome"] ?? {}) as Record<
		string,
		unknown
	>;
	chromeStub["storage"] = {
		local: {
			async get(
				key: string,
			): Promise<Record<string, unknown>> {
				return stub.data.has(key)
					? { [key]: stub.data.get(key) }
					: {};
			},
			async set(values: Record<string, unknown>) {
				for (const [key, value] of Object.entries(values)) {
					stub.data.set(key, value);
				}
			},
			async remove(key: string) {
				stub.data.delete(key);
			},
		},
		onChanged: {
			addListener(listener: ChangeListener) {
				stub.listeners.push(listener);
			},
		},
	};
	globals["chrome"] = chromeStub;
}

/** 模拟一次 storage.onChanged 通知 */
function emitChange(
	changes: Record<string, { newValue?: unknown }>,
	area = "local",
): void {
	for (const listener of stub.listeners) {
		listener(changes, area);
	}
}

beforeEach(() => {
	stub.data.clear();
	stub.listeners.length = 0;
	installChromeStub();
});

describe("readEnabled / readDevMode", () => {
	it("defaults the translation toggle to on", async () => {
		expect(await readEnabled()).toBe(true);
		await writeEnabled(false);
		expect(await readEnabled()).toBe(false);
		await writeEnabled(true);
		expect(await readEnabled()).toBe(true);
	});

	it("defaults the developer mode to off", async () => {
		expect(await readDevMode()).toBe(false);
		await writeDevMode(true);
		expect(await readDevMode()).toBe(true);
	});

	it("treats dirty values as the default instead of throwing", async () => {
		stub.data.set("enabled", "yes");
		stub.data.set("devMode", 1);
		expect(await readEnabled()).toBe(true);
		expect(await readDevMode()).toBe(false);
	});
});

describe("readLocale", () => {
	it("returns the stored locale, or null for automatic", async () => {
		expect(await readLocale()).toBeNull();
		await writeLocale("ja");
		expect(await readLocale()).toBe("ja");
		// 传 null = 恢复自动：键被删除，而不是存一个 null
		await writeLocale(null);
		expect(await readLocale()).toBeNull();
		expect(stub.data.has("locale")).toBe(false);
	});

	it("narrows undeclared locale ids to automatic", async () => {
		stub.data.set("locale", "fr");
		expect(await readLocale()).toBeNull();
		stub.data.set("locale", 42);
		expect(await readLocale()).toBeNull();
	});

	it("resolves the effective locale from the browser language", () => {
		expect(effectiveLocale("ja", "en-US")).toBe("ja");
		expect(effectiveLocale(null, "ja-JP")).toBe("ja");
		expect(effectiveLocale(null, "zh-Hans-CN")).toBe(
			"zh-CN",
		);
		expect(effectiveLocale(null, "en-US")).toBe("zh-CN");
	});
});

describe("readMissLog", () => {
	it("keeps only structurally valid entries", async () => {
		stub.data.set("missLog", [
			{ kind: "text", text: "Save", path: "/x", count: 2 },
			// 非法 kind
			{ kind: "nope", text: "Save", path: "/x", count: 1 },
			// 空文本
			{ kind: "text", text: "", path: "/x", count: 1 },
			// count 必须 >= 1 且有限
			{ kind: "title", text: "Star", path: "/x", count: 0 },
			{
				kind: "alt",
				text: "Logo",
				path: "/x",
				count: Number.NaN,
			},
			// path 必须是字符串
			{ kind: "text", text: "Save", path: 7, count: 1 },
			// 多余字段无害，但不会被带进结果
			{
				kind: "placeholder",
				text: "Search",
				path: "/y",
				count: 3,
				extra: 1,
			},
			"not an object",
			null,
		]);
		expect(await readMissLog()).toEqual([
			{ kind: "text", text: "Save", path: "/x", count: 2 },
			{
				kind: "placeholder",
				text: "Search",
				path: "/y",
				count: 3,
			},
		] satisfies MissItem[]);
	});

	it("treats non-array and missing values as empty", async () => {
		expect(await readMissLog()).toEqual([]);
		stub.data.set("missLog", { kind: "text" });
		expect(await readMissLog()).toEqual([]);
	});

	it("round-trips through writeMissLog", async () => {
		const items: MissItem[] = [
			{ kind: "text", text: "Save", path: "/x", count: 1 },
		];
		await writeMissLog(items);
		expect(await readMissLog()).toEqual(items);
	});
});

describe("watchToggles", () => {
	it("reports boolean changes in the local area only", () => {
		const seen: [string, boolean][] = [];
		watchToggles((key, value) => {
			seen.push([key, value]);
		});
		emitChange({ enabled: { newValue: false } });
		emitChange({ devMode: { newValue: true } });
		// 脏数据（非布尔）忽略
		emitChange({ enabled: { newValue: "yes" } });
		// 非 local 区忽略
		emitChange({ enabled: { newValue: true } }, "sync");
		// 与本次无关的键忽略
		emitChange({ missLog: { newValue: [] } });
		expect(seen).toEqual([
			["enabled", false],
			["devMode", true],
		]);
	});
});

describe("watchLocale", () => {
	it("reports the narrowed locale for local changes", () => {
		const seen: (string | null)[] = [];
		watchLocale((locale) => {
			seen.push(locale);
		});
		emitChange({ locale: { newValue: "ja" } });
		// 未声明的 id 按「自动」处理
		emitChange({ locale: { newValue: "fr" } });
		// 删除该键（恢复自动）也是 null
		emitChange({ locale: { newValue: undefined } });
		emitChange({ locale: { newValue: "ja" } }, "sync");
		expect(seen).toEqual(["ja", null, null]);
	});
});
