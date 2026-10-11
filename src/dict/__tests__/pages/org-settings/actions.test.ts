// 组织级「常规 Actions 权限」页（/organizations/<组织>/settings/actions）实机回归。
//
// 证据：2026-10-11 维护者贴的整段实机 HTML。
// 本页**不缺路由**（挂在 `settings` 前缀下，命中 `pages/org-settings` + `global`），
// 但整页此前几乎全是英文——HTML 里的 `所有仓库` / `已选仓库` / `禁用` / `保存` /
// `运行器` / `已允许` / `策略` 就是既有键生效的对照物。
// 根因不是缺词条，而是**模块路由互斥**：仓库级的 /owner/repo/settings/actions 早有一整套
// **同串**词条，但它们全在 pages/repo-settings 里，而那条路由排除了 organizations / orgs，
// 在组织路径上一条都不命中。故本模块逐字同译各收一份，用例对同串节点断言两份视图译文相等。
//
// 三条必须记住的边界事实：
//   1. 长句普遍被行内元素切碎：允许列表的说明句被两个 `<code>`（`!` / `*`）切成多段，
//      两条警告横幅被 `<code>` + `<strong>` 切成多段，复刻拉取请求那句被两处
//      `<strong>write</strong>` 切成三段——排除容器内的文本引擎不翻，故整句键永不命中；
//   2. 「自定义镜像」三条说明句**共用一个前段节点**（`Your enterprise has set a maximum limit of`，
//      紧跟 `<strong>` 里的数字、数字节点被引擎按设计跳过），所以是「前段 + 三个后段」四条键；
//   3. 下拉的**当前值**与**菜单项**在实机是同一个串（`Not allowed` 出现两次、
//      `所有仓库` / `已选仓库` / `禁用` 各出现两次），一条键覆盖多处；
//      而两个保存按钮的 aria-label 只差单复数一个 `s`（`setting` / `settings`），
//      是两条不同的键，不能互相顶替。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织级 Actions 常规权限页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/actions";
/** 旧前缀（`/orgs/<组织>/...`），路由也应覆盖 */
const LEGACY_PATH = "/orgs/Koishi-CE/settings/actions";
/** 仓库级的同款页面：同串词条在这里，用于断言两边逐字同译 */
const REPO_PATH =
	"/Oppenheymu/Github-i18n/settings/actions";

const locale = dictForLocale("zh-CN");
const aliases = new Map(Object.entries(dictCore.aliases));
const view = buildView(PAGE_PATH, locale, aliases);
const repoView = buildView(REPO_PATH, locale, aliases);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/**
 * 与 pages/repo-settings **同串**的节点：仓库级模块早收过，但那条路由不命中组织路径，
 * 故本模块各收一份——这里只列串，译文由「两份视图相等」+「含中文」两条断言共同钉住。
 */
const SHARED_NODES: readonly string[] = [
	"Allow all actions and reusable workflows",
	"Any action or reusable workflow can be used, regardless of who authored it or where it is defined.",
	"Allow actions created by GitHub",
	"Allow actions by Marketplace",
	"verified creators",
	"Allow or block specified actions and reusable workflows",
	"Learn more about allowing specific actions and reusable workflows to run.",
	"Require actions to be pinned to a full-length commit SHA",
	"Action examples:",
	"Entire organization or repository examples:",
	"Reusable workflow examples:",
	"Wildcards, tags, and SHAs are allowed. Use",
	"prefix to block.",
	". By default, only allowed patterns specified in the list can be used. To allow all actions and reusable workflows except those that are explicitly blocked, add a",
	"wildcard pattern.",
	"Your list contains a",
	"wildcard pattern, which will",
	"allow all actions and reusable workflows",
	"except those that are explicitly blocked.",
	"Your list contains",
	"only blocked patterns",
	"Approval for running fork pull request workflows from contributors",
	"Choose which subset of users will require approval before running workflows on their pull requests. Both the pull request author and the actor of the pull request event triggering the workflow will be checked to determine if approval is required. If approval is required, a user with write access to the repository must",
	"approve the pull request workflow to be run.",
	"Require approval for all external contributors",
	"Require approval for first-time contributors who are new to GitHub",
	"Only users who are both new on GitHub and who have never had a commit or pull request merged into this repository will require approval to run workflows.",
	"Require approval for first-time contributors",
	"Only users who have never had a commit or pull request merged into this repository will require approval to run workflows.",
	"Save fork pull request workflows setting",
	"Workflow permissions",
	"Read and write permissions",
	"Workflows have read and write permissions in the repository for all scopes.",
	"Read repository contents and packages permissions",
	"Workflows have read permissions in the repository for the contents and packages scopes only.",
	"Allow GitHub Actions to create and approve pull requests",
	"Choose whether GitHub Actions can create pull requests or submit approving pull request reviews.",
	"Learn more about managing permissions.",
	"Save workflow permissions settings",
	"Check, workflow run, status, artifact and log retention",
	"Learn more about the check, workflow run, status, artifact and log retention policy.",
	"days",
	"days.",
	"Duration must be 1 or more.",
	"Save artifact and log retention setting",
];

/** 组织侧**独有**措辞（仓库级的近义串在组织路径上不命中），逐条钉住译文 */
const ORG_ONLY_NODES: readonly (readonly [
	string,
	string,
])[] = [
	["General actions permissions", "常规 Actions 权限"],
	[
		"Choose which repositories are permitted to use GitHub Actions.",
		"选择允许哪些仓库使用 GitHub Actions。",
	],
	[
		"Actions can be run by any repository in the organization",
		"组织中的任何仓库都可以运行操作",
	],
	[
		"Actions can only be run by specifically selected repositories",
		"只有被专门选中的仓库才能运行操作",
	],
	[
		"GitHub Actions is disabled for all repositories in the organization",
		"已对组织中的所有仓库禁用 GitHub Actions",
	],
	["Repository self-hosted runners", "仓库级自托管运行器"],
	[
		"Choose which repositories are allowed to create repository-level self-hosted runners.",
		"选择允许哪些仓库创建仓库级自托管运行器。",
	],
	[
		"Repo-level self-hosted runners can be used by any repository in the organization",
		"组织中的任何仓库都可以使用仓库级自托管运行器",
	],
	[
		"Repo-level self-hosted runners can be used by specifically selected repositories",
		"只有被专门选中的仓库可以使用仓库级自托管运行器",
	],
	[
		"Repo-level self-hosted runners are disabled for all repositories in the organization",
		"已对组织中的所有仓库禁用仓库级自托管运行器",
	],
	["Custom images", "自定义镜像"],
	[
		"Choose the default settings for custom image retention in this enterprise.",
		"选择此企业中自定义镜像保留的默认设置。",
	],
	["Maximum versions per image", "每个镜像的最大版本数"],
	["versions", "个版本"],
	["Unused version retention", "未使用版本保留期"],
	["Maximum version age", "版本最长存在时间"],
	[
		"Your enterprise has set a maximum limit of",
		"你的企业已设置最大上限为",
	],
	["versions per image.", "个版本/镜像。"],
	[
		"days for unused version retention.",
		"天（未使用版本保留期）。",
	],
	[
		"days for maximum version age.",
		"天（版本最长存在时间）。",
	],
	["Standard hosted runners", "标准托管运行器"],
	[
		"Choose if repositories are allowed to use standard hosted runner labels. If disabled, hosted runners can only be accessed via a runner group.",
		"选择是否允许仓库使用标准托管运行器标签。若禁用，则只能通过运行器组访问托管运行器。",
	],
	["Disable for all repositories", "对所有仓库禁用"],
	["Note:", "注意："],
	[
		"Once disabled you will lose any concurrency settings you have set up.",
		"一旦禁用，你已设置的任何并发设置都将丢失。",
	],
	[
		"For more information on concurrency see our documentation.",
		"有关并发的更多信息，请参阅我们的文档。",
	],
	[
		"Allow live debugging on self-hosted runners. Repositories must individually opt in.",
		"允许在自托管运行器上进行实时调试。仓库必须逐个选择启用。",
	],
	["Not allowed", "不允许"],
	[
		"Allow live debugging on self-hosted runners",
		"允许在自托管运行器上进行实时调试",
	],
	[
		"Do not allow live debugging on self-hosted runners",
		"不允许在自托管运行器上进行实时调试",
	],
	[
		"Choose the default repository settings for checks, workflow runs, statuses, artifacts, and logs.",
		"选择检查、工作流运行、状态、构件与日志的默认仓库设置。",
	],
	["Duration must be 400 or less", "时长必须为 400 或更小"],
	[
		"You can set a maximum limit of",
		"你可以设置的最大上限为",
	],
	[
		"Fork pull request workflows in private and internal repositories",
		"私有和内部仓库中的复刻拉取请求工作流",
	],
	[
		"These settings apply to private and internal repositories. Repository administrators will only be able to change the settings that are enabled here.",
		"这些设置适用于私有和内部仓库。仓库管理员只能更改此处已启用的设置。",
	],
	[
		"Run workflows from fork pull requests",
		"从复刻拉取请求运行工作流",
	],
	[
		"This tells Actions to run workflows from pull requests originating from repository forks. Note that doing so will give maintainers of those forks the ability to use tokens with read permissions on the source repository.",
		"这会让 Actions 运行来自仓库复刻的拉取请求中的工作流。请注意，这样做会让这些复刻的维护者能够使用对源仓库具有读取权限的令牌。",
	],
	[
		"Send write tokens to workflows from fork pull requests.",
		"向来自复刻拉取请求的工作流发送写入令牌。",
	],
	[
		"This tells Actions to send tokens with",
		"这会让 Actions 向工作流发送具有",
	],
	[
		"permissions to workflows from pull requests originating from repository forks. Note that doing so will give maintainers of those forks",
		"权限的令牌，用于来自仓库复刻的拉取请求中的工作流。请注意，这样做会让这些复刻的维护者获得对源仓库的",
	],
	["permissions against the source repository.", "权限。"],
	[
		"Send secrets and variables to workflows from fork pull requests.",
		"向来自复刻拉取请求的工作流发送机密与变量。",
	],
	[
		"This tells Actions to send repository secrets and variables to workflows from pull requests originating from repository forks.",
		"这会让 Actions 向来自仓库复刻的拉取请求中的工作流发送仓库机密与变量。",
	],
	[
		"Require approval for fork pull request workflows.",
		"要求批准复刻拉取请求工作流。",
	],
	[
		"Fork pull requests from users without write access will require approval to run workflows.",
		"来自没有写入权限的用户的复刻拉取请求需要批准才能运行工作流。",
	],
	[
		"Save fork pull request workflows settings",
		"保存复刻拉取请求工作流设置",
	],
	[
		"Choose the default permissions granted to the GITHUB_TOKEN when running workflows in this organization. You can specify more granular permissions in the workflow using YAML.",
		"选择在此组织中运行工作流时授予 GITHUB_TOKEN 的默认权限。你可以在工作流中用 YAML 指定更细粒度的权限。",
	],
	[
		"Repository administrators will only be able to change the default permissions to a more restrictive setting.",
		"仓库管理员只能将默认权限更改为更严格的设置。",
	],
];

/** 只出现在属性上的文案（属性按精确键匹配、不应用规则） */
const ATTR_NODES: readonly (readonly [string, string])[] = [
	[
		"Save artifact and log retention setting",
		"保存构件与日志保留期设置",
	],
	[
		"Save fork pull request workflows setting",
		"保存复刻拉取请求工作流设置",
	],
	[
		"Save fork pull request workflows settings",
		"保存复刻拉取请求工作流设置",
	],
	[
		"Save workflow permissions settings",
		"保存工作流权限设置",
	],
	[
		"Enter a comma-separated list of actions and reusable workflows",
		"输入以逗号分隔的操作和可复用工作流列表",
	],
];

/** 含组织名（动态值）的五条文案走规则，组织名按原样带回 */
const RULE_NODES: readonly (readonly [string, string])[] = [
	[
		"Allow Koishi-CE actions and reusable workflows",
		"允许 Koishi-CE 的操作和可复用工作流",
	],
	[
		"Allow Koishi-CE, and select non-Koishi-CE, actions and reusable workflows",
		"允许 Koishi-CE 的操作和可复用工作流，并可选择非 Koishi-CE 的操作和可复用工作流",
	],
	[
		"Any action or reusable workflow defined in a repository within the Koishi-CE organization can be used.",
		"Koishi-CE 内仓库中定义的任何操作或可复用工作流都可以使用。",
	],
	[
		"Any action or reusable workflow that matches the specified criteria, plus those defined in a repository within the Koishi-CE organization, can be used.",
		"符合指定条件的任何操作或可复用工作流，加上 Koishi-CE 内仓库中定义的那些，都可以使用。",
	],
	[
		"All users that are not a member or owner of the repository and not a member of the Koishi-CE organization will require approval to run workflows.",
		"所有不是该仓库成员或所有者、也不是 Koishi-CE 组织成员的用户，都需要批准才能运行工作流。",
	],
];

/**
 * 必须保持英文的节点。前两条是**反向哨兵**：仓库级模块的同款近义串在组织路径上
 * 一条都不该命中（否则会渲染出「in this repository」的残句）。
 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"Choose the repository settings for checks, workflow runs, statuses, artifacts, and logs.",
	"Choose the default permissions granted to the GITHUB_TOKEN when running workflows in this repository. You can specify more granular permissions in the workflow using YAML.",
	"All users that are not a member or owner of this repository will require approval to run workflows.",
	"Disable actions",
	"The Actions tab is hidden and no workflows can run.",
	"Artifact and log retention",
	"Choose the repository settings for artifacts and logs.",
	"Learn more about the artifact and log retention policy.",
	"Duration must be 90 or less",
	"allowedactions",
	"fork_pr_workflows_policy",
	"Koishi-CE",
	"GitHub Actions",
	"Copilot",
];

/** 按 walker 语义翻译节点，保留原文首尾空白后拼接 */
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

describe("组织级 Actions 常规权限页的模块路由", () => {
	it("loads org-settings and the global fallback", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match repository or account settings", () => {
		const names = moduleNames(PAGE_PATH);
		expect(names).not.toContain("pages/repo-settings");
		expect(names).not.toContain("pages/settings");
	});

	it("covers the legacy organization prefix", () => {
		expect(moduleNames(LEGACY_PATH)).toContain(
			"pages/org-settings",
		);
	});
});

describe("组织级 Actions 常规权限页的实机节点", () => {
	it("translates the shared strings exactly like the repository module", () => {
		for (const raw of SHARED_NODES) {
			const here = translateText(raw, view);
			expect(
				here,
				`未命中：${JSON.stringify(raw)}`,
			).not.toBeNull();
			expect(here ?? "").toMatch(/[\u4e00-\u9fff]/);
			expect(
				here,
				`与仓库级模块不同译：${JSON.stringify(raw)}`,
			).toBe(translateText(raw, repoView));
		}
	});

	it("translates every organization-only string", () => {
		for (const [raw, expected] of ORG_ONLY_NODES) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("translates the accessible names and the allowlist placeholder", () => {
		for (const [raw, expected] of ATTR_NODES) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("brings the organization name back through the five rules", () => {
		for (const [raw, expected] of RULE_NODES) {
			expect(
				translateText(raw, view),
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
		}
	});

	it("keeps product names, form values and repository-only wording in English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("prefers the selective rule over the plain organization rule", () => {
		// 「Allow <组织>, and select non-<组织>, …」必须排在「Allow <组织> …」之前，
		// 否则后者的贪婪 (.+) 会吞掉整段描述——这里用两条译文互不相同来钉住顺序。
		const selective = translateText(
			"Allow Koishi-CE, and select non-Koishi-CE, actions and reusable workflows",
			view,
		);
		const plain = translateText(
			"Allow Koishi-CE actions and reusable workflows",
			view,
		);
		expect(selective).toContain("非 Koishi-CE");
		expect(plain).not.toContain("非 Koishi-CE");
	});
});

describe("组织级 Actions 常规权限页的节点边界", () => {
	it("reassembles the Marketplace row split by its link", () => {
		// 实机：`Allow actions by Marketplace ` 是文本节点，`verified creators` 是 <a> 的文本
		expect(
			renderNodes([
				"Allow actions by Marketplace ",
				"verified creators",
			]),
		).toBe("允许 Marketplace 中的操作 已验证的创建者");
	});

	it("reassembles the allowlist caption split by its two <code> fragments", () => {
		// `!` 与 `*` 在 <code> 里（排除容器），引擎原样保留
		expect(
			renderNodes([
				"Wildcards, tags, and SHAs are allowed. Use ",
				"!",
				" prefix to block.",
			]),
		).toBe(
			"允许使用通配符、标签和 SHA。使用 ! 前缀来阻止。",
		);
	});

	it("reassembles the wildcard warning banner split by <code> and <strong>", () => {
		// 两条横幅默认 hidden，但仍在 DOM 里 —— 隐藏节点照常翻译
		expect(
			renderNodes([
				"Your list contains a ",
				"*",
				" wildcard pattern, which will ",
				"allow all actions and reusable workflows",
				" except those that are explicitly blocked.",
			]),
		).toBe(
			"你的列表包含一个 * 通配符模式，这将 允许所有操作和可复用工作流 ，明确被阻止的那些除外。",
		);
		expect(
			renderNodes([
				"Your list contains ",
				"only blocked patterns",
				". By default, only allowed patterns specified in the list can be used. To allow all actions and reusable workflows except those that are explicitly blocked, add a ",
				"*",
				" wildcard pattern.",
			]),
		).toBe(
			"你的列表只包含 被阻止的模式。默认情况下，只能使用列表中指定的允许模式。若要允许除明确阻止之外的所有操作和可复用工作流，请添加 * 通配符模式。",
		);
	});

	it("reassembles the three custom-image captions sharing one prefix node", () => {
		const prefix =
			"Your enterprise has set a maximum limit of ";
		// walker 保留节点首尾空白，`<strong>` 里的数字由引擎按设计跳过
		expect(
			renderNodes([prefix, "100", " versions per image."]),
		).toBe("你的企业已设置最大上限为 100 个版本/镜像。");
		expect(
			renderNodes([
				prefix,
				"90",
				" days for unused version retention.",
			]),
		).toBe(
			"你的企业已设置最大上限为 90 天（未使用版本保留期）。",
		);
		expect(
			renderNodes([
				prefix,
				"90",
				" days for maximum version age.",
			]),
		).toBe(
			"你的企业已设置最大上限为 90 天（版本最长存在时间）。",
		);
	});

	it("reassembles the retention cap sentence around its number", () => {
		expect(
			renderNodes([
				"You can set a maximum limit of ",
				"400",
				" days.",
			]),
		).toBe("你可以设置的最大上限为 400 天。");
	});

	it("reassembles the write-token notice split by two <strong>write</strong>", () => {
		expect(
			renderNodes([
				"Send write tokens to workflows from fork pull requests. ",
				"This tells Actions to send tokens with ",
				"write",
				" permissions to workflows from pull requests originating from repository forks. Note that doing so will give maintainers of those forks ",
				"write",
				" permissions against the source repository.",
			]),
		).toBe(
			"向来自复刻拉取请求的工作流发送写入令牌。 这会让 Actions 向工作流发送具有 write 权限的令牌，用于来自仓库复刻的拉取请求中的工作流。请注意，这样做会让这些复刻的维护者获得对源仓库的 write 权限。",
		);
	});

	it("covers both singular and plural save aria-labels", () => {
		// 两个表单的保存按钮只差一个 `s`：属性按精确键匹配，两条必须各自登记
		expect(
			translateText(
				"Save fork pull request workflows setting",
				view,
			),
		).toBe("保存复刻拉取请求工作流设置");
		expect(
			translateText(
				"Save fork pull request workflows settings",
				view,
			),
		).toBe("保存复刻拉取请求工作流设置");
	});

	it("translates the same dropdown value in both places", () => {
		// 下拉的当前值（summary 里的 <span>）与菜单项同串：一条键覆盖多处
		for (const raw of ["Not allowed", "All repositories"]) {
			const translated = translateText(raw, view);
			expect(translated, `未命中：${raw}`).not.toBeNull();
			expect(translated).toMatch(/[\u4e00-\u9fff]/);
		}
		expect(translateText("All repositories", view)).toBe(
			"所有仓库",
		);
	});
});
