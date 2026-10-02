// 仓库设置页的「Actions」子页（/owner/repo/settings/actions）实机文本回归。
//
// 证据：维护者 2026-09-27 用**途径 A**（popup 开发者模式）导出的漏翻清单，
// path 全为 /Oppenheymu/Github-i18n/settings/actions，共 63 条。
// 页面级别与同模块的规则集 / 分支 / 标签保护页一致（pages/repo-settings）。
//
// 本页最关键的三条边界事实：
//   1. 两条长说明在实机是**含源码换行的单节点**（清单里带着 \n 与缩进），
//      键必须按 normalizeKey 折叠空白后的形态写——测试用原始形态验证这一点；
//   2. 允许列表那两段说明里的 `!` 与 `*` 各自被 <code> 包住，而 <code> 是排除容器
//      （见 src/content/filters.ts），所以引擎看到的就是清单里那些碎片节点；
//   3. 四条文案里嵌着**组织名**（Allow <org> … / Any action … within <org> …），
//      组织名随账号变化，只能靠规则；其中「Allow <org>, and select non-<org>, …」
//      必须排在「Allow <org> …」之前，否则贪婪的 (.+) 会把前者整段吞掉。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

/** /Oppenheymu/Github-i18n/settings/actions 命中的模块视图 */
const view = buildView(
	"/Oppenheymu/Github-i18n/settings/actions",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机节点原文 → 期望译文（清单里除专名 / 用户内容外的全部条目） */
const NODES: readonly (readonly [string, string])[] = [
	// —— 权限（Actions permissions）——
	["Actions permissions", "Actions 权限"],
	[
		"Allow all actions and reusable workflows",
		"允许所有操作和可复用工作流",
	],
	[
		"Any action or reusable workflow can be used, regardless of who authored it or where it is defined.",
		"任何操作或可复用工作流都可以使用，无论由谁编写、定义在哪里。",
	],
	["Disable actions", "禁用操作"],
	[
		"The Actions tab is hidden and no workflows can run.",
		"Actions 标签页将被隐藏，无法运行任何工作流。",
	],
	[
		"Allow actions created by GitHub",
		"允许 GitHub 创建的操作",
	],
	[
		"Allow actions by Marketplace",
		"允许 Marketplace 中的操作",
	],
	["verified creators", "已验证的创建者"],
	[
		"Allow or block specified actions and reusable workflows",
		"允许或阻止指定的操作和可复用工作流",
	],
	[
		"Learn more about allowing specific actions and reusable workflows to run.",
		"进一步了解如何允许特定操作和可复用工作流运行。",
	],
	[
		"Require actions to be pinned to a full-length commit SHA",
		"要求操作固定到完整长度的提交 SHA",
	],
	["Action examples:", "操作示例："],
	[
		"Entire organization or repository examples:",
		"整个组织或仓库示例：",
	],
	["Reusable workflow examples:", "可复用工作流示例："],
	[
		"Wildcards, tags, and SHAs are allowed. Use",
		"允许使用通配符、标签和 SHA。使用",
	],
	["prefix to block.", "前缀来阻止。"],
	[
		". By default, only allowed patterns specified in the list can be used. To allow all actions and reusable workflows except those that are explicitly blocked, add a",
		"。默认情况下，只能使用列表中指定的允许模式。若要允许除明确阻止之外的所有操作和可复用工作流，请添加",
	],
	["wildcard pattern.", "通配符模式。"],
	["Your list contains a", "你的列表包含一个"],
	["wildcard pattern, which will", "通配符模式，这将"],
	[
		"allow all actions and reusable workflows",
		"允许所有操作和可复用工作流",
	],
	[
		"except those that are explicitly blocked.",
		"，明确被阻止的那些除外。",
	],
	["Your list contains", "你的列表只包含"],
	["only blocked patterns", "被阻止的模式"],
	// —— 复刻拉取请求工作流 ——
	[
		"Approval for running fork pull request workflows from contributors",
		"对来自贡献者的复刻拉取请求工作流运行的批准",
	],
	[
		"approve the pull request workflow to be run.",
		"批准要运行的拉取请求工作流。",
	],
	[
		"Require approval for all external contributors",
		"所有外部贡献者都需要批准",
	],
	[
		"All users that are not a member or owner of this repository will require approval to run workflows.",
		"所有不是此仓库成员或所有者的用户都需要批准才能运行工作流。",
	],
	[
		"Require approval for first-time contributors who are new to GitHub",
		"首次贡献者且是 GitHub 新用户时需要批准",
	],
	[
		"Only users who are both new on GitHub and who have never had a commit or pull request merged into this repository will require approval to run workflows.",
		"只有既是 GitHub 新用户、又从未有提交或拉取请求合并到此仓库的用户，才需要批准才能运行工作流。",
	],
	[
		"Require approval for first-time contributors",
		"首次贡献者需要批准",
	],
	[
		"Only users who have never had a commit or pull request merged into this repository will require approval to run workflows.",
		"只有从未有提交或拉取请求合并到此仓库的用户，才需要批准才能运行工作流。",
	],
	[
		"Save fork pull request workflows setting",
		"保存复刻拉取请求工作流设置",
	],
	// —— 工作流权限 ——
	["Workflow permissions", "工作流权限"],
	["Read and write permissions", "读写权限"],
	[
		"Workflows have read and write permissions in the repository for all scopes.",
		"工作流在仓库中拥有所有作用域的读写权限。",
	],
	[
		"Read repository contents and packages permissions",
		"读取仓库内容与包的权限",
	],
	[
		"Workflows have read permissions in the repository for the contents and packages scopes only.",
		"工作流在仓库中仅对内容与包作用域拥有读取权限。",
	],
	[
		"Allow GitHub Actions to create and approve pull requests",
		"允许 GitHub Actions 创建和批准拉取请求",
	],
	[
		"Choose whether GitHub Actions can create pull requests or submit approving pull request reviews.",
		"选择 GitHub Actions 是否可以创建拉取请求或提交批准式拉取请求审查。",
	],
	[
		"Learn more about managing permissions.",
		"进一步了解如何管理权限。",
	],
	[
		"Save workflow permissions settings",
		"保存工作流权限设置",
	],
	// —— 构件与日志保留期 ——
	["Artifact and log retention", "构件与日志保留期"],
	[
		"Choose the repository settings for artifacts and logs.",
		"选择构件与日志的仓库设置。",
	],
	[
		"Learn more about the artifact and log retention policy.",
		"进一步了解构件与日志的保留政策。",
	],
	["There is a maximum limit of", "最大上限为"],
	["days.", "天。"],
	["days", "天"],
	["Duration must be 1 or more.", "时长必须为 1 或更大。"],
	["Duration must be 90 or less", "时长必须为 90 或更小"],
	[
		"Save artifact and log retention setting",
		"保存构件与日志保留期设置",
	],
];

describe("仓库设置页的 Actions 子页实机节点边界", () => {
	it("translates every node of the miss export", () => {
		for (const [node, expected] of NODES) {
			for (const variant of [
				node,
				`\n        ${node}\n      `,
			]) {
				expect(
					translateText(variant, view),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("folds the source newlines of the two long captions", () => {
		// 清单里这两条带着 \n 与源码缩进，键按 normalizeKey 折叠后的形态写
		expect(
			translateText(
				"Choose the default permissions granted to the GITHUB_TOKEN\n  when running workflows in this repository.\n  You can specify more granular permissions in the workflow using YAML.",
				view,
			),
		).toBe(
			"选择在此仓库中运行工作流时授予 GITHUB_TOKEN 的默认权限。你可以在工作流中用 YAML 指定更细粒度的权限。",
		);
		expect(
			translateText(
				"Choose which subset of users will require approval before running workflows on their pull requests.\n    Both the pull request author and the actor of the pull request event triggering the workflow will be checked to determine if approval is required.\n    If approval is required, a user with write access to the repository must",
				view,
			),
		).toBe(
			"选择哪些用户子集在其拉取请求上运行工作流之前需要批准。将同时检查拉取请求作者与触发该工作流的拉取请求事件的操作者，以确定是否需要批准。如果需要批准，则对仓库有写权限的用户必须",
		);
	});

	it("translates the organization-embedded wording through rules", () => {
		// 组织名是动态值：两条「Allow …」必须由更具体的那条先命中
		expect(
			translateText(
				"Allow Oppenheymu actions and reusable workflows",
				view,
			),
		).toBe("允许 Oppenheymu 的操作和可复用工作流");
		expect(
			translateText(
				"Allow Oppenheymu, and select non-Oppenheymu, actions and reusable workflows",
				view,
			),
		).toBe(
			"允许 Oppenheymu 的操作和可复用工作流，并可选择非 Oppenheymu 的操作和可复用工作流",
		);
		expect(
			translateText(
				"Any action or reusable workflow defined in a repository within Oppenheymu can be used.",
				view,
			),
		).toBe(
			"Oppenheymu 内仓库中定义的任何操作或可复用工作流都可以使用。",
		);
		expect(
			translateText(
				"Any action or reusable workflow that matches the specified criteria, plus those defined in a repository within Oppenheymu, can be used.",
				view,
			),
		).toBe(
			"符合指定条件的任何操作或可复用工作流，加上 Oppenheymu 内仓库中定义的那些，都可以使用。",
		);
		// 面包屑标题：仓库名保留原文
		expect(
			translateText(
				"Actions settings · Oppenheymu/Github-i18n",
				view,
			),
		).toBe("Actions 设置 · Oppenheymu/Github-i18n");
		// 静态键优先于规则：这两条不能被 actions-allow-org 抢先译成「允许 all 的…」
		expect(
			translateText(
				"Allow all actions and reusable workflows",
				view,
			),
		).toBe("允许所有操作和可复用工作流");
		expect(
			translateText(
				"Allow or block specified actions and reusable workflows",
				view,
			),
		).toBe("允许或阻止指定的操作和可复用工作流");
	});

	it("keeps the repository, user and product names in english", () => {
		expect(translateText("Github-i18n", view)).toBeNull();
		expect(translateText("Oppenheymu", view)).toBeNull();
		expect(translateText("M. Oppenheymu", view)).toBeNull();
		expect(translateText("@Oppenheymu", view)).toBeNull();
		expect(translateText("Copilot", view)).toBeNull();
		expect(translateText("Dependabot", view)).toBeNull();
		expect(translateText("OIDC", view)).toBeNull();
		expect(translateText("alt shift r", view)).toBeNull();
	});
});
