// src/content/pages.ts 的单槽缓存行为测试（此前无覆盖）。
//
// 为什么值得测：这是 content script 的热路径入口——每个 mutation flush 都会调它。
// 缓存键是「路径 + 语言」，一旦比对写错，Turbo 导航到新路径后会继续用旧页面的词条
// （表现为「换页后一半英文」），而这类失效在别的测试里完全看不见。
import { describe, expect, it } from "bun:test";
import {
	dictCore,
	dictForLocale,
} from "../../dict/index.ts";
import { viewForPath } from "../pages.ts";
import { buildView } from "../view.ts";

describe("viewForPath", () => {
	it("reuses the cached view for the same path and locale", () => {
		const first = viewForPath("/microsoft/vscode", "zh-CN");
		const second = viewForPath(
			"/microsoft/vscode",
			"zh-CN",
		);
		expect(second).toBe(first);
		expect(first.entries.get("Code")).toBe("代码");
	});

	it("rebuilds when the path changes", () => {
		const repo = viewForPath("/microsoft/vscode", "zh-CN");
		const settings = viewForPath(
			"/settings/profile",
			"zh-CN",
		);
		expect(settings).not.toBe(repo);
		// 单槽缓存：槽位已被设置页占用，再取仓库页必须是**新**对象，
		// 否则说明缓存键没把路径算进去
		const repoAgain = viewForPath(
			"/microsoft/vscode",
			"zh-CN",
		);
		expect(repoAgain).not.toBe(repo);
		expect(repoAgain.entries.size).toBe(repo.entries.size);
	});

	it("rebuilds when the locale changes", () => {
		const zh = viewForPath("/microsoft/vscode", "zh-CN");
		const ja = viewForPath("/microsoft/vscode", "ja");
		expect(ja).not.toBe(zh);
		// 同一个键在两种语言下必须是不同的译文：缓存键漏算语言时会拿到 zh 的值。
		// 「Code」在 global（Markdown 工具栏）里两种语言都有译文，故这条断言不再依赖
		// 「ja 尚未翻译该键」这个会随覆盖率增长而失效的前提（2026-10-07 全量同步 ja/global 时踩到）
		expect(zh.entries.get("Code")).toBe("代码");
		expect(ja.entries.get("Code")).toBe("コード");
	});

	it("serves exactly the semantics of buildView", () => {
		// 缓存只该影响「何时重建」，不该影响「重建出什么」
		const aliases = new Map(
			Object.entries(dictCore.aliases),
		);
		for (const pathname of [
			"/microsoft/vscode",
			"/settings/profile",
			"/not-a-real-page/x",
		]) {
			const cached = viewForPath(pathname, "zh-CN");
			const fresh = buildView(
				pathname,
				dictForLocale("zh-CN"),
				aliases,
			);
			expect([...cached.entries.entries()]).toEqual([
				...fresh.entries.entries(),
			]);
			expect(cached.rules.length).toBe(fresh.rules.length);
		}
	});
});
