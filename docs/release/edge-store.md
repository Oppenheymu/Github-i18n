# Edge Add-ons 上架筹备清单

> 状态：**未提交**。本文件是提交前的操作手册，不是已经发布的商店页面。
> 相关代码：`tooling/pipeline/build.ts`（生产构建）、`tooling/pipeline/pack.ts`（打包）、
> `public/manifest.json`（包内清单）、`PRIVACY.md`（隐私政策）。

## 0. 先看清楚现状（2026-11-09）

| 指标                     | 本仓库                                            | 对照：maboloshi/github-chinese（gh-pages，2026-11-08 推送） |
| ------------------------ | ------------------------------------------------- | ----------------------------------------------------------- |
| 唯一英文键               | **5,725**（canonical 槽位 6,658，跨模块重复 933） | **14,498**                                                  |
| 词条槽位（含跨模块复用） | 6,658                                             | 46,817（218 个去重模块）                                    |
| 共享正则规则             | 997                                               | 1,249 唯一正则 + 9 条 selector                              |
| 词条语言                 | zh-CN 100%、ja 100%；其余 8 种是 0% 空骨架        | zh-CN / zh-TW 两套                                          |
| 页面模块                 | 23 个模块（主站主要页面）                         | 281 个路由模块                                              |

**结论：词条数量并不比传统汉化项目多，约为其唯一键的 39.5%。** 这不是上架阻断项，但商店文案
不能写「词条最多 / 最全」；对外定位应是「词典内置、零网络、逐页实机校准」，并明确
「未覆盖的文案保留英文」。

已具备的上架条件：

- MV3、`permissions` 只有 `storage`、无后台 service worker、无远程代码；
- content script 只匹配 `github.com` 与 `gist.github.com`；
- 商店包由 `bun run pack` 生成，**默认走生产构建**：开发者模式 UI、漏翻采集器代码、
  `dev*` 文案全部从包内移除（`tooling/pipeline/build.test.ts` 有反向断言）；
- popup 只展示 `ready: true` 的语言（当前简中 / 日语），不会出现「选了没反应」的空语言；
- `bun run check` 全绿（1687 个用例）。

## 1. 构建与打包

```bash
bun install
bun run check          # 全量门禁必须全绿
bun run pack           # = build:prod + pack，产出 github-i18n-v<版本>.zip
```

- `bun run build` 是**开发构建**：保留 popup 的开发者模式与漏翻采集器，供本机排查漏翻；
- `bun run build:prod` 是**商店构建**：压缩产物、剥离开发者模式 UI / CSS / `_locales` 文案，
  并通过 `process.env.NODE_ENV` 常量折叠把 collector 从 JS 产物里 tree-shaking 掉；
- `bun run pack` 会先跑 `build:prod`，避免误把开发包传上商店；
- zip 根目录直接是 `manifest.json`，符合 Edge / Chrome 商店要求；当前 11 个文件、约 1.47 MB。

产物核对：

```bash
Get-ChildItem dist -Recurse -File
# 期望：content.js / popup.js / manifest.json / popup.html / icons/*.jpg / _locales/{en,ja,zh_CN}/messages.json
```

## 2. 版本号

当前 `package.json` / `public/manifest.json` / `public/popup.html` 的版本号都是 `1.0.0`
（2026-11-09 定为首个公开版本）。三处必须同步（`check:manifest` 会拦住不一致）。

改版本号前先确认商店后台没有同版本号的历史包。Edge 的版本号规则：1–4 段数字，每段 0–65535。
包内 `name` 与 `action.default_title` 走 `__MSG_appName__`，三种列表语言的 `appName` 都固定为
`Github-i18n`，不随浏览器语言变化。

## 3. 商店素材

| 素材       | 要求                                           | 当前状态                       |
| ---------- | ---------------------------------------------- | ------------------------------ |
| 扩展包图标 | manifest 里 16 / 32 / 48 / 128，JPEG 可用      | 已有 `public/icons/logo-*.jpg` |
| 商店 Logo  | 1:1，推荐 300×300，最小 128×128                | 已生成 `store/logo-300.png`    |
| 截图       | 640×480 或 1280×800，最多 6 张，可选但强烈建议 | **待采集**（见下）             |
| 小促销图   | 440×280，可选                                  | 未做                           |
| 大促销图   | 1400×560，可选                                 | 未做                           |
| 长描述     | 每种语言 ≥250 字符、≤10,000 字符               | 见下面的文案草稿               |
| 短描述     | 即 manifest `description`，当前 123 字符       | 已满足（≤132）                 |

### 截图采集建议

截图必须在**未加载本扩展**的干净页面先截英文、再加载扩展截中文，或直接截「已翻译」的页面
（商店要展示效果，展示中文/日文界面即可）。推荐 3 张：

1. 仓库首页（导航 + 仓库头部 + 文件列表）；
2. Issue / PR 列表（状态、筛选、计数）；
3. popup（开关 + 语言选择器），用 1280×800 画布留白。

不要截登录态里的私人仓库名、邮箱、token；用公开仓库或测试账号。

## 4. 商店文案草稿

### 英文（en）

**Short description（manifest，123 字符）：**

> Localize the GitHub interface with a built-in dictionary, entirely on your device. No network requests, no data collection.

**Description（≥250 字符）：**

> Github-i18n translates the GitHub web interface on your device, using a dictionary that ships inside the extension. Nothing is fetched from a server, nothing is uploaded, and no account is required.
>
> • Built-in dictionary — translations are bundled with the extension, so pages never wait for a network round trip.
> • Page-aware — entries are routed by page module, so a word can mean different things on different GitHub screens.
> • Content-safe — code blocks, diffs, the editor, READMEs and issue bodies are skipped as whole blocks; only interface text is translated.
> • Follows the SPA — GitHub's Turbo navigation is observed, so you do not need to refresh after moving between pages.
> • Two fully translated target languages today: Simplified Chinese and Japanese. More languages are in progress; untranslated text stays in English rather than showing machine output.
> • Zero collection — the store build contains no analytics, telemetry, or miss collector.
>
> This is an independent community project. It is not affiliated with, endorsed by, or sponsored by GitHub, Inc. GitHub is a trademark of GitHub, Inc.

### 简体中文（zh-CN）

**短描述：**

> 用内置词典在本地翻译 GitHub 界面，全程零网络请求、零数据收集。

**长描述：**

> 「Github-i18n」在您的设备上翻译 GitHub 网页界面，词典随扩展一起发布：不请求服务器、不上传数据、不需要账号。
>
> • 内置词典——译文随扩展打包，页面不需要等待网络往返。
> • 按页面分模块——同一个词在不同 GitHub 页面可以有不同的译法。
> • 不碰内容——代码块、diff、编辑器、README 与 issue 正文整块跳过，只翻译界面文案。
> • 跟随 SPA——监听 GitHub 的 Turbo 导航，切换页面后无需手动刷新。
> • 当前完整支持简体中文与日语；其它语言正在筹备，未覆盖的文案保留英文，不用机翻凑数。
> • 零收集——商店包不含统计、遥测或漏翻采集器。
>
> 本项目是独立社区项目，与 GitHub, Inc. 无隶属、背书或赞助关系。GitHub 是 GitHub, Inc. 的商标。

### 日本語（ja）

**短説明：**

> 内蔵辞書で GitHub の画面を端末内だけでローカライズ。通信もデータ収集も行いません。

**長説明：**

> 「Github-i18n」は、拡張機能に同梱した辞書を使って GitHub の Web インターフェースを端末内で翻訳します。サーバーへの問い合わせも、データの送信も、アカウントも不要です。
>
> • 内蔵辞書 — 翻訳は拡張機能に同梱され、ページはネットワーク待ちをしません。
> • ページ別の辞書 — 画面ごとにモジュールを分け、同じ語でも文脈に合った訳を当てます。
> • コンテンツを壊さない — コードブロック、diff、エディター、README、issue 本文はまるごと対象外。翻訳するのは UI の文言だけです。
> • SPA に追従 — GitHub の Turbo ナビゲーションを監視するため、ページ移動後の再読み込みは不要です。
> • 現在フル対応なのは簡体字中国語と日本語のみ。他の言語は準備中で、未翻訳の文言は英語のまま表示します。
> • 収集ゼロ — ストア版には解析・テレメトリー・翻訳漏れ収集は含まれません。
>
> 本プロジェクトは独立したコミュニティプロジェクトです。GitHub, Inc. との提携・承認・スポンサー関係はありません。GitHub は GitHub, Inc. の商標です。

## 5. 隐私问卷怎么填

Partner Center → **Privacy**。下面四段可以直接复制（英文是后台语言；中文只是解释）：

### Single purpose description

```text
Localize the GitHub web interface into the user's chosen language using a dictionary bundled with the extension. This is the extension's only purpose: it does not translate other websites and does not provide general-purpose translation. All processing runs locally on the user's device; no page content is sent anywhere, no analytics are used, and no account is required.
```

### storage justification

```text
Used only to remember the user's settings: whether translation is enabled and, optionally, which target language to use. These values are stored locally in chrome.storage.local. No browsing history, page content, credentials, or personal information is stored.
```

### Host permission justification（如果后台单独出现 github.com / gist.github.com 的必填项）

```text
The content script runs only on https://github.com/* and https://gist.github.com/* to read interface text and replace it with the bundled translation. It does not transmit page content; all processing is local.
```

### Are you using remote code?

选 **No, I am not using remote code**。下面的 **Justification** 可留空；如果后台强制要求，填：

```text
No remote code is used. All extension code and dictionaries are bundled in the package, and the extension makes no network requests.
```

### 其它

- **Data usage**：全部不勾选。生产包没有采集器，`PRIVACY.md` 与包行为一致。
- **Privacy policy URL**：`https://github.com/Oppenheymu/Github-i18n/blob/main/PRIVACY.md`
  （提交前确认该文件已推送到默认分支，且匿名窗口可访问）。

## 6. 提交前检查清单

- [ ] `bun run check` 全绿；
- [ ] `bun run pack` 成功，zip 根目录有 `manifest.json`；
- [ ] `dist/popup.html` 不含 `Developer mode` / `dev-toggle` / `dev-panel`；
- [ ] `dist/_locales/*/messages.json` 不含 `dev*` 键；
- [ ] `dist/content.js` 不含 `devMode` / `missLog` / `github-zh-misses`；
- [ ] 版本号三处同步；
- [ ] `PRIVACY.md` 已推送，URL 可匿名访问；
- [ ] 在真实 Edge（未加载其他汉化扩展）里 `edge://extensions` → 加载 `dist/`，逐项手测：
  - [ ] 登录态仓库首页 / issue 列表 / PR 列表 / 设置页；
  - [ ] 关闭再开启总开关（应整页刷新）；
  - [ ] 语言选择器只有「自动 / 简体中文 / 日本語」；
  - [ ] 选择日语后整页刷新且界面变日语；
  - [ ] gist.github.com 页面不报错；
  - [ ] 暗色 / 亮色主题下 popup 均可读；
  - [ ] 断网后仍能翻译（证明无网络依赖）；
- [ ] 商店素材：300×300 logo、≥1 张截图、长描述 ≥250 字符；
- [ ] 商标声明：商店长描述与 README 都写明「not affiliated with GitHub, Inc.」。

## 7. 逐步发布流程（Partner Center）

> 官方文档：[Register as a Microsoft Edge extension developer](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account)、
> [Publish a Microsoft Edge extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)。
> Edge 开发者注册**免费**；个人账号验证比公司账号快。

### 7.1 注册开发者账号

1. 打开 [Partner Center（Edge 入口）](https://partner.microsoft.com/dashboard/microsoftedge/public/login)，用 Microsoft 账号登录；没有 MSA 可以用 GitHub 账号登录并自动创建。
2. 进入 **Account settings | Programs**，在 **Microsoft Edge** 卡片点 **Get started**。
3. 填 **Account country/region**（提交后只读）、**Account type** 选 **Individual**、**Publisher display name**（最多 50 字符，建议 `Oppenheymu` 或项目名）、联系方式。
4. 勾选接受 **App Developer Agreement**，点 **Finish**。
5. 等验证邮件；验证期间就可以先准备扩展包与商店素材。

### 7.2 创建扩展并上传包

1. Partner Center → **Microsoft Edge** → **Create new extension**。
2. 上传 `bun run pack` 生成的 `github-i18n-v<版本>.zip`；等待包校验通过。
3. 在 **Extension overview** 核对名称、版本、权限；有问题回代码改，重新 `pack` 再传。

### 7.3 Availability

- **Visibility**：首次发布选 **Public**；
- **Markets**：默认全部市场即可。

### 7.4 Properties

- **Category**：Productivity（或 Developer tools，按你希望被搜到的场景选）；
- **Website**：`https://github.com/Oppenheymu/Github-i18n`；
- **Support contact detail**：`https://github.com/Oppenheymu/Github-i18n/issues`；
- **Mature content**：不勾。

### 7.5 Privacy

按第 5 节的四项填写。重点：

- **Single Purpose** 只写「本地翻译 GitHub 界面」，不要写成通用翻译器；
- 权限只解释 `storage` 与 `github.com` / `gist.github.com` 的 content script；
- **Remote code** 选 **No**；
- **Data usage** 全部不勾；
- 隐私政策 URL 填 `https://github.com/Oppenheymu/Github-i18n/blob/main/PRIVACY.md`。

### 7.6 Store listing

`manifest.json` 用了 `__MSG_appName__` / `__MSG_appDesc__`，Partner Center 会自动识别 `_locales` 里的 **en、ja、zh_CN** 三种列表语言。每种语言都需要：

- **Description**：≥250 字符（第 4 节已给草稿）；
- **Extension logo**：上传 `store/logo-300.png`，可点 **Duplicate** 复制到其它语言；
- **Screenshots**：至少 1 张，推荐 3 张，尺寸 1280×800 或 640×480；
- **Short description**：来自 manifest，只读，当前 123 字符；
- **Search terms**：`GitHub 汉化`、`GitHub 中文`、`GitHub translation`、`GitHub localization` 等（最多 7 条、合计 21 词、每条 ≤30 字符）。

### 7.7 提交审核

1. 点 **Publish**，在 **Notes for certification** 粘贴下面这段（按需改仓库链接）：

   ```text
   This extension translates GitHub interface text locally with a bundled dictionary.
   No network requests, no account, and no data collection.

   How to test:
   1. Install the extension and open https://github.com (no login required).
   2. Click the toolbar icon; the toggle should show Enabled.
   3. Switch the target language between Simplified Chinese and Japanese; the page reloads and UI text changes.
   4. Turn the toggle off; the page reloads and returns to English.

   The store package contains no developer mode and no miss collector.
   ```

2. 提交后状态进入 **Certification**，官方说明最长约 7 个工作日；通过后状态变 **In the Store**。
3. 被拒时按 Partner Center 的反馈改代码 / 文案，重新 `pack` 上传；不要改版本号复用同一个包。

### 7.8 后续更新

1. 改代码 / 词典后，把 `package.json`、`public/manifest.json`、`public/popup.html` 的版本号一起加一；
2. `bun run check` → `bun run pack`；
3. Partner Center → **Packages** → 上传新 zip → 更新 listing（如需要）→ **Publish**；
4. 已安装用户会在商店审核通过后收到更新。

### 7.9 Chrome Web Store（可选）

同一个 zip 可以直接传 Chrome Web Store；需要单独注册 Chrome 开发者账号（一次性注册费，以官方页面为准），并重新填一遍 listing / 隐私问卷。Edge 先发、Chrome 后发可以减少一次审核等待。

## 8. 已知边界（不是上架阻断项，但审核/用户可能问）

- **词典规模小于传统汉化项目**：唯一键 5,725 vs 14,498；不要宣传「最全」。
- **8 种语言是空骨架**：popup 已隐藏，`LOCALES` / registry 仍保留，覆盖率报告会显示 0%。
- **没有自动化实机探针**：`tooling/verify-live.ts` 已于 `48bf519` 删除，当前只有手工浏览；
  商店审核问「如何测试」时，按第 6 节的清单回答。
- **GitHub 改版会导致漏翻 / 误伤**：这是静态词典的常态，商店描述已写明「未覆盖文案保留英文」。
- **图标是 JPEG**：Chrome / Edge 接受 JPEG；如果审核要求 PNG，用 `public/icons/*.jpg` 重新导出
  同名 PNG 并同步 `manifest.json` / `popup.html` / `check:manifest` 的断言。
