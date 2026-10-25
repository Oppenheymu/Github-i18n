// 组织仓库的 Code quality 设置页（/owner/repo/settings/code-quality）实机回归。
//
// 证据：2026-10-17 维护者贴出的 Koishi-CE/koishi 实机 HTML。页面带着本扩展渲染，
// 故页头 `代码质量` 与 Upsell 链接的 `了解更多` 是既有词条的产物，不是待补节点。
//
// 为什么需要这一份：组织级同页（/organizations/<组织>/settings/code-quality）的文案与译文
// 早已登记在 pages/org-settings，但**两条路由互斥**——仓库级路径命中 pages/repo-settings，
// 拿不到组织模块的词条，于是整页又变回英文。
//
// 上游 2026-10-17 改写了 FAQ：代码覆盖率不再是「手动提交工作流文件」，而是
// 「打开一个 PR 合并 AI 生成的工作流 YAML」，两条答案各自拆成「前句 + `<span>` 后句」。
// 另有两条本页周边的句子：组织策略横幅的前两段，以及 Advanced Security 页在组织仓库上
// 被政策锁住时显示的 `Alert dismissals require submitting a request to …`。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const PAGE_PATH = "/Koishi-CE/koishi/settings/code-quality";
const locale = dictForLocale("zh-CN");
const view = buildView(
	PAGE_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机节点原文 → 期望译文（顺序与页面出现顺序一致） */
const NODES: readonly (readonly [string, string])[] = [
	// —— Upsell 卡片 ——
	[
		"Build resilient code, at scale",
		"大规模构建可靠的代码",
	],
	[
		"Ensure your codebases are reliable, maintainable, and efficient by proactively scanning for best practices, reducing bugs, improving readability, and enabling easier testing, collaboration, and scalability. Enabling this feature will incur charges in",
		"主动扫描最佳实践，减少缺陷、提升可读性，并让测试、协作和扩展更轻松，以确保代码库可靠、易维护且高效。启用此功能将产生",
	],
	["action minutes.", "Actions 分钟费用。"],
	["Enable code quality", "启用代码质量"],
	// —— FAQ ——
	["Frequently asked questions", "常见问题"],
	[
		"What happens once I turn on code quality scanning?",
		"开启代码质量扫描后会发生什么？",
	],
	[
		"GitHub will perform a point-in-time scan of the default branch of the repository, reporting back code quality findings and suggestions to developers. It will also proactively start scanning pull requests for code quality issues.",
		"GitHub 会对仓库的默认分支进行一次扫描，并向开发者报告代码质量问题和建议。GitHub 还会主动开始扫描拉取请求中的代码质量问题。",
	],
	[
		"A pull request will also be opened to merge an AI-generated workflow YAML file that is needed to enable code coverage analysis.",
		"此外还会打开一个拉取请求，以合并启用代码覆盖率分析所需的 AI 生成工作流 YAML 文件。",
	],
	["Does Code Quality use AI?", "代码质量会使用 AI 吗？"],
	[
		"Along with standard findings that are detected using the default CodeQL query suite, Code Quality also uses AI to detect additional findings, labeled as AI findings.",
		"除了使用默认 CodeQL 查询套件检测标准问题外，代码质量还会使用 AI 检测其他问题，并将其标记为 AI 发现。",
	],
	[
		"Additionally, to enable code coverage analysis, a workflow YAML file is generated using AI that will need to be reviewed and merged manually from the pull request that is opened.",
		"此外，为启用代码覆盖率分析，系统会使用 AI 生成一个工作流 YAML 文件，该文件需要从打开的拉取请求中手动审查并合并。",
	],
	[
		"What quality rules and languages are supported?",
		"支持哪些质量规则和编程语言？",
	],
	[
		"We will support quality rules and languages found in this",
		"我们将支持此",
	],
	["open source repository", "开源仓库"],
	[
		". The languages supported with CodeQL for standard findings are: C#, Java, JavaScript/TypeScript, Python, Ruby, and Go. Other languages may be scanned with AI, but will not generate standard findings with CodeQL.",
		"中包含的质量规则和编程语言。CodeQL 标准发现支持的语言包括：C#、Java、JavaScript/TypeScript、Python、Ruby 和 Go。其他语言可能会由 AI 扫描，但不会生成 CodeQL 标准发现。",
	],
];

/** 复刻 walker 的 lead / trail 保留语义：翻译只换节点正文，首尾空白留在节点上 */
const renderWithWhitespace = (
	nodes: readonly string[],
): string =>
	nodes
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

describe("组织仓库的 Code quality 设置页", () => {
	it("loads the repository module instead of the organization one", () => {
		const names = matchModules(
			PAGE_PATH,
			locale.modules,
		).map((module) => module.name);
		expect(names).toContain("pages/repo-settings");
		expect(names).toContain("global");
		expect(names).not.toContain("pages/org-settings");
	});

	it("translates every node the maintainer pasted", () => {
		for (const [node, expected] of NODES) {
			expect(
				translateText(node, view),
				`节点 ${JSON.stringify(node)}`,
			).toBe(expected);
		}
	});

	it("reassembles the upsell paragraph and both FAQ answers", () => {
		// 与 walker 一致：节点自带的尾随空格留在译文后面，拼接后读得通
		expect(
			renderWithWhitespace([
				"Ensure your codebases are reliable, maintainable, and efficient by proactively scanning for best practices, reducing bugs, improving readability, and enabling easier testing, collaboration, and scalability. Enabling this feature will incur charges in ",
				"action minutes.",
			]),
		).toBe(
			"主动扫描最佳实践，减少缺陷、提升可读性，并让测试、协作和扩展更轻松，以确保代码库可靠、易维护且高效。启用此功能将产生 Actions 分钟费用。",
		);
		expect(
			renderWithWhitespace([
				"GitHub will perform a point-in-time scan of the default branch of the repository, reporting back code quality findings and suggestions to developers. It will also proactively start scanning pull requests for code quality issues. ",
				"A pull request will also be opened to merge an AI-generated workflow YAML file that is needed to enable code coverage analysis.",
			]),
		).toBe(
			"GitHub 会对仓库的默认分支进行一次扫描，并向开发者报告代码质量问题和建议。GitHub 还会主动开始扫描拉取请求中的代码质量问题。 此外还会打开一个拉取请求，以合并启用代码覆盖率分析所需的 AI 生成工作流 YAML 文件。",
		);
		expect(
			renderWithWhitespace([
				"Along with standard findings that are detected using the default CodeQL query suite, Code Quality also uses AI to detect additional findings, labeled as AI findings.",
				" Additionally, to enable code coverage analysis, a workflow YAML file is generated using AI that will need to be reviewed and merged manually from the pull request that is opened.",
			]),
		).toBe(
			"除了使用默认 CodeQL 查询套件检测标准问题外，代码质量还会使用 AI 检测其他问题，并将其标记为 AI 发现。 此外，为启用代码覆盖率分析，系统会使用 AI 生成一个工作流 YAML 文件，该文件需要从打开的拉取请求中手动审查并合并。",
		);
	});

	it("reassembles the organization policy banner around the organization name", () => {
		// 实机：`… because of a <b>Koishi-CE</b> policy. We recommend using <a>GitHub Apps</a>
		// instead for fine grained control over repositories and <a>enhanced security</a>.`
		// 组织名是用户内容（不译），后三段与部署密钥页的同键同译
		expect(
			renderWithWhitespace([
				"Some settings on this page can't be changed because of a ",
				"Koishi-CE",
				" policy. We recommend using ",
				"GitHub Apps",
				" instead for fine grained control over repositories and ",
				"enhanced security",
				".",
			]),
		).toBe(
			"此页面上的某些设置无法更改，因为存在 Koishi-CE 策略。我们建议改用 GitHub 应用 ，以便更精细地控制仓库并获得 更强的安全性.",
		);
	});

	it("translates the policy-locked dismissal note apart from the toggle caption", () => {
		// 同一次采集里 Advanced Security 页的 `ControlGroup-item-description`；
		// 与 `Actors must submit requests to dismiss an alert.` 是两种不同措辞
		expect(
			translateText(
				"Alert dismissals require submitting a request to organization owners or security managers.",
				view,
			),
		).toBe(
			"忽略警报需要向组织所有者或安全管理员提交请求。",
		);
		expect(
			translateText(
				"Actors must submit requests to dismiss an alert.",
				view,
			),
		).toBe("操作者必须提交请求才能忽略警报。");
	});

	it("keeps the organization module's wording out of this page", () => {
		// 大写 Q 的 `Enable Code Quality` 在 2026-10-17 只属组织级按钮文案，本模块未收；
		// 2026-10-25 实机确认仓库级的**开通确认对话框标题**也是它，现已在 repo-settings
		// 登记（与 pages/security 同译），不再列为反例——正向断言见下方对话框用例。
		// 组织页独有的介绍句也不该在仓库级路径上命中
		expect(translateText("Enable code quality", view)).toBe(
			"启用代码质量",
		);
		expect(
			translateText(
				"Find and fix code quality issues like code coverage, maintainability risks, reliability problems, and more. Get quality insights directly in your development workflow with Copilot-powered autofix.",
				view,
			),
		).toBeNull();
	});

	it("translates the billing confirmation dialog", () => {
		// 2026-10-25 实机 HTML：Enable Code Quality 确认对话框（ConfirmationDialog）。
		// 计费表行名的尾部星号随原文保留；定价行数字动态走规则
		const NODES: readonly (readonly [string, string])[] = [
			["Enable Code Quality", "启用代码质量"],
			[
				"Enabling Code Quality in this repository will incur additional costs based on:",
				"在此仓库中启用代码质量将产生额外费用，费用取决于：",
			],
			["Licenses and usage", "许可与用量"],
			["AI credits usage*", "AI 点数用量*"],
			[
				"Action minutes consumed*",
				"消耗的 Actions 分钟数*",
			],
			["Based on usage", "视用量而定"],
			[
				"Learn more about our billing model",
				"了解我们的计费模式",
			],
		];
		for (const [node, expected] of NODES) {
			expect(
				translateText(node, view),
				`节点 ${JSON.stringify(node)}`,
			).toBe(expected);
		}
		expect(
			translateText("$10 per active committer/month", view),
		).toBe("每个活跃提交者每月 $10");
		expect(
			translateText("$25 per active committer/month", view),
		).toBe("每个活跃提交者每月 $25");
	});

	it("reassembles the billing footnote around the docs link", () => {
		// 脚注句被链接切成「前段（尾带空格）+ 链接」两节点
		expect(
			renderWithWhitespace([
				"*Code Quality scans your pull requests and default branch, using a mix of deterministic and AI scans. ",
				"Learn more about our billing model",
			]),
		).toBe(
			"*代码质量将结合确定性扫描与 AI 扫描，扫描你的拉取请求与默认分支。 了解我们的计费模式",
		);
	});

	it("keeps user content and identifiers in english", () => {
		for (const raw of [
			"Koishi-CE",
			"koishi",
			"CodeQL",
			"Copilot",
		]) {
			expect(
				translateText(raw, view),
				`节点 ${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});
