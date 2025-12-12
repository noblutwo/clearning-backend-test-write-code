# 📐 ARCHITECTURE LEVEL 2: EVENT-DRIVEN + SAGA + ADVANCED DB (2K-10K Users)

> **Mô tả:** Hệ thống Betting API nâng cao với Event Sourcing, Saga Pattern, Outbox Pattern, và Database indexing chuẩn Production
>
> **Khả năng:** 2,000 - 10,000 concurrent users
>
> **Công nghệ:** Node.js + TypeORM + PostgreSQL + BullMQ + Kafka (optional) + OpenTelemetry

---

## 📋 Mục Lục
1. [Kiến Trúc Event-Driven](#kiến-trúc-event-driven)
2. [Outbox Pattern Chi Tiết](#outbox-pattern-chi-tiết)
3. [Saga Pattern & Compensation](#saga-pattern--compensation)
4. [Database Indexing Strategy](#database-indexing-strategy)
5. [Sequence Diagrams](#sequence-diagrams)
6. [Race Condition & Solutions](#race-condition--solutions)

---

## 🏗️ Kiến Trúc Event-Driven

### High-Level Architecture

```
┌──────────────────────────────────────────────────┐
│         CLIENT APPLICATIONS                      │
└──────────────┬───────────────────────────────────┘
               │ HTTP REST / gRPC
               ▼
┌──────────────────────────────────────────────────┐
│     API SERVER (Stateless, Horizontal)           │
│  - Validate Input                                │
│  - Start Saga Orchestration                      │
│  - Fire Command (not queue directly)             │
└──────────────┬───────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│   TRANSACTION SERVICE                            │
│  - Create Wallet Ledger                          │
│  - Deduct Balance                                │
│  - INSERT INTO outbox_events (same TX)           │
│  - COMMIT (all or nothing)                       │
└──────────────┬───────────────────────────────────┘
               │
         ┌─────┴──────────┐
         │                │
         ▼                ▼
    ┌─────────┐     ┌──────────────┐
    │ DB      │     │ outbox_events│
    │(Ledger) │     │(guarantee)   │
    └─────────┘     └──────┬───────┘
                           │
                           ▼
                ┌────────────────────┐
                │ Event Dispatcher   │
                │ (Poll DB)          │
                │ Every 100ms        │
                └────────┬───────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌─────────┐  ┌────────────┐  ┌────────────┐
    │ Kafka   │  │ RabbitMQ   │  │ Redis      │
    │ Topics  │  │ Exchanges  │  │ PubSub     │
    └────┬────┘  └────┬───────┘  └────┬───────┘
         │            │              │
    ┌────┴────────────┴──────────────┴────┐
    │                                     │
    ▼ Topic: bet.created               ▼ Topic: bet.matched
┌──────────────────────┐        ┌────────────────────┐
│ Matcher Service      │        │ Settlement Service │
│ - Auto-match        │        │ - Determine winner │
│ - Create Saga Step 2│        │ - Payout logic     │
└──────────┬───────────┘        └────────┬───────────┘
           │                             │
           └─────────────┬───────────────┘
                         │
                    ┌────▼─────┐
                    │ Saga      │
                    │ Orchest.  │
                    │ Coordinator
                    └───────────┘
```

---

## 📦 Outbox Pattern Chi Tiết

### The Problem: Event Loss

```
Scenario WITHOUT Outbox:

┌────────────────────────────────────┐
│ Transaction                        │
├────────────────────────────────────┤
│ ✅ INSERT wallet_ledgers           │
│ ✅ UPDATE wallets                  │
│ ✅ INSERT bets                     │
│ ✅ COMMIT                          │
└────────────────────────────────────┘
           │
           ▼ (API publishes event)
     ┌──────────┐
     │  Kafka   │ ← ❌ API CRASHES HERE!
     │  Topic   │
     └──────────┘

Result: Event NEVER published!
Worker never knows bet was placed → Lost money
```

### The Solution: Outbox Pattern

```
Scenario WITH Outbox (Transactional Inbox):

┌──────────────────────────────────────────┐
│ Transaction (single COMMIT)              │
├──────────────────────────────────────────┤
│ ✅ INSERT wallet_ledgers                 │
│ ✅ UPDATE wallets                        │
│ ✅ INSERT bets                           │
│ ✅ INSERT outbox_events ← In same TX!    │
│ ✅ COMMIT (all or nothing)               │
└──────────────────────────────────────────┘
           │
    ✅ Either ALL succeed
    ❌ Or ALL fail (no orphan events)
           │
           ▼ (Poll-based dispatcher)
     ┌──────────────┐
     │  outbox_events
     │  Dispatcher  │
     └──────┬───────┘
            │ (reads from DB regularly)
            │ marks as published
            ▼
      ┌──────────┐
      │  Kafka   │
      │  Topic   │
      └──────────┘
           │
           ✅ Guaranteed delivery!
```

### Database Schema: Outbox Table

```sql
CREATE TABLE outbox_events (
  id BIGSERIAL PRIMARY KEY,
  aggregate_id UUID NOT NULL,        -- betId, matchId
  aggregate_type VARCHAR(255) NOT NULL,  -- 'Bet', 'Match'
  event_type VARCHAR(255) NOT NULL,  -- 'BetCreated', 'BetMatched'
  payload JSONB NOT NULL,            -- event data
  created_at TIMESTAMP DEFAULT now(),
  published_at TIMESTAMP,            -- NULL until dispatcher publishes
  idempotent_key VARCHAR(255) UNIQUE NOT NULL,
  
  CONSTRAINT published_check CHECK (
    (published_at IS NULL) OR (published_at > created_at)
  )
);

CREATE INDEX idx_outbox_published 
  ON outbox_events(published_at, created_at)
  WHERE published_at IS NULL;

CREATE INDEX idx_outbox_aggregate 
  ON outbox_events(aggregate_type, aggregate_id);
```

**Why this works:**
- Event saved in **same TX** as domain data
- Dispatcher polls DB every 100ms
- Marks events as `published_at` after successful publish
- If dispatcher crashes, events are NOT lost
- Can replay events from outbox (event sourcing!)

---

### Insert into Outbox (during API call)

```typescript
async function placeBetWithOutbox(
  manager: EntityManager,
  userId: number,
  betData: PlaceBetRequest
) {
  const betId = generateUuid();
  
  // All in one transaction
  await manager.transaction(async (txManager) => {
    // 1. Debit ledger
    await txManager.insert(WalletLedger, {
      user_id: userId,
      amount: -betData.amount,
      type: 'DEBIT',
      reference_id: betId,
      idempotent_key: `BET:${betId}`
    });
    
    // 2. Update wallet balance
    await txManager.increment(
      Wallet,
      { user_id: userId },
      'balance',
      -betData.amount
    );
    
    // 3. Create bet
    const bet = await txManager.insert(Bet, {
      id: betId,
      user_id: userId,
      amount: betData.amount,
      side: betData.side,
      status: 'PENDING'
    });
    
    // 4. ✅ INSERT INTO OUTBOX (in same TX!)
    await txManager.insert(OutboxEvent, {
      aggregate_id: betId,
      aggregate_type: 'Bet',
      event_type: 'BetCreated',
      payload: {
        betId,
        userId,
        amount: betData.amount,
        side: betData.side,
        roundId: betData.roundId,
        timestamp: new Date().toISOString()
      },
      idempotent_key: `BET_CREATED:${betId}`
    });
    
    // COMMIT happens here (all or nothing!)
  });
  
  return { betId, status: 'PENDING' };
}
```

### Event Dispatcher (Poll-Based)

```typescript
async function eventDispatcher(kafka: KafkaProducer) {
  setInterval(async () => {
    try {
      // Poll unpublished events
      const unpublished = await outboxRepo.find({
        where: { published_at: IsNull() },
        order: { created_at: 'ASC' },
        take: 100  // Process in batches
      });
      
      for (const event of unpublished) {
        try {
          // Publish to Kafka
          await kafka.send({
            topic: `${event.aggregate_type.toLowerCase()}.${event.event_type}`,
            messages: [{
              key: event.aggregate_id,
              value: JSON.stringify(event.payload),
              headers: {
                'idempotent-key': event.idempotent_key,
                'event-type': event.event_type
              }
            }]
          });
          
          // Mark as published
          await outboxRepo.update(
            { id: event.id },
            { published_at: new Date() }
          );
          
          console.log(`✅ Published event ${event.id}`);
          
        } catch (error) {
          console.error(`❌ Failed to publish event ${event.id}:`, error);
          // Retry on next iteration (exponential backoff optional)
        }
      }
      
    } catch (error) {
      console.error('❌ Event dispatcher error:', error);
    }
  }, 100);  // Poll every 100ms
}
```

---

## 🎭 Saga Pattern & Compensation

### What is Saga?

A **Saga** is a long-running transaction across multiple services that can fail and compensate.

**Example Betting Saga:**
```
Step 1: Debit Wallet (API)
        ↓
Step 2: Create Bet (API)
        ↓
Step 3: Auto-Match (Matcher Service)
        ↓
Step 4: Settle Match (Settler Service)
        ↓
Step 5: Credit Winner (Payout Service)

If any step fails → Compensation (refund, rollback state)
```

### Saga Orchestrator Implementation

```typescript
// Saga state machine
interface BettingSaga {
  sagaId: string;
  betId: string;
  userId: number;
  status: 'STARTED' | 'MATCHED' | 'SETTLED' | 'COMPENSATING' | 'FAILED' | 'COMPLETED';
  steps: SagaStep[];
}

interface SagaStep {
  name: 'DEBIT' | 'MATCH' | 'SETTLE' | 'PAYOUT';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'COMPENSATED';
  result?: any;
  error?: string;
}

class SagaOrchestrator {
  async startBettingSaga(betId: string, userId: number) {
    const sagaId = generateId();
    
    const saga: BettingSaga = {
      sagaId,
      betId,
      userId,
      status: 'STARTED',
      steps: [
        { name: 'DEBIT', status: 'PENDING' },
        { name: 'MATCH', status: 'PENDING' },
        { name: 'SETTLE', status: 'PENDING' },
        { name: 'PAYOUT', status: 'PENDING' }
      ]
    };
    
    // Save saga state to DB (for recovery)
    await sagaRepo.save(saga);
    
    // Execute steps
    try {
      // Step 1: DEBIT
      console.log(`[${sagaId}] Step 1: DEBIT`);
      await executeDebit(userId, betData.amount);
      saga.steps[0].status = 'COMPLETED';
      
      // Step 2: MATCH (wait for matcher service event)
      console.log(`[${sagaId}] Step 2: Waiting for MATCH`);
      const matchEvent = await waitForEvent('bet.matched', betId, 30000);
      saga.steps[1].status = 'COMPLETED';
      saga.steps[1].result = matchEvent;
      saga.status = 'MATCHED';
      
      // Step 3: SETTLE (wait for settler service event)
      console.log(`[${sagaId}] Step 3: Waiting for SETTLE`);
      const settleEvent = await waitForEvent('match.settled', matchEvent.matchId, 30000);
      saga.steps[2].status = 'COMPLETED';
      saga.steps[2].result = settleEvent;
      saga.status = 'SETTLED';
      
      // Step 4: PAYOUT (done automatically by settler)
      console.log(`[${sagaId}] Step 4: PAYOUT`);
      saga.steps[3].status = 'COMPLETED';
      saga.status = 'COMPLETED';
      
      await sagaRepo.save(saga);
      
    } catch (error) {
      console.error(`[${sagaId}] ❌ Saga failed at step:`, error);
      saga.status = 'COMPENSATING';
      await sagaRepo.save(saga);
      
      // Execute compensation
      await compensateSaga(saga);
    }
  }
  
  async compensateSaga(saga: BettingSaga) {
    // Compensation logic (reverse each step)
    
    // If DEBIT succeeded → refund
    if (saga.steps[0].status === 'COMPLETED') {
      console.log(`[${saga.sagaId}] Compensating: Refund user`);
      await executeRefund(saga.userId, saga.steps[0].result.amount);
    }
    
    // If MATCH succeeded → unMatch
    if (saga.steps[1].status === 'COMPLETED') {
      console.log(`[${saga.sagaId}] Compensating: UnMatch bets`);
      await executeUnmatch(saga.betId);
    }
    
    // If SETTLE succeeded → reverse payout
    if (saga.steps[2].status === 'COMPLETED') {
      console.log(`[${saga.sagaId}] Compensating: Reverse payout`);
      await executeReversePayout(saga.steps[2].result.matchId);
    }
    
    saga.status = 'FAILED';
    await sagaRepo.save(saga);
  }
}
```

---

## 📊 Database Indexing Strategy

### Index Theory

**Without Index:**
```sql
SELECT * FROM bets WHERE round_id = 123;
```
- PostgreSQL performs FULL TABLE SCAN
- Complexity: O(N) where N = total rows
- Example: 1M rows → 800ms for cold cache

**With Index:**
```sql
CREATE INDEX idx_bets_round_id ON bets(round_id);
```
- PostgreSQL uses B-Tree index
- Complexity: O(log N)
- Example: 1M rows → 5ms

**Real Performance Data:**
```
Row Count | No Index | With Index | Speedup
──────────┼──────────┼────────────┼────────
10,000    | 30ms     | 1ms        | 30x
100,000   | 300ms    | 5ms        | 60x
1,000,000 | 3,000ms  | 20ms       | 150x
10,000,000| 30,000ms | 100ms      | 300x
```

---

### Indexing Strategy for Betting System

#### 1. Foreign Key Indexes (ALWAYS CREATE)

```sql
CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_round_id ON bets(round_id);
CREATE INDEX idx_matches_bet_a ON matches(bet_a_id);
CREATE INDEX idx_matches_bet_b ON matches(bet_b_id);
CREATE INDEX idx_wallet_ledger_user ON wallet_ledgers(user_id);
```

**Why:** Prevent sequential scans on JOINs

---

#### 2. Query Condition Indexes (WHERE clauses)

```sql
-- Query: SELECT * FROM bets WHERE status = 'PENDING'
CREATE INDEX idx_bets_status ON bets(status)
  WHERE status IN ('PENDING', 'MATCHED');

-- Query: SELECT * FROM bets WHERE round_id = X AND status = 'PENDING'
CREATE INDEX idx_bets_round_status ON bets(round_id, status);

-- Query: SELECT * FROM wallet_ledgers WHERE user_id = X ORDER BY created_at DESC
CREATE INDEX idx_ledger_user_created 
  ON wallet_ledgers(user_id, created_at DESC);
```

**Why:** Avoid full table scan on WHERE conditions

---

#### 3. Composite Indexes (for multi-column queries)

```sql
-- Query: SELECT * FROM bets 
-- WHERE round_id = X AND status = 'PENDING' AND side = 'A'
CREATE INDEX idx_bets_composite 
  ON bets(round_id, status, side);

-- ✅ Index columns in query order (round_id first, then status, then side)
-- ❌ DON'T create idx(status, round_id, side) - wrong order!
```

**Order Matters:**
```
Query: WHERE round_id = X AND status = Y AND side = Z

Index: (round_id, status, side)  ✅ FAST
  - Filters on round_id first (most selective)
  - Then status (mid selective)
  - Then side (least selective)

Index: (status, round_id, side)  ❌ SLOW
  - PostgreSQL can't use full index
  - Still needs to filter by round_id after
```

---

#### 4. Covering Indexes (for SELECT optimization)

```sql
-- Instead of:
SELECT * FROM bets WHERE round_id = X;

-- Use covering index if possible:
CREATE INDEX idx_bets_round_covered 
  ON bets(round_id) 
  INCLUDE (user_id, amount, side, status);
  -- Allows index-only scan (no need to read heap)
```

---

#### 5. Partial Indexes (for filtered data)

```sql
-- Only index PENDING bets (most queried)
CREATE INDEX idx_bets_pending 
  ON bets(round_id)
  WHERE status = 'PENDING';

-- Benefits:
-- - Smaller index (faster scans)
-- - Faster inserts/updates
-- - Example: bets with 1M rows, only 100k PENDING
--   Index size: 10% of full index
```

---

### Complete Indexing Strategy for Betting DB

```sql
-- ===== WALLETS TABLE =====
CREATE INDEX idx_wallets_user_id ON wallets(user_id);

-- ===== WALLET_LEDGERS TABLE =====
CREATE INDEX idx_ledger_user_created 
  ON wallet_ledgers(user_id, created_at DESC);
CREATE INDEX idx_ledger_idempotent 
  ON wallet_ledgers(idempotent_key) 
  WHERE published_at IS NULL;  -- Partial
CREATE INDEX idx_ledger_reference 
  ON wallet_ledgers(reference_id);

-- ===== BETS TABLE =====
CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_round_status 
  ON bets(round_id, status);
CREATE INDEX idx_bets_match_id ON bets(match_id);
CREATE INDEX idx_bets_pending 
  ON bets(round_id, created_at ASC)
  WHERE status = 'PENDING';  -- Partial, for matcher

-- ===== MATCHES TABLE =====
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_created ON matches(created_at DESC);

-- ===== OUTBOX_EVENTS TABLE =====
CREATE INDEX idx_outbox_unpublished 
  ON outbox_events(created_at)
  WHERE published_at IS NULL;  -- Partial
CREATE INDEX idx_outbox_aggregate 
  ON outbox_events(aggregate_type, aggregate_id);

-- ===== SAGA TABLE =====
CREATE INDEX idx_saga_status ON saga_orchestrations(status)
  WHERE status != 'COMPLETED';  -- Partial
```

---

## 🔄 Sequence Diagrams

### Diagram 1: Complete Betting Flow (with Outbox)

```
Timeline:

T=0ms: Client → API
│
└─> API.POST /bets
    ├─ Input validation ✓
    └─ withTransaction:
       ├─ Insert wallet_ledger (DEBIT) ✓
       ├─ Update wallet balance ✓
       ├─ Insert bet (PENDING) ✓
       ├─ INSERT outbox_events (BetCreated) ✓
       └─ COMMIT ✓
    
    └─ Return 202 Accepted

    Note: Event is now in DB (guaranteed)
    Client doesn't need to know about Kafka yet

T=100ms: Event Dispatcher polls outbox
│
└─> Find unpublished events from DB
    ├─ BetCreated event found
    ├─ Publish to Kafka: "bet.created"
    └─ UPDATE outbox_events SET published_at = now()

T=200ms: Matcher Service subscribes to "bet.created"
│
└─> Receive message
    ├─ Load bet from DB
    ├─ withTransaction:
    │  ├─ SELECT PENDING bets FOR UPDATE SKIP LOCKED
    │  ├─ Match bet A with bet B
    │  ├─ Update both to MATCHED
    │  ├─ INSERT match
    │  └─ INSERT outbox_events (BetMatched)
    └─ COMMIT

T=300ms: Event Dispatcher publishes BetMatched

T=400ms: Settler Service receives BetMatched
│
└─> Process settlement
    ├─ Determine winner
    ├─ withTransaction:
    │  ├─ Credit winner wallet
    │  ├─ UPDATE bets to SETTLED
    │  ├─ UPDATE match to SETTLED
    │  └─ INSERT outbox_events (MatchSettled)
    └─ COMMIT

Final State:
├─ Wallet: User A -100 (DEBIT)
├─ Wallet: User B -100 (DEBIT)
├─ Wallet: Winner +200 (CREDIT)
├─ Bet A: SETTLED
├─ Bet B: SETTLED
├─ Match: SETTLED
└─ All events published in Kafka (idempotent!)
```

### Diagram 2: Race Condition Prevention

```
Scenario: 2 workers try to match same opponent

┌────────────────────────────────────┐
│ Worker 1: Processing bet_A          │
├────────────────────────────────────┤
│ T0: SELECT bet_A FOR UPDATE        │
│     (ROW LOCKED) ✓                 │
│                                    │
│     SELECT opponent                │
│     FROM PENDING                   │
│     FOR UPDATE SKIP LOCKED         │
│     → finds bet_B (UNLOCKED)       │
│     Lock bet_B ✓                   │
│                                    │
│ T1: UPDATE bet_A status=MATCHED    │
│     UPDATE bet_B status=MATCHED    │
│     INSERT match                   │
│     COMMIT ✓                       │
└────────────────────────────────────┘

Parallel:

┌────────────────────────────────────┐
│ Worker 2: Processing bet_C          │
├────────────────────────────────────┤
│ T0: SELECT bet_C FOR UPDATE        │
│     (ROW LOCKED) ✓                 │
│                                    │
│     SELECT opponent                │
│     FROM PENDING                   │
│     FOR UPDATE SKIP LOCKED         │
│     SKIP:                          │
│     ├─ bet_A (LOCKED by W1)        │
│     ├─ bet_B (LOCKED by W1)        │
│     → finds bet_D (UNLOCKED)       │
│     Lock bet_D ✓                   │
│                                    │
│ T1: UPDATE bet_C status=MATCHED    │
│     UPDATE bet_D status=MATCHED    │
│     INSERT match                   │
│     COMMIT ✓                       │
└────────────────────────────────────┘

Result: ✅ CORRECT
├─ Worker 1: Match bet_A + bet_B
├─ Worker 2: Match bet_C + bet_D
├─ No double-matching ✓
└─ No race condition ✓
```

### Diagram 3: Saga Failure & Compensation

```
T=0: Start saga
    Status: STARTED

T=100: Step 1 - DEBIT
    wallet.balance: 500 → 400 ✓
    Status: User balance reduced

T=200: Step 2 - MATCH
    Matcher service: Bet matched ✓
    Status: MATCHED

T=300: Step 3 - SETTLE (FAILS!)
    Settler service: ERROR!
    (e.g., winner lookup failed)
    
    Status: COMPENSATING
    ├─ Undo Step 2 (UnMatch) ✓
    │  ├─ Update bet status to PENDING
    │  ├─ Delete match record
    │  └─ INSERT outbox_events (BetUnmatched)
    │
    ├─ Undo Step 1 (Refund) ✓
    │  ├─ wallet.balance: 400 → 500
    │  ├─ INSERT ledger (REFUND)
    │  └─ UPDATE bet status to REFUNDED
    │
    └─ Final status: FAILED

Result: ✅ ROLLBACK
├─ User balance restored: 500 ✓
├─ Bet status: REFUNDED ✓
├─ No orphan matches ✓
└─ Saga recorded for audit ✓
```

---

## 🐛 Race Condition & Solutions

### Race Condition 1: Thundering Herd

**Problem:**
```
100 workers all find same bet as opponent
→ All try to match same bet
→ Multiple matches created (data corruption)
```

**Solution: SKIP LOCKED**
```sql
SELECT * FROM bets
WHERE round_id = X
  AND status = 'PENDING'
  AND side = 'B'
FOR UPDATE SKIP LOCKED
LIMIT 1;
```

---

### Race Condition 2: Double Payout

**Problem:**
```
Settlement TX: INSERT ledger (CREDIT winner)
Network issue: Response never sent to client
Client retries settlement

Worker 1: INSERT ledger (payoutId)
Worker 2: INSERT same idempotent_key
→ Double insertion possible
```

**Solution: Idempotent Key**
```sql
CREATE UNIQUE INDEX idx_ledger_idempotent
ON wallet_ledgers(idempotent_key);

-- If duplicate insert:
INSERT INTO wallet_ledgers (..., idempotent_key='SETTLE:123')
VALUES (...)
ON CONFLICT (idempotent_key) DO NOTHING;
```

---

### Race Condition 3: Concurrent Balance Updates

**Problem:**
```
User wallet balance: 500

Request 1: Debit 100 → 400
Request 2: Debit 200 → 300 (should be 400)

Race condition: Both read 500, both update independently
→ Final balance: 400 or 300 (wrong!)
```

**Solution: Row Lock**
```sql
SELECT balance FROM wallets
WHERE user_id = X
FOR UPDATE;  -- Exclusive lock

UPDATE wallets SET balance = balance - 100
WHERE user_id = X;

-- Only one TX can hold lock at a time
-- Queries queue up (serialized)
```

---

## 🚀 Performance Optimization Checklist

- [ ] **Indexes:** All FK, WHERE, ORDER BY columns indexed
- [ ] **Query timeout:** SET statement_timeout = 5000ms
- [ ] **Connection pool:** 20-30 max connections
- [ ] **Vacuum:** VACUUM ANALYZE wallets weekly
- [ ] **Query logging:** Enable slow query log (> 100ms)
- [ ] **Batch operations:** Insert 100+ rows at once (3x faster)
- [ ] **JSON parsing:** Cache parsed payloads to avoid re-parsing
- [ ] **Read replicas:** Use for reporting queries (non-payment)
- [ ] **Partition:** If tables > 1GB, consider partitioning

---

## 📚 Key Patterns

| Pattern | Use Case | Pros | Cons |
|---------|----------|------|------|
| **Outbox** | Event guarantee | Never loses events | Polling overhead |
| **Saga** | Long-running TX | Handles failures | Complexity |
| **SKIP LOCKED** | Concurrent writes | Avoids thundering herd | Limited to Postgres 11+ |
| **Idempotent Key** | Retry safety | Exactly-once semantics | Unique index overhead |
| **Partial Index** | Filtered queries | 90% size reduction | Added complexity |

---

*Last updated: 2024 | Level 2: Event-Driven + Saga + Advanced DB*
