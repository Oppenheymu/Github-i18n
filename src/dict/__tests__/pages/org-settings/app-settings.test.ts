// 组织 GitHub App 开发者设置族（/organizations/<组织>/settings/apps/<应用名>/**）实机回归。
//
// 证据与强度：2026-11-04 维护者贴的 12 张整页截图与三个确认弹窗（general / permissions /
// client_secrets / key_pairs / beta / advanced / installations / app_managers）。
// 这一族页面此前**完全没有词条**，页面上零星的中文全部来自 global 与 org-settings 的
// 既有短词（保存更改 / 取消 / 删除 / 危险区域 / 常规 / 高级），其余整片英文。
//
// 本文件锁五件事：
//   ① 八个路由都命中 pages/org-settings + global（且不命中 pages/settings）；
//   ② 说明句的节点边界：下划线链接各自成节点，故按「前缀 + 链接 + 尾段」拼接；
//   ③ 含动态应用名的标题 / 说明走规则（可选功能、安装、应用管理员、面包屑）；
//   ④ 权限页的计数徽标走计数规则（2 selected / 1 mandatory）；
//   ⑤ 应用名、组织名与用户名是用户内容，原样保留。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const BASE =
	"/organizations/NapukettoDev/settings/apps/napukettobot";

const locale = dictForLocale("zh-CN");

function viewFor(pathname: string) {
	return buildView(
		pathname,
		locale,
		new Map(Object.entries(dictCore.aliases)),
	);
}

const generalView = viewFor(BASE);
const permissionsView = viewFor(`${BASE}/permissions`);
const clientSecretsView = viewFor(`${BASE}/client_secrets`);
const keyPairsView = viewFor(`${BASE}/key_pairs`);
const betaView = viewFor(`${BASE}/beta`);
const advancedView = viewFor(`${BASE}/advanced`);
const installationsView = viewFor(`${BASE}/installations`);
const managersView = viewFor(`${BASE}/app_managers`);

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
function renderNodes(
	nodes: readonly string[],
	view: ReturnType<typeof viewFor>,
): string {
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

describe("GitHub App 开发者设置族的路由", () => {
	it("loads org-settings on every subpage", () => {
		for (const path of [
			BASE,
			`${BASE}/permissions`,
			`${BASE}/client_secrets`,
			`${BASE}/key_pairs`,
			`${BASE}/beta`,
			`${BASE}/advanced`,
			`${BASE}/installations`,
			`${BASE}/app_managers`,
		]) {
			const names = moduleNames(path);
			expect(names).toContain("pages/org-settings");
			expect(names).toContain("global");
			expect(names).not.toContain("pages/settings");
			expect(names).not.toContain("pages/repo-settings");
		}
	});
});

describe("GitHub App 基本信息页", () => {
	it("translates the basic information block", () => {
		const nodes: readonly (readonly [string, string])[] = [
			["About", "关于"],
			["Owned by:", "所有者："],
			["App ID:", "应用 ID："],
			["Client ID:", "客户端 ID："],
			["Revoke all user tokens", "撤销所有用户令牌"],
			["Basic information", "基本信息"],
			["GitHub App name", "GitHub 应用名称"],
			[
				"The name of your GitHub App.",
				"你的 GitHub 应用的名称。",
			],
			[
				"This is displayed to users of your GitHub App",
				"此内容会显示给你的 GitHub 应用的用户",
			],
			["Markdown supported", "支持 Markdown"],
			["Homepage URL", "主页 URL"],
			[
				"The full URL to your GitHub App's website.",
				"你的 GitHub 应用网站的完整 URL。",
			],
			[
				"Identifying and authorizing users",
				"识别和授权用户",
			],
			["Add redirect URI", "添加重定向 URI"],
			["Redirect URI", "重定向 URI"],
			["Allow wildcard matching", "允许通配符匹配"],
			[
				"Request user authorization (OAuth) during installation",
				"安装期间请求用户授权（OAuth）",
			],
			["Enable Device Flow", "启用设备流"],
			["Post installation", "安装后"],
			["Setup URL (optional)", "设置 URL（可选）"],
			[
				"Users will be redirected to this URL after installing your GitHub App to complete additional setup.",
				"安装你的 GitHub 应用后，用户将被重定向到此 URL 以完成其他设置。",
			],
			["Redirect on update", "更新时重定向"],
			["Webhook", "网络钩子"],
			["Active", "启用"],
			["Secret", "机密"],
			["Webhook URL", "网络钩子 URL"],
			["Display information", "显示信息"],
			["Upload a logo...", "上传徽标…"],
			[
				"You can also drag and drop a picture from your computer.",
				"你也可以从计算机中拖放图片。",
			],
			["Drag & drop", "拖放"],
		];
		for (const [raw, expected] of nodes) {
			for (const variant of withWhitespace(raw)) {
				const translated = translateText(
					variant,
					generalView,
				);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
			expect(translateText(raw, generalView)).toBe(
				expected,
			);
		}
	});

	it("renders the sentences split by links", () => {
		expect(
			renderNodes(
				[
					"Using your App ID to get installation tokens? You can now",
					" ",
					"use your Client ID instead.",
				],
				generalView,
			),
		).toBe(
			"使用 App ID 获取安装令牌？现在你可以 改用 Client ID。",
		);
		expect(
			renderNodes(
				[
					"GitHub Apps can use OAuth credentials to identify users. Learn more about identifying users by reading our",
					" ",
					"integration developer documentation",
					".",
				],
				generalView,
			),
		).toBe(
			"GitHub 应用可以使用 OAuth 凭据来识别用户。进一步了解如何识别用户，请阅读我们的 集成开发者文档.",
		);
		expect(
			renderNodes(
				[
					"Requests that the installing user",
					" ",
					"grants access to their identity",
					" during installation of your App.",
				],
				generalView,
			),
		).toBe(
			"请求安装用户 授予对其身份的访问权限 在整个应用安装过程中。",
		);
		expect(
			renderNodes(
				[
					"Allow this GitHub App to authorize users via the",
					" ",
					"device flow",
					".",
				],
				generalView,
			),
		).toBe("允许此 GitHub 应用授权用户通过 设备流.");
		expect(
			renderNodes(
				[
					"Events will POST to this URL with a",
					" ",
					"webhook",
					".",
				],
				generalView,
			),
		).toBe(
			"事件将向此 URL 发送 POST 请求，并附带一个 网络钩子.",
		);
		expect(
			renderNodes(
				[
					"Set a secret to",
					" ",
					"secure your webhooks",
					".",
				],
				generalView,
			),
		).toBe("设置一个机密以 保护你的网络钩子.");
	});
});

describe("IP 允许列表", () => {
	it("translates the allow list block", () => {
		expect(
			translateText(
				"There are no IP addresses on the allow list yet.",
				advancedView,
			),
		).toBe("允许列表中还没有 IP 地址。");
		expect(
			translateText(
				"IP address or CIDR range",
				advancedView,
			),
		).toBe("IP 地址或 CIDR 范围");
		expect(
			translateText("Short description", advancedView),
		).toBe("简短描述");
		expect(translateText("Add", advancedView)).toBe("添加");
		expect(
			translateText("Check IP address", advancedView),
		).toBe("检查 IP 地址");
		expect(
			translateText(
				"Enter an IP address to check whether it is permitted by enabled entries on the IP allow list.",
				advancedView,
			),
		).toBe(
			"输入 IP 地址，以检查它是否被 IP 允许列表中已启用的条目允许。",
		);
		expect(
			renderNodes(
				[
					"Enter the IP addresses of your GitHub App to allow organizations with",
					" ",
					"IP allow lists",
					" to selectively inherit the App's IP allow list when installed.",
					" ",
					"Learn more about App IP allow lists",
					".",
				],
				advancedView,
			),
		).toBe(
			"输入你的 GitHub 应用的 IP 地址，以允许拥有 IP 允许列表 的组织在安装后选择性地继承该应用的 IP 允许列表。 进一步了解应用 IP 允许列表.",
		);
	});
});

describe("权限页", () => {
	it("translates the permission groups and the note form", () => {
		const nodes: readonly (readonly [string, string])[] = [
			["Organization permissions", "组织权限"],
			[
				"Organization permissions permit access to organization related resources.",
				"组织权限允许访问组织相关资源。",
			],
			["Account permissions", "账户权限"],
			[
				"These permissions are granted on an individual user basis as part of the User authorization flow.",
				"这些权限是按单个用户授予的，属于用户授权流程的一部分。",
			],
			["Enterprise permissions", "企业权限"],
			[
				"Enterprise permissions permit access to enterprise account resources.",
				"企业权限允许访问企业账户资源。",
			],
			[
				"Repository permissions permit access to repositories and related resources.",
				"仓库权限允许访问仓库及相关资源。",
			],
			["Add a note to users", "为用户添加备注"],
			[
				"This note will be displayed on the permissions update approval page.",
				"此备注将显示在权限更新批准页面上。",
			],
			[
				"Add a note to your users explaining why you are requesting these changes.",
				"为你的用户添加备注，说明你请求这些更改的原因。",
			],
			[
				"Are you sure you want to update permissions?",
				"你确定要更新权限吗？",
			],
			[
				"Current users will be prompted to accept these changes and enable the new permissions on their installation.",
				"现有用户将被提示接受这些更改并在其安装上启用新权限。",
			],
		];
		for (const [raw, expected] of nodes) {
			expect(translateText(raw, permissionsView)).toBe(
				expected,
			);
		}
	});

	it("renders the user-permissions sentence across its two links", () => {
		expect(
			renderNodes(
				[
					"These",
					" ",
					"user permissions",
					" are granted on an individual user basis as part of the",
					" ",
					"user authorization flow",
				],
				permissionsView,
			),
		).toBe(
			"这些 用户权限 是按单个用户授予的，属于以下流程的一部分： 用户授权流程",
		);
	});

	it("translates the count badges", () => {
		for (const [raw, expected] of [
			["2 selected", "2 项已选"],
			["1 mandatory", "1 项必选"],
		] as const) {
			expect(translateText(raw, permissionsView)).toBe(
				expected,
			);
		}
	});
});

describe("凭据页（客户端机密与私钥）", () => {
	it("translates the credentials header and client secrets", () => {
		for (const [raw, expected] of [
			["Credentials", "凭据"],
			["Client secrets", "客户端机密"],
			["Key pairs", "密钥对"],
			["New secret", "新建机密"],
			["Client secret", "客户端机密"],
			["Never used", "从未使用"],
			[
				"Client secrets authenticate this GitHub App using the OAuth client flow.",
				"客户端机密使用 OAuth 客户端流程对此 GitHub 应用进行身份验证。",
			],
			[
				"You cannot delete the only client secret. Generate a new client secret first.",
				"你不能删除唯一的客户端机密。请先生成新的客户端机密。",
			],
			["Added", "添加于"],
			["by", "由"],
		] as const) {
			expect(translateText(raw, clientSecretsView)).toBe(
				expected,
			);
		}
		expect(
			renderNodes(
				[
					"Added",
					" ",
					"2 weeks ago",
					" ",
					"by",
					" ",
					"Oppenheymu",
				],
				clientSecretsView,
			),
		).toBe("添加于 2 周前 由 Oppenheymu");
	});

	it("translates the key pairs page and both delete dialogs", () => {
		for (const [raw, expected] of [
			["Private key", "私钥"],
			["New key", "新建密钥"],
			[
				"You need a private key to sign access token requests.",
				"你需要私钥来签署访问令牌请求。",
			],
			["Learn more about private keys", "进一步了解私钥"],
			["Delete client secret?", "删除客户端机密？"],
			[
				"This action cannot be undone. This client secret will stop working immediately. Are you sure you want to delete this client secret?",
				"此操作无法撤销。此客户端机密将立即停止工作。你确定要删除此客户端机密吗？",
			],
			["Delete private key?", "删除私钥？"],
			[
				"This action cannot be undone. This key will stop working immediately. Are you sure you want to delete this private key?",
				"此操作无法撤销。此密钥将立即停止工作。你确定要删除此私钥吗？",
			],
		] as const) {
			expect(translateText(raw, keyPairsView)).toBe(
				expected,
			);
		}
	});

	it("covers both apostrophes of the new-secret notice", () => {
		for (const raw of [
			"Make sure to copy your new client secret now. You won't be able to see it again.",
			"Make sure to copy your new client secret now. You won’t be able to see it again.",
		]) {
			expect(translateText(raw, clientSecretsView)).toBe(
				"请立即复制你的新客户端机密。之后你将无法再次查看它。",
			);
		}
	});
});

describe("可选功能页与危险区域", () => {
	it("renders the optional features through the dynamic rules", () => {
		for (const [raw, expected] of [
			["Permissions & events", "权限与事件"],
			["Optional features", "可选功能"],
			["Install App", "安装应用"],
			["App managers", "应用管理员"],
			["Public page", "公开页面"],
			["Opt-out", "停用"],
			[
				"User-to-server token expiration",
				"用户到服务器令牌过期",
			],
		] as const) {
			expect(translateText(raw, betaView)).toBe(expected);
		}
		expect(
			translateText(
				"Activate optional features for NapukettoBot",
				betaView,
			),
		).toBe("为 NapukettoBot 启用可选功能");
		expect(
			translateText(
				"Choose a feature to activate for NapukettoBot:",
				betaView,
			),
		).toBe("选择要为 NapukettoBot 启用的功能：");
		expect(
			translateText(
				"User-to-server access tokens will expire after 8 hours. A Refresh Token will be provided which can be exchanged for a new access token.",
				betaView,
			),
		).toBe(
			"用户到服务器访问令牌将在 8 小时后过期。届时会提供一个刷新令牌，可用于换取新的访问令牌。",
		);
	});

	it("translates the danger zone on the advanced page", () => {
		for (const [raw, expected] of [
			[
				"Transfer ownership of this GitHub App",
				"转移此 GitHub 应用的所有权",
			],
			[
				"Transferring may be delayed until the new owner approves the transfer.",
				"转移可能会延迟，直到新所有者批准转移。",
			],
			["Transfer ownership", "转移所有权"],
			["Delete this GitHub App", "删除此 GitHub 应用"],
			[
				"This cannot be undone. Please be certain.",
				"此操作无法撤销。请务必确认。",
			],
			["Delete GitHub App", "删除 GitHub 应用"],
			[
				"Make this GitHub App public",
				"将此 GitHub 应用设为公开",
			],
			[
				"Allow this GitHub App to be installed on other accounts.",
				"允许在其他账户上安装此 GitHub 应用。",
			],
			["Make public", "设为公开"],
		] as const) {
			expect(translateText(raw, advancedView)).toBe(
				expected,
			);
		}
	});
});

describe("安装页与应用管理员页", () => {
	it("renders the install pages", () => {
		expect(
			translateText(
				"Install NapukettoBot",
				installationsView,
			),
		).toBe("安装 NapukettoBot");
		expect(
			translateText(
				"Choose an account to install NapukettoBot on:",
				installationsView,
			),
		).toBe("选择要安装 NapukettoBot 的账户：");
		// 拆节点形态
		expect(
			renderNodes(
				[
					"Choose an account to install",
					" NapukettoBot",
					" on:",
				],
				installationsView,
			),
		).toBe("选择要安装 NapukettoBot 的账户：");
	});

	it("renders the app managers page", () => {
		for (const [raw, expected] of [
			["Organization owner", "组织所有者"],
			[
				"Search for teams or users by login or full name",
				"按登录名或全名搜索团队或用户",
			],
			[
				"Search by team, username or full name",
				"按团队、用户名或全名搜索",
			],
			["Grant", "授予"],
		] as const) {
			expect(translateText(raw, managersView)).toBe(
				expected,
			);
		}
		expect(
			translateText(
				"These people can manage settings, permissions and webhooks for NapukettoBot.",
				managersView,
			),
		).toBe(
			"这些人可以管理 NapukettoBot 的设置、权限和网络钩子。",
		);
	});

	it("translates the breadcrumb while keeping the owner name", () => {
		expect(
			translateText("NapukettoDev settings", generalView),
		).toBe("NapukettoDev 设置");
	});
});

describe("GitHub App 开发者设置页的用户内容", () => {
	it("keeps app, organization and user names as-is", () => {
		for (const raw of [
			"NapukettoBot",
			"NapukettoDev",
			"Oppenheymu",
			"*****b1af4c4d",
		]) {
			expect(
				translateText(raw, generalView),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});
