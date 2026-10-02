// walker.ts 的两层语义：纯函数 translateText（无 DOM）与 translateTree（真实遍历）。
//
// translateTree 的部分改用**真实 DOM**（happy-dom，见 test-support/dom.ts），因为
// 它的正确性一半挂在 DOM 行为上：`closest` 的选择器语义、TreeWalker 对
// `FILTER_REJECT` 的「整棵子树跳过」、`setAttribute` 是否真的写回、以及**写回本身
// 会不会产生变更记录**（同值写入也产生记录，见下）。手写桩只能近似这些行为——
// 旧桩的 `closest` 只认 `.class` 与标签名，选择器写复杂一点就静默失配。
import {
	afterAll,
	beforeAll,
	describe,
	expect,
	it,
} from "bun:test";
import type { DictView } from "../../shared/types.ts";
import {
	type DomEnvironment,
	installDom,
} from "../../test-support/dom.ts";
import { translateText, translateTree } from "../walker.ts";

let env: DomEnvironment;

beforeAll(() => {
	env = installDom();
});

afterAll(() => {
	env.restore();
});

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

/** 造一个已挂进文档的根（`closest` 会往上走到 body，故必须是真实树） */
function makeRoot(): HTMLElement {
	const root = env.document.createElement("div");
	env.document.body.appendChild(root);
	return root;
}

function makeText(parent: Node, value: string): Text {
	const node = env.document.createTextNode(value);
	parent.appendChild(node);
	return node;
}

interface WriteProbe {
	/** translateTree 报出的替换次数 */
	readonly result: number;
	/** 期间真实产生的变更记录（不是「调用了几次赋值」，是 DOM 真的变了没有） */
	readonly records: MutationRecord[];
}

/** 挂一个真实旁观观察器跑一次改动：记录数为 0 才是「真的没写」 */
async function probeWrites(
	root: Node,
	run: () => number,
): Promise<WriteProbe> {
	const records: MutationRecord[] = [];
	const spy = env.createObserver((batch) => {
		records.push(...batch);
	});
	spy.observe(root, {
		childList: true,
		subtree: true,
		characterData: true,
		attributes: true,
	});
	const result = run();
	await env.tick();
	spy.disconnect();
	return { result, records };
}

describe("translateTree 的同值写入守卫", () => {
	/** 译文与原文同形：这正是让 /settings/profile 卡死的形态 */
	const selfIdentical: DictView = {
		entries: new Map([["ORCID iD", "ORCID iD"]]),
		aliases: new Map(),
		rules: [],
	};

	it("skips writing when the translation equals the current value", async () => {
		const root = makeRoot();
		const node = makeText(root, "ORCID iD");
		const { result, records } = await probeWrites(
			root,
			() => translateTree(root, selfIdentical),
		);
		expect(result).toBe(0);
		// 关键断言：一条变更记录都没有。同值写入在规范里**也**产生 characterData
		// 记录，观察器会把它再入队，于是「命中 → 写入 → 再命中」在微任务队列里
		// 无限自转（引擎侧的端到端收敛用例见 engine.test.ts）
		expect(records).toEqual([]);
		expect(node.nodeValue).toBe("ORCID iD");
	});

	it("still writes when the translation differs", async () => {
		const root = makeRoot();
		const node = makeText(root, "Star");
		const first = await probeWrites(root, () =>
			translateTree(root, view),
		);
		expect(first.result).toBe(1);
		expect(first.records).toHaveLength(1);
		expect(node.nodeValue).toBe("星标");

		// 第二轮：已是译文，不再产生任何写入（收敛）
		const second = await probeWrites(root, () =>
			translateTree(root, view),
		);
		expect(second.result).toBe(0);
		expect(second.records).toEqual([]);
	});

	it("translates attributes on the traversal root itself", () => {
		// TreeWalker 的过滤器**不作用于 root**（DOM 规范里 root 只是遍历的起点与
		// 边界，`nextNode()` 永远不会把它交给过滤器），而属性变更记录的 target 恰恰
		// 是**元素本身**。这条只有真实 DOM 测得出来——手写桩会把 root 也过一遍
		// 过滤器，于是「页面把 value 改回英文后不再重翻」这个缺口永远是绿的。
		const link = env.document.createElement("a");
		link.setAttribute("aria-label", "Star");
		translateTree(link, view);
		expect(link.getAttribute("aria-label")).toBe("星标");
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
	): HTMLInputElement {
		const element = env.document.createElement("input");
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
		translateTree(element, buttonView);
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
		translateTree(element, buttonView);
		expect(element.getAttribute("value")).toBe(
			"Save Trending settings",
		);
	});

	it("leaves value alone when the input has no type", () => {
		const element = makeInput({
			value: "Save Trending settings",
		});
		translateTree(element, buttonView);
		expect(element.getAttribute("value")).toBe(
			"Save Trending settings",
		);
	});

	it("leaves unknown button labels alone", () => {
		const element = makeInput({
			type: "submit",
			value: "Not in the dictionary",
		});
		translateTree(element, buttonView);
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
		const element = env.document.createElement("textarea");
		element.setAttribute(
			"placeholder",
			"Ask anything or type @ to add context",
		);
		element.setAttribute(
			"aria-label",
			"Ask anything or type @ to add context with Copilot",
		);
		// textarea 的内容是**用户输入**：即便它是词条也必须保持原样
		const typed = makeText(
			element,
			"Ask anything or type @ to add context",
		);
		const root = makeRoot();
		root.appendChild(element);
		translateTree(root, copilotView);
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
		const code = env.document.createElement("code");
		code.setAttribute(
			"title",
			"Ask anything or type @ to add context",
		);
		const root = makeRoot();
		root.appendChild(code);
		// 排除是**整棵子树**（TreeWalker 的 FILTER_REJECT），但不得吞掉后面的兄弟节点
		const after = makeText(root, "Star");
		translateTree(root, view);
		expect(code.getAttribute("title")).toBe(
			"Ask anything or type @ to add context",
		);
		expect(after.nodeValue).toBe("星标");
	});

	it("handles an excluded textarea as the traversal root", () => {
		// 属性变化会在引擎里把**元素本身**入队（childList 的 target 是父元素，
		// 但 translateTree 也可能直接收到被排除的元素），此时属性同样要翻
		const element = env.document.createElement("textarea");
		element.setAttribute(
			"placeholder",
			"Ask anything or type @ to add context",
		);
		translateTree(element, copilotView);
		expect(element.getAttribute("placeholder")).toBe(
			"问点什么，或输入 @ 用 Copilot 添加上下文",
		);
	});
});
