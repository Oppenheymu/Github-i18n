# 隐私政策 / Privacy Policy

**Github-i18n**
生效日期：2026-11-09

## 简体中文

### 1. 我们不收集数据

商店发布包（`bun run pack` 产出的 zip）**不包含**任何数据采集代码：

- 不收集、不上传、不同步任何个人信息或浏览内容；
- 不发起任何网络请求（没有统计、没有遥测、没有远程配置、没有远程代码）；
- 没有账号体系，也不需要登录。

扩展只在本机 `chrome.storage.local` 保存两项设置：

| 键        | 用途                               | 是否可清除         |
| --------- | ---------------------------------- | ------------------ |
| `enabled` | 翻译总开关                         | popup 里随时可关   |
| `locale`  | 用户手动选择的翻译目标语言（可选） | 选择「自动」即删除 |

这两项设置只用于让扩展记住你的选择，不会被发送到任何地方。

### 2. 权限说明

- `storage`：保存上面两项本地设置；
- `https://github.com/*`、`https://gist.github.com/*` 的 content script：在页面内读取界面文本并写回译文。所有翻译都在你的设备上完成，页面内容不会离开浏览器。

### 3. 开发构建中的漏翻采集器

源码仓库的开发构建（`bun run build`，不从商店安装）保留一个可选的「开发者模式」漏翻采集器，用于维护者改进词典。它默认关闭，开启后只把未命中的界面文本写入本机 `chrome.storage.local`，**不上传、不同步、不下载**；商店包在构建时已把该模式及其代码整体移除。普通用户从商店安装的版本不存在该功能。

### 4. 第三方

本扩展不集成任何第三方分析、广告或数据服务，也不包含远程托管的代码。

### 5. 变更与联系

隐私政策如有变更，会更新本文件与生效日期。问题或建议请到
[GitHub 仓库](https://github.com/Oppenheymu/Github-i18n) 提交 issue。

---

## English

### 1. No data collection

The store package produced by `bun run pack` contains **no data-collection code**:

- It does not collect, upload, or sync any personal information or browsing content.
- It makes no network requests: no analytics, telemetry, remote configuration, or remote code.
- There is no account system and no sign-in.

The extension stores only two settings locally in `chrome.storage.local`:

| Key       | Purpose                                | Removal                    |
| --------- | -------------------------------------- | -------------------------- |
| `enabled` | Master translation switch              | Toggle off in the popup    |
| `locale`  | Optional target language chosen by you | Choose "Automatic" to drop |

These settings only let the extension remember your choice. They are never sent anywhere.

### 2. Permissions

- `storage`: saves the two local settings above.
- A content script on `https://github.com/*` and `https://gist.github.com/*`: reads interface text in the page and writes translations back. All translation happens on your device; page content never leaves the browser.

### 3. Miss collector in development builds

The source repository's development build (`bun run build`, not installed from a store) keeps an optional "developer mode" miss collector that maintainers use to improve the dictionary. It is off by default. When enabled, it writes unmatched interface text only to local `chrome.storage.local`; it never uploads, syncs, or downloads anything. Store packages are built with that mode and its code removed entirely. Users who install from a store do not have this feature.

### 4. Third parties

This extension integrates no third-party analytics, advertising, or data services, and contains no remotely hosted code.

### 5. Changes and contact

If this policy changes, this file and the effective date will be updated. For questions or reports, open an issue in the
[GitHub repository](https://github.com/Oppenheymu/Github-i18n).
