-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "phone" VARCHAR(11) NOT NULL,
    "nickname" VARCHAR(32) NOT NULL DEFAULT '训练者',
    "role" VARCHAR(8) NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "day_type" VARCHAR(8) NOT NULL,
    "sort_no" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" BIGSERIAL NOT NULL,
    "plan_id" BIGINT NOT NULL,
    "name" VARCHAR(48) NOT NULL,
    "target_sets" SMALLINT NOT NULL,
    "target_reps" SMALLINT NOT NULL,
    "order_no" SMALLINT NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "plan_id" BIGINT NOT NULL,
    "log_date" DATE NOT NULL,
    "total_volume" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "set_logs" (
    "id" BIGSERIAL NOT NULL,
    "workout_log_id" BIGINT NOT NULL,
    "exercise_id" BIGINT NOT NULL,
    "set_no" SMALLINT NOT NULL,
    "weight" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "reps" SMALLINT NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "set_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uk_users_phone" ON "users"("phone");

-- CreateIndex
CREATE INDEX "idx_plans_user_day" ON "plans"("user_id", "day_type");

-- CreateIndex
CREATE INDEX "idx_exercises_plan_order" ON "exercises"("plan_id", "order_no");

-- CreateIndex
CREATE INDEX "idx_workout_user_date" ON "workout_logs"("user_id", "log_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uk_set_logs" ON "set_logs"("workout_log_id", "exercise_id", "set_no");

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_workout_log_id_fkey" FOREIGN KEY ("workout_log_id") REFERENCES "workout_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint（Prisma schema 不支持 CHECK，按架构 §5.2 DDL 手工补齐）
ALTER TABLE "users" ADD CONSTRAINT "ck_users_role" CHECK ("role" IN ('user','admin'));
ALTER TABLE "plans" ADD CONSTRAINT "ck_plans_day_type" CHECK ("day_type" IN ('push','pull','legs'));
ALTER TABLE "exercises" ADD CONSTRAINT "ck_exercises_target_sets" CHECK ("target_sets" BETWEEN 1 AND 10);
ALTER TABLE "exercises" ADD CONSTRAINT "ck_exercises_target_reps" CHECK ("target_reps" BETWEEN 1 AND 50);
ALTER TABLE "exercises" ADD CONSTRAINT "ck_exercises_order_no" CHECK ("order_no" BETWEEN 1 AND 200);
ALTER TABLE "workout_logs" ADD CONSTRAINT "ck_workout_total_volume" CHECK ("total_volume" >= 0);
ALTER TABLE "set_logs" ADD CONSTRAINT "ck_set_no" CHECK ("set_no" BETWEEN 1 AND 10);
ALTER TABLE "set_logs" ADD CONSTRAINT "ck_set_weight" CHECK ("weight" >= 0);
ALTER TABLE "set_logs" ADD CONSTRAINT "ck_set_reps" CHECK ("reps" >= 0);
