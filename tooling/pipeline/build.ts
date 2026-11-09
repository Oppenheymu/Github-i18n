// 构建脚本：Bun.build 打包 content / popup 为 IIFE 经典脚本 + 拷贝 public/ → dist/
// 已知坑（AGENTS.md）：Bun.build 没有 outfile，产物命名靠 naming 模板；
// iife 是硬约束（MV3 content_scripts 不支持 module）
//
// 两种构建：
//   bun run build                开发构建：保留开发者模式（popup 区块 + 漏翻采集器）
//   bun run build:prod           商店构建：剥掉开发者模式 UI / 采集代码，并压缩产物
// 商店包只允许用生产构建（bun run pack 已默认先跑 build:prod）。
//
// 生产裁剪靠 define 的**就地**常量折叠：源码里每个判断点都直接写 process.env.NODE_ENV，
// 不要抽成模块级常量——实测跨函数引用时压缩器不会内联，collector 会留在包里。

import {
	cpSync,
	existsSync,
	watch as fsWatch,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const ENTRIES = [
	"src/content/index.ts",
	"src/popup/popup.ts",
] as const;

/** content script 产物名由入口 basename（index）映射为 manifest 引用的 content.js */
const OUTPUT_RENAMES = new Map([
	["index.js", "content.js"],
]);

/** public/ 里必须被拷进 dist/ 的静态资产（manifest 与 popup 缺一个扩展就装不上） */
const REQUIRED_PUBLIC_ASSETS: readonly string[] = [
	"manifest.json",
	"popup.html",
];

/** popup.html 里开发者区块的构建标记：生产构建把两者之间的内容整段删除 */
const DEV_START =
	/(?:<!-- build:dev-start -->|\/\* build:dev-start \*\/)/;

/**
 * 纯函数：删除 popup.html 里被构建标记包住的开发者区块（含标记本身）。
 *
 * 支持 HTML 与 CSS 两种标记：开发者区块的 DOM 与只服务于它的样式（`.dev-title` /
 * `#dev-panel` 等）都要从商店包里消失，而不是只留一段死 CSS。
 *
 * 为什么在 HTML 上做而不是只靠 CSS 隐藏：商店审核与用户都能打开 popup.html，
 * 隐藏的 DOM 仍然算「随包发布的开发者模式」。真正删掉结构，再从 popup.ts 里删掉
 * 只在该结构存在时才执行的代码，才是「生产环境去掉开发者模式」。
 */
export function stripDevSections(html: string): string {
	if (!DEV_START.test(html)) return html;
	const pattern =
		/[ \t]*(?:<!-- build:dev-start -->|\/\* build:dev-start \*\/)[\s\S]*?(?:<!-- build:dev-end -->|\/\* build:dev-end \*\/)[ \t]*\r?\n?/g;
	return html.replace(pattern, "");
}

/**
 * 纯函数：从 _locales/<语言>/messages.json 里删除 dev* 文案。
 *
 * popup.html 的开发者区块被删后这些消息没有引用方；继续随包发布只会让
 * 「零收集」的商店描述与包内文案自相矛盾。只删 `dev` 前缀，保留 appName 等。
 */
export function stripDevMessages(source: string): string {
	const data = JSON.parse(source) as Record<
		string,
		unknown
	>;
	for (const key of Object.keys(data)) {
		if (key.startsWith("dev")) delete data[key];
	}
	return `${JSON.stringify(data, null, "\t")}\n`;
}

/**
 * 纯函数：入口清单 + 改名映射 → 期望的产物文件名集合。
 * 新增入口却忘了加 OUTPUT_RENAMES 映射时，产物会以入口原名（如 index.js）落进 dist/，
 * 并被 pack 无差别打进商店包——这里把它变成一条硬断言。
 */
export function expectedArtifacts(
	entries: readonly string[] = ENTRIES,
	renames: ReadonlyMap<string, string> = OUTPUT_RENAMES,
): ReadonlySet<string> {
	const expected = new Set<string>();
	for (const entry of entries) {
		const base = entry.split("/").pop() ?? entry;
		const name = `${base.replace(/\.ts$/, "")}.js`;
		expected.add(renames.get(name) ?? name);
	}
	return expected;
}

/** 纯函数：实际产物 vs 期望产物 → 中文问题列表（空数组 = 一致） */
export function diffArtifacts(
	actual: Iterable<string>,
	expected: ReadonlySet<string>,
): string[] {
	const problems: string[] = [];
	const seen = new Set(actual);
	for (const name of expected) {
		if (seen.has(name)) continue;
		problems.push(
			`dist/${name} 不存在：入口产物缺失（Bun.build 的 naming 模板或入口清单被改了？）`,
		);
	}
	for (const name of seen) {
		if (expected.has(name)) continue;
		problems.push(
			`dist/${name} 是意料之外的 JS 产物：新增入口后忘了在 OUTPUT_RENAMES 里给产物定名？它会原样被打进商店包`,
		);
	}
	return problems;
}

/** 拷贝 public/ 静态资产；生产构建额外剥掉开发者模式相关结构与文案 */
function copyPublicAssets(
	outdir: string,
	production: boolean,
): void {
	cpSync("public", outdir, { recursive: true });
	if (!production) return;
	const popupPath = join(outdir, "popup.html");
	writeFileSync(
		popupPath,
		stripDevSections(readFileSync(popupPath, "utf8")),
	);
	const localesDir = join(outdir, "_locales");
	if (!existsSync(localesDir)) return;
	for (const name of readdirSync(localesDir)) {
		const file = join(localesDir, name, "messages.json");
		if (!existsSync(file)) continue;
		writeFileSync(
			file,
			stripDevMessages(readFileSync(file, "utf8")),
		);
	}
}

export interface BuildOptions {
	/**
	 * 生产构建：
	 * - `process.env.NODE_ENV` 注入 "production"，让 `!PRODUCTION` 分支被常量折叠；
	 * - 压缩产物（开发构建刻意不压缩，便于在浏览器里排查漏翻）；
	 * - popup.html 剥掉开发者区块、_locales 剥掉 dev* 文案。
	 */
	readonly production?: boolean;
}

/**
 * 真实跑一次构建（Bun.build → 改名 → 拷贝 public/ → 产物集合断言）。
 *
 * 导出是为了让用例**真跑一遍**：产物集合与 public 资产断言的价值在于「构建确实被
 * 执行过」，只测 `expectedArtifacts` / `diffArtifacts` 两个纯函数时，把 `format`
 * 从 iife 改成 esm 或把 `ENTRIES` 改坏都不会变红（审计 L-08）。`outdir` 可指定，
 * 用例借此写进临时目录而不碰仓库的 dist/。
 */
export async function buildOnce(
	outdir = DIST,
	options: BuildOptions = {},
): Promise<void> {
	const production = options.production === true;
	const result = await Bun.build({
		entrypoints: [...ENTRIES],
		outdir,
		format: "iife",
		target: "browser",
		// 开发构建不压缩：便于在浏览器里排查漏翻与误伤；生产构建压缩以减小包体
		minify: production,
		sourcemap: "none",
		naming: "[name].[ext]",
		define: {
			"process.env.NODE_ENV": JSON.stringify(
				production ? "production" : "development",
			),
		},
	});
	if (!result.success) {
		console.error("构建失败：");
		for (const log of result.logs)
			console.error(`  ${String(log)}`);
		process.exitCode = 1;
		return;
	}
	for (const [from, to] of OUTPUT_RENAMES) {
		const source = join(outdir, from);
		if (!existsSync(source)) {
			console.error(
				`构建产物缺少 ${from}（改过入口文件名或 Bun.build 的 naming 模板？OUTPUT_RENAMES 必须同步）`,
			);
			process.exitCode = 1;
			return;
		}
		renameSync(source, join(outdir, to));
	}
	// public/ 静态资产原样拷入 outdir/（manifest / popup.html / icons）
	copyPublicAssets(outdir, production);
	for (const asset of REQUIRED_PUBLIC_ASSETS) {
		if (existsSync(join(outdir, asset))) continue;
		console.error(
			`${outdir}/${asset} 不存在：public/ 里的静态资产没被拷进来`,
		);
		process.exitCode = 1;
		return;
	}
	// 产物集合必须与入口一一对应（见 expectedArtifacts 的说明）
	const actualJs = [
		...new Bun.Glob("*.js").scanSync({ cwd: outdir }),
	].sort();
	const problems = diffArtifacts(
		actualJs,
		expectedArtifacts(),
	);
	if (problems.length > 0) {
		console.error("构建产物集合与入口不一致：");
		for (const problem of problems)
			console.error(`  - ${problem}`);
		process.exitCode = 1;
		return;
	}
	const files = [
		...new Bun.Glob("**/*").scanSync({ cwd: outdir }),
	].sort();
	console.log(
		`构建完成：${outdir}/（${files.length} 个文件${production ? "，生产模式" : ""}）`,
	);
}

/** --watch 模式：监听 src/ 与 public/ 变更后防抖重建（仅开发构建） */
function startWatch(): void {
	let timer: ReturnType<typeof setTimeout> | null = null;
	const schedule = () => {
		if (timer !== null) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			void buildOnce();
		}, 100);
	};
	fsWatch("src", { recursive: true }, schedule);
	fsWatch("public", { recursive: true }, schedule);
	console.log(
		"监听中：修改 src/ 或 public/ 后自动重建（扩展需在浏览器手动重载）",
	);
}

async function main(): Promise<void> {
	const production = process.argv.includes("--production");
	const watch = process.argv.includes("--watch");
	if (production && watch) {
		console.error(
			"--watch 只用于开发构建：生产包需要一次性的确定性产物，不能边改边看",
		);
		process.exitCode = 1;
		return;
	}
	rmSync(DIST, { recursive: true, force: true });
	mkdirSync(DIST, { recursive: true });
	await buildOnce(DIST, { production });
	if (watch) startWatch();
}

if (import.meta.main) await main();
