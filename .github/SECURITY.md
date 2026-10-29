# 安全政策

> [跳转到英文版（English Version）](#english-version)

## 支持的版本

本仓库是「GitHub 界面本地化（Github-i18n）」浏览器扩展（Chrome / Edge，Manifest V3，MIT）的源码仓库：它把 GitHub 网站界面本地化为多种语言，不派生自任何上游项目的再发行版本。安全更新仅针对当前发布线提供。

| 版本线                                                                      | 支持情况                                      |
| --------------------------------------------------------------------------- | --------------------------------------------- |
| 0.2.x（当前发布线）                                                         | 支持                                          |
| 0.2.0 之前的版本                                                            | 不支持，请先升级到 0.2.x 再验证问题是否仍存在 |
| 上游 GitHub 站点自身（`github.com` / `gist.github.com` 的服务端与网页实现） | 不支持，不属于本项目，请报告给 GitHub         |

补充说明：
- **本扩展没有 npm 发布物，也不接受针对上游 GitHub 自身的问题报告。** 仓库根 `package.json` 标记为 `private`，唯一的分发形式是浏览器扩展（从源码构建出的 `dist/` 目录或应用商店扩展包），不存在可安装的包版本，因此也没有 npm 侧的版本线可言。
- 本项目是独立的社区本地化工具，与 GitHub, Inc. 无任何隶属或背书关系；针对 GitHub 账号、认证、服务端接口与网页实现的问题，请走 GitHub 官方渠道（GitHub Support 或 GitHub Bug Bounty）。

## 攻击面与报告范围

本扩展的能力边界很窄，下面的清单同时也是「哪些报告算本项目的问题」的判定依据：
- **权限**：`manifest.json` 的 `permissions` 只有 `storage`（即 `chrome.storage.local`，用于保存翻译开关、目标语言与开发者漏翻日志）。没有 `tabs`、`cookies`、`webRequest`、`scripting`、主机权限或任何其它权限。
- **注入范围**：content script 仅在 `https://github.com/*` 与 `https://gist.github.com/*` 上、于 `document_start` 注入；popup 只在用户点击工具栏图标时打开。其它站点不受影响。
- **对页面的全部操作**：只读地遍历 DOM，改写文本节点，以及以下属性的文本——`title`、`aria-label`、`placeholder`、`alt`、按钮类 `<input>` 的 `value`、Rails 表单的 `data-disable-with`。不改写页面结构、不注入远程代码、不把页面文本当作代码执行（页面文本只作为查表键）。
- **无网络行为**：扩展**不发起任何网络请求**、**不读写 cookie**、**不采集、不上传任何用户数据**。翻译完全由打包进扩展的本地词典在本机完成；开发者模式（默认关闭）收集的漏翻文本也只写入本机 `chrome.storage.local`，仅在用户主动复制时离开浏览器。

据此，以下类型属于**本项目的问题范畴**，请按「报告漏洞」一节提交：
- **误伤**：译文命中用户内容（代码块、diff、README、评论、仓库名 / 文件名 / 用户名等），或改动页面语义、破坏表单与交互；
- **翻译错误**：词条译错、术语不一致、占位符与复数形态处理不当；
- **界面卡死或性能异常**：例如某条译文与原文同形导致的翻译循环（页面不报错但失去响应）、观察器在特定页面上持续重排；
- **扩展自身实现缺陷**：权限越界、向页面注入非预期内容、`chrome.storage` 数据的校验与边界处理缺陷等。

以下类型**不属于本项目**，请改投对应渠道：
- GitHub 站点自身的服务端漏洞、账号与认证问题、网页实现缺陷 → 报告给 GitHub 官方；
- 浏览器扩展机制本身的漏洞（Chrome / Edge、`chrome.storage`、MV3 运行时）→ 报告给对应浏览器厂商；
- 第三方依赖的漏洞（Bun、Biome、TypeScript 等开发工具链，它们不进入扩展产物）→ 报告给对应上游项目。

## 报告漏洞

请通过以下方式报告漏洞：
- **首选**：使用 GitHub 的私有漏洞报告功能——进入本仓库 **Security** 标签页 → **Report a vulnerability**，填写漏洞详情。该渠道对维护者与报告者均可见，漏洞细节不会公开暴露。
- **备选**：发送邮件至 `oppenheymu@gmail.com`（维护者联系邮箱），请在主题中注明「Security」。

报告后的流程与预期：
- 我们通常会在 **48 小时内**确认收到报告，并给出初步评估。
- 确认有效的问题将以补丁版本修复，并记录在对应版本的发布说明中；在修复落地前，我们不会公开漏洞细节，以免影响尚未升级的用户。
- 若报告被评估为不属于本项目范围（例如根因在 GitHub 站点或浏览器扩展机制），我们会说明原因，并建议改报到对应渠道。
- **请不要**在公开渠道（Issues、讨论区、社交媒体等）披露尚未修复的漏洞细节；如确需公开披露，请先联系我们并商定时间点。

---

<a id="english-version"></a>

# Security Policy

## Supported Versions

This repository holds the source of **GitHub UI Localization (Github-i18n)**, a browser extension (Chrome / Edge, Manifest V3, MIT) that localizes the GitHub web interface into multiple languages. It is not a redistribution of any upstream project, and security updates are provided for the current release line only.

| Version                                                                                                      | Supported                                                            |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 0.2.x (current release line)                                                                                 | Yes                                                                  |
| Versions before 0.2.0                                                                                        | No — please upgrade to 0.2.x and re-check whether the issue persists |
| The upstream GitHub site itself (the server-side and web implementation of `github.com` / `gist.github.com`) | No — out of scope for this project, report it to GitHub              |

Notes:
- **This extension has no npm artifact, and we do not accept reports about upstream GitHub itself.** The root `package.json` is marked `private`; the only distribution form is the browser extension (a `dist/` build from source, or a store package). There is no installable package version, and therefore no npm-side release line.
- This project is an independent community localization tool with no affiliation with or endorsement by GitHub, Inc. For issues in GitHub accounts, authentication, server-side APIs, or the GitHub web implementation, please use GitHub's own channels (GitHub Support or the GitHub Bug Bounty program).

## Attack Surface and Scope

The extension's capability envelope is deliberately narrow; the list below doubles as the criterion for whether a report is in scope:
- **Permissions**: `manifest.json` requests only `storage` (that is `chrome.storage.local`, used for the translation toggle, the target language, and the developer miss log). There is no `tabs`, `cookies`, `webRequest`, `scripting`, host permission, or any other permission.
- **Injection scope**: the content script is injected only on `https://github.com/*` and `https://gist.github.com/*`, at `document_start`; the popup opens only when the user clicks the toolbar icon. No other site is affected.
- **Everything it does to the page**: it walks the DOM read-only and rewrites text nodes plus the text of these attributes — `title`, `aria-label`, `placeholder`, `alt`, `value` on button-like `<input>` elements, and the Rails `data-disable-with` attribute. It does not restructure the page, does not inject remote code, and never treats page text as code (page text is only used as a dictionary lookup key).
- **No network behavior**: the extension makes **no network requests**, reads and writes **no cookies**, and **collects and uploads no user data**. Translation happens entirely in-browser from a dictionary bundled into the extension; text collected in developer mode (off by default) is written only to the local `chrome.storage.local` and leaves the browser only when the user copies it explicitly.

Accordingly, the following are **in scope** for this project — please report them as described in "Reporting a Vulnerability":
- **False positives**: a translation hits user content (code blocks, diffs, READMEs, comments, repository / file / user names) or changes page semantics, breaking forms and interactions;
- **Translation defects**: wrong entries, inconsistent terminology, mishandled placeholders or plural forms;
- **Freezes or performance anomalies**: for example a translation loop caused by an entry identical to its source string (the page reports no error but stops responding), or an observer that keeps re-walking a specific page;
- **Implementation flaws in the extension itself**: permission overreach, unexpected injection into the page, validation and boundary handling of `chrome.storage` data.

The following are **out of scope** — please use the corresponding channel instead:
- Server-side vulnerabilities of the GitHub site, account and authentication issues, or defects in the GitHub web implementation → report to GitHub;
- Vulnerabilities in the browser extension platform itself (Chrome / Edge, `chrome.storage`, the MV3 runtime) → report to the respective browser vendor;
- Vulnerabilities in third-party dependencies (Bun, Biome, TypeScript and other dev tooling, none of which ship in the extension artifact) → report to the respective upstream project.

## Reporting a Vulnerability

Please report vulnerabilities through the following channels:
- **Preferred**: use GitHub's private vulnerability reporting — go to the **Security** tab of this repository → **Report a vulnerability** and fill in the details. The channel is visible to maintainers and reporters only, and vulnerability details are not exposed publicly.
- **Alternative**: send an email to `oppenheymu@gmail.com` (the maintainers' contact address), with "Security" noted in the subject line.

What to expect after reporting:
- We typically **acknowledge receipt within 48 hours** and provide an initial assessment.
- Confirmed issues are fixed in a patch release and recorded in the release notes for that version; until the fix lands, we will not disclose details publicly, so that users who have not yet upgraded are not exposed.
- If the report is assessed as out of scope for this project (for example the root cause lives in the GitHub site or in the browser extension platform), we will explain why and suggest the appropriate channel.
- **Please do not** disclose details of unfixed vulnerabilities in public channels (Issues, discussions, social media, etc.); if public disclosure is genuinely needed, contact us first and agree on a timeline.
