# 📐 ARCHITECTURE LEVEL 3: LEDGER-FIRST FINTECH SCALE (10K-1M Users)

> **Mô tả:** Hệ thống Betting API production-grade cho hàng trăm nghìn đến triệu users đồng thời
> 
> **Khả năng:** 10,000 - 1,000,000 concurrent users
> 
> **Công nghệ:** Node.js + TypeORM + PostgreSQL + Kafka + OpenTelemetry + Prometheus + ELK
> 
> **Kiến trúc:** Ledger-First + Event Sourcing + CQRS + Sharding

---

## 📋 Mục Lục
1. [Ledger-First Architecture](#ledger-first-architecture)
2. [Write-Read Separation (CQRS)](#write-read-separation-cqrs)
3. [Kafka as Event Bus](#kafka-as-event-bus)
4. [Database Sharding Strategy](#database-sharding-strategy)
5. [Horizontal Scaling](#horizontal-scaling)
6. [Disaster Recovery & Monitoring](#disaster-recovery--monitoring)

---

## 🏗️ Ledger-First Architecture

### Core Concept: Balance as Computation

**Traditional Approach (WRONG for fintech):**
```
wallet.balance = 500   ← Direct state

User deposits $100:
UPDATE wallets SET balance = 500 + 100 = 600
→ Easy to corrupt, hard to audit
→ If TX fails halfway, balance incorrect
```

**Ledger-First Approach (CORRECT for fintech):**
```
wallet_ledger (append-only):
├─ ID | User | Type   | Amount | Timestamp
├─ 1  | 123  | CREDIT | 500    | 2024-01-01
├─ 2  | 123  | DEBIT  | -100   | 2024-01-02
├─ 3  | 123  | CREDIT | 100    | 2024-01-03
└─ 4  | 123  | CREDIT | 50     | 2024-01-04

Balance = SUM(ledger) = 500 - 100 + 100 + 50 = 550
→ Always consistent
→ Full audit trail
→ Easy to reconcile
```

---

### High-Level Architecture

```
┌────────────────────────────────────────────────────────────┐
│             CLIENT APPLICATIONS                            │
│    (Web, Mobile, Trading Terminal)                         │
└────────────────┬─────────────────────────────────────────┘
                 │ HTTP / gRPC
                 ▼
     ┌──────────────────────────┐
     │   API GATEWAY            │
     │ (Rate limiter, Router)   │
     └──────────┬───────────────┘
                │
    ┌───────────┼───────────────┐
    ▼           ▼               ▼
┌─────────┐┌──────────┐┌──────────────┐
│  API 1  ││  API 2   ││   API 3      │
│(stateless)│(stateless)│(stateless)   │
└────┬────┘└────┬─────┘└──────┬───────┘
     └──────────┬──────────────┘
                │
                ▼
    ┌───────────────────────────────┐
    │  Write-DB (Postgres Primary)   │
    │                               │
    │  wallet_ledger (append-only)  │
    │  ├─ LEDGER TABLE (billions)   │
    │  ├─ Partitioned by user_id   │
    │  ├─ Immutable = Safe         │
    │  └─ Full audit trail         │
    │                               │
    │  events (outbox)              │
    │  bets, matches (transient)    │
    └────────────────┬──────────────┘
                     │
      ┌──────────────┼──────────────┐
      │              │              │
      ▼              ▼              ▼
  ┌────────┐ ┌────────────┐ ┌─────────┐
  │ Kafka  │ │ Projection │ │ Read DB │
  │ Topics │ │ Builder    │ │ Replica │
  └────┬───┘ └─────┬──────┘ └────┬────┘
       │           │            │
       │      ┌────▼──────┐     │
       │      │wallet_    │     │
       │      │balance_   │     │
       │      │projection │     │
       │      └────┬──────┘     │
       │           │            │
       └───────────┼────────────┘
                   │
                   ▼
        ┌────────────────────────┐
        │  Read Cache (Redis)    │
        │  - Current balances    │
        │  - User stats          │
        │  - Recent transactions │
        └────────────────────────┘
                   │
                   ▼
        ┌────────────────────────┐
        │   CLIENT (Show $550)   │
        └────────────────────────┘
```

---

### Schema: Ledger-First Design

#### 1. Ledger Table (Append-Only, Immutable)

```sql
CREATE TABLE wallet_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  
  -- Transaction type
  type VARCHAR(20) NOT NULL,  -- DEBIT, CREDIT, REFUND, PAYOUT
  amount BIGINT NOT NULL,     -- In cents: 1$ = 100
  
  -- Causality tracking
  bet_id UUID,
  match_id UUID,
  reference_id VARCHAR(255),
  
  -- Idempotency & deduplication
  idempotent_key VARCHAR(255) UNIQUE NOT NULL,
  
  -- Audit trail
  created_at TIMESTAMP DEFAULT now(),
  created_by VARCHAR(255),    -- API, Matcher, Settler, Admin
  
  -- Snapshot for verification
  balance_snapshot BIGINT,    -- Balance AFTER this entry
  
  -- Partition key
  partition_key SMALLINT GENERATED ALWAYS AS (user_id % 100) STORED
);

-- Partitioning by user_id (1M users → 100 partitions)
CREATE TABLE wallet_ledger_0 PARTITION OF wallet_ledger
  FOR VALUES WITH (MODULUS 100, REMAINDER 0);
CREATE TABLE wallet_ledger_1 PARTITION OF wallet_ledger
  FOR VALUES WITH (MODULUS 100, REMAINDER 1);
-- ... repeat for 100 partitions

-- Critical indexes
CREATE INDEX idx_ledger_user_created 
  ON wallet_ledger(user_id, created_at DESC);
CREATE INDEX idx_ledger_idempotent 
  ON wallet_ledger(idempotent_key);

-- Partial index for recent entries (faster queries)
CREATE INDEX idx_ledger_recent 
  ON wallet_ledger(user_id)
  WHERE created_at > now() - INTERVAL '7 days';
```

**Why this works:**
- **Immutable:** INSERT-ONLY, never UPDATE/DELETE
- **Partitioned:** 1M users → 100 partitions (10k rows each)
- **Audit-ready:** Full history for compliance
- **Snapshot:** Quick balance verification

---

#### 2. Projection Table (Read-Model, Eventually Consistent)

```sql
CREATE TABLE wallet_balance_projection (
  user_id BIGINT PRIMARY KEY,
  balance BIGINT NOT NULL,      -- Cached balance
  last_ledger_id BIGINT NOT NULL,  -- Which ledger entry processed
  updated_at TIMESTAMP DEFAULT now(),
  version INT DEFAULT 0          -- For optimistic locking
);

CREATE INDEX idx_projection_updated 
  ON wallet_balance_projection(updated_at DESC)
  WHERE balance < 0;  -- Alert on negative balances

-- This table is UPDATED by projection builder
-- Eventual consistency: may lag 100-500ms behind ledger
```

**Consistency Model:**
```
Write-DB (Ledger):           Read-DB (Projection):
├─ user_id: 123              ├─ user_id: 123
├─ balance snapshot: 550     ├─ balance: 500 (STALE)
└─ committed                 └─ (will update in 100ms)

User queries balance:
├─ If needs immediate: read from ledger (slow)
├─ If can tolerate stale: read from projection (fast)
└─ Check updated_at timestamp to decide
```

---

#### 3. Events Table (Event Sourcing)

```sql
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID UNIQUE NOT NULL,
  aggregate_id VARCHAR(255) NOT NULL,  -- betId, matchId
  aggregate_type VARCHAR(255) NOT NULL, -- Bet, Match
  event_type VARCHAR(255) NOT NULL,    -- BetCreated, BetMatched, MatchSettled
  payload JSONB NOT NULL,
  
  -- Causality
  causality_chain UUID,  -- For saga tracking
  
  -- Publishing
  published_to_kafka BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT event_published_check CHECK (
    (published_to_kafka = FALSE AND published_at IS NULL) OR
    (published_to_kafka = TRUE AND published_at IS NOT NULL)
  )
);

-- For event sourcing replay
CREATE INDEX idx_events_aggregate 
  ON events(aggregate_type, aggregate_id);
CREATE INDEX idx_events_published 
  ON events(published_to_kafka, created_at)
  WHERE published_to_kafka = FALSE;
CREATE INDEX idx_events_causality 
  ON events(causality_chain);
```

---

## 🔄 Write-Read Separation (CQRS)

### Command Side (Write): Ledger Updates

```
API Request
    ↓
Validate (API layer)
    ↓
withTransaction (Postgres Primary)
    ├─ INSERT wallet_ledger ← Append only
    ├─ INSERT events (outbox)
    ├─ INSERT bets
    └─ COMMIT
    ↓
Return 202 Accepted (immediately)
```

**Code Example:**

```typescript
async function placeBet(
  userId: number,
  betData: PlaceBetRequest
) {
  const betId = generateUuid();
  
  const result = await db.transaction(async (em) => {
    // Command 1: Debit ledger
    await em.insert(WalletLedger, {
      user_id: userId,
      type: 'DEBIT',
      amount: -betData.amount,
      reference_id: betId,
      idempotent_key: `BET:${betId}`,
      created_by: 'API',
      created_at: new Date()
    });
    
    // Command 2: Create bet
    await em.insert(Bet, {
      id: betId,
      user_id: userId,
      amount: betData.amount,
      status: 'PENDING'
    });
    
    // Command 3: Emit event (for kafka dispatcher)
    await em.insert(Event, {
      event_id: generateUuid(),
      aggregate_id: betId,
      aggregate_type: 'Bet',
      event_type: 'BetCreated',
      payload: { betId, userId, amount: betData.amount },
      published_to_kafka: false
    });
  });
  
  return { betId, status: 'PENDING' };
}
```

---

### Query Side (Read): Projection Queries

```
Client Request (show balance)
    ↓
Check if can tolerate stale data (usually yes)
    ↓
Query Read-DB (projection)
    ├─ SELECT balance FROM wallet_balance_projection
    ├─ WHERE user_id = X
    └─ (returned in < 10ms, even for 1M users)
    ↓
Return balance + timestamp (client knows if stale)
```

**Code Example:**

```typescript
async function getBalance(userId: number) {
  // Read from cache/read-db (FAST)
  const projection = await readDb.findOne(WalletBalanceProjection, {
    where: { user_id: userId }
  });
  
  if (!projection) {
    // Fallback: compute from ledger (SLOW, but accurate)
    const ledger = await writeDb.find(WalletLedger, {
      where: { user_id: userId },
      order: { created_at: 'DESC' }
    });
    
    const balance = ledger.reduce((sum, e) => sum + e.amount, 0);
    return { balance, source: 'ledger', stale: false };
  }
  
  return {
    balance: projection.balance,
    source: 'projection',
    stale: Date.now() - projection.updated_at > 500,  // 500ms threshold
    updated_at: projection.updated_at
  };
}
```

---

## 📨 Kafka as Event Bus

### Why Kafka for 1M users?

**Redis (BullMQ):**
```
- Single-node: 50k jobs/sec limit
- Cluster: 100k jobs/sec
- Data loss if Redis crashes (even with AOF)
- Fine for 2k-10k users
```

**Kafka:**
```
- 1M+ jobs/sec possible
- Persistent on disk (AOF built-in)
- Partitioning for horizontal scale
- Consumer groups for parallel processing
- Perfect for 100k-1M users
```

---

### Kafka Topology

```
┌────────────────────────────────────────────┐
│  Kafka Cluster (3 brokers min)             │
├────────────────────────────────────────────┤
│  Topics:                                   │
│  ├─ bet.created (partitions=100)           │
│  │  ├─ Partition 0: bets 0-9999           │
│  │  ├─ Partition 1: bets 10000-19999      │
│  │  └─ ... (100 total)                    │
│  │                                        │
│  ├─ match.settled (partitions=50)         │
│  ├─ user.balance.updated (partitions=100) │
│  └─ events.dlq (dead letter queue)        │
└────────────────────────────────────────────┘
        │
        ├─ Producer: Event Dispatcher
        │  └─ Publish 1000s events/sec
        │
        ├─ Consumer Group: Matcher Service
        │  ├─ Consumer 1 → Partition 0-10
        │  ├─ Consumer 2 → Partition 11-20
        │  └─ ... (horizontal scale)
        │
        └─ Consumer Group: Settler Service
           └─ Similar partitioning
```

**Partition Key Strategy:**
```
Topic: bet.created
├─ Partition key: user_id
│  └─ Same user's bets go to same partition
│  └─ Ensures ordering per-user
│
├─ 100 partitions
│  └─ 1M users / 100 = 10k users per partition
│  └─ Each consumer handles 1 partition
│  └─ 10 consumers → all 100 partitions covered
```

---

### Event Dispatcher (Kafka Producer)

```typescript
class EventDispatcher {
  private kafka: KafkaProducer;
  
  async dispatchEvents() {
    setInterval(async () => {
      try {
        // Batch poll unpublished events
        const events = await eventRepo.find({
          where: { published_to_kafka: false },
          order: { created_at: 'ASC' },
          take: 1000  // Process 1000 at a time
        });
        
        // Batch publish to Kafka
        const messages = events.map(event => ({
          topic: `${event.aggregate_type.toLowerCase()}.${event.event_type}`,
          partition: undefined,  // Kafka will use partition key
          key: event.aggregate_id,  // Partition key
          value: JSON.stringify(event.payload),
          headers: {
            'event-id': event.event_id,
            'timestamp': event.created_at.toISOString()
          }
        }));
        
        await this.kafka.sendBatch({
          topicMessages: messages
        });
        
        // Mark as published (batch update)
        const eventIds = events.map(e => e.id);
        await eventRepo.update(
          { id: In(eventIds) },
          { published_to_kafka: true, published_at: new Date() }
        );
        
        console.log(`✅ Published ${events.length} events to Kafka`);
        
      } catch (error) {
        console.error('❌ Event dispatch error:', error);
        // Retry automatically on next interval
      }
    }, 100);  // Poll every 100ms
  }
}
```

---

## 🗄️ Database Sharding Strategy

### Problem: Single-Node Bottleneck

```
1M users × 1000 ledger entries per user = 1 BILLION rows

Single PostgreSQL:
├─ Table size: ~100GB
├─ Index size: ~50GB
├─ Scan time: seconds
└─ ❌ Bottleneck: slow queries, lock contention
```

### Solution: Sharding by user_id

```
Partition users into N shards:
├─ Shard 0: users 0-9999
├─ Shard 1: users 10000-19999
├─ Shard 2: users 20000-29999
└─ ... (100 shards for 1M users)

Shard DB instances:
├─ Shard 0 → Postgres Instance 1
├─ Shard 1 → Postgres Instance 2
└─ ... (100 instances for 1M users)

Benefits:
├─ 1B rows → 10M rows per shard (manageable)
├─ Index fits in RAM per shard
├─ Parallelizable (query shard 5 while writing shard 3)
└─ Linear scale: 10 shards = 10x capacity
```

---

### Sharding Key Function

```typescript
function getShardKey(userId: number, totalShards: number): number {
  return userId % totalShards;
}

// Example: 1M users, 100 shards
function getShardConnection(userId: number) {
  const shardKey = getShardKey(userId, 100);  // 0-99
  return shardConnections[shardKey];
}

// Usage:
async function placeBet(userId: number, betData: BetData) {
  const shard = getShardConnection(userId);
  
  await shard.transaction(async (em) => {
    // All writes for this user go to same shard
    await em.insert(WalletLedger, {
      user_id: userId,
      ...betData
    });
  });
}
```

---

### Shard Configuration

```typescript
// config/shards.ts
const TOTAL_SHARDS = 100;

const shardConnections = Array(TOTAL_SHARDS).fill(null).map((_, i) => {
  return new DataSource({
    type: 'postgres',
    host: `shard-${i}.internal`,  // DNS load balanced
    port: 5432,
    username: 'postgres',
    password: process.env.DB_PASSWORD,
    database: `betting_shard_${i}`,
    poolSize: 20,
    synchronize: false  // Use migrations instead
  });
});

// High-availability within each shard
// Shard 0:
//   ├─ Primary (writes)
//   ├─ Replica 1 (read-only)
//   └─ Replica 2 (backup)
```

---

### Sharded Query Example

```typescript
// Query all users' balance (for reporting)
async function getTotalBalance() {
  const results = await Promise.all(
    shardConnections.map((shard, shardId) =>
      shard.query(`
        SELECT user_id, SUM(amount) as balance
        FROM wallet_ledger
        WHERE user_id >= $1 AND user_id < $2
        GROUP BY user_id
      `, [
        shardId * (1000000 / TOTAL_SHARDS),
        (shardId + 1) * (1000000 / TOTAL_SHARDS)
      ])
    )
  );
  
  // Merge results from all shards
  return results.flat();
}
```

---

## 📈 Horizontal Scaling

### API Layer Scaling

```
Kubernetes Cluster:

Service: betting-api
├─ Replicas: 50 pods (auto-scale)
├─ Each pod: 4 CPU, 2GB RAM
├─ Total: 200 CPU, 100GB RAM
│
├─ Horizontal Pod Autoscaler (HPA)
│  ├─ Target CPU: 70%
│  ├─ Target memory: 80%
│  ├─ Min pods: 10
│  └─ Max pods: 100
│
└─ Load Balancer
   └─ Distributes to 50 replicas
```

---

### Worker Scaling (Kafka Consumers)

```
Consumer Group: matcher-service
├─ Current instances: 20
├─ Kafka topic: bet.created (100 partitions)
├─ Partition assignment:
│  ├─ Consumer 1 → Partitions 0-4
│  ├─ Consumer 2 → Partitions 5-9
│  └─ ... (each consumer owns 5 partitions)
│
├─ Scaling policy:
│  ├─ If consumer lag > 1M: add 5 consumers
│  ├─ If consumer lag < 100k: remove 1 consumer
│  └─ Max 50 consumers (100 partitions / 2)
│
└─ Auto-scale trigger:
   └─ Kubernetes Job Controller monitors Kafka metrics
```

**Consumer Lag Monitoring:**
```
Consumer lag = Latest offset - Committed offset
├─ Lag = 0: Up to date ✓
├─ Lag < 10k: OK (caught up within 10s)
├─ Lag > 1M: Behind (add workers)
└─ Alert: If lag > 10M (SLA breach)
```

---

## 🔍 Disaster Recovery & Monitoring

### Monitoring Stack

```
┌──────────────────────────────────────┐
│  Prometheus (metrics collector)      │
│  - Scrape interval: 15s              │
│  - Storage: 30 days retention        │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  Grafana (visualization)             │
│  - Dashboards (pre-built)            │
│  - Alerts (PagerDuty integration)   │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  ELK Stack (logging)                 │
│  - Elasticsearch: structured logs    │
│  - Kibana: log search/analysis       │
│  - Beats: log shippers               │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Jaeger (distributed tracing)        │
│  - Trace bet from API → DB          │
│  - Find latency bottlenecks         │
└──────────────────────────────────────┘
```

---

### Key Metrics to Track

```
1. API Metrics:
   ├─ http_request_duration_seconds (histogram)
   ├─ http_requests_total (counter)
   ├─ http_request_errors_total (counter)
   └─ Alerting: p99 latency > 500ms

2. Worker Metrics:
   ├─ worker_jobs_processed_total (counter)
   ├─ worker_job_duration_seconds (histogram)
   ├─ worker_job_errors_total (counter)
   └─ Alerting: error rate > 1%

3. Database Metrics:
   ├─ db_connection_active (gauge)
   ├─ db_locks_active (gauge)
   ├─ db_query_duration_seconds (histogram)
   └─ Alerting: connections > 80%, locks > 10

4. Kafka Metrics:
   ├─ kafka_consumer_lag (gauge)
   ├─ kafka_messages_consumed_total (counter)
   ├─ kafka_produce_errors_total (counter)
   └─ Alerting: consumer lag > 1M

5. Finance Metrics (Most Important!):
   ├─ ledger_entries_total (counter)
   ├─ duplicate_ledger_entries (counter) ← Must be 0!
   ├─ reconciliation_mismatch (gauge)
   └─ Alerting: reconciliation_mismatch > 0
```

---

### Reconciliation (Auditing)

**Daily Reconciliation Job:**

```typescript
async function dailyReconciliation() {
  console.log('🔄 Starting reconciliation...');
  
  // For each shard
  for (let shardId = 0; shardId < TOTAL_SHARDS; shardId++) {
    const shard = shardConnections[shardId];
    
    // Sum all ledger entries
    const ledgerSum = await shard.query(`
      SELECT SUM(amount) as total_balance
      FROM wallet_ledger
      WHERE created_at >= now() - INTERVAL '1 day'
    `);
    
    // Sum all wallets (projection)
    const projectionSum = await shard.query(`
      SELECT SUM(balance) as total_balance
      FROM wallet_balance_projection
    `);
    
    // Should match!
    if (ledgerSum[0].total_balance !== projectionSum[0].total_balance) {
      console.error(`❌ Mismatch in shard ${shardId}!`);
      
      // ALERT: PagerDuty
      await pagerduty.trigger({
        severity: 'critical',
        title: `Reconciliation mismatch in shard ${shardId}`,
        details: `Ledger: ${ledgerSum[0].total_balance}, Projection: ${projectionSum[0].total_balance}`
      });
      
      // Pause outgoing transactions
      await pausePayouts();
    } else {
      console.log(`✅ Shard ${shardId} reconciled`);
    }
  }
  
  console.log('✅ Reconciliation complete');
}

// Run daily at 2 AM
cron.schedule('0 2 * * *', dailyReconciliation);
```

---

### Disaster Recovery Plan

**RTO (Recovery Time Objective):** < 1 hour
**RPO (Recovery Point Objective):** < 5 minutes

**Backup Strategy:**
```
1. Continuous replication to standby DB
   └─ 10-second lag acceptable

2. Daily backup to S3
   ├─ Full backup at 2 AM UTC
   ├─ Incremental every 4 hours
   └─ 30-day retention

3. Event log backup (Kafka)
   └─ Replicate to S3 every hour
   └─ Can replay from any point-in-time

4. Cross-region replication
   └─ Primary: US-East
   └─ Standby: EU-West
   └─ Async replication (eventual consistency acceptable for backup)
```

**Failure Scenarios:**

| Scenario | RTO | Action |
|----------|-----|--------|
| **API crash** | < 1min | K8s restarts pod |
| **Worker crash** | < 5min | Kafka rebalances, new consumer |
| **Single DB crash** | < 10min | Fail over to replica |
| **Entire region down** | < 30min | Activate standby region, replay from Kafka |
| **Data corruption** | < 1hour | Restore from snapshot, reconcile |

---

## 📊 Capacity Planning

**For 1 Million Concurrent Users:**

```
API Servers:
├─ Request rate: 100k RPS (1M users × 0.1 RPS avg)
├─ API pods: 50 pods × 2k RPS = 100k RPS ✓
├─ CPU per pod: 4 cores
├─ Total: 200 CPU cores

Workers (Kafka Consumers):
├─ Event rate: 100k/sec (match, settle, etc.)
├─ Throughput per consumer: 1000/sec
├─ Consumers needed: 100
├─ CPU per consumer: 2 cores
├─ Total: 200 CPU cores

Database:
├─ Shards: 100 (for 1M users)
├─ Each shard:
│  ├─ Ledger rows: 1B entries total / 100 = 10M per shard
│  ├─ Storage: ~1GB per shard
│  ├─ Memory: 8GB (index cache)
│  └─ CPU: 4 cores
├─ Total: 400GB storage, 100 CPU cores

Kafka:
├─ Brokers: 5 (for fault tolerance)
├─ Topics: 5 × 100 partitions = 500 partitions
├─ Throughput: 100k msgs/sec
├─ Storage: 7 days retention = 60TB

Redis (Cache):
├─ Size: 5GB (user balance cache)
├─ Nodes: 3 (for HA)
└─ Throughput: 100k ops/sec (cache hits)

Total Infrastructure Cost: $50k-100k/month AWS
```

---

## ✅ Deployment Checklist

**Pre-Production:**
- [ ] Schema with all partitions created
- [ ] Indexes verified on all shards
- [ ] Kafka cluster tested (100 partitions)
- [ ] Consumer lag monitoring set up
- [ ] Reconciliation job tested
- [ ] Failover tested (kill 1 shard, verify recovery)
- [ ] Load test: 100k concurrent users
- [ ] Chaos test: kill 20% of pods, verify recovery

**Production:**
- [ ] Gradual rollout (10% → 25% → 50% → 100%)
- [ ] Monitor p99 latency (must stay < 500ms)
- [ ] Monitor duplicate ledger entries (must be 0)
- [ ] Monitor consumer lag (must stay < 100k)
- [ ] Daily reconciliation running
- [ ] On-call engineer standby 24/7

---

## 🎯 SLA Targets

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| **Availability** | 99.99% | < 99.98% |
| **API Latency p99** | < 500ms | > 500ms |
| **Worker Throughput** | > 100k/sec | < 80k/sec |
| **Consumer Lag** | < 10k | > 100k |
| **Duplicate Entries** | 0 | > 0 |
| **Reconciliation Match** | 100% | < 99.99% |

---

## 📚 Reference Architecture Comparison

| Metric | Level 1 | Level 2 | Level 3 |
|--------|---------|---------|---------|
| **Users** | 500-2k | 2k-10k | 10k-1M |
| **Queue** | BullMQ | BullMQ | Kafka |
| **DB** | Single Postgres | Single Postgres | 100 shards |
| **Pattern** | Queue+Worker | Event-Driven+Saga | Ledger-First |
| **Consistency** | Strong | Strong | Eventual |
| **RPS** | < 1k | < 10k | > 100k |
| **Cost** | $5k/month | $15k/month | $100k/month |

---

*Last updated: 2024 | Level 3: Ledger-First Production Scale for 1 Million Users*
