# 📐 Sơ Đồ Kiến Trúc & Luồng Xử Lý - Betting API

> Tài liệu này tổng hợp toàn bộ kiến trúc, luồng dữ liệu, và quy trình xử lý của hệ thống Betting API

---

## 📋 Mục Lục
1. [Kiến Trúc Tổng Quan](#kiến-trúc-tổng-quan)
2. [Luồng Dữ Liệu](#luồng-dữ-liệu)
3. [Quy Trình Chi Tiết](#quy-trình-chi-tiết)
4. [Mô Hình Dữ Liệu](#mô-hình-dữ-liệu)
5. [Xử Lý Concurrency](#xử-lý-concurrency)
6. [Chiến Lược Scaling](#chiến-lược-scaling)

---

## 🏗️ Kiến Trúc Tổng Quan

### High-Level Architecture

```
┌─────────────┐
│   Clients   │
└──────┬──────┘
       │ HTTP/WS
       ▼
┌──────────────────────────────────────────────┐
│            API Server (Stateless)             │
│  - Authenticate User                         │
│  - Validate Bet Input                        │
│  - Create Wallet Ledger (Idempotent)         │
│  - Deduct Balance                            │
│  - Return 202 Accepted                       │
└──────────┬───────────────────────────────────┘
           │
      ┌────┴────┐
      │          │
      ▼          ▼
  ┌────────┐  ┌──────────────┐
  │ Queue  │  │  PostgreSQL  │
  │(BullMQ)│  │   Database   │
  └────┬───┘  └──────────────┘
       │
       ├─ Job: match:{betId}
       ├─ Job: settle:{matchId}
       └─ Job: refund:{betId}
       │
       ▼
┌──────────────────────────────────────┐
│       Worker Pool                     │
│  ├─ Matcher Worker (auto-matching)   │
│  ├─ Settler Worker (settlement)      │
│  └─ Payout Worker (refund/payout)    │
└──────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│    PostgreSQL Transactions            │
│  - Pessimistic Locking (FOR UPDATE)  │
│  - SKIP LOCKED for anti-thundering   │
│  - Append-only Ledger Pattern        │
└──────────────────────────────────────┘
```

---

## 🔄 Luồng Dữ Liệu

### Transaction Flow: User Places Bet

```
TIME LINE:

T0: User Request
   ├─ POST /api/bets
   ├─ { amount: 100, side: 'A' }
   └─ Returns: 202 Accepted

T0+1ms: Transaction A (API)
   ├─ QueryRunner A (BEGIN)
   ├─ SELECT wallet WHERE user_id = X FOR UPDATE
   │  └─ Check balance >= 100 ✓
   ├─ INSERT wallet_ledgers
   │  ├─ type: 'DEBIT'
   │  ├─ amount: -100
   │  ├─ reference_id: betId
   │  ├─ idempotent_key: 'BET:' + betId (UNIQUE)
   │  └─ User balance: 500 → 400
   ├─ INSERT bets
   │  ├─ status: PENDING
   │  ├─ amount: 100
   │  └─ side: 'A'
   └─ COMMIT

T0+2ms: Queue Job Created
   ├─ queue.add('match', { betId })
   ├─ jobId: 'match:' + betId
   └─ Status: PENDING

T1 (seconds later): Worker Picks Up Job
   ├─ Worker 1 receives job 'match:' + betId
   ├─ Optional: Redis lock (prevent thundering)
   └─ Load bet from DB (no tx)

T1+1ms: Transaction B (Worker - Matcher)
   ├─ QueryRunner B (BEGIN)
   ├─ SELECT bet WHERE id = betId FOR UPDATE
   │  └─ Check status = PENDING ✓
   ├─ SELECT opponent
   │  ├─ WHERE side != 'A'
   │  ├─ AND status = PENDING
   │  ├─ FOR UPDATE
   │  └─ SKIP LOCKED (avoid race)
   │
   ├─ IF opponent found:
   │  ├─ UPDATE bets SET status = MATCHED
   │  ├─ INSERT matches { bet_a, bet_b }
   │  ├─ queue.add('settle', { matchId })
   │  └─ COMMIT
   │
   └─ ELSE:
      └─ COMMIT (still PENDING)

T2 (seconds later): Worker Picks Up Settlement
   ├─ Worker 2 receives job 'settle:' + matchId
   ├─ Load match from DB
   └─ Transaction C (Worker - Settler)

T2+1ms: Transaction C (Worker - Settler)
   ├─ QueryRunner C (BEGIN)
   ├─ Determine winner (side A or B)
   ├─ Winner wallet SELECT ... FOR UPDATE
   │  └─ UPDATE balance += amount
   │  └─ INSERT ledger (CREDIT)
   ├─ Loser status update
   │  └─ UPDATE bets SET status = SETTLED
   ├─ If error:
   │  └─ queue.add('refund', { betId })
   │  └─ on retry: INSERT ledger (REFUND + amount)
   └─ COMMIT
```

---

## 🔀 Quy Trình Chi Tiết

### 1️⃣ API: Place Bet (Transaction A)

**Endpoint:** `POST /api/bets`

**Input:**
```json
{
  "userId": 123,
  "roundId": "round-2024-01-01",
  "amount": 100.50,
  "side": "A"
}
```

**Process:**
```
1. Validate user auth
   └─ Check JWT token

2. Validate input
   ├─ amount > 0 ✓
   ├─ amount <= max_bet ✓
   └─ side in ['A', 'B'] ✓

3. Start Transaction (QueryRunner)
   ├─ Lock wallet row: SELECT ... FOR UPDATE
   │  └─ prevents concurrent balance updates
   │
   ├─ Check balance
   │  └─ IF balance < amount → ROLLBACK + return 400
   │
   ├─ Create idempotent ledger entry
   │  ├─ INSERT wallet_ledgers
   │  ├─ idempotent_key = 'BET:' + betId
   │  └─ ON CONFLICT DO NOTHING (idempotent)
   │
   ├─ Update wallet balance
   │  └─ UPDATE wallets SET balance = balance - amount
   │
   ├─ Create bet record
   │  └─ INSERT bets (status=PENDING)
   │
   └─ COMMIT

4. Queue async job
   └─ queue.add('match', { betId })

5. Return Response
   └─ 202 Accepted with betId
```

**Error Handling:**
```
- Insufficient balance → 400 Bad Request
- Invalid input → 422 Unprocessable Entity
- Concurrent duplicate → 409 Conflict (idempotent_key)
- DB error → 500 Internal Server Error (auto-retry)
```

---

### 2️⃣ Worker: Auto-Matching (Matcher Worker)

**Job:** `match:{betId}`

**Process:**
```
1. Check job status
   ├─ IF already processed → skip
   └─ IF bet not PENDING → skip

2. Optional: Redis lock
   ├─ SET lock:bet:{betId} EX 30
   └─ Prevent duplicate processing (thundering herd)

3. Start Transaction
   ├─ SELECT bet WHERE id=betId FOR UPDATE
   │  ├─ Re-check status = PENDING
   │  └─ Prevent race condition
   │
   ├─ Find opponent (anti-race strategy)
   │  ├─ SELECT opponent
   │  │  ├─ FROM bets
   │  │  ├─ WHERE round_id = X
   │  │  ├─ AND side != original.side
   │  │  ├─ AND status = PENDING
   │  │  ├─ FOR UPDATE
   │  │  ├─ SKIP LOCKED ← KEY: Skip locked rows
   │  │  └─ LIMIT 1 ORDER BY created_at
   │  │
   │  ├─ SKIP LOCKED = skip rows locked by other txs
   │  └─ Prevents thundering herd
   │
   ├─ IF opponent found:
   │  ├─ UPDATE bets (both)
   │  │  └─ SET status = MATCHED, match_id = matchId
   │  │
   │  ├─ INSERT matches
   │  │  ├─ bet_a_id, bet_b_id
   │  │  ├─ amount, status = PENDING
   │  │  └─ created_at
   │  │
   │  └─ queue.add('settle', { matchId })
   │
   └─ COMMIT

4. Return
   └─ If matched: job success
   └─ If not matched: job success (still PENDING)
```

**Concurrency Control:**
```
┌─────────────┬─────────────┐
│  Worker 1   │  Worker 2   │
├─────────────┼─────────────┤
│ SELECT bet1 │             │
│ FOR UPDATE  │             │
│ (LOCKED)    │             │
│             │ SELECT bet1 │
│             │ FOR UPDATE  │
│             │ (WAIT...)   │
│ SELECT opp  │             │
│ SKIP LOCKED │             │
│ (finds bet2)│             │
│ UPDATE bet1 │             │
│ UPDATE bet2 │             │
│ INSERT match│             │
│ COMMIT      │             │
│             │ LOCK freed  │
│             │ But bet1    │
│             │ already     │
│             │ MATCHED ✓   │
│             │ so skip     │
│             │ COMMIT      │
└─────────────┴─────────────┘
```

---

### 3️⃣ Worker: Settlement (Settler Worker)

**Job:** `settle:{matchId}`

**Process:**
```
1. Load match from DB
   └─ Get bet_a_id, bet_b_id, amount

2. Determine winner
   ├─ Logic (example):
   │  ├─ If side A wins: winner = bet_a
   │  └─ If side B wins: winner = bet_b
   │
   └─ Can use external oracle / RNG / event result

3. Start Transaction
   ├─ Lock both wallets + matches
   │  ├─ SELECT wallets (both) FOR UPDATE
   │  └─ SELECT matches WHERE id = matchId FOR UPDATE
   │
   ├─ Credit winner
   │  ├─ amount = bet.amount × 2 (simplified)
   │  ├─ UPDATE wallets SET balance += amount
   │  ├─ INSERT wallet_ledgers
   │  │  ├─ type: CREDIT
   │  │  ├─ amount: +200
   │  │  ├─ reference_id: matchId
   │  │  └─ idempotent_key: 'SETTLE:' + matchId
   │  └─ UPDATE bets SET status = SETTLED
   │
   ├─ Mark loser
   │  ├─ UPDATE bets SET status = SETTLED
   │  └─ (money already deducted earlier)
   │
   ├─ Mark match as SETTLED
   │  └─ UPDATE matches SET status = SETTLED
   │
   ├─ IF error during transaction:
   │  ├─ ROLLBACK
   │  ├─ queue.add('refund', { betId }) ← retry
   │  └─ Worker retry with exponential backoff
   │
   └─ COMMIT

4. Emit events (optional)
   └─ Event: BetSettled { betId, matchId, winner }
```

**Error Recovery:**
```
┌─────────────────────────────────────┐
│  Settlement Fails                   │
│  (network error, DB crash, etc.)    │
└──────────────┬──────────────────────┘
               │
               ▼
       ROLLBACK (auto)
               │
               ▼
   Queue retries job
   (exponential backoff:
    1s, 5s, 30s, 5min...)
               │
               ▼
   If still fails after N retries
               │
               ▼
   Manual intervention
   + queue.add('refund', ...)
```

---

### 4️⃣ Worker: Refund (Payout Worker)

**Job:** `refund:{betId}`

**When triggered:**
```
- Match no opponent found after timeout
- Settlement failed permanently
- User requests refund
```

**Process:**
```
1. Check refund eligibility
   ├─ IF bet status = PENDING
   │  └─ matched = false: eligible
   │
   └─ IF bet status = SETTLED
      └─ eligible: (use case-specific logic)

2. Start Transaction
   ├─ SELECT wallets FOR UPDATE
   │
   ├─ Credit refund amount
   │  ├─ UPDATE wallets SET balance += amount
   │  ├─ INSERT wallet_ledgers
   │  │  ├─ type: REFUND
   │  │  ├─ amount: +100
   │  │  └─ idempotent_key: 'REFUND:' + betId
   │  │
   │  └─ Idempotent: can retry safely
   │
   ├─ Update bet status
   │  └─ UPDATE bets SET status = REFUNDED
   │
   └─ COMMIT

3. Verify refund
   └─ SELECT wallet balance (should match before)
```

---

## 📊 Mô Hình Dữ Liệu

### Database Schema

#### Table: wallets
```sql
CREATE TABLE wallets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL,
  balance NUMERIC(30,8) NOT NULL DEFAULT 0,
  locked_balance NUMERIC(30,8) DEFAULT 0,
  version INT DEFAULT 0,  -- for optimistic locking
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT balance_non_negative CHECK (balance >= 0)
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);
```

**Why this schema:**
- `balance`: actual liquid amount
- `locked_balance`: reserved for pending bets
- `version`: detect concurrent updates
- Check constraint: prevent negative balance

---

#### Table: wallet_ledgers (Append-Only)
```sql
CREATE TABLE wallet_ledgers (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  amount NUMERIC(30,8) NOT NULL,
  type TEXT NOT NULL,  -- DEBIT, CREDIT, REFUND, PAYOUT
  reference_id UUID,  -- betId, matchId
  bet_id UUID REFERENCES bets(id),
  idempotent_key VARCHAR(255) UNIQUE NOT NULL,
  balance_before NUMERIC(30,8),
  balance_after NUMERIC(30,8),
  created_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT type_check CHECK (type IN ('DEBIT', 'CREDIT', 'REFUND', 'PAYOUT'))
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
- Never update/delete entries
- Easy audit trail
- Supports ledger-first architecture

---

#### Table: bets
```sql
CREATE TABLE bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id),
  round_id UUID NOT NULL,
  amount NUMERIC(30,8) NOT NULL,
  side VARCHAR(1) NOT NULL,  -- 'A' or 'B'
  status VARCHAR(20) DEFAULT 'PENDING',
  -- PENDING → MATCHED → SETTLED/REFUNDED
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
CREATE INDEX idx_bets_status ON bets(status) WHERE status = 'PENDING';
CREATE INDEX idx_bets_match_id ON bets(match_id);
```

---

#### Table: matches
```sql
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_a_id UUID NOT NULL REFERENCES bets(id),
  bet_b_id UUID NOT NULL REFERENCES bets(id),
  amount NUMERIC(30,8) NOT NULL,
  winner_side VARCHAR(1),  -- 'A' or 'B'
  status VARCHAR(20) DEFAULT 'PENDING',
  -- PENDING → SETTLED
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT winner_check CHECK (winner_side IN ('A', 'B', NULL)),
  CONSTRAINT status_check CHECK (
    status IN ('PENDING', 'SETTLED')
  )
);

CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_created ON matches(created_at DESC);
```

---

## 🔒 Xử Lý Concurrency

### Problem: Thundering Herd

```
Scenario: 1000 users place bets in round 1

Worker 1: SELECT opponent FOR UPDATE → finds bet #2
Worker 2: SELECT opponent FOR UPDATE → also finds bet #2 ???
Worker 3: SELECT opponent FOR UPDATE → also finds bet #2 ???

Result: Multiple workers try to MATCH the same opponent
        → Race condition
        → Duplicate match creation
        → Money lost
```

### Solution: SKIP LOCKED

```sql
SELECT * FROM bets
WHERE round_id = 'round-1'
  AND status = 'PENDING'
  AND side = 'B'
FOR UPDATE SKIP LOCKED  ← KEY
LIMIT 1;
```

**What SKIP LOCKED does:**
```
Worker 1: Locks bet #2
Worker 2: Tries to lock bet #2
         → SKIP (it's locked)
         → Find next UNLOCKED bet #3
         → Lock it
         
Result: No duplicate matching ✓
```

### Diagram: Concurrency Control

```
TIME    Worker 1              Worker 2              DB (Bets)
────────────────────────────────────────────────────────────
T0      SELECT FOR UPDATE
        bet #100
        (LOCK)                                    [#100 LOCKED]

T1                            SELECT FOR UPDATE
                              bet #100
                              SKIP LOCKED
                              Find #101
                              (LOCK)              [#100 LOCKED]
                                                  [#101 LOCKED]

T2      SELECT opponent
        FROM status=PENDING
        SKIP LOCKED
        → finds #101 FREE?
        → No, already LOCKED
        → finds #102 FREE
        (LOCK)                                    [#100 LOCKED]
                                                  [#101 LOCKED]
                                                  [#102 LOCKED]

T3                            Found #101
                              UPDATE status=MATCHED
                              INSERT match
                              COMMIT

T4      SELECT opponent
        → finds #103 FREE
        MATCH & INSERT
        COMMIT
```

---

## 📈 Chiến Lược Scaling

### Level 1: Stateless API + Queue

**Capacity:** 500 - 2,000 concurrent users

```
Architecture:

         ┌─────────┐  ┌─────────┐  ┌─────────┐
         │  API 1  │  │  API 2  │  │  API 3  │
         └────┬────┘  └────┬────┘  └────┬────┘
              │            │            │
              └────────────┼────────────┘
                           │
                     ┌──────▼──────┐
                     │  Load Balancer
                     └──────┬──────┘
                            │
                    ┌───────┼───────┐
                    │       │       │
                    ▼       ▼       ▼
              ┌─────────────────┐
              │  Redis/BullMQ   │
              │  (Job Queue)    │
              └─────────────────┘
                    │
         ┌──────────┼──────────┐
         │          │          │
         ▼          ▼          ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │Worker 1│ │Worker 2│ │Worker 3│
    └────────┘ └────────┘ └────────┘
         │          │          │
         └──────────┼──────────┘
                    │
              ┌─────▼─────┐
              │ PostgreSQL │
              └───────────┘

Scaling strategy:
- Add more API servers (stateless)
- Add more workers (consume queue)
- Use RDS read replicas for reporting
- Enable query caching (Redis)
```

---

### Level 2: Event-Driven + Saga Pattern

**Capacity:** 2,000 - 10,000 concurrent users

```
Add: Outbox pattern

     ┌────────────────────────────┐
     │   Transaction (API/Worker) │
     ├────────────────────────────┤
     │  INSERT ledger             │
     │  INSERT bets               │
     │  INSERT outbox_events ◄──┐ │
     │  COMMIT ◄─────────────┐   │
     └────────────────────────┘   │
                                   │
                   ┌───────────────┘
                   │
                   ▼
         ┌──────────────────┐
         │ Event Dispatcher │ (polls DB)
         └────────┬─────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
        ▼         ▼         ▼
    ┌──────────────────────────┐
    │  Kafka/RabbitMQ Topics   │
    │  - bet.created           │
    │  - bet.matched           │
    │  - match.settled         │
    └──────────────────────────┘

Benefits:
- Event duplication prevention (Outbox)
- Decoupled services
- Replay capability
```

---

### Level 3: Ledger-First + Multi-DB

**Capacity:** 10,000+ concurrent users (production fintech)

```
      ┌─────────────┐
      │    API      │
      └──────┬──────┘
             │
             ▼
    ┌────────────────┐
    │  Write-DB      │
    │ (Postgres      │
    │  Ledger only)  │
    └────────┬───────┘
             │
    ┌────────▼──────────┐
    │  Batch Projection │
    │  (every 100ms)    │
    └────────┬──────────┘
             │
             ▼
    ┌────────────────┐
    │  Read-DB       │
    │ (Balance cache)│
    └────────────────┘

Write path:
  User → API → ledger INSERT → 202 ✓

Read path:
  User → Cache/ReadDB → stale balance (100ms)
```

---

## ✅ Checklist Implementasi

**Phase 1: MVP (Week 1-2)**
- [ ] Schema + migrations
- [ ] API: place bet (Transaction A)
- [ ] Worker: matcher (basic)
- [ ] Worker: settler
- [ ] Error handling

**Phase 2: Production (Week 3-4)**
- [ ] SKIP LOCKED optimization
- [ ] Idempotency keys
- [ ] Outbox pattern
- [ ] Monitoring (Prometheus)
- [ ] Stress testing

**Phase 3: Advanced (Week 5+)**
- [ ] Event-driven saga
- [ ] Multi-worker coordination
- [ ] Ledger partitioning
- [ ] Read replicas
- [ ] Advanced monitoring

---

## 📚 Reference Documentation

### Database Indexes Strategy
```
1. Foreign keys → always index
2. WHERE clauses → index columns
3. ORDER BY / GROUP BY → index columns
4. JOIN conditions → index join column
5. UNIQUE constraints → unique index

Example for bets:
✓ idx_bets_user_id → WHERE user_id = X
✓ idx_bets_round_id → WHERE round_id = X
✓ idx_bets_status → WHERE status = 'PENDING'
✗ Avoid: multi-column index if not used together
```

### Transaction Isolation Levels
```
READ UNCOMMITTED
  ├─ Dirty reads possible
  └─ Not recommended for fintech

READ COMMITTED (default)
  ├─ No dirty reads
  ├─ Phantom reads possible
  └─ OK for most cases

REPEATABLE READ
  ├─ No dirty/phantom reads
  ├─ Serialization anomaly possible
  └─ OK for betting

SERIALIZABLE
  ├─ Full isolation
  ├─ Highest safety
  └─ Slowest (for fintech only if needed)
```

### Lock Types
```
SELECT FOR UPDATE       → exclusive row lock
SELECT FOR UPDATE SKIP LOCKED → exclusive, skip locked rows
SELECT FOR SHARE        → shared lock (multiple readers)
SELECT ... NOWAIT       → no wait for lock (error if locked)
```

---

## 🚀 Performance Tips

1. **Connection pooling:** PgBouncer / node-postgres pool size = min(4 × cores, 32)
2. **Batch operations:** insert N ledgers in one query (3x faster)
3. **Query timeouts:** SET statement_timeout = 5000ms
4. **Vacuum:** analyze tables regularly
5. **Monitoring:** track slow queries (> 100ms)

---

*Last updated: 2024*
