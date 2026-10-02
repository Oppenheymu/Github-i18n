// 构建脚本：Bun.build 打包 content / popup 为 IIFE 经典脚本 + 拷贝 public/ → dist/
// 已知坑（AGENTS.md）：Bun.build 没有 outfile，产物命名靠 naming 模板；
// iife 是硬约束（MV3 content_scripts 不支持 module）

import {
	cpSync,
	existsSync,
	watch as fsWatch,
	mkdirSync,
	renameSync,
	rmSync,
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
): Promise<void> {
	const result = await Bun.build({
		entrypoints: [...ENTRIES],
		outdir,
		format: "iife",
		target: "browser",
		// 不压缩：便于在浏览器里排查漏翻与误伤
		minify: false,
		sourcemap: "none",
		naming: "[name].[ext]",
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
	cpSync("public", outdir, { recursive: true });
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
		`构建完成：${outdir}/（${files.length} 个文件）`,
	);
}

/** --watch 模式：监听 src/ 与 public/ 变更后防抖重建 */
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
	rmSync(DIST, { recursive: true, force: true });
	mkdirSync(DIST, { recursive: true });
	await buildOnce();
	if (process.argv.includes("--watch")) startWatch();
}

if (import.meta.main) await main();
