// 仓库设置页的安全分析子页（/owner/repo/settings/security_analysis）实机文本回归。
//
// 边界强度：**实机 outerHTML 实证**（2026-09-27 维护者提供，classic 版页面）。
// 这是仓库设置里最大的一页：Advanced Security 总开关组 + Code scanning（CodeQL 默认配置、
// 两个确认弹层、AI Scan、Copilot Autofix、Protection rules）+ Secret Protection。
//
// 与**账户级**同页（/settings/security_analysis，词条在 pages/settings，见
// settings-security-analysis.test.ts）的关系：两页功能同名、路由互斥，本模块为同一批
// 说法各收一份**同译文**（Dependency graph / Dependabot alerts / Private vulnerability
// reporting / Grouped security updates / Block commits that contain… 都在两份里出现）。
// 有些节点在本页被切得更碎（如 Dependabot security updates 那句把后半句也并进了同一节点），
// 因此键串与账户级不完全相同，这不是重复登记。
//
// 三条动态文本走规则，不在静态键里：
//   repo-settings/advanced-security-intro（页头说明句，含撇号）
//   repo-settings/dependabot-rules-enabled-count（`1 rule enabled`）
//   repo-settings/languages-selected-count（`2 of 2 languages selected`）
//
// 刻意**不收录**（下方反例断言）：产品与技术名 `Dependabot` / `CodeQL` / `GitHub` /
// `GitHub Actions` / `JavaScript` / `TypeScript`、分支名 `main`、`relative-time` 渲染出的
// 日期，以及 `Oppenheymu` / `Github-i18n` 这类用户内容。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

/** /Oppenheymu/Github-i18n/settings/security_analysis 命中的模块视图 */
const view = buildView(
	"/Oppenheymu/Github-i18n/settings/security_analysis",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机片段里的静态节点（原文 → 期望译文），顺序与页面出现顺序一致 */
const NODES: readonly (readonly [string, string])[] = [
	// —— Private vulnerability reporting ——
	["Private vulnerability reporting", "私密漏洞报告"],
	[
		"Allow your community to privately report potential security vulnerabilities to maintainers and repository owners.",
		"允许你的社区向维护者和仓库所有者私密报告潜在的安全漏洞。",
	],
	[
		"Learn more about private vulnerability reporting",
		"详细了解私密漏洞报告",
	],
	[
		"Disable private vulnerability reporting",
		"禁用私密漏洞报告",
	],
	// —— Dependency graph ——
	["Dependency graph", "依赖项关系图"],
	["Understand your dependencies.", "了解你的依赖项。"],
	["Disable dependency graph", "禁用依赖项关系图"],
	[
		"Disabling the dependency graph will also disable Dependabot alerts and Dependabot security updates.",
		"禁用依赖项关系图也会同时禁用 Dependabot 警报与 Dependabot 安全更新。",
	],
	// —— Automatic dependency submission ——
	["Automatic dependency submission", "自动依赖项提交"],
	[
		"Automatically detect and report build-time dependencies for select ecosystems.",
		"自动检测并报告部分生态系统的构建时依赖项。",
	],
	["Enabled", "启用"],
	["Disabled", "禁用"],
	["Use standard GitHub runners", "使用标准 GitHub 运行器"],
	["Enabled for labeled runners", "为带标签的运行器启用"],
	[
		"Use runners labeled with 'dependency-submission'",
		"使用带有 'dependency-submission' 标签的运行器",
	],
	[
		"No runners with this label assigned to repository",
		"此仓库未分配带有该标签的运行器",
	],
	// —— Dependabot ——
	[
		"Keep your dependencies secure and up-to-date.",
		"让你的依赖项保持安全且最新。",
	],
	["Learn more about Dependabot", "详细了解 Dependabot"],
	[
		"Receive alerts for vulnerabilities that affect your dependencies and manually generate Dependabot pull requests to resolve these vulnerabilities.",
		"接收影响你依赖项的漏洞警报，并手动生成 Dependabot 拉取请求来修复这些漏洞。",
	],
	["Configure alert notifications", "配置警报通知"],
	["Disable Dependabot alerts", "禁用 Dependabot 警报"],
	[
		"Disabling Dependabot alerts will also disable Dependabot security updates.",
		"禁用 Dependabot 警报也会同时禁用 Dependabot 安全更新。",
	],
	["Dependabot rules", "Dependabot 规则"],
	[
		"Create your own custom rules and manage alert presets.",
		"创建自定义规则并管理警报预设。",
	],
	["Configure dependabot rules", "配置 Dependabot 规则"],
	["Dependabot malware alerts", "Dependabot 恶意软件警报"],
	[
		"Receive alerts when malware is detected in your dependencies.",
		"当你的依赖项中检测到恶意软件时接收警报。",
	],
	["Disable malware alerts", "禁用恶意软件警报"],
	["Dependabot security updates", "Dependabot 安全更新"],
	[
		"Enabling this option will result in Dependabot automatically attempting to open pull requests to resolve every open Dependabot alert with an available patch. If you would like more specific configuration options, leave this disabled and use",
		"启用此选项后，Dependabot 会自动尝试为每个有可用补丁且尚未解决的 Dependabot 警报打开拉取请求。如果你需要更具体的配置选项，请保持此选项禁用，并使用",
	],
	[
		"Disable dependabot security updates",
		"禁用 Dependabot 安全更新",
	],
	["Grouped security updates", "分组安全更新"],
	[
		"Groups all available updates that resolve a Dependabot alert into one pull request (per package manager and directory of requirement manifests). This option may be overridden by group rules specified in dependabot.yml -",
		"把解决某个 Dependabot 警报的所有可用更新分组为一个拉取请求（按包管理器与依赖清单所在目录分别处理）。此选项可能被 dependabot.yml 中指定的分组规则覆盖 -",
	],
	[
		"Learn how to group updates.",
		"了解如何对更新进行分组。",
	],
	["Dependabot version updates", "Dependabot 版本更新"],
	[
		"Allow Dependabot to open pull requests automatically to keep your dependencies up-to-date when new versions are available.",
		"允许 Dependabot 在有新版本可用时自动打开拉取请求，让你的依赖项保持最新。",
	],
	[
		"Learn more about configuring a dependabot.yml file",
		"进一步了解如何配置 dependabot.yml 文件",
	],
	[
		"Configure Dependabot version updates",
		"配置 Dependabot 版本更新",
	],
	// —— Code scanning：CodeQL 分析那段被链接切成四段，逐段登记 ——
	["Code scanning", "代码扫描"],
	[
		"Automatically detect common vulnerabilities and coding errors.",
		"自动检测常见漏洞和编码错误。",
	],
	["Tools", "工具"],
	["CodeQL analysis", "CodeQL 分析"],
	["Identify vulnerabilities and errors with", "使用"],
	["for", "为"],
	["eligible", "符合条件的"],
	["repositories.", "仓库识别漏洞和错误。"],
	["Default setup", "默认设置"],
	["Last scan", "上次扫描"],
	["More options", "更多选项"],
	["View last scan log", "查看上次扫描日志"],
	["View Code Scanning alerts", "查看代码扫描警报"],
	["View CodeQL configuration", "查看 CodeQL 配置"],
	["Switch to advanced", "切换到高级设置"],
	[
		"Customize your CodeQL configuration via a YAML file checked into the repository.",
		"通过签入仓库的 YAML 文件自定义 CodeQL 配置。",
	],
	["Disable CodeQL", "禁用 CodeQL"],
	["Disable CodeQL?", "禁用 CodeQL？"],
	[
		"CodeQL will stop analyzing code from this repository. Existing alerts will remain open; you can dismiss them but not close them as fixed, as CodeQL needs to be enabled for that to happen. Existing CodeQL Actions workflows on this repository must be",
		"CodeQL 将停止分析此仓库中的代码。现有警报会保持打开状态；你可以忽略它们，但无法将其标记为已修复关闭，因为那需要启用 CodeQL。此仓库上现有的 CodeQL Actions 工作流必须",
	],
	[
		"manually re-enabled to resume previous analyses",
		"手动重新启用才能恢复先前的分析",
	],
	["Disabling CodeQL...", "正在禁用 CodeQL…"],
	[
		"Switch to a CodeQL workflow?",
		"切换到 CodeQL 工作流？",
	],
	[
		"To switch to a workflow-based configuration, we must disable CodeQL first. CodeQL will stop analyzing code and resume once a valid workflow file is committed to the repository.",
		"要切换到基于工作流的配置，我们必须先禁用 CodeQL。CodeQL 将停止分析代码，待仓库中提交有效的工作流文件后便会恢复。",
	],
	["Something went wrong.", "出了点问题。"],
	["Other tools", "其他工具"],
	[
		"Add any third-party code scanning tool.",
		"添加任何第三方代码扫描工具。",
	],
	["Explore workflows", "浏览工作流"],
	// —— CodeQL 默认配置弹层 ——
	["CodeQL default configuration", "CodeQL 默认配置"],
	["Languages", "语言"],
	[
		"These languages were detected on the default branch of this repository.",
		"这些语言是在此仓库的默认分支上检测到的。",
	],
	["Query suites", "查询套件"],
	["Group of queries", "一组查询"],
	["to run against your code.", "用来对你的代码运行。"],
	["CodeQL high-precision queries.", "CodeQL 高精度查询。"],
	["Runner type", "运行器类型"],
	[
		"This is the runner default setup will use to run",
		"这是默认设置运行时将使用的运行器",
	],
	["Loading runner info...", "正在加载运行器信息…"],
	["Scan events", "扫描事件"],
	[
		"These events will trigger a new scan.",
		"这些事件会触发新的扫描。",
	],
	[
		"On push and pull requests to",
		"在推送到以下目标以及向其发起拉取请求时：",
	],
	["On a weekly schedule", "按每周计划"],
	["Next scan of", "下次扫描"],
	// —— AI Scan / Copilot Autofix ——
	["AI Scan", "AI 扫描"],
	["AI Scan for pull requests", "拉取请求的 AI 扫描"],
	[
		"Generate security findings for non-CodeQL languages using AI. Learn more",
		"使用 AI 为非 CodeQL 语言生成安全发现。进一步了解",
	],
	["about AI Scan", "AI 扫描"],
	[
		"AI Scan for pull requests enablement",
		"拉取请求 AI 扫描启用状态",
	],
	["Copilot Autofix", "Copilot 自动修复"],
	[
		"Suggest fixes for CodeQL alerts using AI. CodeQL default or advanced setup must be enabled for this feature to work. Learn more about the",
		"使用 AI 为 CodeQL 警报建议修复方案。必须启用 CodeQL 默认或高级设置，此功能才能正常工作。进一步了解",
	],
	[
		"limitations of autofix code suggestions",
		"自动修复代码建议的限制",
	],
	[
		"Copilot Autofix enablement",
		"Copilot 自动修复启用状态",
	],
	// —— Protection rules ——
	["Protection rules", "保护规则"],
	["Check runs failure threshold", "检查运行失败阈值"],
	[
		"Select the alert severity level for code scanning check runs to fail.",
		"选择会让代码扫描检查运行失败的警报严重性级别。",
	],
	["Create a branch ruleset", "创建分支规则集"],
	[
		"to prevent a branch from merging when these checks fail.",
		"以便在这些检查失败时阻止分支合并。",
	],
	[
		"Security alert severity level:",
		"安全警报严重性级别：",
	],
	["Only critical", "仅严重"],
	["Any", "任何"],
	[
		"Standard alert severity level:",
		"标准警报严重性级别：",
	],
	["Only errors", "仅错误"],
	["Errors and warnings", "错误与警告"],
	// —— Secret Protection ——
	["Secret Protection", "机密保护"],
	[
		"GitHub will always send alerts to partners for detected secrets in public repositories.",
		"对于在公开仓库中检测到的机密，GitHub 始终会向合作伙伴发送警报。",
	],
	[
		"Learn more about partner patterns",
		"进一步了解合作伙伴模式",
	],
	["Disable Secret Protection", "禁用机密保护"],
	[
		"This will disable Secret Protection for your repository.",
		"这将为你的仓库禁用机密保护。",
	],
	["Disable secret scanning alerts", "禁用机密扫描警报"],
	["Push protection", "推送保护"],
	["Block commits that contain", "阻止包含"],
	["supported secrets", "受支持的机密"],
	["Disable push protection", "禁用推送保护"],
];

/** 产品与技术名、分支名与用户内容：整节点不收录，必须保持英文 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"Dependabot",
	"CodeQL",
	"GitHub",
	"GitHub Actions",
	"JavaScript / TypeScript",
	"main",
	"Oppenheymu",
	"Github-i18n",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/**
 * 按节点顺序拼接（未命中的节点保留原文），并**保留每个节点的首尾空白**——
 * 实机渲染就是这样：译文本身不带空格，段与段之间的空格来自原文节点。
 */
function renderNodes(nodes: readonly string[]): string {
	return nodes
		.map((node) => {
			const translated = translateText(node, view);
			if (translated === null) return node;
			const leading = node.match(/^\s*/)?.[0] ?? "";
			const trailing = node.match(/\s*$/)?.[0] ?? "";
			return leading + translated + trailing;
		})
		.join("");
}

describe("仓库设置页的安全分析子页的实机节点边界", () => {
	it("translates every static text node and translatable attribute", () => {
		for (const [node, expected] of NODES) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, view),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("keeps product names, branch names and user content in english", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("translates the header sentence through a rule, for both apostrophes", () => {
		const expected =
			"高级安全功能可帮助你的仓库保持安全与最新。启用这些功能即表示你授权我们对你的仓库执行只读分析。";
		// 直撇号与弯撇号都要命中：粘贴来的文本撇号形态不可靠，规则用字符类同时覆盖
		for (const sentence of [
			"Advanced Security features help keep your repository secure and updated. By enabling these features, you're granting us permission to perform read-only analysis on your repository.",
			"Advanced Security features help keep your repository secure and updated. By enabling these features, you\u2019re granting us permission to perform read-only analysis on your repository.",
		]) {
			expect(translateText(sentence, view)).toBe(expected);
		}
		// 换成账户级的复数措辞（repositories）不该命中本规则
		expect(
			translateText(
				"Advanced Security features help keep your repository secure and updated. By enabling these features, you're granting us permission to perform read-only analysis on your repositories.",
				view,
			),
		).toBeNull();
	});

	it("translates the two dynamic counters through rules", () => {
		expect(translateText("1 rule enabled", view)).toBe(
			"已启用 1 条规则",
		);
		expect(translateText("3 rules enabled", view)).toBe(
			"已启用 3 条规则",
		);
		expect(
			translateText("2 of 2 languages selected", view),
		).toBe("已选择 2/2 种语言");
		expect(
			translateText("1 of 3 languages selected", view),
		).toBe("已选择 1/3 种语言");
	});

	it("reassembles the split sentences into readable chinese", () => {
		// 私密漏洞报告：整句 + 文档链接
		expect(
			renderNodes([
				"Allow your community to privately report potential security vulnerabilities to maintainers and repository owners. ",
				"Learn more about private vulnerability reporting",
			]),
		).toBe(
			"允许你的社区向维护者和仓库所有者私密报告潜在的安全漏洞。 详细了解私密漏洞报告",
		);
		// Dependabot security updates：整句 + Dependabot rules 链接
		expect(
			renderNodes([
				"Enabling this option will result in Dependabot automatically attempting to open pull requests to resolve every open Dependabot alert with an available patch. If you would like more specific configuration options, leave this disabled and use ",
				"Dependabot rules",
			]),
		).toBe(
			"启用此选项后，Dependabot 会自动尝试为每个有可用补丁且尚未解决的 Dependabot 警报打开拉取请求。如果你需要更具体的配置选项，请保持此选项禁用，并使用 Dependabot 规则",
		);
		// CodeQL 分析：四段拆句（CodeQL 是产品名，保留英文）
		expect(
			renderNodes([
				"Identify vulnerabilities and errors with ",
				"CodeQL",
				" for ",
				"eligible",
				" repositories.",
			]),
		).toBe(
			"使用 CodeQL 为 符合条件的 仓库识别漏洞和错误。",
		);
		// CodeQL 默认配置：「一组查询」+ 尾段
		expect(
			renderNodes([
				"Group of queries",
				" to run against your code.",
			]),
		).toBe("一组查询 用来对你的代码运行。");
		// AI Scan：整句 + about AI Scan 链接
		expect(
			renderNodes([
				"Generate security findings for non-CodeQL languages using AI. Learn more ",
				"about AI Scan",
			]),
		).toBe(
			"使用 AI 为非 CodeQL 语言生成安全发现。进一步了解 AI 扫描",
		);
		// Protection rules：整句 + 规则集链接 + 尾段
		expect(
			renderNodes([
				"Select the alert severity level for code scanning check runs to fail. ",
				"Create a branch ruleset",
				" to prevent a branch from merging when these checks fail.",
			]),
		).toBe(
			"选择会让代码扫描检查运行失败的警报严重性级别。 创建分支规则集 以便在这些检查失败时阻止分支合并。",
		);
		// 扫描事件：分支名 main 保留英文，`and` / `protected branches` 用本模块既有译文
		expect(
			renderNodes([
				"On push and pull requests to",
				"main",
				" and ",
				"protected branches",
			]),
		).toBe(
			"在推送到以下目标以及向其发起拉取请求时：main 与 受保护的分支",
		);
		// Push protection：阻止包含 + 受支持的机密 + 纯符号尾节点
		// （`.` 是独立文本节点，按既定口径不收录，故实机末尾仍是半角句点）
		expect(
			renderNodes([
				"Block commits that contain ",
				"supported secrets",
				".",
			]),
		).toBe("阻止包含 受支持的机密.");
		// Secret Protection：整句 + partner patterns 链接
		expect(
			renderNodes([
				"GitHub will always send alerts to partners for detected secrets in public repositories. ",
				"Learn more about partner patterns",
			]),
		).toBe(
			"对于在公开仓库中检测到的机密，GitHub 始终会向合作伙伴发送警报。 进一步了解合作伙伴模式",
		);
	});

	it("keeps the two severity pickers' labels apart from their values", () => {
		// 下拉的标签与当前值是两个节点（同一个按钮里），拼接串不该命中
		expect(
			translateText(
				"Security alert severity level: High or higher",
				view,
			),
		).toBeNull();
		expect(
			translateText(
				"Standard alert severity level: Only errors",
				view,
			),
		).toBeNull();
	});
});
