-- 同日唯一：一个用户一天只允许一条训练记录（F-07 并发双开的最终防线）
-- 若历史数据已有 (user_id, log_date) 重复，本迁移会失败并暴露脏数据；
-- 本地演示库处理方式：prisma migrate reset --force（会清空并按 seed 重建）。
CREATE UNIQUE INDEX "uk_workout_user_date" ON "workout_logs"("user_id", "log_date");
