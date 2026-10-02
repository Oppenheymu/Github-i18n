// 测试脚手架自身的行为。它是 5 个用例文件（walker / engine / index / popup /
// collector）的公共基础设施，装错一次会成片变红，而「装错」的表现往往是被测代码
// 的问题——所以这里把它的三条约定各自钉一条用例（见 dom.ts 头部）。
import { describe, expect, it } from "bun:test";
import { installDom } from "../dom.ts";

describe("installDom / restore", () => {
	it("installs the globals bun itself does not have", () => {
		const env = installDom();
		try {
			expect(globalThis.document).toBe(env.document);
			expect(
				(globalThis as unknown as Record<string, unknown>)[
					"window"
				],
			).toBe(env.window as unknown);
			// walker.ts 依赖的四个：instanceof 比类身份，故必须是同一个窗口的
			expect(globalThis.Element).toBeDefined();
			expect(globalThis.Node).toBeDefined();
			expect(globalThis.NodeFilter).toBeDefined();
			expect(globalThis.MutationObserver).toBeDefined();
			// 真实 DOM：节点能造、能连上文档、且真的是那个全局 Element 的实例
			const node = env.document.createElement("div");
			env.document.body.appendChild(node);
			expect(node.isConnected).toBe(true);
			expect(node instanceof globalThis.Element).toBe(true);
		} finally {
			env.restore();
		}
	});

	it("restores whatever was installed before it", () => {
		// 嵌套安装（用例里再开一个干净窗口）时，内层还原必须交还外层的全局，
		// 而不是把它删掉
		const before = globalThis.document;
		const outer = installDom();
		expect(globalThis.document).toBe(outer.document);
		const inner = installDom();
		inner.restore();
		expect(globalThis.document).toBe(outer.document);
		outer.restore();
		expect(globalThis.document).toBe(before);
	});

	it("records observe calls made by the code under test, for real", async () => {
		const env = installDom();
		try {
			const root = env.document.createElement("div");
			const node = env.document.createTextNode("Star");
			root.appendChild(node);
			let deliveries = 0;
			// 与被测代码同一条路：从全局取构造函数（那才是被记录的那一个）。
			// env.createObserver 造的旁观者不记进 observes，两个信号必须分开。
			const Observer = globalThis.MutationObserver;
			const observer = new Observer(() => {
				deliveries++;
			});
			observer.observe(root, {
				characterData: true,
				subtree: true,
			});
			// 记录下来了……
			expect(env.observes).toHaveLength(1);
			expect(env.observes[0]?.target).toBe(root);
			expect(env.observes[0]?.options).toMatchObject({
				characterData: true,
				subtree: true,
			});
			// ……而且真的在观察（引擎的用例正是靠这一点才有意义）
			node.nodeValue = "星标";
			await env.tick();
			expect(deliveries).toBe(1);
		} finally {
			env.restore();
		}
	});

	it("logs addEventListener types without breaking the listener", () => {
		const env = installDom();
		try {
			let fired = 0;
			env.document.addEventListener("pagehide", () => {
				fired++;
			});
			env.document.dispatchEvent(
				env.createEvent("pagehide"),
			);
			expect(env.hooks.document).toEqual(["pagehide"]);
			// 记录不能是替换：事件照常派发到处理函数
			expect(fired).toBe(1);
		} finally {
			env.restore();
		}
	});
});
