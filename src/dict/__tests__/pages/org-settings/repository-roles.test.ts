// 组织仓库角色页（/organizations/<组织>/settings/roles）实机文本回归。
//
// 证据与强度：2026-10-07 维护者贴出的**整页实机 HTML**（采集时扩展仍在运行，故页面上
// 已是中文的节点——`Repository roles` 标题、五个角色名、横幅的 `Learn more`——是既有键的
// 产物，仍是英文的才是本批清单）。本页是服务端渲染的传统 Primer 页面（`Subhead` +
// Octicon SVG），与 React 重写的空态不同：长句里没有插值项时就是一个整文本节点，故说明句
// 按整节点收；唯一的例外是 `You can …` 那句——句中的 `<a>set the base role</a>` 把句子
// 切成文本 / 链接 / 文本三段。
//
// 本文件锁五件事：
//   ① 本页与旧前缀 `/orgs/...` 都只命中 `pages/org-settings` + `global`，**不命中**
//      `pages/settings` / `pages/settings-billing` / `pages/repo-settings`；
//   ② 本批 14 条新键在实机的真实节点上全部命中（含带源码缩进与换行的形态）；
//   ③ 五个角色名与横幅的 `Learn more` 仍由既有键命中，译文逐字不变；
//   ④ `You can …` 是**三个节点**：整句作为一个节点时任何键都不该命中（反例钉住）；
//   ⑤ 与页面同形的拼接结果逐字正确（两处空格来自节点首尾空白，是既成事实）。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织仓库角色页 */
const ROLES_PATH =
	"/organizations/Koishi-CE/settings/roles";
/** 旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const LEGACY_PATH = "/orgs/Koishi-CE/settings/roles";

const locale = dictForLocale("zh-CN");

/** 本页命中的模块视图（pages/org-settings + global） */
const view = buildView(
	ROLES_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 本轮新补的文本节点（按实机 HTML 的标签嵌套誊录） */
const NEW_NODES: readonly string[] = [
	// —— 页首 ——
	"Roles are used to grant access and permissions for teams and members.",
	// —— 预定义角色区块 ——
	"Pre-defined roles",
	// `You can …` 被链接切成三段
	"You can",
	"set the base role",
	"for this organization from one of these roles.",
	// —— 五个预定义角色的说明句 ——
	"Read and clone repositories. Open and comment on issues and pull requests.",
	"Read permissions plus manage issues and pull requests.",
	"Triage permissions plus read, clone and push to repositories.",
	"Write permissions plus manage issues, pull requests and some repository settings.",
	"Full access to repositories including sensitive and destructive actions.",
	// 管理员那一行句尾的链接
	"Modify Admin Role",
	// —— 页尾的 Enterprise 升级横幅 ——
	"Create custom roles with GitHub Enterprise",
	"Enterprise accounts offer organizations more granular control over permissions by allowing you to configure up to 20 custom repository roles. This enables greater control over who and how your users access code and data in your organization.",
	"Start free for 30 days",
];

/** 本页渲染时已由既有键覆盖的节点（本批之前就是中文） */
const ALREADY_COVERED: readonly (readonly [
	string,
	string,
])[] = [
	["Repository roles", "仓库角色"],
	// 五个角色名（同一模块的既有键，见 org-roles.test.ts）
	["Read", "读取"],
	["Triage", "分类"],
	["Write", "写入"],
	["Maintain", "维护"],
	["Admin", "管理员"],
	// 横幅的次级按钮由 global 的短键命中
	["Learn more", "了解更多"],
];

/** 必须保持英文：纯符号节点与用户内容 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// 纯符号节点：不含拉丁字母，可翻译判定直接跳过
	".",
	// 组织名（用户内容）
	"Koishi-CE",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/**
 * 把一段实机节点序列按 walker 的语义过一遍：未命中的节点按原样保留，
 * 命中的节点写回译文并保留其首尾空白（**整节点被判空时不留空白**，与
 * walker.applyTextNode 的 erased 语义一致），最后拼接成页面上真实看到的那一行。
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

describe("组织仓库角色页的模块路由", () => {
	it("loads the org-settings shell with the global fallback", () => {
		const names = moduleNames(ROLES_PATH);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
	});

	it("does not match the personal or per-repository settings modules", () => {
		const names = moduleNames(ROLES_PATH);
		expect(names).not.toContain("pages/settings");
		expect(names).not.toContain("pages/settings-billing");
		expect(names).not.toContain("pages/repo-settings");
	});

	it("covers the legacy orgs prefix as well", () => {
		expect(moduleNames(LEGACY_PATH)).toContain(
			"pages/org-settings",
		);
	});
});

describe("组织仓库角色页的实机节点", () => {
	it("translates every newly registered node", () => {
		for (const node of NEW_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(variant, view);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("keeps the nodes that were already covered before this batch", () => {
		for (const [raw, expected] of ALREADY_COVERED) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("keeps the period node and the org name as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("translates the role descriptions verbatim", () => {
		expect(
			translateText(
				"Read and clone repositories. Open and comment on issues and pull requests.",
				view,
			),
		).toBe("读取并克隆仓库。打开并评论议题和拉取请求。");
		expect(
			translateText(
				"Full access to repositories including sensitive and destructive actions.",
				view,
			),
		).toBe(
			"对仓库的完全访问权限，包括敏感操作和破坏性操作。",
		);
		expect(translateText("Modify Admin Role", view)).toBe(
			"修改管理员角色",
		);
	});
});

describe("组织仓库角色页的节点切分事实", () => {
	it("requires the intro sentence to be split in three nodes", () => {
		// 句中 `<a>set the base role</a>` 把句子切成文本 / 链接 / 文本：
		// 整句作为一个节点时任何键都不该命中，三段才是实机节点
		expect(
			translateText(
				"You can set the base role for this organization from one of these roles.",
				view,
			),
		).toBeNull();
		expect(translateText("You can", view)).toBe("你可以");
		expect(translateText("set the base role", view)).toBe(
			"设置基础角色",
		);
		expect(
			translateText(
				"for this organization from one of these roles.",
				view,
			),
		).toBe("为此组织，从下列角色中选择。");
		// 键是整节点精确匹配：多带了后半句的节点不该被部分替换
		expect(
			translateText("You can set the base role", view),
		).toBeNull();
	});

	it("keeps the role rows as single text nodes", () => {
		// 每行说明句在实机里是 `<span>` 里的单个文本节点（服务端渲染，句中没有内联元素）
		expect(
			translateText(
				"Triage permissions plus read, clone and push to repositories.",
				view,
			),
		).toBe("分类权限，外加读取、克隆并推送到仓库。");
		expect(
			translateText(
				"Write permissions plus manage issues, pull requests and some repository settings.",
				view,
			),
		).toBe(
			"写入权限，外加管理议题、拉取请求和部分仓库设置。",
		);
		expect(
			translateText(
				"Read permissions plus manage issues and pull requests.",
				view,
			),
		).toBe("读取权限，外加管理议题和拉取请求。");
	});

	it("keeps the upsell banner heading as a single node", () => {
		// 横幅由 React 渲染，但这一版把整条标题渲染成了一个文本节点
		// （`GitHub Enterprise` 没有独立成带样式节点，故不收 `Create custom roles with` 碎片）
		expect(
			translateText(
				"Create custom roles with GitHub Enterprise",
				view,
			),
		).toBe("使用 GitHub Enterprise 创建自定义角色");
		expect(
			translateText("Create custom roles with", view),
		).toBeNull();
	});
});

describe("组织仓库角色页的拼接结果", () => {
	it("renders the intro sentence from its three nodes", () => {
		// 三个节点：`You can`（尾随空白）+ 链接 + 尾段；首尾空白由 walker 保留
		expect(
			renderNodes([
				"\n            You can\n            ",
				"set the base role",
				"\n            for this organization from one of these roles.\n          ",
			]),
		).toBe(
			"\n            你可以\n            设置基础角色\n            为此组织，从下列角色中选择。\n          ",
		);
	});

	it("renders a role row with its description", () => {
		expect(
			renderNodes([
				"\n          ",
				"Read and clone repositories. Open and comment on issues and pull requests.",
				"\n        ",
			]),
		).toBe(
			"\n          读取并克隆仓库。打开并评论议题和拉取请求。\n        ",
		);
	});

	it("renders the admin row with its trailing link", () => {
		// 说明句带尾随空白，链接是紧随其后的独立节点
		expect(
			renderNodes([
				"Full access to repositories including sensitive and destructive actions. ",
				"Modify Admin Role",
			]),
		).toBe(
			"对仓库的完全访问权限，包括敏感操作和破坏性操作。 修改管理员角色",
		);
	});

	it("renders the upsell banner texts", () => {
		expect(
			renderNodes([
				"Create custom roles with GitHub Enterprise",
				"Enterprise accounts offer organizations more granular control over permissions by allowing you to configure up to 20 custom repository roles. This enables greater control over who and how your users access code and data in your organization.",
				"Start free for 30 days",
				"Learn more",
			]),
		).toBe(
			"使用 GitHub Enterprise 创建自定义角色" +
				"企业账户为组织提供更细粒度的权限控制，支持配置最多 20 个自定义仓库角色，从而更精细地控制组织中的哪些用户可以访问代码和数据，以及以何种方式访问。" +
				"免费试用 30 天" +
				"了解更多",
		);
	});
});
