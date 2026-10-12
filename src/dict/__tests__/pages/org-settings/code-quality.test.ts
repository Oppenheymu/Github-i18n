// 组织 Code Quality 设置页（/organizations/<组织>/settings/code-quality）实机回归。
//
// 证据：2026-10-11 维护者贴出的 code-quality React 页面 HTML。页头「代码质量」与
// Upsell 链接「了解更多」已经是中文；两段介绍文案分别在链接处拆成文本节点。
// payload 里的组织名、规则定义、仓库选择器配置都是设置数据，不作为页面文案登记。
import {
	afterAll,
	beforeAll,
	describe,
	expect,
	it,
} from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import {
	translateText,
	translateTree,
} from "../../../../content/walker.ts";
import {
	type DomEnvironment,
	installDom,
} from "../../../../test-support/dom.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const PAGE_PATH =
	"/organizations/Koishi-CE/settings/code-quality";
const locale = dictForLocale("zh-CN");
const view = buildView(
	PAGE_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

let dom: DomEnvironment;

beforeAll(() => {
	dom = installDom();
});

afterAll(() => {
	dom.restore();
});

const NEW_NODES: readonly (readonly [string, string])[] = [
	[
		"Find and fix code quality issues like code coverage, maintainability risks, reliability problems, and more. Get quality insights directly in your development workflow with Copilot-powered autofix.",
		"发现并修复代码质量问题，例如代码覆盖率、可维护性风险、可靠性问题等。借助 Copilot 自动修复，在开发工作流中直接获取质量洞察。",
	],
	[
		"Build resilient code, at scale",
		"大规模构建可靠的代码",
	],
	[
		"Ensure your codebases are reliable, maintainable, and efficient by proactively scanning for best practices, reducing bugs, improving readability, and enabling easier testing, collaboration, and scalability. Enabling this feature will incur charges in",
		"主动扫描最佳实践，减少缺陷、提升可读性，并让测试、协作和扩展更轻松，以确保代码库可靠、易维护且高效。启用此功能将产生",
	],
	["action minutes.", "Actions 分钟费用。"],
	["Enable Code Quality", "启用代码质量"],
	["Frequently asked questions", "常见问题"],
	[
		"What happens once I turn on code quality scanning?",
		"开启代码质量扫描后会发生什么？",
	],
	[
		"GitHub will perform a point-in-time scan of the default branch of the repository, reporting back code quality findings and suggestions to developers. It will also proactively start scanning pull requests for code quality issues. To enable code coverage reports, you will need to manually commit a workflow file, once code quality is enabled.",
		"GitHub 会对仓库的默认分支进行一次扫描，并向开发者报告代码质量问题和建议。GitHub 还会主动开始扫描拉取请求中的代码质量问题。启用代码质量后，如需生成代码覆盖率报告，你需要手动提交一个工作流文件。",
	],
	[
		"GitHub will perform a point-in-time scan of the default branch of the repository, reporting back code quality findings and suggestions to developers. It will also proactively start scanning pull requests for code quality issues.",
		"GitHub 会对仓库的默认分支进行一次扫描，并向开发者报告代码质量问题和建议。GitHub 还会主动开始扫描拉取请求中的代码质量问题。",
	],
	[
		"To enable code coverage reports, you will need to manually commit a workflow file, once code quality is enabled.",
		"启用代码质量后，如需生成代码覆盖率报告，你需要手动提交一个工作流文件。",
	],
	[
		"Learn how to configure code coverage",
		"了解如何配置代码覆盖率",
	],
	["Does Code Quality use AI?", "代码质量会使用 AI 吗？"],
	[
		"Along with standard findings that are detected using the default CodeQL query suite, Code Quality also uses AI to detect additional findings, labeled as AI findings.",
		"除了使用默认 CodeQL 查询套件检测标准问题外，代码质量还会使用 AI 检测其他问题，并将其标记为 AI 发现。",
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

function renderNodes(nodes: readonly string[]): string {
	return nodes
		.map((node) => {
			const translated = translateText(node, view);
			if (translated === null) return node;
			if (translated.trim() === "") return translated;
			const lead = node.slice(
				0,
				node.length - node.trimStart().length,
			);
			const trail = node.slice(node.trimEnd().length);
			return `${lead}${translated}${trail}`;
		})
		.join("");
}

describe("组织 Code Quality 设置页的路由", () => {
	it("loads org-settings and the global fallback", () => {
		const names = matchModules(
			PAGE_PATH,
			locale.modules,
		).map((module) => module.name);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
		expect(names).not.toContain("pages/repo-settings");
		expect(names).not.toContain("pages/settings");
	});
});

describe("组织 Code Quality 设置页的实机节点", () => {
	it("translates every English node", () => {
		for (const [raw, expected] of NEW_NODES) {
			const translated = translateText(raw, view);
			expect(
				translated,
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
			expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
		}
	});

	it("preserves the text-node boundaries around both FAQ and upsell links", () => {
		expect(
			renderNodes([
				"We will support quality rules and languages found in this ",
				"open source repository",
				". The languages supported with CodeQL for standard findings are: C#, Java, JavaScript/TypeScript, Python, Ruby, and Go. Other languages may be scanned with AI, but will not generate standard findings with CodeQL.",
			]),
		).toBe(
			"我们将支持此 开源仓库中包含的质量规则和编程语言。CodeQL 标准发现支持的语言包括：C#、Java、JavaScript/TypeScript、Python、Ruby 和 Go。其他语言可能会由 AI 扫描，但不会生成 CodeQL 标准发现。",
		);
		expect(
			renderNodes([
				"Ensure your codebases are reliable, maintainable, and efficient by proactively scanning for best practices, reducing bugs, improving readability, and enabling easier testing, collaboration, and scalability. Enabling this feature will incur charges in ",
				"action minutes.",
			]),
		).toBe(
			"主动扫描最佳实践，减少缺陷、提升可读性，并让测试、协作和扩展更轻松，以确保代码库可靠、易维护且高效。启用此功能将产生 Actions 分钟费用。",
		);
	});

	it("translates the FAQ text node before its already translated link", () => {
		const root = dom.document.createElement("div");
		root.className =
			"color-fg-muted CodeQualitySettingsFaq-module__FAQContent__gxmDf";
		root.innerHTML =
			'GitHub will perform a point-in-time scan of the default branch of the repository, reporting back code quality findings and suggestions to developers. It will also proactively start scanning pull requests for code quality issues. To enable code coverage reports, you will need to manually commit a workflow file, once code quality is enabled. <a href="https://docs.github.com/code-security/how-tos/maintain-quality-code/set-up-code-coverage">了解如何配置代码覆盖率</a>';
		dom.document.body.append(root);

		expect(root.childNodes).toHaveLength(2);
		expect(translateTree(root, view)).toBe(1);
		expect(root.firstChild?.textContent).toBe(
			"GitHub 会对仓库的默认分支进行一次扫描，并向开发者报告代码质量问题和建议。GitHub 还会主动开始扫描拉取请求中的代码质量问题。启用代码质量后，如需生成代码覆盖率报告，你需要手动提交一个工作流文件。 ",
		);
		expect(root.querySelector("a")?.textContent).toBe(
			"了解如何配置代码覆盖率",
		);
	});

	it("translates the FAQ when React splits it into two text nodes", () => {
		const root = dom.document.createElement("div");
		root.className =
			"color-fg-muted CodeQualitySettingsFaq-module__FAQContent__gxmDf";
		root.append(
			dom.document.createTextNode(
				"GitHub will perform a point-in-time scan of the default branch of the repository, reporting back code quality findings and suggestions to developers. It will also proactively start scanning pull requests for code quality issues.",
			),
			dom.document.createTextNode(
				"To enable code coverage reports, you will need to manually commit a workflow file, once code quality is enabled. ",
			),
		);
		const link = dom.document.createElement("a");
		link.textContent = "了解如何配置代码覆盖率";
		root.append(link);
		dom.document.body.append(root);

		expect(root.childNodes).toHaveLength(3);
		expect(translateTree(root, view)).toBe(2);
		expect(root.childNodes[0]?.textContent).toBe(
			"GitHub 会对仓库的默认分支进行一次扫描，并向开发者报告代码质量问题和建议。GitHub 还会主动开始扫描拉取请求中的代码质量问题。",
		);
		expect(root.childNodes[1]?.textContent).toBe(
			"启用代码质量后，如需生成代码覆盖率报告，你需要手动提交一个工作流文件。 ",
		);
		expect(link.textContent).toBe("了解如何配置代码覆盖率");
	});

	it("keeps the already translated heading and dynamic organization data", () => {
		expect(translateText("Code quality", view)).toBe(
			"代码质量",
		);
		expect(translateText("Koishi-CE", view)).toBeNull();
	});
});
