// 组织 Copilot 云端代理设置页（/organizations/<组织>/settings/copilot/coding_agent）实机回归。
//
// 证据：2026-10-11 维护者贴的整页 HTML，以及同日第二次贴出的顶部介绍片段。页面是 React 应用，
// 路由由组织设置的 `settings` 前缀覆盖；顶部介绍、自动化策略和合作代理说明在**渲染文本**上看着
// 是完整句子，实机却是三个相邻的裸文本节点（`With ` / `Copilot cloud agent` / `, developers can …`，
// 片段之间没有任何元素，粘贴 outerHTML 看不出边界）——照视觉整句登记的整句键永不命中，
// 第二次粘贴时整句里只剩 `Copilot 云端代理` 一处中文（它的节点恰好等于词条键）即为实证，
// 故按碎片收录并删掉旧整句键。同一页的两张代理卡片标题（`Allow Claude coding agent`）
// 是同一类：代理名由 payload 插值成独立的裸文本节点，贴出来只是 `Allow Claude ` 一句话，
// 照视觉登记的 `Allow Claude` / `Allow Codex` 两个整句键同样永不命中，已删、改收 `Allow` 碎片。
// 「部分设置已迁移」里的两句分别被 `Runner type` /
// `Internet access` 链接切开，链接本身已由本模块既有词条翻译。
// Claude / Codex、组织名与 payload 标识符保持英文。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织 Copilot 云端代理设置页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/copilot/coding_agent";
/** 旧前缀（`/orgs/<组织>/...`），路由也应覆盖 */
const LEGACY_PATH =
	"/orgs/Koishi-CE/settings/copilot/coding_agent";

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

/** 实机里仍是英文的静态文本节点（按页面自上而下的顺序） */
const NEW_NODES: readonly (readonly [string, string])[] = [
	["Copilot cloud agent", "Copilot 云端代理"],
	[
		"No Copilot cloud agent access",
		"无 Copilot 云端代理访问权限",
	],
	[
		"You can enable Copilot cloud agent for other users, but you won't be able to assign tasks to Copilot because you don't have a Copilot Pro, Copilot Pro+, Copilot Business or Copilot Enterprise license.",
		"你可以为其他用户启用 Copilot 云端代理，但由于你没有 Copilot Pro、Copilot Pro+、Copilot Business 或 Copilot Enterprise 许可证，因此无法将任务分配给 Copilot。",
	],
	["Buy or request a seat", "购买或申请席位"],
	["With", "借助"],
	[
		", developers can delegate tasks to Copilot, freeing them to focus on the creative, complex, and high-impact work that matters most. Simply assign a task to Copilot, wait for the agent to request review, then leave feedback on the pull request to iterate.",
		"，开发者可以将任务委派给 Copilot，从而专注于最具创造性、复杂且影响重大的工作。只需将任务分配给 Copilot，等待代理请求审查，然后在拉取请求中提供反馈并继续迭代。",
	],
	["Learn more in the docs.", "在文档中了解详情。"],
	["Repository access", "仓库访问权限"],
	[
		"Choose which repositories Copilot cloud agent should be enabled in. To be able to assign an issue to Copilot, the user must have access to Copilot cloud agent and it must be enabled for the repository.",
		"选择要启用 Copilot 云端代理的仓库。用户必须有权使用 Copilot 云端代理，且该代理必须已在仓库中启用，才能将议题分配给 Copilot。",
	],
	["Automations", "自动化"],
	["Allow automations", "允许自动化"],
	[
		"When enabled, users with repository write access can create automations that automatically run agents on a schedule or in response to events like new issues or updated pull requests.",
		"启用后，具有仓库写入权限的用户可以创建自动化任务，按计划自动运行代理，或在出现新议题、拉取请求更新等事件时运行代理。",
	],
	["Let repositories decide", "由各仓库决定"],
	[
		"Only allow automations to be triggered by users with write access",
		"仅允许具有写入权限的用户触发自动化",
	],
	["Recommended", "推荐"],
	[
		"When enabled, automations will only run if the user triggering the event has write access to the repository. When disabled, users can create automations that listen for events triggered by users without write access.",
		"启用后，只有在触发事件的用户拥有仓库写入权限时，自动化才会运行。禁用后，用户可以创建监听由无写入权限用户触发事件的自动化。",
	],
	[
		"Allowing automations to be triggered by users without write access to the repository increases risk of prompt injection attacks, where an untrusted user can cause an agent to take actions in the repository using the agent's permissions.",
		"允许没有仓库写入权限的用户触发自动化会增加提示注入攻击的风险；不受信任的用户可能诱使代理利用其在仓库中的权限执行操作。",
	],
	["Some settings have moved", "部分设置已迁移"],
	[
		"Runner type configuration has moved to its own",
		"运行器类型配置已迁移至独立的",
	],
	[
		"Internet access configuration has moved to its own",
		"网络访问配置已迁移至独立的",
	],
	[" settings page.", "设置页面。"],
	["Partner agents", "合作伙伴代理"],
	[
		"Enabling an agent allows it to be mentioned in issues and pull requests, and assigned to issues and open pull requests. Agents can only be triggered by organization members and repository collaborators, and can only be used in this organization's repositories where the cloud agent feature is enabled.",
		"启用代理后，可在议题和拉取请求中提及该代理，也可将议题和未关闭的拉取请求分配给它。只有组织成员和仓库协作者可以触发代理；且只能在已启用云端代理功能的组织仓库中使用。",
	],
	["Allow", "允许"],
	["coding agent", "编程代理"],
	[
		"Learn more about Claude on GitHub",
		"在 GitHub 上详细了解 Claude",
	],
	[
		"Learn more about Codex on GitHub",
		"在 GitHub 上详细了解 Codex",
	],
];

/** 组织名、代理名与 payload 标识符必须保持原文 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"Koishi-CE",
	"Claude",
	"Codex",
	"GitHub",
	"Copilot",
	"anthropic-code-agent",
	"openai-code-agent",
	"all_repos",
	"trigger_actor_policy_changed_callback_path",
];

/**
 * 按 walker 语义翻译节点，并保留原文首尾空白，再拼成页面上的实际文本。
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

describe("组织 Copilot 云端代理设置页的模块路由", () => {
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

describe("组织 Copilot 云端代理设置页的实机节点", () => {
	it("translates every static English node", () => {
		for (const [raw, expected] of NEW_NODES) {
			const translated = translateText(raw, view);
			expect(
				translated,
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
			expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
		}
	});

	it("keeps organization data and product names in English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders the moved settings sentences across their links", () => {
		expect(
			renderNodes([
				"Runner type configuration has moved to its own ",
				"Runner type",
				" settings page.",
			]),
		).toBe(
			"运行器类型配置已迁移至独立的 运行器类型 设置页面。",
		);
		expect(
			renderNodes([
				"Internet access configuration has moved to its own ",
				"Internet access",
				" settings page.",
			]),
		).toBe(
			"网络访问配置已迁移至独立的 网络访问 设置页面。",
		);
	});

	it("renders each partner agent heading with its product name", () => {
		// 标题是 `Allow ` + 代理名 + `coding agent`：代理名由 payload 插值成
		// 独立的裸文本节点（保持英文），空格跟在哪一边都不影响拼接结果。
		expect(
			renderNodes([
				"Allow ",
				"Claude",
				" ",
				"coding agent",
			]),
		).toBe("允许 Claude 编程代理");
		expect(
			renderNodes(["Allow ", "Codex", " ", "coding agent"]),
		).toBe("允许 Codex 编程代理");
	});

	it("does not translate the partner agent headings as one node", () => {
		// 反向钉住：`Allow Claude` / `Allow Codex` 两个整句键已从 canonical 删除
		// （实机里代理名自成一个节点，整句键永不命中）。上游若改成整节点，这条会变红。
		for (const raw of ["Allow Claude", "Allow Codex"]) {
			expect(
				translateText(raw, view),
				`不应命中：${raw}`,
			).toBeNull();
		}
	});

	it("renders the intro sentence across its three bare text nodes", () => {
		// 三个片段之间没有元素，末尾那个片段带尾随空格（文档链接紧随其后）。
		expect(
			renderNodes([
				"With ",
				"Copilot cloud agent",
				", developers can delegate tasks to Copilot, freeing them to focus on the creative, complex, and high-impact work that matters most. Simply assign a task to Copilot, wait for the agent to request review, then leave feedback on the pull request to iterate. ",
				"Learn more in the docs.",
			]),
		).toBe(
			"借助 Copilot 云端代理，开发者可以将任务委派给 Copilot，从而专注于最具创造性、复杂且影响重大的工作。只需将任务分配给 Copilot，等待代理请求审查，然后在拉取请求中提供反馈并继续迭代。 在文档中了解详情。",
		);
	});

	it("does not translate the intro as one whole node", () => {
		// 反向钉住：整句键已从 canonical 删除（它在实机永不命中）。
		// 万一上游把三个碎片合回一个节点，这条会变红，提示重采。
		expect(
			translateText(
				"With Copilot cloud agent, developers can delegate tasks to Copilot, freeing them to focus on the creative, complex, and high-impact work that matters most. Simply assign a task to Copilot, wait for the agent to request review, then leave feedback on the pull request to iterate.",
				view,
			),
		).toBeNull();
	});
});
