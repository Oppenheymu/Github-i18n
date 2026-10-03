// 组织设置侧栏（所有 /organizations/<组织>/settings/** 子页共用的外壳）实机文本回归。
//
// 证据：2026-10-03 维护者贴的 `Layout-sidebar` 实机 HTML（装了扩展后复制的，
// 中文节点是扩展产物、英文节点才是待补项）。侧栏页页都在，故单独成文；
// 第一批途径 A 清单里的侧栏项（`Member privileges` / `Audit log` …）留在
// profile.test.ts，本文件只锁这批新补的 25 条。
//
// 这批补的是**分组标题**（`Access` / `Code, planning, and automation` /
// `Security and quality` / `Integrations` / `Archive`）与第一批清单里没有的条目。
// 除 `Pages` 外全部沿用 pages/settings 与 pages/repo-settings 的既有措辞——
// 同一批侧栏项在两个模块里都出现，改词必须一起改（下方用例把措辞钉死）。
//
// 两条例外：
//   1. `Pages` 是**对 global 的定点纠正**：global 把 GitHub Pages 的 `Pages`
//      收成了「页码」，本模块在自己的路由上覆盖为「页面」（与仓库设置、wiki 一致）；
//   2. `Copilot` / `Dependabot` / `OIDC` 是产品名与缩写，**有意不收录**（反例断言钉住）。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../../content/view.ts";
import { translateText } from "../../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../../index.ts";

/** 组织设置路由命中的模块视图（pages/org-settings + global） */
const view = buildView(
	"/organizations/Koishi-CE/settings/policies/repositories",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机侧栏里仍是英文的文本节点（按侧栏自上而下的顺序） */
const SIDEBAR_NODES: readonly string[] = [
	// 顶部的 General 与 Policies（前者是 profile 项，后者是折叠分组）
	"General",
	"Policies",
	// Access 分组：分组标题，以及 Copilot 下的子项同名
	"Access",
	"Moderation",
	"Interaction limits",
	"Code review limits",
	// Code, planning, and automation 分组
	"Code, planning, and automation",
	"Rulesets",
	"Planning",
	"Cloud agent",
	"Internet access",
	"Runner type",
	// Actions 分组
	"Policy insights",
	"Runners",
	// 分组之间
	"Webhooks",
	"Packages",
	// global 把 GitHub Pages 的 Pages 译成了「页码」，这里是定点纠正
	"Pages",
	// Security and quality 分组
	"Security and quality",
	"Advanced Security",
	"Code quality",
	"Deploy keys",
	"Secrets and variables",
	"Agents",
	// Integrations 与 Archive 分组
	"Integrations",
	"Archive",
];

/** 必须保持英文的实机文本：产品名与缩写（有意不收录） */
const MUST_STAY_ENGLISH: readonly string[] = [
	"Copilot",
	"Dependabot",
	"OIDC",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n          ${node}\n        `];
}

describe("组织设置侧栏的实机节点边界", () => {
	it("translates every sidebar text node GitHub actually renders", () => {
		for (const node of SIDEBAR_NODES) {
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

	it("keeps product names and abbreviations as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("reuses the wording of the same sidebar items on other settings pages", () => {
		// 与 pages/settings、pages/repo-settings 的对应用例同值：这里逐条钉死，
		// 改词时三处必须一起改（路由互斥，骨架门禁看不到这种漂移）
		expect(translateText("General", view)).toBe("常规");
		expect(translateText("Policies", view)).toBe("策略");
		expect(translateText("Access", view)).toBe("访问权限");
		expect(translateText("Moderation", view)).toBe("审核");
		expect(translateText("Interaction limits", view)).toBe(
			"互动限制",
		);
		expect(translateText("Code review limits", view)).toBe(
			"代码审查限制",
		);
		expect(
			translateText("Code, planning, and automation", view),
		).toBe("代码、规划与自动化");
		expect(translateText("Rulesets", view)).toBe("规则集");
		expect(translateText("Planning", view)).toBe("规划");
		// Copilot 的产品名保留英文，子项译成中文
		expect(translateText("Cloud agent", view)).toBe(
			"云端代理",
		);
		expect(translateText("Internet access", view)).toBe(
			"网络访问",
		);
		expect(translateText("Runner type", view)).toBe(
			"运行器类型",
		);
		expect(translateText("Policy insights", view)).toBe(
			"策略洞察",
		);
		expect(translateText("Runners", view)).toBe("运行器");
		expect(translateText("Webhooks", view)).toBe(
			"网络钩子",
		);
		expect(translateText("Packages", view)).toBe("软件包");
		expect(
			translateText("Security and quality", view),
		).toBe("安全与质量");
		expect(translateText("Advanced Security", view)).toBe(
			"高级安全",
		);
		expect(translateText("Code quality", view)).toBe(
			"代码质量",
		);
		expect(translateText("Deploy keys", view)).toBe(
			"部署密钥",
		);
		expect(
			translateText("Secrets and variables", view),
		).toBe("机密与变量");
		expect(translateText("Agents", view)).toBe("代理");
		expect(translateText("Integrations", view)).toBe(
			"集成",
		);
		expect(translateText("Archive", view)).toBe("归档");
	});

	it("overrides the global wording of GitHub Pages", () => {
		// global 的 `Pages` 收成了「页码」（正确性存疑，但改动影响全站，需要独立证据），
		// 本模块在自己的路由上覆盖为「页面」——与 pages/repo-settings、pages/wiki 一致
		expect(translateText("Pages", view)).toBe("页面");
	});

	it("translates the section dividers that wrap around the items", () => {
		// 分组标题与条目是兄弟节点（`ActionList-sectionDivider-title` + `ActionListItem-label`），
		// 实机渲染成「访问权限 / 常规 / 策略 / 仓库 …」这样一节一节往下排
		const section = withWhitespace("Access").map((raw) =>
			translateText(raw, view),
		);
		expect(section).toEqual(["访问权限", "访问权限"]);
	});
});
