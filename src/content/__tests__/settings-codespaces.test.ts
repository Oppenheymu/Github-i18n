// 代码空间个人设置页（/settings/codespaces）实机文本与属性回归。
//
// 边界强度：**途径 A 实证**（2026-09-27 维护者从 popup 开发者模式导出的漏翻清单，
// schema github-zh-misses/1，`path` 全为 /settings/codespaces），没有途径 B
// （Console 逐节点采集）的证据，故按「导出条目本身就是一个文本节点」登记；
// 含源码换行的长条目按**原样**录入（引擎先 normalizeKey 折叠空白），以锁住归一化这一环。
//
// 本页最关键的边界事实（都在下方断言里锁住）：
//   1. 编辑器偏好里「本地桌面客户端」那一项的三段拼接：
//      `… Requires` + <a>Visual Studio Code</a> + `with the` + <a>GitHub Codespaces</a> + `extension.`
//      ——产品名两段保留英文，所以中文读作「需要 Visual Studio Code 并安装 GitHub 代码空间 扩展。」；
//   2. 超时与保留期两段说明都以「The maximum value is」收尾，**数字是独立节点**
//      （纯数字节点过不了可翻译判定，引擎原样保留），后面再接 `minutes (4 hours).` / `days.`；
//      数字输入框右侧的 `minutes` / `days` 又是另外两个单位标签节点；
//   3. 仓库选择器的计数是动态值（`Selected 0 repositories.`），走
//      `settings/selected-repositories-count` 规则；
//   4. 长说明段（主机映像、访问与安全、GPG 验证、设置同步）在实机里都是**含源码换行的
//      单个节点**，折叠空白后才等于词典键。
//
// 刻意**不收录**（下方反例断言）：产品名 `Copilot` / `GitHub` / `Visual Studio Code` /
// `Visual Studio Code for the Web` / `JupyterLab`（编辑器与产品名保留原文），以及用户名与
// 头像 alt 等用户内容。`GitHub Codespaces` 是例外——「代码空间」在本仓已有既定译法，
// 且它在这里还充当说明句里的链接文本。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { buildView } from "../view.ts";
import { translateText } from "../walker.ts";

/** /settings/codespaces 命中的模块视图（pages/settings + global） */
const view = buildView(
	"/settings/codespaces",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 实机文本节点（原文逐字录入，含实机存在的内部换行与缩进） */
const CODESPACES_NODES: readonly string[] = [
	"GitHub Codespaces",
	// —— 编辑器偏好 ——
	"Editor preference",
	"Connect to the cloud from your local desktop client. Requires",
	"with the",
	"extension.",
	"Edit and preview changes straight from the browser.",
	"Edit and run notebooks from the browser with JupyterLab.",
	"Deprecated",
	// —— 主机映像版本偏好 ——
	"Host image version preference",
	"Stable",
	"Always use the latest stable configuration.",
	"Beta",
	"Use a beta image configuration when available. Otherwise, use the latest stable configuration.",
	"The host image defines the operating system in which development containers run. These images receive periodic upgrades for security, functionality, and performance.\n    GitHub Codespaces offers early access to beta images to ensure compatibility with existing development container configurations.\n    Any codespace created or resumed after changing this setting will use the specified image configuration.",
	"Learn more about host images",
	// —— 默认空闲超时 ——
	"Default idle timeout",
	"A codespace will suspend after a period of inactivity. You can specify a default idle timeout value, which will apply to all codespaces created after the default is changed. You will be charged for the entire time your codespace is running, even if it is idle. The maximum value is",
	"minutes (4 hours).",
	"minutes",
	"Timeout must be 5 minutes or more.",
	"Timeout must be 240 minutes or less.",
	// —— 默认保留期 ——
	"Default retention period",
	"Inactive codespaces are automatically deleted 30 days after the last time they were stopped. A shorter retention period can be set, and will apply to all codespaces created going forward. The default and maximum value is",
	"days.",
	"days",
	"Retention period must be between 0 and 30 days.",
	"Retention period must be 30 days or less.",
	"Learn about retention setting",
	// —— 区域 ——
	"Region",
	"Choose your default region",
	"Your default region will be used to designate compute resources to your codespaces. GitHub can set your region automatically based on your location, or you can set it yourself. Codespaces are deployed to a subset of Azure regions.",
	"Set automatically",
	"Set manually",
	"We will determine the closest available region based on your location (IP address) at codespace creation time.",
	"Australia",
	"Europe West",
	"Southeast Asia",
	"US East",
	"US West",
	// —— 访问与安全 ——
	"Access and security",
	"Codespaces you create for your personal account can either be restricted to accessing the repository it was opened for,\n    or granted read access to other repositories you own.",
	"Limit access of personal Codespaces to the repository they were opened for",
	"All Codespaces can access other repositories I own",
	"Personal Codespaces created for specific repositories can access other repositories I own",
	// —— GPG 验证与设置同步 ——
	"GPG verification",
	"Codespaces can have GPG commit signing capabilities so that GitHub can verify that commits made in the codespace come from a trusted source.\n    When enabled, this setting will be applied to your list of trusted repositories.",
	"GPG signing will be available in Codespaces",
	"GPG signing and VS Code Settings Sync will be available for codespaces for all repositories",
	"GPG signing and VS Code Settings Sync will be available for codespaces from the selected repositories",
	"Settings Sync",
	"By enabling, your codespaces will be able to pull from VS Code Settings Sync service and push only for the trusted repositories you specify.\n    Only enable this for repositories that you trust.",
	"VS Code Settings Sync will be available in Codespaces",
	// —— 受信任的仓库（仓库选择器）——
	"Trusted repositories",
	"The following repositories will be referenced by GPG verification and Settings Sync.",
	"GPG and VS Code Settings Sync will be available for Codespaces from these repositories.",
	"Select repository",
	"Selected repositories",
	"No matching repositories.",
	// 计数行动态变化，走规则
	"Selected 0 repositories.",
	// —— 删除提醒 ——
	"Warning notifications for codespace deletions will be enabled",
	"When enabled, you will receive emails when your codespaces are nearing deletion due to inactivity.",
	// —— Dotfiles ——
	"Dotfiles",
	"Automatically install dotfiles",
	"Codespaces can automatically install your dotfiles into every codespace you create.",
	"Learn how to set up your dotfiles for Codespaces.",
	// —— 机密 ——
	"Secrets",
	"Codespace user secrets",
	"New secret",
	"Submit",
	"Development environment secrets are environment variables that are encrypted. They are available to any codespace you create using repositories with access to that secret.",
	"There are no Codespace secrets.",
];

/**
 * 必须保持英文的实机节点：产品名 / 编辑器名与用户内容。
 * 它们都含拉丁字母、会通过「可翻译判定」，但收录即错（译文必须含中文字系，
 * 硬收产品名只会让门禁报「译文与键同形」）。
 */
const MUST_STAY_ENGLISH: readonly string[] = [
	"Copilot",
	"GitHub",
	"Visual Studio Code",
	"Visual Studio Code for the Web",
	"JupyterLab",
	"M. Oppenheymu",
	"(Oppenheymu)",
	"@Oppenheymu",
];

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/**
 * 把一段实机节点序列按 walker 的语义过一遍：未命中的节点按原样保留，
 * 命中的节点写回译文并保留其首尾空白，最后拼接成页面上真实看到的那一行。
 */
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

describe("代码空间设置页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of CODESPACES_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(variant, view);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				// 译文必须是中文（防「收录了键但值还是英文」这类静默失效）
				expect(translated ?? "").toMatch(/[\u4e00-\u9fff]/);
			}
		}
	});

	it("keeps product names and user content as-is", () => {
		for (const raw of MUST_STAY_ENGLISH) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("renders the desktop-client option across its five nodes", () => {
		// 实机：`… Requires <a>Visual Studio Code</a> with the <a>GitHub Codespaces</a> extension.`
		// ——两段产品名保留英文，整句仍读得通
		const rendered = renderNodes([
			"Connect to the cloud from your local desktop client. Requires",
			" ",
			"Visual Studio Code",
			" with the ",
			"GitHub Codespaces",
			" extension.",
		]);
		expect(rendered).toBe(
			"从本地桌面客户端连接到云端。需要 Visual Studio Code 并安装 GitHub 代码空间 扩展。",
		);
		expect(translateText("Editor preference", view)).toBe(
			"编辑器偏好",
		);
		expect(
			translateText(
				"Edit and preview changes straight from the browser.",
				view,
			),
		).toBe("直接在浏览器中编辑并预览更改。");
	});

	it("renders the idle-timeout and retention sentences with their number nodes", () => {
		// 实机：说明段 + 纯数字节点（翻不了、原样保留）+ 单位句
		expect(
			renderNodes([
				"A codespace will suspend after a period of inactivity. You can specify a default idle timeout value, which will apply to all codespaces created after the default is changed. You will be charged for the entire time your codespace is running, even if it is idle. The maximum value is",
				" ",
				"240",
				" ",
				"minutes (4 hours).",
			]),
		).toBe(
			"代码空间在闲置一段时间后会挂起。你可以指定默认的空闲超时值，它将应用于默认值更改后创建的所有代码空间。即使代码空间处于闲置状态，你也要为其整个运行时间付费。最大值为 240 分钟（4 小时）。",
		);
		expect(
			renderNodes([
				"Inactive codespaces are automatically deleted 30 days after the last time they were stopped. A shorter retention period can be set, and will apply to all codespaces created going forward. The default and maximum value is",
				" ",
				"30",
				" ",
				"days.",
			]),
		).toBe(
			"闲置的代码空间会在最后一次停止后 30 天自动删除。可以设置更短的保留期，它将应用于此后创建的所有代码空间。默认值与最大值为 30 天。",
		);
		// 数字输入框右侧的单位标签是独立节点
		expect(translateText("minutes", view)).toBe("分钟");
		expect(translateText("days", view)).toBe("天");
		// 两条范围校验文案（React 渲染，静态）
		expect(
			translateText(
				"Timeout must be 5 minutes or more.",
				view,
			),
		).toBe("超时时间必须不少于 5 分钟。");
		expect(
			translateText(
				"Retention period must be 30 days or less.",
				view,
			),
		).toBe("保留期必须不超过 30 天。");
		expect(
			translateText("Learn about retention setting", view),
		).toBe("了解保留期设置");
	});

	it("translates the region block", () => {
		expect(translateText("Region", view)).toBe("区域");
		expect(
			translateText("Choose your default region", view),
		).toBe("选择你的默认区域");
		expect(translateText("Set automatically", view)).toBe(
			"自动设置",
		);
		expect(translateText("Set manually", view)).toBe(
			"手动设置",
		);
		expect(
			translateText(
				"We will determine the closest available region based on your location (IP address) at codespace creation time.",
				view,
			),
		).toBe(
			"我们会在创建代码空间时根据你的位置（IP 地址）确定最近且可用的区域。",
		);
		// 五个区域名（地理描述，不是 API 里的区域代码）
		expect(translateText("Australia", view)).toBe(
			"澳大利亚",
		);
		expect(translateText("Europe West", view)).toBe("西欧");
		expect(translateText("Southeast Asia", view)).toBe(
			"东南亚",
		);
		expect(translateText("US East", view)).toBe("美国东部");
		expect(translateText("US West", view)).toBe("美国西部");
	});

	it("translates the repository picker counter through its rule", () => {
		expect(
			translateText("Selected 0 repositories.", view),
		).toBe("已选择 0 个仓库。");
		expect(
			translateText("Selected 1 repository.", view),
		).toBe("已选择 1 个仓库。");
		expect(
			translateText("Selected 12 repositories.", view),
		).toBe("已选择 12 个仓库。");
		expect(translateText("Select repository", view)).toBe(
			"选择仓库",
		);
		expect(
			translateText("Selected repositories", view),
		).toBe("已选仓库");
		expect(
			translateText("No matching repositories.", view),
		).toBe("没有匹配的仓库。");
		expect(
			translateText(
				"The following repositories will be referenced by GPG verification and Settings Sync.",
				view,
			),
		).toBe("以下仓库将被 GPG 验证与设置同步引用。");
	});

	it("renders the dotfiles and secrets blocks", () => {
		expect(translateText("Dotfiles", view)).toBe(
			"dotfiles 配置",
		);
		expect(
			translateText("Automatically install dotfiles", view),
		).toBe("自动安装 dotfiles");
		expect(
			translateText(
				"Codespaces can automatically install your dotfiles into every codespace you create.",
				view,
			),
		).toBe(
			"代码空间可以自动把你的 dotfiles 安装到你创建的每个代码空间中。",
		);
		expect(
			translateText(
				"Learn how to set up your dotfiles for Codespaces.",
				view,
			),
		).toBe("了解如何为代码空间设置 dotfiles。");
		expect(translateText("Secrets", view)).toBe("机密");
		expect(translateText("New secret", view)).toBe(
			"新建机密",
		);
		expect(
			translateText("Codespace user secrets", view),
		).toBe("代码空间用户机密");
		expect(translateText("Submit", view)).toBe("提交");
		expect(
			translateText(
				"There are no Codespace secrets.",
				view,
			),
		).toBe("没有代码空间机密。");
		expect(
			translateText(
				"Development environment secrets are environment variables that are encrypted. They are available to any codespace you create using repositories with access to that secret.",
				view,
			),
		).toBe(
			"开发环境机密是经过加密的环境变量。使用有权访问该机密的仓库创建的任何代码空间都可以使用它们。",
		);
	});

	it("renders the access-and-security and GPG blocks", () => {
		expect(translateText("Access and security", view)).toBe(
			"访问与安全",
		);
		expect(
			translateText(
				"Limit access of personal Codespaces to the repository they were opened for",
				view,
			),
		).toBe(
			"将个人代码空间的访问限制为其打开时所针对的仓库",
		);
		expect(
			translateText(
				"All Codespaces can access other repositories I own",
				view,
			),
		).toBe("所有代码空间都可以访问我拥有的其他仓库");
		expect(translateText("GPG verification", view)).toBe(
			"GPG 验证",
		);
		expect(
			translateText(
				"GPG signing will be available in Codespaces",
				view,
			),
		).toBe("GPG 签名将在代码空间中可用");
		expect(translateText("Settings Sync", view)).toBe(
			"设置同步",
		);
		expect(
			translateText(
				"VS Code Settings Sync will be available in Codespaces",
				view,
			),
		).toBe("VS Code 设置同步将在代码空间中可用");
		expect(
			translateText(
				"Warning notifications for codespace deletions will be enabled",
				view,
			),
		).toBe("代码空间删除的警告通知将启用");
	});
});
