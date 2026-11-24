-- 给当前登录账号（user_id=5，手机号 13600139000）补一套演示计划
-- 仅一次性使用；正式演示账号仍是 13900139000（user_id=2）
INSERT INTO plans (user_id, name, day_type, sort_no)
SELECT 5, '推日 · 胸肩三头', 'push', 1
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE user_id = 5 AND day_type = 'push');
INSERT INTO plans (user_id, name, day_type, sort_no)
SELECT 5, '拉日 · 背二头', 'pull', 2
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE user_id = 5 AND day_type = 'pull');
INSERT INTO plans (user_id, name, day_type, sort_no)
SELECT 5, '腿日 · 腿臀', 'legs', 3
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE user_id = 5 AND day_type = 'legs');

INSERT INTO exercises (plan_id, name, target_sets, target_reps, order_no)
SELECT p.id, v.name, 4, 10, v.ord
FROM plans p
JOIN (VALUES
  ('推日 · 胸肩三头','杠铃卧推',1),('推日 · 胸肩三头','上斜哑铃卧推',2),('推日 · 胸肩三头','哑铃飞鸟',3),
  ('推日 · 胸肩三头','双杠臂屈伸',4),('推日 · 胸肩三头','坐姿推肩',5),('推日 · 胸肩三头','哑铃侧平举',6),
  ('推日 · 胸肩三头','绳索下压',7),('推日 · 胸肩三头','仰卧臂屈伸',8),('推日 · 胸肩三头','窄距卧推',9),
  ('推日 · 胸肩三头','史密斯机推举',10),('推日 · 胸肩三头','俯卧撑',11),('推日 · 胸肩三头','器械夹胸',12),
  ('拉日 · 背二头','引体向上',1),('拉日 · 背二头','高位下拉',2),('拉日 · 背二头','杠铃划船',3),
  ('拉日 · 背二头','坐姿划船',4),('拉日 · 背二头','单臂哑铃划船',5),('拉日 · 背二头','直臂下压',6),
  ('拉日 · 背二头','面拉',7),('拉日 · 背二头','杠铃弯举',8),('拉日 · 背二头','哑铃锤式弯举',9),
  ('拉日 · 背二头','牧师凳弯举',10),('拉日 · 背二头','反向飞鸟',11),('拉日 · 背二头','耸肩',12),
  ('腿日 · 腿臀','杠铃深蹲',1),('腿日 · 腿臀','腿举',2),('腿日 · 腿臀','罗马尼亚硬拉',3),
  ('腿日 · 腿臀','腿屈伸',4),('腿日 · 腿臀','腿弯举',5),('腿日 · 腿臀','站姿提踵',6),
  ('腿日 · 腿臀','箭步蹲',7),('腿日 · 腿臀','保加利亚分腿蹲',8),('腿日 · 腿臀','臀桥',9),
  ('腿日 · 腿臀','髋外展',10),('腿日 · 腿臀','坐姿提踵',11),('腿日 · 腿臀','山羊挺身',12)
) AS v(plan_name, name, ord) ON p.name = v.plan_name AND p.user_id = 5
WHERE NOT EXISTS (
  SELECT 1 FROM exercises e WHERE e.plan_id = p.id AND e.order_no = v.ord
);
