// 仓库设置页的两支小页面实机文本回归：
//   /owner/repo/settings/keys              部署密钥（含顶部「改用 GitHub Apps」横幅）
//   /owner/repo/settings/secrets/actions   Actions 机密（与 /settings/variables/actions
//                                          共用页头与页签，故 Variables 页签也在这里验证）
//
// 边界强度：**实机 outerHTML 实证**（2026-09-27 维护者提供，页面带着本扩展渲染）。
// 因此实机里的「部署密钥」「GitHub 应用」已是既有词条的产物，不是待补节点——调试时别把它们
// 当成「中文节点混进清单」。
//
// 节点边界（两页共通的形态）：
//   - 链接把句子切成「前缀 + 链接 + 尾段」，尾段可能只剩 `instead.` 或 `data.`；
//   - 机密页的页头说明段被 `<strong>` 与链接切成七段，逐段登记后拼接必须读得通；
//   - 两个 React 区块（环境机密 / 仓库机密）的表头、空态、按钮是渲染后的普通文本节点；
//     嵌在 `<script type="application/json">` 里的 props 由排除选择器挡掉，不进词典。
//
// 刻意**不收录**（下方反例断言）：`SSH` / `GitHub`（协议名与产品名）、`Oppenheymu` /
// `Github-i18n`（用户内容）。`Actions` 本身在侧栏另有词条（「Actions 工作流」），不做反例。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

const dict = dictForLocale("zh-CN");
const aliases = new Map(Object.entries(dictCore.aliases));

/** /Oppenheymu/Github-i18n/settings/keys 命中的模块视图 */
const keysView = buildView(
	"/Oppenheymu/Github-i18n/settings/keys",
	dict,
	aliases,
);

/** /Oppenheymu/Github-i18n/settings/secrets/actions 命中的模块视图 */
const secretsView = buildView(
	"/Oppenheymu/Github-i18n/settings/secrets/actions",
	dict,
	aliases,
);

/** /Oppenheymu/Github-i18n/settings/variables/actions 命中的模块视图 */
const variablesView = buildView(
	"/Oppenheymu/Github-i18n/settings/variables/actions",
	dict,
	aliases,
);

/** 部署密钥页的节点（原文 → 期望译文），顺序与页面出现顺序一致 */
const KEYS_NODES: readonly (readonly [string, string])[] = [
	// —— 顶部「推荐改用 GitHub Apps」横幅（被链接切成两段）——
	["We recommend using", "我们建议改用"],
	[
		"instead for fine grained control over repositories and",
		"，以便更精细地控制仓库并获得",
	],
	["enhanced security", "更强的安全性"],
	// —— 页头与操作 ——
	["Add deploy key", "添加部署密钥"],
	[
		"use an SSH key to grant readonly or write access to a single repository. They are not protected by a passphrase and can be a security risk if your server is compromised. If you have a complex project or want more fine-grain control over permissions, consider using",
		"使用 SSH 密钥授予对单个仓库的只读或写入权限。它们不受口令保护，如果你的服务器被入侵，可能会带来安全风险。如果你有复杂的项目，或希望对权限进行更细粒度的控制，可以考虑使用",
	],
	["instead.", "来替代。"],
	// —— 空态 ——
	[
		"There are no deploy keys for this repository",
		"此仓库没有部署密钥",
	],
	["Check out our", "查看我们的"],
	["guide on deploy keys", "部署密钥指南"],
	["to learn more.", "以了解更多。"],
];

/** Actions 机密与变量页的节点（原文 → 期望译文），顺序与页面出现顺序一致 */
const SECRETS_NODES: readonly (readonly [
	string,
	string,
])[] = [
	["Actions secrets and variables", "Actions 机密与变量"],
	[
		"Secrets and variables allow you to manage reusable configuration data. Secrets are",
		"机密与变量让你可以管理可复用的配置数据。机密经过",
	],
	["encrypted", "加密"],
	["and are used for sensitive data.", "，用于敏感数据。"],
	[
		"Learn more about encrypted secrets",
		"进一步了解加密机密",
	],
	[
		". Variables are shown as plain text and are used for",
		"。变量以纯文本显示，用于",
	],
	["non-sensitive", "非敏感"],
	["data.", "数据。"],
	["Learn more about variables", "进一步了解变量"],
	[
		"Anyone with collaborator access to this repository can use these secrets and variables for actions. They are not passed to workflows that are triggered by a pull request from a fork.",
		"任何对此仓库有协作者访问权限的人都可以将这些机密与变量用于 Actions。它们不会被传递给由复刻发起的拉取请求所触发的工作流。",
	],
	// nav 的 aria-label
	["Secrets or variables tab", "机密或变量标签页"],
	// 页签与 sr-only 标题同串
	["Secrets", "机密"],
	["Variables", "变量"],
	// —— 环境机密（React 区块）——
	["Environment secrets", "环境机密"],
	["This environment has no secrets.", "此环境没有机密。"],
	["Manage environment secrets", "管理环境机密"],
	// —— 仓库机密（React 区块）——
	["Repository secrets", "仓库机密"],
	["This repository has no secrets.", "此仓库没有机密。"],
	["New repository secret", "新建仓库机密"],
];

/**
 * 变量页（/settings/variables/actions）两个 React 区块的节点。
 * 它们与机密页成对（secrets → variables）：2026-09-27 维护者实机复查时发现这一套漏了，
 * 根因是只按一个页签的 HTML 登记，故两套串都要有回归。
 */
const VARIABLES_NODES: readonly (readonly [
	string,
	string,
])[] = [
	["Environment variables", "环境变量"],
	[
		"This environment has no variables.",
		"此环境没有变量。",
	],
	["Manage environment variables", "管理环境变量"],
	["Repository variables", "仓库变量"],
	["This repository has no variables.", "此仓库没有变量。"],
	["New repository variable", "新建仓库变量"],
];

/** 协议名、产品名与用户内容：整节点不收录，必须保持英文 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"SSH",
	"GitHub",
	"Oppenheymu",
	"Github-i18n",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/** 按节点顺序拼接译文（未命中的节点保留原文），用于核对拆句后是否读得通 */
function renderNodes(
	nodes: readonly string[],
	view: ReturnType<typeof buildView>,
): string {
	return nodes
		.map((node) => translateText(node, view) ?? node)
		.join("");
}

describe("仓库设置页的部署密钥页的实机节点边界", () => {
	it("translates every text node of the page", () => {
		for (const [node, expected] of KEYS_NODES) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, keysView),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("keeps protocol names, brand names and user content in english", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, keysView),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("reassembles the banner, the description and the empty state", () => {
		// 拼接不补原文空白：实机里段间的空格来自节点自带的前导 / 尾随空白
		expect(
			renderNodes(
				[
					"We recommend using",
					"GitHub 应用",
					"instead for fine grained control over repositories and",
					"enhanced security",
				],
				keysView,
			),
		).toBe(
			"我们建议改用GitHub 应用，以便更精细地控制仓库并获得更强的安全性",
		);
		expect(
			renderNodes(
				[
					"部署密钥",
					"use an SSH key to grant readonly or write access to a single repository. They are not protected by a passphrase and can be a security risk if your server is compromised. If you have a complex project or want more fine-grain control over permissions, consider using",
					"GitHub 应用",
					"instead.",
				],
				keysView,
			),
		).toBe(
			"部署密钥使用 SSH 密钥授予对单个仓库的只读或写入权限。它们不受口令保护，如果你的服务器被入侵，可能会带来安全风险。如果你有复杂的项目，或希望对权限进行更细粒度的控制，可以考虑使用GitHub 应用来替代。",
		);
		expect(
			renderNodes(
				[
					"Check out our",
					"guide on deploy keys",
					"to learn more.",
				],
				keysView,
			),
		).toBe("查看我们的部署密钥指南以了解更多。");
	});
});

describe("仓库设置页的 Actions 机密与变量页的实机节点边界", () => {
	it("translates every text node of the header, tabs and both React sections", () => {
		for (const [node, expected] of SECRETS_NODES) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, secretsView),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("keeps brand names and user content in english", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, secretsView),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("reassembles the intro paragraph into readable chinese", () => {
		// 七段：整句前缀 + encrypted + 中段 + 链接 + 句点并进下一段 + non-sensitive + 尾段
		expect(
			renderNodes(
				[
					"Secrets and variables allow you to manage reusable configuration data. Secrets are",
					"encrypted",
					"and are used for sensitive data.",
					"Learn more about encrypted secrets",
					". Variables are shown as plain text and are used for",
					"non-sensitive",
					"data.",
				],
				secretsView,
			),
		).toBe(
			"机密与变量让你可以管理可复用的配置数据。机密经过加密，用于敏感数据。进一步了解加密机密。变量以纯文本显示，用于非敏感数据。",
		);
	});

	it("covers the Variables tab, whose sections mirror the Secrets ones", () => {
		// 两个页签是同一模块的两条路径，共用页头词条
		expect(translateText("Variables", variablesView)).toBe(
			"变量",
		);
		expect(
			translateText(
				"Actions secrets and variables",
				variablesView,
			),
		).toBe("Actions 机密与变量");
		// React 区块用的是另一套串（secrets → variables），两套都必须在
		for (const [node, expected] of VARIABLES_NODES) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, variablesView),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});
});
