import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** /organizations/<组织>/settings/pages_verified_domains 命中的模块视图 */
const view = buildView(
	"/organizations/Koishi-CE/settings/pages_verified_domains",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

const VERIFIED_DOMAINS_TEXT: readonly (readonly [
	string,
	string,
])[] = [
	["Pages", "页面"],
	["Verified domains", "已验证的域名"],
	["Add a domain", "添加域名"],
	[
		"There are no verified domains for this organization.",
		"此组织没有已验证的域名。",
	],
	[
		"Verify domains to restrict who can publish GitHub Pages on them.",
		"验证域名，以限制谁可以在这些域名上发布 GitHub Pages。",
	],
];

describe("pages/org-settings 的 Pages 已验证域名页", () => {
	it("translates every supplied English text node", () => {
		for (const [
			source,
			translated,
		] of VERIFIED_DOMAINS_TEXT) {
			expect(
				translateText(source, view),
				`未命中：${source}`,
			).toBe(translated);
		}
	});

	it("keeps organization names as user content", () => {
		expect(translateText("Koishi-CE", view)).toBeNull();
	});
});
