// 组织自定义属性页（/organizations/<组织>/settings/custom-properties）实机回归。
//
// 证据：2026-10-10 维护者贴的实机 outerHTML（`<react-app app-name="custom-properties">`，
// 采集时扩展仍在运行）。这次贴出的 HTML 自带**四条对照物**：placeholder 的
// `搜索或筛选`、联想列表 aria-label 的 `建议`、搜索按钮 tooltip 的 `搜索`、
// 溢出按钮里的 `更多`——前两条正是同一天前两批刚收的键（`Search or filter` /
// `Suggestions`），等于实机确认它们真的生效；其余英文才是本批清单。
// 同日维护者的**复测截图**又补两条：空态那三张建议卡是**上游轮换取样**的（截图里
// 是 `compliance_frameworks` / `monorepo` / `ci`，与 HTML 里的 `monorepo` /
// `databases` / `application_name` 不是同一组，故描述句只能见过一条收一条），
// 外加「Set values」页签里仓库行的 `No properties` + tooltip `Edit properties`。
// 再往后维护者贴的 `?tab=set-values` **整段 HTML** 补上该分支的其余文案（仓库列表
// 筛选框、空态标题）与**第三条**轮换样本（`backup_required` /
// `uses_external_packages`），并首次出现动态文案：页头与面包屑末项都是
// `Set properties on <仓库名>`，故本模块新增规则 `org-settings/set-properties-on`
//（这是本页唯一一条规则，也是本批唯一需要重生成骨架的改动）。
//
// 本文件锁四件事：
//   ① 路由：命中 pages/org-settings + global，不命中 pages/repo-settings；
//      新建页的地址 `/organizations/<组织>/settings/custom-property`（**单数**，
//      即 `New property` 按钮的 href）也在同一条路由下；
//   ② 页头 / 页签 / 筛选框 / 空态区块 / 「Set values」分支共 32 条键在实机节点上全部命中；
//   ③ 属性只走整串精确匹配：`Filter properties`（表单 aria-label 与 sr-only 标签同串）、
//      `Page selector`（nav 的 aria-label）、`See more suggested properties`
//      （按钮的 aria-label）三条都要能查到；
//   ④ 反例：三张建议卡的**属性名**是标识符（JSON 键）必须保持英文；溢出按钮里的
//      ` items` **有意不补**（泛化短词，组织账单页上另有一个裸 `items` 节点被列为
//      反例，词条是模块级的），故读屏文案留成「更多 items」；纯数字与可见性隐藏的
//      `(0)` 由守卫跳过；组织名是用户内容。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织自定义属性页（列表 + 空态） */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/custom-properties";
/** 旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const LEGACY_PATH =
	"/orgs/Koishi-CE/settings/custom-properties";
/** 新建属性页（`New property` 按钮的 href，单数 custom-property） */
const FORM_PATH =
	"/organizations/Koishi-CE/settings/custom-property";

const locale = dictForLocale("zh-CN");

const view = buildView(
	PAGE_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 实机里仍是英文的文本节点（按页面自上而下的顺序） */
const NEW_NODES: readonly (readonly [string, string])[] = [
	// 页头：H1 + 主按钮 + 副标题
	["Repository custom properties", "仓库自定义属性"],
	["New property", "新建属性"],
	[
		"Add metadata to your repositories, such as compliance frameworks, data sensitivity, or project details.",
		"为你的仓库添加元数据，例如合规框架、数据敏感度或项目详情。",
	],
	// 页签栏：sr-only 标题 + 两个页签（页签后面跟着计数节点与可见性隐藏的 (0)）
	["Page selector navigation", "页面选择器导航"],
	["Properties", "属性"],
	["Set values", "设置值"],
	// 空态区块：标题 + 按钮 + 三张建议卡
	["Suggested custom properties", "建议的自定义属性"],
	["See more", "查看更多"],
	[
		"Is this repository a monorepo?",
		"这个仓库是 monorepo 吗？",
	],
	["Which databases are used?", "使用了哪些数据库？"],
	[
		"What application does this support?",
		"它支持哪个应用？",
	],
	// 后两条来自维护者的复测截图：空态三张卡是**上游轮换取样**的，
	// 截图那一组（compliance_frameworks / monorepo / ci）与当日 HTML 里的一组不同
	[
		"Which compliance frameworks apply?",
		"适用哪些合规框架？",
	],
	[
		"Which CI does this repository use?",
		"此仓库使用哪个 CI？",
	],
	// 「Set values」页签里仓库行的文案（截图证据）
	["No properties", "没有属性"],
	["Edit properties", "编辑属性"],
	// `?tab=set-values` 整段 HTML 补出的空态标题、仓库列表筛选框，
	// 以及两张轮换建议卡的描述句
	["No properties that match", "没有匹配的属性"],
	["Search repositories", "搜索仓库"],
	["Are regular backups required?", "需要定期备份吗？"],
	[
		"Are external packages used here?",
		"这里使用了外部包吗？",
	],
	// 第四组轮换样本（`branch_protection_level` / `active` / `ci`）
	[
		"How protected is the default branch?",
		"默认分支的保护程度如何？",
	],
	[
		"Is this repository maintained?",
		"这个仓库还在维护吗？",
	],
	// 第五组轮换样本（一段 HTML 里给了五条新描述句，其中一条出现两次）
	[
		"Are personal identifiers present?",
		"是否存在个人身份信息？",
	],
	["Who owns this repository?", "谁拥有这个仓库？"],
	[
		"Which runtime environment is used?",
		"使用了哪个运行时环境？",
	],
	[
		"Which cloud providers are used?",
		"使用了哪些云服务提供商？",
	],
	[
		"Was this repository migrated?",
		"这个仓库是迁移过来的吗？",
	],
	// 第六组轮换样本（三张卡都带属性名）
	[
		"Is this a production repository?",
		"这是生产环境仓库吗？",
	],
	[
		"How long until data is deleted?",
		"数据多久后会被删除？",
	],
	[
		"Is this repository open source?",
		"这个仓库是开源的吗？",
	],
];

/** 本页唯一一条动态文案：`?tab=set-values` 的页头与面包屑末项 */
const HEADING_NODES: readonly (readonly [
	string,
	string,
])[] = [
	// 页头 H1 与面包屑末项是同一个串，仓库名由路由决定
	["Set properties on koishi", "设置 koishi 的属性"],
	["Set properties on tools", "设置 tools 的属性"],
	[
		"Set properties on koishi-plugin-market-tracker",
		"设置 koishi-plugin-market-tracker 的属性",
	],
];

/** 可翻译属性（属性只走整串精确匹配，不走规则） */
const ATTR_KEYS: readonly (readonly [string, string])[] = [
	["Filter properties", "筛选属性"],
	["Page selector", "页面选择器"],
	["See more suggested properties", "查看更多建议属性"],
];

/** 贴出的 HTML 里已是中文的四处（既有键的产物，用作对照物） */
const ALREADY_COVERED: readonly (readonly [
	string,
	string,
])[] = [
	// 本批之前刚收的两条键，这一页的实机 HTML 直接证实它们生效
	["Search or filter", "搜索或筛选"],
	["Suggestions", "建议"],
	["Search", "搜索"],
	["More", "更多"],
];

/**
 * 必须保持英文：三张建议卡的属性名是**标识符**（写进仓库元数据、做 JSON 键用），
 * 上游不会翻译；`items` 是泛化短词（本模块的组织账单页上另有一个裸 `items`
 * 节点，billing.test.ts 已把它列为反例——词条是模块级的，收了会连带译掉它）；
 * 纯数字与可见性隐藏的 `(0)` 不含拉丁字母，守卫直接跳过；组织名是用户内容。
 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"monorepo",
	"databases",
	"application_name",
	"compliance_frameworks",
	"ci",
	"backup_required",
	"uses_external_packages",
	"branch_protection_level",
	"active",
	"contains_pii",
	"deploys_to_production",
	"data_retention_period",
	"open_source",
	"items",
	"0",
	"\u00a0(0)",
	"koishi",
	"Koishi-CE",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/**
 * 把一段实机节点序列按 walker 的语义过一遍：未命中的节点按原样保留，
 * 命中的节点写回译文并保留其首尾空白，最后拼接成页面上真实看到的那一行。
 */
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

describe("组织自定义属性页的模块路由", () => {
	it("loads the org-settings shell with the global fallback", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match the per-repository module", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).not.toContain("pages/repo-settings");
		expect(names).not.toContain("pages/settings");
	});

	it("covers the legacy prefix and the new-property form page", () => {
		expect(moduleNames(LEGACY_PATH)).toContain(
			"pages/org-settings",
		);
		expect(moduleNames(FORM_PATH)).toContain(
			"pages/org-settings",
		);
	});
});

describe("组织自定义属性页的实机节点", () => {
	it("translates every node that the real page still showed in English", () => {
		for (const [raw, expected] of NEW_NODES) {
			for (const variant of withWhitespace(raw)) {
				const translated = translateText(variant, view);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("translates the accessible names", () => {
		for (const [raw, expected] of ATTR_KEYS) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("keeps the nodes that were already covered before this batch", () => {
		for (const [raw, expected] of ALREADY_COVERED) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("keeps property identifiers and numbers in English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});

describe("组织自定义属性页的节点切分事实", () => {
	it("renders the page header", () => {
		expect(
			renderNodes([
				"Repository custom properties",
				"New property",
				"Add metadata to your repositories, such as compliance frameworks, data sensitivity, or project details.",
			]),
		).toBe(
			"仓库自定义属性新建属性为你的仓库添加元数据，例如合规框架、数据敏感度或项目详情。",
		);
	});

	it("renders the tab bar with the counter and its hidden duplicate", () => {
		// 计数节点是纯数字、可见性隐藏的那份是 `\u00a0(0)`：两者都不含拉丁字母，
		// 引擎按设计跳过，故中文页签后面原样跟着 0 与 (0)
		expect(
			renderNodes([
				"Properties",
				"0",
				"\u00a0(0)",
				"Set values",
			]),
		).toBe("属性0\u00a0(0)设置值");
	});

	it("leaves the overflow button half-translated on purpose", () => {
		// 实机：`<span>More<span class="InternalVisuallyHidden"> items</span></span>`
		// 前一段由 global 的 `More` 译出；后一段**有意不收**（`items` 是泛化短词，
		// 组织账单页上另有一个裸 `items` 节点被列为反例），故读屏文案留成
		// 「更多 items」——该 span 是 sr-only，视觉上只显示「更多」
		expect(renderNodes(["More", " items"])).toBe(
			"更多 items",
		);
	});

	it("renders an ice-breaker card with its identifier left alone", () => {
		expect(
			renderNodes([
				"Suggested custom properties",
				"See more",
				"monorepo",
				"Is this repository a monorepo?",
			]),
		).toBe(
			"建议的自定义属性查看更多monorepo这个仓库是 monorepo 吗？",
		);
	});

	it("renders the filter form with the already-translated placeholder", () => {
		expect(
			renderNodes([
				"Filter properties",
				"Search or filter",
				"搜索",
			]),
		).toBe("筛选属性搜索或筛选搜索");
	});

	it("renders the rotating ice-breaker sample from the retest screenshot", () => {
		// 截图里那一组三张卡与 HTML 里那一组不同 ⇒ 卡片是上游轮换取样的；
		// 属性名照旧保持英文，只译描述句
		expect(
			renderNodes([
				"compliance_frameworks",
				"Which compliance frameworks apply?",
				"ci",
				"Which CI does this repository use?",
			]),
		).toBe(
			"compliance_frameworks适用哪些合规框架？ci此仓库使用哪个 CI？",
		);
	});

	it("renders the third rotating sample", () => {
		// `?tab=set-values` 那段 HTML 里的三张卡：两张第一次见，一张已是中文
		expect(
			renderNodes([
				"backup_required",
				"Are regular backups required?",
				"databases",
				"使用了哪些数据库？",
				"uses_external_packages",
				"Are external packages used here?",
			]),
		).toBe(
			"backup_required需要定期备份吗？databases使用了哪些数据库？uses_external_packages这里使用了外部包吗？",
		);
	});

	it("renders the fourth rotating sample", () => {
		// 第四组：两张第一次见的描述句 + 已生效的 `ci` 那一张
		expect(
			renderNodes([
				"branch_protection_level",
				"How protected is the default branch?",
				"active",
				"Is this repository maintained?",
				"ci",
				"此仓库使用哪个 CI？",
			]),
		).toBe(
			"branch_protection_level默认分支的保护程度如何？active这个仓库还在维护吗？ci此仓库使用哪个 CI？",
		);
	});

	it("renders the fifth rotating sample", () => {
		// 第五组：五条新描述句（`Who owns this repository?` 在同一段里出现两次，
		// 同串同译，只登记一条键）+ 一张卡带属性名
		expect(
			renderNodes([
				"contains_pii",
				"Are personal identifiers present?",
				"Who owns this repository?",
				"Which runtime environment is used?",
				"Who owns this repository?",
				"Which cloud providers are used?",
				"Was this repository migrated?",
			]),
		).toBe(
			"contains_pii是否存在个人身份信息？谁拥有这个仓库？使用了哪个运行时环境？谁拥有这个仓库？使用了哪些云服务提供商？这个仓库是迁移过来的吗？",
		);
	});

	it("renders the sixth rotating sample", () => {
		// 第六组：三张卡都带属性名，描述句各一条
		expect(
			renderNodes([
				"deploys_to_production",
				"Is this a production repository?",
				"data_retention_period",
				"How long until data is deleted?",
				"open_source",
				"Is this repository open source?",
			]),
		).toBe(
			"deploys_to_production这是生产环境仓库吗？data_retention_period数据多久后会被删除？open_source这个仓库是开源的吗？",
		);
	});

	it("renders the set-values row with its edit affordance", () => {
		// 「Set values」页签：仓库行是 `No properties` + 铅笔按钮的 tooltip
		expect(
			renderNodes([
				"Properties",
				"Set values",
				"No properties",
				"Edit properties",
			]),
		).toBe("属性设置值没有属性编辑属性");
	});

	it("renders the whole set-values form", () => {
		// 实机：H1（动态仓库名）+ 筛选框 + 空态标题 + 两个按钮（保存 / 取消 已是中文）
		expect(
			renderNodes([
				"Set properties on koishi",
				"筛选属性",
				"Search repositories",
				"No properties that match",
				"保存",
				"取消",
			]),
		).toBe(
			"设置 koishi 的属性筛选属性搜索仓库没有匹配的属性保存取消",
		);
	});
});

describe("组织自定义属性页的动态页头", () => {
	it("rewrites the heading for every repository name", () => {
		for (const [raw, expected] of HEADING_NODES) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("anchors the rule so neighbouring sentences stay English", () => {
		// 整串锚定：只有「Set properties on <仓库名>」这半句会被改写
		for (const raw of [
			"Set properties on",
			"Set properties for koishi",
			"Set properties on koishi now",
			"set properties on koishi",
		]) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});
