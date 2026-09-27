// 仓库设置页的 Dependabot 规则两支实机文本回归：
//   /owner/repo/settings/dependabot_rules      规则列表页（GitHub 预设）
//   /owner/repo/settings/dependabot_rules/new  新建规则页
//
// 边界强度（两页不同，必须写明）：
//   - 列表页：**实机 outerHTML 实证**（2026-09-27 维护者提供）。`<br>` 把第二条预设的说明
//     切成两段（`This rule auto-dismisses alerts for` + 链接 + 尾段），`Matches malware:` 后面
//     的 `package` 是匹配语法 token（malware:package），不收录；
//   - 新建页：**只有截图 + 维护者抄录的可视文本**（该页控制台输出过大，复制不完 outerHTML），
//     所以只断言「确定的整节点短标签 / placeholder / 说明句」。日后拿到实机 HTML 若发现某句
//     被链接切开，补碎片键并把拆分点写进这份测试。
//
// 两页共用的既有词条：面包屑 `Advanced Security` / `Dependabot rules`、状态标签
// `Enabled` / `Disabled`、`Rules`，都不是本页新收的键。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

const dict = dictForLocale("zh-CN");
const aliases = new Map(Object.entries(dictCore.aliases));

/** /Oppenheymu/Github-i18n/settings/dependabot_rules 命中的模块视图 */
const listView = buildView(
	"/Oppenheymu/Github-i18n/settings/dependabot_rules",
	dict,
	aliases,
);

/** /Oppenheymu/Github-i18n/settings/dependabot_rules/new 命中的模块视图 */
const newView = buildView(
	"/Oppenheymu/Github-i18n/settings/dependabot_rules/new",
	dict,
	aliases,
);

/** 列表页的节点（原文 → 期望译文），顺序与页面出现顺序一致 */
const LIST_NODES: readonly (readonly [string, string])[] = [
	// 桌面版按钮文本与两处 aria-label；窄屏按钮的实机原文带 GitHub 自己的 " sm" 后缀
	["New rule", "新建规则"],
	["New rule sm", "新建规则"],
	// title 属性（属性只走精确命中，数字是固定的规则上限）
	[
		"You can create up to 10 rules in this repository.",
		"你在此仓库中最多可以创建 10 条规则。",
	],
	["GitHub presets", "GitHub 预设"],
	["Managed by GitHub", "由 GitHub 管理"],
	// —— 预设 1：Dismiss low-impact alerts… ——
	[
		"Dismiss low-impact alerts for development-scoped dependencies",
		"忽略开发环境依赖项的低影响警报",
	],
	[
		"In a developer (non-production or runtime) environment, these alerts are unlikely to be exploitable or have limited effect like slow builds or long-running tests.",
		"在开发者环境（非生产或运行时）中，这些警报不太可能被利用，或者影响有限，例如导致构建变慢或测试运行时间过长。",
	],
	[
		"Learn more about this methodology.",
		"进一步了解此方法。",
	],
	// 橡皮擦图标的 title 与 sr-only tooltip 是同一个串
	["Edit rule", "编辑规则"],
	// —— 预设 2：Dismiss package malware alerts ——
	["Dismiss package malware alerts", "忽略包恶意软件警报"],
	["Matches malware:", "匹配恶意软件："],
	[
		"This rule auto-dismisses alerts for",
		"此规则会自动忽略以下情况的警报：",
	],
	["false positives from private packages", "私有包的误报"],
	[
		"as well as public packages where all versions are flagged as malicious.",
		"以及所有版本都被标记为恶意的公开包。",
	],
	// 状态标签（复用安全分析页登记的键）
	["Enabled", "启用"],
	["Disabled", "禁用"],
];

/** 新建页的节点（原文 → 期望译文），顺序与截图 / 抄录一致 */
const NEW_NODES: readonly (readonly [string, string])[] = [
	// 面包屑末项与页标题、按钮同串
	["New rule", "新建规则"],
	["Rule name", "规则名称"],
	["Add a rule name", "添加规则名称"],
	["State", "状态"],
	["Enabled", "启用"],
	["Target alerts", "目标警报"],
	["Add rule metadata", "添加规则元数据"],
	[
		"Rules will be applied for alerts matching all included metadata.",
		"规则将应用于与所有包含元数据都匹配的警报。",
	],
	["Rules", "规则"],
	[
		"Select one or more rules to apply to matching alerts.",
		"选择一条或多条要应用于匹配警报的规则。",
	],
	["Dismiss alerts", "忽略警报"],
	[
		"Dependabot will automatically close or reopen alerts based on selected criteria.",
		"Dependabot 会根据所选条件自动关闭或重新打开警报。",
	],
	["Until patch is available", "直到有可用补丁"],
	["Indefinitely", "无限期"],
	[
		"Open a pull request to resolve alerts",
		"打开拉取请求以解决警报",
	],
	[
		"Dependabot will always try to open a pull request to resolve open alerts when security updates are enabled.",
		"启用安全更新后，Dependabot 会始终尝试打开拉取请求来解决未解决的警报。",
	],
	["Create rule", "创建规则"],
];

/** 匹配语法 token、产品名与用户内容：整节点不收录，必须保持英文 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"package",
	"malware:package",
	"Dependabot",
	"GitHub",
	"Oppenheymu",
	"Github-i18n",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

describe("仓库设置页的 Dependabot 规则列表页的实机节点边界", () => {
	it("translates every text node and translatable attribute", () => {
		for (const [node, expected] of LIST_NODES) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, listView),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("keeps the match-syntax token, brand names and user content in english", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, listView),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("reassembles the preset descriptions into readable chinese", () => {
		// 拼接刻意不补原文空白：实机里段与段之间的空格来自被 trim 掉的空文本节点
		// （如 `<br>` 两侧的缩进），本断言只核对译文本身连起来是否读得通。
		// 预设 1：整句 + methodology 链接
		expect(
			[
				"In a developer (non-production or runtime) environment, these alerts are unlikely to be exploitable or have limited effect like slow builds or long-running tests.",
				"Learn more about this methodology.",
			]
				.map(
					(node) => translateText(node, listView) ?? node,
				)
				.join(""),
		).toBe(
			"在开发者环境（非生产或运行时）中，这些警报不太可能被利用，或者影响有限，例如导致构建变慢或测试运行时间过长。进一步了解此方法。",
		);
		// 预设 2：`<br>` 把说明切成「前缀 + 链接 + 尾段」，
		// 前面还有不译的匹配语法 `Matches malware:` + `package`
		expect(
			[
				"Matches malware:",
				"package",
				"This rule auto-dismisses alerts for",
				"false positives from private packages",
				"as well as public packages where all versions are flagged as malicious.",
			]
				.map(
					(node) => translateText(node, listView) ?? node,
				)
				.join(""),
		).toBe(
			"匹配恶意软件：package此规则会自动忽略以下情况的警报：私有包的误报以及所有版本都被标记为恶意的公开包。",
		);
	});
});

describe("仓库设置页的 Dependabot 规则新建页的实机节点边界", () => {
	it("translates every recorded label, placeholder and description", () => {
		for (const [node, expected] of NEW_NODES) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, newView),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("keeps brand names and user content in english", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, newView),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("does not treat a label and its caption as one node", () => {
		// 区块标签与紧跟的说明句是两个节点，合并串不该命中
		expect(
			translateText(
				"Target alerts Rules will be applied for alerts matching all included metadata.",
				newView,
			),
		).toBeNull();
		expect(
			translateText(
				"Dismiss alerts Dependabot will automatically close or reopen alerts based on selected criteria.",
				newView,
			),
		).toBeNull();
	});
});
