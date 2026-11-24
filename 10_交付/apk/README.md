# APK 留档目录（D-38 / D-40）

构建产物按版本命名，便于回滚与更新弹窗直接下载：

| 文件 | 版本 | versionCode | 来源 | SHA256 |
|---|---|---|---|---|
| `rn-workout-1.0.0.apk`（同内容别名 `rn-workout-1.0.0-lan.apk`） | 1.0.0 | 1 | EAS `preview` 构建 `3189e39c-1c0f-4e57-937b-d4af2d5da0ce`（FINISHED，73.83 MB，已注入局域网 API + 允许 HTTP 明文） | `08862674DDF9A697B32E7F6D3A434D21FE2B2F65793DFA81598400DADAFB98F7` |
| `rn-workout-1.0.1.apk` | 1.0.1 | 2 | EAS `preview` 构建 `71131a9d-c55a-4003-b397-86454f1929de`（FINISHED，73.83 MB，覆盖安装验证登录态保留） | `3507493331FB3F5AEC17C85C119BB6462C47C50134197CA5D7E5BB7BD030896D` |

- 下载地址：后端已把本目录挂到 `http://<host>:8094/apk/`，`release.json` 的 `apkUrl` 指向对应文件。
- 真机安装时 host 必须是手机能访问的局域网 IP（不能写 `127.0.0.1`）。
- 校验：`Get-FileHash .\rn-workout-1.0.0.apk -Algorithm SHA256`。
- 回滚：把 `release.json` 改回上一版本的 `version` / `buildNo` / `apkUrl`，保留旧 APK 不删即可。
