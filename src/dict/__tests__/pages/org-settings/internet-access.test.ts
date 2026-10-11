// 组织 Copilot 网络访问设置页（/organizations/<组织>/settings/copilot/internet_access）实机回归。
//
// 证据：2026-10-11 维护者贴的整页 HTML（`<react-app app-name="copilot-internet-access-settings">`）。
// Cloud agent 与 code review 两个区块使用相同的防火墙 / 允许列表字段。页面上已有的
// `网络访问`、`Copilot 云端代理`、`Copilot 代码审查`、`推荐`、`由各仓库决定` 与 `启用`
// 是既有词条生效的对照；本批收录其余英文节点及推荐允许列表的 aria-label。
import { describe, expect, it } from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织 Copilot 网络访问设置页 */
const PAGE_PATH =
	"/organizations/Koishi-CE/settings/copilot/internet_access";
/** 旧前缀（`/orgs/<组织>/...`），路由也应覆盖 */
const LEGACY_PATH =
	"/orgs/Koishi-CE/settings/copilot/internet_access";

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

/** 页面上仍为英文的文本节点，按 cloud agent 区块到 code review 区块的顺序 */
const NEW_NODES: readonly (readonly [string, string])[] = [
	[
		"Configure firewall rules for Copilot cloud agent across all repositories in this organization.",
		"为此组织中的所有仓库配置 Copilot 云端代理的防火墙规则。",
	],
	[
		"Learn more about customizing network access.",
		"进一步了解自定义网络访问。",
	],
	["Enable firewall", "启用防火墙"],
	[
		"Limit Copilot cloud agent's Internet access to only allow access to allowlisted locations.",
		"将 Copilot 云端代理的网络访问限制为仅允许访问允许列表中的位置。",
	],
	["Recommended allowlist", "推荐的允许列表"],
	[
		"Allow access to locations frequently used to install tools, packages, and dependencies.",
		"允许访问安装工具、软件包和依赖时常用的位置。",
	],
	[
		"Allow repository custom rules",
		"允许仓库使用自定义规则",
	],
	[
		"Allow repository administrators to add their own custom allowlist rules in addition to the organization allowlist.",
		"允许仓库管理员在组织允许列表之外添加自定义允许列表规则。",
	],
	["Organization custom allowlist", "组织自定义允许列表"],
	[
		"Allow access to specific domains, IP addresses, or URLs for all repositories in this organization.",
		"允许此组织中的所有仓库访问特定域名、IP 地址或 URL。",
	],
	[
		"Configure firewall rules for Copilot code review across all repositories in this organization.",
		"为此组织中的所有仓库配置 Copilot 代码审查的防火墙规则。",
	],
	[
		"Limit Copilot code review's Internet access to only allow access to allowlisted locations.",
		"将 Copilot 代码审查的网络访问限制为仅允许访问允许列表中的位置。",
	],
];

/** 只出现在 aria-label 上的文案（属性同样按精确键匹配） */
const ATTR_NODES: readonly (readonly [string, string])[] = [
	[
		"Learn more about the recommended allowlist",
		"进一步了解推荐的允许列表",
	],
];

/** 组织名、payload 字段与产品名必须保持原文 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"Koishi-CE",
	"copilot-internet-access-settings",
	"firewallConfiguration",
	"useDefaultRules",
	"allowCustomRules",
	"allowlistUrl",
	"cloud_agent",
	"Copilot",
	"GitHub",
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

describe("组织 Copilot 网络访问设置页的模块路由", () => {
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

describe("组织 Copilot 网络访问设置页的实机节点", () => {
	it("translates every static English node in both sections", () => {
		for (const [raw, expected] of NEW_NODES) {
			const translated = translateText(raw, view);
			expect(
				translated,
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
			expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
		}
	});

	it("translates the recommended allowlist accessible name", () => {
		for (const [raw, expected] of ATTR_NODES) {
			expect(translateText(raw, view)).toBe(expected);
		}
	});

	it("keeps organization data, payload fields and product names in English", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders each introduction before its existing documentation link", () => {
		const link =
			"Learn more about customizing network access.";
		const expectedLink = "进一步了解自定义网络访问。";
		expect(
			renderNodes([
				"Configure firewall rules for Copilot cloud agent across all repositories in this organization. ",
				link,
			]),
		).toBe(
			"为此组织中的所有仓库配置 Copilot 云端代理的防火墙规则。 " +
				expectedLink,
		);
		expect(
			renderNodes([
				"Configure firewall rules for Copilot code review across all repositories in this organization. ",
				link,
			]),
		).toBe(
			"为此组织中的所有仓库配置 Copilot 代码审查的防火墙规则。 " +
				expectedLink,
		);
	});
});
