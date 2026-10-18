// 提交 / 分支子页（/owner/repo/branches 等）实机文本回归。
//
// 证据：维护者 2026-10-18 贴的实机 DOM——分支页每行右侧的关联拉取请求计数：
//   <span class="col-3 flex-shrink-0 f6 color-fg-muted width-auto text-right">
//     2 pull requests
//   </span>
// 数字是动态的，静态词条结构上覆盖不了，只能走本模块的规则
// `commits/branch-pull-requests`（单复数折叠，与 issues/linked-prs-count 同一手法）。
//
// 三条边界事实：
//   1. 计数是**独立文本节点**（带源码换行缩进，引擎自己归一空白），不是句子的一部分；
//   2. `pull requests` 单独一个词条在本路由上**不应存在**——全局词典里的小写
//      `pull requests` 是 pages/insights 拼 Pulse 摘要句用的碎片，本模块拿不到它，
//      也不该在这里命中（否则会把数字丢掉，只剩「个拉取请求」）；
//   3. 规则两端锚定，带尾巴的句子（`2 pull requests were merged`）不归它管。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

/** /Oppenheymu/Github-i18n/branches 命中的模块视图 */
const view = buildView(
	"/Oppenheymu/Github-i18n/branches",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

describe("分支页行尾的拉取请求计数", () => {
	it("translates the count with the plural folded", () => {
		expect(translateText("2 pull requests", view)).toBe(
			"2 个拉取请求",
		);
		expect(translateText("1 pull request", view)).toBe(
			"1 个拉取请求",
		);
		expect(translateText("0 pull requests", view)).toBe(
			"0 个拉取请求",
		);
		// 四位数带千分位
		expect(translateText("1,024 pull requests", view)).toBe(
			"1,024 个拉取请求",
		);
	});

	it("normalizes the source indentation the real node carries", () => {
		// 实机节点原文（span 内带换行缩进）
		expect(
			translateText(
				"\n          2 pull requests\n        ",
				view,
			),
		).toBe("2 个拉取请求");
	});

	it("does not invent a bare phrase entry for the numberless node", () => {
		// 没有词条 → 保持英文；否则数字会被规则/词条吞掉，只剩「个拉取请求」
		expect(translateText("pull requests", view)).toBeNull();
		// 带尾巴的句子不归这条规则管（规则两端锚定）
		expect(
			translateText("2 pull requests were merged", view),
		).toBeNull();
	});

	it("has a japanese template as well", () => {
		const japanese = buildView(
			"/Oppenheymu/Github-i18n/branches",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(translateText("2 pull requests", japanese)).toBe(
			"2 件のプルリクエスト",
		);
		expect(translateText("1 pull request", japanese)).toBe(
			"1 件のプルリクエスト",
		);
	});
});
