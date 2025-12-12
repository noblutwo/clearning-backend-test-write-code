# 🧠 Senior Backend – Full Guide về Transaction, Auto‑Match & Refund (Production Ready)

> **Mục tiêu tài liệu**
>
> * Giải thích chuẩn Senior backend cách xử lý **tiền + concurrency + scale**
> * Trả lời dứt điểm câu hỏi: *"Tách auto‑match ra worker thì refund xử lý thế nào?"*
> * Tránh **rollback sai**, **double‑refund**, **mất tiền** khi scale lớn
>
> 📌 Đây là kiến thức **thực chiến production**, không phải lý thuyết sách.

---

## 1️⃣ Nguyên tắc vàng trong hệ thống có tiền

> 🔑 **NGUYÊN TẮC VÀNG: Mỗi thay đổi tiền = 1 Transaction độc lập**
>
> ✅ **Áp dụng cho:**
> - Bet placement: Transaction A (trừ tiền)
> - Refund: Transaction B (hoàn tiền nếu cần)
> - Settlement: Transaction C (thanh toán thắng/thua)
> - Payout: Transaction D (nếu cần)
>
> ❌ **TUYỆT ĐỐI KHÔNG LÀM:**
> - Gộp chúng vào 1 transaction lớn
> - Reuse QueryRunner sau commit
> - Rollback transaction đã commit
> - Dựa vào try/catch để quản lý tiền

* Transaction **đã commit → KHÔNG rollback lại**
* Refund **không phải rollback**, mà là **một giao dịch mới**
* Logic tiền **dựa trên trạng thái (state)**, không dựa trên try/catch

👉 Đây là khác biệt lớn nhất giữa **Mid** và **Senior backend**.

---

## 2️⃣ Kiến trúc đang dùng (đúng nhưng chưa scale tốt)

```
Client
  ↓
API
  ↓
Transaction (queryRunner.manager)
  ↓
Auto‑match (nặng)
  ↓
Commit
```

### ✅ Vì sao cách này AN TOÀN tiền?

* Trừ tiền, tạo bet, match nằm **cùng 1 transaction**
* Nếu lỗi → rollback toàn bộ
* Đảm bảo ACID

### ❌ Vì sao KHÔNG scale?

* Transaction giữ DB connection lâu
* Auto‑match không có thời gian cố định
* Lock nhiều row → contention
* p95/p99 tăng nhanh khi load cao

👉 **An toàn ≠ scale được**

---

## 3️⃣ Tư duy Senior: Tách transaction theo trách nhiệm

### 🔹 Transaction chỉ dùng để **bảo vệ tiền**

### 🔹 Worker / Queue dùng để **bảo vệ hiệu năng**

---

## 4️⃣ Kiến trúc chuẩn khi scale (Production Pattern)

### ✅ Tổng quan

```
Client
  ↓
API
  ↓
Transaction A (Money Safe)
  ↓
Commit
  ↓
Queue (Redis / BullMQ)
  ↓
Worker Auto‑Match
```

---

## 5️⃣ Transaction A – Khi user đặt cược (BẮT BUỘC)

```ts
BEGIN TRANSACTION
  lock user (pessimistic_write)
  if balance < amount → throw
  user.balance -= amount
  insert bet (status = PENDING)
COMMIT
```

✅ Tiền đã được giữ (escrow logic)
✅ Bet được ghi nhận
✅ Transaction này **không bao giờ rollback lại**

---

## 6️⃣ Auto‑Match – Chạy async trong Worker (KHÔNG ĐỤNG TIỀN)

```ts
BEGIN TRANSACTION
  lock bet
  tìm bet đối ứng
  nếu match được:
    update bet.status = MATCHED
    create match record
COMMIT
```

✅ Fail → rollback transaction này
✅ Retry an toàn
✅ Không ảnh hưởng tiền user

---

## 7️⃣ VẤN ĐỀ KHÓ: Không match được → Refund thế nào?

> ⚠️ Đây là chỗ nhiều hệ thống scale bị **mất tiền** nếu làm sai

---

## 8️⃣ Refund CHUẨN SENIOR (Transaction C – độc lập)

### 📌 Điều kiện refund

* Round kết thúc
* Bet vẫn `PENDING`
* Không match được

### ✅ Refund đúng cách

```ts
BEGIN TRANSACTION
  lock bet
  if bet.status !== PENDING → return (idempotent)

  lock user
  user.balance += bet.amount

  update bet.status = REFUNDED
  insert financial_log(type = REFUND)
COMMIT
```

✅ Refund là **giao dịch tiền mới**
✅ Không double‑refund
✅ Retry an toàn
✅ Không rollback transaction cũ

---

## 9️⃣ TUYỆT ĐỐI KHÔNG LÀM

❌ Rollback tiền đã commit
❌ Refund dựa vào try/catch muộn
❌ Refund không kiểm tra trạng thái
❌ Gộp refund vào auto‑match

👉 Đây là lỗi **chết người** trong hệ thống tài chính

---

## 🔟 State Machine – Chìa khóa thật sự của hệ thống tiền

### Diagram State Machine

```
API (TX A)
  ↓
[PENDING] ← Bet placed, money deducted
  ↓
Worker Matcher
  ↓
[MATCHED] ← Opponent found
  ↓
Worker Settler
  ├→ [SETTLED] ← Winner decided (TX C)
  └→ [REFUNDED] ← No opponent (TX B)
```

### State Description Table

| State | Ý nghĩa | Tiền | Chi Tiết | TX Type |
|-------|---------|------|----------|---------|
| **PENDING** | Chờ match | 🔒 Locked | Trừ 100 từ balance, escrow | TX A |
| **MATCHED** | Có đối thủ | 🔒 Locked | Tìm được opponent, chờ settle | Worker |
| **SETTLED** | Kết thúc | ✅ Final | Winner +200, Loser -100 | TX C |
| **REFUNDED** | Trả lại | ✅ Final | No match, balance +100 | TX B |

👉 **Tiền đi theo state, không đi theo exception**

---

## 1️⃣1️⃣ Idempotency – Kiến thức nâng cao bắt buộc

* Mỗi bet / refund phải có **idempotent key**
* Gọi lại 10 lần → tiền chỉ chạy 1 lần

✅ Áp dụng cho:

* refund
* settle
* payout

---

## 1️⃣2️⃣ Vì sao Senior nói: "Auto‑match không ảnh hưởng tiền"?

✅ Vì:

* Tiền đã được giữ từ đầu
* Match chỉ quyết định **ai thắng**, không tạo tiền
* Refund / settle xử lý bằng transaction riêng

---

## 1️⃣3️⃣ Câu trả lời CHUẨN SENIOR (có thể dùng nguyên văn)

> “Tiền luôn được trừ trong transaction ban đầu.
> Auto‑match chạy async và không đụng tiền.
> Nếu không match được, refund là một transaction độc lập dựa trên trạng thái bet.
> Chúng tôi không rollback tiền đã commit mà xử lý bằng state machine để đảm bảo an toàn và scale.”

---

## 1️⃣4️⃣ Kiến thức nâng cao (Production Level)

### � QueryRunner vs Transaction vs Lock – Khi Nào Dùng Cái Gì?

| Thành Phần | Khi Dùng | Ví Dụ | Lưu Ý |
|-----------|---------|-------|--------|
| **QueryRunner** | Mỗi hành động tiền | Bet, Refund, Settle | ✅ Phải tạo mới, không reuse |
| **FOR UPDATE** | Lock row khi update | Wallet balance, Bet status | Serializes reads, use wisely |
| **SKIP LOCKED** | Tìm kiếm row khác khi lock exist | Auto-match opponent | Tránh thundering herd |
| **Idempotent Key** | Tránh double-action | Ledger UNIQUE(key) | DB enforce, không code enforce |
| **Pessimistic Lock** | High contention tiền | Balance update | Lock row, others wait |
| **Optimistic Lock** | Read-heavy scenarios | Report queries | Use version field |

### 🔹 Escrow Pattern

* Tiền bị giữ tạm khi bet placed
* Chỉ settle (payout) hoặc refund (trả lại)
* Không bao giờ lost or double-spent

### 🔹 Saga Pattern (đơn giản)

* Transaction nhỏ (1 thành phần = 1 TX)
* State rõ ràng (machine state)
* Có bước bù (refund = compensating TX)

### 🔹 Pessimistic Lock vs Optimistic Lock

* Tiền → **pessimistic** (FOR UPDATE) → đảm bảo ngay lập tức
* Read nhiều → optimistic (version field) → tốc độ cao

---

## 1️⃣5️⃣ Checklist Senior backend (hệ thống tiền)

* [ ] Mỗi luồng tiền = 1 transaction
* [ ] Không rollback sau commit
* [ ] State machine rõ ràng
* [ ] Refund idempotent
* [ ] Auto‑match async
* [ ] Có log tài chính đầy đủ

---

## ✅ KẾT LUẬN CUỐI

Nếu bạn:

* Tách được auto‑match mà **không mất tiền**
* Refund an toàn khi scale
* Nói được logic này cho người khác hiểu

👉 **Bạn đang tư duy ở level Senior backend thực chiến**.

---

📌 *File này nên được giữ như tài liệu sống (living document) cho hệ thống tài chính.*

---

## ✅ Kết luận quan trọng: Mỗi thay đổi tiền = QueryRunner mới

### ✅ Câu trả lời chuẩn cho câu hỏi:

> **Đúng. Mỗi lần tạo transaction mới thì phải gọi lại:**
>
> ```ts
> const qr = dataSource.createQueryRunner();
> ```
>
> **Không bao giờ reuse `QueryRunner` hay `manager` sau khi đã `commit`.**

---

## 🧠 Vì sao bắt buộc phải tạo `QueryRunner` mới?

### 1️⃣ `QueryRunner` gắn chặt với 1 DB transaction

* `QueryRunner` = 1 connection + 1 transaction context
* Khi gọi `commitTransaction()`:

  * transaction kết thúc
  * connection trả về pool
  * context **không còn đảm bảo atomicity**

👉 Dùng tiếp = **bug tiềm ẩn rất nguy hiểm với tiền**

---

### 2️⃣ Tư duy chuẩn Senior Backend

> **One financial action = One independent transaction**

Ví dụ:

| Hành động         | Transaction       | QueryRunner |
| ----------------- | ----------------- | ----------- |
| User đặt cược     | Transaction A     | `qr1`       |
| Auto-match        | ❌ Không đụng tiền | ❌           |
| Refund            | Transaction B     | `qr2`       |
| Settle thắng/thua | Transaction C     | `qr3`       |

---

## ✅ Luồng chuẩn (Bet → Refund)

### 🔹 Transaction A – Đặt cược (trừ tiền)

```ts
const qr1 = dataSource.createQueryRunner();
await qr1.connect();
await qr1.startTransaction();

try {
  await qr1.manager.save(WalletTransaction, {
    type: 'BET',
    amount: -100_000,
  });

  await qr1.manager.update(
    Wallet,
    { id: walletId },
    { balance: () => 'balance - 100000' }
  );

  await qr1.manager.save(Bet, { status: 'PENDING' });

  await qr1.commitTransaction();
} catch (e) {
  await qr1.rollbackTransaction();
  throw e;
} finally {
  await qr1.release();
}
```

✅ Sau bước này:

* Tiền đã trừ
* Bet đã ghi nhận
* Transaction kết thúc

---

### 🔹 Transaction B – Refund (hoàn tiền nếu cần)

```ts
const qr2 = dataSource.createQueryRunner(); // ✅ BẮT BUỘC MỚI
await qr2.connect();
await qr2.startTransaction();

try {
  await qr2.manager.save(WalletTransaction, {
    type: 'REFUND',
    amount: +100_000,
    refTxId: betTxId,
  });

  await qr2.manager.update(
    Wallet,
    { id: walletId },
    { balance: () => 'balance + 100000' }
  );

  await qr2.manager.update(Bet, { id: betId }, { status: 'REFUNDED' });

  await qr2.commitTransaction();
} catch (e) {
  await qr2.rollbackTransaction();
  throw e;
} finally {
  await qr2.release();
}
```

✅ Ledger sạch – audit rõ – không rollback quá khứ

---

## ❌ Những sai lầm thường gặp (Junior hay mắc)

### ❌ ANTI-PATTERN 1: Reuse QueryRunner Sau Commit

**❌ SAI - Nguy Hiểm:**
```ts
const qr = createQueryRunner();
await qr.startTransaction();
await qr.manager.save(walletTx); // Refund 1
await qr.commitTransaction();

// ❌ Sau commit, reuse qr
await qr.manager.save(another); // Refund 2 (outside TX!)
```

**✅ ĐÚNG - An Toàn:**
```ts
const qr1 = createQueryRunner(); // QueryRunner 1
await qr1.startTransaction();
await qr1.manager.save(refund1);
await qr1.commitTransaction();
await qr1.release();

const qr2 = createQueryRunner(); // ✅ New QueryRunner 2!
await qr2.startTransaction();
await qr2.manager.save(refund2);
await qr2.commitTransaction();
await qr2.release();
```

**Hậu quả nếu sai:** Data corruption → mất tiền

---

### ❌ ANTI-PATTERN 2: Gộp Auto-Match Vào Transaction Tiền

**❌ SAI - Bottleneck:**
```ts
await withTransaction(dataSource, async (em) => {
  await em.update(Wallet, {...}); // 10ms
  const opponent = await findOpponent(); // 500ms, LOCK DB!
  if (!opponent) return;
  await em.save(Match, {...});
});
```

**✅ ĐÚNG - Tách Riêng:**
```ts
// TX A: Nhanh (10ms)
await withTransaction(dataSource, async (em) => {
  await em.update(Wallet, {...});
  await em.save(Bet, {...});
});

// Queue: Async
await queue.add('match', { betId });

// Worker: Chậm nhưng không block API
worker.process(async (job) => {
  await withTransaction(dataSource, async (em) => {
    const opponent = await findOpponent(); // 500ms, lock riêng
    await em.update(Bet, { status: 'MATCHED' });
  });
});
```

**Kết quả:** Throughput 100+ RPS vs 10 RPS

---

## ✅ Nguyên tắc vàng cho hệ thống tiền

1. ✅ Transaction tiền **ngắn & dứt khoát**
2. ✅ Commit xong là **bất biến**
3. ✅ Mọi điều chỉnh → transaction mới
4. ✅ Auto-match, logic nặng → worker riêng
5. ✅ Ledger append-only (không sửa quá khứ)

---

## ✅ Câu nói chuẩn để dùng khi review / thuyết trình

> “Once a transaction is committed, it becomes immutable.
> Any further financial change must be recorded as a new transaction
> using a fresh QueryRunner.”

---

## ✅ Helper khuyến nghị dùng (tránh lỗi)

```ts
async function withTransaction<T>(
  dataSource: DataSource,
  fn: (manager: EntityManager) => Promise<T>
) {
  const qr = dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    const result = await fn(qr.manager);
    await qr.commitTransaction();
    return result;
  } catch (e) {
    await qr.rollbackTransaction();
    throw e;
  } finally {
    await qr.release();
  }
}
```

✅ Giúp:

* Không reuse nhầm transaction
* Code sạch
* An toàn tiền bạc

---

📌 **Nếu bạn nắm vững phần này, bạn đã vượt qua ranh giới Junior → Senior Backend ở mảng financial system.**

---

# 🔁 Phần mở rộng: Sequence Diagram, Idempotency, Race Condition và BullMQ Worker (Production-ready)

## 1️⃣ Sequence diagram (ASCII) — API → Queue → Worker

```
Client                             API Server                      Redis/BullMQ                   Worker                          Database
  |                                   |                               |                             |                                |
  | --- POST /bets {amount,side} ---> |                               |                             |                                |
  |                                   | startTransaction (A)          |                             |                                |
  |                                   | - check balance               |                             |                                |
  |                                   | - create WalletTx (BET -amt)  |                             |                                |
  |                                   | - update Wallet balance       |                             |                                |
  |                                   | - create Bet(status=PENDING)  |                             |                                |
  |                                   | commitTransaction (A)         |                             |                                |
  |                                   | ----- enqueue(job: betId) --->|                             |                                |
  | <---- 200 Accepted (bet queued) --|                               |                             |                                |
  |                                   |                               | ----- deliver(job) --------> |                                |
  |                                   |                               |                             | fetch bet by id, compute match |                                |
  |                                   |                               |                             | if need DB atomic updates ->   |                                |
  |                                   |                               |                             |   startTransaction (B)         |                                |
  |                                   |                               |                             |   update bet.status= MATCHED   |                                |
  |                                   |                               |                             |   create Match record          |                                |
  |                                   |                               |                             | commitTransaction (B)          |                                |
  |                                   |                               |                             | if settlement needed -> startTransaction (C) -> wallet txs -> commit
```

> Ghi chú: Transaction A là "short transaction" cho money safety; Transaction B/C là transaction của worker khi cần atomic update hoặc xử lý tiền.

---

## 2️⃣ Thiết kế idempotency cho worker

### Mục tiêu

* Tránh xử lý trùng job (worker retry / duplicate deliver)
* Đảm bảo không double-match, không double-refund, không double-pay

### Patterns dùng

1. **Job idempotency key** (jobId = `auto-match:bet:${betId}`)
2. **DB-level idempotency**: use `status` check + unique constraints + `refTxId` for wallet transactions
3. **Redis transient lock** (optional): `SET lock:bet:${betId} NX PX 5000` để ngăn 2 worker cùng xử lý ngay lập tức

### Algorithm (pseudo)

```ts
async function handleJob(job) {
  const betId = job.data.betId;

  // optional quick Redis lock to avoid thundering herd
  if (!await acquireLock(`lock:bet:${betId}`, 5000)) {
    // requeue or fail-fast (worker retry)
    return;
  }

  try {
    // 1) load bet
    const bet = await betRepo.findOne({ where: { id: betId } });
    if (!bet) return; // nothing to do

    // 2) idempotent guard: if status != PENDING, skip
    if (bet.status !== 'PENDING') return;

    // 3) find opponent
    const opponent = await findOpponent(bet);

    if (!opponent) {
      // leave as PENDING; separate job (e.g., at round end) will refund
      return;
    }

    // 4) perform DB atomic updates inside a transaction
    await withTransaction(dataSource, async (manager) => {
      // re-check inside tx
      const b = await manager.findOne(Bet, { where: { id: betId }, lock: { mode: 'pessimistic_write' } });
      if (!b || b.status !== 'PENDING') return;

      // update both bets status and create match record
      await manager.update(Bet, { id: betId }, { status: 'MATCHED' });
      await manager.update(Bet, { id: opponent.id }, { status: 'MATCHED' });
      await manager.save(Match, { betA: betId, betB: opponent.id, amount: matchedAmount });
    });

  } finally {
    releaseLock(`lock:bet:${betId}`);
  }
}
```

### Important

* **Never rely on only Redis lock** — always re-check DB state inside transaction (defensive programming).
* **Make job handlers idempotent**: skip if `status !== PENDING`.

---

## 3️⃣ Race condition: 2 workers cùng match 1 bet (analysis + mitigations)

### Scenario

* 2 worker processes receive job for same `betId` (duplicate delivery or concurrent findOpponent)
* Both try to mark bet as MATCHED → double-match, inconsistent ledger

### Causes

* Duplicate job deliveries
* No DB-level serialization or lock

### Mitigations (in order of preference)

1. **DB pessimistic lock inside transaction**

   * `SELECT ... FOR UPDATE` or TypeORM `lock: { mode: 'pessimistic_write' }` when reading bet(s) to update
2. **Use `SKIP LOCKED` when fetching candidates**

   * For matching multiple pending bets, use `FOR UPDATE SKIP LOCKED` to allow multiple workers to pull disjoint sets
3. **Unique constraints / idempotent checks**

   * Enforce `status` checks and rely on transaction atomicity
4. **Redis lock as fast guard**

   * Short TTL lock to prevent immediate duplicate work, but still have DB re-check

### Example: fetch opponent safely (SQL sketch)

```sql
-- worker selects pending bet rows for matching
BEGIN;
SELECT id FROM bets WHERE round_id = $1 AND status = 'PENDING' FOR UPDATE SKIP LOCKED LIMIT 1;
-- process matched rows
COMMIT;
```

This pattern lets multiple workers pull different rows without clashing.

---

## 4️⃣ BullMQ worker code (TypeScript) — production-ready example

> Notes: example uses `ioredis`, `bullmq`, `typeorm` and helper `withTransaction` provided earlier.

```ts
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';

const connection = new Redis(process.env.REDIS_URL!);
const queue = new Queue('auto-match', { connection });

const worker = new Worker('auto-match', async (job: Job) => {
  const { betId } = job.data as { betId: number };

  // quick guard: optional redis lock
  const lockKey = `lock:bet:${betId}`;
  const got = await connection.set(lockKey, '1', 'NX', 'PX', 5000);
  if (!got) {
    // rethrow to retry later (or return to let job be retried based on settings)
    throw new Error('Lock not acquired');
  }

  try {
    // load bet (no tx) and check state
    const bet = await BetRepo.findOne({ where: { id: betId } });
    if (!bet || bet.status !== 'PENDING') return;

    // try to find opponent using SKIP LOCKED approach
    // Option 1: do a transaction that SELECT FOR UPDATE SKIP LOCKED to reserve opponent
    await withTransaction(dataSource, async (manager) => {
      // re-fetch target bet with lock
      const target = await manager.findOne(Bet, { where: { id: betId }, lock: { mode: 'pessimistic_write' } });
      if (!target || target.status !== 'PENDING') return;

      // find opponent candidate using raw SQL with SKIP LOCKED
      const opponent = await manager.query(`
        SELECT id FROM bets
        WHERE round_id = $1 AND side != $2 AND status = 'PENDING'
        FOR UPDATE SKIP LOCKED LIMIT 1
      `, [target.roundId, target.side]);

      if (!opponent || opponent.length === 0) {
        // no opponent now
        return;
      }

      const opponentId = opponent[0].id;

      // finalize match atomically
      await manager.update(Bet, { id: target.id }, { status: 'MATCHED' });
      await manager.update(Bet, { id: opponentId }, { status: 'MATCHED' });
      await manager.save(Match, { betA: target.id, betB: opponentId, amount: Math.min(target.amount, opponentAmount) });
    });

  } finally {
    await connection.del(lockKey);
  }
}, { connection, concurrency: Number(process.env.WORKER_CONCURRENCY || 5) });

worker.on('failed', (job, err) => {
  console.error('job failed', job.id, err);
});

export { queue, worker };
```

### Production considerations

* Set `concurrency` according to DB capacity
* Tune Redis lock TTL according to expected processing time
* Use backoff and retry strategies
* Monitor job queue length and worker failures
* Add metrics (Prometheus) for p95/p99 of job processing

---

## 5️⃣ Kiến nghị vận hành (Ops)

* **Alert** nếu queue length > X
* **Auto-scale workers** based on queue length and DB metrics
* **Circuit breaker**: if DB errors spike, pause workers
* **Backpressure**: API should return 429 if queue is overloaded

---

## 6️⃣ Tóm tắt ngắn gọn (3 câu)

1. Queue lưu job, không lưu transaction.
2. Worker tạo `QueryRunner` mới nếu cần atomic DB updates / money ops.
3. Dùng `FOR UPDATE SKIP LOCKED` + idempotency + optional Redis lock để tránh race conditions.

---

Nếu bạn muốn mình sẽ:

* ✅ Thêm ví dụ SQL/schema cho `wallet_transaction` và `bets` để minh họa index & constraints
* ✅ Viết test scenario (pseudo) mô phỏng 1000 concurrent bets và show how queue absorbs spikes
* ✅ Tạo diagram mermaid hoặc draw.io cho sơ đồ sequence

Bạn muốn phần tiếp theo là **SQL/schema**, **stress test scenario**, hay **diagram mermaid**?

---

## 🔐 Idempotency – Kiến thức nâng cao **BẮT BUỘC** cho hệ thống tiền

### ✅ Định nghĩa ngắn gọn

> **Idempotency** = Gọi cùng một hành động N lần → **kết quả tiền chỉ xảy ra 1 lần**.

Ví dụ:

* Refund bị gọi lại 10 lần (retry / worker crash / duplicate job)
* 👉 **Balance chỉ tăng 1 lần**

---

## ❓ Vì sao idempotency là bắt buộc?

Trong production:

* Worker có thể crash
* Job có thể retry
* Network timeout
* API bị client retry
* Redis deliver duplicate job

👉 Nếu **không có idempotency** → **double refund / double payout = mất tiền thật** ❌

---

## ✅ Nguyên tắc vàng

> **Mỗi nghiệp vụ tài chính phải có idempotent key duy nhất**

| Nghiệp vụ         | Bắt buộc idempotent key |
| ----------------- | ----------------------- |
| Refund            | ✅                       |
| Settle thắng/thua | ✅                       |
| Payout            | ✅                       |
| Adjust balance    | ✅                       |

---

## 🔑 Idempotent key là gì?

Là một khóa **đại diện duy nhất cho 1 hành động tiền**.

### Ví dụ:

```text
refund:{betId}
settle:{matchId}:winner:{userId}
payout:{roundId}:{userId}
```

👉 **Key này phải giống nhau cho mọi lần retry**

---

## ✅ Cách triển khai chuẩn (DB-level – khuyến nghị)

### 1️⃣ Schema `wallet_transactions`

```sql
CREATE TABLE wallet_transactions (
  id BIGSERIAL PRIMARY KEY,
  wallet_id BIGINT NOT NULL,
  type VARCHAR(20) NOT NULL, -- BET / REFUND / SETTLE / PAYOUT
  amount BIGINT NOT NULL,
  idempotent_key VARCHAR(100) NOT NULL,
  ref_id BIGINT NULL,
  created_at TIMESTAMP DEFAULT now(),

  UNIQUE (idempotent_key)
);
```

✅ DB đảm bảo **chỉ insert 1 lần duy nhất**

---

### 2️⃣ Transaction code (TypeORM pseudo)

```ts
await withTransaction(dataSource, async (manager) => {
  // 1. check if already processed
  const existed = await manager.findOne(WalletTransaction, {
    where: { idempotentKey }
  });

  if (existed) {
    // ✅ idempotent hit → do nothing
    return;
  }

  // 2. create ledger entry
  await manager.save(WalletTransaction, {
    walletId,
    type: 'REFUND',
    amount: +100_000,
    idempotentKey,
    refId: betId,
  });

  // 3. update balance
  await manager.update(Wallet, { id: walletId }, {
    balance: () => 'balance + 100000'
  });
});
```

✅ Gọi 1 lần hay 10 lần → **kết quả giống nhau**

---

## ✅ Cách triển khai nâng cao (Optimistic – không cần query trước)

```ts
try {
  await manager.save(WalletTransaction, {...});
  await manager.update(Wallet, {...});
} catch (e) {
  if (isUniqueConstraintError(e)) {
    // ✅ idempotent hit
    return;
  }
  throw e;
}
```

✅ Dựa hoàn toàn vào UNIQUE constraint
✅ Hiệu năng cao hơn

---

## ❌ Sai lầm thường gặp

### ❌ 1. Dùng Redis làm idempotency duy nhất

* Redis flush → mất khóa
* Restart → double payout

👉 Redis **chỉ hỗ trợ**, DB mới là nguồn sự thật

---

### ❌ 2. Không gắn idempotent key cho refund

```text
refund()
refund()
refund()
```

➡️ Balance tăng 3 lần 💥

---

## ✅ Idempotency trong Queue / Worker

### BullMQ job config

```ts
queue.add('refund', data, {
  jobId: `refund:${betId}`, // ✅ idempotent job
});
```

✅ Tránh enqueue trùng

---

### Nhưng nhớ:

> **Job idempotency ≠ Money idempotency**

* Job id trùng giúp giảm duplicate job
* **DB idempotency mới bảo vệ tiền**

---

## ✅ Checklist bắt buộc khi xử lý tiền

* ✅ Có idempotent key chưa?
* ✅ UNIQUE constraint ở DB chưa?
* ✅ Transaction riêng cho tiền chưa?
* ✅ Retry bao nhiêu lần cũng an toàn?

---

## ✅ Câu nói chuẩn Senior Backend

> “Every financial operation must be idempotent by design.
> Retries are expected, double spending is not.”

---

📌 **Nếu hệ thống của bạn có idempotency đúng chuẩn, bạn có thể tự tin scale worker và retry vô hạn mà không sợ mất tiền.**

---

# ✅ BƯỚC 2: Stress test 1k–5k users + Queue Backpressure (Postgres + TypeORM)

## 🎯 Mục tiêu

* Đảm bảo hệ thống chịu được tải lớn (1k–5k users đặt cược đồng thời)
* Không sập DB
* Không double money
* Queue hấp thụ burst traffic

## 1️⃣ Vì sao cần Queue khi stress test

Nếu **1000 users đặt cược cùng lúc**:

* 1000 transaction mở cùng lúc → DB chết
* Lock wallet tranh chấp → timeout

✅ Giải pháp:

* API chỉ xử lý **Transaction A (money safe)**
* Phần nặng (auto‑match, settle) đẩy vào Queue

```
API → Transaction A → Commit
                 ↓
               Queue (Redis)
                 ↓
             Worker xử lý dần
```

## 2️⃣ BullMQ config chuẩn production

```ts
new Worker('auto-match', handler, {
  concurrency: 5,      // giới hạn song song
  limiter: {
    max: 100,
    duration: 1000,   // 100 jobs / giây
  },
});
```

📌 **Concurrency ≠ throughput**

* Concurrency cao → dễ lock DB
* Thấp nhưng ổn định → sống lâu

## 3️⃣ DB Pool sizing (rất hay bị sai)

```ts
extra: {
  max: 20,   // pool size
}
```

📌 Quy tắc:

```
(pool size) ≥ (API concurrent tx) + (Worker concurrent tx)
```

---

# ✅ BƯỚC 3: Case study BUG thật – Double payout & Audit

## ❌ Bug phổ biến

```
Worker A settle bet
Worker B retry cùng bet
→ payout 2 lần
```

Nguyên nhân:

* Không idempotent
* Retry không kiểm soát

## ✅ Cách PHÁT HIỆN bằng Ledger

```sql
SELECT reference_id, COUNT(*)
FROM wallet_ledgers
WHERE type = 'PAYOUT'
GROUP BY reference_id
HAVING COUNT(*) > 1;
```

📌 **Ledger là vũ khí audit mạnh nhất**

## ✅ Fix triệt để

* Unique index `idempotent_key`
* Worker check ledger trước khi payout

```ts
INSERT INTO wallet_ledgers (...)
ON CONFLICT (idempotent_key) DO NOTHING;
```

---

# ✅ BƯỚC 4: Idempotency – Kiến thức nâng cao bắt buộc

## 1️⃣ Định nghĩa

> Gọi 1 lần hay 10 lần → kết quả tiền chỉ chạy **1 lần**

## 2️⃣ Áp dụng cho

✅ Bet
✅ Refund
✅ Settle
✅ Payout

## 3️⃣ Cách thiết kế idempotent key

```ts
idempotentKey = `${type}:${betId}`
```

Ví dụ:

* `BET:bet_123`
* `REFUND:bet_123`
* `PAYOUT:bet_123`

## 4️⃣ Worker xử lý chuẩn

```ts
await qr.manager.insert(WalletLedger, {...}); // fail nếu trùng key
```

📌 **DB là nơi enforce idempotency – không tin code**

---

# ✅ TỔNG KẾT TƯ DUY SENIOR

✅ Transaction ngắn
✅ Tiền chạy trong ledger
✅ Queue để scale
✅ Worker idempotent
✅ Audit bằng SQL

> Nếu ledger đúng → hệ thống tiền không thể sai

---

# 🔎 Phần mở rộng chi tiết (Dễ hiểu, dễ áp dụng)

Mục này bổ sung các đoạn script SQL đầy đủ hơn, một script đối chiếu (reconciliation) mẫu và **BullMQ worker** hoàn chỉnh hơn (retry, backoff, DLQ). Mình viết theo ngôn ngữ dễ hiểu để bạn copy-paste vào repo.

---

## A. SQL script đầy đủ (Postgres) – production-ready

> Gồm: tạo extension, bảng, index, ràng buộc, ví dụ trigger (nếu cần)

```sql
-- 1) Extension cho UUID
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) wallets (state)
CREATE TABLE IF NOT EXISTS wallets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  balance NUMERIC(30,8) NOT NULL DEFAULT 0,
  locked_balance NUMERIC(30,8) NOT NULL DEFAULT 0,
  version BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) wallet_ledgers (append-only ledger)
CREATE TABLE IF NOT EXISTS wallet_ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL,
  amount NUMERIC(30,8) NOT NULL,
  "type" TEXT NOT NULL,
  reference_id TEXT NULL,
  idempotent_key TEXT NOT NULL,
  balance_before NUMERIC(30,8) NOT NULL,
  balance_after NUMERIC(30,8) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ledger_idempotent ON wallet_ledgers(idempotent_key);
CREATE INDEX IF NOT EXISTS ix_ledger_user_time ON wallet_ledgers(user_id, created_at DESC);

-- 4) bets
CREATE TABLE IF NOT EXISTS bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL,
  round_id UUID NOT NULL,
  amount NUMERIC(30,8) NOT NULL,
  side TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_bets_round_status ON bets(round_id, status);
CREATE INDEX IF NOT EXISTS ix_bets_user_time ON bets(user_id, created_at DESC);

-- 5) matches
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_a UUID NOT NULL,
  bet_b UUID NOT NULL,
  amount NUMERIC(30,8) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_matches_created ON matches(created_at DESC);

-- 6) optional: constraints for ledger amount sign per type (business rule)
-- Example: ensure BET is negative amount, REFUND is positive (can be enforced in app layer)

-- 7) sample function to compute wallet balance from ledger (for audit)
CREATE OR REPLACE FUNCTION compute_balance_by_user(p_user_id BIGINT)
RETURNS NUMERIC AS $$
DECLARE
  s NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO s FROM wallet_ledgers WHERE user_id = p_user_id;
  RETURN s;
END;
$$ LANGUAGE plpgsql STABLE;
```

**Ghi chú:**

* Dùng `NUMERIC(30,8)` tránh rounding error.
* `idempotent_key` là lớp bảo vệ quan trọng nhất.
* `wallets.balance` là cache để đọc nhanh — luôn update trong cùng transaction với `wallet_ledgers`.

---

## B. Reconciliation script (SQL + TypeScript pseudo) — phát hiện bất thường

### 1) SQL quick checks (chạy hàng ngày)

```sql
-- 1. Detect duplicate payouts for same reference
SELECT reference_id, type, COUNT(*) c
FROM wallet_ledgers
WHERE type = 'PAYOUT'
GROUP BY reference_id, type
HAVING COUNT(*) > 1;

-- 2. Detect mismatch between wallet balance and ledger sum
-- Example for all wallets (careful cost on large tables)
SELECT w.id, w.user_id, w.balance AS wallet_balance, COALESCE(l.sum_amount,0) AS ledger_sum
FROM wallets w
LEFT JOIN (
  SELECT user_id, SUM(amount) AS sum_amount
  FROM wallet_ledgers
  GROUP BY user_id
) l ON l.user_id = w.user_id
WHERE w.balance::text <> l.sum_amount::text; -- compare as text to avoid float mismatch

-- 3. Sample check for recent day (less cost)
SELECT w.user_id, w.balance, COALESCE(l.sum_amount,0) AS ledger_sum
FROM wallets w
LEFT JOIN (
  SELECT user_id, SUM(amount) AS sum_amount
  FROM wallet_ledgers
  WHERE created_at >= now() - interval '7 days'
  GROUP BY user_id
) l ON l.user_id = w.user_id
WHERE w.balance::text <> l.sum_amount::text;
```

### 2) Reconciliation pseudo-script (TypeScript)

```ts
// recon.ts (Node script)
import { DataSource } from 'typeorm';

async function reconcile(dataSource: DataSource) {
  const conn = dataSource;
  // iterate users in pages to avoid memory blow
  let offset = 0;
  const page = 1000;
  while (true) {
    const users = await conn.query('SELECT id, user_id, balance FROM wallets ORDER BY id LIMIT $1 OFFSET $2', [page, offset]);
    if (users.length === 0) break;

    for (const u of users) {
      const res = await conn.query('SELECT COALESCE(SUM(amount),0) as ledger_sum FROM wallet_ledgers WHERE user_id = $1', [u.user_id]);
      const ledgerSum = res[0].ledger_sum;
      if (ledgerSum !== u.balance) {
        console.error('Mismatch', u.user_id, u.balance, ledgerSum);
        // optional: write to report table or send alert
      }
    }

    offset += users.length;
  }
}
```

**Ghi chú vận hành:** chạy hàng đêm; nếu có mismatch lớn thì pause payouts và điều tra.

---

## C. BullMQ worker nâng cao (retry/backoff/DLQ) — TypeScript example

> Yêu cầu: `bullmq`, `ioredis`, `typeorm` và helper `withTransaction` như đã đề cập.

```ts
import { Worker, Queue, QueueScheduler, JobsOptions } from 'bullmq';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';

const connection = new Redis(process.env.REDIS_URL!);
const queueName = 'auto-match';
export const queue = new Queue(queueName, { connection });
export const scheduler = new QueueScheduler(queueName, { connection });

const worker = new Worker(queueName, async (job) => {
  const data = job.data as { betId: string };
  const betId = data.betId;

  // short Redis lock to avoid hot-thundering
  const lockKey = `lock:bet:${betId}`;
  const got = await connection.set(lockKey, job.id, 'NX', 'PX', 10_000);
  if (!got) {
    // let it retry later
    throw new Error('Lock not acquired');
  }

  try {
    // 1. Load bet (no tx)
    const bet = await BetRepo.findOne({ where: { id: betId } });
    if (!bet || bet.status !== 'PENDING') return;

    // 2. Try match inside transaction with FOR UPDATE SKIP LOCKED
    await withTransaction(dataSource, async (manager) => {
      // reselect for update
      const target = await manager.findOne(Bet, { where: { id: betId }, lock: { mode: 'pessimistic_write' } });
      if (!target || target.status !== 'PENDING') return;

      // find opponent using raw SQL with SKIP LOCKED
      const rows = await manager.query(`
        SELECT id, amount, user_id FROM bets
        WHERE round_id = $1 AND status = 'PENDING' AND side != $2
        FOR UPDATE SKIP LOCKED LIMIT 1
      `, [target.round_id, target.side]);

      if (!rows || rows.length === 0) {
        // nothing to do
        return;
      }

      const opponentId = rows[0].id;
      const matchedAmount = Math.min(Number(target.amount), Number(rows[0].amount));

      // update both bets to MATCHED
      await manager.update(Bet, { id: target.id }, { status: 'MATCHED' });
      await manager.update(Bet, { id: opponentId }, { status: 'MATCHED' });
      await manager.save(Match, { betA: target.id, betB: opponentId, amount: matchedAmount });

      // if settlement needed immediately (e.g., instantaneous payout), perform money ops in separate txs
    });

  } finally {
    await connection.del(lockKey);
  }
}, {
  connection,
  concurrency: Number(process.env.WORKER_CONCURRENCY || 5),
  // default job retry/backoff handled in queue.add
});

worker.on('failed', async (job, err) => {
  console.error('Job failed:', job.id, err);
  // optional: move to DLQ if job.failedAttempts > N
});

// helper to add job with idempotent jobId & retry/backoff
export async function enqueueMatch(betId: string) {
  const opts: JobsOptions = {
    jobId: `match:${betId}`, // prevents duplicate jobs
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000, // 1s base
    },
    removeOnComplete: true,
    removeOnFail: false,
  };
  await queue.add('match', { betId }, opts);
}

// Dead Letter Queue pattern (simplest): move job to different queue after N fails
```

### DLQ handling approach

* Configure attempts and backoff; if job fails > attempts → mark and push to `dlq` queue with details and failure reason. Manual inspection required.
* Or use `queueEvents` to listen for `failed` and `stalled` events and implement transfer logic.

---

## D. Bonus: Reconciliation + Auto-remediation flow (recommended)

1. Run reconciliation nightly; detect mismatches or duplicate payouts.\
2. If mismatch found < threshold: auto-run attempt to fix (e.g., insert missing ledger or roll back erroneous ledger with compensating transaction).\
3. If mismatch > threshold: alert ops, pause payouts, run manual investigation.

Example auto-remediate (careful, must be idempotent + logged):

* If ledger sum < wallet.balance → insert compensating ledger with idempotent key `auto_fix:{userId}:{date}` (only if proven safe). Always produce audit trail.

---

## E. Monitoring & runbook snippets (practical)

* **Alert**: queue length > 1000 → scale workers & investigate DB
* **Alert**: DB connections used > 80% → reduce worker concurrency and scale DB replicas
* **Runbook**: when double payout detected → set `payouts_paused = true`, send alert to oncall, export affected user list, create incident ticket

---

### Kết luận

Mình đã ghi chi tiết SQL, script reconciliation, worker nâng cao (retry/backoff/DLQ) và flow auto-remediation. Bạn có thể chép thẳng vào `full.md` hoặc repo. Nếu muốn, mình có thể tiếp tục và:

* Viết file migration SQL đầy đủ cho Flyway/TypeORM
* Viết unit/integration test (pseudo) cho worker và reconciliation
* Sinh sample data + stress-test script (kịch bản bun/ts)

Bạn muốn mình tiếp tục phần nào?
