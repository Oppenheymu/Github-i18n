// 仓库设置页的环境三支实机文本回归：
//   /owner/repo/settings/environments        列表页（本次补的是底部配置说明）
//   /owner/repo/settings/environments/new    新建环境页（Add）
//   /owner/repo/settings/environments/<id>   环境配置页（Configure：保护规则 + 分支标签 +
//                                            环境机密 / 环境变量两个 React 区块）
//
// 边界强度：**实机 outerHTML 实证**（2026-09-27 维护者提供，三处页面片段）。
// 列表页空态（环境页三段）在 repo-settings/environments.test.ts 里另有回归，本文件不重复。
//
// 节点边界（本页最容易登记错的地方）：
//   - 面包屑「环境 / Add」「环境 / Configure」里，斜杠那一段是链接之后的独立文本节点；
//   - `Add up to <span>6</span> more <span>reviewers</span>` 是四段，且数字与 reviewers
//     都带 data-target：名额只剩 1 个时脚本会把 `reviewers` 改写成 `reviewer`，两形都收；
//   - 「Enable custom rules with GitHub Apps」下面那句被两个链接切成四段；
//   - 两个 React 区块的说明句是「整句 + `secret context` / `variable context` 链接 +
//     纯符号尾节点 `.`（不收）」，实机显示时尾点是半角。
//
// 刻意**不收录**（下方反例断言）：环境名 `TEST`（用户内容）、模板占位符 `{{ name }}`、
// 产品名 `GitHub` / `GitHub Apps` 与用户内容 `Oppenheymu` / `Github-i18n`。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const dict = dictForLocale("zh-CN");
const aliases = new Map(Object.entries(dictCore.aliases));

/** /Oppenheymu/Github-i18n/settings/environments 命中的模块视图 */
const listView = buildView(
	"/Oppenheymu/Github-i18n/settings/environments",
	dict,
	aliases,
);

/** /Oppenheymu/Github-i18n/settings/environments/new 命中的模块视图 */
const newView = buildView(
	"/Oppenheymu/Github-i18n/settings/environments/new",
	dict,
	aliases,
);

/** /Oppenheymu/Github-i18n/settings/environments/22852805247 命中的模块视图 */
const configView = buildView(
	"/Oppenheymu/Github-i18n/settings/environments/22852805247",
	dict,
	aliases,
);

/** 配置页与新建页共用的节点（原文 → 期望译文） */
const CONFIG_NODES: readonly (readonly [string, string])[] =
	[
		// —— 面包屑与标题 ——
		["/ Configure", "/ 配置"],
		// —— 部署保护规则 ——
		["Deployment protection rules", "部署保护规则"],
		[
			"Configure reviewers, timers, and custom rules that must pass before deployments to this environment can proceed.",
			"配置在部署到此环境之前必须通过的审查者、计时器和自定义规则。",
		],
		["Required reviewers", "必需的审查者"],
		[
			"Specify people or teams that may approve workflow runs when they access this environment.",
			"指定可以批准访问此环境的工作流运行的人员或团队。",
		],
		// 「Add up to 6 more reviewers」的四段（数字由页面提供，故只收前后三词 + 单数词形）
		["Add up to", "最多再添加"],
		["more", "名"],
		["reviewers", "审查者"],
		["reviewer", "审查者"],
		["Search for people or teams...", "搜索人员或团队…"],
		// 审查者行里橡皮擦按钮的 aria-label（模板克隆出来的 li 不在 template 内，会被翻译）
		["Remove", "移除"],
		["Prevent self-review", "防止自我审查"],
		[
			"Require a different approver than the user who triggered the workflow run.",
			"要求审批人不同于触发该工作流运行的用户。",
		],
		// —— 等待计时器 ——
		["Wait timer", "等待计时器"],
		[
			"Set an amount of time to wait before allowing deployments to proceed.",
			"设置允许部署继续之前需要等待的时长。",
		],
		["Time to wait", "等待时间"],
		["minutes", "分钟"],
		[
			"The time to wait must be an integer number between 1 and 43200",
			"等待时间必须是 1 到 43200 之间的整数",
		],
		// —— 自定义保护规则（预览标签由 global 覆盖）——
		[
			"Enable custom rules with GitHub Apps",
			"使用 GitHub Apps 启用自定义规则",
		],
		["Learn about existing apps", "了解现有应用"],
		["or", "或"],
		[
			"create your own protection rules",
			"创建你自己的保护规则",
		],
		[
			"so you can deploy with confidence.",
			"让你可以放心地部署。",
		],
		[
			"Allow administrators to bypass configured protection rules",
			"允许管理员绕过已配置的保护规则",
		],
		["Save protection rules", "保存保护规则"],
		// —— 部署分支与标签 ——
		["Deployment branches and tags", "部署分支与标签"],
		[
			"Limit which branches and tags can deploy to this environment based on rules or naming patterns.",
			"根据规则或命名模式，限制哪些分支和标签可以部署到此环境。",
		],
		// 下拉当前值与菜单项其一同串
		["No restriction", "无限制"],
		[
			"No restriction to which branch or tag from this repository can deploy.",
			"不限制此仓库中的哪些分支或标签可以部署。",
		],
		["Protected branches only", "仅受保护的分支"],
		[
			"Deployment limited to branches with protection rules.",
			"部署仅限于具有保护规则的分支。",
		],
		["Selected branches and tags", "选定的分支与标签"],
		[
			"Specify a list of branches and tags using naming patterns.",
			"使用命名模式指定分支与标签列表。",
		],
		// —— 环境机密 / 环境变量两个 React 区块 ——
		[
			"Secrets are encrypted environment variables. They are accessible only by GitHub Actions in the context of this environment by using the",
			"机密是加密的环境变量。只有 GitHub Actions 在此环境的上下文中通过",
		],
		["secret context", "机密上下文"],
		[
			"Variables are used for non-sensitive configuration data. They are accessible only by GitHub Actions in the context of this environment by using the",
			"变量用于非敏感的配置数据。只有 GitHub Actions 在此环境的上下文中通过",
		],
		["variable context", "变量上下文"],
		["Add environment secret", "添加环境机密"],
		["Add environment variable", "添加环境变量"],
	];

/** 新建环境页的节点（原文 → 期望译文） */
const NEW_NODES: readonly (readonly [string, string])[] = [
	["/ Add", "/ 添加"],
	// 按钮文本、value 与 data-disable-with 是同一个串
	["Configure environment", "配置环境"],
];

/** 环境名、模板占位符、产品名与用户内容：整节点不收录，必须保持英文 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"TEST",
	"{{ name }}",
	"{{ nodeId }}",
	"{{ avatarUrl }}",
	"GitHub",
	"Oppenheymu",
	"github-i18n",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/**
 * 按节点顺序拼接（未命中的节点保留原文），并**保留每个节点的首尾空白**——
 * 实机渲染就是这样：译文本身不带空格，段与段之间的空格来自原文节点
 * （例如面包屑的 ` / Add`，斜杠前那个空格是节点自带的）。
 */
function renderNodes(
	nodes: readonly string[],
	view: ReturnType<typeof buildView>,
): string {
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

describe("仓库设置页的新建环境页的实机节点边界", () => {
	it("translates the breadcrumb tail and the submit button", () => {
		for (const [node, expected] of NEW_NODES) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, newView),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("reassembles the breadcrumb 环境 / Add", () => {
		// 前导空格来自原文节点（`<a>环境</a> / Add`），实机显示为「环境 / 添加」
		expect(renderNodes(["环境", " / Add"], newView)).toBe(
			"环境 / 添加",
		);
	});
});

describe("仓库设置页的环境配置页的实机节点边界", () => {
	it("translates every text node and translatable attribute", () => {
		for (const [node, expected] of CONFIG_NODES) {
			for (const variant of withWhitespace(node)) {
				expect(
					translateText(variant, configView),
					`节点 ${JSON.stringify(variant)}`,
				).toBe(expected);
			}
		}
	});

	it("keeps the environment name, template placeholders and brand names in english", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, configView),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("reassembles the reviewer counter and the custom-rules paragraph", () => {
		// 「Add up to 6 more reviewers」：数字由页面提供，四段拼起来要读得通
		expect(
			renderNodes(
				["Add up to", "6", "more", "reviewers"],
				configView,
			),
		).toBe("最多再添加6名审查者");
		// 名额只剩 1 个时脚本把 reviewers 改写成 reviewer，拼接结果不变
		expect(
			renderNodes(
				["Add up to", "1", "more", "reviewer"],
				configView,
			),
		).toBe("最多再添加1名审查者");
		// 自定义规则说明：链接 + or + 链接 + 尾段
		expect(
			renderNodes(
				[
					"Learn about existing apps",
					"or",
					"create your own protection rules",
					"so you can deploy with confidence.",
				],
				configView,
			),
		).toBe(
			"了解现有应用或创建你自己的保护规则让你可以放心地部署。",
		);
	});

	it("reassembles the two React section descriptions", () => {
		// 尾节点 `.` 是纯符号，不收，故实机末尾仍是半角句点
		expect(
			renderNodes(
				[
					"Secrets are encrypted environment variables. They are accessible only by GitHub Actions in the context of this environment by using the",
					"secret context",
					".",
				],
				configView,
			),
		).toBe(
			"机密是加密的环境变量。只有 GitHub Actions 在此环境的上下文中通过机密上下文.",
		);
		expect(
			renderNodes(
				[
					"Variables are used for non-sensitive configuration data. They are accessible only by GitHub Actions in the context of this environment by using the",
					"variable context",
					".",
				],
				configView,
			),
		).toBe(
			"变量用于非敏感的配置数据。只有 GitHub Actions 在此环境的上下文中通过变量上下文.",
		);
	});
});

describe("仓库设置页的环境列表页底部的配置说明", () => {
	it("translates the paragraph and its docs link", () => {
		expect(
			translateText(
				"You can configure environments with protection rules, variables, and secrets.",
				listView,
			),
		).toBe("你可以为环境配置保护规则、变量和机密。");
		expect(
			translateText(
				"Learn more about configuring environments.",
				listView,
			),
		).toBe("进一步了解如何配置环境。");
		// 整句与链接是两个节点，合并串不该命中
		expect(
			translateText(
				"You can configure environments with protection rules, variables, and secrets. Learn more about configuring environments.",
				listView,
			),
		).toBeNull();
	});
});
