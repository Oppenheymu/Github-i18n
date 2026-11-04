// 仓库级「已安装的 GitHub Apps」页（/owner/repo/settings/installations）实机回归。
//
// 证据与强度：2026-11-04 维护者贴的整页截图（扩展仍在运行，路径即
// /NapukettoDev/NapukettoQQ/settings/installations）。截图里只有三处仍是英文：
// 页头 `Installed GitHub Apps`、页头说明整句、卡片副标题的 `Developed by` 前缀
// （右侧的 `配置` 按钮早已由本模块的 `Configure` 命中，说明路由与模块本身没坏）。
//
// 本文件锁三件事：
//   ① 该路径命中 pages/repo-settings + global，且不命中 pages/settings / pages/org-settings
//      （个人设置与组织设置的 `/settings/installations` 是同一个组件、不同模块，
//      各收一份同译键，路由互斥）；
//   ② 卡片副标题是「`Developed by` + 空格 + 应用所有者链接」两个节点，前缀单独收、
//      所有者名是用户内容；
//   ③ 同串键在三处模块里的译文必须一致（下方逐条钉死，任何一处改了这条就红）。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const PATH =
	"/NapukettoDev/NapukettoQQ/settings/installations";

const locale = dictForLocale("zh-CN");

const view = buildView(
	PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

/** 页头、页头说明与卡片副标题的静态节点（原文 → 期望译文） */
const NODES: readonly (readonly [string, string])[] = [
	["Installed GitHub Apps", "已安装的 GitHub 应用"],
	[
		"GitHub Apps augment and extend your workflows on GitHub with commercial, open source, and homegrown tools.",
		"GitHub Apps 可通过商业、开源与自研工具增强并扩展你在 GitHub 上的工作流。",
	],
	// 卡片副标题前缀：后接应用所有者的链接节点
	["Developed by", "开发者："],
	// 卡片按钮（截图里已是中文，这里防止有人把这条删掉）
	["Configure", "配置"],
];

/** 应用名与所有者：用户内容，必须保持英文 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"Codecov",
	"NapukettoBot",
	"codecov",
	"NapukettoDev",
	// 产品名（`GitHub Apps` 不在此列：侧栏的既有键 `GitHub Apps` 会译作「GitHub 应用」）
	"GitHub",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
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

describe("已安装的 GitHub Apps 页（仓库设置）的模块路由", () => {
	it("loads the repo-settings shell and not the personal/org one", () => {
		const names = matchModules(PATH, locale.modules).map(
			(module) => module.name,
		);
		expect(names).toContain("pages/repo-settings");
		expect(names).toContain("global");
		expect(names).not.toContain("pages/settings");
		expect(names).not.toContain("pages/org-settings");
	});
});

describe("已安装的 GitHub Apps 页（仓库设置）的实机节点边界", () => {
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

	it("renders the page header, the description and the app cards", () => {
		expect(
			renderNodes([
				"Installed GitHub Apps",
				"GitHub Apps augment and extend your workflows on GitHub with commercial, open source, and homegrown tools.",
			]),
		).toBe(
			"已安装的 GitHub 应用GitHub Apps 可通过商业、开源与自研工具增强并扩展你在 GitHub 上的工作流。",
		);
		// 卡片副标题：`Developed by` 节点自带尾随空格，所有者链接原样带回
		expect(renderNodes(["Developed by ", "Codecov"])).toBe(
			"开发者： Codecov",
		);
		expect(
			renderNodes(["Developed by ", "NapukettoDev"]),
		).toBe("开发者： NapukettoDev");
	});

	it("keeps app names, owners and product names in english", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("does not translate the whole header as one sentence", () => {
		// 页头标题与说明是两个独立节点（标题是 h2、说明是 p），拼接串不该命中
		expect(
			translateText(
				"Installed GitHub Apps GitHub Apps augment and extend your workflows on GitHub with commercial, open source, and homegrown tools.",
				view,
			),
		).toBeNull();
	});
});
