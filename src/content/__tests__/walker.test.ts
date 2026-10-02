import { describe, expect, it } from "bun:test";
import type { DictView } from "../../shared/types.ts";
import { translateText, translateTree } from "../walker.ts";
import {
	installDomStubs,
	StubElement,
} from "./stub-dom.ts";

const view: DictView = {
	entries: new Map([
		["Star", "星标"],
		["Fork", "复刻"],
		["Collaborators", "协作者"],
	]),
	aliases: new Map([
		// 上游把 Sign in with GitHub 改成 Sign in to GitHub 的场景
		["Sign in with GitHub", "Sign in to GitHub"],
		["Collaborators", "Collaborators"],
	]),
	rules: [
		{
			pattern: /^(\d+) minutes? ago$/,
			replacement: "$1 分钟前",
		},
		{ pattern: /^([\d,]+) Open$/, replacement: "$1 打开" },
	],
};

describe("translateText", () => {
	it("maps exact static entries", () => {
		expect(translateText("Star", view)).toBe("星标");
		expect(translateText("Fork", view)).toBe("复刻");
	});

	it("matches keys case-sensitively", () => {
		expect(translateText("star", view)).toBeNull();
	});

	it("falls back to the alias map when the direct lookup misses", () => {
		const aliased: DictView = {
			...view,
			entries: new Map([
				...view.entries,
				["Sign in to GitHub", "使用 GitHub 登录"],
			]),
		};
		expect(
			translateText("Sign in with GitHub", aliased),
		).toBe("使用 GitHub 登录");
		// 直查命中时不走别名：别名源与键同名时以直查译文为准
		expect(translateText("Star", aliased)).toBe("星标");
	});

	it("prefers a direct entry over an alias pointing at itself", () => {
		expect(translateText("Collaborators", view)).toBe(
			"协作者",
		);
	});

	it("applies the first matching regex rule", () => {
		expect(translateText("3 minutes ago", view)).toBe(
			"3 分钟前",
		);
		expect(translateText("1 minute ago", view)).toBe(
			"1 分钟前",
		);
		expect(translateText("128 Open", view)).toBe(
			"128 打开",
		);
	});

	it("collapses surrounding and inner whitespace before matching", () => {
		// GitHub React 页面的文本节点常带首尾空白与换行缩进
		expect(translateText("  Star  ", view)).toBe("星标");
		expect(translateText("3\n   minutes ago", view)).toBe(
			"3 分钟前",
		);
		expect(translateText("Fork\n            ", view)).toBe(
			"复刻",
		);
	});

	it("returns null when nothing matches", () => {
		expect(translateText("Unknown", view)).toBeNull();
	});

	it("skips text that fails the translatable check", () => {
		expect(translateText("已翻译", view)).toBeNull();
		expect(translateText("", view)).toBeNull();
		expect(translateText("a".repeat(501), view)).toBeNull();
	});

	it("prefers the static dictionary over rules", () => {
		const overlapping: DictView = {
			entries: new Map([["2 minutes ago", "两分钟前"]]),
			aliases: new Map(),
			rules: view.rules,
		};
		expect(
			translateText("2 minutes ago", overlapping),
		).toBe("两分钟前");
	});

	// —— 模板展开：命名引用、默认值引用与位置引用 ——
	// 这三条锁的是 expandTemplate 的实现细节——用 `String#replace(pattern, 模板)` 是错的，
	// 因为 (a) `$<count:1>` 会被当成 `$<count>` + 字面量 `:1`；
	// (b) 函数式 replace 的**返回值不再展开 `$<name>`**（实测），会把 `$<count>` 写进页面。
	const templateView: DictView = {
		entries: new Map(),
		aliases: new Map(),
		rules: [
			{
				// 冠词由非捕获组吃掉，数字进命名组；冠词分支靠 `$<count:1>` 补出 1
				pattern: /^(?:an? |(?<count>\d+) )minutes? ago$/,
				replacement: "不到 $<count:1> 分钟前",
			},
			{
				pattern: /^(\d+) files?$/,
				replacement: "$1 个文件",
			},
		],
	};

	it("expands a named group when it participated in the match", () => {
		expect(
			translateText("2 minutes ago", templateView),
		).toBe("不到 2 分钟前");
		expect(
			translateText("12 minutes ago", templateView),
		).toBe("不到 12 分钟前");
	});

	it("falls back to the template default when the group did not participate", () => {
		expect(
			translateText("a minute ago", templateView),
		).toBe("不到 1 分钟前");
		expect(
			translateText("an minute ago", templateView),
		).toBe("不到 1 分钟前");
	});

	it("still expands positional references", () => {
		expect(translateText("3 files", templateView)).toBe(
			"3 个文件",
		);
	});
});

describe("translateTree 的同值写入守卫", () => {
	// DOM 桩与 engine 的测试共用一份（stub-dom.ts）：`root instanceof Element` 比的是
	// 类身份，两个测试文件各装一份会互相顶掉（见该文件头部的说明）
	installDomStubs();

	/** 译文与原文同形：这正是让 /settings/profile 卡死的形态 */
	const selfIdentical: DictView = {
		entries: new Map([["ORCID iD", "ORCID iD"]]),
		aliases: new Map(),
		rules: [],
	};

	it("skips writing when the translation equals the current value", () => {
		const root = new StubElement("div");
		const node = root.addText("ORCID iD");
		const replaced = translateTree(
			root as unknown as Node,
			selfIdentical,
		);
		expect(replaced).toBe(0);
		// 关键断言：一次赋值都没发生（同值写入也会产生 characterData 记录，
		// 观察器会把它再入队，于是微任务队列无限自转）
		expect(node.writes).toEqual([]);
		expect(node.nodeValue).toBe("ORCID iD");
	});

	it("still writes when the translation differs", () => {
		const root = new StubElement("div");
		const node = root.addText("Star");
		const replaced = translateTree(
			root as unknown as Node,
			view,
		);
		expect(replaced).toBe(1);
		expect(node.writes).toEqual(["星标"]);
		// 第二轮：已是译文，不再产生任何写入（收敛）
		expect(
			translateTree(root as unknown as Node, view),
		).toBe(0);
		expect(node.writes).toHaveLength(1);
	});

	// —— 按钮类 <input> 的 value 翻译（Rails 表单按钮的可见文案在 value 上）——
	const buttonView: DictView = {
		entries: new Map([
			["Save Trending settings", "保存趋势设置"],
			["Update contact information", "更新联系信息"],
		]),
		aliases: new Map(),
		rules: [],
	};

	/** 造一个 <input>，复刻 `<input type="submit" value="…">` 的形态 */
	function makeInput(
		attrs: Record<string, string>,
	): StubElement {
		const element = new StubElement("input");
		for (const [name, value] of Object.entries(attrs)) {
			element.setAttribute(name, value);
		}
		return element;
	}

	it("translates value on button-like inputs", () => {
		const element = makeInput({
			type: "submit",
			name: "commit",
			value: "Save Trending settings",
			"data-disable-with": "Save Trending settings",
			class: "btn",
		});
		translateTree(element as unknown as Node, buttonView);
		expect(element.getAttribute("value")).toBe(
			"保存趋势设置",
		);
		// Rails 提交期间会把 value 换成 data-disable-with 的内容，同样要翻
		expect(element.getAttribute("data-disable-with")).toBe(
			"保存趋势设置",
		);
		// 其余属性原样保留
		expect(element.getAttribute("name")).toBe("commit");
		expect(element.getAttribute("class")).toBe("btn");
	});

	it("leaves text input values untouched", () => {
		const element = makeInput({
			type: "text",
			name: "user[blog]",
			value: "Save Trending settings",
		});
		translateTree(element as unknown as Node, buttonView);
		expect(element.getAttribute("value")).toBe(
			"Save Trending settings",
		);
	});

	it("leaves value alone when the input has no type", () => {
		const element = makeInput({
			value: "Save Trending settings",
		});
		translateTree(element as unknown as Node, buttonView);
		expect(element.getAttribute("value")).toBe(
			"Save Trending settings",
		);
	});

	it("leaves unknown button labels alone", () => {
		const element = makeInput({
			type: "submit",
			value: "Not in the dictionary",
		});
		translateTree(element as unknown as Node, buttonView);
		expect(element.getAttribute("value")).toBe(
			"Not in the dictionary",
		);
	});

	// —— 被排除的表单控件仍翻其属性（内容照旧保护）——
	/** 首页 Copilot 对话输入框的两条文案（2026-10-02 实机 HTML 的逐字原文） */
	const copilotView: DictView = {
		entries: new Map([
			[
				"Ask anything or type @ to add context",
				"问点什么，或输入 @ 用 Copilot 添加上下文",
			],
			[
				"Ask anything or type @ to add context with Copilot",
				"问点什么，或输入 @ 用 Copilot 添加上下文",
			],
		]),
		aliases: new Map(),
		rules: [],
	};

	it("translates placeholder and aria-label on an excluded textarea", () => {
		const element = new StubElement("textarea");
		element.setAttribute(
			"placeholder",
			"Ask anything or type @ to add context",
		);
		element.setAttribute(
			"aria-label",
			"Ask anything or type @ to add context with Copilot",
		);
		// textarea 的内容是**用户输入**：即便它是词条也必须保持原样
		const typed = element.addText(
			"Ask anything or type @ to add context",
		);
		translateTree(element as unknown as Node, copilotView);
		expect(element.getAttribute("placeholder")).toBe(
			"问点什么，或输入 @ 用 Copilot 添加上下文",
		);
		expect(element.getAttribute("aria-label")).toBe(
			"问点什么，或输入 @ 用 Copilot 添加上下文",
		);
		expect(typed.nodeValue).toBe(
			"Ask anything or type @ to add context",
		);
	});

	it("still skips non-form excluded containers entirely", () => {
		// 排除清单里除表单控件外的标签（code / pre / .markdown-body…）连属性都不碰：
		// 那条口子只为「属性是 UI 文案、内容是用户输入」的表单控件开（见 filters.ts）
		const code = new StubElement("code");
		code.setAttribute(
			"title",
			"Ask anything or type @ to add context",
		);
		const root = new StubElement("div");
		root.append(code);
		translateTree(root as unknown as Node, copilotView);
		expect(code.getAttribute("title")).toBe(
			"Ask anything or type @ to add context",
		);
	});

	it("handles an excluded textarea as the traversal root", () => {
		// 属性变化会在引擎里把**元素本身**入队（childList 的 target 是父元素，
		// 但 translateTree 也可能直接收到被排除的元素），此时属性同样要翻
		const element = new StubElement("textarea");
		element.setAttribute(
			"placeholder",
			"Ask anything or type @ to add context",
		);
		translateTree(element as unknown as Node, copilotView);
		expect(element.getAttribute("placeholder")).toBe(
			"问点什么，或输入 @ 用 Copilot 添加上下文",
		);
	});
});

describe("引擎的属性观察加固", () => {
	it("observes value attributes so a rewritten label gets retranslated", async () => {
		// 记录 observe 的配置：value 文案来自属性，页面（Turbo 快照 /
		// data-disable-with）改回英文时必须能再次触发翻译
		const calls: MutationObserverInit[] = [];
		const g = globalThis as unknown as Record<
			string,
			unknown
		>;
		const previous = g["MutationObserver"];
		g["MutationObserver"] = class {
			constructor(_callback: unknown) {
				void _callback;
			}
			observe(
				_root: unknown,
				options: MutationObserverInit,
			) {
				calls.push(options);
			}
			disconnect() {}
		};
		try {
			const { TranslationEngine } = await import(
				"../engine.ts"
			);
			const engine = new TranslationEngine({
				getView: () => ({
					entries: new Map(),
					aliases: new Map(),
					rules: [],
				}),
				isEnabled: () => false,
			});
			engine.start({} as unknown as Node);
			expect(calls).toHaveLength(1);
			expect(calls[0]?.attributes).toBe(true);
			expect(calls[0]?.attributeFilter).toEqual([
				"value",
				"data-disable-with",
			]);
			expect(calls[0]?.characterData).toBe(true);
		} finally {
			g["MutationObserver"] = previous;
		}
	});
});
