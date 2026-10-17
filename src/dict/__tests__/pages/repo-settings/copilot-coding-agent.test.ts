// 仓库设置页的 Copilot 云端代理子页（/owner/repo/settings/copilot/coding_agent）新增策略。
//
// 证据：维护者 2026-10-17 贴的实机 HTML 片段（`sweagentd-write-scope-policy-*`）。
// 它与既有 Automations 区块（`Allow automations` / `Only allow automations to be triggered…`）
// 同页同组，是上游新加的写入范围策略：开关标签与说明各一个文本节点，说明里没有任何内联拆分。
// 本文件只锁这两条新键，既有键的回归仍由 actions / coding_agent 相关用例承担。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** /Oppenheymu/Github-i18n/settings/copilot/coding_agent 命中的模块视图 */
const view = buildView(
	"/Oppenheymu/Github-i18n/settings/copilot/coding_agent",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

describe("仓库设置页的 Copilot 云端代理新增写入范围策略", () => {
	it("translates the new policy label and its caption", () => {
		expect(
			translateText(
				"Limit automation writes to the triggering resource",
				view,
			),
		).toBe("将自动化写入限制在触发它的资源");
		expect(
			translateText(
				"When enabled, automation runs can only change the issue, pull request, or discussion that triggered them, and anything they create. Scheduled runs can only change what they create. Automation authors cannot turn this off.",
				view,
			),
		).toBe(
			"启用后，自动化运行只能更改触发它们的议题、拉取请求或讨论，以及它们创建的任何内容。计划运行只能更改它们创建的内容。自动化作者无法关闭此设置。",
		);
	});

	it("keeps the neighbouring automation copy intact", () => {
		// 新策略与既有 Automations 区块共页，旧键必须照常命中
		expect(translateText("Allow automations", view)).toBe(
			"允许自动化",
		);
		expect(
			translateText(
				"Only allow automations to be triggered by users with write access",
				view,
			),
		).toBe("仅允许有写权限的用户触发自动化");
	});
});
