# -*- coding: utf-8 -*-
"""性能压测：三档并发 × 两个核心读接口，输出 RPS / p50 / p95 / p99 / 错误率 / 拐点.

- 档位：10 / 20 / 50 并发，每档 10s（step08 §8.5.2）
- 目标：/plans（鉴权 + 3 查询，无缓存）、/workouts?page=1&size=20（鉴权 + 2 查询）
- 交叉复核：JMeter 未安装 → 用 urllib 独立客户端在 20 并发复测，偏差 ≤15% 视为可信（降级说明见 perf-report.md）
- 只读接口，不写数据；结果落 reports/perf.json
"""
from __future__ import annotations

import json
import statistics
import threading
import time
import urllib.request
from pathlib import Path

import httpx

BASE = "http://127.0.0.1:8094/api"
USER_PHONE = "13900139000"
DEMO_CODE = "123456"
DURATION = 10.0
LEVELS = [10, 20, 50]
TARGETS = ["/plans", "/workouts?page=1&size=20"]
OUT = Path(__file__).resolve().parent / "reports" / "perf.json"


def login() -> str:
    with httpx.Client(base_url=BASE, trust_env=False, timeout=10) as c:
        r = c.post("/auth/login", json={"phone": USER_PHONE, "code": DEMO_CODE})
        r.raise_for_status()
        return r.json()["data"]["token"]


def pct(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    idx = min(len(values) - 1, max(0, int(round((p / 100) * (len(values) - 1)))))
    return values[idx]


def run_load(path: str, token: str, concurrency: int) -> dict:
    latencies: list[float] = []
    errors: list[str] = []
    lock = threading.Lock()
    stop = threading.Event()
    start_gate = threading.Barrier(concurrency + 1)

    def worker() -> None:
        client = httpx.Client(
            base_url=BASE,
            trust_env=False,
            timeout=15,
            headers={"Authorization": f"Bearer {token}"},
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=10),
        )
        start_gate.wait()
        try:
            while not stop.is_set():
                t0 = time.perf_counter()
                try:
                    r = client.get(path)
                    ms = (time.perf_counter() - t0) * 1000
                    ok = r.status_code == 200 and r.json().get("code") == 0
                except Exception as exc:  # noqa: BLE001
                    ms = (time.perf_counter() - t0) * 1000
                    ok = False
                    with lock:
                        errors.append(type(exc).__name__)
                with lock:
                    latencies.append(ms)
                    if not ok:
                        errors.append("http_or_code")
        finally:
            client.close()

    threads = [threading.Thread(target=worker, daemon=True) for _ in range(concurrency)]
    for t in threads:
        t.start()
    start_gate.wait()
    t0 = time.perf_counter()
    time.sleep(DURATION)
    stop.set()
    elapsed = time.perf_counter() - t0
    for t in threads:
        t.join(timeout=20)

    total = len(latencies)
    err = len(errors)
    return {
        "path": path,
        "concurrency": concurrency,
        "seconds": round(elapsed, 2),
        "requests": total,
        "rps": round(total / elapsed, 2),
        "error_rate": round(err / total * 100, 2) if total else 0.0,
        "p50_ms": round(pct(latencies, 50), 1),
        "p95_ms": round(pct(latencies, 95), 1),
        "p99_ms": round(pct(latencies, 99), 1),
        "avg_ms": round(statistics.fmean(latencies), 1) if latencies else 0.0,
    }


def urllib_probe(path: str, token: str, concurrency: int, seconds: float = 5.0) -> dict:
    """第二套独立客户端（urllib，无连接池）交叉复核 20 并发档."""
    url = BASE + path
    lat: list[float] = []
    errs = 0
    lock = threading.Lock()
    stop = threading.Event()

    def worker() -> None:
        nonlocal errs
        while not stop.is_set():
            req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
            t0 = time.perf_counter()
            try:
                with urllib.request.urlopen(req, timeout=10) as resp:
                    body = json.loads(resp.read().decode("utf-8"))
                    ok = resp.status == 200 and body.get("code") == 0
            except Exception:  # noqa: BLE001
                ok = False
            ms = (time.perf_counter() - t0) * 1000
            with lock:
                lat.append(ms)
                if not ok:
                    errs += 1

    ts = [threading.Thread(target=worker, daemon=True) for _ in range(concurrency)]
    for t in ts:
        t.start()
    t0 = time.perf_counter()
    time.sleep(seconds)
    stop.set()
    elapsed = time.perf_counter() - t0
    for t in ts:
        t.join(timeout=15)
    return {
        "client": "urllib",
        "concurrency": concurrency,
        "requests": len(lat),
        "rps": round(len(lat) / elapsed, 2),
        "p95_ms": round(pct(lat, 95), 1),
        "error_rate": round(errs / len(lat) * 100, 2) if lat else 0.0,
    }


def main() -> None:
    token = login()
    results = []
    for path in TARGETS:
        print(f"\n=== {path} ===")
        print(f"{'并发':>4} {'请求数':>7} {'RPS':>7} {'p50':>7} {'p95':>7} {'p99':>7} {'错误率':>6}")
        for level in LEVELS:
            m = run_load(path, token, level)
            print(
                f"{m['concurrency']:>4} {m['requests']:>7} {m['rps']:>7} "
                f"{m['p50_ms']:>7} {m['p95_ms']:>7} {m['p99_ms']:>7} {m['error_rate']:>5}%"
            )
            results.append(m)

    cross = []
    for path in TARGETS:
        m = urllib_probe(path, token, 20)
        print(f"[cross] {path} urllib@20 rps={m['rps']} p95={m['p95_ms']}ms err={m['error_rate']}%")
        cross.append(m)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"main": results, "cross": cross}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[out] {OUT}")


if __name__ == "__main__":
    main()
