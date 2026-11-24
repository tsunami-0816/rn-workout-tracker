# 训练台账 · RN App（Expo 58）

一个 6 屏 + admin 子页的力量训练记录 App：手机号验证码登录、三日分化计划、组次记录与乐观提交、周统计、全站只读视图。后端同仓库 `05_代码/backend`（端口 8094）。

## 环境

- Node 22（已验证 22.23.2）
- npm 10+
- 手机装 Expo Go（真机验证）；无需 Android SDK
- 后端 PostgreSQL 5434 / API 8094 已由 `scripts/start_all.ps1` 启动

## 安装与启动

```powershell
cd 05_代码\frontend
npm install
npm start        # Expo dev server 8096
```

启动成功的标志：
- 终端出现二维码；
- 浏览器/手机探活 `http://<PC-IP>:8096/status` 返回 `packager-status:running`。

## 真机联调（关键）

手机不能访问 `127.0.0.1`。两种方式：

1. **自动推导（默认）**：App 读取 Expo 的 `hostUri`，取 PC 局域网 IP 拼 `http://<IP>:8094/api`。
2. **显式覆盖**：
   ```powershell
   $env:EXPO_PUBLIC_API_BASE_URL="http://192.168.1.23:8094/api"
   npm start
   ```
   `ipconfig` 取 IPv4；手机与 PC 同一 Wi-Fi；Windows 防火墙放行 Node 的 8094/8096（专用网络）。
   先用手机浏览器打开 `http://<IP>:8094/api/health` 自证网络通。

演示登录：手机号任意合法 11 位（如 `13900139000`），验证码以服务端 `.env` 的 `DEMO_CODE` 为准（客户端不写死）。
管理员账号：seed admin 手机号 `13800138000`（验证码同上），登录后「我的」页出现「全站打卡」入口。

## 验证命令

```powershell
npm test           # jest-expo 纯函数单测（19 条）
npm run build      # expo export android，生产 bundle 验证
npx tsc --noEmit   # 严格类型检查
```

## 性能测试开关（C02）

```powershell
$env:EXPO_PUBLIC_PERF_FIXTURE="1"; npm start
```
今日训练列表会在真实动作后追加 100 条夹具（负数 id，不参与提交），用于 60s 连续滚动采样。行高固定 64，`getItemLayout`/`windowSize=7` 已生效。

## 目录速读

- `src/api/client.ts`：唯一请求出口（8s 超时、GET 重试 1 次、Token、401 清态、中文错误码）
- `src/storage/authStorage.ts`：SecureStore 主，AsyncStorage 降级
- `src/navigation/RootNavigator.tsx`：AuthStack + MainTabs + Stack
- `src/screens/`：Login / Plans / Workout / Log / Stats / Profile / Admin
- `src/components/`：Screen / AppHeader / AppButton / Stepper / SetRow / StateView / ToastHost

## 常见问题

| 现象 | 处理 |
|---|---|
| 8096 端口被占 | 关掉旧 Metro（`Ctrl+C`），或 `npx expo start --port 8097`（同步改端口表） |
| 手机红屏 `Network request failed` | 检查手机与 PC 同网、`EXPO_PUBLIC_API_BASE_URL` 用局域网 IP、8094 防火墙放行 |
| 登录提示「登录已过期」 | 后端重启导致 token 失效；重新登录即可 |
| 统计页一直 0 | 先完成一次训练；服务端写入后缓存失效，下拉重试/重进页面 |
| `npm run build` 报依赖不兼容 | 不要手升版本；按 `package.json` 锁定值重装（`rm -rf node_modules && npm ci`） |

## 不在本 App 内

- 不做 iOS ipa（无 Mac / 开发者账号；iOS 仅 Expo Go 内跑）
- 不做本地 Android 打包（无 SDK）；APK 走 EAS 云端（`eas.json` 已配 preview=APK）
- 不做 Web 管理后台、支付/推送、图表库；统计柱图是纯 View
