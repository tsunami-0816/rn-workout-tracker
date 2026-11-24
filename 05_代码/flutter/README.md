# Flutter 对照实现（D-42 / D-43）

两页：登录（`/api/auth/login`）→ 动作列表（`/api/plans/{id}/exercises`）。

## 环境

- Flutter 3.50.1 stable（Dart 3.14.0），安装位置 `D:\flutter_sdk\flutter`
- 已写入用户 PATH；国内镜像环境变量 `PUB_HOSTED_URL` / `FLUTTER_STORAGE_BASE_URL` 已设为 flutter-io.cn
- 浏览器：本机无 Chrome，用 Edge（Chromium）做 headless 截图

## 运行

```powershell
cd 05_代码\flutter
flutter pub get
flutter run -d chrome          # 开发（需 Chrome；本机可用 msedge 通过 CHROME_EXECUTABLE 指定）
flutter build web --release --dart-define=API_BASE=http://127.0.0.1:8094/api
python -m http.server 8097 --directory build\web
```

打开 `http://127.0.0.1:8097/`，用演示账号 `13900139000 / 123456` 登录。

## 证据截图

- `09_验收/flutter_login.png`：登录页（真实构建，无自动登录）
- `09_验收/flutter_list.png`：列表页 12 个动作（证据构建 `--dart-define=DEMO_AUTOLOGIN=true`，登录仍走真实接口）

## 已知边界

- token 仅内存保存，刷新需重新登录。
- 无超时 / 重试 / 401 清态；与 RN 的差异见 `10_交付/跨框架差异表.md`。
- 本轮仅构建 Web，未构建 Android APK（本机无 Android SDK）。
