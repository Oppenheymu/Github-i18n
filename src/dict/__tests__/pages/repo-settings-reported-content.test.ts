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
// 本文件锁三件事：① 该路径必须命中 pages/repo-settings，且排在 pages/repo 之前
// （词条先到先得）；② 那批早就有译文的侧栏 / 正文词条在该路径上真的生效；
// ③ 该页专属文案（页标题、举报设置三个单选项、Abuse reports 空态）按随后贴出的
// 实机 HTML 逐节点登记后的回归。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

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

describe("举报内容页的专属文案（实机 HTML 逐节点登记）", () => {
	it("translates the page heading and its split intro sentence", () => {
		// 证据：维护者 2026-09-27 贴出的该页实机 HTML（Rails 服务端渲染，
		// 按钮文案「保存」已是中文，其余为英文原文）
		expect(translateText("Reported content", view)).toBe(
			"举报内容",
		);
		// 说明句被 Learn more 链接切成两段：前段以句点结尾、后段是链接文本，
		// 链接后的句点自成纯符号节点（引擎不翻）
		expect(
			translateText(
				"Users can report abusive or disruptive content for review and moderation.",
				view,
			),
		).toBe(
			"用户可以举报滥用性或破坏性内容，以供审查和审核。",
		);
		expect(
			translateText(
				"Learn more about reported content",
				view,
			),
		).toBe("进一步了解举报内容");
		// 上游若改回单节点形态，整句兜底
		expect(
			translateText(
				"Users can report abusive or disruptive content for review and moderation. Learn more about reported content.",
				view,
			),
		).toBe(
			"用户可以举报滥用性或破坏性内容，以供审查和审核。进一步了解举报内容。",
		);
	});

	it("translates the three report-content radios", () => {
		expect(
			translateText("Report content setting", view),
		).toBe("举报内容设置");
		// All users 是既有词条（本页此前只是没加载模块）
		expect(translateText("All users", view)).toBe(
			"所有用户",
		);
		expect(
			translateText(
				"Any user on GitHub is able to report content",
				view,
			),
		).toBe("GitHub 上的任何用户都可以举报内容");
		expect(
			translateText(
				"Prior contributors and collaborators",
				view,
			),
		).toBe("此前的贡献者与协作者");
		expect(
			translateText(
				"Only users who have previously contributed to the repository and collaborators will be able to report content",
				view,
			),
		).toBe(
			"只有此前向该仓库贡献过的用户与协作者才能举报内容",
		);
		expect(
			translateText("Disable content reporting", view),
		).toBe("禁用内容举报");
		expect(
			translateText(
				"Disable content reporting for all users",
				view,
			),
		).toBe("为所有用户禁用内容举报");
	});

	it("translates the abuse reports section and its blankslate", () => {
		expect(translateText("Abuse reports", view)).toBe(
			"滥用举报",
		);
		expect(
			translateText(
				"The following content has been reported by users:",
				view,
			),
		).toBe("以下内容已被用户举报：");
		// segmented-control 的 aria-label（属性只走精确命中）
		expect(translateText("Report filter", view)).toBe(
			"举报筛选器",
		);
		// 两个页签：Reported Content 与页标题 Reported content 只差首字母大小写
		expect(translateText("Reported Content", view)).toBe(
			"举报内容",
		);
		expect(translateText("Resolved", view)).toBe("已解决");
		// 空态标题在实机带前导空白与尾随换行，normalizeKey 会折叠
		expect(
			translateText(
				"      There aren't any unresolved content reports for this repository.\n",
				view,
			),
		).toBe("此仓库没有任何未解决的内容举报。");
	});
});
