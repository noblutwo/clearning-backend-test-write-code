# 📐 ARCHITECTURE LEVEL 1: QUEUE + WORKER (500-2K Users)

> **Mô tả:** Hệ thống Betting API cơ bản - Queue + Worker pattern cho hàng trăm đến hàng nghìn users
> 
> **Khả năng:** 500 - 2,000 concurrent users
> 
> **Công nghệ:** Node.js + TypeORM + PostgreSQL + BullMQ (Redis)

---

## 📋 Mục Lục
1. [Kiến Trúc Tổng Quan](#kiến-trúc-tổng-quan)
2. [Luồng Xử Lý Chi Tiết](#luồng-xử-lý-chi-tiết)
3. [Schema Database](#schema-database)
4. [Worker Implementation](#worker-implementation)
5. [Idempotency & Safety](#idempotency--safety)
6. [Stress Test & Tuning](#stress-test--tuning)

---

## 🏗️ Kiến Trúc Tổng Quan

### High-Level Diagram

```
┌──────────────────────────────────────────────┐
│           CLIENT APPLICATIONS                │
└──────────────┬───────────────────────────────┘
               │ HTTP REST
               ▼
┌──────────────────────────────────────────────┐
│     API SERVER (Stateless, Horizontal)       │
│  - Authenticate & Authorize                  │
│  - Validate input                            │
│  - Create Wallet Ledger (append-only)        │
│  - Deduct balance                            │
│  - Return 202 Accepted                       │
└──────────────┬───────────────────────────────┘
               │
         ┌─────┴──────┐
         │            │
         ▼            ▼
    ┌─────────┐  ┌──────────────┐
    │  Queue  │  │  PostgreSQL  │
    │ BullMQ  │  │   Database   │
    │ (Redis) │  │              │
    └────┬────┘  └──────────────┘
         │
    ┌────┴─────────────────────┐
    │  Job Queue               │
    ├─ match:{betId}          │
    ├─ settle:{matchId}       │
    └─ refund:{betId}         │
    │
    ▼
┌──────────────────────────────┐
│   Worker Pool (Scale Out)     │
│ ┌──────────────────────────┐ │
│ │ Matcher Workers (N=3-5)  │ │
│ │ - Auto-match bets       │ │
│ │ - Pessimistic lock      │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Settler Workers (N=2-3)  │ │
│ │ - Settle matches        │ │
│ │ - Payout winners        │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Payout Workers (N=2)     │ │
│ │ - Refund unmatched      │ │
│ │ - Emergency payout      │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
         │
         ▼
    ┌──────────────┐
    │ PostgreSQL   │
    │ Transactions │
    │ - FOR UPDATE │
    │ - SKIP LOCKED│
    └──────────────┘
```

### Dependency Stack

```
┌─────────────────────────────────┐
│  Express / NestJS (HTTP Server) │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│  TypeORM (ORM + Migrations)     │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│  PostgreSQL (Data + ACID)       │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  BullMQ + Redis (Job Queue)     │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│  Worker Consumers (Stateless)   │
└─────────────────────────────────┘
```

---

## 🔄 Luồng Xử Lý Chi Tiết

### 1️⃣ API: Đặt Cược (Transaction A)

**Endpoint:** `POST /api/bets`

**Request:**
```json
{
  "userId": 123,
  "roundId": "round-2024-01-01",
  "amount": 100.50,
  "side": "A"
}
```

**Flow:**
```
T=0ms
├─ Validate input (amount > 0, side in ['A','B'])
├─ Start Transaction A
│  ├─ SELECT wallets WHERE user_id = 123 FOR UPDATE
│  │  └─ Lock row (prevent concurrent updates)
│  │
│  ├─ Check balance >= amount
│  │  └─ If insufficient → ROLLBACK + return 400
│  │
│  ├─ INSERT wallet_ledgers
│  │  ├─ user_id: 123
│  │  ├─ amount: -100.50
│  │  ├─ type: 'DEBIT'
│  │  ├─ reference_id: betId
│  │  ├─ idempotent_key: 'BET:' + betId (UNIQUE)
│  │  └─ This ensures idempotency
│  │
│  ├─ UPDATE wallets
│  │  └─ balance = balance - 100.50 (500 → 399.50)
│  │
│  ├─ INSERT bets
│  │  ├─ user_id: 123
│  │  ├─ round_id: 'round-2024-01-01'
│  │  ├─ amount: 100.50
│  │  ├─ side: 'A'
│  │  ├─ status: 'PENDING'
│  │  └─ created_at: now
│  │
│  └─ COMMIT Transaction A
│
├─ Return 202 Accepted
│  └─ { betId, status: 'PENDING', balance: 399.50 }
│
└─ Queue async job
   └─ queue.add('match', { betId }, {
        jobId: 'match:' + betId,
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 }
      })
```

**Response:**
```json
{
  "status": 202,
  "data": {
    "betId": "bet-abc-123",
    "balance": 399.50,
    "message": "Bet placed, waiting for match"
  }
}
```

**Error Cases:**
```
- Insufficient balance → 400 Bad Request
- Invalid input → 422 Unprocessable Entity
- Duplicate idempotent_key → 409 Conflict (handled gracefully)
- DB error → 500 (retry client side)
```

---

### 2️⃣ Worker: Matcher (Auto-Matching)

**Job Type:** `match:{betId}`

**Worker Code Flow:**
```typescript
// Worker logic pseudocode
async function matchWorker(job: Job<{ betId }>) {
  const { betId } = job.data;
  
  // Step 1: Quick sanity check
  const bet = await betsRepo.findOne(betId);
  if (!bet || bet.status !== 'PENDING') {
    return; // Already matched or not found
  }

  // Step 2: Optional Redis lock (prevent thundering herd)
  const locked = await redis.set(
    `lock:bet:${betId}`,
    '1',
    'EX', 30,
    'NX'
  );
  if (!locked) return; // Another worker processing

  // Step 3: Find opponent inside transaction
  await withTransaction(async (manager) => {
    // Re-check inside TX with pessimistic lock
    const myBet = await manager.query(
      `SELECT * FROM bets WHERE id = $1 FOR UPDATE`,
      [betId]
    );
    
    if (myBet.status !== 'PENDING') return; // Already matched
    
    // Find opponent (SKIP LOCKED = skip locked rows)
    const opponent = await manager.query(
      `SELECT * FROM bets
       WHERE round_id = $1
         AND side != $2
         AND status = 'PENDING'
       FOR UPDATE SKIP LOCKED
       LIMIT 1
       ORDER BY created_at ASC`,
      [myBet.round_id, myBet.side]
    );
    
    if (!opponent) return; // No match available

    // Create match
    const matchId = generateId();
    
    // Update both bets
    await manager.update(
      Bet,
      { id: myBet.id },
      { status: 'MATCHED', match_id: matchId }
    );
    
    await manager.update(
      Bet,
      { id: opponent.id },
      { status: 'MATCHED', match_id: matchId }
    );
    
    // Insert match record
    await manager.insert(Match, {
      id: matchId,
      bet_a_id: myBet.id,
      bet_b_id: opponent.id,
      amount: myBet.amount,
      status: 'PENDING'
    });
    
    // Enqueue settlement job
    await queue.add('settle', { matchId }, {
      jobId: `settle:${matchId}`,
      attempts: 3
    });
  });
}
```

**Timeline:**
```
T=0-50ms: API places bet A (amount=100, side='A')
          API places bet B (amount=100, side='B')

T=100ms:  Worker receives match:A job
          ├─ SELECT bet A FOR UPDATE (LOCKED)
          └─ SELECT opponent SKIP LOCKED
             ├─ Can't find B (not in PENDING yet)
             └─ job succeeds but no match

T=120ms:  Worker receives match:B job
          ├─ SELECT bet B FOR UPDATE (LOCKED)
          └─ SELECT opponent SKIP LOCKED
             ├─ Can find A (PENDING, unlocked)
             └─ CREATE match
             └─ UPDATE both to MATCHED
             └─ Enqueue settle:{matchId}

T=200ms:  Worker receives settle:{matchId} job
          └─ Process settlement (see next section)
```

---

### 3️⃣ Worker: Settler (Settlement & Payout)

**Job Type:** `settle:{matchId}`

**Worker Logic:**
```typescript
async function settlerWorker(job: Job<{ matchId }>) {
  const { matchId } = job.data;
  
  // Load match
  const match = await matchesRepo.findOne(matchId);
  if (!match || match.status !== 'PENDING') return;
  
  // Determine winner (example: random, could be external oracle)
  const winner = Math.random() > 0.5 ? 'A' : 'B';
  const winnerBetId = winner === 'A' ? match.bet_a_id : match.bet_b_id;
  const loserBetId = winner === 'A' ? match.bet_b_id : match.bet_a_id;
  
  const winnerBet = await betsRepo.findOne(winnerBetId);
  const loserBet = await betsRepo.findOne(loserBetId);
  
  try {
    // Transaction: Credit winner
    await withTransaction(async (manager) => {
      // Lock winner wallet
      const winnerWallet = await manager.query(
        `SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [winnerBet.user_id]
      );
      
      // Check idempotency
      const existingPayout = await manager.findOne(
        WalletLedger,
        {
          where: {
            idempotent_key: `SETTLE:${matchId}:${winnerBet.user_id}`
          }
        }
      );
      
      if (!existingPayout) {
        // Payout = 2x bet (winner gets their bet back + profit)
        const payoutAmount = winnerBet.amount * 2;
        
        // Insert ledger (idempotent)
        await manager.insert(WalletLedger, {
          user_id: winnerBet.user_id,
          amount: payoutAmount,
          type: 'CREDIT',
          reference_id: matchId,
          idempotent_key: `SETTLE:${matchId}:${winnerBet.user_id}`,
          balance_before: winnerWallet.balance,
          balance_after: winnerWallet.balance + payoutAmount
        });
        
        // Update balance
        await manager.update(
          Wallet,
          { user_id: winnerBet.user_id },
          { balance: () => 'balance + ' + payoutAmount }
        );
      }
      
      // Update bets
      await manager.update(Bet, { id: winnerBetId }, { status: 'SETTLED' });
      await manager.update(Bet, { id: loserBetId }, { status: 'SETTLED' });
      
      // Update match
      await manager.update(
        Match,
        { id: matchId },
        { status: 'SETTLED', winner_side: winner }
      );
    });
    
  } catch (error) {
    console.error(`Settlement failed for match ${matchId}:`, error);
    // Retry with exponential backoff
    throw error;
  }
}
```

**Important Points:**
- Idempotent key prevents double-payout
- Loser's money already deducted (from API step)
- Winner gets credited in separate TX
- If error → job retries automatically

---

### 4️⃣ Worker: Refund/Payout (Emergency)

**Job Type:** `refund:{betId}` or `payout:{betId}`

**Scenarios:**
```
1. Match timeout: Bet still PENDING after 5 minutes
2. Settlement failed: Emergency refund
3. User request: Manual refund
```

**Worker Logic:**
```typescript
async function refundWorker(job: Job<{ betId }>) {
  const { betId } = job.data;
  
  const bet = await betsRepo.findOne(betId);
  if (!bet) return;
  
  // Only refund if not settled
  if (bet.status === 'SETTLED') return;
  
  await withTransaction(async (manager) => {
    // Lock wallet
    const wallet = await manager.query(
      `SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [bet.user_id]
    );
    
    // Check if already refunded
    const refundRecord = await manager.findOne(WalletLedger, {
      where: {
        idempotent_key: `REFUND:${betId}`
      }
    });
    
    if (!refundRecord) {
      // Insert refund ledger
      await manager.insert(WalletLedger, {
        user_id: bet.user_id,
        amount: bet.amount,
        type: 'REFUND',
        reference_id: betId,
        idempotent_key: `REFUND:${betId}`,
        balance_before: wallet.balance,
        balance_after: wallet.balance + bet.amount
      });
      
      // Update wallet
      await manager.update(
        Wallet,
        { user_id: bet.user_id },
        { balance: () => 'balance + ' + bet.amount }
      );
    }
    
    // Update bet status
    await manager.update(Bet, { id: betId }, { status: 'REFUNDED' });
  });
}
```

---

## 📊 Schema Database

### Table: wallets (State)

```sql
CREATE TABLE wallets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL,
  balance NUMERIC(30,8) NOT NULL DEFAULT 0,
  locked_balance NUMERIC(30,8) DEFAULT 0,
  version INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT balance_non_negative CHECK (balance >= 0)
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);
```

**Why this schema:**
- `balance`: Actual liquid amount
- `locked_balance`: Reserved for pending bets (optional, for UI)
- `version`: For optimistic locking (if needed)
- CHECK constraint: Prevent negative balance at DB level

---

### Table: wallet_ledgers (Append-Only)

```sql
CREATE TABLE wallet_ledgers (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  amount NUMERIC(30,8) NOT NULL,
  type VARCHAR(20) NOT NULL,
  reference_id UUID,
  bet_id UUID REFERENCES bets(id) ON DELETE CASCADE,
  idempotent_key VARCHAR(255) UNIQUE NOT NULL,
  balance_before NUMERIC(30,8),
  balance_after NUMERIC(30,8),
  created_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT type_check CHECK (
    type IN ('DEBIT', 'CREDIT', 'REFUND', 'PAYOUT')
  )
);

CREATE INDEX idx_ledger_user_created 
  ON wallet_ledgers(user_id, created_at DESC);
CREATE INDEX idx_ledger_idempotent 
  ON wallet_ledgers(idempotent_key);
CREATE INDEX idx_ledger_reference 
  ON wallet_ledgers(reference_id);
```

**Why append-only:**
- Immutable transaction history
- Easy audit trail
- Ledger-first architecture foundation
- Never update/delete (ACID properties)

---

### Table: bets (Betting Records)

```sql
CREATE TABLE bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id),
  round_id UUID NOT NULL,
  amount NUMERIC(30,8) NOT NULL,
  side VARCHAR(1) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',
  match_id UUID REFERENCES matches(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT amount_positive CHECK (amount > 0),
  CONSTRAINT side_check CHECK (side IN ('A', 'B')),
  CONSTRAINT status_check CHECK (
    status IN ('PENDING', 'MATCHED', 'SETTLED', 'REFUNDED')
  )
);

CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_round_id ON bets(round_id, status);
CREATE INDEX idx_bets_status ON bets(status) 
  WHERE status IN ('PENDING', 'MATCHED');
CREATE INDEX idx_bets_match_id ON bets(match_id);
CREATE INDEX idx_bets_created ON bets(created_at DESC);
```

**Index Strategy:**
- `idx_bets_round_id`: For matching (WHERE round_id = X AND status = 'PENDING')
- `idx_bets_status`: For worker queries
- `idx_bets_user_id`: For user history

---

### Table: matches (Match Records)

```sql
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_a_id UUID NOT NULL REFERENCES bets(id),
  bet_b_id UUID NOT NULL REFERENCES bets(id),
  amount NUMERIC(30,8) NOT NULL,
  winner_side VARCHAR(1),
  status VARCHAR(20) DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT winner_check CHECK (winner_side IN ('A', 'B', NULL)),
  CONSTRAINT status_check CHECK (status IN ('PENDING', 'SETTLED'))
);

CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_created ON matches(created_at DESC);
```

---

## 🔒 Worker Implementation

### Queue Configuration (BullMQ)

```typescript
import { Queue, Worker, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

// Queues
export const matchQueue = new Queue('match', { connection: redis });
export const settleQueue = new Queue('settle', { connection: redis });
export const refundQueue = new Queue('refund', { connection: redis });

// Matcher Worker
export const matcherWorker = new Worker('match', matcherHandler, {
  connection: redis,
  concurrency: 5, // Process 5 jobs in parallel
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 2000
  }
});

// Settler Worker
export const settlerWorker = new Worker('settle', settlerHandler, {
  connection: redis,
  concurrency: 3,
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000
  }
});

// Events
matchQueue.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

matchQueue.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err.message);
});
```

### Worker Handlers

```typescript
// Matcher handler
async function matcherHandler(job: Job<{ betId: string }>) {
  const { betId } = job.data;
  console.log(`[Matcher] Processing bet ${betId}`);
  
  // [Implementation as shown above]
}

// Settler handler
async function settlerHandler(job: Job<{ matchId: string }>) {
  const { matchId } = job.data;
  console.log(`[Settler] Processing match ${matchId}`);
  
  // [Implementation as shown above]
}

// Refund handler
async function refundHandler(job: Job<{ betId: string }>) {
  const { betId } = job.data;
  console.log(`[Refund] Processing refund for bet ${betId}`);
  
  // [Implementation as shown above]
}
```

---

## 🛡️ Idempotency & Safety

### Idempotent Key Pattern

**Every money operation must have an idempotent_key:**

```
BET:{betId}           → For placing bet (debit)
SETTLE:{matchId}:{userId} → For settlement (payout)
REFUND:{betId}        → For refund
```

### How It Works

```
Transaction 1 (Initial):
├─ INSERT wallet_ledgers
│  ├─ idempotent_key: 'BET:123'
│  ├─ amount: -100
│  └─ (succeeds)
└─ COMMIT

Transaction 2 (Retry/Duplicate):
├─ INSERT wallet_ledgers
│  ├─ idempotent_key: 'BET:123' ← SAME KEY
│  └─ (UNIQUE constraint violated)
│
├─ Catch unique violation
├─ SELECT wallet_ledgers WHERE idempotent_key = 'BET:123'
├─ Confirm already processed
└─ Treat as success (no double debit)
```

### Code Implementation

```typescript
async function insertLedgerIdempotent(
  manager: EntityManager,
  ledger: WalletLedger
) {
  try {
    // Try to insert
    await manager.insert(WalletLedger, ledger);
    return { new: true, ledger };
  } catch (error) {
    // If unique violation on idempotent_key
    if (isUniqueViolation(error, 'idempotent_key')) {
      // Load existing record
      const existing = await manager.findOne(WalletLedger, {
        where: { idempotent_key: ledger.idempotent_key }
      });
      return { new: false, ledger: existing };
    }
    throw error;
  }
}
```

---

## 📈 Stress Test & Tuning

### Test Scenario 1: Burst Load

**Objective:** Measure system capacity at peak

```bash
# 1000 users place bets simultaneously

Duration: 5 seconds
RPS: 200 requests/sec
Concurrency: 1000 connections
Expected queue depth: ~800 jobs
```

**Metrics to track:**
```
- API p50 latency: < 100ms
- API p99 latency: < 500ms
- Queue processing time: 100-500ms per job
- DB connection usage: < 70%
- Worker CPU: < 80%
```

### Test Scenario 2: Sustained Load

**Objective:** Measure sustained throughput

```bash
# Continuous load for 5 minutes

Concurrency: 200 concurrent users
RPS: 50-100 requests/sec
Duration: 300 seconds
Expected jobs: 15,000 - 30,000
```

### Test Scenario 3: Worker Resilience

**Objective:** Test retry logic and recovery

```bash
1. Start normal load (100 RPS)
2. Kill 1 worker → observe job rebalancing
3. Kill another worker → observe queue handling
4. Restart workers → observe recovery
5. Monitor duplicate detection
```

---

### Tuning Parameters

**Database Connection Pool:**
```typescript
// typeorm.config.ts
{
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'password',
  database: 'betting_db',
  poolSize: 20,
  maxPoolSize: 30,
  // Formula: (API concurrency) + (sum of worker concurrency)
  // = 50 + (5+3+3) = 61, use 20 as poolSize for connection reuse
}
```

**Worker Concurrency:**
```typescript
// Start with conservative values, increase based on load
matcherWorker: 5    // 5 parallel matchers
settlerWorker: 3    // 3 parallel settlers
refundWorker: 3     // 3 parallel refund handlers

// Monitor DB connections and increase if <70% utilized
```

**BullMQ Job Options:**
```typescript
// Place bet job
queue.add('match', { betId }, {
  jobId: `match:${betId}`,     // Prevent duplicate enqueue
  attempts: 5,                   // Retry up to 5 times
  backoff: {
    type: 'exponential',
    delay: 2000                  // Start with 2s, exponential increase
  },
  removeOnComplete: true,        // Clean up succeeded jobs
  removeOnFail: 100              // Keep 100 most recent failures
});
```

---

## ✅ Checklist Implementasi

**Phase 1: Data Layer (Day 1)**
- [ ] PostgreSQL schema creation
- [ ] TypeORM migrations
- [ ] Index verification
- [ ] Connection pool testing

**Phase 2: API Implementation (Day 2)**
- [ ] Place bet endpoint
- [ ] Input validation
- [ ] Transaction logic
- [ ] Error handling
- [ ] Unit tests

**Phase 3: Queue & Workers (Day 3-4)**
- [ ] BullMQ setup
- [ ] Matcher worker
- [ ] Settler worker
- [ ] Refund worker
- [ ] Job retry logic
- [ ] Idempotency tests

**Phase 4: Testing & Tuning (Day 5)**
- [ ] Burst load test (500-1000 users)
- [ ] Sustained load test (100 RPS, 5min)
- [ ] Worker crash recovery
- [ ] Monitor and tune parameters

---

## 📚 Key Concepts

### Transaction Isolation
```
Level: READ COMMITTED (default PostgreSQL)
- Dirty reads: ❌ No
- Phantom reads: ⚠️ Possible (acceptable for betting)
- For fintech: Consider REPEATABLE READ or SERIALIZABLE
```

### Lock Types Used
```
SELECT ... FOR UPDATE        → Exclusive row lock
SELECT ... FOR UPDATE SKIP LOCKED → Exclusive, skip locked rows
SELECT ... FOR SHARE         → Shared lock (multiple readers OK)
```

### Why SKIP LOCKED?
```
Problem: Thundering herd

Worker 1: SELECT opponent FOR UPDATE → finds bet #2
Worker 2: SELECT opponent FOR UPDATE → WAITS for lock on bet #2
Worker 3: SELECT opponent FOR UPDATE → WAITS...

Solution: SKIP LOCKED

Worker 1: SELECT FOR UPDATE SKIP LOCKED → locks bet #2
Worker 2: SELECT FOR UPDATE SKIP LOCKED → skips #2, finds #3
Worker 3: SELECT FOR UPDATE SKIP LOCKED → skips #2-#3, finds #4
```

---

## 🚀 Performance Tips

1. **Connection Pooling:**
   ```
   PgBouncer or node-postgres internal pool
   Pool size = MIN(4 × CPU cores, 20)
   ```

2. **Batch Operations:**
   ```
   Insert 100 ledger rows at once
   3x faster than 100 individual inserts
   ```

3. **Query Timeout:**
   ```
   SET statement_timeout = 5000ms
   Prevents hanging queries
   ```

4. **Monitoring:**
   ```
   SELECT query, mean_exec_time FROM pg_stat_statements
   Find slow queries (> 100ms)
   ```

5. **Vacuum & Analyze:**
   ```
   ANALYZE wallet_ledgers;
   VACUUM wallet_ledgers;
   Run weekly
   ```

---

*Last updated: 2024 | Level 1: Basic Queue + Worker Pattern*
