// 组织 GitHub Apps 安装详情页与权限更新确认页的实机回归。
//
// 证据与强度：2026-11-04 维护者贴的五张截图（扩展仍在运行）：
//   · /organizations/<组织>/settings/installations/<id>（权限清单 + 危险区域）
//   · …/permissions/update（更新确认页与展开后的权限清单）
//   · /organizations/<组织>/settings/apps/<应用名>（更新成功的 flash）
// 截图只给文本、不给节点边界，故登记依据是「截图里中英交界的位置」：
// `读取 access to metadata`、`Read and write access to 拉取请求` 这类半中半英的行
// 直接暴露了节点边界（中文只出现在节点边界与词条吻合的位置）。
//
// 本文件锁四件事：
//   ① 两个路由都命中 pages/org-settings + global，且不命中 pages/settings
//      （个人设置的 `/settings/installations` 是另一页，词条与本页完全不同）；
//   ② 安装详情页的静态节点（含 `Installed` / `Developed by` 这类「前缀 + 动态节点」）；
//   ③ 权限行的节点拼接：`Read` + `access to metadata`、`Read and write access to` + 权限名；
//   ④ 含动态应用名 / 组织名的整句走规则（卸载标题、更新标题、底部说明、flash），
//      应用名与组织名原样带回。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const INSTALLATION_PATH =
	"/organizations/NapukettoDev/settings/installations/173748461";
const UPDATE_PATH =
	"/organizations/NapukettoDev/settings/installations/173748461/permissions/update";
const APPS_PATH =
	"/organizations/NapukettoDev/settings/apps/napukettobot";
// 列表页（不带安装 id）：与个人设置 / 仓库设置渲染同一个「已安装应用」组件
const LISTING_PATH =
	"/organizations/NapukettoDev/settings/installations";

const locale = dictForLocale("zh-CN");

function viewFor(pathname: string) {
	return buildView(
		pathname,
		locale,
		new Map(Object.entries(dictCore.aliases)),
	);
}

const installationView = viewFor(INSTALLATION_PATH);
const updateView = viewFor(UPDATE_PATH);
const appsView = viewFor(APPS_PATH);
const listingView = viewFor(LISTING_PATH);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 安装详情页的静态节点（译文逐条钉死） */
const INSTALLATION_NODES: readonly (readonly [
	string,
	string,
])[] = [
	["Installed", "已安装"],
	["Developed by", "开发者："],
	["App settings", "应用设置"],
	["Permissions", "权限"],
	["Review request", "审查请求"],
	[
		"This applies to all current and future repositories owned by the resource owner. Also includes public repositories (read-only).",
		"这适用于资源所有者拥有的所有当前及未来仓库。也包括公开仓库（只读）。",
	],
	["Only select repositories", "仅选择仓库"],
	[
		"Select at least one repository. Also includes public repositories (read-only).",
		"至少选择一个仓库。也包括公开仓库（只读）。",
	],
	["Suspend your installation", "暂停你的安装"],
	[
		"This will block the app access to your resources.",
		"这将阻止该应用访问你的资源。",
	],
	["Suspend", "暂停"],
	[
		"This will remove the app and revoke access to all resources.",
		"这将移除该应用并撤销对所有资源的访问权限。",
	],
	["Uninstall", "卸载"],
];

/** 权限更新确认页的静态节点 */
const UPDATE_NODES: readonly (readonly [string, string])[] =
	[
		["Repository permissions", "仓库权限"],
		["Read and write", "读取和写入"],
		["Read-only", "只读"],
		["Read and write access to", "读取和写入权限："],
		["Read-only access to", "只读权限："],
		["access to", "权限："],
		["Contents", "内容"],
		["Metadata", "元数据"],
		["New request", "新请求"],
		["Show unchanged permissions", "显示未更改的权限"],
		["Hide unchanged permissions", "隐藏未更改的权限"],
		["Accept new permissions", "接受新权限"],
	];

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

describe("GitHub App 安装页的模块路由", () => {
	it("loads the org-settings shell on both pages", () => {
		for (const path of [INSTALLATION_PATH, UPDATE_PATH]) {
			const names = moduleNames(path);
			expect(names).toContain("pages/org-settings");
			expect(names).toContain("global");
			expect(names).not.toContain("pages/settings");
			expect(names).not.toContain("pages/repo-settings");
		}
	});
});

describe("GitHub App 安装详情页（…/settings/installations/<id>）", () => {
	it("translates every static node the screenshot still showed in English", () => {
		for (const [raw, expected] of INSTALLATION_NODES) {
			for (const variant of withWhitespace(raw)) {
				const translated = translateText(
					variant,
					installationView,
				);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
			expect(translateText(raw, installationView)).toBe(
				expected,
			);
		}
	});

	it("translates the two permission rows across their node boundary", () => {
		// 截图里 `读取 access to metadata` 正是两个节点：`Read` 命中既有角色词条，
		// 后半段是一个独立文本节点（权限名在它内部）
		expect(
			renderNodes(
				["Read", " access to metadata"],
				installationView,
			),
		).toBe("读取 元数据的访问权限");
		expect(
			renderNodes(
				["Read", " and write access to code"],
				installationView,
			),
		).toBe("读取 及代码的写入权限");
	});

	it("translates the update banner when the app name is its own node", () => {
		const tail =
			"is requesting an update to its permissions.";
		expect(translateText(tail, installationView)).toBe(
			"正在请求更新其权限。",
		);
		// 应用名是用户内容，保持英文
		expect(
			renderNodes(
				["NapukettoBot", " ", tail],
				installationView,
			),
		).toBe("NapukettoBot 正在请求更新其权限。");
	});

	it("translates the danger zone through the dynamic rules", () => {
		expect(
			translateText(
				"Selected 3 repositories.",
				installationView,
			),
		).toBe("已选择 3 个仓库。");
		expect(
			translateText(
				"Selected 1 repository.",
				installationView,
			),
		).toBe("已选择 1 个仓库。");
		expect(
			translateText(
				"Uninstall “NapukettoBot”",
				installationView,
			),
		).toBe("卸载“NapukettoBot”");
		// 上游若渲染直引号也接得住
		expect(
			translateText(
				'Uninstall "NapukettoBot"',
				installationView,
			),
		).toBe("卸载“NapukettoBot”");
	});
});

describe("权限更新确认页（…/permissions/update）", () => {
	it("translates every static node the screenshot still showed in English", () => {
		for (const [raw, expected] of UPDATE_NODES) {
			for (const variant of withWhitespace(raw)) {
				const translated = translateText(
					variant,
					updateView,
				);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
			expect(translateText(raw, updateView)).toBe(expected);
		}
	});

	it("assembles the permission rows from either node split", () => {
		// 截图形态：级别（含连接词）一个节点 + 权限名一个节点
		expect(
			renderNodes(
				["Read and write access to", "Contents"],
				updateView,
			),
		).toBe("读取和写入权限：内容");
		expect(
			renderNodes(
				["Read-only access to", "Metadata"],
				updateView,
			),
		).toBe("只读权限：元数据");
		expect(
			renderNodes(
				["Read and write access to", "Pull requests"],
				updateView,
			),
		).toBe("读取和写入权限：拉取请求");
		// 上游若把级别与 `access to` 拆成两个节点
		expect(
			renderNodes(
				["Read and write", " access to ", "Contents"],
				updateView,
			),
		).toBe("读取和写入 权限： 内容");
	});

	it("renders the heading through the prefix rule and the static tail", () => {
		expect(
			translateText("The NapukettoBot app by", updateView),
		).toBe("应用「NapukettoBot」（由");
		expect(
			translateText(
				"is requesting updated permissions",
				updateView,
			),
		).toBe("开发）正在请求更新权限");
		expect(
			renderNodes(
				[
					"The",
					" NapukettoBot",
					" app by",
					" ",
					"NapukettoDev",
					" is requesting updated permissions",
				],
				updateView,
			),
		).toBe(
			"名为 NapukettoBot 的应用（由 NapukettoDev 开发）正在请求更新权限",
		);
		// 整句一个节点时由整句规则接住
		expect(
			translateText(
				"The NapukettoBot app by NapukettoDev is requesting updated permissions",
				updateView,
			),
		).toBe(
			"应用「NapukettoBot」（由 NapukettoDev 开发）正在请求更新权限",
		);
	});

	it("renders the retain-permissions note both as fragments and as one node", () => {
		const tail =
			"app will retain its current permissions if you choose not to accept the new permissions.";
		expect(translateText(tail, updateView)).toBe(
			"的应用将保留当前权限（如果你选择不接受新权限）。",
		);
		expect(
			renderNodes(
				["The", " NapukettoBot", ` ${tail}`],
				updateView,
			),
		).toBe(
			"名为 NapukettoBot 的应用将保留当前权限（如果你选择不接受新权限）。",
		);
		expect(
			translateText(
				"The NapukettoBot app will retain its current permissions if you choose not to accept the new permissions.",
				updateView,
			),
		).toBe(
			"如果不接受新权限，NapukettoBot 应用将保留当前权限。",
		);
	});
});

describe("GitHub App 更新成功的 flash", () => {
	it("translates both flash messages", () => {
		expect(
			translateText(
				"Okay, NapukettoBot was updated for the @NapukettoDev account.",
				appsView,
			),
		).toBe(
			"好的，NapukettoBot 已在 @NapukettoDev 账户下更新。",
		);
		expect(
			translateText(
				"Got it. Your GitHub App has been updated.",
				appsView,
			),
		).toBe("知道了。你的 GitHub 应用已更新。");
	});
});

describe("GitHub App 安装页的用户内容", () => {
	it("keeps app and organization names as-is", () => {
		for (const raw of [
			"NapukettoBot",
			"NapukettoDev",
			"koishi",
		]) {
			expect(
				translateText(raw, installationView),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});

describe("已安装的 GitHub Apps 列表页（组织设置）", () => {
	it("still matches pages/org-settings, not the personal or repo module", () => {
		const names = moduleNames(LISTING_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
		expect(names).not.toContain("pages/settings");
		expect(names).not.toContain("pages/repo-settings");
	});

	it("renders the shared header card and the card subtitle prefix", () => {
		// 同一个「已安装应用」组件：页头与说明的译文必须与个人设置 / 仓库设置一致
		expect(
			translateText("Installed GitHub Apps", listingView),
		).toBe("已安装的 GitHub 应用");
		expect(
			translateText(
				"GitHub Apps augment and extend your workflows on GitHub with commercial, open source, and homegrown tools.",
				listingView,
			),
		).toBe(
			"GitHub Apps 可通过商业、开源与自研工具增强并扩展你在 GitHub 上的工作流。",
		);
		// 卡片副标题：前缀 + 应用所有者链接（所有者名是用户内容）
		expect(
			renderNodes(
				["Developed by ", "Codecov"],
				listingView,
			),
		).toBe("开发者： Codecov");
	});
});
