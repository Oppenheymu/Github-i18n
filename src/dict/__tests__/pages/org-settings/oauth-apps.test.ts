// 组织「OAuth 应用」列表页空状态的实机回归。
//
// 证据与强度：2026-11-04 维护者贴的截图（扩展仍在运行，页面显示空态）。
// 该页挂在组织设置下（`/organizations/<组织>/settings/apps` 的 OAuth apps 一支），
// 命中 pages/org-settings + global。
//
// 两条边界事实：
//   ① 侧栏项是 `OAuth Apps`（大写 A，早有键），页面标题是 `OAuth apps`（小写 a）——
//      整节点精确匹配，两条是**不同的键**，本文件把两者都钉住；
//   ② 底部文档链接 `GitHub API` 是纯产品名：词典不收同形译（会触发自我翻译循环），
//      故保持英文，用例反面断言。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const PATH =
	"/organizations/NapukettoDev/settings/apps/oauth_apps";

const locale = dictForLocale("zh-CN");

const view = buildView(
	PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

/** 页面标题与空状态（原文 → 期望译文） */
const NODES: readonly (readonly [string, string])[] = [
	["OAuth apps", "OAuth 应用"],
	["No Organization Owned Apps", "没有组织拥有的应用"],
	[
		"Do you want to develop an App that uses the GitHub API? Register an App to generate OAuth tokens.",
		"你想开发使用 GitHub API 的应用吗？注册应用即可生成 OAuth 令牌。",
	],
	["New OAuth app", "新建 OAuth 应用"],
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

describe("组织 OAuth 应用列表页的模块路由", () => {
	it("loads the org-settings shell", () => {
		const names = matchModules(PATH, locale.modules).map(
			(module) => module.name,
		);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
		expect(names).not.toContain("pages/apps");
		expect(names).not.toContain("pages/settings");
	});
});

describe("组织 OAuth 应用列表页的实机节点边界", () => {
	it("translates every node the screenshot still showed in english", () => {
		for (const [raw, expected] of NODES) {
			for (const variant of withWhitespace(raw)) {
				expect(
					translateText(variant, view),
					`未命中：${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("keeps the sidebar entry and the heading apart", () => {
		// 侧栏条目（大写 A）是既有键；标题（小写 a）是本批新键，两者译文一致但不共用
		expect(translateText("OAuth Apps", view)).toBe(
			"OAuth 应用",
		);
		expect(translateText("OAuth apps", view)).toBe(
			"OAuth 应用",
		);
	});

	it("keeps the product name GitHub API in english", () => {
		expect(translateText("GitHub API", view)).toBeNull();
	});
});
