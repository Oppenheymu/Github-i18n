// 组织部署密钥策略页（/organizations/<组织>/settings/deploy_keys）实机回归。
//
// 证据：2026-10-12 维护者贴出的页面 HTML。说明段被两个链接切分；禁用提示被组织名
// 加粗节点切开。标题、按钮和仓库计数已经是中文，动态组织名属于用户数据，不登记。
import {
	afterAll,
	beforeAll,
	describe,
	expect,
	it,
} from "bun:test";
import {
	buildView,
	matchModules,
} from "../../../../content/view.ts";
import {
	translateText,
	translateTree,
} from "../../../../content/walker.ts";
import {
	type DomEnvironment,
	installDom,
} from "../../../../test-support/dom.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

const PAGE_PATH =
	"/organizations/Koishi-CE/settings/deploy_keys";
const locale = dictForLocale("zh-CN");
const view = buildView(
	PAGE_PATH,
	locale,
	new Map(Object.entries(dictCore.aliases)),
);

let dom: DomEnvironment;

beforeAll(() => {
	dom = installDom();
});

afterAll(() => {
	dom.restore();
});

const NEW_NODES: readonly (readonly [string, string])[] = [
	[
		"Deploy keys use an SSH key to grant readonly or write access to a single repository. If you have a more complex project or want more fine-grain control over permissions, consider using a GitHub App instead. For more information, see",
		"部署密钥使用 SSH 密钥，为单个仓库授予只读或写入权限。如果项目更复杂，或需要更精细地控制权限，可以考虑改用 GitHub App。有关详情，请参阅",
	],
	["the GitHub Apps documentation", "GitHub Apps 文档"],
	[
		". Please note that deploy keys are not protected by a passphrase and can be a security risk if your server is compromised. For more information on deploy keys, see",
		"。请注意，部署密钥没有密码短语保护；如果服务器遭到入侵，可能会带来安全风险。有关部署密钥的详情，请参阅",
	],
	["managing deploy keys", "管理部署密钥"],
	[
		"Deploy keys are not allowed to be created and used within this organization. Cloning public repositories will be unaffected by this policy.",
		"此组织不允许创建和使用部署密钥。此策略不会影响克隆公开仓库。",
	],
	[
		"Deploy keys are allowed to be created and used within this organization.",
		"允许在此组织中创建和使用部署密钥。",
	],
	[
		"use deploy keys. Disabling deploy keys may break existing workflows.",
		"使用部署密钥。禁用部署密钥可能会导致现有工作流无法正常运行。",
	],
	[
		"Are you sure you want to disable deploy keys?",
		"确定要禁用部署密钥吗？",
	],
	["Existing deploy keys in", "现有部署密钥（"],
	["will disabled.", "）将被禁用。"],
];

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

describe("组织部署密钥策略页的路由", () => {
	it("loads org-settings and the global fallback", () => {
		const names = matchModules(
			PAGE_PATH,
			locale.modules,
		).map((module) => module.name);
		expect(names).toContain("pages/org-settings");
		expect(names).toContain("global");
		expect(names).not.toContain("pages/repo-settings");
		expect(names).not.toContain("pages/settings");
	});
});

describe("组织部署密钥策略页的实机节点", () => {
	it("translates every captured English node", () => {
		for (const [raw, expected] of NEW_NODES) {
			const translated = translateText(raw, view);
			expect(
				translated,
				`未命中：${JSON.stringify(raw)}`,
			).toBe(expected);
			expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
		}
	});

	it("preserves both link boundaries in the description", () => {
		const root = dom.document.createElement("div");
		root.innerHTML =
			"<p>Deploy keys use an SSH key to grant readonly or write access to a single repository. If you have a more complex project or want more fine-grain control over permissions, consider using a GitHub App instead. For more information, see <a>the GitHub Apps documentation</a>. Please note that deploy keys are not protected by a passphrase and can be a security risk if your server is compromised. For more information on deploy keys, see <a>managing deploy keys</a>.</p>";
		dom.document.body.append(root);

		const paragraph = root.querySelector("p");
		expect(paragraph?.childNodes).toHaveLength(5);
		expect(translateTree(root, view)).toBe(4);
		expect(paragraph?.textContent).toBe(
			"部署密钥使用 SSH 密钥，为单个仓库授予只读或写入权限。如果项目更复杂，或需要更精细地控制权限，可以考虑改用 GitHub App。有关详情，请参阅 GitHub Apps 文档。请注意，部署密钥没有密码短语保护；如果服务器遭到入侵，可能会带来安全风险。有关部署密钥的详情，请参阅 管理部署密钥.",
		);
	});

	it("keeps the dynamic organization name between the confirmation fragments", () => {
		expect(
			renderNodes([
				"Existing deploy keys in ",
				"Koishi-CE",
				" will disabled.",
			]),
		).toBe("现有部署密钥（ Koishi-CE ）将被禁用。");
		expect(translateText("Koishi-CE", view)).toBeNull();
		expect(translateText("0 个仓库", view)).toBeNull();
	});
});
