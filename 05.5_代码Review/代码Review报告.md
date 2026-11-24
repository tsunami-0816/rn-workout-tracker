# 第 5.5 步 独立代码 Review 报告

- 结论：🔴 **需返工**
- reviewer 上下文：**新对话 / 独立 reviewer**（未参与 5A、5B 编写；本对话只读代码与跑验证命令，未改任何产品代码）
- 审查范围：`05_代码/backend`（auth / workouts / sets / plans / stats / admin / app-info / common / trace）、`05_代码/frontend`（api / storage / store / hooks / screens / components / config / tokens）、`06.5_契约/openapi.json`、`scripts/`、`_设计实施映射表.md`、`04_任务拆解与开发规范.md`
- approved_commit：**—**（项目目录 0 个文件被 git 跟踪，`WORKFLOW_测试` 仓 HEAD `82af601` 不含本次代码；关键项审批无法绑定 commit，建议修复后先 commit 再确认）
- 映射表复核：**50/50 行全查，降级 4 行**（D-03 / D-26 / D-28 / D-31，已直接改正状态与证据列）
- 失败记账：`scripts/log_failure.py --step 5.5 --category 评审打回 --rule R9` 已写入 `_失败日志.md`（累计 1 条）

## 结论摘要

| 级别 | 数量 | 条目 |
|---|---|---|
| P0（阻塞 5.5/6） | 1 组 | D-38/D-39（P0 关键）+ D-40~D-44 共 7 条 `❌`；`design_impl_check --stage 6` exit 1（27✅/16⚠️/7❌） |
| P1（必修） | 4 | F-01 统计「本周」口径错误；F-02 同日换分化被后端拒绝；F-03 release.json 版本源失效；F-04 EXPO_PUBLIC 动态读取失效 |
| P2 | 4 | F-05 错验证码触发「登录已过期」；F-06 慢请求 warn 缺失；F-07 同日并发 start 无双开约束；F-08 测试有效性 3 处 |
| P3 | 3 | F-09 管理页用户数用容量格式化；F-10 D-30 映射描述含未返回字段；F-11 关键审批无法绑 commit |

> 判定口径：5.5 只有 `🟢 通过 / 🔴 需返工`。本轮存在 P0/P1，直接 🔴，回 5A/5B 补齐后重审（不限轮次）。

## 第一层 需求正确性（D-01~D-50 全查）

| 编号 | 映射原状态 | 核实方式（文件:行号 / 命令） | 评审结论 |
|---|---|---|---|
| D-01 | ⚠️ | `app.json:20-34` 包名/versionCode/INTERNET；`dist/metadata.json` 存在 | 维持 ⚠️：真机安装未走 |
| D-02 | ⚠️ | `navigation/types.ts:10-22`、`App.tsx` AuthStack + MainTabs(3) + Stack(3) | 维持 ⚠️：六页点击待第 9 步 |
| D-03 | ✅ | `client.ts:97-134`；契约校验 18 调用 0 越界；**client 无单测**；`errors.test.ts` 实际 6 条 | **降为 ⚠️**：8s/重试/401 清态未验证；证据「12 条」不实 |
| D-04 | ⚠️ | `LoginScreen.tsx` 手机号正则 + 60s 倒计时 + 40102 内联 | 维持 ⚠️：真机路径未走 |
| D-05 | ⚠️ | `PlansScreen.tsx:54-62` 三卡可点 + `todayPlanId` 高亮 | 维持 ⚠️；另见 F-02：三卡可点与后端「一日一 plan」冲突 |
| D-06 | ⚠️ | `WorkoutScreen.tsx` 64 行高/getItemLayout/windowSize=7/夹具 | 维持 ⚠️；夹具开关实际不可用（F-04） |
| D-07 | ⚠️ | `SetRow.tsx` 2.5kg/1 次步进 + clamp；`format.test.ts` 覆盖 | 维持 ⚠️：点按路径待真机 |
| D-08 | ⚠️ | `LogScreen.tsx` 乐观提交 + pending/error 行 + 重试 | 维持 ⚠️：断网红行待第 9 步 |
| D-09 | ⚠️ | `StatsScreen.tsx` 纯 View 4 柱 + 天数/容量 | 维持 ⚠️：数据源有 F-01，展示数字会错 |
| D-10 | ⚠️ | `ProfileScreen.tsx` 脱敏/角色/退出 | 维持 ⚠️ |
| D-11 | ⚠️ | `AdminScreen.tsx` admin 入口 + 分页 + 403 文案 | 维持 ⚠️；P3 F-09 |
| D-12 | ⚠️ | `useVersionCheck.ts` buildNo 比较 + Linking | 维持 ⚠️；apkUrl 为 127.0.0.1，真机不可达 |
| D-13 | ⚠️ | `authStorage.ts` SecureStore 主 + AsyncStorage 降级 | 维持 ⚠️：冷启未验证 |
| D-14 | ⚠️ | `StateView.tsx` 四态 + `ToastHost` | 维持 ⚠️ |
| D-15 | ⚠️ | `tokens.ts`、`Screen.tsx:14-30` SafeArea + 8/12/16/20/24/32 | 维持 ⚠️：375/414 未目测 |
| D-16 | ✅ | `main.ts:18-66`、`app.module.ts:37-73`；build exit 0 | ✅ 名副其实 |
| D-17 | ✅ | `schema.prisma` 5 表 + migration + `seed.ts`（users=2/plans=6/exercises=72） | ✅ |
| D-18 | ✅ | `auth.service.ts:44-95`、`auth.controller.ts`、`dtos.ts` | ✅ |
| D-19 | ✅ | `app.module.ts:44-54`、`jwt-auth.guard.ts:33-38`；guards.spec | ✅ |
| D-20 | ✅ | `jwt-auth.guard.ts:20-39`、`decorators.ts:12-13` | ✅ |
| D-21 | ✅ | `roles.guard.ts:16-27`、`admin.controller.ts` 类级 @Roles | ✅ |
| D-22 | ✅ | `plan.service.ts:19-90`；weekDone 按本周 | ✅ |
| D-23 | ✅ | `workout.service.ts:33-60` 同日复用；`workouts.controller.ts` | ✅（其声明的路径成立）；跨 plan 缺口见 F-02 |
| D-24 | ✅ | `workout.service.ts:132-241` 三端点 + 所属/结束校验 | ✅ |
| D-25 | ✅ | `workout.service.ts:145-179` upsert + `:267-278` SUM；迁移唯一键 | ✅ |
| D-26 | ✅ | `stats.service.ts:47-55`：`rangeStart = starts[0]`（4 周前）统计 days/volume | **降为 ⚠️**：本周口径错误（F-01） |
| D-27 | ✅ | `admin.service.ts` 三查询 + maskPhone；e2e#7/#8 | ✅ |
| D-28 | ✅ | `version.service.ts:23-44`；`node` 实测默认路径不存在；`.env:17-20` 四字段全有值 | **降为 ⚠️**：release.json 实际不生效（F-03） |
| D-29 | ✅ | `response.interceptor.ts`、`all-exceptions.filter.ts:27-76`；spec 5 条 | ✅ |
| D-30 | ✅ | `health.controller.ts:16-28` 返回 status/db/uptimeSec | ✅（映射描述误写 version，P3 F-10） |
| D-31 | ✅ | `trace.middleware.ts:17-51` 仅 traceId/ms/JSONL，**无 >300ms warn**（架构 §544 要求） | **降为 ⚠️**：F-06 |
| D-32 | ✅ | `export-openapi.ts:24-45`；`python json.load` → paths=19 / operations=20 | ✅ |
| D-33 | ✅ | 本次实跑 `npm test`：**8 suites / 51 单测全 PASS**；e2e 因服务未起 10 FAIL | ✅（单测部分）；e2e 见 F-08 |
| D-34 | ✅ | `npm test` frontend：**2 suites / 19 cases PASS**，Stmts 98.21 / Lines 100 | ✅ |
| D-35 | ✅ | `test/app.e2e-spec.ts` 10 条真实 HTTP；本次 Docker 未运行未能复现 | 维持 ✅（历史证据），风险带入第 6 步 |
| D-36 | ✅ | `10_交付/test-report/coverage/coverage-summary.json` + `lcov.info` 均存在 | ✅ |
| D-37 | ⚠️ | `eas.json:6-16` preview APK / production 预留 | 维持 ⚠️ |
| D-38 | ❌ | `09_验收/` 无 APK 安装截图；`10_交付/apk/` 不存在 | **P0 阻塞**：T-703 明写「5A 当轮先做」，未做 |
| D-39 | ❌ | `app.json:6/22` 仍 1.0.0 / versionCode 1；无覆盖安装证据 | **P0 阻塞** |
| D-40 | ❌ | `10_交付/apk/` 不存在；release.json apkUrl 指向未产出文件 | ❌ |
| D-41 | ❌ | `10_交付/发布记录.md` 不存在 | ❌ |
| D-42 | ❌ | `05_代码/flutter/` 不存在 | ❌ |
| D-43 | ❌ | 同上 | ❌ |
| D-44 | ❌ | `10_交付/跨框架差异表.md` 不存在 | ❌ |
| D-45 | ✅ | `docker-compose.yml` PG16/5434/healthcheck；当前 Docker Desktop 未运行 | ✅（代码层） |
| D-46 | ✅ | `.env.example`、`backend/.gitignore` 忽略 `.env`；SAST 0 命中 | ✅ |
| D-47 | ✅ | `scripts/start_all.ps1`、`stop_all.ps1` 存在；本次未实跑（Docker off） | ✅（历史证据） |
| D-48 | ✅ | `scripts/smoke.ps1` 存在；本次未跑 | ✅（历史证据） |
| D-49 | ✅ | `start_all.ps1:22-50` 调 `env_preflight.py --ports`；脚本存在 | ✅ |
| D-50 | ⚠️ | `_运行度量.md` 存在；p95 35.3ms；APK 体积空缺 | 维持 ⚠️ |

## 第二层 系统一致性

| 检查项 | 证据 | 结论 |
|---|---|---|
| 前后端接口对齐 | `python scripts/api_contract_validator.py check ...`：**18 个调用 / 0 不在契约**，exit 0 | ✅ |
| DB↔DTO↔前端类型命名 | User/Plan/Exercise/WorkoutLog/SetLog、`totalVolume`、`phoneMasked`、`logDate` 三处一致 | ✅ |
| 权限矩阵落代码 | admin 组类级 `@Roles('admin')`（`admin.controller.ts`）+ `RolesGuard` + e2e 403；前端只是隐藏入口 | ✅ 非「只靠前端隐藏」 |
| 错误语义 | `ERR_HTTP[40102]=401`（`error-codes.ts:36`）但 `client.ts:110` 见到 HTTP 401 就清态 | ❌ 语义漂移，见 F-05 |
| 契约细节 | `/admin/users` 的 page/size 在 OpenAPI 标 required，实际 `DefaultValuePipe` 可选；`todayPlanId` 可空但前端 type 为 number | P3 文档漂移，不阻塞 |
| 配置口径 | `DATABASE_URL` 仅 env；端口 5434/8094/8096 全仓一致；`release.json` 路径口径不一致（F-03） | ⚠️ 见 F-03 |

## 第三层 回归

| 受影响模块 | 验证方式 | 结论 |
|---|---|---|
| 后端全局（auth/workout/stats/plan/common） | `npm test`：8 suites / 51 unit PASS（`stats.spec` 6 / `workout.spec` / `guards.spec` 5 / `response.filter.spec` 5 等）；`npm run build` 未重跑，历史 exit 0 | ✅ 单测无回归 |
| 前端全局 | `npx tsc --noEmit` exit 0；`npm test` 2 suites / 19 PASS | ✅ |
| e2e 链路 | 本次 Docker Desktop 未运行、8094 未监听 → `npm test` 中 e2e 10 FAIL（连接失败，非断言失败） | ⚠️ 未复现；第 6 步必须重跑 |
| 老逻辑 / 既有 P0 用例 | `08_测试/p0_cases.json` 尚未产出 | 无回归用例，风险带入第 7 步 |
| 并发 / 事务 | sets：唯一键 + 事务重算（`workout.service.ts:145-179/267-278`）；start：select-first 无唯一索引（F-07） | ⚠️ start 并发双开仍有窗口 |
| 公共签名变更 | 本次为首版实现，无对外既有调用方；前端 18 调用全部在契约内 | ✅ |

## 测试有效性（G6）

| 用例编号 | 断言打的字段/状态 | 是否仅断 mock 返回值/状态码 | 结论 |
|---|---|---|---|
| `stats.service.spec`（weekly） | `days=3/volume=900/series` 全部来自 `$queryRaw` mock | **是**：SQL 的「本周」范围被 mock 掉 | **假绿** → `_问题台账.md` Q-001，路由第 8 步 |
| `version.service.spec`（4 条） | 全部用 `RELEASE_FILE` 指向临时文件 | **是**：默认 `cwd/../release.json` 路径从未被测 | **假绿（路径）** → Q-002，路由第 8 步 |
| `client.ts`（8s/GET 重试/401 清态） | 无对应用例 | — | 未验证，D-03 已降级 |
| `workout.service.spec`（幂等/容量） | 断言 upsert 入参与 SUM 结果，mock Prisma 但保留业务规则 | 否（规则在服务内） | 有效 |
| `app.e2e-spec.ts`（10 条） | 真 HTTP + status/code/DB 行数（#6）、脱敏正则（#8） | 否 | 有效，但依赖活服务与顺序数据 |
| `format.test.ts` / `errors.test.ts` | 纯函数边界与错误文案 | 否 | 有效 |

## 风险变更确认（G5 · 关键项）

> 04 标「关键」的任务：T-202/203（DB/Schema）、T-205/206/207（鉴权/权限）、T-401/402（并发/幂等）、T-703/704（EAS/覆盖升级）、T-901（启动脚本）、T-903（密钥/忽略文件）。
> 本轮结论为 🔴，**关键项审批暂不生效**；且项目 0 文件被 git 跟踪，`approved_commit` 只能填 —。修复并 commit 后需重新出具本节并具名确认。

| 模块 | 风险级别 | 改动 | 影响链路 | 回滚方式 | approved_commit |
|---|---|---|---|---|---|
| 鉴权与角色 | 关键 | JWT/全局守卫/@Public/@Roles 新增 | 所有 20 端点 | revert `auth/**` + `guards/**` + `app.module.ts` | — |
| Schema/迁移/seed | 关键 | 5 表 + 唯一键 + 初始数据 | 全后端 | `prisma migrate reset` + 恢复旧 schema | — |
| 幂等/事务 | 关键 | set upsert + 容量 SUM | 记录页/admin 统计 | revert `workout.service.ts` | — |
| 启动脚本/端口 | 关键 | start_all/stop_all/preflight | 本机联调 | 保留旧脚本版本 | — |
| 密钥/环境 | 关键 | `.env.example`/`.gitignore` | 启动与推仓 | 恢复旧配置模板 | — |
| EAS 打包/覆盖升级 | 关键 | **未实现（D-38/D-39）** | C07/C08 演示 | 不适用（未产出） | — |

## 详细发现

### F-01（P1）统计「本周」口径错误：本周数字实际是近 4 周累计

- 位置：`05_代码/backend/src/stats/stats.service.ts:47-55`
- 事实：`starts = recentWeekStarts(4)` 后取 `starts[0]` 作为 `rangeStart`，`weeklyRows` 的 `COUNT(DISTINCT log_date)` / `SUM(total_volume)` 过滤条件是 `log_date >= rangeStart`，即 **3 周前的周一**，不是本周周一；`seriesRows` 用同一范围是对的，但 `days/totalVolume` 被复用成 4 周。
- 复现命令（可复现）：
  `cd 05_代码/backend; npx ts-node --transpile-only -e "import {recentWeekStarts,isoWeekStart,shanghaiDateString} from './src/common/time'; ..."`
  输出：`{"today":"2026-11-24","thisWeekStart":"2026-11-23","recentStarts":["2026-11-02"...],"queryRangeStart":"2026-11-02"}`
- 影响：统计页「本周打卡 X 天 / 本周总容量」会显示最多 28 天、4 周容量；C01/D-09/T-501 的「打完卡统计更新」验收数字不成立，用户会看到「本周 12 天」这类不可能值。
- 修复：`weeklyRows` 单独用 `thisWeekStart`（`weekStart`）到 `nextWeekStart` 的闭开区间；`seriesRows` 保留 4 周范围；`stats.spec` 增加跨周边界用例（不要只 mock 返回值）。
- 归属：5A 修复 + 第 8 步补用例。

### F-02（P1）同一天点第二张分化卡，提交组次被 40001 拒绝

- 位置：`workout.service.ts:38-47`（start 只按 user+date 复用，未校验 `planId`）；`workout.service.ts:140-143`（createSet 只接受 workout 所属 plan 的动作）；`PlansScreen.tsx:54-62`（三卡都可点进 Workout/Log）。
- 复现路径：今天先点「推日」→ 开始训练；返回计划页点「拉日」→ 进入动作 → 记录页输入 → 点「完成这组」→ 后端 `exerciseId` 不属于推日 plan → `40001 动作不属于本次训练的计划`。前端仍显示拉日的 `planName` 与推日的 `totalVolume`，用户无法自救。
- 影响：计划页三卡看似等价，实际一天只能练先点的那份；新手会认为「拉日坏了」。与 D-05「点任意分化卡」的用户预期不一致。
- 修复建议（二选一，需产品口径）：
  1. 保持「一天一次训练」：`start` 校验 `existing.planId`，不同 plan 返回明确 `40002`（附中文「今天已按推日开练，明天再练拉日」），前端把另外两卡置灰或弹确认；
  2. 允许同日多 plan：去掉「一天一条」约束（schema/migration/统计口径都要改，成本高，不建议本轮）。
- 归属：5A（后端语义）+ 5B（前端提示/置灰）。

### F-03（P1）release.json 版本源实际不生效：路径指错 + env 全量覆盖

- 位置：`version.service.ts:39-44`（默认 `resolve(process.cwd(),'..','release.json')`）；`.env:16-20`（APP_VERSION/APP_BUILD_NO/APK_URL/APP_NOTES 全部有值）；`release.json` 在项目根。
- 实测：
  `cd 05_代码/backend; node -e "...resolve(process.cwd(),'..','release.json')..."` → `default_release_path=...\05_代码\release.json`，`exists=false`；`project_root_release_exists=true`。
- 结果：文件读失败 → 走 env 兜底；而 env 四字段全有值 → 改 `release.json` 永远不会改变接口返回；改 `.env` 需重启进程才生效。T-701「改 release.json 立即返回新值」与 C09 更新弹窗演示无法完成；D-38/D-40 的 apkUrl 也失去单一事实源。
- 佐证：`src/tools/export-openapi.ts:9-17` 已写了「向上找 release.json」的 `findProjectRoot`，说明作者知道 `../` 不可靠，但 VersionService 没复用。
- 修复：复用 `findProjectRoot(process.cwd())`（或显式 `RELEASE_FILE`）；明确优先级：要么「文件优先、env 只覆盖 apkUrl」，要么「env 优先但本地删除 APP_*，演示改文件」；补默认路径用例。
- 归属：5A 修复；第 8 步补路径用例。

### F-04（P1）EXPO_PUBLIC_* 动态读取不符合 Expo 内联规则：性能夹具与打包 API 地址都会失效

- 位置：`05_代码/frontend/src/config.ts:8-11`、`:29-38`、`:41-44`
- 事实：Expo 只支持 **静态字面量** `process.env.EXPO_PUBLIC_XXX` 在打包时内联；代码用 `env[key]` 动态读取。`expo export` 产物仍保留字符串 `EXPO_PUBLIC_API_BASE_URL` / `EXPO_PUBLIC_PERF_FIXTURE`（实测 hbc 中各 1 处），说明未被内联；生产/独立 APK 无 `hostUri` 时回落到 `10.0.2.2`（Android 模拟器地址），真机连不上后端。
- 影响：C02 的 100 条夹具开关无法按文档打开；D-38 APK 即使构建成功也连不上 API；D-12 版本检查在 APK 里同样受影响。
- 修复：改为 `process.env.EXPO_PUBLIC_API_BASE_URL` / `process.env.EXPO_PUBLIC_PERF_FIXTURE` 字面量访问（Expo 文档要求），并在 `npm run build` 后断言字符串已内联（或写 `app.config.ts` extra 注入）；APK 用局域网/可访问地址，不用 127.0.0.1。
- 归属：5B 修复；EAS 打包前必须验证。

### F-05（P2）登录页输错验证码会弹「登录已过期，请重新登录」

- 位置：`client.ts:110-112` 对 `response.status === 401` 一律 `handleUnauthorized()`；`error-codes.ts:36` 把 `40102 验证码错误` 映射为 HTTP 401。
- 影响：登录页输错码时同时出现内联「验证码错误」+ Toast「登录已过期」，误导用户；虽然不清除有效 token（登录页本来无 token），但错误语义不对。
- 修复：仅 `40101` 清态；`40102` 只抛业务错误。
- 归属：5B。

### F-06（P2）D-31 慢请求 >300ms 打 warn 未实现

- 位置：`trace.middleware.ts:17-51` 只写 JSONL；`架构 §544` 与 D-31 明写「>300ms 打 warn」。
- 修复：`res.on('finish')` 里 `if (ms > 300) this.logger.warn(...)`；补一条慢请求单测。
- 归属：5A。

### F-07（P2）同日并发 start 仍可能双开

- 位置：`workout.service.ts:38-59` select-first + 事务；schema 无 `(user_id, log_date)` 唯一索引；前端只有单设备 `startInFlight` 防抖。
- 影响：两台设备/两个请求并发可建两条当天 workout，之后统计和记录分裂。架构 §12 已把它列为已知风险并说「联调发现再补唯一索引」，但 5.5 应在进 6 前把约束补上更稳。
- 修复：加 `@@unique([userId, logDate])`（需迁移；seed/历史数据先清），start 捕获 P2002 后重查返回同一 id。
- 归属：5A；或明确 deferred 到 7（需台账记录）。

### F-08（P2）测试有效性缺口（3 处）

1. `stats.service.spec` 把 `$queryRaw` 结果整体 mock，SQL 的「本周」范围被替换 → F-01 照样全绿；已记 `_问题台账.md` **Q-001**，路由第 8 步补集成/边界用例。
2. `version.service.spec` 4 条全用 `RELEASE_FILE` 临时文件，默认生产路径从未覆盖 → F-03 照样全绿；已记 **Q-002**，路由第 8 步。
3. `client.ts` 的 8s/GET 重试/401 清态无任何用例，D-03 因此从 ✅ 降 ⚠️；建议 5B 用 `jest.mock('fetch')` + fake timers 补 3 条。
- 另：`jest.config.js:10` 把 e2e 与单测放在同一个 `npm test`，服务器未起时 10 条 e2e 连接失败（本次实测），建议拆分 `test:unit` / `test:e2e`，避免第 8 步误判「测试全红」。
- 归属：第 8 步（用例）+ 5A/5B（实现修复）。

### F-09（P3）管理页用户数用容量格式化

- `AdminScreen.tsx` 的 `formatVolume(userCount)` 会给用户数加千分位；数字本身不错，但语义工具用错。改 `String(userCount)`。
- 归属：5B 顺手。

### F-10（P3）D-30 映射描述漂移

- D-30 映射「端到端链路」列写返回 `status/db/uptime/version`，实际 `health.controller.ts:16-28` 只返回 `status/db/uptimeSec`，无 version。改描述即可，不影响验收。
- 归属：5.5 已记录；第 6 步按映射走查时按实际字段。

### F-11（P3）关键项审批无法绑 commit

- `git ls-files -- .` = 0：项目目录尚未纳入任何 commit；G5 要求关键项 `approved_commit` 与 HEAD 一致，当前填 — 只能视为「未审批」。
- 建议：5A/5B 修复后 `git add` + commit 本批代码，再由用户具名确认，避免「审批绑定一个不含代码的 HEAD」。
- 归属：用户 + 10.5 前置。

## 误报与已确认不修

- **手机号脱敏**：`admin.service.ts` 返回 `phoneMasked`，e2e#8 正则校验无 11 位号；不算「前端隐藏但后端泄露」。
- **CORS 无 Origin 放行**：RN 客户端请求不带 Origin，`!origin` 放行是正常路径；不是越权。
- **JWT 里 role 7 天内不随 DB 变化**：当前无改角色接口，接受；若后续加后台改角色，需强制重新登录。
- **DEMO_CODE=123456 在 `.env`**：演示设计且 `.env` 已被 `.gitignore` 排除，SAST 0 命中；不算硬编码 secret。
- **D-15 间距 20/12 非 8 倍数**：设计 token 体系允许 4/8/12/16/20/24/32，与基线一致，不算违规。
- **Docker 未运行导致 e2e 失败**：环境问题，不是代码失败；第 6 步需先 `start_all.ps1` 再跑。

## 闸门与下一步

- `python scripts/design_impl_check.py ... --stage 6` → **exit 1**：`27 ✅ / 16 ⚠️ / 7 ❌`；`--stage 4` → exit 0（结构未被改坏）。
- 5.5 判定：🔴 回 5A/5B。修复顺序建议：
  1. F-01（统计范围）、F-03（版本路径）、F-06（慢请求 warn）、F-07（唯一索引）——5A；
  2. F-02（跨 plan 语义 + 前端提示）、F-04（Expo 环境变量）、F-05（401 分支）——5A/5B；
  3. D-38~D-44 处置需用户拍板（见下）；
  4. 修完由**新实现者上下文**回写映射证据，再起独立复审（本 reviewer 可复审，但不得参与修复）。
- 打包范围决定（阻塞 5.5/6）：
  - **A. 现在做**：用户提供 `eas login`（账号+额度）并安装 Flutter → 按 T-703/704 做 APK/覆盖升级，再补 D-40/41/42~44；
  - **B. 正式砍**：改基线 C07/C08/C10/C11 与映射 D-38~D-44 为 `✂️`（需用户批准，作品集将少「可安装 APK / 跨框架」两项）；
  - **C. 先修代码，打包下次定**：本轮只清 4 条 P1 + P2，EAS/Flutter 暂挂；此选项下 5.5 仍不能绿（stage6 仍红），只能先保 RN 主线。
