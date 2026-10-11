import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** /organizations/<组织>/settings/discussions 命中的模块视图 */
const view = buildView(
	"/organizations/Koishi-CE/settings/discussions",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

const DISCUSSION_TEXT: readonly (readonly [
	string,
	string,
])[] = [
	["Discussions for your organization", "组织讨论区"],
	[
		"Setting up Discussions for your organization will allow you to broadcast updates, answer questions, and hold conversations for the entire organization.",
		"为组织启用讨论区后，你可以向整个组织广播动态、解答问题并展开交流。",
	],
	[
		"Enable discussions for this organization",
		"为此组织启用讨论区",
	],
	[
		"Choose a source repository that will host the discussions.",
		"选择一个用于托管讨论的源仓库。",
	],
	[
		"All discussions on the source repository will be surfaced to the organization Discussions tab.",
		"源仓库中的所有讨论都会显示在组织的“讨论区”选项卡中。",
	],
	[
		"Permissions from the repository will be applied to the organization Discussions. By default, all members of the organization will be able to create and comment on discussions.",
		"仓库的权限会应用到组织讨论区。默认情况下，组织的所有成员都可以创建讨论并发表评论。",
	],
	[
		"Members can now share updates or ask questions to the entire organization.",
		"成员现在可以向整个组织分享动态或提问。",
	],
	[
		"For more information, see our documentation.",
		"更多信息请参阅文档。",
	],
];

describe("pages/org-settings 的组织讨论设置页", () => {
	it("translates every supplied text node", () => {
		for (const [source, translated] of DISCUSSION_TEXT) {
			expect(
				translateText(source, view),
				`未命中：${source}`,
			).toBe(translated);
		}
	});

	it("matches the lead paragraph after folding its source whitespace", () => {
		const source =
			"\n    Setting up Discussions for your organization will allow you to broadcast updates, answer questions, and hold\n    conversations for the entire organization.\n  ";
		expect(translateText(source, view)).toBe(
			"为组织启用讨论区后，你可以向整个组织广播动态、解答问题并展开交流。",
		);
	});

	it("translates the repository picker and both search attributes", () => {
		expect(translateText("Choose a repository", view)).toBe(
			"选择仓库",
		);
		expect(
			translateText("Search for a repository", view),
		).toBe("搜索仓库");
	});

	it("keeps the organization name as user content", () => {
		expect(translateText("Koishi-CE", view)).toBeNull();
	});
});
