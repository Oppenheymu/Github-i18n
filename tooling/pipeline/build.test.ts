import { describe, expect, it } from "bun:test";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	buildOnce,
	diffArtifacts,
	expectedArtifacts,
} from "./build.ts";

describe("expectedArtifacts", () => {
	it("renames the content entry and keeps the popup entry", () => {
		expect([...expectedArtifacts()].sort()).toEqual([
			"content.js",
			"popup.js",
		]);
	});

	it("expects the entry name when no rename is registered", () => {
		// 新增入口却没加 OUTPUT_RENAMES 映射时，期望集合里是入口原名（bar.js），
		// diffArtifacts 会把它当成意料之外的产物报出来
		expect(
			[
				...expectedArtifacts([
					"src/content/index.ts",
					"src/foo/bar.ts",
				]),
			].sort(),
		).toEqual(["bar.js", "content.js"]);
	});
});

describe("diffArtifacts", () => {
	it("reports nothing when the artifact set matches", () => {
		expect(
			diffArtifacts(
				["content.js", "popup.js"],
				expectedArtifacts(),
			),
		).toEqual([]);
	});

	it("reports a missing artifact", () => {
		const problems = diffArtifacts(
			["popup.js"],
			expectedArtifacts(),
		);
		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain("content.js");
	});

	it("reports an artifact that no entry asked for", () => {
		const problems = diffArtifacts(
			["content.js", "popup.js", "index.js"],
			expectedArtifacts(),
		);
		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain("index.js");
	});
});

// 上面两条是纯函数；下面**真跑一遍 Bun.build**（审计 L-08 的原话是：把 format 从
// iife 改掉、或改坏 ENTRIES，纯函数用例全绿，直到打包发布才发现 content.js 缺失）。
describe("buildOnce 的真实构建", () => {
	it("emits exactly the artifacts the manifest references", async () => {
		const outdir = mkdtempSync(
			join(tmpdir(), "build-test-"),
		);
		try {
			await buildOnce(outdir);
			// 入口 index.ts 必须已被 OUTPUT_RENAMES 改名成 manifest 引用的 content.js
			expect(
				[
					...new Bun.Glob("*.js").scanSync({ cwd: outdir }),
				].sort(),
			).toEqual(["content.js", "popup.js"]);
			// public/ 静态资产原样拷入（缺一个扩展就装不上）
			for (const asset of ["manifest.json", "popup.html"]) {
				expect(existsSync(join(outdir, asset))).toBe(true);
			}
			expect(
				existsSync(join(outdir, "icons", "logo-16.jpg")),
			).toBe(true);
		} finally {
			rmSync(outdir, { recursive: true, force: true });
		}
	});

	it("emits both entries wrapped as IIFEs instead of bare ES modules", async () => {
		// MV3 的 content_scripts 不支持 type: module（AGENTS.md 硬性约束 5）。
		// 判据必须看**包装**：这两个入口没有 export，把 format 改成 esm 后产物里
		// 也不会出现 import / export 关键字（实测），只查关键字等于没查。
		const outdir = mkdtempSync(
			join(tmpdir(), "build-test-"),
		);
		try {
			await buildOnce(outdir);
			for (const name of ["content.js", "popup.js"]) {
				const source = readFileSync(
					join(outdir, name),
					"utf8",
				);
				// iife 产物是整份被包进一个立即执行的函数表达式（esm 产物则是
				// 平铺在顶层、整体不缩进）
				expect(source).toMatch(
					/^\s*\((?:async\s*)?(?:function\b|\()/,
				);
				expect(source.trimEnd()).toMatch(/\}\)\(\);$/);
				// 顺带钉住「不得出现顶层模块语法」
				expect(source).not.toMatch(
					/^\s*(?:import|export)[\s{"']/m,
				);
			}
		} finally {
			rmSync(outdir, { recursive: true, force: true });
		}
	});
});
