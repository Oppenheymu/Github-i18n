// 仓库安全概览页（/owner/repo/security）的实机节点边界回归。
//
// 边界强度：**维护者 2026-09-27 贴的整页 HTML**（Koishi-CE/koishi 的 /security 页），
// 只锁这份 HTML 里出现的节点；页面顶部导航与仓库头部由 pages/repo 的既有回归承担。
//
// 三条必须锁住的边界事实：
//   1. 七个功能行的标题与状态在实机是**两个**文本节点，但项目符号 `•` 落在标题节点
//      内部（`Security policy •`）。裸标题由 pages/repo 提供且在本页路由下仍然生效，
//      带 ` •` 的形态由 pages/insights 各收一条——两条各自独立，谁把它们「统一」成
//      一条，本页就会有一半标题漏翻；
//   2. 顶部横幅被 `<a>status page</a>` 切成三段（前段 / 链接 / 尾段），三段各自的
//      首尾空白由 walker 保留，拼起来要读得通；
//   3. 短链接文本（`View alerts`）在源码里带换行与 16 空格缩进，键按 normalizeKey
//      折叠空白后的形态写。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

/** /Koishi-CE/koishi/security 命中的模块视图（pages/insights + pages/repo + global） */
const view = buildView(
	"/Koishi-CE/koishi/security",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机节点原文 → 期望译文（顺序与页面出现顺序一致） */
const NODES: readonly (readonly [string, string])[] = [
	[
		"Code scanning: one or more analysis tools are reporting problems",
		"代码扫描：一个或多个分析工具正在报告问题",
	],
	[
		"Scorecard is reporting warnings. Check the ",
		"Scorecard 正在报告警告。请查看",
	],
	["status page", "状态页面"],
	[" for help.", "以获取帮助。"],
	["Security policy •", "安全策略 •"],
	["Enabled", "启用"],
	[
		"View how to securely report security vulnerabilities for this repository",
		"查看如何安全地报告此仓库的安全漏洞",
	],
	["View security policy", "查看安全策略"],
	["Security advisories •", "安全公告 •"],
	[
		"View or disclose security advisories for this repository",
		"查看或披露此仓库的安全公告",
	],
	["View security advisories", "查看安全公告"],
	["Private vulnerability reporting •", "私密漏洞报告 •"],
	[
		"Allow users to privately report potential security vulnerabilities",
		"允许用户私下报告潜在的安全漏洞",
	],
	["See reported vulnerabilities", "查看已报告的漏洞"],
	["Dependabot alerts •", "Dependabot 警报 •"],
	[
		"Get notified when one of your dependencies has a vulnerability",
		"当你的某个依赖项存在漏洞时就会收到通知",
	],
	["View Dependabot alerts", "查看 Dependabot 警报"],
	["Code scanning alerts •", "代码扫描警报 •"],
	[
		"Automatically detect common vulnerability and coding errors",
		"自动检测常见漏洞与编码错误",
	],
	["View alerts", "查看警报"],
	["Secret scanning alerts •", "机密扫描警报 •"],
	[
		"Get notified when a secret is pushed to this repository",
		"当有机密被推送到此仓库时就会收到通知",
	],
	["View detected secrets", "查看检测到的机密"],
	["Code quality findings •", "代码质量问题 •"],
	["Disabled", "禁用"],
	[
		"Automatically detect code quality issues in your codebase",
		"自动检测你的代码库中的代码质量问题",
	],
	["Enable code quality", "启用代码质量"],
];

describe("仓库安全概览页的实机节点边界", () => {
	it("translates every node the maintainer pasted", () => {
		for (const [node, expected] of NODES) {
			expect(
				translateText(node, view),
				`节点 ${JSON.stringify(node)}`,
			).toBe(expected);
		}
	});

	it("normalises the source whitespace around each node", () => {
		// 实机节点普遍带源码换行与缩进，` for help.` 这类片段本身就以空格起头：
		// normalizeKey 只作用于查表键，译文照旧按 trimmed 形态写回节点
		for (const [node, expected] of NODES) {
			expect(
				translateText(`\n        ${node}\n      `, view),
				`节点 ${JSON.stringify(node)}`,
			).toBe(expected);
		}
	});

	it("normalises the link node with 16 spaces of indentation", () => {
		// 实机源码：<a …>\n                View alerts\n              </a>
		expect(
			translateText(
				"\n                View alerts\n              ",
				view,
			),
		).toBe("查看警报");
	});

	it("keeps the bullet inside the title node", () => {
		// 裸标题由 pages/repo 提供（它的路由在本页同样命中），带 ` •` 的形态是本模块
		// 新收的：两条各自独立，合并任何一条都会漏翻一半标题
		expect(translateText("Security policy", view)).toBe(
			"安全策略",
		);
		expect(translateText("Security policy •", view)).toBe(
			"安全策略 •",
		);
	});

	it("keeps the three-part banner readable when joined", () => {
		// 复刻 walker 的「保留首尾空白」语义（applyTextNode 把 lead / trail 留在节点上）
		const render = (nodes: readonly string[]) =>
			nodes
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
		expect(
			render([
				"Scorecard is reporting warnings. Check the ",
				"status page",
				" for help.",
			]),
		).toBe(
			"Scorecard 正在报告警告。请查看 状态页面 以获取帮助。",
		);
		// 整句键不存在：横幅在实机上从来不是一个节点。谁收了这条永不命中的整句键，
		// 这条断言就会红（check:dict 的覆盖率也会跟着虚高）
		expect(
			translateText(
				"Scorecard is reporting warnings. Check the status page for help.",
				view,
			),
		).toBeNull();
	});

	it("keeps the repository owner in english", () => {
		expect(translateText("Koishi-CE", view)).toBeNull();
	});
});
