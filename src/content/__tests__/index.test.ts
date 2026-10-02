// content script 入口的装配语义（index.ts，此前从未被任何测试加载 = 零覆盖）。
//
// 为什么值得测：这是扩展的启动路径，条件写错都是**静默失效**——
//   1. enabled 为 false 时仍启动观察器 → 用户关了开关却还在翻；
//   2. 开关 / 语言变化不触发整页刷新 → popup 里切了没反应，或者旧语言的词典视图
//      继续挂在页面上（「换语言后一半旧译」）；
//   3. 目标语言解析错 → 整站用错词典，且不报任何错（本文件用「Star 真的被译成
//      星标」端到端钉住它）。
//
// 环境：bun 没有 chrome / document / location / window / MutationObserver（实测
// undefined），故全部装桩后**动态 import**——入口有顶层副作用，import 即启动。
//
// 两个必须遵守的约束（都是实测踩出来的）：
//   a. **不要用 mock.module**：它是进程级的，注册的 mock 会泄漏给同一进程里的
//      其他测试文件（实测把 walker / pages 的真实导出顶掉，成片页面测试变红）；
//   b. **所有全局桩都合并挂载、绝不整体替换**：globalThis 跨文件共享，整体替换
//      会把 storage.test.ts 的 chrome.storage 之类的桩打掉。
// 入口模块一个进程只会装配一次，故「enabled=false 不启动」这条反向条件无法在本
// 仓库里再开一个文件验证（姊妹文件会因模块缓存而复用第一次的装配结果）。该闸门
// 由 engine.test.ts 的「关闭时只清空队列不翻译」与 readEnabled 的默认值把守。
import { describe, expect, it } from "bun:test";
import {
	installDomStubs,
	StubElement,
} from "./stub-dom.ts";

class StubObserver {
	static readonly instances: StubObserver[] = [];
	readonly observed: { target: unknown }[] = [];
	disconnected = false;
	constructor(
		_callback: (records: MutationRecord[]) => void,
	) {
		StubObserver.instances.push(this);
	}
	observe(target: unknown): void {
		this.observed.push({ target });
	}
	disconnect(): void {
		this.disconnected = true;
	}
}

type ChangeListener = (
	changes: Record<string, { newValue?: unknown }>,
	area: string,
) => void;

const storageData = new Map<string, unknown>([
	["enabled", true],
	["devMode", true],
]);
const changeListeners: ChangeListener[] = [];
const reloads: string[] = [];
const intervals: unknown[][] = [];
const documentListeners: string[] = [];
const windowListeners: string[] = [];

const documentElement = new StubElement("html");
const rootText = documentElement.addText("Star");

const globals = globalThis as unknown as Record<
	string,
	unknown
>;

// DOM 桩与 walker / engine 共用一份（见 stub-dom.ts 的说明）
installDomStubs();
globals["MutationObserver"] = StubObserver;
globals["setInterval"] = (...args: unknown[]) => {
	intervals.push(args);
	return 0;
};
globals["location"] = {
	pathname: "/microsoft/vscode",
	reload: () => {
		reloads.push("reload");
	},
};
globals["window"] = {
	addEventListener(type: string) {
		windowListeners.push(type);
	},
};

// —— chrome：只补 i18n 与 storage，不整体替换 ——
const chromeGlobal = (globals["chrome"] ?? {}) as Record<
	string,
	unknown
>;
chromeGlobal["i18n"] = { getUILanguage: () => "zh-CN" };
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

// —— document：合并挂载，保留 installDomStubs 装的 createTreeWalker ——
const documentGlobal = (globals["document"] ??
	{}) as Record<string, unknown>;
documentGlobal["documentElement"] = documentElement;
documentGlobal["visibilityState"] = "visible";
documentGlobal["addEventListener"] = (type: string) => {
	documentListeners.push(type);
};
globals["document"] = documentGlobal;

/** 排空微任务，等 bootstrap 的 await 链跑完 */
function flush(): Promise<void> {
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

await import("../index.ts");
await flush();

describe("content 入口的启动装配", () => {
	it("writes the identity marker synchronously at import time", () => {
		const marker = (
			globalThis as unknown as Record<string, unknown>
		)["__githubI18nContent"];
		expect(marker).toBe("github-i18n/content");
	});

	it("starts observing the document element once enabled", () => {
		const observer = StubObserver.instances[0];
		expect(observer).toBeDefined();
		// 关闭状态下不该有任何 observe 调用（见文件头对反向条件的说明）
		expect(observer?.observed).toHaveLength(1);
		expect(observer?.observed[0]?.target).toBe(
			documentElement,
		);
	});

	it("resolves the target locale from the browser language", () => {
		// storage 里没有 locale 键 → 自动 → chrome.i18n.getUILanguage() 是 zh-CN。
		// 解析错语言时这条会保持英文，而实机上不会有任何报错。
		expect(rootText.nodeValue).toBe("星标");
	});

	it("installs the developer-mode auto flush and its unload hooks", () => {
		expect(intervals).toHaveLength(1);
		expect(intervals[0]?.[1]).toBe(5000);
		expect(documentListeners).toContain("visibilitychange");
		expect(windowListeners).toContain("pagehide");
	});
});

describe("content 入口的整页刷新联动", () => {
	it("reloads when the enabled toggle actually changes", () => {
		const before = reloads.length;
		emit({ enabled: { newValue: false } });
		expect(reloads.length).toBe(before + 1);
	});

	it("ignores a toggle notification carrying the current value", () => {
		// 模块内的 enabled 不会随 storage 变化（生效手段是整页刷新），
		// 故再次收到同一个值时必须不刷新，否则会陷入刷新循环
		const before = reloads.length;
		emit({ enabled: { newValue: true } });
		expect(reloads.length).toBe(before);
	});

	it("reloads when the developer toggle changes", () => {
		const before = reloads.length;
		emit({ devMode: { newValue: false } });
		expect(reloads.length).toBe(before + 1);
	});

	it("reloads when the target locale changes", () => {
		const before = reloads.length;
		emit({ locale: { newValue: "ja" } });
		expect(reloads.length).toBe(before + 1);
	});

	it("ignores a locale notification resolving back to 自动", () => {
		// selectedLocale 是 null（自动），收到 null 不该刷新
		const before = reloads.length;
		emit({ locale: { newValue: null } });
		expect(reloads.length).toBe(before);
	});

	it("ignores changes coming from another storage area", () => {
		const before = reloads.length;
		emit({ enabled: { newValue: false } }, "sync");
		expect(reloads.length).toBe(before);
	});
});
