import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** /organizations/<组织>/settings/packages 命中的模块视图 */
const view = buildView(
	"/organizations/Koishi-CE/settings/packages",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

const PACKAGE_TEXT: readonly (readonly [string, string])[] =
	[
		["Packages permissions", "软件包权限"],
		["Package creation", "软件包创建"],
		[
			"Members will be able to publish only the selected visibility types for packages and containers. Outside collaborators can never publish packages or containers.",
			"成员只能按所选的可见性类型发布软件包和容器。外部协作者永远无法发布软件包或容器。",
		],
		[
			"Members will be able to create public packages, visible to anyone.",
			"成员可以创建公开软件包，任何人都可见。",
		],
		[
			"Members will be able to create private packages, visible to organization members with permission.",
			"成员可以创建私有软件包，具有权限的组织成员可见。",
		],
		["Internal", "内部"],
		[
			"Members will be able to create internal packages, visible to all organization/enterprise members.",
			"成员可以创建内部软件包，所有组织/企业成员均可见。",
		],
		[
			"Inherit access from source repository",
			"从源仓库继承访问权限",
		],
		["Default package settings", "默认软件包设置"],
		[
			"This setting will be applied to new Container, npm, rubygems and NuGet packages.",
			"此设置将应用于新建的 Container、npm、rubygems 和 NuGet 软件包。",
		],
		["Deleted packages", "已删除的软件包"],
		[
			"These are packages that have been previously deleted belonging to this organization. You can restore a package deleted within the last 30 days.",
			"这些是此前删除的、属于此组织的软件包。你可以恢复在过去 30 天内删除的软件包。",
		],
		["Search deleted packages", "搜索已删除的软件包"],
	];

describe("pages/org-settings 的组织软件包设置页", () => {
	it("translates every supplied text node and search attribute", () => {
		for (const [source, translated] of PACKAGE_TEXT) {
			expect(
				translateText(source, view),
				`未命中：${source}`,
			).toBe(translated);
		}
	});

	it("translates the dynamic empty state while keeping the organization name", () => {
		expect(
			translateText(
				"No recoverable packages were found for Koishi-CE.",
				view,
			),
		).toBe("未找到 Koishi-CE 的可恢复软件包。");
		expect(
			translateText(
				"No recoverable packages were found for octocat.",
				view,
			),
		).toBe("未找到 octocat 的可恢复软件包。");
		expect(translateText("Koishi-CE", view)).toBeNull();
	});
});
