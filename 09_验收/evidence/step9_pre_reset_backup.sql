--
-- PostgreSQL database dump
--

\restrict AyGjmF0x2tJ3ETTV9d09A51180o0tWesnmG521pHzvFZNu4iYSE5Xkfc8IYbDlz

-- Dumped from database version 16.16
-- Dumped by pg_dump version 16.16

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.workout_logs DROP CONSTRAINT IF EXISTS workout_logs_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.workout_logs DROP CONSTRAINT IF EXISTS workout_logs_plan_id_fkey;
ALTER TABLE IF EXISTS ONLY public.set_logs DROP CONSTRAINT IF EXISTS set_logs_workout_log_id_fkey;
ALTER TABLE IF EXISTS ONLY public.set_logs DROP CONSTRAINT IF EXISTS set_logs_exercise_id_fkey;
ALTER TABLE IF EXISTS ONLY public.plans DROP CONSTRAINT IF EXISTS plans_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.exercises DROP CONSTRAINT IF EXISTS exercises_plan_id_fkey;
DROP INDEX IF EXISTS public.uk_workout_user_date;
DROP INDEX IF EXISTS public.uk_users_phone;
DROP INDEX IF EXISTS public.uk_set_logs;
DROP INDEX IF EXISTS public.idx_workout_user_date;
DROP INDEX IF EXISTS public.idx_plans_user_day;
DROP INDEX IF EXISTS public.idx_exercises_plan_order;
ALTER TABLE IF EXISTS ONLY public.workout_logs DROP CONSTRAINT IF EXISTS workout_logs_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.set_logs DROP CONSTRAINT IF EXISTS set_logs_pkey;
ALTER TABLE IF EXISTS ONLY public.plans DROP CONSTRAINT IF EXISTS plans_pkey;
ALTER TABLE IF EXISTS ONLY public.exercises DROP CONSTRAINT IF EXISTS exercises_pkey;
ALTER TABLE IF EXISTS ONLY public._prisma_migrations DROP CONSTRAINT IF EXISTS _prisma_migrations_pkey;
ALTER TABLE IF EXISTS public.workout_logs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.set_logs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.plans ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.exercises ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.workout_logs_id_seq;
DROP TABLE IF EXISTS public.workout_logs;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.set_logs_id_seq;
DROP TABLE IF EXISTS public.set_logs;
DROP SEQUENCE IF EXISTS public.plans_id_seq;
DROP TABLE IF EXISTS public.plans;
DROP SEQUENCE IF EXISTS public.exercises_id_seq;
DROP TABLE IF EXISTS public.exercises;
DROP TABLE IF EXISTS public._prisma_migrations;
-- *not* dropping schema, since initdb creates it
--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exercises (
    id bigint NOT NULL,
    plan_id bigint NOT NULL,
    name character varying(48) NOT NULL,
    target_sets smallint NOT NULL,
    target_reps smallint NOT NULL,
    order_no smallint NOT NULL,
    CONSTRAINT ck_exercises_order_no CHECK (((order_no >= 1) AND (order_no <= 200))),
    CONSTRAINT ck_exercises_target_reps CHECK (((target_reps >= 1) AND (target_reps <= 50))),
    CONSTRAINT ck_exercises_target_sets CHECK (((target_sets >= 1) AND (target_sets <= 10)))
);


--
-- Name: exercises_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exercises_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exercises_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exercises_id_seq OWNED BY public.exercises.id;


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    name character varying(32) NOT NULL,
    day_type character varying(8) NOT NULL,
    sort_no smallint DEFAULT 0 NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_plans_day_type CHECK (((day_type)::text = ANY ((ARRAY['push'::character varying, 'pull'::character varying, 'legs'::character varying])::text[])))
);


--
-- Name: plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plans_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plans_id_seq OWNED BY public.plans.id;


--
-- Name: set_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.set_logs (
    id bigint NOT NULL,
    workout_log_id bigint NOT NULL,
    exercise_id bigint NOT NULL,
    set_no smallint NOT NULL,
    weight numeric(6,2) DEFAULT 0 NOT NULL,
    reps smallint DEFAULT 0 NOT NULL,
    done boolean DEFAULT false NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_set_no CHECK (((set_no >= 1) AND (set_no <= 10))),
    CONSTRAINT ck_set_reps CHECK ((reps >= 0)),
    CONSTRAINT ck_set_weight CHECK ((weight >= (0)::numeric))
);


--
-- Name: set_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.set_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: set_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.set_logs_id_seq OWNED BY public.set_logs.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    phone character varying(11) NOT NULL,
    nickname character varying(32) DEFAULT '训练者'::character varying NOT NULL,
    role character varying(8) DEFAULT 'user'::character varying NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_users_role CHECK (((role)::text = ANY ((ARRAY['user'::character varying, 'admin'::character varying])::text[])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: workout_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workout_logs (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    plan_id bigint NOT NULL,
    log_date date NOT NULL,
    total_volume numeric(12,2) DEFAULT 0 NOT NULL,
    finished_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_workout_total_volume CHECK ((total_volume >= (0)::numeric))
);


--
-- Name: workout_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.workout_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workout_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.workout_logs_id_seq OWNED BY public.workout_logs.id;


--
-- Name: exercises id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises ALTER COLUMN id SET DEFAULT nextval('public.exercises_id_seq'::regclass);


--
-- Name: plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans ALTER COLUMN id SET DEFAULT nextval('public.plans_id_seq'::regclass);


--
-- Name: set_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.set_logs ALTER COLUMN id SET DEFAULT nextval('public.set_logs_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: workout_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_logs ALTER COLUMN id SET DEFAULT nextval('public.workout_logs_id_seq'::regclass);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
0a7a2a22-3be5-4a8e-b0eb-bb335591eedd	cf4ef5db4a7a6dc7d168e08eaaa7d24d29a6eb6b7f35becdd193055ae50a32e1	2026-11-25 17:02:22.503179+08	20261123092126_init	\N	\N	2026-11-25 17:02:22.394095+08	1
4bd46e7d-da40-4690-a660-735c579cddc1	67c63503640dc96a9fc4a3c81f5397036de176dc7d6525909f2bb28012e8bd9e	2026-11-25 17:02:22.515308+08	20261124090000_uk_workout_user_date	\N	\N	2026-11-25 17:02:22.505774+08	1
\.


--
-- Data for Name: exercises; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.exercises (id, plan_id, name, target_sets, target_reps, order_no) FROM stdin;
1	1	杠铃卧推	4	10	1
2	1	上斜哑铃卧推	4	10	2
3	1	哑铃飞鸟	4	10	3
4	1	双杠臂屈伸	4	10	4
5	1	坐姿推肩	4	10	5
6	1	哑铃侧平举	4	10	6
7	1	绳索下压	4	10	7
8	1	仰卧臂屈伸	4	10	8
9	1	窄距卧推	4	10	9
10	1	史密斯机推举	4	10	10
11	1	俯卧撑	4	10	11
12	1	器械夹胸	4	10	12
13	2	引体向上	4	10	1
14	2	高位下拉	4	10	2
15	2	杠铃划船	4	10	3
16	2	坐姿划船	4	10	4
17	2	单臂哑铃划船	4	10	5
18	2	直臂下压	4	10	6
19	2	面拉	4	10	7
20	2	杠铃弯举	4	10	8
21	2	哑铃锤式弯举	4	10	9
22	2	牧师凳弯举	4	10	10
23	2	反向飞鸟	4	10	11
24	2	耸肩	4	10	12
25	3	杠铃深蹲	4	10	1
26	3	腿举	4	10	2
27	3	罗马尼亚硬拉	4	10	3
28	3	腿屈伸	4	10	4
29	3	腿弯举	4	10	5
30	3	站姿提踵	4	10	6
31	3	箭步蹲	4	10	7
32	3	保加利亚分腿蹲	4	10	8
33	3	臀桥	4	10	9
34	3	髋外展	4	10	10
35	3	坐姿提踵	4	10	11
36	3	山羊挺身	4	10	12
37	4	杠铃卧推	4	10	1
38	4	上斜哑铃卧推	4	10	2
39	4	哑铃飞鸟	4	10	3
40	4	双杠臂屈伸	4	10	4
41	4	坐姿推肩	4	10	5
42	4	哑铃侧平举	4	10	6
43	4	绳索下压	4	10	7
44	4	仰卧臂屈伸	4	10	8
45	4	窄距卧推	4	10	9
46	4	史密斯机推举	4	10	10
47	4	俯卧撑	4	10	11
48	4	器械夹胸	4	10	12
49	5	引体向上	4	10	1
50	5	高位下拉	4	10	2
51	5	杠铃划船	4	10	3
52	5	坐姿划船	4	10	4
53	5	单臂哑铃划船	4	10	5
54	5	直臂下压	4	10	6
55	5	面拉	4	10	7
56	5	杠铃弯举	4	10	8
57	5	哑铃锤式弯举	4	10	9
58	5	牧师凳弯举	4	10	10
59	5	反向飞鸟	4	10	11
60	5	耸肩	4	10	12
61	6	杠铃深蹲	4	10	1
62	6	腿举	4	10	2
63	6	罗马尼亚硬拉	4	10	3
64	6	腿屈伸	4	10	4
65	6	腿弯举	4	10	5
66	6	站姿提踵	4	10	6
67	6	箭步蹲	4	10	7
68	6	保加利亚分腿蹲	4	10	8
69	6	臀桥	4	10	9
70	6	髋外展	4	10	10
71	6	坐姿提踵	4	10	11
72	6	山羊挺身	4	10	12
\.


--
-- Data for Name: plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plans (id, user_id, name, day_type, sort_no, created_at) FROM stdin;
1	1	推日 · 胸肩三头	push	1	2026-11-25 09:02:32.382+08
2	1	拉日 · 背二头	pull	2	2026-11-25 09:02:32.455+08
3	1	腿日 · 腿臀	legs	3	2026-11-25 09:02:32.519+08
4	2	推日 · 胸肩三头	push	1	2026-11-25 09:02:32.579+08
5	2	拉日 · 背二头	pull	2	2026-11-25 09:02:32.641+08
6	2	腿日 · 腿臀	legs	3	2026-11-25 09:02:32.712+08
\.


--
-- Data for Name: set_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.set_logs (id, workout_log_id, exercise_id, set_no, weight, reps, done, created_at, updated_at) FROM stdin;
99	20	71	1	40.00	10	t	2026-11-25 09:46:03.768+08	2026-11-25 09:46:03.768+08
100	20	72	1	30.00	10	t	2026-11-25 09:46:03.794+08	2026-11-25 09:46:03.794+08
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, phone, nickname, role, created_at) FROM stdin;
1	13800138000	管理员	admin	2026-11-25 09:02:32.337+08
2	13900139000	训练者	user	2026-11-25 09:02:32.365+08
9	13600000999	训练者	user	2026-11-25 09:45:54.38+08
\.


--
-- Data for Name: workout_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workout_logs (id, user_id, plan_id, log_date, total_volume, finished_at, created_at) FROM stdin;
19	1	3	2026-11-25	0.00	2026-11-25 09:45:56.292+08	2026-11-25 09:45:49.326+08
20	2	6	2026-11-25	700.00	2026-11-25 09:46:03.824+08	2026-11-25 09:45:50.923+08
\.


--
-- Name: exercises_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.exercises_id_seq', 72, true);


--
-- Name: plans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.plans_id_seq', 6, true);


--
-- Name: set_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.set_logs_id_seq', 100, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 9, true);


--
-- Name: workout_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.workout_logs_id_seq', 21, true);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: exercises exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_pkey PRIMARY KEY (id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: set_logs set_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.set_logs
    ADD CONSTRAINT set_logs_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: workout_logs workout_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_logs
    ADD CONSTRAINT workout_logs_pkey PRIMARY KEY (id);


--
-- Name: idx_exercises_plan_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exercises_plan_order ON public.exercises USING btree (plan_id, order_no);


--
-- Name: idx_plans_user_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plans_user_day ON public.plans USING btree (user_id, day_type);


--
-- Name: idx_workout_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workout_user_date ON public.workout_logs USING btree (user_id, log_date DESC);


--
-- Name: uk_set_logs; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_set_logs ON public.set_logs USING btree (workout_log_id, exercise_id, set_no);


--
-- Name: uk_users_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_users_phone ON public.users USING btree (phone);


--
-- Name: uk_workout_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_workout_user_date ON public.workout_logs USING btree (user_id, log_date);


--
-- Name: exercises exercises_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: plans plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: set_logs set_logs_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.set_logs
    ADD CONSTRAINT set_logs_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: set_logs set_logs_workout_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.set_logs
    ADD CONSTRAINT set_logs_workout_log_id_fkey FOREIGN KEY (workout_log_id) REFERENCES public.workout_logs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: workout_logs workout_logs_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_logs
    ADD CONSTRAINT workout_logs_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: workout_logs workout_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_logs
    ADD CONSTRAINT workout_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict AyGjmF0x2tJ3ETTV9d09A51180o0tWesnmG521pHzvFZNu4iYSE5Xkfc8IYbDlz

