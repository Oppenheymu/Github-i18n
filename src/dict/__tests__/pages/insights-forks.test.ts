// 复刻列表页（/owner/repo/forks）的实机节点回归。词条都在 pages/insights 模块。
//
// 节点来源：维护者 2026-10-29 贴的 `github-zh-misses/3` 导出（Koishi-CE/koishi）。
// 复刻空态的说明句被链接切成四段，句尾节点「pull request」由 Pulse 摘要句的
// 既有量词条（个拉取请求）命中——用例按整段拼接断言，钉住「中段不带量词」
// 这个约定（多一个「一个」就成「发送一个 个拉取请求」）。
// 网络关系图区块与 /network 共用组件：/network 上的同串在 pages/repo 有同译，
// 本页的断言对照 pages/repo 视图逐字一致。
// 明确不收：组织名 / 仓库名 / 头像 alt / <link> 的 title。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

const aliases = new Map(Object.entries(dictCore.aliases));

/** 本页路径命中的模块：pages/insights + pages/repo + global */
const view = buildView(
	"/Koishi-CE/koishi/forks",
	dictForLocale("zh-CN"),
	aliases,
);

/** 对照视图：网络关系图区块在 /network 由 pages/repo 提供同译 */
const networkView = buildView(
	"/Koishi-CE/koishi/network",
	dictForLocale("zh-CN"),
	aliases,
);

/** 按引擎行为渲染一串文本节点，命中时保留原文首尾空白 */
function renderNodes(nodes: readonly string[]): string {
	return nodes
		.map((raw) => {
			const translated = translateText(raw, view);
			if (translated === null) return raw;
			const lead = raw.slice(
				0,
				raw.length - raw.trimStart().length,
			);
			const trail = raw.slice(raw.trimEnd().length);
			return `${lead}${translated}${trail}`;
		})
		.join("");
}

describe("复刻列表页的实机节点边界", () => {
	it("translates the empty-state heading", () => {
		expect(
			translateText(
				"No one has forked this repository yet",
				view,
			),
		).toBe("还没有人复刻此仓库");
	});

	it("reassembles the fork-explanation sentence across the link boundary", () => {
		// 实机四段：前段（源码内带换行缩进）+ 链接 + 中段 + 句尾节点。
		// 句尾「pull request」由既有键命中，中段模板不带量词
		expect(
			renderNodes([
				"Forks are a great way to contribute to a repository.\n        After",
				"forking a repository",
				",\n        you can send the original author a",
				" pull request",
			]),
		).toBe(
			"复刻仓库是为仓库做贡献的好方式。在复刻仓库后，你可以向原作者发送 个拉取请求",
		);
	});

	it("translates the network graph section with wording identical to pages/repo", () => {
		for (const [node, expected] of [
			["Network graph", "网络关系图"],
			[
				"Network graph of recent commits. Use the Chart options menu to view as a table.",
				"最近提交的网络关系图。使用图表选项菜单以数据表查看。",
			],
			[
				"The network graph is also available as a data table.",
				"网络关系图也可以数据表形式查看。",
			],
			[
				"Timeline of the most recent commits to this repository and its network ordered by most recently pushed to and updated daily.",
				"此仓库及其网络的最近提交时间线，按最近推送排序并每日更新。",
			],
		] as const) {
			expect(translateText(node, view), node).toBe(
				expected,
			);
			expect(
				translateText(node, networkView),
				`${node}（/network 对照）`,
			).toBe(expected);
		}
	});

	it("translates the document titles through the new-format rules", () => {
		// 2026-10-29：Insights 族的文档标题去掉了「· GitHub」后缀
		expect(
			translateText("Forks · Koishi-CE/koishi", view),
		).toBe("复刻 · Koishi-CE/koishi");
		expect(
			translateText(
				"Network Graph · Koishi-CE/koishi",
				view,
			),
		).toBe("网络关系图 · Koishi-CE/koishi");
	});

	it("keeps the org name, repo name and avatar alts in english", () => {
		for (const node of [
			"Koishi-CE",
			"koishi",
			"@Koishi-CE",
			"GitHub",
		]) {
			expect(translateText(node, view), node).toBeNull();
		}
	});
});
