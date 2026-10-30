// 社区标准页（/owner/repo/community，旧地址 /graphs/community 同页）的实机节点回归。
//
// 节点来源：维护者 2026-10-29 贴的 `github-zh-misses/3` 导出（Koishi-CE/koishi）。
// 本页在 pages/repo 模块（路由 ^/[^/]+/[^/]+ 兜底命中），不命中 pages/insights，
// 故侧栏词条在本模块登记同译（见 C1）。页面两类特殊结构都有拼接断言：
//   ① 两句介绍句被链接切成三段（前段 + 链接 + 独立句点符号节点）；
//   ② 文档标题与 h1.sr-only 走规则，仓库名原样保留。
// 明确不收：README / Code of conduct / Contributing / Security policy（本模块
// 既有键）、纯符号句点与问号节点、整句单节点形态的介绍句（上游若合并回一个节点，
// 保持英文等待规则，不收半句碎片）。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

const aliases = new Map(Object.entries(dictCore.aliases));

/** 本页路径命中的模块：pages/repo + global */
const view = buildView(
	"/Koishi-CE/koishi/community",
	dictForLocale("zh-CN"),
	aliases,
);

/** 实机节点在源码里通常带换行与缩进；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

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

/** 社区文件清单：可见标签 + 状态图标的 aria-label */
const CHECKLIST: readonly (readonly [string, string])[] = [
	["Issue templates", "议题模板"],
	["License", "许可证"],
	["Pull request template", "拉取请求模板"],
	["Additional community file", "其他社区文件"],
];

describe("社区标准页的实机节点边界", () => {
	it("translates the sidebar with wording identical to pages/insights", () => {
		// 侧栏键在本模块登记同译（C1），对照 insights 视图必须逐字一致
		const insightsView = buildView(
			"/Koishi-CE/koishi/pulse",
			dictForLocale("zh-CN"),
			aliases,
		);
		for (const node of [
			"Traffic",
			"People",
			"Dependency graph",
			"Network",
			"Code frequency",
			"Community standards",
			"Admin insights",
			"Actions performance metrics",
			"Actions usage metrics",
		]) {
			expect(translateText(node, view), node).toBe(
				translateText(node, insightsView),
			);
		}
	});

	it("translates the community standards heading and the checklist labels", () => {
		expect(translateText("Community Standards", view)).toBe(
			"社区标准",
		);
		expect(translateText("Checklist", view)).toBe("清单");
		expect(
			translateText(
				"Repository admins accept content reports",
				view,
			),
		).toBe("仓库管理员接受内容举报");
		for (const [node, expected] of CHECKLIST) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, view),
					JSON.stringify(variant),
				).toBe(expected);
			}
		}
	});

	it("translates the status icon aria-labels", () => {
		expect(translateText("Added", view)).toBe("已添加");
		expect(translateText("Not added yet", view)).toBe(
			"尚未添加",
		);
	});

	it("reassembles the two intro sentences across their link boundaries", () => {
		// 「Here’s how this project compares to recommended community standards.」
		// —— 句尾句点是独立符号节点，保持英文（issues 族 Learn more 先例）
		expect(
			renderNodes([
				"Here’s how this project compares to",
				" recommended community standards",
				".",
			]),
		).toBe("以下是本项目与 推荐社区标准.");
		// 「What is the community profile?」——问号同理
		expect(
			renderNodes([
				"What is ",
				"the community profile",
				"?",
			]),
		).toBe("什么是 社区概况?");
		// 整句单节点形态有意不收：上游若合并回一个节点，保持英文而不是收半句
		expect(
			translateText(
				"Here’s how this project compares to recommended community standards.",
				view,
			),
		).toBeNull();
		expect(
			translateText("What is the community profile?", view),
		).toBeNull();
	});

	it("translates the accessibility section", () => {
		expect(
			translateText(
				"Describe your project's accessibility commitment, supported environments, known limitations, and how people can report barriers.",
				view,
			),
		).toBe(
			"描述你的项目的无障碍承诺、支持的环境、已知的限制，以及人们报告障碍的方式。",
		);
		expect(
			translateText(
				"Writing an accessibility statement",
				view,
			),
		).toBe("撰写无障碍声明");
		expect(
			translateText(
				"View an ACCESSIBILITY.md example",
				view,
			),
		).toBe("查看 ACCESSIBILITY.md 示例");
		expect(
			translateText("Add accessibility file", view),
		).toBe("添加无障碍文件");
		expect(translateText("Add", view)).toBe("添加");
	});

	it("translates the discussions blankslate", () => {
		expect(
			translateText(
				"Enable Discussions to unlock Community Insights!",
				view,
			),
		).toBe("启用讨论区以解锁社区洞察！");
		expect(
			translateText(
				"Discussions is the central space for your community to share announcements, ask questions, and host conversations.",
				view,
			),
		).toBe(
			"讨论区是你的社区发布公告、提问和展开对话的中心空间。",
		);
		expect(translateText("Set up discussions", view)).toBe(
			"设置讨论区",
		);
	});

	it("translates the sr-only h1 and the document title through rules", () => {
		expect(
			translateText("Insights: Koishi-CE/koishi", view),
		).toBe("洞察：Koishi-CE/koishi");
		expect(
			translateText("Community · Koishi-CE/koishi", view),
		).toBe("社区 · Koishi-CE/koishi");
	});
});
