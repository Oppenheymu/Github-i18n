// 定时提醒 / 安全日志 / 赞助记录 / 自己开发的 GitHub Apps
// （/settings/reminders、/settings/security-log、/settings/sponsors-log、/settings/apps）
// 实机文本与属性回归。四页同属 pages/settings 模块，合并成一份回归。
//
// 证据强度（逐页写清，因为这四页都没有途径 A 的漏翻导出）：
//   - /settings/apps：**实机 HTML 实证**（维护者粘贴的 outerHTML）——blankslate 三段；
//   - /settings/reminders、/settings/security-log、/settings/sponsors-log：**实机截图**。
//
// 因此本文件里凡是截图看不出边界的地方，都在注释里写明了推断依据：
//   1. 安全日志的**事件行被链接切开**（截图里用户名与应用名都是链接且带下划线），
//      故按「前缀键 + 中段规则 + 尾段键」登记；若实机边界更细，规则不命中、该行保留英文，
//      不会产出中英残句（这正是「宁可漏翻」的取舍）；
//   2. 赞助记录右上角的下拉按本仓已实测的 `<details><summary>` select-menu 形态拆成
//      「Period:」+ 当前值两个节点（同 /settings/repositories 的 `Commit comments:` + 值）；
//   3. 事件行里的令牌尾号、应用名、用户名、审计查询串（`created:2026-09-26`）与
//      地理位置都是动态值或用户内容，一律保留英文。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

/** 按路径取该页的合并视图（pages/settings + global） */
function viewFor(pathname: string) {
	return buildView(
		pathname,
		dictForLocale("zh-CN"),
		new Map(Object.entries(dictCore.aliases)),
	);
}

const remindersView = viewFor("/settings/reminders");
const securityLogView = viewFor("/settings/security-log");
const sponsorsLogView = viewFor("/settings/sponsors-log");
const appsView = viewFor("/settings/apps");

/** /settings/reminders 的实机文本节点（H2「定时提醒」已由既有词条覆盖） */
const REMINDERS_NODES: readonly string[] = [
	"Reminders allow you to push certain events to authorized instances of Microsoft Teams or Slack.",
	"Available organizations",
];

/** /settings/security-log 的实机文本节点（页面外壳） */
const SECURITY_LOG_NODES: readonly string[] = [
	"Filters",
	"Search audit logs",
	"Export",
	"Recent events",
	"Newer",
	"Older",
	"ProTip!",
	"View all events created yesterday",
	// 事件行 1 的前后两段（中段含动态令牌尾号，走规则）
	"Revoked a token for",
	"OAuth app.",
];

/** /settings/sponsors-log 的实机文本节点 */
const SPONSORS_LOG_NODES: readonly string[] = [
	"Period:",
	"New sponsorships, changes, and cancellations",
	"Filter activity",
	"Past day",
	"Past week",
	"Past month",
	"Past year",
	"All-time",
	"No sponsorship activity in this time period",
	"This is where you can review activity from your sponsorships.",
];

/** /settings/apps 的实机文本节点（来自 outerHTML） */
const APPS_NODES: readonly string[] = [
	"No GitHub Apps",
	"Want to build something that integrates with and extends GitHub? Register a new GitHub App to get started developing on the GitHub API.",
	"New GitHub App",
];

/**
 * 必须保持英文的实机节点：动态值、审计查询串、地理位置与用户内容。
 * 它们都含拉丁字母、会通过「可翻译判定」，但收录即错。
 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// 审计事件行里的应用名、用户名与令牌尾号
	"Best Practices Badge",
	"Octotree",
	"Oppenheymu",
	"gL1WhQrR",
	// 审计查询串（可点击的过滤链接，是 GitHub 搜索语法）
	"created:2026-09-26",
	// 地理位置与 IP
	"San Francisco, California, United States",
	"38.107.237.82",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/** 把一段实机节点序列按 walker 的语义过一遍并拼接成页面上的那一行 */
function renderNodes(
	nodes: readonly string[],
	view: ReturnType<typeof viewFor>,
): string {
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

describe("定时提醒页（/settings/reminders）的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of REMINDERS_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(
					variant,
					remindersView,
				);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("renders the reminders blurb and the organizations heading", () => {
		expect(
			translateText("Scheduled reminders", remindersView),
		).toBe("定时提醒");
		expect(
			translateText(
				"Reminders allow you to push certain events to authorized instances of Microsoft Teams or Slack.",
				remindersView,
			),
		).toBe(
			"提醒功能允许你把特定事件推送到已授权的 Microsoft Teams 或 Slack 实例。",
		);
		expect(
			translateText(
				"Available organizations",
				remindersView,
			),
		).toBe("可用的组织");
	});
});

describe("安全日志页（/settings/security-log）的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of SECURITY_LOG_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(
					variant,
					securityLogView,
				);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("keeps audit identifiers, geo data and user content as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, securityLogView),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
		// 相对时间由 global 既有规则覆盖（截图里显示英文是 <relative-time> 自渲染那一轮）
		expect(
			translateText("5 minutes ago", securityLogView),
		).toBe("5 分钟前");
	});

	it("renders the audit-log chrome", () => {
		expect(translateText("Filters", securityLogView)).toBe(
			"筛选器",
		);
		expect(
			translateText("Search audit logs", securityLogView),
		).toBe("搜索审核日志");
		expect(translateText("Export", securityLogView)).toBe(
			"导出",
		);
		expect(
			translateText("Recent events", securityLogView),
		).toBe("最近事件");
		// 分页：Newer / Older 的「当前项」是粗体节点，未选中项是链接
		expect(translateText("Newer", securityLogView)).toBe(
			"较新",
		);
		expect(translateText("Older", securityLogView)).toBe(
			"较旧",
		);
		// 与 pages/search 的同键译文一致
		expect(translateText("ProTip!", securityLogView)).toBe(
			"小贴士！",
		);
		expect(
			translateText(
				"View all events created yesterday",
				securityLogView,
			),
		).toBe("查看昨天创建的所有事件");
	});

	it("renders the audit event rows across their link boundaries", () => {
		// 事件行 1（截图里用户名与应用名都是链接，故是五段拼接）
		expect(
			renderNodes(
				[
					"Revoked a token for",
					" ",
					"Oppenheymu",
					" ",
					"ending in gL1WhQrR for the",
					" ",
					"Best Practices Badge",
					" ",
					"OAuth app.",
				],
				securityLogView,
			),
		).toBe(
			"已撤销以下用户的一个令牌： Oppenheymu （结尾为 gL1WhQrR），属于 Best Practices Badge OAuth 应用。",
		);
		// 中段规则本身（令牌尾号动态、按原样带回）
		expect(
			translateText(
				"ending in 1C3g1xqF for the",
				securityLogView,
			),
		).toBe("（结尾为 1C3g1xqF），属于");
		// 事件行 2（截图里应用名是普通文本，按单节点规则处理）
		expect(
			translateText(
				"Removed authorization for OAuth application (Best Practices Badge)",
				securityLogView,
			),
		).toBe(
			"已移除对 OAuth 应用（Best Practices Badge）的授权",
		);
	});
});

describe("赞助记录页（/settings/sponsors-log）的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of SPONSORS_LOG_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(
					variant,
					sponsorsLogView,
				);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("renders the sponsors-log page", () => {
		// 页面标题与副标题
		expect(
			translateText("Sponsorship log", sponsorsLogView),
		).toBe("赞助记录");
		expect(
			translateText(
				"New sponsorships, changes, and cancellations",
				sponsorsLogView,
			),
		).toBe("新的赞助、变更和取消");
		// 下拉：标签与当前值两个节点
		expect(
			renderNodes(
				["Period:", " ", "All-time"],
				sponsorsLogView,
			),
		).toBe("时间段： 全部时间");
		// 右侧浮层：标题 + 五个档位
		expect(
			translateText("Filter activity", sponsorsLogView),
		).toBe("筛选活动");
		expect(translateText("Past day", sponsorsLogView)).toBe(
			"过去一天",
		);
		expect(
			translateText("Past week", sponsorsLogView),
		).toBe("过去一周");
		expect(
			translateText("Past month", sponsorsLogView),
		).toBe("过去一个月");
		expect(
			translateText("Past year", sponsorsLogView),
		).toBe("过去一年");
		// 空状态两段
		expect(
			translateText(
				"No sponsorship activity in this time period",
				sponsorsLogView,
			),
		).toBe("此时间段内没有赞助活动");
		expect(
			translateText(
				"This is where you can review activity from your sponsorships.",
				sponsorsLogView,
			),
		).toBe("你可以在这里查看你的赞助活动。");
	});
});

describe("自己开发的 GitHub Apps 页（/settings/apps）的实机节点边界", () => {
	it("translates every text node from the pasted HTML", () => {
		for (const node of APPS_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(variant, appsView);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("renders the blankslate", () => {
		expect(translateText("No GitHub Apps", appsView)).toBe(
			"没有 GitHub 应用",
		);
		expect(
			translateText(
				"Want to build something that integrates with and extends GitHub? Register a new GitHub App to get started developing on the GitHub API.",
				appsView,
			),
		).toBe(
			"想构建能与 GitHub 集成并扩展 GitHub 的功能？注册一个新的 GitHub 应用，即可开始基于 GitHub API 进行开发。",
		);
		expect(translateText("New GitHub App", appsView)).toBe(
			"新建 GitHub 应用",
		);
		// 同页已由既有词条覆盖的两处（HTML 里已经是中文）
		expect(translateText("GitHub Apps", appsView)).toBe(
			"GitHub 应用",
		);
		expect(
			translateText("View documentation", appsView),
		).toBe("查看文档");
	});
});
