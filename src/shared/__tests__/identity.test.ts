// 扩展身份标记的字面量契约（identity.ts 此前零覆盖）。
//
// 为什么值得专门钉两个字面量：实机探针靠它认出「本扩展的 content script 上下文」，
// 而探针已于 48bf519 删除、尚未重建——也就是说**当前没有任何读取方**，改了值不会有
// 任何测试或门禁报错，等探针重建时才发现「找不到扩展」。这正是最需要在仓库里留
// 一条断言的形态：契约在，消费方暂时不在。
//
// 另一条同样重要：本模块必须**零顶层副作用**。工具侧（门禁 / 未来的探针）会直接
// import 它，一旦它顺手做了点什么（或把有副作用的 content 入口拖进模块图），
// 工具侧就会跟着加载浏览器代码。
import { describe, expect, it } from "bun:test";
import {
	EXTENSION_MARKER,
	EXTENSION_MARKER_KEY,
} from "../identity.ts";

describe("扩展身份标记", () => {
	it("keeps the marker value the live probe matches on", () => {
		expect(EXTENSION_MARKER).toBe("github-i18n/content");
	});

	it("keeps the global key the probe reads", () => {
		expect(EXTENSION_MARKER_KEY).toBe(
			"__githubI18nContent",
		);
	});

	// 「import 本模块不写 globalThis」这条**无法用断言表达**：content 入口的测试
	// 会在同一进程里真的写入它（bun test 的 globalThis 跨文件共享，实测两个文件的
	// 桩会互相覆盖），断言「键不存在」会随执行顺序时红时绿。零副作用由模块结构保证
	// （本文件只有两条 const，无顶层调用），不靠测试锁。
});
