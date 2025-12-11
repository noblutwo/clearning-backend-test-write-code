Tuyệt — mình sẽ thiết kế cho bạn **một hệ thống phức tạp, production-grade và dễ hiện thực** để bạn **code + stress test lên hàng ngàn users**. Mình sẽ nêu rõ **kiến trúc**, **thành phần**, **luồng dữ liệu**, **schema**, **worker logic**, **cấu hình stress-test**, **metrics / alert**, và **các kịch bản test**. Tất cả theo Postgres + TypeORM + BullMQ stack như bạn đang dùng.

Mình trình bày theo các phần để bạn dễ triển khai từng bước.

---

# 1 — Mục tiêu hệ thống (yêu cầu)

* Hỗ trợ **thousands concurrent users** đặt cược.
* Bảo đảm **money safety** (ledger append-only, idempotency).
* Dễ **scale** (API stateless, workers scale ngang).
* Có **backpressure**: queue / limiter để tránh sập DB.
* Có **observability** và **runbook**.

---

# 2 — Kiến trúc tổng quan (high-level)

```mermaid
flowchart LR
  Client -->|HTTP/WS| API[API (stateless)]
  API -->|Transaction A: wallet ledger + wallet update| DB[(Postgres)]
  API -->|enqueue job (match / settle)| Queue((BullMQ/Redis))
  Queue --> Worker[Worker pool (auto-match)]
  Worker -->|tx| DB
  Worker -->|if money op|| SettlementTx[Transaction(s) separate]
  Monitoring --> Grafana
  Logging --> ELK
```

Giải thích ngắn:

* API: chỉ làm Transaction A (trừ tiền + ghi ledger + tạo bet PENDING). Trả 202.
* Queue (BullMQ): job `match:{betId}` hoặc `settle:{matchId}` hoặc `refund:{betId}`.
* Worker: nhiều loại worker (matcher, settler, payout), mỗi worker tạo `QueryRunner` mới khi làm money ops.
* DB: wallets (state), wallet_ledgers (append-only), bets, matches.
* Observability: Prometheus/Grafana + logs.

---

# 3 — Thành phần chi tiết & công nghệ

* Language/Runtime: **Node.js (Bun OK)** hoặc plain Node.
* ORM: **TypeORM** (bạn đang dùng).
* Queue: **BullMQ** (Redis).
* DB: **Postgres** (WAL, PITR enabled).
* Monitoring: **Prometheus + Grafana**, Tracing: **OpenTelemetry**.
* Logs: **ELK** hoặc Loki.
* Infra: Kubernetes (recommended) / Docker Compose for local.
* Autoscale: HPA (k8s) based on queue length / CPU / DB connections.

---

# 4 — Data model (nhắc lại, production-ready)

**wallets (state)**

* id, user_id (unique), balance NUMERIC(30,8), locked_balance, version (optimistic), updated_at

**wallet_ledgers (append-only)**

* id uuid, user_id, amount, type, reference_id, idempotent_key (unique), balance_before, balance_after, created_at

**bets**

* id uuid, user_id, round_id, amount, side, status (PENDING/MATCHED/SETTLED/REFUNDED), created_at

**matches**

* id uuid, bet_a, bet_b, amount, created_at

(Use indexes shown trước; `ux_ledger_idempotent` must exist)

---

# 5 — Kịch bản xử lý (luồng chi tiết)

### API (Transaction A) — đặt cược

1. `withTransaction` (QueryRunner A)
2. check wallet balance
3. create `wallet_ledgers` row with idempotent_key `BET:{betId}`
4. update `wallets.balance -= amount`
5. insert `bets` row status=PENDING
6. commit
7. `queue.add('match', {betId})` (jobId: `match:{betId}`)

> Trả 202 Accepted với betId.

### Worker Matcher

1. Receive job `match:{betId}` (BullMQ)
2. Optional quick Redis lock `lock:bet:{betId}` (short TTL) — prevents thundering herd
3. Load bet (no tx). If not PENDING → skip
4. `withTransaction` (QueryRunner B):

   * reselect bet `FOR UPDATE` (pessimistic)
   * find opponent via `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1` to avoid race
   * if opponent found:

     * update both bets status= MATCHED
     * insert `matches` row
   * commit
5. If match results in immediate money ops (settlement), enqueue `settle:{matchId}` (separate job)

### Worker Settler (money ops)

1. Receive `settle:{matchId}` job
2. Determine payouts (winners)
3. `withTransaction` per user payout:

   * check idempotent_key `PAYOUT:{matchId}:{userId}` in wallet_ledgers
   * if not exist: insert ledger row + update wallet balance
4. commit — repeat per user (each as independent tx) or group per transaction if desired (but beware locks)

### Refund

* At round end, scan bets PENDING → enqueue `refund:{betId}`; for each refund: `withTransaction` create ledger with idempotent key `REFUND:{betId}`, update balance.

---

# 6 — Worker concurrency & DB strategy

* Use **SKIP LOCKED** pattern to let multiple workers pull disjoint rows.
* Workers should be **stateless** and horizontally scalable.
* Keep `worker.concurrency` low enough to avoid saturating DB: recommended start `5-10` per instance.
* DB pool size = `api_max_concurrency` + `sum(worker_concurrency_per_instance * instances)` + margin.

Example capacity planning:

* API Pods: 4 pods handling incoming requests (each up to 50 concurrent tx) → maybe 200 concurrent tx.
* Worker Pods: 10 pods × concurrency 5 → 50 concurrent tx.
* So DB pool ~ 300 + margin → maybe set max_connections accordingly (but mind Postgres maximum).

---

# 7 — Idempotency & uniqueness enforcement (practical)

* Every money operation must set `idempotent_key`.
* Use DB unique index to enforce.
* Implement optimistic insert approach: try insert ledger, catch unique violation → treat as idempotent hit.
* For jobs: set `jobId` in BullMQ equal to idempotent key to prevent enqueuing duplicates.

---

# 8 — Observability & metrics (must-have)

* API metrics: requests_total, requests_failed_total, request_duration_seconds (histogram).
* Worker metrics: jobs_processed_total, jobs_failed_total, job_duration_seconds.
* DB metrics: connections_active, lock_waits, deadlocks.
* Queue metrics: queue_length, delayed_count, stalled_count.
* Ledger audit metric: duplicates_detected.

Set alerts:

* queue_length > threshold
* job failure rate > 1%
* DB connections used > 80%
* p95 API latency > 1s
* duplicates_detected > 0

---

# 9 — Stress test design (concrete scenarios)

Design test scripts (using Bun/Node or k6/jMeter). Provide three types:

### A. Burst test (simultaneous single shot)

* N users fire 1 bet at t=0.
* Measure total_time to process all bets, success rate, p95,p99, queue_depth, DB connections peak.

### B. Sustained load (continuous)

* M concurrent users each send 1 bet per 1s for 60s.
* Measures throughput sustained, avg latency, p95.

### C. Adversarial tests

* Single-user spam: 1 user sends 50 concurrent bets (check overspend).
* DB slow: artificially add `pg_sleep(0.1)` in SQL (simulate slow DB) and test worker resilience.
* Worker crash: kill some worker instances during processing, ensure retry & idempotency.

**Example parameters to try:**

* 500, 1000, 2k, 5k concurrent in burst; sustained: 200→500→1000 RPS ramp.

---

# 10 — Concrete test script outline (pseudo)

`test-continuous.ts` (use fetch / axios):

* Create N users & fund them.
* For i from 1..durationSeconds:

  * spawn K parallel requests per second (controlled).
* Record per-request start/end, store latencies and status.
* Output p50/p95/p99, success/fail, total duration.

I can provide a ready-to-run Bun/Node test script if you want.

---

# 11 — Sample code snippets (quick references)

// withTransaction helper (TypeORM)

```ts
async function withTransaction<T>(ds: DataSource, fn: (em: EntityManager) => Promise<T>) {
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    const r = await fn(qr.manager);
    await qr.commitTransaction();
    return r;
  } catch (e) {
    await qr.rollbackTransaction();
    throw e;
  } finally {
    await qr.release();
  }
}
```

// Enqueue job with idempotent jobId

```ts
await queue.add('match', { betId }, { jobId: `match:${betId}`, attempts: 5, backoff: { type: 'exponential', delay: 1000 } });
```

// Insert ledger optimistic pattern

```ts
try {
  await manager.insert(WalletLedger, { userId, amount, type, referenceId, idempotentKey, balanceBefore, balanceAfter });
} catch (e) {
  if (isUniqueViolation(e)) {
    // idempotent hit -> ignore
  } else throw e;
}
```

---

# 12 — Deployment & infra notes

* Use k8s with HPA on CPU and custom metrics (queue_length).
* Use connection pooling middleware (pgbouncer) if many app instances.
* Use Postgres primary for writes; read replicas for readonly dashboards.
* Redis should be persistent and monitored (AOF).

---

# 13 — Runbook & emergency playbook (short)

* If queue length spikes: scale workers and increase TTLs; if DB pool saturated: throttle API (return 429), reduce worker concurrency.
* If duplication/double payout detected: set payouts_paused flag, run reconciliation, notify oncall, freeze outgoing transactions.

---

# 14 — Implementation plan (phased, actionable)

1. Implement schema and migrations (wallets, wallet_ledgers, bets, matches).
2. Implement `withTransaction` and API place-bet flow (Transaction A).
3. Add BullMQ queue, basic matcher worker (non-money).
4. Add setter worker for settle/payout with idempotency.
5. Add monitoring (Prometheus metrics).
6. Local stress-tests (200→500→1000 burst + sustained).
7. Tune DB pool and worker concurrency.
8. Run chaos tests (worker crash, DB slow).
9. Production rollout with feature flag and gradual ramp.

---

# 15 — Ready-made deliverables I can produce right now (pick any)

* A. Full **TypeORM migration SQL** file for the schema above.
* B. **Bun/Node stress-test script** `test-1000-continuous.ts` that does sustained load and outputs p50/p95/p99.
* C. **BullMQ matcher + settler** full TypeScript worker code (with SKIP LOCKED and idempotency).
* D. **Reconciliation script** (TS) + SQL checks.
* E. Add this whole architecture into your `full.md` (update canvas).

Bạn muốn mình bắt đầu với deliverable **A**, **B**, **C**, **D**, hay **E**? Hoặc bạn muốn mình vừa tạo migration + stress-test script + worker code (mình có thể gửi 2–3 file mẫu trong chat)?
