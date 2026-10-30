// 网络关系图页（/owner/repo/network）与依赖项关系图页
//（/owner/repo/network/dependencies）的实机节点回归。两页都在 pages/repo 模块
//（路由兜底命中），不命中 pages/insights。
//
// 节点来源：维护者 2026-10-29 贴的 `github-zh-misses/3` 导出（Koishi-CE/koishi
// 两路径）。三类动态串走规则并锁住原始形态：
//   ① 「· Detected automatically on <日期> · <许可证>」的源码节点内是换行缩进，
//      用例保留原始换行，钉住 normalizeKey 折叠 + 规则匹配的链路；
//   ② Paths 弹层的「Paths for <包名>」与「Showing N paths…」；
//   ③ 文档标题（Insights 族新格式，无「· GitHub」后缀）。
// 明确不收：npm / GitHub Actions（生态系统名）、包名与版本、依赖文件路径、
// 许可证名、Dependabot、浏览器名链接、relative-time 的 title 时间戳。
// 导出里挂在 /network 路径下的复刻空态记录是 SPA 软导航的路径错标（同批还有
// traffic 记录挂在 /graphs/commit-activity 下），复刻空态碎片只登记
// pages/insights，不在本页断言。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

const aliases = new Map(Object.entries(dictCore.aliases));

/** 依赖项关系图页命中的模块：pages/repo + global */
const view = buildView(
	"/Koishi-CE/koishi/network/dependencies",
	dictForLocale("zh-CN"),
	aliases,
);

/** 网络关系图页（同一模块） */
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

describe("依赖项关系图页的实机节点边界", () => {
	it("translates the subnav, badges and SBOM toolbar", () => {
		for (const [node, expected] of [
			["Dependency files checked", "已检查的依赖项文件"],
			["Dependency Insights menu", "依赖项洞察菜单"],
			["Dependencies", "依赖项"],
			["Dependents", "被依赖项"],
			["Direct", "直接"],
			["Transitive", "传递"],
			["Export SBOM", "导出 SBOM"],
			["Learn more about SBOMS.", "了解 SBOM 的更多信息。"],
		] as const) {
			expect(translateText(node, view), node).toBe(
				expected,
			);
		}
	});

	it("translates the paths overlay and the ecosystem filter", () => {
		expect(translateText("Filter by ecosystem", view)).toBe(
			"按生态系统筛选",
		);
		expect(
			translateText("Filter by ecosystem options", view),
		).toBe("按生态系统筛选选项");
		expect(translateText("Filter ecosystems", view)).toBe(
			"筛选生态系统",
		);
		expect(
			translateText("No ecosystems found.", view),
		).toBe("未找到生态系统。");
		expect(
			translateText("Search all dependencies", view),
		).toBe("搜索所有依赖项");
		expect(translateText("Suggestions", view)).toBe("建议");
	});

	it("translates the ProTip line", () => {
		expect(translateText("ProTip!", view)).toBe(
			"专业提示！",
		);
		expect(
			translateText(
				"Supported ecosystems will have transitivity labels on their packages.",
				view,
			),
		).toBe(
			"受支持的生态系统会在其软件包上显示传递性标签。",
		);
	});

	it("translates the dynamic sbom rows through rules", () => {
		// Paths 弹层标题：包名与版本原样保留
		expect(
			translateText("Paths for picocolors ^1.1.1", view),
		).toBe("picocolors ^1.1.1 的路径");
		expect(
			translateText(
				"Paths for @biomejs/biome ^2.5.15",
				view,
			),
		).toBe("@biomejs/biome ^2.5.15 的路径");
		// 空态行
		expect(
			translateText(
				"Showing 0 paths. Export SBOM to view all paths.",
				view,
			),
		).toBe("显示 0 条路径。导出 SBOM 可查看所有路径。");
	});

	it("translates the detected-automatically meta line with its raw newlines", () => {
		// 实机节点原文带换行缩进，normalizeKey 折叠成单空格后由规则命中；
		// 贪婪捕获组回溯到最后一个「·」分隔符
		expect(
			translateText(
				"·\n    Detected automatically on Aug 28, 2026\n    ·\n    MIT",
				view,
			),
		).toBe("· 于 Aug 28, 2026 自动检测 · MIT");
		expect(
			translateText(
				"·\n    Detected automatically on Oct 12, 2026",
				view,
			),
		).toBe("· 于 Oct 12, 2026 自动检测");
		// 归一化后的单空格形态同样命中
		expect(
			translateText(
				"· Detected automatically on Aug 28, 2026 · MIT",
				view,
			),
		).toBe("· 于 Aug 28, 2026 自动检测 · MIT");
	});

	it("translates the dependency total and the pagination aria", () => {
		expect(translateText("147 Total", view)).toBe(
			"共 147 项",
		);
		expect(translateText("Page 1", view)).toBe("第 1 页");
		expect(translateText("Page 8", view)).toBe("第 8 页");
	});

	it("translates the titles through rules with the repo name intact", () => {
		expect(
			translateText(
				"Dependencies · Koishi-CE/koishi",
				view,
			),
		).toBe("依赖项 · Koishi-CE/koishi");
		expect(
			translateText("Insights: Koishi-CE/koishi", view),
		).toBe("洞察：Koishi-CE/koishi");
	});

	it("keeps ecosystem names, package names and license names in english", () => {
		for (const node of [
			"npm",
			"GitHub Actions",
			"picocolors",
			"package.json",
			"MIT",
			"Apache-2.0",
			"ISC",
			"Dependabot",
			"Internet Explorer",
			"Chrome",
			"Firefox",
			"GitHub",
		]) {
			expect(translateText(node, view), node).toBeNull();
		}
	});
});

describe("网络关系图页的实机节点边界", () => {
	it("translates the network graph section", () => {
		expect(
			translateText("Network graph", networkView),
		).toBe("网络关系图");
		expect(
			translateText("Chart options", networkView),
		).toBe("图表选项");
		expect(
			translateText(
				"Network graph of recent commits. Use the Chart options menu to view as a table.",
				networkView,
			),
		).toBe(
			"最近提交的网络关系图。使用图表选项菜单以数据表查看。",
		);
		expect(
			translateText(
				"The network graph is also available as a data table.",
				networkView,
			),
		).toBe("网络关系图也可以数据表形式查看。");
		expect(
			translateText(
				"Timeline of the most recent commits to this repository and its network ordered by most recently pushed to and updated daily.",
				networkView,
			),
		).toBe(
			"此仓库及其网络的最近提交时间线，按最近推送排序并每日更新。",
		);
	});

	it("reassembles the canvas fallback sentence across its link boundaries", () => {
		// 浏览器名链接与「or」碎片各自成节点，浏览器名保持英文
		expect(
			renderNodes([
				"Sorry, your browser doesn’t support the <canvas> element.",
				" Please upgrade to the latest ",
				"Internet Explorer",
				", ",
				"Chrome",
				" or ",
				"Firefox",
				".",
			]),
		).toBe(
			"抱歉，你的浏览器不支持 <canvas> 元素。 请升级到最新版 Internet Explorer, Chrome 或 Firefox.",
		);
	});

	it("translates the document title through the rule", () => {
		expect(
			translateText(
				"Network Graph · Koishi-CE/koishi",
				networkView,
			),
		).toBe("网络关系图 · Koishi-CE/koishi");
	});
});
