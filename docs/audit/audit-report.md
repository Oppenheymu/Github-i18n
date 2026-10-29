# Github-i18n 项目审计报告

审计对象：`C:\Dev\Tool-Dev\Github-i18n`（扩展显示名「GitHub 界面本地化」，MV3 浏览器扩展，MIT）
审计基线：`main` @ `71ba590`（2026-09-26，共 82 次提交）
审计日期：2026-09-26
审计方式：全量门禁实跑 + 源码逐文件精读 + 词典数据脚本化统计 + DOM 语义静态推断（未启动浏览器）

---

## 0. 项目文件树

> 生成方式：递归枚举仓库内所有文件（排除 `node_modules/`、`.git/`、`dist/`、`.zcode/`），目录在前、同级按名称排序。`dist/` 与 `*.zip` 是本地构建产物，已被 `.gitignore` 排除，故不入本树。

```text
Github-i18n/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── triage.yml
│   ├── labeler.yml
│   └── SECURITY.md
├── .vscode/
│   ├── extensions.json
│   └── settings.json
├── docs/
│   ├── audit/
│   └── guides/
│       └── development.md
├── public/
│   ├── _locales/
│   │   ├── en/
│   │   │   └── messages.json
│   │   ├── ja/
│   │   │   └── messages.json
│   │   └── zh_CN/
│   │       └── messages.json
│   ├── icons/
│   │   ├── logo-128.jpg
│   │   ├── logo-16.jpg
│   │   ├── logo-32.jpg
│   │   └── logo-48.jpg
│   ├── manifest.json
│   └── popup.html
├── src/
│   ├── content/
│   │   ├── __tests__/
│   │   │   ├── collector.test.ts
│   │   │   ├── filters.test.ts
│   │   │   ├── settings-accessibility.test.ts
│   │   │   ├── settings-admin.test.ts
│   │   │   ├── settings-appearance.test.ts
│   │   │   ├── settings-billing.test.ts
│   │   │   ├── settings-notifications.test.ts
│   │   │   ├── view.test.ts
│   │   │   └── walker.test.ts
│   │   ├── collector.ts
│   │   ├── engine.ts
│   │   ├── filters.ts
│   │   ├── index.ts
│   │   ├── pages.ts
│   │   ├── view.ts
│   │   └── walker.ts
│   ├── dict/
│   │   ├── core/
│   │   │   ├── aliases.jsonc
│   │   │   ├── canonical.jsonc
│   │   │   ├── modules.jsonc
│   │   │   └── rules.jsonc
│   │   ├── locales/
│   │   │   ├── ja/
│   │   │   │   ├── pages/
│   │   │   │   │   └── issues.jsonc
│   │   │   │   ├── global.jsonc
│   │   │   │   └── rules.jsonc
│   │   │   └── zh-CN/
│   │   │       ├── pages/
│   │   │       │   ├── actions.jsonc
│   │   │       │   ├── agents.jsonc
│   │   │       │   ├── commits.jsonc
│   │   │       │   ├── dashboard.jsonc
│   │   │       │   ├── discussions.jsonc
│   │   │       │   ├── insights.jsonc
│   │   │       │   ├── issues.jsonc
│   │   │       │   ├── marketing.jsonc
│   │   │       │   ├── profile.jsonc
│   │   │       │   ├── pulls.jsonc
│   │   │       │   ├── repo-settings.jsonc
│   │   │       │   ├── repo.jsonc
│   │   │       │   ├── search.jsonc
│   │   │       │   ├── settings-billing.jsonc
│   │   │       │   ├── settings.jsonc
│   │   │       │   └── wiki.jsonc
│   │   │       ├── global.jsonc
│   │   │       └── rules.jsonc
│   │   ├── types/
│   │   │   ├── dict.schema.json
│   │   │   └── jsonc.d.ts
│   │   ├── index.ts
│   │   ├── load.ts
│   │   ├── locales.ts
│   │   └── registry.ts
│   ├── popup/
│   │   └── popup.ts
│   └── shared/
│       ├── identity.ts
│       ├── storage.ts
│       └── types.ts
├── tooling/
│   ├── checks/
│   │   ├── __tests__/
│   │   │   ├── dict.test.ts
│   │   │   ├── manifest.test.ts
│   │   │   └── view.test.ts
│   │   ├── dict.ts
│   │   ├── manifest.ts
│   │   └── view.ts
│   ├── fixtures/
│   │   ├── view-skeleton.ja.json
│   │   └── view-skeleton.zh-CN.json
│   ├── pipeline/
│   │   ├── build.ts
│   │   ├── pack.test.ts
│   │   └── pack.ts
│   └── tsconfig.json
├── .editorconfig
├── .gitattributes
├── .gitignore
├── AGENTS.md
├── biome.json
├── bun.lock
├── LICENSE
├── NOTICE
├── package.json
├── README.md
└── tsconfig.json
```

统计：源码/配置/文档共 **91 个受版本控制的关注文件**（`.ts` 34、`.jsonc` 25、`.json` 13、`.md` 4、`.yml` 3、`.jpg` 4、其余 8）。

---

## 1. 审计范围、方法与实测基线

### 1.1 覆盖的审计面

| 维度       | 覆盖内容                                                                       |
| ---------- | ------------------------------------------------------------------------------ |
| 构建与产物 | `tooling/pipeline/build.ts`、`pack.ts`、`pack.test.ts`、`dist/` 产物实测       |
| 门禁与测试 | `tooling/checks/{dict,manifest,view}.ts` + 其测试、`bun run check` 全链路实跑  |
| 运行时引擎 | `src/content/*`（入口、调度、遍历、过滤、视图合并、漏翻收集）                  |
| 词典数据   | `core/` 4 件 + `locales/{zh-CN,ja}` 19 件，2087 槽位逐条脚本化统计             |
| 扩展外壳   | `public/manifest.json`、`popup.html`、`_locales/*`、`src/popup`、`src/shared`  |
| 安全与权限 | 注入面、XSS 面、CSP、供应链、CI 权限与第三方 action                            |
| 工程配置   | 两份 `tsconfig`、`biome.json`、`.editorconfig`、`.gitattributes`、`.gitignore` |
| 文档一致性 | `AGENTS.md`、`README.md`、`docs/guides/development.md`、`.github/SECURITY.md`  |

### 1.2 实测基线（本次真实执行结果）

| 门禁                                                     | 结果                                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| `bun install --frozen-lockfile`                          | 通过（39 包，lockfile 无漂移）                                             |
| `bunx biome check .`                                     | **exit 0**，23 条 info（`lint/complexity/useLiteralKeys`，全部可安全忽略） |
| `bunx tsc -p tsconfig.json` / `-p tooling/tsconfig.json` | 双双 exit 0                                                                |
| `bun tooling/checks/dict.ts`                             | 通过：17 模块 / 2087 规范键 / 447 共享规则 / 2137 译文                     |
| `bun tooling/checks/manifest.ts`                         | 通过（资产引用、产物映射、`_locales` 键集合一致）                          |
| `bun tooling/checks/view.ts`                             | 通过：zh-CN / ja 各 33 条探针路径骨架一致                                  |
| `bun test`                                               | **189 pass / 0 fail**，13 文件，1603 次断言                                |
| `bun run build`                                          | 通过：11 个产物文件，`content.js` 297,543 B、`popup.js` 10,758 B           |
| `bun run pack`                                           | 通过：11 条目 zip，329,773 B，store 模式                                   |

覆盖率：**zh-CN 2087/2087（100.0%）**；ja 50/2087（2.4%，16 模块待译）。

结论：**当前 `main` 的门禁全绿，工程质量基线明显高于同类扩展项目**。以下问题均不影响「现有测试通过」这一事实，属于「测试与门禁没覆盖到的角落」。

### 1.3 口径澄清（本次实测，用于校准后续数字）

- `canonical.jsonc` 的 **2087** 是「模块 × 键」**槽位数**，去重后唯一键为 **2021**（63 个键被 ≥2 个模块登记，冗余 66 槽）。项目内所有「覆盖率 100%」均以槽位为分母，这是合理口径，但报告与文档都应明确写清。
- 视图骨架快照记录 **17 个碰撞键**，其中「胜出模块随路径不同」的真同键异译只有 **2 个**（`Actions`、`Pages`）；`registry.ts:28` 注释写的「现在是 16 处」两种口径都对不上（详见 L-04）。

---

## 2. 总体结论

**综合评级：良好（B+）**。这是一个纪律性很强的项目：分层清晰（语言无关数据 / 按语言译文 / 运行时 / 门禁分离）、门禁有真实拦截力（结构编译、交叉引用、防循环、覆盖率、视图骨架快照）、TypeScript 严格全家桶零缺失、无网络请求、无 XSS 面、无 git 误提交产物。

**但存在 3 类必须修的问题**：
1. **1 处严重**：`.github/SECURITY.md` 整篇是从另一个项目（Koishi-CE）错误复制的内容，会让漏洞报告者被引向错误的上游项目 —— 安全流程事实上失效。
2. **3 处确定性数据缺陷**：词典里有 1 条键内嵌真实换行（**永不命中**，却计入 100% 覆盖率）、2 条 DOM 中不存在的伪键、1 条可达碎片的译文语法不通。它们证明「100% 覆盖率」目前**是虚高的**。
3. **2 处结构性缺陷**：`pages/repo` 路由 `^/[^/]+/[^/]+` 把 **84 条仓库专属词条**注入到 `/settings/**` 用户设置页；CI **不跑 `build`**，构建链损坏可以全绿合入。

另有若干中等风险（全局短键误伤面、`aliases` 机制零使用却仍被文档宣传、`_locales` 占位符缺一致性门禁、测试覆盖不均、文档数字大面积过期）与一批低风险整洁性问题，见第 4 节。

### 2.1 问题分级总览

| 编号 | 级别 | 问题                                                                       | 位置                                                                                   |
| ---- | ---- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| H-01 | 高   | `SECURITY.md` 是 Koishi-CE 的安全政策（项目身份完全错）                    | `.github/SECURITY.md:7`、`:9-14`、`:38-45`                                             |
| H-02 | 高   | 1 条键内嵌真实换行 → 永不命中，覆盖率虚高                                  | `src/dict/core/canonical.jsonc:1304`、`src/dict/locales/zh-CN/pages/insights.jsonc:36` |
| H-03 | 高   | 2 条伪键 + 1 条可达碎片译文语法不通、注释与值矛盾                          | `canonical.jsonc:216-217`、`settings.jsonc:44-49`                                      |
| H-04 | 高   | `pages/repo` 路由重叠：84 条仓库词条注入 `/settings/**`                    | `src/dict/core/modules.jsonc:74-77`                                                    |
| H-05 | 高   | CI 不跑 `build`/`pack`，构建链损坏可全绿合入                               | `.github/workflows/ci.yml:13-22`                                                       |
| M-01 | 中   | `aliases` 机制零使用（空对象），文档仍宣传为「O(1) 改名通道」              | `src/dict/core/aliases.jsonc:12`；`development.md:116-132`                             |
| M-02 | 中   | 142 个站点级单 token 键 + 用户内容无排除，误伤面实存                       | `locales/zh-CN/global.jsonc`、`pages/repo.jsonc`                                       |
| M-03 | 中   | `_locales` 只校验键集合，占位符丢失不被发现                                | `tooling/checks/manifest.ts:108-163`、`src/popup/popup.ts:31-43`                       |
| M-04 | 中   | 测试覆盖不均：`storage.ts`/`locales.ts` 零覆盖，15/17 模块无节点边界测试   | `src/shared/storage.ts`、`src/dict/locales.ts`、`src/content/__tests__/`               |
| M-05 | 中   | `rules.jsonc:774` 死规则（与 `:119` pattern 与模板完全相同）               | `src/dict/core/rules.jsonc:119`、`:774`                                                |
| M-06 | 中   | 第三方 action 未 pin SHA；`ci.yml` 无 `permissions`                        | `ci.yml:14,16`、`triage.yml:49`                                                        |
| M-07 | 中   | `bun run verify` 死脚本 + 4 处残留引用；`identity.ts` 已无消费者           | `package.json:19`、`development.md:293`、`identity.ts:2`、`content/index.ts:27`        |
| M-08 | 中   | 文档数字大面积过期，含决策依据（包体体积）失真                             | `development.md:97,243-249,325`、`AGENTS.md:62`                                        |
| M-09 | 中   | `bunx tsc` 存在从网络拉取并执行未锁定 tsc 的回退路径                       | `package.json:14`                                                                      |
| L-01 | 低   | 行走器无记忆化，每次 flush 重算全部属性查询                                | `src/content/walker.ts:115-152`                                                        |
| L-02 | 低   | `Pages→页码` 等全局短键覆盖 GitHub Pages 语义；术语三套并存                | `global.jsonc:334`、`marketing.jsonc:88,338,347`                                       |
| L-03 | 低   | 译文标点/空格小疵 3 处                                                     | `global.jsonc:318`、`repo.jsonc:48`、`repo.jsonc:93-94`                                |
| L-04 | 低   | 注释/数字陈旧（同键异译「16 处」、探针「27×1618」）                        | `registry.ts:28`、`tooling/checks/view.ts:3`、`tooling/tsconfig.json:2`                |
| L-05 | 低   | 注入面覆盖全部 `github.com` + `gist.github.com`（含登录/OAuth 页）         | `public/manifest.json:18-27`                                                           |
| L-06 | 低   | `action.default_title: "__MSG_appName__"` 疑似不被替换；门禁给了虚假安全感 | `public/manifest.json:15`、`tooling/checks/manifest.ts:248-265`                        |
| L-07 | 低   | `popup.html` 版本号硬编码，无门禁校验                                      | `public/popup.html:183`                                                                |
| L-08 | 低   | `build.ts` 重命名硬编码、无产物集合断言                                    | `tooling/pipeline/build.ts:21-23,43-45`                                                |
| L-09 | 低   | `pack.ts` 缺 zip 上限校验、CRC 重复计算、非可复现构建                      | `tooling/pipeline/pack.ts:85-162`                                                      |
| L-10 | 低   | 无 dependabot/renovate；devDeps 用 `^` 区间                                | `package.json:22-27`                                                                   |
| L-11 | 低   | `docs/guides/development.md:249` 死图引用（图已在 `71ba590` 删除）         | `development.md:249`                                                                   |
| L-12 | 低   | 文档把图标写成 PNG（实为 JPG）                                             | `development.md:15,73`                                                                 |

---

## 3. 高危问题详述（含证据与影响）

### H-01 `.github/SECURITY.md` 是另一个项目的安全政策

**证据**（原文）：
- `.github/SECURITY.md:7`：「本项目是 [Koishi](https://koishi.chat) 的社区再发行版（Community Edition），核心与 webui 合并重构的单一 monorepo，发布包位于 npm 作用域 `@koishi-ce`。」
- `.github/SECURITY.md:9-14`：版本支持表全部是 `@koishi-ce/koishi`、`@koishi-ce/loader`、`@koishi-ce/plugin-console`、`koishi-shim` 等包名。
- `.github/SECURITY.md:38-45`：英文版同样自称 Koishi 社区再发行版。

**影响**：本仓库是 MV3 浏览器扩展（无 npm 发布物、无 monorepo、无 1.x 版本线）。任何想报告漏洞的人（尤其是浏览器商店/安全研究者）会读到「这是 Koishi 的社区版」，从而把漏洞报告给**错误的上游项目**或直接放弃报告；同时该文件给出了错误的安全承诺与升级指引。这是**安全响应流程的事实性失效**，不是代码漏洞，但优先级最高——修复成本极低（重写一页）。

**建议**：按本仓库重写。保留 `:20-21` 的私有漏洞报告渠道与邮箱，支持版本改为「0.2.x（当前线）」，删除全部 Koishi/npm 内容。

### H-02 词典中 1 条键内嵌真实换行，永不命中且使覆盖率虚高

**证据**：
- `src/dict/core/canonical.jsonc:1304`：`"Any repository that has not been created or\n    updated during this period will be excluded.",`（JSONC 里是真实换行，非 `\n` 两字符）
- `src/dict/locales/zh-CN/pages/insights.jsonc:36`：同名键带同样换行，译文「在此期间未创建或未更新的仓库将被排除。」
- 引擎查键前先归一化：`src/content/walker.ts:82-84` 的 `normalizeKey` 做 `trim()` + `/\s+/g → " "`，而 `lookup()`（`walker.ts:45-54`）用归一化结果去命中**原始键**。

**影响**：归一化后的文本永远不含换行符，因此这条键**永远不可能命中**——`/owner/repo/pulse`、`/forks` 等页面上的过滤说明句在实机永远不会被翻译。更严重的是它**仍然被计入「2087/2087 = 100%」**，即「覆盖率 100%」这一项目核心指标目前是虚高的。core 与 locale 两侧写的是同一个错键，所以 `check:dict` 的交叉引用门禁无法发现；`pages/insights` 又是 15 个没有节点边界测试的模块之一，因此无回归保护。

**建议**：把两侧键改为单空格形式（同时保留对「源码换行缩进」的归一化兼容），并为 `pages/insights` 补 `src/content/__tests__/<页名>.test.ts` 节点边界测试。更根本的加固：在 `check:dict` 增加一条断言——**任何 canonical 键都不得含 `\s` 之外的不可归一化字符，且键必须满足 `normalizeKey(键) === 键`**，这样同类错误会当场红灯。

### H-03 2 条伪键 + 1 条可达碎片的译文语法不通

**证据**（`canonical.jsonc:213-217` 与 `settings.jsonc:43-49`）：

```jsonc
// canonical.jsonc
// 两种片段边界各收一条，兼容源码换行缩进落在哪一侧
"your company’s GitHub organization to link it.",
"other your company’s GitHub organization to link it.",     // ← 伪键
"your your company’s GitHub organization to link it.",      // ← 伪键

// zh-CN/pages/settings.jsonc
// 译文以「公司」收尾，与链接/加粗节点衔接自然      ← 与下面第 47 行的值自相矛盾
"You can @mention your company’s GitHub organization to link it.": "你可以 @提及公司的 GitHub 组织来链接它。",
"your company’s GitHub organization to link it.": "的 GitHub 组织，以便链接它。",   // ← 可达但开头是「的」
"other your company’s GitHub organization to link it.": "其他公司的 GitHub 组织来链接它。",  // ← 死键，译文却是对的
"your your company’s GitHub organization to link it.": "你公司的 GitHub 组织来链接它。",    // ← 死键，译文却是对的
```

**影响**：
- `:216`、`:217` 两条键是「把 `other users and organizations to link to them.` 做全局字符串替换」时残留首词（`other ` / `your `）产生的，**DOM 中不存在**，属纯死键，白占 canonical 覆盖率分母。
- `:215` 是**可达碎片**（`<strong>@mention</strong>` 把句子切成三段），但它的译文以「的」开头，与前置节点拼出来是「你可以 @提及 **的 GitHub 组织，以便链接它。**」——语法不通。而两条**正确的**译文恰好挂在两条死键上。
- 同一个注释块（`:44-45`）声称「译文以「公司」收尾」，与实际值（以「的」开头）矛盾，说明这次改动本身就没做完。

**建议**：实机抓取 `/settings/profile` 的 Company 提示句节点边界后（开发者模式 + 手工浏览），删掉两条伪键、修正可达碎片的译文与注释。

### H-04 `pages/repo` 路由重叠：84 条仓库专属词条注入 `/settings/**`

**证据**：`src/dict/core/modules.jsonc:74-77` 中 `pages/repo` 的路由是 `^/[^/]+/[^/]+`，任何「两段以上」路径都会被命中，包括 `/settings/profile`、`/settings/appearance`、`/settings/notifications`、`/settings/billing/**`。

实测（用仓库自身的 `buildView` + 真实词典）：

```text
/settings/profile      => 命中模块: pages/settings + pages/repo + global
   仅 pages/repo 提供的词条数: 86 | 在该路径实际生效: 84
   样例: Code=代码 , Clone=克隆 , Download ZIP=下载 ZIP , Open with GitHub Desktop=… ,
         Go to file=转到文件 , Add file=添加文件 , Create new file=创建新文件 , Upload files=上传文件
```

`/microsoft/vscode` 命中 `pages/repo` 是设计意图，但 `/settings/*` 是**用户账号设置页**，不是仓库页。`tooling/fixtures/view-skeleton.*.json` 把这一命中序列（`pages/settings + pages/repo + global`）作为「正确基线」固化下来，因此**门禁把错误当成了事实**。`registry.ts:17-19` 的注释说明顺序设计是「具体页在前、泛化页在后」，但 `pages/repo` 的 pattern 本身没有排除保留路径，属实现缺陷。

**影响**：84 条仓库页词汇（`Code`/`Clone`/`Blame`/`Raw`/`Release`/`Deployments`…）在用户设置页具备生效资格，任意一处文本恰好等于这些短词就会被替换成仓库语义词；同时它显著放大了 M-02 的短键误伤面。

**建议**：给 `pages/repo` 的 route 加负向前瞻，排除保留的顶层段，例如 `^\/(?!settings(?:\$|\/))[^\/]+\/[^\/]+`（已实测：`/settings/*` 全部不命中，`/microsoft/vscode` 照常命中），然后 `bun run check:view --update` 重生成快照并说明原因。

### H-05 CI 不跑 `build` / `pack`，构建链损坏可全绿合入

**证据**：
- `.github/workflows/ci.yml:13-22` 只有 4 步：checkout → setup-bun → `bun install --frozen-lockfile` → `bun run check`。`bun run check`（`package.json:11`）是 `lint + typecheck + check:dict + check:manifest + check:view + test`，**不含构建**。
- `tooling/checks/manifest.ts:370`：`distDir: existsSync(distDir) ? distDir : null`；`:339-346` 只在 `distDir !== null` 时才断言「dist/ 里的产物存在」。

**实测确认**：把 `dist/` 临时改名后跑 `bun tooling/checks/manifest.ts`，**仍然 exit 0**（「manifest 门禁通过」）。也就是说在干净 CI 环境（无 `dist/`）下，产物存在性断言被整体跳过。

**影响**：PR 可以改坏 `tooling/pipeline/build.ts`（例如 `ENTRIES` 改名、`naming` 模板变化、`format` 从 `iife` 改掉、新增/删除入口导致产物错名）而 CI 全绿，直到打包发布时才发现 `content.js` 缺失或不是 IIFE —— 而 MV3 对 content script 的 IIFE 约束是硬性的（`AGENTS.md` 硬性约束 5）。发布物只走人工 `bun run pack`，也没有 release workflow 兜底。

**建议**：在 `bun run check` 之后加一步 `bun run build`（可选再加 `bun run pack` 作冒烟），并在 build 结束后断言 `dist/` 的产物集合恰好等于期望集合（顺带解决 L-08）。

---

## 4. 中低风险问题

### M-01 `aliases` 机制零使用，但文档仍把它宣传为「O(1) 改名通道」

`src/dict/core/aliases.jsonc:12` 实际内容是 `"aliases": {}`（整个文件只有一个空对象）。而：
- `docs/guides/development.md:116-132` 用一整节（含示例代码与「两个边界」）介绍别名机制；
- `README`/`AGENTS.md`/`src/shared/types.ts:55`/`walker.ts:41-54`/`load.ts:10`/`tooling/checks/dict.ts:365` 都仍在描述与维护这条链路。

**影响**：不是 bug（空映射行为正确），但「上游改词的 O(1) 通道」目前**从未被使用过**，一行都没积累。这意味着真实的改名压力全部落在「新增键 + 旧键变死键」这条路上，而旧键是否会静默滞留没有任何检查。文档读者会高估这条机制的成熟度。

**建议**：二选一——(a) 保留机制但在文档标注「当前为空，尚无实际使用」；(b) 增加一条门禁：`canonical` 中每个键必须至少被一个语言的词条覆盖，否则报告「疑似死键」（可直接抓出 H-02/H-03 这类问题）。

### M-02 站点级短键误伤面（已知权衡，但规模比预期大）

`global` 模块对**任意路径**生效，其中单 token 键 **142 个**，例如 `Docs`(global.jsonc:190)、`Blog`(:200)、`Star`(:172)、`Assets`、`Code`、`Wiki`、`Home`、`Settings`、`Status`…；而排除清单（`src/content/filters.ts:8-30`）只覆盖 `code`/`pre`/`textarea`/`.markdown-body`/高亮与 diff 容器，**文件树、仓库列表、用户名、标签名、分支名、列表页标题都不在其中**。`AGENTS.md` 硬性约束 3 点名的 `docs`/`test`/`blog`/`actions`/`pages`/`write`/`name`/`star` 中，`Docs`/`Blog`/`Star` **目前都已收录**。

风险最集中的两条：
- `global.jsonc:126` `"commented": "发表了评论"` —— 唯一「全小写 + 站点级」词条；
- `rules.jsonc:1714` `^now$ → "刚刚"` —— 唯一「2 字符 + 站点级」规则。

**核对结论**：我用 434 个「单词形态」样本（392 个 canonical 单 token 键 + `main`/`docs`/`test`/`blog`/`index`/`package.json`/`LICENSE`/`2024`/`v1` 等用户内容形态）逐条编译测试**全部 447 条规则**，**命中 0 条**；未以 `^` 起锚或未以 `$` 收尾的 pattern 也是 0 条。所以规则侧没有过宽问题，风险集中在**静态短词条**上，这正是硬性约束 3 所承认的权衡，需要的是**实机验证**而不是猜测。

**建议**：按硬性约束 3 复核 `commented`、`Star`、`Docs`、`Blog`、`Assets` 这几条（是否可以直接不收录）；对确实要留的，考虑把单 token 键尽量下沉到具体模块，减少站点级生效面。

### M-03 `_locales` 只校验键集合，占位符丢失不会被发现

`tooling/checks/manifest.ts:108-163` 的 `loadLocaleMessages` 只收集 `Object.keys(parsed)`，因此 `validateLocales`（`:170-`）只比对**消息键集合**，不比对 `message` 文本里的 `$COUNT$` 占位符与 `placeholders` 声明。

**影响**：如果某个语言的 `devCount` 写成 `"已收集 条"`（丢了 `$COUNT$`），popup 会静默显示「已收集 条」，门禁全绿。另有一处更脆的耦合：`src/popup/popup.ts:31-43` 的 `msg()` 在取不到文案时**直接 `throw`**，`popup.ts:153-163` 的 `renderMessages()` 是抛错路径上的第一个调用 —— 任何一处 `_locales` 缺键都会让**整个 popup 空白**（而非局部降级）。键集合一致性门禁把这个风险压得很低，但「全屏空白」的失败模式与「抛错」的实现选择值得记录。

**建议**：在 `check:manifest` 增加跨语言 `placeholders` / `$NAME$` 引用一致性校验；`msg()` 的失败改为「记录 + 回退英文占位」而非整页抛错。

### M-04 测试覆盖不均：核心 IO 模块零覆盖，15/17 模块无节点边界测试

| 缺口                                         | 说明                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/shared/storage.ts`                      | **零直接测试**。`narrowMissLog`（脏数据收窄）、`narrowLocale`、`watchToggles`/`watchLocale`（storage 事件联动）都是可纯函数化的逻辑，却只有隐式依赖                                                                                                                                                                                                          |
| `src/dict/locales.ts`                        | **零直接测试**。`resolveLocale`（`ja-JP`→`ja`、`zh-Hans-CN`→`zh-CN`、回退 zh-CN）是纯函数，且是「自动语言」体验的入口                                                                                                                                                                                                                                        |
| `src/content/engine.ts`                      | 只有 `walker.test.ts:343-379` 间接覆盖 observer 参数                                                                                                                                                                                                                                                                                                         |
| `src/content/pages.ts`                       | 单槽缓存行为（路径/语言切换才重建）无测试                                                                                                                                                                                                                                                                                                                    |
| `src/content/index.ts`、`src/popup/popup.ts` | 入口装配层无测试（可接受，但 `popup` 的 `msg()` 抛错路径值得一测）                                                                                                                                                                                                                                                                                           |
| 节点边界测试                                 | 只有 `settings-{accessibility,admin,appearance,billing,notifications}` 5 个页面有；`AGENTS.md:71` 要求「节点边界必须同时写进 `src/content/__tests__/<页名>.test.ts`」，**17 个模块中 15 个没有**（`issues`/`pulls`/`repo`/`repo-settings`/`global`/`actions`/`agents`/`commits`/`dashboard`/`discussions`/`insights`/`search`/`marketing`/`profile`/`wiki`） |

对比之下，测试总量并不小（189 用例 / 1603 断言），且 `settings-billing.test.ts` 有 89 次断言 —— 说明**精力集中在最近做的页面上**。H-02/H-03 恰好落在 `insights`/`profile-settings` 这类无测试区域，这不是巧合。

**建议**：优先补 `issues`/`repo`/`repo-settings`/`global` 四个高流量模块的节点边界测试；把 `storage.ts`/`locales.ts` 的收窄与解析逻辑提为纯函数并补测；若短期无法补齐，把 `AGENTS.md:71` 的措辞降级为「新增/改动页面必须补」，避免规则与现状长期脱节。

### M-05 `rules.jsonc:774` 是死规则

`settings/usage-range-same-month-may`（`rules.jsonc:119`）与 `settings/usage-range-short-same-month-may`（`:774`）的 `pattern` **完全相同**（`^May (?<startDay>\d{1,2}) - May (?<endDay>\d{1,2}), (?<year>\d{4})(?:\.)?$`），zh-CN 模板也相同（`locales/zh-CN/rules.jsonc:29` 与 `:422`）。同模块内规则「首条命中生效」，因此后者**永不生效**。根因是 5 月的全称与缩写同形；对照 `rules.jsonc:1872` 在 global 里已正确处理了这一点（刻意不建 `long-date-may`）。

**建议**：删除 `:774` 及其模板，或按 global 的做法加注释说明「May 全称=缩写，故意只留一条」。

### M-06 第三方 action 未 pin SHA；`ci.yml` 无 `permissions`

- `actions/checkout@v4`（`ci.yml:14`）、`oven-sh/setup-bun@v2`（`ci.yml:16`）、`actions/labeler@v5`（`triage.yml:49`）——全部浮在可变 tag 上；其中 `labeler` 所在 job 带 `pull-requests: write`（`triage.yml:44-46`）且触发于 PR 的 `opened/synchronize/reopened`。tag 被移动或账号被入侵即可在 CI 中执行任意代码。
- `ci.yml:1-22` **没有 `permissions` 声明**，而 `triage.yml:29-30`、`:44-46` 都有。前者继承仓库默认 token 权限。
- **清白项**：全仓无 `pull_request_target`、无 `secrets` 使用、`run:` 里没有内联 `${{ github.event.*.title/body }}`（`triage.yml:34-37` 只嵌入整数 `issue.number` 与 `GITHUB_REPOSITORY`），无脚本注入面。

**建议**：三个 action pin 到 commit SHA（附版本注释）；`ci.yml` 顶层加 `permissions: contents: read`。

### M-07 `verify` 死脚本与 `identity.ts` 的孤儿化

- `package.json:19` `"verify": "bun tooling/verify-live.ts"` —— 该文件不存在，`bun run verify` 必然 `Module not found`。`AGENTS.md:72` 已明文写「文档与脚本不得再引用它」。
- 残留引用 4 处：`docs/guides/development.md:293`、`src/content/index.ts:27`、`src/shared/identity.ts:2`，加上 `package.json:19` 自身。
- **连带发现**：`src/shared/identity.ts` 的 `EXTENSION_MARKER` 现在**唯一的消费者就是那个已被删除的探针**（全仓 grep 只有 `content/index.ts:29-32` 在写它，没有任何地方读它）。也就是说这段刻意「无副作用、可被工具侧 import」的模块目前是**为死人写的代码**。

**建议**：删除 `verify` 脚本与三处注释引用；`identity.ts` 二选一——保留并标注「供未来实机探针使用」，或一并删除（`content/index.ts` 的 `Object.defineProperty` 同步移除）。

### M-08 文档数字大面积过期，且失真项恰好是决策依据

| 文档位置                           | 文档说                                                                                  | 实测                                                                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `development.md:97`                | 2066 规范键 / 2116 条译文                                                               | **2087 / 2137**                                                                                                                                                |
| `development.md:243`               | 「这 144 条规则」                                                                       | usage-range 实际 **156**（12+12+132），模块内共 **211**                                                                                                        |
| `development.md:244`               | 「（只有这一个探针）」                                                                  | 该路由实际 **4 条**探针                                                                                                                                        |
| `development.md:325`               | `content.js` 约 **195 KB**；数据约 **144 KB**；**207** 条规则 id                        | **290.6 KiB**（297,543 B）；序列化 **≈230 KiB**；**447** 条                                                                                                    |
| `AGENTS.md:62`                     | 「1618 个键（约 20 KB）」                                                               | **2087** 键；键清单紧凑 JSON **≈74 KiB**                                                                                                                       |
| `development.md:15`、`:73`         | 图标是「16/32/48/128 **PNG**」                                                          | 实为 **`.jpg`**（与 `AGENTS.md:58` 冲突）                                                                                                                      |
| `development.md:56`、`:62`、`:298` | 观察器只 `childList+subtree+characterData`；元素只翻 `title/aria-label/placeholder/alt` | 实际还开 `attributes` + `attributeFilter:["value","data-disable-with"]`；元素属性还含 **`value`/`data-disable-with`**（仅按钮类 `<input>`，`walker.ts:12-39`） |
| `registry.ts:28`                   | 跨模块同键异译「现在是 16 处」                                                          | 快照 **17 个碰撞键**，其中真同键异译 **2 个**；词典层 63 个键跨 ≥2 模块                                                                                        |
| `tooling/checks/view.ts:3`         | 「27 探针 × 1618 词条」                                                                 | **33 探针 × 2087 键**                                                                                                                                          |
| `tooling/tsconfig.json:2`          | 「构建 / 门禁 / **图标** / 打包」（图标脚本已删）                                       | 无图标环节                                                                                                                                                     |
| `development.md:249`               | 引用 `docs/guides/assets/settings-billing-usage.zh-CN.png`                              | 该目录不存在（图已在 `71ba590` 删除，删除时未同步文档）——**死链**                                                                                              |

**影响**：`:325` 的包体数字是「词典规模是否值得按语言拆分分发」这类决策的依据；低估 3.7 倍的键清单体积（20 KB → 74 KB）会误导未来架构判断。

**建议**：把可从门禁输出复制的数字改为「见 `bun run check:dict` 输出」，只保留口径说明；一次性用实测值刷新 `:97`、`:243-249`、`:325`、`AGENTS.md:62`、`registry.ts:28`、`view.ts:3`、`tsconfig.json:2`，并统一 PNG→JPG、删除死图引用。

### M-09 `bunx tsc` 的网络回退

`package.json:14`：`"typecheck": "bunx tsc -p tsconfig.json && bunx tsc -p tooling/tsconfig.json"`。有 `node_modules` 时 `bunx` 用本地包（当前正常），但一旦未安装依赖或平台 optionalDependency 装不上，`bunx` 会改为**从 registry 解析并执行一个未锁定版本的 tsc**。在 CI 里等于执行未锁定代码。

**建议**：改为锁定本地二进制（如 `bun x --bun tsc` 之外的 `node_modules/.bin/tsc`），或把调用绑到 lockfile 版本。

### 其余低风险项（L-01 ~ L-12）

- **L-01 行走器无记忆化**：`walker.ts:115-152` 的 `applyAttrs` 对遍历到的**每个元素**都做 6 次 `getAttribute`（`TRANSLATABLE_ATTRS` 全量），`applyTextNode` 对每个文本节点都做 `normalizeKey` + Map 查 + 规则扫描；每次 flush 都从零重算。GitHub 的 `<relative-time>` 等自更新组件会周期性触发 flush，把父子树反复重扫。当前实测无法在无浏览器环境下量化（本次尝试的 DOM 桩基准无效，已弃用，不写猜测数字），属**结构性观察**。**建议**：给 `applyAttrs` 先做「本元素是否存在任一目标属性」的短路判断，或对未变子树做弱引用记忆化。
- **L-02 术语不一致**：`Pages` 在 `global.jsonc:334` 是「页码」、`repo-settings.jsonc:20`/`wiki.jsonc:12` 是「页面」、`settings-billing.jsonc:191` 干脆保留英文；`action`/`Action`/「操作」三套并存（`marketing.jsonc:88`、`:338`、`:347`，`repo.jsonc:26`）；`GitHub Apps` 与「GitHub 应用程序」、`Scheduled reminders` 与「定期提醒/定时提醒」不统一（后两组路由互斥，不可观测）。
- **L-03 标点/空格**：`global.jsonc:318` `"Load more…" → "加载更多"` 丢了省略号（对照 `global.jsonc:316` 的 `"Loading…"` 保留 `…`）；`repo.jsonc:48` `"View commit history for this file." → "查看此文件的提交历史"` 丢句号；`repo.jsonc:93-94` 两段碎片拼接出「GitHub的已验证签名」（全库惯例是「GitHub 的」）。
- **L-04 注释陈旧**：见 M-08 表格末三行。
- **L-05 注入面**：`manifest.json:18-27` 覆盖全部 `github.com` + `gist.github.com` 且 `run_at: document_start`，含 `/login`、`/signup`、`/sessions/*`、OAuth 授权页。当前实现只读 DOM 写文本/属性（`value` 仅限按钮类），不碰 cookie/localStorage、不外发数据，**故不构成风险**；但这一事实值得写进文档，以便未来给 content script 增加能力时被重新评估。另外 `all_frames` 未开启（默认），iframe 内 UI 不会被翻译（功能取舍）。
- **L-06`action.default_title`**：`manifest.json:15` 用 `__MSG_appName__`。Chrome 的 `__MSG_*__` 替换只在 manifest 的少数字符串字段（`name`/`description`/`version`/`short_name` 等）生效，`action.default_title` **很可能**原样显示为裸占位符 `__MSG_appName__`（工具栏 tooltip）。我无法在本环境访问 Chrome 官方文档核实（网络受限），也未能实机验证，**故列为待实机确认项**。需要注意的是 `tooling/checks/manifest.ts:248-265` 恰好把 `action.default_title` 纳入「占位符必须存在」校验，因此门禁给了它虚假的安全感。
- **L-07`popup.html:183`** 硬编码 `<span class="version">0.2.0</span>`，运行时被 `popup.ts:167-168` 覆写；无门禁校验它是否与 `package.json` 一致（`manifest.json` 的 version 有校验，`popup.html` 的没有）。
- **L-08`build.ts:21-23,43-45`** 的 `OUTPUT_RENAMES` 是硬编码 Map，`renameSync` 不校验源文件是否存在、不校验最终产物集合；新增入口却忘了加映射时，产物会以 `[name].js` 静默落进 `dist/`，并被 `pack` 无差别打进商店包。
- **L-09`pack.ts`**：`collectFiles` 不拒绝 symlink；`buildZip` 无 4 GiB / 65535 条目上限校验（超限会静默写出损坏 zip）；每个条目 `crc32` 计算两次（`:123`、`:144`）；时间戳取当前时刻 + 条目排序 → 非可复现构建（设计取舍，但值得记录）。**注意**：该 zip 实现经独立字节级验证是正确的（11 条目、central directory 尺寸自洽、11/11 CRC 与数据匹配、`manifest.json` 在根、`tar -tvf` 可正常列出、无重复条目）。
- **L-10** 无 `.github/dependabot.yml` / `renovate.json`；`package.json:22-27` 的 devDeps 用 `^` 区间（`^biome/2.5.14` 一次升级就可能引入新 lint 规则让 `main` 变红）。CI 走 `--frozen-lockfile`，故只影响本地与未来重建。
- **L-11 / L-12**：死图引用与 PNG/JPG 描述错误，见 M-08 表格。

---

## 5. 已排除的疑点（明确澄清，避免误报）

以下项在审计中被怀疑过，经实测**确认无问题**：

| 疑点                                               | 结论                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 根目录 `github-i18n-v0.2.0.zip` 是误提交的构建产物 | **否**。`*.zip` 命中 `.gitignore:4`，`git ls-files` 无该条目，未入 git（符合硬性约束 7）                                                                                                                                                                                                                                |
| `dist/` 被提交进仓库                               | **否**。`.gitignore:3` 排除，`git ls-files` 无条目                                                                                                                                                                                                                                                                      |
| content script 被构建成 ESM                        | **否**。`build.ts:29` `format: "iife"`；`dist/content.js` / `dist/popup.js` 首行均为 `(() => {`，无 `import`/`export`                                                                                                                                                                                                   |
| 打包的 zip 结构有问题                              | **否**。独立字节级解析 + `tar -tvf` 双重验证通过                                                                                                                                                                                                                                                                        |
| 存在 XSS / 内容注入面                              | **否**。全仓无 `innerHTML`/`eval`/`new Function`/内联事件/远程资源；文案一律经 `textContent`/`nodeValue` 写入；`chrome.i18n.getMessage` 返回纯字符串，`messages.json` 里塞 HTML 不可利用                                                                                                                                |
| 有网络请求或数据外发                               | **否**。全仓无 `fetch`/`XMLHttpRequest`/`WebSocket`/`sendBeacon`；权限只有 `storage`；`dist` 产物里同样零命中                                                                                                                                                                                                           |
| CI 用了 `pull_request_target`/泄露 secrets         | **否**。无 `pull_request_target`，无 secrets 使用，`run:` 无外部输入内联                                                                                                                                                                                                                                                |
| 两份 tsconfig 缺严格选项                           | **否**。`AGENTS.md` 声明的 9 项（strict / noUncheckedIndexedAccess / noPropertyAccessFromIndexSignature / exactOptionalPropertyTypes / noUnusedLocals / noUnusedParameters / verbatimModuleSyntax / isolatedModules / erasableSyntaxOnly）**两份全有，零缺失**；两份只在 `types`/`lib`/`resolveJsonModule` 三处有意不同 |
| devDependencies 版本号是幻觉                       | **否**。`typescript 7.0.2`、`@types/chrome 0.3.0`、`@biomejs/biome 2.5.14`、`@types/bun 1.4.2` 均经 npm registry 核实真实存在且为当前 latest，与 `bun.lock` 无漂移                                                                                                                                                      |
| 词典规则 pattern 过宽会误伤用户内容                | **否**（规则侧）。434 个「单词形态」样本对全部 447 条规则命中 0；无未锚定 pattern；无 `^(.+)$` 类全通配。风险在静态短词条（见 M-02）                                                                                                                                                                                    |
| ja 侧数据有结构缺陷                                | **否**。50 条全量核对：无键不匹配、无模块错位、无「值=键」、无首尾空白；7 条规则模板 id 与 `$1` 用法全部正确（仅风格与 440 条模板缺失，属预期稀疏覆盖）                                                                                                                                                                 |
| zh-CN 存在整体漏译                                 | **否**。2087 条中 422 条值含拉丁字母但**全部同时含中文**；纯拉丁值 0 条；值中「连续 ≥3 个小写英文词」0 条；230 个拉丁 token 全是专有名词/术语                                                                                                                                                                           |
| zh-CN 存在中英标点混用                             | **否**。「CJK 与半角标点相邻」0 条                                                                                                                                                                                                                                                                                      |
| 词典里同一文件有重复键                             | **否**。同文件重复键 0（Biome `noDuplicateObjectKeys` 兜底 + 本次复核）；跨文件同键同值 54 个属无害冗余                                                                                                                                                                                                                 |
| canonical 里混入中日韩文字或不可见字符             | **否**。非 ASCII 键全是 GitHub 真实排版字符（`’` `“ ”` `…` `—` `·` `×`）与 emoji；无中日韩文字、无不可见字符、无首尾空白                                                                                                                                                                                                |

---

## 6. 修复优先级建议

### 第 1 批（本周内，成本低、收益高）

1. **重写 `.github/SECURITY.md`**（H-01）—— 一页文档，消除安全流程失效。
2. **修 H-02 的换行键** + 给 `check:dict` 加「键必须满足 `normalizeKey(键) === 键`」断言 —— 一处数据修改 + 一条门禁，堵住整类「永不命中的键」，并让覆盖率重新可信。
3. **修 H-03 的 2 条伪键**（实机确认 Company 提示句后一并修译文与注释）。
4. **`ci.yml` 加 `bun run build`**，并给 build 加产物集合断言（H-05 + L-08）。
5. **删除 `verify` 死脚本与 3 处注释引用**（M-07）。

### 第 2 批（两周内）

6. **修 H-04 的 `pages/repo` 路由**（加负向前瞻）+ `check:view --update` 重生成快照并说明原因。这一条同时收缩 M-02 的误伤面。
7. **刷新文档数字**（M-08 + L-11 + L-12）：把可复制的数字改为「见 `bun run check:dict` 输出」，其余用实测值替换。
8. **补 `_locales` 占位符一致性门禁** + `msg()` 失败降级（M-03）。
9. **补测试**：`storage.ts`/`locales.ts` 纯函数测试；`issues`/`repo`/`repo-settings`/`global` 的节点边界测试（M-04）。若不做，先把 `AGENTS.md:71` 的措辞降级。

### 第 3 批（按需）

10. `aliases` 机制定调（M-01）：加「死键报告」门禁，或在文档标注当前为空。
11. `rules.jsonc:774` 死规则清理（M-05）。
12. 供应链加固：action pin SHA、`ci.yml` 加 `permissions`、考虑 dependabot（M-06 + L-10）。
13. `bunx tsc` 改为本地二进制调用（M-09）。
14. 明确 L-06（`action.default_title`）：实机看工具栏 tooltip，若确为裸占位符则改为字面量或删掉该字段。
15. 复核 `commented`/`Star`/`Docs`/`Blog`/`Assets` 等站点级短键是否必要（M-02），以及 L-02 的术语统一。

### 需要实机确认的开放项（受环境限制，本次未启动浏览器）

| 开放项                                                                           | 确认方式                                         |
| -------------------------------------------------------------------------------- | ------------------------------------------------ |
| `action.default_title` 是否显示为裸 `__MSG_appName__`（L-06）                    | 加载 `dist/`，看工具栏 tooltip                   |
| Company 提示句（`/settings/profile`）的实际节点拼接结果（H-03）                  | 开发者模式收集 + 手工浏览该页                    |
| 文件树 / 标签 / 分支名等位置是否真的渲染成孤立单词节点（M-02）                   | 挑一个名为 `Docs`/`Blog`/`Star` 的仓库或目录实测 |
| `Pages` 在仓库首页 `/owner/repo`、`/features`、`/pricing` 是否有孤立节点（L-02） | 实机浏览对应页面                                 |
| popup 内联 `<style>` 是否被 MV3 默认 CSP 拦（未观察到问题，但未实机验证）        | 打开 popup 看样式与控制台                        |

---

## 7. 审计声明

- 本次审计**只读**，未修改仓库任何受版本控制的文件；审计过程中创建的两个临时探针脚本（`.audit-probe.ts`、`.audit-bench.ts`）已在结束前删除，`git status` 干净。
- 所有「实测」结论均来自本次真实执行的命令输出或真实读取的文件内容；所有行号均对应当前 `main`（`71ba590`）的文件内容。
- 标注为「静态推断」或「待实机确认」的项目**未经浏览器验证**，已在上表逐一列出，不应作为已确认事实使用。
- 未覆盖：真实浏览器运行期性能剖析、Chrome / Edge 商店审核合规细节、上游 GitHub 页面结构变化的持续跟踪。
