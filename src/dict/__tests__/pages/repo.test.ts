// 仓库页（/owner/repo 及其子页）实机文本节点回归。
//
// 节点清单来源：2026-09 用无扩展的无头 Edge 抓 https://github.com/microsoft/vscode
// 的真实渲染 DOM，逐个文本节点记录 nodeValue（含源码换行缩进）与父元素路径，
// 再用仓库自己的 translateText + 该路径的 buildView 判定命中。这里锁的是
// **节点边界**这一层事实——整句键在实机上永不命中，只有逐节点的原文才算数。
//
// 为什么这些反例必须留在文件里：仓库页最像「用户内容」的位置是文件/目录列表
// （实测确实渲染成孤立文本节点：div.react-directory-filename-cell > a.Link--primary
// 里的 "src" / "test" / "build" / "extensions" …）。引擎按「整节点精确匹配」工作，
// 分不清 UI 文案与文件名，唯一的保护就是**不收录**这类小写常用词——下面的反例
// 断言就是这条纪律的回归保护，别把它们「补」成词条。
import { describe, expect, it } from "bun:test";
import { buildView } from "../../../content/view.ts";
import { translateText } from "../../../content/walker.ts";
import { dictCore, dictForLocale } from "../../index.ts";

/** /microsoft/vscode 命中的模块视图（pages/repo + global） */
const view = buildView(
	"/microsoft/vscode",
	dictForLocale("zh-CN"),
	new Map(Object.entries(dictCore.aliases)),
);

/**
 * 实机渲染的文本节点原文（逐字录入；带缩进换行的按原样保留）。
 * 末尾标注的是实机译文，便于人工对照。
 */
const REPO_NODES: readonly string[] = [
	// —— 仓库导航 ——
	"Code", // → 代码
	"Issues", // → 议题
	"Pull requests", // → 拉取请求
	"Actions", // → 操作
	"Projects", // → 项目
	"Wiki", // → 维基
	"Security and quality", // → 安全与质量
	"Insights", // → 洞察
	"Additional navigation options", // → 更多导航选项
	// 同一批导航项在窄屏下拉里带源码缩进，是**另一组文本节点**
	"\n          Code\n",
	"\n          Actions\n",
	"\n          Projects\n",
	"\n          Wiki\n",
	"\n          Security and quality\n",
	"\n          Insights\n",
	// —— 仓库头部动作 ——
	"You must be signed in to change notification settings",
	"Fork\n    ",
	"\n          Star\n",
	// 已星标状态：按钮 label 是一个独立节点，后面紧跟计数胶囊（`6`）与 sr-only `(6)`，
	// 三者各是文本节点，只有 `Starred` 能收（2026-10-23 维护者贴的
	// `<span data-component="text" class="prc-Button-Label…"><span>Starred</span>…`）
	"Starred",
	// —— 分支 / 标签入口 ——
	"Branches",
	"Tags",
	"Go to file",
	"Open more actions menu",
	// —— 文件列表表头 ——
	"Latest commit",
	"History",
	"Folders and files",
	"Name",
	"Last commit message",
	"Last commit date",
	"View all files",
	"Repository files navigation",
	// —— 侧栏 ——
	"About",
	"Readme",
	"MIT license",
	"Code of conduct",
	"Contributing",
	"Security policy",
	"Activity",
	"Custom properties",
	"Watchers",
	"Releases",
	"Latest",
	"Contributors",
	"Languages",
	"Report repository",
	// —— About 侧栏（新版 React 组件，2026-10-23 维护者贴出的整段 HTML）——
	// 统计项把数字放进 `<strong>`，单位是**带前导空格的独立节点**；
	// 仓库年龄同样被拆成 `<strong>4</strong>` + ` weeks old`
	"Repository age",
	" stars",
	" watching",
	" forks",
	" weeks old",
	// 有组织审计权限时侧栏多出这一条（链接指向组织设置，渲染位置在仓库页）
	"Audit log",
	// —— About 侧栏的 Releases 区块 ——
	"No releases published",
	"Create a new release",
	// —— 提交状态组件（仓库头部；设置页顶部也会渲染，2026-10-17 由漏翻日志补收）——
	"Loading status checks…",
	"CI status of latest commit",
];

/** 用户内容 / 仓库元数据：一律保留英文（未收录即不命中） */
const USER_CONTENT: readonly string[] = [
	// 仓库标识
	"microsoft",
	"vscode",
	// 分支名与默认分支
	"main",
	// 文件 / 目录名（实机确实是这样一组孤立节点）
	"src",
	"test",
	"build",
	"extensions",
	"resources",
	"scripts",
	"cli",
	"remote",
	".github",
	".config",
	".devcontainer",
	".vscode",
	".editorconfig",
	".git-blame-ignore-revs",
	// 带扩展名的文件名：README 收，README.md 不收
	"README.md",
	"package.json",
];

/**
 * 日语视图：同一批节点必须全部落到日语译文。
 *
 * 这条用例守的是「pages/repo 已登记进 registry 的 ja 段」这件事本身——日语词条是
 * 稀疏覆盖，漏登记时构件不会报错，整页只会静默保留英文（门禁的覆盖率也只掉几个点），
 * 故用实机节点清单锁一次。
 */
const jaView = buildView(
	"/microsoft/vscode",
	dictForLocale("ja"),
	new Map(Object.entries(dictCore.aliases)),
);

/** 节点在实机里通常带源码缩进与换行；两种形态都必须命中 */
function withWhitespace(node: string): readonly string[] {
	return [node, `\n        ${node}\n      `];
}

/**
 * 把实机的连续文本节点拼回页面上的那一行：命中的节点写回译文并保留首尾空白
 * （见 walker.ts 的 applyTextNode），最后折叠浏览器会折叠的连续空白。
 */
function renderNodes(
	nodes: readonly string[],
	target: typeof view = view,
): string {
	return nodes
		.map((node) => {
			const translated = translateText(node, target);
			if (translated === null) return node;
			const lead = node.slice(
				0,
				node.length - node.trimStart().length,
			);
			const trail = node.slice(node.trimEnd().length);
			return `${lead}${translated}${trail}`;
		})
		.join("")
		.replace(/\s+/g, " ")
		.trim();
}

describe("仓库页的实机节点边界", () => {
	it("translates every text node GitHub actually renders", () => {
		for (const node of REPO_NODES) {
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

	it("keeps file names, branch names and owner names in english", () => {
		for (const raw of USER_CONTENT) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("distinguishes the README label from the README.md file name", () => {
		expect(translateText("README", view)).toBe("自述文件");
		expect(translateText("README.md", view)).toBeNull();
	});

	it("matches a fragment that carries source indentation", () => {
		// "Fork\n    " 是实机里真实存在的形态（节点自带源码缩进）。引擎先归一化再匹配，
		// 故译文是干净的「复刻」；写回时由 walker 负责保留原节点的首尾空白
		expect(translateText("Fork\n    ", view)).toBe("复刻");
		expect(translateText("\n          Star\n", view)).toBe(
			"星标",
		);
	});

	it("translates the starred label but not its counter nodes", () => {
		// 已星标时按钮的三个节点：label / 计数 / sr-only 括号计数。计数是纯数字，
		// 不进词典（收了就是永不命中的死键），也不允许规则把它们吃掉
		expect(translateText("Starred", view)).toBe("已星标");
		for (const raw of ["6", "\u00a0(", ")"]) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});

	it("translates the sidebar counts through the repo count rules", () => {
		// 侧栏三个计数（星标 / 关注 / 复刻）是「数字 + 单位」的单个节点，
		// 数字随仓库变化，故走规则而不是静态词条（静态词条只能解采集时的那一个值）。
		// 2026-09 维护者按截图 + `<span> stars</span>` 片段确认了这三个节点的存在。
		expect(translateText("5 stars", view)).toBe("5 个星标");
		expect(translateText("1 star", view)).toBe("1 个星标");
		expect(translateText("2 watching", view)).toBe(
			"2 人在关注",
		);
		expect(translateText("1 fork", view)).toBe("1 个复刻");
		expect(translateText("3 forks", view)).toBe("3 个复刻");
		// 千位缩写与带逗号的计数同样命中（GitHub 会渲染成 4.1k / 1,234 这类形态）
		expect(translateText("4.1k stars", view)).toBe(
			"4.1k 个星标",
		);
		expect(translateText("1,234 stars", view)).toBe(
			"1,234 个星标",
		);
	});

	it("renders the About sidebar stats from their split nodes", () => {
		// 实机结构：`<span><strong>6</strong></span><span> stars</span>`。数字节点永不进
		// 词典，单位节点带前导空格、归一化后是 stars / watching / forks。
		expect(renderNodes(["6", " stars"])).toBe("6 个星标");
		expect(renderNodes(["2", " watching"])).toBe(
			"2 人在关注",
		);
		expect(renderNodes(["0", " forks"])).toBe("0 个复刻");
		// 仓库年龄：`<strong>4</strong> weeks old`
		expect(renderNodes(["4", " weeks old"])).toBe(
			"4 周前创建",
		);
	});

	it("translates the stat units and the repository age units", () => {
		expect(translateText(" stars", view)).toBe("个星标");
		expect(translateText(" star", view)).toBe("个星标");
		expect(translateText(" watching", view)).toBe(
			"人在关注",
		);
		expect(translateText(" forks", view)).toBe("个复刻");
		expect(translateText(" days old", view)).toBe(
			"天前创建",
		);
		expect(translateText(" weeks old", view)).toBe(
			"周前创建",
		);
		expect(translateText(" months old", view)).toBe(
			"个月前创建",
		);
		expect(translateText(" years old", view)).toBe(
			"年前创建",
		);
		// 数字与单位仍在同一节点的旧版形态由 `repo/*-count` 规则兜住，两条路径并存
		expect(translateText("6 stars", view)).toBe("6 个星标");
		// 年龄文案整句未被拆开时（`8 months old` 是一个节点）走整句规则
		expect(translateText("5 days old", view)).toBe(
			"5 天前创建",
		);
		expect(translateText("1 week old", view)).toBe(
			"1 周前创建",
		);
		expect(translateText("8 months old", view)).toBe(
			"8 个月前创建",
		);
		expect(translateText("2 years old", view)).toBe(
			"2 年前创建",
		);
	});

	it("renders the repository age split into unit and old nodes", () => {
		// 实机节点序列（2026-10-23 维护者 Console 采集，/Koishi-CE/koishi）：
		// `<svg/>` `" "` `<strong>2</strong>` `" "` `"months"` `" old"`
		for (const [number, unit, expected] of [
			["2", "months", "2 个月 前创建"],
			["4", "weeks", "4 周 前创建"],
			["5", "days", "5 天 前创建"],
			["2", "years", "2 年 前创建"],
		] as const) {
			expect(
				renderNodes([" ", number, " ", unit, " old"]),
			).toBe(expected);
		}
		// 单位与 `old` 各自命中，数字与空白节点保持原样
		expect(translateText("months", view)).toBe("个月");
		expect(translateText(" old", view)).toBe("前创建");
	});

	it("translates the About sidebar release block and audit log", () => {
		expect(
			translateText("No releases published", view),
		).toBe("尚未发布任何版本");
		expect(
			translateText("Create a new release", view),
		).toBe("创建新版本");
		expect(translateText("Repository age", view)).toBe(
			"仓库创建时间",
		);
		expect(translateText("Audit log", view)).toBe(
			"审计日志",
		);
	});

	it("keeps count words inside longer names untouched", () => {
		// 单位规则只能锚定整节点，故带连字符 / 多词混排的仓库名与描述不会被误伤。
		// 注意：**单独一个 `stars` / `watching` / `forks` 节点现在会命中**——新版 About
		// 侧栏把数字与单位拆开后，归一化会 trim 掉单位节点的前导空格，引擎无法区分它
		// 与同名文件名 / 仓库名。这是有意的取舍（这些单位每个仓库页都渲染），
		// 见 core/rules.jsonc 的 repo/*-unit 注释。
		for (const raw of [
			"5 stars and 2 forks",
			"awesome-stars",
			"star charts",
			"fork it",
			"forks of other forks",
		]) {
			expect(
				translateText(raw, view),
				`不应被翻译：${JSON.stringify(raw)}`,
			).toBeNull();
		}
	});
});

describe("仓库页的日语覆盖（pages/repo）", () => {
	it("translates every repository node into japanese", () => {
		for (const node of REPO_NODES) {
			for (const variant of withWhitespace(node)) {
				const translated = translateText(variant, jaView);
				expect(
					translated,
					`未命中：${JSON.stringify(variant)}`,
				).not.toBeNull();
				expect(translated ?? "").toMatch(
					/[\u3040-\u30ff\u4e00-\u9fff]/,
				);
			}
		}
	});

	it("translates the README label but not the file name", () => {
		// README へのリンクは見出し（README）と About サイドバー（Readme）で綴りが違う。
		// どちらも音訳し、拡張子付きのファイル名 `README.md` はユーザー内容として残す
		expect(translateText("README", jaView)).toBe(
			"リードミー",
		);
		expect(translateText("Readme", jaView)).toBe(
			"リードミー",
		);
		expect(translateText("README.md", jaView)).toBeNull();
	});
});

// —— 仓库首页头部的 Edit Pins / Watch / Fork / Star 下拉（维护者 2026-11-01
// Koishi-CE/koishi 实机截图）——
//
// Lists / Create list / Custom 与 pages/profile 同键同译（姊妹复用，profile 路由
// 不覆盖仓库页）；「You don't have…」撇号弯直没把握，直撇号为规范键、弯撇号走别名。
describe("仓库页头部的 Edit Pins 与三个状态下拉", () => {
	it("translates the edit pins dropdown and its tooltip", () => {
		expect(translateText("Edit Pins", view)).toBe(
			"编辑置顶",
		);
		expect(
			translateText(
				"Public pins in this organization",
				view,
			),
		).toBe("此组织的公开置顶");
		expect(translateText("Visible to anyone", view)).toBe(
			"任何人可见",
		);
		expect(
			translateText(
				"Private pins in this organization",
				view,
			),
		).toBe("此组织的私有置顶");
		expect(
			translateText("Visible to members only", view),
		).toBe("仅成员可见");
		expect(
			translateText(
				"Pin this to your personal profile, visible to everyone",
				view,
			),
		).toBe("将其置顶到你的个人资料，所有人可见");
		expect(
			translateText(
				"Pin or unpin this repository on organization profiles and your profile",
				view,
			),
		).toBe(
			"在组织资料页与你的个人资料页上置顶或取消置顶此仓库",
		);
	});

	it("translates the watch dropdown notification options", () => {
		expect(
			translateText("Participating and @mentions", view),
		).toBe("参与和 @提及");
		expect(
			translateText(
				"Only receive notifications from this repository when participating or @mentioned.",
				view,
			),
		).toBe("仅在你参与或被 @提及时，才接收此仓库的通知。");
		expect(translateText("All Activity", view)).toBe(
			"所有动态",
		);
		expect(
			translateText(
				"Notified of all notifications on this repository.",
				view,
			),
		).toBe("接收此仓库的所有通知。");
		expect(translateText("Ignore", view)).toBe("忽略");
		expect(translateText("Never be notified.", view)).toBe(
			"永不接收通知。",
		);
		// Custom 与 pages/profile 同键同译（姊妹复用）
		expect(translateText("Custom", view)).toBe("自定义");
		expect(
			translateText(
				"Select events you want to be notified of in addition to participating and @mentions.",
				view,
			),
		).toBe("选择除参与和 @提及之外你还想接收通知的事件。");
	});

	it("translates the fork dropdown and both apostrophe forms", () => {
		expect(
			translateText(
				"See your forks of this repository",
				view,
			),
		).toBe("查看你对此仓库的复刻");
		expect(
			translateText(
				"You don't have any forks of this repository.",
				view,
			),
		).toBe("你还没有复刻此仓库。");
		// 弯撇号形态走别名复用同一译文
		expect(
			translateText(
				"You don’t have any forks of this repository.",
				view,
			),
		).toBe("你还没有复刻此仓库。");
		expect(translateText("Create a new fork", view)).toBe(
			"创建新的复刻",
		);
	});

	it("translates the star lists dropdown reusing the profile translations", () => {
		expect(translateText("Star lists", view)).toBe(
			"星标列表",
		);
		expect(translateText("Lists", view)).toBe("列表");
		expect(
			translateText(
				"Add this repository to one or more lists",
				view,
			),
		).toBe("将此仓库添加到一个或多个列表");
		expect(translateText("Filter lists", view)).toBe(
			"筛选列表",
		);
		expect(translateText("Create list", view)).toBe(
			"创建列表",
		);
	});

	it("has japanese templates for the dropdowns", () => {
		expect(translateText("Edit Pins", jaView)).toBe(
			"ピンを編集",
		);
		expect(
			translateText(
				"Public pins in this organization",
				jaView,
			),
		).toBe("この組織の公開ピン");
		expect(
			translateText("Participating and @mentions", jaView),
		).toBe("参加と @メンション");
		expect(translateText("All Activity", jaView)).toBe(
			"すべてのアクティビティ",
		);
		expect(translateText("Ignore", jaView)).toBe("無視");
		expect(translateText("Custom", jaView)).toBe(
			"カスタム",
		);
		expect(
			translateText(
				"You don’t have any forks of this repository.",
				jaView,
			),
		).toBe("このリポジトリのフォークはまだありません。");
		expect(translateText("Create a new fork", jaView)).toBe(
			"新しいフォークを作成",
		);
		expect(translateText("Star lists", jaView)).toBe(
			"スターリスト",
		);
		expect(translateText("Lists", jaView)).toBe("リスト");
		expect(translateText("Filter lists", jaView)).toBe(
			"リストを絞り込む",
		);
		expect(translateText("Create list", jaView)).toBe(
			"リストを作成",
		);
	});
});

// —— 详情编辑对话框、发布/分支切换器/代码空间空态与 Code 下拉（维护者
// 2026-11-01 Koishi-CE/koishi 实机截图续批）——
//
// Save changes / Website / Open in GitHub Copilot app 与 repo-settings /
// settings / pages/pulls 同键同译（姊妹复用）；撇号与省略号的弯直形态走别名双保险。
describe("仓库页详情对话框与代码空间/发布下拉", () => {
	it("translates the edit details dialog", () => {
		expect(
			translateText("Edit repository details", view),
		).toBe("编辑仓库详情");
		expect(translateText("Website", view)).toBe("网址");
		expect(
			translateText("Include in the home page", view),
		).toBe("包含在主页中");
		expect(translateText("Save changes", view)).toBe(
			"保存更改",
		);
		// React 插值拆出的字数尾段：整串由 global/status-characters-remaining
		// 规则接住，碎片节点只有本词条能救
		expect(
			translateText("characters remaining", view),
		).toBe("个字符剩余");
	});

	it("translates the release and branch switcher strings", () => {
		expect(translateText("Draft a new release", view)).toBe(
			"新建草稿版本",
		);
		expect(
			translateText("Find or create a branch...", view),
		).toBe("查找或创建分支…");
		// 单字符省略号（…）形态走别名
		expect(
			translateText("Find or create a branch…", view),
		).toBe("查找或创建分支…");
		expect(translateText("View all branches", view)).toBe(
			"查看所有分支",
		);
		expect(translateText("Edit file", view)).toBe(
			"编辑文件",
		);
	});

	it("translates the code dropdown and codespaces empty state", () => {
		expect(translateText("Local", view)).toBe("本地");
		expect(
			translateText("Clone using the web URL.", view),
		).toBe("使用 Web URL 克隆。");
		expect(
			translateText("Open in GitHub Copilot app", view),
		).toBe("在 GitHub Copilot 应用中打开");
		expect(
			translateText("Your workspaces in the cloud", view),
		).toBe("云端工作区");
		expect(translateText("No codespaces", view)).toBe(
			"暂无代码空间",
		);
		expect(
			translateText(
				"You don't have any codespaces with this repository checked out",
				view,
			),
		).toBe("你还没有检出此仓库的任何代码空间");
		// 弯撇号形态走别名复用同一译文
		expect(
			translateText(
				"You don’t have any codespaces with this repository checked out",
				view,
			),
		).toBe("你还没有检出此仓库的任何代码空间");
		expect(
			translateText("Learn more about codespaces...", view),
		).toBe("了解代码空间的更多信息…");
		expect(
			translateText(
				"Codespace repository configuration",
				view,
			),
		).toBe("代码空间仓库配置");
	});

	it("translates the dynamic strings through the rules", () => {
		// 发布徽标 tool-tip：提交数与标签名动态；单数 commit 同样命中
		expect(
			translateText(
				"7 unreleased commits since v1.8",
				view,
			),
		).toBe("自 v1.8 以来有 7 个未发布的提交");
		expect(
			translateText("1 unreleased commit since v1.8", view),
		).toBe("自 v1.8 以来有 1 个未发布的提交");
		expect(
			translateText("Create codespace on main", view),
		).toBe("在 main 上创建代码空间");
		// 付费行：句尾句号不进捕获组（懒匹配 + 可选句号两种形态都命中）
		expect(
			translateText(
				"Codespace usage for this repository is paid for by Oppenheymu.",
				view,
			),
		).toBe("此仓库的代码空间用量由 Oppenheymu 付费。");
		expect(
			translateText(
				"Codespace usage for this repository is paid for by Oppenheymu",
				view,
			),
		).toBe("此仓库的代码空间用量由 Oppenheymu 付费。");
		// 用户名独立成节点的形态由前缀词条兜底（句尾句号是独立符号节点保持英文）
		expect(
			translateText(
				"Codespace usage for this repository is paid for by",
				view,
			),
		).toBe("此仓库的代码空间用量付费者：");
	});

	it("has japanese templates", () => {
		expect(
			translateText("Edit repository details", jaView),
		).toBe("リポジトリの詳細を編集");
		expect(
			translateText("Draft a new release", jaView),
		).toBe("新しいリリースの下書きを作成");
		expect(
			translateText(
				"7 unreleased commits since v1.8",
				jaView,
			),
		).toBe("v1.8 以降に未リリースのコミットが 7 件");
		expect(
			translateText("Create codespace on main", jaView),
		).toBe("main でコードスペースを作成");
		expect(
			translateText(
				"Codespace usage for this repository is paid for by Oppenheymu.",
				jaView,
			),
		).toBe(
			"このリポジトリのコードスペースの使用料は Oppenheymu が支払います。",
		);
		expect(translateText("No codespaces", jaView)).toBe(
			"コードスペースはありません",
		);
	});

	it("translates the codespaces plus menu and the article form of the tooltip", () => {
		// 「+」按钮的悬浮提示带冠词（Create a codespace on main），空态按钮
		// 无冠词——上游两个形态由一条规则的 (?:a )? 覆盖
		expect(
			translateText("Create a codespace on main", view),
		).toBe("在 main 上创建代码空间");
		expect(translateText("New with options...", view)).toBe(
			"使用选项新建…",
		);
		// 单字符省略号（…）形态走别名
		expect(translateText("New with options…", view)).toBe(
			"使用选项新建…",
		);
		expect(
			translateText("Configure dev container", view),
		).toBe("配置开发容器");
		expect(translateText("Manage codespaces", view)).toBe(
			"管理代码空间",
		);
		expect(translateText("Share a deep link", view)).toBe(
			"分享深层链接",
		);
		expect(
			translateText("What are codespaces?", view),
		).toBe("什么是代码空间？");
	});

	it("translates the file header menu items", () => {
		// 2026-11-03 维护者 PR Files changed 页实机截图：同一菜单里只有 Edit file
		// 早已收录，其余六项整片英文
		expect(translateText("View file", view)).toBe(
			"查看文件",
		);
		expect(translateText("View raw", view)).toBe(
			"查看原始文件",
		);
		expect(translateText("View blame", view)).toBe(
			"查看追溯",
		);
		expect(translateText("View history", view)).toBe(
			"查看历史",
		);
		expect(translateText("Discard changes", view)).toBe(
			"放弃更改",
		);
		expect(translateText("Delete file", view)).toBe(
			"删除文件",
		);
	});
});
