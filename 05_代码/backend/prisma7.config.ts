// Prisma 7 配置：schema / 迁移 / seed / 数据源 URL 的唯一入口
// 注意：DATABASE_URL 只从 .env 读（由 dotenv/config 注入），代码里不写死连接串
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "ts-node --transpile-only prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
