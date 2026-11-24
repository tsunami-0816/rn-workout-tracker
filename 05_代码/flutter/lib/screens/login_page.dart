import 'package:material_ui/material_ui.dart';

import '../api_client.dart';

/// D-42：同一 /auth/login 契约（手机号 + 演示验证码），成功后把 token 交给根 State 并跳列表。
class LoginPage extends StatefulWidget {
  const LoginPage({
    super.key,
    required this.api,
    required this.onLoggedIn,
    this.autoLogin = false,
  });

  final ApiClient api;
  final ValueChanged<LoginResult> onLoggedIn;
  final bool autoLogin;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final TextEditingController _phone = TextEditingController(text: '13900139000');
  final TextEditingController _code = TextEditingController(text: '123456');
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.autoLogin) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _submit());
    }
  }

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await widget.api.login(_phone.text.trim(), _code.text.trim());
      if (!mounted) return;
      widget.onLoggedIn(result);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = '网络异常，请检查后端 8094 是否已启动');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 360),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _BrandLine(subtitle: 'Flutter 对照实现 · 登录'),
                  const SizedBox(height: 24),
                  Text('训练台账', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  const Text('演示账号已预填；密码固定为 123456（服务端 DEMO_CODE）。',
                      style: TextStyle(color: Color(0xFF5A6068), fontSize: 13, height: 1.5)),
                  const SizedBox(height: 20),
                  _field(label: '手机号', controller: _phone, keyboardType: TextInputType.phone),
                  const SizedBox(height: 12),
                  _field(label: '验证码', controller: _code, keyboardType: TextInputType.number),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: Color(0xFFB42318), fontSize: 13)),
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: FilledButton(
                      onPressed: _loading ? null : _submit,
                      style: FilledButton.styleFrom(backgroundColor: const Color(0xFF1D6B58)),
                      child: _loading
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('登录'),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text('说明：Flutter 侧只把 token 保存在内存，刷新页面需重新登录；RN 侧用 SecureStore 持久化。',
                      style: TextStyle(color: Color(0xFF6B7278), fontSize: 12, height: 1.5)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _field({required String label, required TextEditingController controller, TextInputType? keyboardType}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF5A6068))),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          decoration: InputDecoration(
            filled: true,
            fillColor: const Color(0xFFEDEFEA),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFDEE2DA))),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFDEE2DA))),
          ),
        ),
      ],
    );
  }
}

class _BrandLine extends StatelessWidget {
  const _BrandLine({required this.subtitle});

  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: const BoxDecoration(color: Color(0xFF1D6B58), shape: BoxShape.circle),
        ),
        const SizedBox(width: 8),
        const Text('训练台账', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        const SizedBox(width: 8),
        Text(subtitle, style: const TextStyle(fontSize: 12, color: Color(0xFF6B7278))),
      ],
    );
  }
}
