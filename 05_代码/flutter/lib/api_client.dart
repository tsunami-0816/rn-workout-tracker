import 'dart:convert';

import 'package:http/http.dart' as http;

/// 与 RN 侧 `src/api/client.ts` 对齐的最小客户端：
/// - 同一个后端 /api 前缀与 {code,message,data} 信封
/// - Bearer token 注入，非 0 code 抛中文业务错误
class ApiException implements Exception {
  ApiException(this.code, this.message);

  final int code;
  final String message;

  @override
  String toString() => '[$code] $message';
}

class PlanSummary {
  PlanSummary({required this.id, required this.name, required this.dayType, required this.weekDone});

  factory PlanSummary.fromJson(Map<String, dynamic> json) => PlanSummary(
        id: json['id'] as int,
        name: json['name'] as String,
        dayType: json['dayType'] as String,
        weekDone: json['weekDone'] as int? ?? 0,
      );

  final int id;
  final String name;
  final String dayType;
  final int weekDone;
}

class ExerciseItem {
  ExerciseItem({
    required this.id,
    required this.name,
    required this.targetSets,
    required this.targetReps,
    required this.orderNo,
  });

  factory ExerciseItem.fromJson(Map<String, dynamic> json) => ExerciseItem(
        id: json['id'] as int,
        name: json['name'] as String,
        targetSets: json['targetSets'] as int,
        targetReps: json['targetReps'] as int,
        orderNo: json['orderNo'] as int,
      );

  final int id;
  final String name;
  final int targetSets;
  final int targetReps;
  final int orderNo;
}

class LoginResult {
  LoginResult({required this.token, required this.nickname});

  final String token;
  final String nickname;
}

class ApiClient {
  ApiClient({String? baseUrl}) : baseUrl = baseUrl ?? _defaultBaseUrl;

  /// 可用 `flutter run --dart-define=API_BASE=http://192.168.x.x:8094/api` 覆盖
  static const String _defaultBaseUrl = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'http://127.0.0.1:8094/api',
  );

  final String baseUrl;

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body) async {
    final response = await http.post(
      Uri.parse('$baseUrl$path'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    return _unwrap(response);
  }

  Future<Map<String, dynamic>> _get(String path, String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl$path'),
      headers: {'Authorization': 'Bearer $token'},
    );
    return _unwrap(response);
  }

  Map<String, dynamic> _unwrap(http.Response response) {
    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      throw ApiException(-1, '响应格式异常（HTTP ${response.statusCode}）');
    }
    final code = decoded['code'] as int? ?? -1;
    if (code != 0) {
      throw ApiException(code, (decoded['message'] as String?) ?? '请求失败');
    }
    return decoded['data'] as Map<String, dynamic>;
  }

  Future<LoginResult> login(String phone, String code) async {
    final data = await _post('/auth/login', {'phone': phone, 'code': code});
    final user = data['user'] as Map<String, dynamic>;
    return LoginResult(token: data['token'] as String, nickname: user['nickname'] as String);
  }

  Future<List<PlanSummary>> plans(String token) async {
    final data = await _get('/plans', token);
    final list = data['list'] as List<dynamic>;
    return list.map((item) => PlanSummary.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<List<ExerciseItem>> exercises(String token, int planId) async {
    final data = await _get('/plans/$planId/exercises', token);
    final list = data['list'] as List<dynamic>;
    return list.map((item) => ExerciseItem.fromJson(item as Map<String, dynamic>)).toList();
  }
}
