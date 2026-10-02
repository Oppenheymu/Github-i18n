// 已验证域名页（/settings/pages）与 Copilot 云端代理页（/settings/copilot/coding_agent）
// 的实机文本与属性回归。两页都很小，合并在一个文件里，路径各自独立成视图。
//
// 边界强度：**途径 A 实证**（2026-09-27 维护者从 popup 开发者模式导出的漏翻清单，
// schema github-zh-misses/1，两份导出的 `path` 分别全为 /settings/pages 与
// /settings/copilot/coding_agent），含源码换行的长条目按 normalizeKey 折叠空白后的形态写。
//
// 两页的边界事实：
//   1. /settings/copilot/coding_agent 的说明段是**含源码换行的单个节点**；
//      「Repository access」在 pages/repo-settings 另有同键（仓库侧设置），两条路由互斥，
//      本模块各收一份；
//   2. /settings/pages 只有四条键：区块标题、空状态、说明句、按钮；
//   3. 不收录 `Copilot` / `GitHub`（title）等纯专名与用户名、头像 alt 等用户内容。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 按路径取该页的合并视图（pages/settings + global） */
function viewFor(pathname: string) {
	return buildView(
		pathname,
		dictForLocale("zh-CN"),
		new Map(Object.entries(dictCore.aliases)),
	);
}

const pagesView = viewFor("/settings/pages");
const agentView = viewFor("/settings/copilot/coding_agent");

/** /settings/pages 的实机文本节点 */
const PAGES_NODES: readonly string[] = [
	"Verified domains",
	"There are no verified domains.",
	"Verify domains to restrict who can publish GitHub Pages on them.",
	"Add a domain",
];

/** /settings/copilot/coding_agent 的实机文本节点 */
const AGENT_NODES: readonly string[] = [
	"Repository access",
	"With Copilot cloud agent, you can delegate tasks to Copilot, freeing you to focus\n    on the creative, complex, and high-impact work that matters most. Simply assign an issue to Copilot, wait\n    for the agent to request your review, then leave feedback on the pull request to iterate.",
	"Choose which repositories Copilot cloud agent should be enabled in. Copilot cloud agent will only be available where it is enabled for the repository and in the Copilot license policies.",
	"You can enable Copilot cloud agent for other users, but you won't be able to assign tasks to Copilot because you don't have a Copilot Pro, Copilot Pro+, Copilot Business or Copilot Enterprise license.",
	"Learn more in the docs.",
];

/** 必须保持英文的实机节点：纯专名与用户内容 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"Copilot",
	"GitHub",
	"GitHub Pages",
	"M. Oppenheymu",
	"(Oppenheymu)",
	"@Oppenheymu",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

describe("已验证域名页（/settings/pages）的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of PAGES_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(
					variant,
					pagesView,
				);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("keeps brand names as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, pagesView),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders the verified-domains block", () => {
		expect(
			translateText("Verified domains", pagesView),
		).toBe("已验证的域名");
		expect(
			translateText(
				"There are no verified domains.",
				pagesView,
			),
		).toBe("没有已验证的域名。");
		expect(
			translateText(
				"Verify domains to restrict who can publish GitHub Pages on them.",
				pagesView,
			),
		).toBe(
			"验证域名，以限制谁可以在这些域名上发布 GitHub Pages。",
		);
		expect(translateText("Add a domain", pagesView)).toBe(
			"添加域名",
		);
	});
});

describe("Copilot 云端代理页（/settings/copilot/coding_agent）的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of AGENT_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(
					variant,
					agentView,
				);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("renders the repository-access block", () => {
		expect(
			translateText("Repository access", agentView),
		).toBe("仓库访问权限");
		// 含源码换行的单个节点，折叠空白后命中
		expect(
			translateText(
				"With Copilot cloud agent, you can delegate tasks to Copilot, freeing you to focus\n    on the creative, complex, and high-impact work that matters most. Simply assign an issue to Copilot, wait\n    for the agent to request your review, then leave feedback on the pull request to iterate.",
				agentView,
			),
		).toBe(
			"借助 Copilot 云端代理，你可以把任务委派给 Copilot，从而腾出精力专注于最有价值的创造性、复杂且高影响的工作。只需把一个议题分配给 Copilot，等代理请求你审查，然后在拉取请求上留下反馈以迭代即可。",
		);
		expect(
			translateText(
				"Choose which repositories Copilot cloud agent should be enabled in. Copilot cloud agent will only be available where it is enabled for the repository and in the Copilot license policies.",
				agentView,
			),
		).toBe(
			"选择要在哪些仓库中启用 Copilot 云端代理。只有当仓库与 Copilot 许可证策略中都启用了它时，Copilot 云端代理才可用。",
		);
	});

	it("renders the license notice and the docs link", () => {
		expect(
			translateText(
				"You can enable Copilot cloud agent for other users, but you won't be able to assign tasks to Copilot because you don't have a Copilot Pro, Copilot Pro+, Copilot Business or Copilot Enterprise license.",
				agentView,
			),
		).toBe(
			"你可以为其他用户启用 Copilot 云端代理，但由于你没有 Copilot Pro、Copilot Pro+、Copilot Business 或 Copilot Enterprise 许可证，无法向 Copilot 分配任务。",
		);
		expect(
			translateText("Learn more in the docs.", agentView),
		).toBe("详见文档。");
	});
});
