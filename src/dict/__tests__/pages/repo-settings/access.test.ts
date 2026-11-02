// Access 子页（/owner/repo/settings/access）顶部计数链接的实机节点边界。
//
// 证据：维护者 2026-10-17 贴的实机节点
// `<a href="/…/settings/access?query=filter%3Acollaborators">1 collaborator</a>`。
// 计数由 GitHub 动态渲染，单复数两种词形都会出现，故走规则
// `repo-settings/collaborators-count`（`^([\d,]+) collaborators?$` ⇒ `$1 位协作者`）。
// 数字里的千分位逗号由 `[\d,]+` 覆盖。
//
// 2026-11-02 补充（维护者截图 + flash alert 的 HTML 片段）：同一页还有四处漏翻——
//   1. `1 invitation`（蓝色链接，逗号是独立节点）→ 规则 `invitations-count`；
//   2. 待接受行右侧 `Pending Invite`（静态标签）；
//   3. 待接受行说明 `Awaiting Riojoker0221's response`（用户名与句子同节点、非链接）；
//   4. 协作者行副标题 `catnoteafish · Collaborator`（显示名与角色**同节点**，
//      故裸 `Collaborator` 的 global 词条结构上命中不了，必须走规则）；
//   5. 邀请成功的 flash alert（`<div role="alert">`，用户名在文本节点内）。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** /Oppenheymu/Github-i18n/settings/access 命中的模块视图 */
const view = buildView(
	"/Oppenheymu/Github-i18n/settings/access",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

describe("仓库设置 Access 子页的计数链接", () => {
	it("translates the collaborator count in both word forms", () => {
		expect(translateText("1 collaborator", view)).toBe(
			"1 位协作者",
		);
		expect(translateText("2 collaborators", view)).toBe(
			"2 位协作者",
		);
		expect(translateText("1,024 collaborators", view)).toBe(
			"1,024 位协作者",
		);
	});

	it("leaves the bare word to the static entries", () => {
		// 侧栏项 `Collaborators`（大写）走静态词条；小写复数与单数都是角色词，
		// 同译「协作者」——单数是 Dependabot 机密页说明句里 `<b>collaborator</b>`
		// 那个独立节点（2026-10-17 补收），计数规则只认「数字 + 词」故互不干扰
		expect(translateText("Collaborators", view)).toBe(
			"协作者",
		);
		expect(translateText("collaborators", view)).toBe(
			"协作者",
		);
		expect(translateText("collaborator", view)).toBe(
			"协作者",
		);
	});

	it("does not touch the filter link text", () => {
		// 查询串是 URL 的一部分，不是文本节点；这里只钉住裸标识符不被翻
		expect(
			translateText("filter:collaborators", view),
		).toBeNull();
	});
});

describe("仓库设置 Access 子页的邀请与待接受行", () => {
	it("translates the invitation count link", () => {
		expect(translateText("1 invitation", view)).toBe(
			"1 个邀请",
		);
		expect(translateText("2 invitations", view)).toBe(
			"2 个邀请",
		);
		expect(translateText("1,024 invitations", view)).toBe(
			"1,024 个邀请",
		);
	});

	it("translates the pending-invite status label", () => {
		expect(translateText("Pending Invite", view)).toBe(
			"待处理的邀请",
		);
	});

	it("translates the awaiting response line, keeping the login", () => {
		expect(
			translateText(
				"Awaiting Riojoker0221's response",
				view,
			),
		).toBe("等待 Riojoker0221 的响应");
		// 弯撇号同样是 GitHub 文案会渲染的形态（与页面标题的撇号处理一致）
		expect(
			translateText(
				"Awaiting Riojoker0221\u2019s response",
				view,
			),
		).toBe("等待 Riojoker0221 的响应");
	});

	it("translates the collaborator line while keeping the display name", () => {
		expect(
			translateText("catnoteafish · Collaborator", view),
		).toBe("catnoteafish · 协作者");
		// 少数组件用项目符号而不是中点，分隔符字符类一并覆盖
		expect(
			translateText("catnoteafish • Collaborator", view),
		).toBe("catnoteafish · 协作者");
	});

	it("translates the flash alert shown after adding a collaborator", () => {
		// 实机 HTML 里 collaborator 与 on 之间是**两个**空格，
		// 引擎按 normalizeKey 折叠成单空格后命中规则
		expect(
			translateText(
				"Riojoker0221 has been added as a collaborator  on the repository.",
				view,
			),
		).toBe("Riojoker0221 已被添加为仓库协作者。");
	});

	it("leaves the user content alone", () => {
		// 反例：显示名是用户内容，整节点单独出现时不收录
		expect(translateText("catnoteafish", view)).toBeNull();
		// 裸角色词仍由 global 的静态词条覆盖，规则不得抢走它
		expect(translateText("Collaborator", view)).toBe(
			"协作者",
		);
	});
});
