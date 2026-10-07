// 组织角色分配页（/organizations/<组织>/settings/org_role_assignments 与其 new 子页）实机文本回归。
//
// 证据与强度：2026-10-07 维护者贴出的**两段实机 HTML**（列表页整页 + 新建页整页；采集时扩展
// 仍在运行，故已是中文的节点是扩展产物、仍是英文的才是待补清单）。列表页渲染成中文的只有
// `Role assignments`（本模块的键）与 `Organization`（本模块的键，正好暴露了节点切分，见下），
// 新建页只有面包屑、九张角色卡的标题与说明句、`Cancel`——其余全部保留英文，即本批补的清单。
//
// 本文件锁六件事：
//   ① 两条路径都只命中 `pages/org-settings` + `global`，**不命中** `pages/settings` /
//      `pages/settings-billing` / `pages/repo-settings`（后者路由显式排除了 organizations）；
//   ② 18 条新键全部按实机节点原文命中（含 `9 roles` 那条走规则的动态计数）；
//   ③ 四条节点边界事实：空态说明句是**两个文本节点**、新建页说明段是**三个文本节点**、
//      tooltip 是独立文本节点、角色条数是动态值；
//   ④ 九条 tooltip 的译文逐字正确（角色名内嵌其中）；
//   ⑤ 两条 enterprise 专属角色与半角句号节点有意保留英文；
//   ⑥ 与页面同形的拼接结果（空态说明句、说明段、计数行）逐字正确。
//
// 三条必须记住的边界事实：
//   1. 空态说明句 `Organization roles have not been assigned to any users or teams.` 在实机里
//      是**两个相邻文本节点**（`Organization` + 其余整段），故本模块收的是一条以 `roles`
//      开头的**残句**；整句作为一个节点反而永不命中（用例把这个反例也钉住了）；
//   2. 两节点之间的前导空格由 walker 保留（applyTextNode 的 lead / trail），所以实机拼出来
//      是「组织 角色尚未指派给任何用户或团队。」——中间那一个空格是既成事实，与 policies 页
//      的「组织规则集将不会强制执行 直到…」同源，改词条解决不了，别当 bug 反复查；
//   3. 说明段末尾的句号是**独立节点**（`.` 不含拉丁字母，可翻译判定直接跳过），故中文译文
//      后面仍跟着半角 `.`；同理，正文节点自带尾随空格——两者都不是漏翻。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 角色分配列表页（空态） */
const LIST_PATH =
	"/organizations/Koishi-CE/settings/org_role_assignments";
/** 同一支路由下的新建页 */
const NEW_PATH = `${LIST_PATH}/new`;
/** 旧前缀（`/orgs/<组织>/...`），路由里也覆盖着 */
const LEGACY_PATH =
	"/orgs/Koishi-CE/settings/org_role_assignments/new";

const locale = dictForLocale("zh-CN");

/** 列表页命中的模块视图（pages/org-settings + global） */
const view = buildView(
	LIST_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

/** 新建页视图：命中模块与列表页相同，单独建一份以证明两条路径同源 */
const newView = buildView(
	NEW_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

function moduleNames(path: string): readonly string[] {
	return matchModules(path, locale.modules).map(
		(module) => module.name,
	);
}

/** 本轮新补的文本节点（逐条誊录实机 HTML，顺序即页面顺序） */
const NEW_NODES: readonly string[] = [
	// —— 列表页（空态）——
	"Assign teams or people an organization role",
	"No organization roles assigned",
	// 残句键：整句的其余部分（前半句 `Organization` 由既有键单独命中）
	"roles have not been assigned to any users or teams.",
	// 空态主按钮（新建页的提交按钮与面包屑是同一串文案）
	"Assign role",
	// —— 新建页：页首说明段的两个可翻译节点（第三个是半角句号，翻不了）——
	"Organization roles are used to grant access to subsets of organization settings to teams and members.",
	"Learn more about organization roles",
	// —— 新建页：表单标签、选择器与单选组 ——
	"Assign role to",
	"Select user or team",
	"Select role",
	// —— 新建页：九张角色卡的 tooltip ——
	"Info about All-repository read",
	"Info about All-repository write",
	"Info about All-repository triage",
	"Info about All-repository maintain",
	"Info about All-repository admin",
	"Info about Apps manager",
	"Info about CI/CD Admin",
	"Info about Security manager",
	"Info about Open-source license manager",
];

/** 九条 tooltip 的逐字译文（角色名内嵌，不保留英文） */
const ROLE_TOOLTIPS: readonly (readonly [
	string,
	string,
])[] = [
	[
		"Info about All-repository read",
		"关于「所有仓库读取」的信息",
	],
	[
		"Info about All-repository write",
		"关于「所有仓库写入」的信息",
	],
	[
		"Info about All-repository triage",
		"关于「所有仓库分类」的信息",
	],
	[
		"Info about All-repository maintain",
		"关于「所有仓库维护」的信息",
	],
	[
		"Info about All-repository admin",
		"关于「所有仓库管理员」的信息",
	],
	["Info about Apps manager", "关于「应用管理员」的信息"],
	["Info about CI/CD Admin", "关于「CI/CD 管理员」的信息"],
	[
		"Info about Security manager",
		"关于「安全管理员」的信息",
	],
	[
		"Info about Open-source license manager",
		"关于「开源许可管理员」的信息",
	],
];

/** 本页渲染时已由既有键覆盖的节点（新增本批之前就是中文） */
const ALREADY_COVERED: readonly (readonly [
	string,
	string,
])[] = [
	["Role assignments", "角色分配"],
	["Organization", "组织"],
	// 九张角色卡的标题与说明句：上一批（org-roles.test.ts）已收，本页同键同译
	["All-repository read", "所有仓库读取"],
	["CI/CD Admin", "CI/CD 管理员"],
	["Open-source license manager", "开源许可管理员"],
	[
		"Grants read access to all repositories in the organization.",
		"授予对组织中所有仓库的读取访问权限。",
	],
	["Cancel", "取消"],
];

/** 必须保持英文：没有实机证据的 enterprise 角色、纯符号节点与用户内容 */
const MUST_STAY_ENGLISH: readonly string[] = [
	// 两条 enterprise 专属角色本页没有渲染，角色名本身也未收录
	"Enterprise Security Manager",
	"Enterprise Open-Source License Manager",
	"Info about Enterprise Security Manager",
	// 独立句号节点：不含拉丁字母，可翻译判定直接跳过（引擎侧结构上翻不了）
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

describe("组织角色分配页的模块路由", () => {
	it("loads the org-settings shell with the global fallback", () => {
		for (const path of [LIST_PATH, NEW_PATH]) {
			const names = moduleNames(path);
			expect(names).toContain("pages/org-settings");
			expect(names).toContain("global");
		}
	});

	it("does not match the personal or per-repository settings modules", () => {
		for (const path of [LIST_PATH, NEW_PATH]) {
			const names = moduleNames(path);
			expect(names).not.toContain("pages/settings");
			expect(names).not.toContain("pages/settings-billing");
			expect(names).not.toContain("pages/repo-settings");
		}
	});

	it("covers the legacy orgs prefix as well", () => {
		expect(moduleNames(LEGACY_PATH)).toContain(
			"pages/org-settings",
		);
	});
});

describe("组织角色分配页的实机节点边界", () => {
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

	it("translates the new nodes on the new-page view too", () => {
		// 两条路径命中的模块相同，故同一批节点在新页视图里也必须全部命中
		for (const node of NEW_NODES) {
			expect(
				translateText(node, newView),
				`未命中：${JSON.stringify(node)}`,
			).not.toBeNull();
		}
	});

	it("translates the nine role tooltips verbatim", () => {
		for (const [raw, expected] of ROLE_TOOLTIPS) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("keeps the nodes that were already covered before this batch", () => {
		for (const [raw, expected] of ALREADY_COVERED) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("keeps the enterprise roles, the period node and the org name as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});

describe("组织角色分配页的动态计数规则", () => {
	it("translates the role count rule with any number", () => {
		// 实机是 `<span>9 roles</span>`：条数取决于组织有没有 enterprise 专属角色
		// （9 / 11 …），故走 org-settings/roles-count 而不是静态键
		expect(translateText("9 roles", view)).toBe("9 个角色");
		expect(translateText("11 roles", view)).toBe(
			"11 个角色",
		);
		expect(translateText("1 role", view)).toBe("1 个角色");
		// pattern 以 ^…$ 锚定：没有数字的节点不会被部分替换成残句
		expect(translateText("roles", view)).toBeNull();
		expect(translateText("Select role", view)).toBe(
			"选择角色",
		);
	});
});

describe("组织角色分配页的节点切分事实", () => {
	it("requires the blank-slate sentence to be split in two nodes", () => {
		// 实机是 `Organization` + ` roles have not been assigned to any users or teams.`
		// 两个相邻文本节点；整句作为一个节点时**两边的键都不该存在**
		expect(
			translateText(
				"Organization roles have not been assigned to any users or teams.",
				view,
			),
		).toBeNull();
		expect(translateText("Organization", view)).toBe(
			"组织",
		);
		expect(
			translateText(
				"roles have not been assigned to any users or teams.",
				view,
			),
		).toBe("角色尚未指派给任何用户或团队。");
	});

	it("keeps the trailing period of the intro as its own node", () => {
		// 说明段是三个节点：正文整句（带尾随空格）+ 链接文本 + 独立句号
		const body =
			"Organization roles are used to grant access to subsets of organization settings to teams and members.";
		expect(translateText(body, view)).toBe(
			"组织角色用于向团队和成员授予部分组织设置的访问权限。",
		);
		expect(
			translateText(`${body} Learn more`, view),
		).toBeNull();
		expect(translateText(".", view)).toBeNull();
	});

	it("keeps the nine role names themselves covered by the previous batch", () => {
		// tooltip 里的角色名与角色卡标题是同一串上游文案，译文必须逐字一致
		expect(translateText("All-repository read", view)).toBe(
			"所有仓库读取",
		);
		expect(
			translateText("Info about All-repository read", view),
		).toBe("关于「所有仓库读取」的信息");
	});
});

describe("组织角色分配页的拼接结果", () => {
	it("renders the blank-slate sentence with the split-node gap", () => {
		// 两个节点之间的前导空格由 walker 保留 ⇒ 中文里留下一个空格（既成事实）
		expect(
			renderNodes([
				"Organization",
				" roles have not been assigned to any users or teams.",
			]),
		).toBe("组织 角色尚未指派给任何用户或团队。");
	});

	it("renders the intro paragraph with its trailing space and period", () => {
		expect(
			renderNodes([
				"Organization roles are used to grant access to subsets of organization settings to teams and members. ",
				"Learn more about organization roles",
				".",
			]),
		).toBe(
			"组织角色用于向团队和成员授予部分组织设置的访问权限。 进一步了解组织角色.",
		);
	});

	it("renders a role radio row with its tooltip", () => {
		expect(
			renderNodes([
				"\n            ",
				"All-repository triage",
				"\n            ",
				"Grants triage access to all repositories in the organization.",
				"\n            ",
				"Info about All-repository triage",
				"\n          ",
			]),
		).toBe(
			"\n            所有仓库分类\n            授予对组织中所有仓库的分类访问权限。\n            关于「所有仓库分类」的信息\n          ",
		);
	});

	it("renders the role count row", () => {
		expect(renderNodes(["9 roles"])).toBe("9 个角色");
	});
});
