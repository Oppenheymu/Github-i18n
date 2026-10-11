// 组织 Advanced Security 配置页（/organizations/<组织>/settings/security_products）实机回归。
//
// 证据：2026-10-11 维护者贴出的 security-products-enablement 页面 HTML。横幅正文在
// 链接前拆成两个文本节点；信息标题位于 sr-only 容器内，仍由 walker 正常翻译。
// SSR payload 中的组织名、仓库名与配置数据是用户内容，不收录为词条。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const PAGE_PATH =
	"/organizations/Koishi-CE/settings/security_products";
const locale = dictForLocale("zh-CN");
const view = buildView(
	PAGE_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

const NEW_NODES: readonly (readonly [string, string])[] = [
	["Information", "信息"],
	[
		"This organization does not have GitHub Advanced Security, which is free for public repositories and billed per active committer for private and internal repositories. To apply configurations with GitHub Advanced Security features to private repositories,",
		"此组织未启用 GitHub Advanced Security。公开仓库可免费使用，私有和内部仓库则按活跃提交者计费。若要将包含 GitHub Advanced Security 功能的配置应用于私有仓库，",
	],
	[
		"upgrade to GitHub Advanced Security.",
		"请升级到 GitHub Advanced Security。",
	],
	["Dismiss banner", "关闭横幅"],
	["Set up Advanced Security", "设置高级安全"],
	[
		"Manage Secret scanning, Code scanning and Dependabot.",
		"管理机密扫描、代码扫描和 Dependabot。",
	],
	["Set up", "开始设置"],
];

function renderNodes(nodes: readonly string[]): string {
	return nodes
		.map((node) => {
			const translated = translateText(node, view);
			if (translated === null) return node;
			if (translated.trim() === "") return translated;
			const lead = node.slice(
				0,
				node.length - node.trimStart().length,
			);
			const trail = node.slice(node.trimEnd().length);
			return `${lead}${translated}${trail}`;
		})
		.join("");
}

describe("组织 Advanced Security 配置页的路由", () => {
	it("loads org-settings and the global fallback", () => {
		const names = matchModules(
			PAGE_PATH,
			locale.modules,
		).map((module) => module.name);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
		expect(names).not.toContain("pages/repo-settings");
		expect(names).not.toContain("pages/settings");
	});
});

describe("组织 Advanced Security 配置页的实机节点", () => {
	it("translates each English node", () => {
		for (const [raw, expected] of NEW_NODES) {
			const translated = translateText(raw, view);
			expect(
				translated,
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
			expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
		}
	});

	it("preserves the split between banner text and its link", () => {
		expect(
			renderNodes([
				"This organization does not have GitHub Advanced Security, which is free for public repositories and billed per active committer for private and internal repositories. To apply configurations with GitHub Advanced Security features to private repositories, ",
				"upgrade to GitHub Advanced Security.",
			]),
		).toBe(
			"此组织未启用 GitHub Advanced Security。公开仓库可免费使用，私有和内部仓库则按活跃提交者计费。若要将包含 GitHub Advanced Security 功能的配置应用于私有仓库， 请升级到 GitHub Advanced Security。",
		);
	});

	it("keeps already translated page text and payload values intact", () => {
		expect(translateText("Advanced Security", view)).toBe(
			"高级安全",
		);
		expect(translateText("Koishi-CE", view)).toBeNull();
		expect(translateText("koishi", view)).toBeNull();
		expect(translateText("Dependabot", view)).toBeNull();
	});
});
