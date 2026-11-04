// GitHub App 权限页（/organizations/<组织>/settings/apps/<应用名>/permissions）实机回归。
//
// 证据与强度：2026-11-04 维护者贴的 9 张整页截图（仓库 / 组织 / 账户 / 企业四段权限清单）
// 与两段实机 HTML（主页 URL 的 note、重定向 URI 的 Subhead-description）。
// 这一页此前只有「段标题 + 段说明 + 少数与侧栏同名的权限名」能命中（代码质量 / 内容 /
// 议题 / 元数据 / 软件包 / 页面 / 项目 / 拉取请求 … 都是既有侧栏词条的产物），其余权限名
// 与全部说明句都是英文。本轮按截图逐条登记 245 个键（含撇号变体）。
//
// 本文件锁四件事：
//   ① 路由命中 pages/org-settings + global；
//   ② 权限名与说明句都是**整节点**，逐段抽检译文；
//   ③ `Access:` 标签、行内 `Selected` / `Mandatory` 徽标是独立节点；
//   ④ 说明句末尾的 `Learn more.` 链接另起节点，面包屑规则不再吞掉 `… settings` 结尾的
//      权限名与说明句（`^(?<owner>.+) settings$` 改成了只匹配登录名）。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const BASE =
	"/organizations/NapukettoDev/settings/apps/napukettobot";
const PATH = `${BASE}/permissions`;

const locale = dictForLocale("zh-CN");
const view = buildView(
	PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n          ${node}\n        `];
}

/** 按 walker 的语义拼接相邻节点（保留每个节点的首尾空白） */
function renderNodes(nodes: readonly string[]): string {
	return nodes
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
}

describe("GitHub App 权限页的路由", () => {
	it("loads org-settings on the permissions page", () => {
		const names = moduleNames(PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
		expect(names).not.toContain("pages/settings");
		expect(names).not.toContain("pages/repo-settings");
	});
});

describe("GitHub App 权限页的文本节点", () => {
	it("translates the access label and the status badges", () => {
		expect(translateText("Access:", view)).toBe(
			"访问权限：",
		);
		expect(translateText("Selected", view)).toBe("已选中");
		expect(translateText("Mandatory", view)).toBe("必选");
	});

	it("renders the section headers and their count pills", () => {
		expect(
			translateText("Repository permissions", view),
		).toBe("仓库权限");
		expect(
			translateText("Organization permissions", view),
		).toBe("组织权限");
		expect(translateText("Account permissions", view)).toBe(
			"账户权限",
		);
		expect(
			translateText("Enterprise permissions", view),
		).toBe("企业权限");
		// 段标题的计数徽标是「数字 + 小写单词」两个节点
		expect(translateText("selected", view)).toBe("已选中");
		expect(translateText("mandatory", view)).toBe("必选");
	});

	it("translates repository permission names", () => {
		const nodes: [string, string][] = [
			["Administration", "管理"],
			["Agent secrets", "代理机密"],
			["Artifact metadata", "构件元数据"],
			["Attestations", "证明"],
			["Checks", "检查"],
			["Code scanning alerts", "代码扫描警报"],
			[
				"Codespaces lifecycle admin",
				"代码空间生命周期管理",
			],
			["Commit statuses", "提交状态"],
			["Deployments", "部署"],
			["Environments", "环境"],
			[
				"GitHub App installation repository access",
				"GitHub App 安装仓库访问权限",
			],
			["License compliance alerts", "许可证合规警报"],
			["Merge queues", "合并队列"],
			["Repository license policy", "仓库许可证策略"],
			["Repository security advisories", "仓库安全公告"],
			[
				"Secret scanning push protection bypass requests",
				"机密扫描推送保护绕过请求",
			],
			["Secrets", "机密"],
			["Single file", "单个文件"],
			["Variables", "变量"],
			["Workflows", "工作流"],
		];
		for (const [raw, expected] of nodes) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("translates repository permission descriptions", () => {
		const nodes: [string, string][] = [
			[
				"Workflows, workflow runs and artifacts.",
				"工作流、工作流运行和构件。",
			],
			[
				"View, create, and manage agent tasks in a repository.",
				"查看、创建和管理仓库中的代理任务。",
			],
			[
				"Create and retrieve attestations for a repository.",
				"创建并获取仓库的证明。",
			],
			[
				"Manage the lifecycle of Codespaces, including starting and stopping.",
				"管理代码空间的生命周期，包括启动和停止。",
			],
			[
				"Restrict Codespaces user secrets modifications to specific repositories.",
				"将代码空间用户机密的修改限制在特定仓库。",
			],
			[
				"Manage which GitHub Apps can access a repository.",
				"管理哪些 GitHub App 可以访问仓库。",
			],
			[
				"Manage a repository's merge queues.",
				"管理仓库的合并队列。",
			],
			[
				"Review and manage repository secret scanning push protection bypass requests.",
				"审查和管理仓库机密扫描推送保护绕过请求。",
			],
			[
				"Update GitHub Action workflow files.",
				"更新 GitHub Action 工作流文件。",
			],
		];
		for (const [raw, expected] of nodes) {
			for (const variant of withWhitespace(raw)) {
				expect(translateText(variant, view)).toBe(expected);
			}
		}
	});

	it("translates organization permission names and descriptions", () => {
		const nodes: [string, string][] = [
			["API Insights", "API 洞察"],
			["Blocking users", "屏蔽用户"],
			["Campaigns", "活动"],
			["Copilot content exclusion", "Copilot 内容排除"],
			["Custom organization roles", "自定义组织角色"],
			[
				"Custom properties for organizations",
				"组织的自定义属性",
			],
			[
				"Hosted runner custom images",
				"托管运行器自定义映像",
			],
			["Issue Fields", "议题字段"],
			["Network configurations", "网络配置"],
			["Organization IP allow list", "组织 IP 允许列表"],
			["Organization credentials", "组织凭据"],
			["Self-hosted runners", "自托管运行器"],
			[
				"View and manage an organization IP allow list",
				"查看和管理组织 IP 允许列表",
			],
			[
				"Manage Codespaces Secrets for an organization.",
				"管理组织的代码空间机密。",
			],
			[
				"View and revoke personal access tokens that have been granted access to an organization.",
				"查看和撤销已被授予组织访问权限的个人访问令牌。",
			],
			[
				"Review and manage secret scanning alert dismissal requests",
				"审查和管理机密扫描警报忽略请求",
			],
		];
		for (const [raw, expected] of nodes) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("translates account and enterprise permission names", () => {
		const nodes: [string, string][] = [
			["Block another user", "屏蔽其他用户"],
			["Codespaces user secrets", "代码空间用户机密"],
			["Email addresses", "电子邮箱地址"],
			["Git SSH keys", "Git SSH 密钥"],
			["GPG keys", "GPG 密钥"],
			["SSH signing keys", "SSH 签名密钥"],
			["Starring", "星标"],
			["Enterprise AI controls", "企业 AI 控制"],
			["Enterprise SCIM", "企业 SCIM"],
			["Enterprise billing", "企业账单"],
			[
				"Enterprise custom organization roles",
				"企业自定义组织角色",
			],
			["Enterprise license policy", "企业许可证策略"],
			["Enterprise settings", "企业设置"],
			["Enterprise teams", "企业团队"],
			[
				"Enterprise two-factor authentication",
				"企业双因素认证",
			],
			[
				"Manage verifiable domains for an enterprise",
				"管理企业的可验证域名",
			],
		];
		for (const [raw, expected] of nodes) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("keeps both apostrophe forms of the same sentence", () => {
		// 实机撇号形态无法从截图分辨，两种都收（译文相同）
		expect(
			translateText(
				"Manage a user's email addresses",
				view,
			),
		).toBe("管理用户的电子邮箱地址");
		expect(
			translateText(
				"Manage a user’s email addresses",
				view,
			),
		).toBe("管理用户的电子邮箱地址");
	});
});

describe("GitHub App 权限页的节点边界", () => {
	it("renders a permission row across its description and link nodes", () => {
		expect(
			renderNodes([
				"View and manage an organization IP allow list",
				" ",
				"Learn more.",
			]),
		).toBe("查看和管理组织 IP 允许列表 了解更多。");
	});

	it("renders the section header with its count pills", () => {
		expect(
			renderNodes([
				"Repository permissions",
				" ",
				"2",
				" ",
				"selected",
			]),
		).toBe("仓库权限 2 已选中");
	});

	it("does not turn arbitrary `… settings` strings into a breadcrumb", () => {
		// 面包屑规则收紧到「登录名 + settings」，说明句与权限名必须整节点命中
		expect(
			translateText("Foo Bar settings", view),
		).toBeNull();
		expect(
			translateText("Advanced Security settings", view),
		).toBeNull();
		expect(
			translateText("NapukettoDev settings", view),
		).toBe("NapukettoDev 设置");
	});
});

describe("GitHub App 权限页的用户内容", () => {
	it("keeps app and organization names as-is", () => {
		for (const raw of [
			"napukettobot",
			"NapukettoDev",
			"Oppenheymu",
		]) {
			expect(translateText(raw, view)).toBeNull();
		}
	});
});
