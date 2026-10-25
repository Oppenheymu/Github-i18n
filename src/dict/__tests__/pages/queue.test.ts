// 合并队列页（/owner/repo/queue）的实机节点回归。
//
// 证据来源：维护者 2026-10-25 贴的 popup 漏翻导出（/Koishi-CE/koishi/queue，
// schema github-zh-misses/3）+ 实机片段
// <span data-component="ActionList.Item.Label">Merge queue</span>。
//
// 模块是本次新建的：pages/repo 的兜底路由对三段路径同样命中，此前页面词条全靠
// repo + global 裸奔；queue 专属词条单列 pages/queue（排在 repo 之前赢同键）。
// checks OK 徽标的 aria-label 由 global/checks-ok 翻译（2026-10-25 自 actions 组
// 迁入 global，见 global.test.ts）。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

const zh = dictForLocale("zh-CN");

/** 合并队列页命中的模块视图（pages/queue + pages/repo + global） */
const view = buildView(
	"/Koishi-CE/koishi/queue",
	zh,
	new Map(Object.entries(dictCore.aliases)),
);

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

describe("合并队列页的路由与静态词条", () => {
	it("matches /owner/repo/queue ahead of the repo fallback", () => {
		const names = matchModules(
			"/Koishi-CE/koishi/queue",
			zh.modules,
		).map((module) => module.name);
		expect(
			names.indexOf("pages/queue"),
		).toBeGreaterThanOrEqual(0);
		// queue 比 repo 的兜底更具体：同键异译时 queue 先到先得
		expect(names.indexOf("pages/queue")).toBeLessThan(
			names.indexOf("pages/repo"),
		);
	});

	it("translates the headings and the blankslate", () => {
		const NODES: readonly (readonly [string, string])[] = [
			["Agents", "代理"],
			["Merge queue", "合并队列"],
			["30 day merge count", "30 天合并次数"],
			[
				"No pull requests queued for merging.",
				"没有排队等待合并的拉取请求。",
			],
			[
				"Use the “Merge when ready” button on a pull request to add it to the queue.",
				"在拉取请求上使用“Merge when ready”按钮，即可将其加入队列。",
			],
			["items", "项"],
		];
		for (const [node, expected] of NODES) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, view),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("translates the counters and the title through rules", () => {
		// 排队 tab 的计数（数字动态）
		expect(translateText("0 Queued", view)).toBe(
			"0 个排队中",
		);
		expect(translateText("13 Queued", view)).toBe(
			"13 个排队中",
		);
		// 浏览器标签页标题：仓库名捕获保留
		expect(
			translateText("Merge queue · Koishi-CE/koishi", view),
		).toBe("合并队列 · Koishi-CE/koishi");
		// 检查徽标 aria-label：actions 组的规则在本页路由吃不到，
		// 靠 queue 组的同 pattern 规则命中
		expect(translateText("6 / 8 checks OK", view)).toBe(
			"6 / 8 项检查通过",
		);
	});

	it("keeps user content, the shortcut hint and the brand name in english", () => {
		for (const node of [
			"Koishi-CE", // 组织名
			"koishi", // 仓库名（面包屑）
			"main", // 分支名
			"M. Oppenheymu", // 用户名（头像 alt）
			"@Koishi-CE", // 头像 alt 前缀
			"GitHub", // 品牌名
			"alt shift r", // 切换仓库快捷键的 sr-only 提示
		]) {
			expect(translateText(node, view), node).toBeNull();
		}
	});

	it("has japanese templates for every entry", () => {
		const japanese = buildView(
			"/Koishi-CE/koishi/queue",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(translateText("Agents", japanese)).toBe(
			"エージェント",
		);
		expect(translateText("Merge queue", japanese)).toBe(
			"マージキュー",
		);
		expect(
			translateText("30 day merge count", japanese),
		).toBe("30 日間のマージ数");
		expect(
			translateText(
				"No pull requests queued for merging.",
				japanese,
			),
		).toBe(
			"マージ待ちのプルリクエストはキューにありません。",
		);
		expect(translateText("13 Queued", japanese)).toBe(
			"13 件がキュー待ち",
		);
		expect(translateText("6 / 8 checks OK", japanese)).toBe(
			"6 / 8 件のチェックが成功",
		);
		expect(
			translateText(
				"Merge queue · Koishi-CE/koishi",
				japanese,
			),
		).toBe("マージキュー · Koishi-CE/koishi");
	});
});
