// 词典数据注册表：只做「语言 → JSONC 原始数据」的映射，不含编译与容错。
//
// 为什么要独立成一层：运行时（index.ts）需要「单模块失败不拖垮整站」的容错，
// 而门禁（tooling/checks/dict.ts）必须对同一份数据严格到报错。若门禁直接 import
// index.ts，坏数据会被 index.ts 静默跳过、门禁反而变绿——这正是最危险的失真。
// 两边都从这里取数据，编译逻辑共用 load.ts，只有失败处理策略不同。
//
// 三份语言无关的数据在 core/ 下：
//   modules.jsonc   模块名 + 路由，顺序即优先级（具体页在前、global 兜底在后）
//   rules.jsonc     共享规则：id + pattern，顺序即语义
//   aliases.jsonc   上游改名映射：DOM 文本 → 规范键
// canonical.jsonc 只是门禁用的键清单（覆盖率分母 / 拼错即报），运行时不需要，故不进包。
//
// locales/<语言>/ 下只有译文，且**允许缺口**：没翻译的模块整个文件都不必有，
// 没翻译的规则也不必出现在 rules.jsonc 里——引擎未命中即保留英文，缺键 = 未翻译。
//
// 顺序即优先级（具体页在前、泛化页在后）：buildView 词条「先到先得」、
// 规则「首条命中生效」。已知有意的跨模块同键异译——靠 core/modules.jsonc 的顺序压过
// 泛化模块，属于设计意图，勿当「重复键」清理：
//   "Actions"      pages/repo-settings「Actions 工作流」压 pages/repo「操作」
//   "Name"         pages/settings「姓名」压 pages/repo「名称」
//   "Pages"        pages/repo-settings「页面」（GitHub Pages）压 global「页码」（分页）
//   "Write"        pages/repo-settings「写入」（权限级别）压 global「编写」
//   "GitHub Apps"  pages/repo-settings「GitHub 应用」压 pages/marketing「GitHub 应用程序」
//                 （marketing 路由 ^/(features|pricing) 与 repo-settings 永不共存，故顺序不影响结果）
//   "Contributors" pages/repo-settings「贡献者」（交互限制下拉的档位）压 pages/repo「贡献者」
//                 ——两个模块的**译文相同**，碰撞只是登记在两个模块里的结果，不影响实机显示
// 这里只是常见几条的索引，**完整清单以 tooling/fixtures/view-skeleton.<语言>.json 为准**：
// 视图骨架门禁会记录每条探针路径上所有「被 ≥2 个命中模块提供」的键及其胜出模块，
// 顺序或词条一变就报错（键数与记录数随词典增长，别把这里的数字当成断言口径）。
// 上面手写清单里的 Actions / Name / Write 属于「数据层同键异译」（zh-CN 数据层有若干键在不同模块
// 译文不同），但它们大多不在同一条路径上共存，因此在实机视图里不构成碰撞——别把这份清单当成
// 「有意异译」的完整枚举。

import aliasesRaw from "./core/aliases.jsonc";
import modulesRaw from "./core/modules.jsonc";
import rulesRaw from "./core/rules.jsonc";
import jaGlobalRaw from "./locales/ja/global.jsonc";
import jaActionsRaw from "./locales/ja/pages/actions.jsonc";
import jaAgentsRaw from "./locales/ja/pages/agents.jsonc";
import jaCommitsRaw from "./locales/ja/pages/commits.jsonc";
import jaDashboardRaw from "./locales/ja/pages/dashboard.jsonc";
import jaIssuesRaw from "./locales/ja/pages/issues.jsonc";
import jaPullsRaw from "./locales/ja/pages/pulls.jsonc";
import jaSearchRaw from "./locales/ja/pages/search.jsonc";
import jaWikiRaw from "./locales/ja/pages/wiki.jsonc";
import jaRulesRaw from "./locales/ja/rules.jsonc";
import zhGlobalRaw from "./locales/zh-CN/global.jsonc";
import zhActionsRaw from "./locales/zh-CN/pages/actions.jsonc";
import zhAgentsRaw from "./locales/zh-CN/pages/agents.jsonc";
import zhCommitsRaw from "./locales/zh-CN/pages/commits.jsonc";
import zhDashboardRaw from "./locales/zh-CN/pages/dashboard.jsonc";
import zhDiscussionsRaw from "./locales/zh-CN/pages/discussions.jsonc";
import zhInsightsRaw from "./locales/zh-CN/pages/insights.jsonc";
import zhIssuesRaw from "./locales/zh-CN/pages/issues.jsonc";
import zhMarketingRaw from "./locales/zh-CN/pages/marketing.jsonc";
import zhOrgSettingsRaw from "./locales/zh-CN/pages/org-settings.jsonc";
import zhProfileRaw from "./locales/zh-CN/pages/profile.jsonc";
import zhPullsRaw from "./locales/zh-CN/pages/pulls.jsonc";
import zhRepoRaw from "./locales/zh-CN/pages/repo.jsonc";
import zhRepoSettingsRaw from "./locales/zh-CN/pages/repo-settings.jsonc";
import zhSearchRaw from "./locales/zh-CN/pages/search.jsonc";
import zhSettingsRaw from "./locales/zh-CN/pages/settings.jsonc";
import zhSettingsBillingRaw from "./locales/zh-CN/pages/settings-billing.jsonc";
import zhSettingsSecurityRaw from "./locales/zh-CN/pages/settings-security.jsonc";
import zhWikiRaw from "./locales/zh-CN/pages/wiki.jsonc";
import zhRulesRaw from "./locales/zh-CN/rules.jsonc";
import type { LocaleId } from "./locales.ts";

/** 语言无关的核心原始数据（编辑器侧形状校验见 types/dict.schema.json） */
export const coreRawDict: {
	readonly modules: unknown;
	readonly rules: unknown;
	readonly aliases: unknown;
} = {
	modules: modulesRaw,
	rules: rulesRaw,
	aliases: aliasesRaw,
};

/** 一种语言的原始数据：模块名 → 词条，另有规则模板 */
export interface LocaleRaw {
	readonly locale: LocaleId;
	/** 模块名 → JSONC 词条原始数据；缺模块 = 该语言尚未翻译该模块 */
	readonly modules: readonly (readonly [string, unknown])[];
	/** locales/<语言>/rules.jsonc 原始数据；null = 该语言一个规则模板都没写 */
	readonly rules: unknown | null;
}

/** 各语言的原始数据：新增语言在这里追加一段（顺序仅影响可读性） */
export const localeRawDicts: readonly LocaleRaw[] = [
	{
		locale: "zh-CN",
		modules: [
			["global", zhGlobalRaw],
			["pages/issues", zhIssuesRaw],
			["pages/pulls", zhPullsRaw],
			["pages/settings", zhSettingsRaw],
			["pages/settings-billing", zhSettingsBillingRaw],
			// 账号安全页单独成模块（路由重叠，词条逐键先到先得）：理由见 core/modules.jsonc
			["pages/settings-security", zhSettingsSecurityRaw],
			["pages/repo-settings", zhRepoSettingsRaw],
			// 组织设置单独成模块（路由与 repo-settings 互斥）：理由见 core/modules.jsonc
			["pages/org-settings", zhOrgSettingsRaw],
			["pages/actions", zhActionsRaw],
			["pages/agents", zhAgentsRaw],
			["pages/dashboard", zhDashboardRaw],
			["pages/commits", zhCommitsRaw],
			["pages/discussions", zhDiscussionsRaw],
			["pages/wiki", zhWikiRaw],
			["pages/insights", zhInsightsRaw],
			["pages/search", zhSearchRaw],
			["pages/marketing", zhMarketingRaw],
			["pages/profile", zhProfileRaw],
			["pages/repo", zhRepoRaw],
		],
		rules: zhRulesRaw,
	},
	{
		// 日语：规则模板已全量（786/786），词条仍是稀疏覆盖——已翻的模块逐个列在这里，
		// 没列出的模块 = 尚未翻译（引擎未命中即保留英文，缺文件不是错误）。
		// 由于规则按模块独立生效，未翻模块的页面会呈现「规则覆盖的动态节点是日语、
		// 静态词条仍是英语」的混排，这是「先同步规则、后补词条」的中间态，
		// 详见 docs/guides/development.md 的「稀疏覆盖」一节。
		locale: "ja",
		modules: [
			["global", jaGlobalRaw],
			// 以下按 core/modules.jsonc 的顺序排列（顺序只影响可读性：视图合并顺序由 core 那份决定）
			["pages/issues", jaIssuesRaw],
			["pages/pulls", jaPullsRaw],
			["pages/actions", jaActionsRaw],
			["pages/agents", jaAgentsRaw],
			["pages/dashboard", jaDashboardRaw],
			["pages/commits", jaCommitsRaw],
			["pages/wiki", jaWikiRaw],
			["pages/search", jaSearchRaw],
		],
		rules: jaRulesRaw,
	},
];
