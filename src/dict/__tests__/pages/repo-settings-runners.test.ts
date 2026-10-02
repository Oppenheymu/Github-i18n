// 仓库设置页的「运行器」两支（/owner/repo/settings/actions/runners 列表页与
// …/runners/new 新建页）实机文本回归。
//
// 证据：维护者 2026-09-27 用途径 A 导出的漏翻清单（两条 path 都在本页群里）
// + 一张列表页截图。页面级别与同模块的其余子页一致（pages/repo-settings）。
//
// 本页最关键的三条边界事实：
//   1. **架构名与平台名不收录**：x64 / ARM64 / ARM / Linux / Windows / macOS
//      （含它们作 aria-label 的形态）是技术名，未命中即保留英文——硬收会让门禁
//      报「译文与键同形」；
//   2. 新建页那段许可说明在实机是**含源码换行的单节点**，键按 normalizeKey 折叠；
//   3. 两支的面包屑标题带仓库名，只能靠规则；侧栏那个单独的 `Runners` 是静态词条，
//      不会被规则吃掉（规则要求分隔符 + 仓库名）。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

/** /Oppenheymu/Github-i18n/settings/actions/runners/new 命中的模块视图 */
const view = buildView(
	"/Oppenheymu/Github-i18n/settings/actions/runners/new",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机节点原文 → 期望译文（含文本节点与 aria-label） */
const NODES: readonly (readonly [string, string])[] = [
	// —— 列表页 ——
	[
		"Host your own runners and customize the environment used to run jobs in your GitHub Actions workflows.",
		"托管你自己的运行器，并自定义在你的 GitHub Actions 工作流中运行作业所使用的环境。",
	],
	[
		"Learn more about self-hosted runners",
		"进一步了解自托管运行器",
	],
	["New self-hosted runner", "新建自托管运行器"],
	["There are no runners configured", "没有配置任何运行器"],
	[
		"to run actions on your own servers.",
		"在你自己的服务器上运行操作。",
	],
	[
		"Learn more about using runners",
		"进一步了解如何使用运行器",
	],
	// —— 新建页 ——
	[
		"Using self-hosted runners in public repositories is not recommended.",
		"不建议在公开仓库中使用自托管运行器。",
	],
	[
		"Forks of your public repository can potentially run dangerous code on your self-hosted runner by creating a pull request.",
		"你公开仓库的复刻可能通过创建拉取请求，在你的自托管运行器上运行危险代码。",
	],
	[
		"Learn more about security hardening for self-hosted runners",
		"进一步了解自托管运行器的安全加固",
	],
	["GitHub Customer Agreement", "GitHub 客户协议"],
	["Runner image", "运行器镜像"],
	["Architecture", "架构"],
	[
		"Win-arm64 runners are currently in pre-release status and subject to change.",
		"Win-arm64 运行器目前处于预发布状态，可能发生变化。",
	],
	["Configure", "配置"],
	// 实机原文里的路径是 "\actions-runner"（反斜杠开头）
	[
		'We recommend configuring the runner under "\\actions-runner". This will help avoid issues related to service identity folder permissions and long path restrictions on Windows.',
		'建议将运行器配置在 "\\actions-runner" 下。这有助于避免与服务标识文件夹权限以及 Windows 长路径限制相关的问题。',
	],
	["Using your self-hosted runner", "使用你的自托管运行器"],
	[
		"For additional details about configuring, running, or shutting down the runner, please check out our",
		"有关配置、运行或关闭运行器的更多详细信息，请查看我们的",
	],
	["product docs", "产品文档"],
	["Breadcrumb", "面包屑"],
];

describe("仓库设置页的运行器两支实机节点边界", () => {
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

	it("folds the source newlines of the licensing caption", () => {
		// 清单里这条带着 \n 与源码缩进，键按 normalizeKey 折叠后的形态写
		expect(
			translateText(
				"Adding a self-hosted runner requires that you download, configure, and execute the\n    GitHub Actions Runner. If you do not already have an existing volume licensing agreement for your GitHub\n    purchases, by downloading and configuring the GitHub Actions Runner, you agree to the",
				view,
			),
		).toBe(
			"添加自托管运行器需要你下载、配置并执行 GitHub Actions Runner。如果你目前没有针对 GitHub 购买项的批量许可协议，那么下载并配置 GitHub Actions Runner 即表示你同意",
		);
	});

	it("translates the two breadcrumb titles through rules", () => {
		expect(
			translateText(
				"Runners · Oppenheymu/Github-i18n",
				view,
			),
		).toBe("运行器 · Oppenheymu/Github-i18n");
		expect(
			translateText(
				"Add new self-hosted runner · Oppenheymu/Github-i18n",
				view,
			),
		).toBe("添加新的自托管运行器 · Oppenheymu/Github-i18n");
		// 侧栏那个单独的 Runners 是静态词条，不能被规则连仓库名一起吞掉
		expect(translateText("Runners", view)).toBe("运行器");
	});

	it("keeps architecture, platform and product names in english", () => {
		for (const name of [
			"x64",
			"ARM64",
			"ARM",
			"Linux",
			"Windows",
			"macOS",
			"GitHub",
			"Copilot",
			"Dependabot",
			"OIDC",
			"Oppenheymu",
			"Github-i18n",
			"M. Oppenheymu",
			"@Oppenheymu",
			"alt shift r",
		]) {
			expect(
				translateText(name, view),
				`专名 ${name}`,
			).toBeNull();
		}
	});
});
