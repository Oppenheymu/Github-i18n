// 组织「发布者验证」页（/organizations/<组织>/settings/publisher_verification）实机回归。
//
// 证据与强度：2026-11-04 维护者贴的整页截图（扩展仍在运行）。页头 `Publisher Verification`
// 与侧栏项早就有键、截图里已是中文，说明路由与模块本身没坏——整块英文的是本页正文。
//
// 本文件锁三件事：
//   ① 该路径命中 pages/org-settings + global，且不命中 pages/settings（个人设置的
//      `Checklist` / `Email` 是同串词条，但两条路由互斥）；
//   ② 介绍句被**内联的 verified 徽标（SVG）**切成两个文本节点：`… organization. A` +
//      ` badge will be added …`，整句键在实机永不命中，故正面渲染两段、反面钉住整句；
//   ③ 资料卡里的 `Name` / `China` 是组织自己的显示名与位置（用户内容），必须保持英文。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const PATH =
	"/organizations/NapukettoDev/settings/publisher_verification";

const locale = dictForLocale("zh-CN");

const view = buildView(
	PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

/** 页面正文的静态节点（原文 → 期望译文），顺序与截图一致 */
const NODES: readonly (readonly [string, string])[] = [
	// 介绍句被 verified 徽标切成两段
	[
		"You can request publisher verification for your organization. A",
		"你可以为组织申请发布者验证。一个",
	],
	[
		"badge will be added to your apps published in the marketplace, recognizing that apps and other published materials were created by you.",
		"徽章会被添加到你在市场中发布的应用上，以表明这些应用及其他已发布材料均由你创建。",
	],
	[
		"Learn more about publisher verification.",
		"进一步了解发布者验证。",
	],
	["Checklist", "检查清单"],
	["Profile details", "资料详情"],
	[
		"Valid profile picture, display name, location and verified email",
		"有效的资料图片、显示名称、位置与已验证的邮箱",
	],
	["Edit profile", "编辑资料"],
	["Display name", "显示名称"],
	["Email", "电子邮件"],
	["Verified email", "已验证邮箱"],
	[
		"Either organization name, profile picture, email or location is not provided",
		"未提供组织名称、资料图片、邮箱或位置",
	],
	["Two-factor authentication enabled", "已启用双因素认证"],
	["Edit Security", "编辑安全设置"],
	["Domain verification", "域名验证"],
	[
		'Verify ownership of your domains and get a "verified" badge on the organization profile.',
		"验证你域名的所有权，并在组织资料上获得「已验证」徽章。",
	],
	["Review", "审查"],
	["Request Verification", "申请验证"],
	[
		"You can request verification once all the items are checked.",
		"所有项目都核对完成后即可申请验证。",
	],
];

/** 组织自己的显示名与位置：用户内容，必须保持英文 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"Name",
	"China",
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

describe("发布者验证页的模块路由", () => {
	it("loads the org-settings shell and not the personal one", () => {
		const names = matchModules(PATH, locale.modules).map(
			(module) => module.name,
		);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
		expect(names).not.toContain("pages/settings");
		expect(names).not.toContain("pages/repo-settings");
	});
});

describe("发布者验证页的实机节点边界", () => {
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

	it("renders the badge sentence across its two text nodes", () => {
		// 实机是「文本 + 内联 SVG + 文本」，徽标节点由引擎跳过，两段文本各自命中
		expect(
			renderNodes([
				"You can request publisher verification for your organization. A",
				" badge will be added to your apps published in the marketplace, recognizing that apps and other published materials were created by you.",
			]),
		).toBe(
			"你可以为组织申请发布者验证。一个 徽章会被添加到你在市场中发布的应用上，以表明这些应用及其他已发布材料均由你创建。",
		);
	});

	it("does not translate the sentence as one node", () => {
		expect(
			translateText(
				"You can request publisher verification for your organization. A badge will be added to your apps published in the marketplace, recognizing that apps and other published materials were created by you.",
				view,
			),
		).toBeNull();
	});

	it("keeps the organization display name and location in english", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});
