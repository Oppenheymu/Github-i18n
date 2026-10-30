// 成员页（/owner/repo/people）与管理子页（/owner/repo/collaborators）的
// 实机节点回归。两页渲染同一套组件（subnav + 成员列表 + 空态），词条都在
// pages/repo 模块（路由兜底命中）。
//
// 节点来源：维护者 2026-10-29 贴的 `github-zh-misses/3` 导出（Koishi-CE/koishi
// 两路径）。计数句「N people have access to this repository」的数字嵌在节点里
//（源码带换行缩进），走 repo/people-access-count 规则——用例里保留原始换行形态，
// 钉住 normalizeKey 折叠 + 规则匹配的整条链路。
// 明确不收：用户名 / 显示名 / 头像 alt / relative-time 的 title 时间戳。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

const aliases = new Map(Object.entries(dictCore.aliases));

/** 成员页命中的模块：pages/repo + global */
const view = buildView(
	"/Koishi-CE/koishi/people",
	dictForLocale("zh-CN"),
	aliases,
);

/** 管理子页与成员页同模块，路由同样兜底命中 */
const collaboratorsView = buildView(
	"/Koishi-CE/koishi/collaborators",
	dictForLocale("zh-CN"),
	aliases,
);

describe("成员页的实机节点边界", () => {
	it("translates the subnav and the role badge on both paths", () => {
		for (const [node, expected] of [
			["Outside collaborators", "外部协作者"],
			["Collaborators", "协作者"],
			["Admin", "管理员"],
		] as const) {
			expect(translateText(node, view), node).toBe(
				expected,
			);
			expect(
				translateText(node, collaboratorsView),
				`${node}（collaborators 对照）`,
			).toBe(expected);
		}
	});

	it("translates the blankslate and the find inputs", () => {
		expect(
			translateText(
				"No outside collaborators with access to this repository.",
				view,
			),
		).toBe("没有可访问此仓库的外部协作者。");
		// aria-label 与 placeholder 同串
		expect(
			translateText("Find a collaborator…", view),
		).toBe("查找协作者…");
		expect(translateText("Find a user", view)).toBe(
			"查找用户",
		);
		expect(translateText("Breadcrumb", view)).toBe(
			"面包屑导航",
		);
	});

	it("translates the access-count sentence with the count inside the node", () => {
		// 实机节点原文带换行缩进（「2\n        people\n        \n        have
		// access to this repository」），normalizeKey 折叠成单空格后由规则命中
		expect(
			translateText(
				"2\n        people\n        \n        have access to this repository",
				view,
			),
		).toBe("2 位成员有权访问此仓库");
		// 单复数动词一并收
		expect(
			translateText(
				"1 person has access to this repository",
				view,
			),
		).toBe("1 位成员有权访问此仓库");
		// 归一化后的单空格形态同样命中
		expect(
			translateText(
				"2 people have access to this repository",
				view,
			),
		).toBe("2 位成员有权访问此仓库");
	});

	it("translates the titles through rules with the repo name intact", () => {
		expect(
			translateText("People · Koishi-CE/koishi", view),
		).toBe("成员 · Koishi-CE/koishi");
		expect(
			translateText(
				"Outside collaborators · Koishi-CE/koishi",
				view,
			),
		).toBe("外部协作者 · Koishi-CE/koishi");
		expect(
			translateText("Insights: Koishi-CE/koishi", view),
		).toBe("洞察：Koishi-CE/koishi");
	});

	it("keeps user names, avatar alts and timestamps in english", () => {
		for (const node of [
			"Oppenheymu",
			"M. Oppenheymu",
			"PaperKoi001",
			"@Oppenheymu",
			"@PaperKoi001",
			"koishi",
			"Koishi-CE",
			"Oct 26, 2026, 19:55 GMT+8",
			"GitHub",
		]) {
			expect(translateText(node, view), node).toBeNull();
		}
	});
});
