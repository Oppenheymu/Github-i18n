// Access 子页（/owner/repo/settings/access）顶部计数链接的实机节点边界。
//
// 证据：维护者 2026-10-17 贴的实机节点
// `<a href="/…/settings/access?query=filter%3Acollaborators">1 collaborator</a>`。
// 计数由 GitHub 动态渲染，单复数两种词形都会出现，故走规则
// `repo-settings/collaborators-count`（`^([\d,]+) collaborators?$` ⇒ `$1 位协作者`）。
// 数字里的千分位逗号由 `[\d,]+` 覆盖。
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
