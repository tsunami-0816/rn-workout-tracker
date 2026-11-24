# APK 留档目录（D-38 / D-40）

构建产物按版本命名，便于回滚与更新弹窗直接下载：

| 文件 | 版本 | versionCode | 来源 | SHA256 |
|---|---|---|---|---|
| `rn-workout-1.0.0.apk` | 1.0.0 | 1 | 待 EAS `preview` 构建 | 待填 |
| `rn-workout-1.0.1.apk` | 1.0.1 | 2 | 待 EAS `preview` 构建 | 待填 |

- 下载地址：后端已把本目录挂到 `http://<host>:8094/apk/`，`release.json` 的 `apkUrl` 指向对应文件。
- 真机安装时 host 必须是手机能访问的局域网 IP（不能写 `127.0.0.1`）。
- 校验：`Get-FileHash .\rn-workout-1.0.0.apk -Algorithm SHA256`。
- 回滚：把 `release.json` 改回上一版本的 `version` / `buildNo` / `apkUrl`，保留旧 APK 不删即可。
