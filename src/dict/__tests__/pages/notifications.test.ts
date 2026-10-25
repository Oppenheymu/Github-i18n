// 通知页（/notifications）的实机节点回归。
//
// 证据来源：维护者 2026-10-25 贴的 /notifications 实机截图——页面左下菜单四条
// （Notification settings / Watched repositories / Subscriptions / Manage notifications）
// 留英文。截图只含菜单区，节点边界以可见文本为准。
//
// 模块是本次新建的（此前 /notifications 完全没有专属模块，页面靠 global 裸奔；
// profile 路由的保留名单也把 notifications 排除在外），四条全登记在
// pages/notifications；Subscriptions 与 pages/settings、pages/settings-billing
// 同键同译，watch 族术语沿用 global（zh「关注」/ ja「ウォッチ」）。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

const zh = dictForLocale("zh-CN");

/** 通知页命中的模块视图（pages/notifications + global） */
const view = buildView(
	"/notifications",
	zh,
	new Map(Object.entries(dictCore.aliases)),
);

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

describe("通知页的路由与菜单词条", () => {
	it("matches /notifications into the notifications module", () => {
		expect(
			matchModules("/notifications", zh.modules)
				.map((module) => module.name)
				.indexOf("pages/notifications"),
		).toBeGreaterThanOrEqual(0);
	});

	it("translates every menu entry the screenshot shows", () => {
		const NODES: readonly (readonly [string, string])[] = [
			["Notification settings", "通知设置"],
			["Watched repositories", "已关注的仓库"],
			["Subscriptions", "订阅"],
			["Manage notifications", "管理通知"],
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

	it("keeps the unread badge and the caret glyph untranslated", () => {
		// 「Watched repositories」右侧的未读角标（数字）与菜单底部的 ▼ 展开箭头
		// 都是独立节点，数字 / 纯符号按纪律不收录
		expect(translateText("1", view)).toBeNull();
	});

	it("shares the settings module's translation for Subscriptions", () => {
		// 同键同译：settings 页视图下词条一致，不构成同键异译
		const settings = buildView(
			"/settings/subscriptions",
			zh,
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(translateText("Subscriptions", settings)).toBe(
			"订阅",
		);
	});

	it("translates the ProTip footer across its two sibling nodes", () => {
		// 页底 ProTip（维护者 2026-10-25 同页实机 HTML）：<strong>ProTip!</strong>
		// 与说明句是两个兄弟节点，各自整节点命中；实机节点带源码缩进空白。
		// ProTip! 与 search / settings 的同名键同译（小贴士！）
		expect(translateText("ProTip!", view)).toBe("小贴士！");
		expect(
			translateText(
				"\n        Create custom filters to quickly access your most important notifications.\n      ",
				view,
			),
		).toBe("创建自定义筛选器，快速访问你最重要的通知。");
	});

	it("has japanese templates for every entry", () => {
		const japanese = buildView(
			"/notifications",
			dictForLocale("ja"),
			new Map(Object.entries(dictCore.aliases)),
		);
		expect(
			translateText("Notification settings", japanese),
		).toBe("通知の設定");
		expect(
			translateText("Watched repositories", japanese),
		).toBe("ウォッチ中のリポジトリ");
		expect(translateText("Subscriptions", japanese)).toBe(
			"サブスクリプション",
		);
		expect(
			translateText("Manage notifications", japanese),
		).toBe("通知を管理");
		expect(translateText("ProTip!", japanese)).toBe(
			"プロのヒント！",
		);
		expect(
			translateText(
				"Create custom filters to quickly access your most important notifications.",
				japanese,
			),
		).toBe(
			"カスタムフィルターを作成して、最も重要な通知にすばやくアクセスしましょう。",
		);
	});
});
