// 漏翻报告的判定回归。
//
// 判定用的是**真实词典**（zh-CN）：候选 / 路由互斥 / 已修复 三类都取决于词条到底在哪个
// 模块里，用假数据测不出「同一个键只在组织模块收录、仓库路径拿不到」这种真实情形。
import { describe, expect, it } from "bun:test";
import {
	classify,
	formatReport,
	isUserContent,
	loadCore,
	loadLocaleDict,
	type MissExportItem,
	parseExport,
} from "./miss-report.ts";

const dict = loadLocaleDict("zh-CN");
const aliases = new Map(Object.entries(loadCore().aliases));

const ACTIONS_SECRETS =
	"/Koishi-CE/koishi/settings/secrets/actions";
const CODE_QUALITY =
	"/Koishi-CE/koishi/settings/code-quality";

const item = (
	overrides: Partial<MissExportItem> = {},
): MissExportItem => ({
	text: "Some label",
	kind: "text",
	path: ACTIONS_SECRETS,
	context: "th",
	count: 1,
	...overrides,
});

const verdictOf = (entry: MissExportItem): string =>
	classify([entry], dict, aliases)[0]?.verdict ?? "missing";

describe("parseExport", () => {
	it("accepts the current schema and keeps the context", () => {
		const parsed = parseExport({
			schema: "github-zh-misses/2",
			exportedAt: "2026-10-17T12:54:04.355Z",
			items: [
				{
					text: "Value",
					kind: "text",
					path: "/x",
					context: "th",
					count: 2,
				},
			],
		});
		expect(parsed.schema).toBe("github-zh-misses/2");
		expect(parsed.items[0]?.context).toBe("th");
	});

	it("accepts a version 1 export, whose items have no context", () => {
		const parsed = parseExport({
			schema: "github-zh-misses/1",
			items: [
				{
					text: "Value",
					kind: "text",
					path: "/x",
					count: 1,
				},
			],
		});
		expect(parsed.items[0]?.context).toBe("");
	});

	it("fails loudly on a broken export", () => {
		expect(() => parseExport(null)).toThrow(/必须是对象/);
		expect(() => parseExport({})).toThrow(/schema/);
		expect(() =>
			parseExport({ schema: "other/1", items: [] }),
		).toThrow(/未知的 schema/);
		expect(() =>
			parseExport({ schema: "github-zh-misses/2" }),
		).toThrow(/items 必须是数组/);
		expect(() =>
			parseExport({
				schema: "github-zh-misses/2",
				items: [
					{ text: "x", kind: "text", path: "x", count: 1 },
				],
			}),
		).toThrow(/path 必须是以 \/ 开头/);
	});
});

describe("isUserContent", () => {
	it("recognises the noise classes the real export was full of", () => {
		for (const raw of [
			"APP_PRIVATE_KEY",
			"TURBO_TEAM",
			"Iv23livw6MVbKOSp3ayS",
			"koishi-ce/koishi",
			"@Koishi-CE",
			"oppenheymu",
			"koishi",
			"alt shift r",
			"Oct 6, 2026, 20:39 GMT+8",
			"Actions secrets · Koishi-CE/koishi",
			"123",
		]) {
			expect(isUserContent(raw), raw).toBe(true);
		}
	});

	it("leaves real UI labels alone", () => {
		for (const raw of [
			"Value",
			"Organization secrets",
			"Last updated",
			"Enable code quality",
		]) {
			expect(isUserContent(raw), raw).toBe(false);
		}
	});
});

describe("classify", () => {
	it("marks a genuinely missing label as a candidate with its module", () => {
		const rows = classify(
			[item({ text: "Totally new label" })],
			dict,
			aliases,
		);
		expect(rows[0]?.verdict).toBe("candidate");
		expect(rows[0]?.modules).toEqual([
			"pages/repo-settings",
		]);
	});

	it("reports keys the dictionary already covers as fixed", () => {
		// 2026-10-17 补完之后，这条在仓库设置路径上已经能命中
		expect(
			verdictOf(item({ text: "Organization secrets" })),
		).toBe("fixed");
	});

	it("spots the same wording collected only in another module", () => {
		// 组织页收了、仓库页没收到——正是 2026-10-17 两次漏翻的根因
		const rows = classify(
			[
				item({
					text: "Enable Code Quality",
					path: CODE_QUALITY,
				}),
			],
			dict,
			aliases,
		);
		expect(rows[0]?.verdict).toBe("knownElsewhere");
		expect(rows[0]?.modules).toContain(
			"pages/org-settings",
		);
	});

	it("never turns structurally untranslatable words into candidates", () => {
		// 头部搜索占位符被 <kbd>/</kbd> 断成 `Type ` + ` to search` 两段，两条都不能收：
		// `Type` 在设置页正文里读作「类型」（在别处收着），只收 `to search` 会留下
		// 「Type / 以搜索」这种中英残句。判定必须压过 knownElsewhere——否则报告会
		// 提示「本模块也收一份」，而那正是会印错的那一步。
		const rows = classify(
			[
				item({
					text: "Type",
					path: "/Koishi-CE/koishi",
					context: "span.placeholder__MIdoN6",
				}),
				item({
					text: "to search",
					path: "/Koishi-CE/koishi",
					context: "span.placeholder__MIdoN6",
				}),
			],
			dict,
			aliases,
		);
		expect(rows.map((row) => row.verdict)).toEqual([
			"structural",
			"structural",
		]);
		expect(rows[0]?.modules).toEqual([]);
	});

	it("keeps product names, user content and dynamic values out of the list", () => {
		expect(verdictOf(item({ text: "GitHub" }))).toBe(
			"product",
		);
		expect(
			verdictOf(item({ text: "APP_PRIVATE_KEY" })),
		).toBe("userContent");
		expect(
			verdictOf(
				item({
					text: "7 / 7 checks OK",
					kind: "aria-label",
				}),
			),
		).toBe("dynamic");
		expect(
			verdictOf(
				item({
					text: "Repository starred by 7 people, including you",
					kind: "title",
				}),
			),
		).toBe("dynamic");
	});
});

describe("formatReport", () => {
	it("says so explicitly when nothing is actionable", () => {
		const rows = classify(
			[item({ text: "GitHub" }), item({ text: "koishi" })],
			dict,
			aliases,
		);
		const report = formatReport(rows, {
			file: "misses.json",
			exportedAt: "2026-10-17T12:54:04.355Z",
		});
		expect(report).toContain("候选 0 条");
		expect(report).toContain(
			"有意保留 2 条：产品名 1 · 用户内容 1 · 动态值 0",
		);
	});

	it("groups candidates by path and prints the suggested module", () => {
		const rows = classify(
			[
				item({ text: "Totally new label", count: 3 }),
				item({ text: "Another new label", count: 1 }),
				item({
					text: "Enable Code Quality",
					path: CODE_QUALITY,
				}),
			],
			dict,
			aliases,
		);
		const report = formatReport(rows, {
			file: "misses.json",
			exportedAt: "2026-10-17T12:54:04.355Z",
		});
		expect(report).toContain("候选 2 条（值得收录）：");
		expect(report).toContain(ACTIONS_SECRETS);
		expect(report).toContain("→ pages/repo-settings");
		expect(report).toContain("路由互斥 1 条");
		expect(report).toContain("← pages/org-settings");
		expect(report).toContain(
			"合计：候选 2 / 路由互斥 1 / 已修复 0",
		);
	});

	it("lists the architectural limits apart from the candidate list", () => {
		const rows = classify(
			[item({ text: "Type", path: "/Koishi-CE/koishi" })],
			dict,
			aliases,
		);
		const report = formatReport(rows, {
			file: "misses.json",
			exportedAt: "",
		});
		expect(report).toContain("候选 0 条");
		expect(report).toContain("架构上限 1 条");
		expect(report).toContain(
			"同形异义：页头「键入」/ 设置页正文「类型」",
		);
		expect(report).toContain("架构上限 1 / 噪声 0");
	});
});
