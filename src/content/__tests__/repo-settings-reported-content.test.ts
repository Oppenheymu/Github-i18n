// 举报内容页（/owner/repo/reported_content）的**路由**回归。
//
// 证据：维护者 2026-09-27 贴出的实机截图
// （地址栏 https://github.com/Koishi-CE/koishi/reported_content）：侧栏
// General / Collaborators and teams / Moderation / Rulesets / Webhooks / Copilot / Planning
// 与正文几乎全是英文，只有「保存」这类 global 词条是中文。
// 根因不是缺词条，而是**缺路由**：这一支不在 /settings 前缀下，
// pages/repo-settings 的整包词条没被加载（实测 matchModules 当时只返回
// pages/repo + global，438 条 vs 1538 条）。
//
// 本文件锁两件事：① 该路径必须命中 pages/repo-settings，且排在 pages/repo 之前
// （词条先到先得）；② 那批早就有译文的侧栏 / 正文词条在该路径上真的生效。
// 该页专属词条（Abuse reports 等）待实机 HTML 到手后再补，别按截图猜节点边界。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView, matchModules } from "../view.ts";
import { translateText } from "../walker.ts";

/** 实机路径：不含 settings 前缀 */
const PATH = "/Koishi-CE/koishi/reported_content";

const view = buildView(
	PATH,
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

describe("举报内容页（/owner/repo/reported_content）的模块路由", () => {
	it("loads pages/repo-settings without the settings prefix", () => {
		const names = matchModules(
			PATH,
			dictForLocale("zh-CN").modules,
		).map((module) => module.name);
		expect(names).toContain("pages/repo-settings");
		// 仓库页通配也命中，靠模块顺序决定词条先到先得
		expect(names).toContain("pages/repo");
		expect(
			names.indexOf("pages/repo-settings"),
		).toBeLessThan(names.indexOf("pages/repo"));
	});

	it("keeps the /settings branch working", () => {
		const names = matchModules(
			"/Koishi-CE/koishi/settings/rules",
			dictForLocale("zh-CN").modules,
		).map((module) => module.name);
		expect(names).toContain("pages/repo-settings");
	});

	it("translates the sidebar entries that were already in the dictionary", () => {
		// 这批词条在 pages/repo-settings 里早就有译文，缺的只是路由
		expect(translateText("General", view)).toBe("常规");
		expect(
			translateText("Collaborators and teams", view),
		).toBe("协作者与团队");
		expect(translateText("Moderation", view)).toBe("审核");
		expect(translateText("Interaction limits", view)).toBe(
			"互动限制",
		);
		expect(translateText("Code review limits", view)).toBe(
			"代码审查限制",
		);
		expect(translateText("Rulesets", view)).toBe("规则集");
		expect(translateText("Webhooks", view)).toBe(
			"网络钩子",
		);
		expect(translateText("Planning", view)).toBe("规划");
		// 正文里已有的词条（截图里同样是英文残留）
		expect(translateText("All users", view)).toBe(
			"所有用户",
		);
	});

	it("keeps the repository's own names in english", () => {
		expect(translateText("Koishi-CE", view)).toBeNull();
		expect(translateText("koishi", view)).toBeNull();
	});
});
