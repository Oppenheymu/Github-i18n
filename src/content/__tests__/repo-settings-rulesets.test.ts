// 仓库设置页的「规则集」两支（/owner/repo/settings/rules 列表页与
// /owner/repo/settings/rules/<id> 详情页）实机文本回归。
//
// 证据：维护者 2026-09-27 导出的漏翻清单（`github-zh-misses/1`，path 全为
// /Oppenheymu/Github-i18n/settings/rules/24064311）＋ 两张实机截图（列表页与
// 「New ruleset」下拉）＋ 随后贴出的两段实机 HTML（状态检查与「合并前需要拉取请求」
// 两个规则的展开面板、绕过模式菜单）。本页此前**没有任何**词条，属整页新增。
//
// 本页最重要的三个边界事实：
//   1. 规则名（Protect Default Branch）、仓库名、用户名、分支名与产品名一律保持英文
//      ——未命中即保留英文，硬收会让门禁报「译文与键同形」；
//   2. 组合型 aria-label（`Active, Enforcement status`、`Roles, Filter actors by category`）
//      是**属性**：属性不走正则规则（见 src/content/walker.ts），故只能逐条收静态键；
//   3. 含动态值的文本（列表行计数、目标计数、面包屑、`Apps • <应用名>`）只能靠规则，
//      且分隔符在实机可能是项目符号或中点——pattern 用字符类同时覆盖两种字形。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

/** /Oppenheymu/Github-i18n/settings/rules/24064311 命中的模块视图 */
const view = buildView(
	"/Oppenheymu/Github-i18n/settings/rules/24064311",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机节点原文 → 期望译文（含文本节点与 aria-label / placeholder 属性） */
const NODES: readonly (readonly [string, string])[] = [
	// —— 列表页与溢出菜单 ——
	["Export ruleset", "导出规则集"],
	["Delete ruleset", "删除规则集"],
	["New ruleset", "新建规则集"],
	["New branch ruleset", "新建分支规则集"],
	["New tag ruleset", "新建标签规则集"],
	["Import a ruleset", "导入规则集"],
	[
		"Choose a JSON file to upload",
		"选择要上传的 JSON 文件",
	],
	// —— 详情页头部 ——
	["Ruleset", "规则集"],
	["Branch rules", "分支规则"],
	["Enforcement status", "执行状态"],
	["Active", "启用"],
	["Active, Enforcement status", "启用，执行状态"],
	// —— 目标分支 ——
	["Branch targeting criteria", "分支目标条件"],
	["Target branches", "目标分支"],
	["Which branches should be matched?", "应匹配哪些分支？"],
	[
		"Target by inclusion or exclusion pattern",
		"按包含或排除模式设定目标",
	],
	["Include all branches", "包含所有分支"],
	["Include default branch", "包含默认分支"],
	["Include by pattern", "按模式包含"],
	["Exclude by pattern", "按模式排除"],
	["Add target", "添加目标"],
	["Applies to", "适用于"],
	// —— 绕过名单 ——
	["Bypass actor actions", "绕过操作者操作"],
	["Select bypass mode", "选择绕过模式"],
	["Always allow", "始终允许"],
	["Add bypass", "添加绕过"],
	["Actors", "操作者"],
	["Roles", "角色"],
	["Teams", "团队"],
	["Apps", "应用"],
	["Others", "其他"],
	["Other", "其他"],
	["Repository admin", "仓库管理员"],
	["Filter actors by category", "按类别筛选操作者"],
	["Filter actors", "筛选操作者"],
	[
		"All, Filter actors by category",
		"全部，按类别筛选操作者",
	],
	[
		"Roles, Filter actors by category",
		"角色，按类别筛选操作者",
	],
	[
		"Teams, Filter actors by category",
		"团队，按类别筛选操作者",
	],
	[
		"Apps, Filter actors by category",
		"应用，按类别筛选操作者",
	],
	[
		"Others, Filter actors by category",
		"其他，按类别筛选操作者",
	],
	[
		"Users, Filter actors by category",
		"用户，按类别筛选操作者",
	],
	[
		"Items will be filtered as you type",
		"输入时将筛选条目",
	],
	[
		"Choose which roles, teams, agents, apps, and users can bypass this ruleset",
		"选择哪些角色、团队、代理、应用和用户可以绕过此规则集",
	],
	[
		"Exempt roles, teams, agents, apps, and users from this ruleset by adding them to the bypass list.",
		"将这些角色、团队、代理、应用和用户加入绕过名单，即可让他们不受此规则集约束。",
	],
	["No apps in bypass list", "绕过名单中没有应用"],
	["No roles in bypass list", "绕过名单中没有角色"],
	["No teams in bypass list", "绕过名单中没有团队"],
	[
		"No other actors in bypass list",
		"绕过名单中没有其他操作者",
	],
	// —— 规则列表 ——
	["Which rules should be applied?", "应应用哪些规则？"],
	["Rules", "规则"],
	["Show additional settings", "显示其他设置"],
	["Open additional options", "打开其他选项"],
	["Include:", "包含："],
	[
		"Require a pull request before merging",
		"合并前需要拉取请求",
	],
	[
		"Require all commits be made to a non-target branch and submitted via a pull request before they can be merged.",
		"要求所有提交必须先推送到非目标分支并通过拉取请求提交，然后才能合并。",
	],
	["Block force pushes", "阻止强制推送"],
	[
		"Prevent users with push access from force pushing to refs.",
		"防止有推送权限的用户强制推送到引用。",
	],
	["Require linear history", "要求线性历史"],
	[
		"Prevent merge commits from being pushed to matching refs.",
		"防止合并提交被推送到匹配的引用。",
	],
	["Require signed commits", "要求签名提交"],
	[
		"Commits pushed to matching refs must have verified signatures.",
		"推送到匹配引用的提交必须具有已验证的签名。",
	],
	["Require deployments to succeed", "要求部署成功"],
	[
		"Choose which environments must be successfully deployed to before refs can be pushed into a ref that matches this rule.",
		"选择必须先成功部署到哪些环境，才能将引用推送到匹配此规则的引用。",
	],
	["Require status checks to pass", "要求状态检查通过"],
	[
		"Choose which status checks must pass before the ref is updated. When enabled, commits must first be pushed to another ref where the checks pass.",
		"选择在更新引用之前必须通过哪些状态检查。启用后，提交必须先推送到检查通过的另一引用。",
	],
	["Require code scanning results", "要求代码扫描结果"],
	[
		"Choose which tools must provide code scanning results before the reference is updated. When configured, code scanning must be enabled and have results for both the commit and the reference being updated.",
		"选择在更新引用之前必须由哪些工具提供代码扫描结果。配置后，必须启用代码扫描，并且提交与要更新的引用都要有扫描结果。",
	],
	["Require code quality results", "要求代码质量结果"],
	[
		"Choose which severity levels of code quality results should block pull request merges. When configured, a code quality analysis must be done on the pull request before the changes can be merged.",
		"选择哪些严重级别的代码质量结果应阻止拉取请求合并。配置后，必须先对拉取请求完成代码质量分析，更改才能合并。",
	],
	[
		"The lowest severity level at which code quality reviews need to be resolved before commits can be merged.",
		"在提交可以合并之前，代码质量审查需要解决的最低严重级别。",
	],
	["Restrict code coverage", "限制代码覆盖率"],
	[
		"Enforce minimum line coverage thresholds on pull requests. When configured, uploaded coverage data must meet the specified criteria before changes can be merged.",
		"对拉取请求强制执行最低行覆盖率阈值。配置后，上传的覆盖率数据必须满足指定条件，更改才能合并。",
	],
	["Restrict creations", "限制创建"],
	[
		"Only allow users with bypass permission to create matching refs.",
		"仅允许具有绕过权限的用户创建匹配的引用。",
	],
	["Restrict updates", "限制更新"],
	[
		"Only allow users with bypass permission to update matching refs.",
		"仅允许具有绕过权限的用户更新匹配的引用。",
	],
	["Restrict deletions", "限制删除"],
	[
		"Only allow users with bypass permissions to delete matching refs.",
		"仅允许具有绕过权限的用户删除匹配的引用。",
	],
	[
		"Automatically request Copilot code review",
		"自动请求 Copilot 代码审查",
	],
	[
		"Request Copilot code review for new pull requests automatically if the author has access to Copilot code review and their premium requests quota has not reached the limit.",
		"如果作者可以使用 Copilot 代码审查且其高级请求配额未达上限，就自动为新拉取请求请求 Copilot 代码审查。",
	],
	// —— 代码扫描工具与严重性阈值 ——
	[
		"Required tools and alert thresholds",
		"必需的工具与警报阈值",
	],
	["Code scanning tools", "代码扫描工具"],
	[
		"Tools that must provide code scanning results for this rule to pass.",
		"必须提供代码扫描结果，此规则才算通过的工具。",
	],
	["Add tool", "添加工具"],
	["Delete tool", "删除工具"],
	["Tool name", "工具名称"],
	["Enter a tool name", "输入工具名称"],
	[
		"Learn more about enabling code scanning.",
		"进一步了解如何启用代码扫描。",
	],
	["Security alerts", "安全警报"],
	["Alerts", "警报"],
	["Severity", "严重性"],
	["Select Severity", "选择严重性"],
	["Default", "默认"],
	["Errors", "错误"],
	["Errors and Warnings", "错误与警告"],
	["Warnings and higher", "警告或更高"],
	["Notes and higher", "提示或更高"],
	["High or higher", "高或更高"],
	["Medium or higher", "中或更高"],
	["Critical", "严重"],
	// —— 底部固定操作栏 ——
	["Revert", "还原"],
	["Revert changes", "还原更改"],
	["Save changes", "保存更改"],
	// —— 规则项展开面板（维护者 2026-09-27 贴出的两段实机 HTML）——
	["Hide additional settings", "隐藏其他设置"],
	[
		"Require branches to be up to date before merging",
		"要求分支在合并前保持最新",
	],
	[
		"Whether pull requests targeting a matching branch must be tested with the latest code. This setting will not take effect unless at least one status check is enabled.",
		"针对匹配分支的拉取请求是否必须用最新代码进行测试。除非至少启用一项状态检查，否则此设置不会生效。",
	],
	[
		"Do not require status checks on creation",
		"创建时不要求状态检查",
	],
	[
		"Allow repositories and branches to be created if a check would otherwise prohibit it.",
		"如果某项检查本会阻止创建，仍允许创建仓库和分支。",
	],
	["No required checks", "没有必需的状态检查"],
	["Add checks", "添加检查"],
	["No checks have been added", "尚未添加任何检查"],
	["Learn more about status checks", "进一步了解状态检查"],
	["Required approvals", "必需的批准数"],
	[
		"The number of approving reviews that are required before a pull request can be merged.",
		"拉取请求可以合并之前所需的批准审查数量。",
	],
	[
		"Dismiss stale pull request approvals when new commits are pushed",
		"推送新提交时忽略过期的拉取请求批准",
	],
	[
		"New, reviewable commits pushed will dismiss previous pull request review approvals.",
		"推送新的可审查提交将忽略之前的拉取请求审查批准。",
	],
	[
		"Require review from specific teams",
		"要求特定团队审查",
	],
	[
		"A collection of reviewers and associated file patterns. Each reviewer has a list of file patterns which determine the files that reviewer is required to review.",
		"一组审查者及其关联的文件模式。每个审查者都有一份文件模式列表，用于确定该审查者必须审查哪些文件。",
	],
	["Require review from Code Owners", "要求代码所有者审查"],
	[
		"Require an approving review in pull requests that modify files that have a designated code owner.",
		"在修改了指定代码所有者文件的拉取请求中要求批准审查。",
	],
	[
		"Require approval of the most recent reviewable push",
		"要求批准最近一次可审查的推送",
	],
	[
		"Whether the most recent reviewable push must be approved by someone other than the person who pushed it.",
		"最近一次可审查的推送是否必须由推送者以外的人批准。",
	],
	[
		"Require conversation resolution before merging",
		"合并前要求解决所有对话",
	],
	[
		"All conversations on code must be resolved before a pull request can be merged.",
		"拉取请求合并前，代码上的所有对话都必须解决。",
	],
	[
		"Require an additional approval for unattributed Copilot pull requests",
		"对无归属的 Copilot 拉取请求要求额外批准",
	],
	// 实机原文尾随一个空格（React 模板拼接），normalizeKey 会折叠掉
	[
		"When Copilot opens a pull request without a human collaborator, require one more approving review if a non-zero approval count is required. ",
		"当 Copilot 在没有人类协作者的情况下打开拉取请求时，如果要求的批准数不为零，则再要求一次批准审查。",
	],
	["Allowed merge methods", "允许的合并方式"],
	[
		"Squash, Allowed merge methods",
		"压缩合并，允许的合并方式",
	],
	// 显示值与 aria-label 都是「已选合并方式」的连缀。顺序实证：只选 Squash 时是
	// `Squash`，Squash + Merge 时是 `Squash, Merge`（维护者 2026-09-27 贴的按钮 HTML），
	// 故按 Squash → Merge → Rebase 的固定顺序穷举七种组合
	["Squash", "压缩合并"],
	["Merge", "合并"],
	["Rebase", "变基"],
	["Squash, Merge", "压缩合并、合并"],
	["Squash, Rebase", "压缩合并、变基"],
	["Merge, Rebase", "合并、变基"],
	["Squash, Merge, Rebase", "压缩合并、合并、变基"],
	["Merge, Allowed merge methods", "合并，允许的合并方式"],
	["Rebase, Allowed merge methods", "变基，允许的合并方式"],
	[
		"Squash, Merge, Allowed merge methods",
		"压缩合并、合并，允许的合并方式",
	],
	[
		"Squash, Rebase, Allowed merge methods",
		"压缩合并、变基，允许的合并方式",
	],
	[
		"Merge, Rebase, Allowed merge methods",
		"合并、变基，允许的合并方式",
	],
	[
		"Squash, Merge, Rebase, Allowed merge methods",
		"压缩合并、合并、变基，允许的合并方式",
	],
	[
		"When merging pull requests, you can allow any combination of merge commits, squashing, or rebasing. At least one option must be enabled.",
		"合并拉取请求时，你可以允许合并提交、压缩合并、变基的任意组合。至少必须启用一项。",
	],
	// —— 绕过模式菜单 ——
	["Always", "始终"],
	[
		"The ruleset will be evaluated and the selected actor(s) will be prompted to bypass",
		"规则集会被评估，所选操作者将被提示绕过",
	],
	["Exempt", "豁免"],
	[
		"The ruleset will not be evaluated and no bypass prompt will be shown",
		"规则集不会被评估，也不会显示绕过提示",
	],
	["For pull requests only", "仅限拉取请求"],
	[
		"The ruleset will be enforced on command line changes and the selected actor(s) will be prompted to bypass only in a pull request",
		"规则集将在命令行更改上强制执行，所选操作者仅在拉取请求中会被提示绕过",
	],
	[
		"This ruleset will not be enforced",
		"此规则集不会被强制执行",
	],
];

describe("仓库设置页的规则集页实机节点边界", () => {
	it("translates every node of the maintainer's miss export", () => {
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

	it("translates the dynamic values through rules, not keys", () => {
		// 列表行计数：项目符号与中点两种字形都要命中（实机字形随改版变化）
		expect(
			translateText(
				"8 branch rules • targeting 1 branch",
				view,
			),
		).toBe("8 条分支规则 · 目标 1 个分支");
		expect(
			translateText(
				"8 branch rules · targeting 1 branch",
				view,
			),
		).toBe("8 条分支规则 · 目标 1 个分支");
		// 目标计数（单复数折叠）
		expect(translateText("1 target", view)).toBe(
			"1 个目标",
		);
		expect(translateText("3 targets", view)).toBe(
			"3 个目标",
		);
		// 面包屑标题：仓库名保留原文
		expect(
			translateText(
				"Settings · Rulesets · Github-i18n",
				view,
			),
		).toBe("设置 · 规则集 · Github-i18n");
		// 类别筛选器：应用名保留原文
		expect(translateText("Apps • github", view)).toBe(
			"应用 · github",
		);
		// 目标分支条件的删除按钮（sr-only）：默认分支那一条先命中
		expect(
			translateText("Delete include of Default", view),
		).toBe("删除默认分支的包含项");
		expect(
			translateText("Delete include of release/*", view),
		).toBe("删除 release/* 的包含项");
	});

	it("keeps the ruleset name, repository, user, branch and product names in english", () => {
		// 规则名是用户自命名的（维护者明确要求不翻译）
		expect(
			translateText("Protect Default Branch", view),
		).toBeNull();
		// 仓库名 / 用户名 / 分支名
		expect(translateText("Github-i18n", view)).toBeNull();
		expect(translateText("Oppenheymu", view)).toBeNull();
		expect(translateText("M. Oppenheymu", view)).toBeNull();
		expect(translateText("@Oppenheymu", view)).toBeNull();
		expect(translateText("main", view)).toBeNull();
		// 产品名与缩写
		expect(translateText("CodeQL", view)).toBeNull();
		expect(translateText("Dependabot", view)).toBeNull();
		expect(translateText("Copilot", view)).toBeNull();
		expect(translateText("OIDC", view)).toBeNull();
		// 快捷键提示：按键名在各语言里都保持英文
		expect(translateText("alt shift r", view)).toBeNull();
	});

	it("keeps the unowned bare word changes out of the dictionary", () => {
		// 漏翻清单里的孤立 changes（50 次）来源不明：它是泛化短词，
		// 收进来会命中用户内容（文件名 / 仓库名），故有意不收——未命中即保留英文。
		expect(translateText("changes", view)).toBeNull();
		// 用户名的组合型 aria-label 同理：属性不走规则，且收了会产出中英混杂
		expect(
			translateText(
				"Oppenheymu Bypass actor actions",
				view,
			),
		).toBeNull();
	});
});
