import 'package:material_ui/material_ui.dart';

import 'api_client.dart';
import 'screens/list_page.dart';
import 'screens/login_page.dart';

/// 证据构建可用 `--dart-define=DEMO_AUTOLOGIN=true` 打开自动登录（默认 false）。
/// 正式构建不要带这个开关；登录动作本身仍走真实 POST /auth/login。
const bool kDemoAutoLogin = bool.fromEnvironment('DEMO_AUTOLOGIN', defaultValue: false);

void main() {
  runApp(const WorkoutApp());
}

class WorkoutApp extends StatefulWidget {
  const WorkoutApp({super.key});

  @override
  State<WorkoutApp> createState() => _WorkoutAppState();
}

class _WorkoutAppState extends State<WorkoutApp> {
  final ApiClient _api = ApiClient();
  String? _token;
  String _nickname = '';

  void _onLoggedIn(LoginResult result) {
    setState(() {
      _token = result.token;
      _nickname = result.nickname;
    });
  }

  void _signOut() {
    setState(() {
      _token = null;
      _nickname = '';
    });
  }

  @override
  Widget build(BuildContext context) {
    const accent = Color(0xFF1D6B58);
    return MaterialApp(
      title: '训练台账 · Flutter',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        scaffoldBackgroundColor: const Color(0xFFF4F5F2),
        colorScheme: ColorScheme.fromSeed(seedColor: accent, surface: Colors.white),
        useMaterial3: true,
      ),
      home: _token == null
          ? LoginPage(api: _api, autoLogin: kDemoAutoLogin, onLoggedIn: _onLoggedIn)
          : ListPage(api: _api, token: _token!, nickname: _nickname, onSignOut: _signOut),
    );
  }
}
