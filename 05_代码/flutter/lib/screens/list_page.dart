import 'package:material_ui/material_ui.dart';

import '../api_client.dart';

/// D-43：带 token GET /plans/{id}/exercises，用 ListView.builder + 固定 itemExtent 渲染 12 个动作。
/// 顶部可切换推 / 拉 / 腿三份计划，切换后重新拉动作。
class ListPage extends StatefulWidget {
  const ListPage({
    super.key,
    required this.api,
    required this.token,
    required this.nickname,
    required this.onSignOut,
  });

  final ApiClient api;
  final String token;
  final String nickname;
  final VoidCallback onSignOut;

  @override
  State<ListPage> createState() => _ListPageState();
}

class _ListPageState extends State<ListPage> {
  List<PlanSummary> _plans = const [];
  int? _selectedPlanId;
  List<ExerciseItem> _exercises = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPlans();
  }

  Future<void> _loadPlans() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final plans = await widget.api.plans(widget.token);
      setState(() {
        _plans = plans;
        _selectedPlanId = plans.isEmpty ? null : plans.first.id;
      });
      if (_selectedPlanId != null) {
        await _loadExercises(_selectedPlanId!);
      } else {
        setState(() => _loading = false);
      }
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _error = '网络异常：确认后端 8094 已启动、浏览器能访问 http://127.0.0.1:8094/api/health';
        _loading = false;
      });
    }
  }

  Future<void> _loadExercises(int planId) async {
    setState(() {
      _loading = true;
      _selectedPlanId = planId;
      _error = null;
    });
    try {
      final items = await widget.api.exercises(widget.token, planId);
      setState(() {
        _exercises = items;
        _loading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _error = '网络异常，请重试';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final selected = _plans.where((p) => p.id == _selectedPlanId).toList();
    final planName = selected.isEmpty ? '动作清单' : selected.first.name;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFFF4F5F2),
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(planName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text('${widget.nickname} · ${_exercises.length} 个动作',
                style: const TextStyle(fontSize: 12, color: Color(0xFF5A6068))),
          ],
        ),
        actions: [
          IconButton(
            tooltip: '退出登录',
            onPressed: widget.onSignOut,
            icon: const Icon(Icons.logout, size: 20),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                  child: SizedBox(
                    height: 40,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _plans.length,
                      separatorBuilder: (context, index) => const SizedBox(width: 8),
                      itemBuilder: (context, index) {
                        final plan = _plans[index];
                        final active = plan.id == _selectedPlanId;
                        return ChoiceChip(
                          label: Text('${plan.dayType} · ${plan.weekDone} 次/周'),
                          selected: active,
                          onSelected: _loading ? null : (_) => _loadExercises(plan.id),
                          selectedColor: const Color(0xFFE2EFEB),
                          side: BorderSide(color: active ? const Color(0xFF1D6B58) : const Color(0xFFDEE2DA)),
                          labelStyle: TextStyle(
                            color: active ? const Color(0xFF1D6B58) : const Color(0xFF14171A),
                            fontSize: 12,
                          ),
                        );
                      },
                    ),
                  ),
                ),
                const Divider(height: 1, color: Color(0xFFDEE2DA)),
                Expanded(child: _body()),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _body() {
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error!, style: const TextStyle(color: Color(0xFFB42318))),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: _loadPlans, child: const Text('重试')),
          ],
        ),
      );
    }
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_exercises.isEmpty) {
      return const Center(child: Text('这份计划下还没有动作'));
    }
    return ListView.builder(
      itemCount: _exercises.length,
      itemExtent: 64,
      itemBuilder: (context, index) {
        final item = _exercises[index];
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: Color(0xFFDEE2DA))),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              SizedBox(
                width: 28,
                child: Text('${item.orderNo}',
                    textAlign: TextAlign.right,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF6B7278), fontFeatures: [FontFeature.tabularFigures()])),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 2),
                    Text('${item.targetSets} 组 × ${item.targetReps} 次',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF5A6068))),
                  ],
                ),
              ),
              const Text('记录', style: TextStyle(fontSize: 13, color: Color(0xFF1D6B58), fontWeight: FontWeight.w600)),
            ],
          ),
        );
      },
    );
  }
}
