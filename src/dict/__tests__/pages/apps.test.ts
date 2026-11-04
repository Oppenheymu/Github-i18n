// GitHub App 公开页（/apps/<应用名>）实机回归。
//
// 证据与强度：2026-11-04 维护者贴的整页截图（装了扩展后仍整片英文）。
// 这条路径在 pages/profile 与 pages/repo 的保留名单里（保留项 `apps`），此前**没有
// 任何一个模块认领它**，只吃 global 兜底，故页面除零星通用词外全部保留英文。
//
// 本文件锁四件事：
//   ① 路由命中 pages/apps + global，且不污染 /apps 之外的路径；
//   ② 页头副标题、按钮、右侧说明、空描述占位、Developer 小标题与三个链接各自成节点；
//   ③ 「<应用名> is provided by a third-party …」走规则，应用名原样带回；
//   ④ 应用名 / 组织名 / 用户名是用户内容。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import {
	dictCore,
	dictForLocale,
} from "../../../dict/index.ts";

const PATH = "/apps/napukettobot";

const locale = dictForLocale("zh-CN");
const view = buildView(
	PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n          ${node}\n        `];
}

/** 按 walker 的语义拼接相邻节点（保留每个节点的首尾空白） */
function renderNodes(nodes: readonly string[]): string {
	return nodes
		.map((node) => {
			const translated = translateText(node, view);
			if (translated === null) return node;
			const lead = node.slice(
				0,
				node.length - node.trimStart().length,
			);
			const trail = node.slice(node.trimEnd().length);
			return `${lead}${translated}${trail}`;
		})
		.join("");
}

describe("GitHub App 公开页的路由", () => {
	it("loads pages/apps and global", () => {
		for (const path of [
			PATH,
			`${PATH}/installations/new`,
		]) {
			const names = moduleNames(path);
			expect(names).toContain("pages/apps");
			expect(names).toContain("global");
		}
	});

	it("does not claim the app directory index or other pages", () => {
		for (const path of [
			"/apps",
			"/apps/",
			"/settings/apps",
			"/microsoft/vscode",
		]) {
			expect(moduleNames(path)).not.toContain("pages/apps");
		}
	});
});

describe("GitHub App 公开页的文本节点", () => {
	it("translates the header, the configure button and the empty state", () => {
		const nodes: [string, string][] = [
			["GitHub App", "GitHub 应用"],
			["Configure", "配置"],
			[
				"Manage your installation settings.",
				"管理你的安装设置。",
			],
			["No description", "无描述"],
		];
		for (const [raw, expected] of nodes) {
			for (const variant of withWhitespace(raw)) {
				expect(translateText(variant, view)).toBe(expected);
			}
		}
	});

	it("translates the developer block links", () => {
		const nodes: [string, string][] = [
			["Developer", "开发者"],
			["App settings", "应用设置"],
			["Website", "网址"],
			["Report abuse", "举报滥用"],
		];
		for (const [raw, expected] of nodes) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("renders the third-party notice through the dynamic rule", () => {
		expect(
			translateText(
				"NapukettoBot is provided by a third-party and is governed by separate terms of service, privacy policy, and support documentation.",
				view,
			),
		).toBe(
			"NapukettoBot 由第三方提供，并受单独的服务条款、隐私政策和支持文档约束。",
		);
		expect(
			translateText(
				"SomeOtherApp is provided by a third-party and is governed by separate terms of service, privacy policy, and support documentation.",
				view,
			),
		).toBe(
			"SomeOtherApp 由第三方提供，并受单独的服务条款、隐私政策和支持文档约束。",
		);
	});

	it("still translates the notice when the app name is its own node", () => {
		expect(
			renderNodes([
				"NapukettoBot",
				" ",
				"is provided by a third-party and is governed by separate terms of service, privacy policy, and support documentation.",
			]),
		).toBe(
			"NapukettoBot 由第三方提供，并受单独的服务条款、隐私政策和支持文档约束。",
		);
	});
});

describe("GitHub App 公开页的用户内容", () => {
	it("keeps app, organization and user names as-is", () => {
		for (const raw of [
			"NapukettoBot",
			"NapukettoDev",
			"Oppenheymu",
		]) {
			expect(translateText(raw, view)).toBeNull();
		}
	});
});
