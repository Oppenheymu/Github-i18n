import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { LOCALES } from "../../dict/locales.ts";
import type { LocaleDict } from "../../shared/types.ts";
import { buildView, matchModules } from "../view.ts";

const zh = dictForLocale("zh-CN");

/** 语言无关的别名映射：运行时与门禁都从 core 的数据里取，这里同样显式传入 */
const aliases: ReadonlyMap<string, string> = new Map(
	Object.entries(dictCore.aliases),
);

const routes = (pathname: string) =>
	matchModules(pathname, zh.modules).map(
		(module) => module.name,
	);

describe("matchModules", () => {
	it("matches dashboard, profile and repo pages exclusively", () => {
		// 每个 pathname 都会命中 global 兜底（route 为 ^/），故数量为「具体模块 + 1」
		expect(routes("/")).toEqual([
			"pages/dashboard",
			"global",
		]);
		expect(routes("/torvalds")).toEqual([
			"pages/profile",
			"global",
		]);
		expect(routes("/owner/repo")).toEqual([
			"pages/repo",
			"global",
		]);
	});

	it("layers specific modules over the repo module", () => {
		expect(routes("/owner/repo/issues")).toEqual([
			"pages/issues",
			"pages/repo",
			"global",
		]);
		expect(routes("/owner/repo/pull/12")).toEqual([
			"pages/pulls",
			"pages/repo",
			"global",
		]);
		expect(routes("/owner/repo/settings")).toEqual([
			"pages/repo-settings",
			"pages/repo",
			"global",
		]);
	});

	it("keeps reserved top-level paths out of the repo and profile modules", () => {
		// 2026-09 修的越界：`^/[^/]+/[^/]+` 会把 84 条仓库词条注入用户设置页
		// （实测在 /settings/profile 上真的会把 Code / Clone 译成中文），
		// `^/[^/]+$` 则会把 149 条个人主页词条注入搜索页 / 营销页。
		// 保留路径清单在 core/modules.jsonc 里两个模块各一份，这条用例是它的回归保护。
		expect(routes("/settings/profile")).toEqual([
			"pages/settings",
			"global",
		]);
		expect(routes("/settings/appearance")).toEqual([
			"pages/settings",
			"global",
		]);
		// 个人账单 2026-09 迁到 /account/billing/**：设置侧栏照旧渲染，故两个模块都要命中，
		// 否则侧栏（词条在 pages/settings）与正文（词条在 pages/settings-billing）整体保留英文
		expect(routes("/account/billing")).toEqual([
			"pages/settings",
			"pages/settings-billing",
			"global",
		]);
		// 用户实际踩到的路径：同一路由下的子页，命中序列必须与总览页一致
		expect(routes("/account/billing/history")).toEqual([
			"pages/settings",
			"pages/settings-billing",
			"global",
		]);
		// 旧路径兼容分支（/settings/billing/licensing 实机尚存）
		expect(routes("/settings/billing")).toEqual([
			"pages/settings",
			"pages/settings-billing",
			"global",
		]);
		// 未迁移的 /account/* 不注入设置词条：实测 /account/appearance 是 404，
		// 路由只精确覆盖 /account/billing，放宽会让不存在的页面吃到整包设置词条
		expect(routes("/account/appearance")).toEqual([
			"global",
		]);
		expect(routes("/search")).toEqual([
			"pages/search",
			"global",
		]);
		expect(routes("/topics")).toEqual([
			"pages/search",
			"global",
		]);
		expect(routes("/features")).toEqual([
			"pages/marketing",
			"global",
		]);
		expect(routes("/pricing")).toEqual([
			"pages/marketing",
			"global",
		]);
		// /notifications 自 2026-10-25 起有专属模块（此前只是保留路径，靠 global 兜底）
		expect(routes("/notifications")).toEqual([
			"pages/notifications",
			"global",
		]);
		expect(routes("/explore")).toEqual(["global"]);
	});

	it("still matches real profiles, repos and non-reserved two-segment paths", () => {
		// 排除保留路径不能把正常的用户名 / 仓库名一起排掉
		expect(routes("/torvalds")).toEqual([
			"pages/profile",
			"global",
		]);
		expect(routes("/owner/repo")).toEqual([
			"pages/repo",
			"global",
		]);
		expect(
			routes("/owner/repo/blob/main/src/index.ts"),
		).toEqual(["pages/repo", "global"]);
		// 不存在的两段路径仍按仓库页处理（故意保持宽泛，避免漏掉未登记的子页）
		expect(routes("/not-a-real-page/x")).toEqual([
			"pages/repo",
			"global",
		]);
	});

	it("keeps global last so that specific pages win", () => {
		for (const pathname of [
			"/",
			"/owner/repo",
			"/owner/repo/issues",
			"/settings/profile",
		]) {
			const matched = routes(pathname);
			expect(matched.at(-1)).toBe("global");
		}
	});
});

describe("buildView", () => {
	it("falls back to global entries on any path", () => {
		const view = buildView("/owner/repo", zh, aliases);
		expect(view.entries.get("Skip to content")).toBe(
			"跳到主要内容",
		);
	});

	it("only merges entries from matching page modules", () => {
		const issues = buildView(
			"/owner/repo/issues",
			zh,
			aliases,
		);
		expect(issues.entries.get("Close issue")).toBe(
			"关闭议题",
		);
		expect(
			issues.entries.get("Conversation"),
		).toBeUndefined();
		const pulls = buildView(
			"/owner/repo/pull/3",
			zh,
			aliases,
		);
		expect(pulls.entries.get("Files changed")).toBe(
			"文件变更",
		);
		expect(
			pulls.entries.get("Close issue"),
		).toBeUndefined();
	});

	it("keeps dashboard entries off repo pages", () => {
		const dashboard = buildView("/", zh, aliases);
		expect(dashboard.entries.get("Home")).toBe("主页");
		const repo = buildView("/owner/repo", zh, aliases);
		// Home 自 2026-10-25 起同时登记在 global（全局侧边栏是全站组件），
		// 仓库页查得到它是正确行为；模块隔离改由 dashboard 独有键 "For you" 守
		expect(repo.entries.get("Home")).toBe("主页");
		expect(repo.entries.get("For you")).toBeUndefined();
		expect(repo.entries.get("Code")).toBe("代码");
	});

	it("gives page entries priority over global with first-wins merge", () => {
		const dict: LocaleDict = {
			locale: "zh-CN",
			modules: [
				{
					name: "pages/a",
					route: /^\/a/,
					entries: { Base: "页面优先", OnlyA: "甲" },
					rules: [{ pattern: /^x$/, replacement: "页面X" }],
				},
				{
					name: "global",
					route: /^\//,
					entries: { Base: "全局兜底" },
					rules: [
						{ pattern: /^now$/, replacement: "全局刚刚" },
					],
				},
			],
		};
		const onA = buildView("/a", dict, aliases);
		expect(onA.entries.get("Base")).toBe("页面优先");
		expect(onA.rules[0]?.replacement).toBe("页面X");
		const elsewhere = buildView("/b", dict, aliases);
		expect(elsewhere.entries.get("Base")).toBe("全局兜底");
		expect(elsewhere.entries.get("OnlyA")).toBeUndefined();
		expect(elsewhere.rules).toHaveLength(1);
	});

	it("exposes the alias map on every view", () => {
		const view = buildView("/owner/repo", zh, aliases);
		expect(view.aliases).toBeInstanceOf(Map);
		expect(view.aliases).toBe(aliases);
	});

	it("covers every declared locale with a dictionary", () => {
		for (const meta of LOCALES) {
			expect(dictForLocale(meta.id).modules.length).toBe(
				zh.modules.length,
			);
		}
	});
});
