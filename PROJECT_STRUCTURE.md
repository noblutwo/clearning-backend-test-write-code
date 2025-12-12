# 📚 PROJECT STRUCTURE & LEARNING PATH

> Hướng dẫn toàn bộ cấu trúc project và cách sử dụng các tài liệu

---

## 🎯 Overview

Dự án này là **Betting API System** - hệ thống xử lý cược trực tuyến với xử lý concurrent cao, an toàn tài chính, và sẵn sàng production.

**Tài liệu được chia thành 3 Architecture Levels:**
- **Level 1:** 500-2k users (Basic Queue Pattern)
- **Level 2:** 2k-10k users (Event-Driven + Advanced DB)
- **Level 3:** 10k-1M users (Ledger-First Production Scale)

---

## 📂 File Structure & Cách Dùng

```
clearning-backend-test-write-code/
│
├── 📖 CORE TÀI LIỆU (Đọc theo thứ tự)
│   ├── README.md, README1.md, README2.md, README3.md
│   │   └─ Original documents từ project
│   │
│   ├── full.md ⭐ START HERE
│   │   └─ Complete guide: tư duy Senior, transaction patterns, anti-patterns
│   │   └─ Đã improve: thêm state diagram, table so sánh, anti-pattern code examples
│   │
│   ├── REVIEW_FULL_MD.md
│   │   └─ Đánh giá chi tiết full.md + gợi ý cải thiện
│   │
│   └── QUICK_REFERENCE.md ⭐ USE FOR LOOKUP
│       └─ Cheat sheet: Q&A, code snippets, audit queries, deployment checklist
│
├── 🏗️ ARCHITECTURE DOCUMENTS
│   ├── ARCHITECTURE.md
│   │   └─ Original comprehensive guide (11 sections)
│   │
│   ├── ARCHITECTURE_L1_BASIC.md
│   │   ├─ Use case: 500-2k concurrent users
│   │   ├─ Pattern: Queue + Worker
│   │   ├─ Tech: BullMQ, TypeORM, Postgres
│   │   ├─ Sections:
│   │   │  ├─ API: Place Bet (Transaction A)
│   │   │  ├─ Worker: Auto-Match
│   │   │  ├─ Worker: Settler
│   │   │  ├─ Worker: Refund/Payout
│   │   │  ├─ Schema (wallets, bets, matches, ledger)
│   │   │  ├─ Concurrency Control (SKIP LOCKED)
│   │   │  ├─ Stress Test Scenarios
│   │   │  └─ Performance Tuning
│   │   └─ Length: ~600 lines
│   │
│   ├── ARCHITECTURE_L2_ADVANCED.md
│   │   ├─ Use case: 2k-10k concurrent users
│   │   ├─ Pattern: Event-Driven + Saga + Advanced DB
│   │   ├─ Tech: Kafka, Outbox Pattern, CQRS
│   │   ├─ Sections:
│   │   │  ├─ Outbox Pattern (transactional inbox)
│   │   │  ├─ Saga Pattern + Compensation
│   │   │  ├─ Event Dispatcher
│   │   │  ├─ Database Indexing Strategy (detailed)
│   │   │  ├─ Sequence Diagrams (3 scenarios)
│   │   │  └─ Race Condition Analysis
│   │   └─ Length: ~700 lines
│   │
│   └── ARCHITECTURE_L3_PRODUCTION_SCALE.md
│       ├─ Use case: 10k-1M concurrent users
│       ├─ Pattern: Ledger-First + CQRS + Kafka + Sharding
│       ├─ Tech: Multiple Postgres shards (100), Kafka clusters
│       ├─ Sections:
│       │  ├─ Ledger-First Architecture
│       │  ├─ Write-Read Separation (CQRS)
│       │  ├─ Kafka as Event Bus
│       │  ├─ Database Sharding Strategy
│       │  ├─ Horizontal Scaling
│       │  ├─ Disaster Recovery
│       │  ├─ Monitoring & Reconciliation
│       │  └─ Capacity Planning
│       └─ Length: ~800 lines
│
└── 📋 HELPER DOCUMENTS
    ├── PROJECT_STRUCTURE.md (THIS FILE)
    └─ Navigation guide for all documents
```

---

## 🎓 Learning Path (Recommended Order)

### 👶 BEGINNER (Week 1)
Learn the fundamentals:
1. Read **full.md** (sections 1-7)
   - State machine concept
   - Transaction A (place bet)
   - Understand idempotency
   
2. Study **QUICK_REFERENCE.md**
   - Q&A section
   - Cheat sheet
   - Red flags

3. Read **ARCHITECTURE_L1_BASIC.md** (sections 1-3)
   - High-level architecture
   - Transaction flow
   - Schema overview

**Output:** You understand state machine, transactions, and basic patterns

---

### 📚 INTERMEDIATE (Week 2-3)
Deep dive into production patterns:
1. Read **full.md** (sections 8-15)
   - Refund patterns
   - Idempotency details
   - Race condition analysis
   - BullMQ worker code

2. Study **ARCHITECTURE_L1_BASIC.md** (sections 4-6)
   - Worker implementation
   - Concurrency control
   - Stress test scenarios

3. Implement code:
   - Place bet API with TX A
   - Auto-match worker with SKIP LOCKED
   - Refund worker with idempotent key
   - Unit tests

**Output:** You can code a working betting system for 500-2k users

---

### 🚀 ADVANCED (Week 4-5)
Scale to production:
1. Read **ARCHITECTURE_L2_ADVANCED.md**
   - Outbox pattern
   - Saga pattern
   - Advanced indexing
   - Sequence diagrams

2. Read **ARCHITECTURE_L3_PRODUCTION_SCALE.md**
   - Ledger-first architecture
   - CQRS pattern
   - Sharding strategy
   - Disaster recovery

3. Implement:
   - Event-driven system
   - Reconciliation job
   - Monitoring/alerts
   - Load testing (1000+ users)

**Output:** You understand production-grade architecture for 1M+ users

---

## 🎯 Quick Start (Fast Track - 1 Day)

If you just need to understand the basics:

1. **Morning (1 hour):**
   - Read **full.md** - sections 1-5
   - Read **QUICK_REFERENCE.md** - all sections

2. **Afternoon (2 hours):**
   - Read **ARCHITECTURE_L1_BASIC.md** - sections 1-4
   - Review code examples in **QUICK_REFERENCE.md**

3. **Evening (1 hour):**
   - Code exercise: implement Transaction A (place bet)
   - Review ANTI-PATTERNS to avoid mistakes

**Result:** 4 hours → understand core concepts + can code basic system

---

## 📖 Which File to Read Based on Your Scenario?

| Your Scenario | Read This | Why |
|---------------|-----------|-----|
| **Interview prep (Senior backend)** | full.md + QUICK_REFERENCE.md | Master theory + Q&A |
| **MVP (500-2k users)** | ARCHITECTURE_L1_BASIC.md | Basic queue pattern |
| **Scale to 10k users** | ARCHITECTURE_L2_ADVANCED.md | Event-driven + DB tuning |
| **Production 100k+ users** | ARCHITECTURE_L3_PRODUCTION_SCALE.md | Ledger-first + sharding |
| **Quick lookup** | QUICK_REFERENCE.md | Cheat sheet + code |
| **Audit code** | REVIEW_FULL_MD.md | Understand improvements |
| **Understand concurrency** | ARCHITECTURE_L2_ADVANCED.md | Race condition + SKIP LOCKED |
| **Setup monitoring** | ARCHITECTURE_L3_PRODUCTION_SCALE.md | Monitoring & alerts section |

---

## 🔑 Key Concepts Map

```
Transaction Safety
├─ State Machine (PENDING → MATCHED → SETTLED/REFUNDED)
├─ QueryRunner (each TX = new QueryRunner)
├─ Idempotent Key (UNIQUE constraint)
└─ Pessimistic Lock (FOR UPDATE)

Scalability
├─ Queue Pattern (BullMQ/Kafka)
├─ Worker Pool (auto-match, settle, refund)
├─ Horizontal Scale (stateless API)
└─ Database Sharding (by user_id)

Advanced Patterns
├─ Outbox Pattern (event guarantee)
├─ Saga Pattern (distributed TX)
├─ CQRS (write/read separation)
├─ Event Sourcing (immutable ledger)
└─ SKIP LOCKED (prevent thundering herd)

Operational Excellence
├─ Reconciliation (audit trail)
├─ Monitoring (metrics + alerts)
├─ Disaster Recovery (backup + failover)
└─ Anti-patterns (know what NOT to do)
```

---

## 💻 Hands-On Exercises

### Exercise 1: Implement Place Bet (TX A)
**Level:** Beginner | **Time:** 1 hour
- Read: full.md section 5
- Code: Transaction A with pessimistic lock
- Test: 10 concurrent users, no double debit

### Exercise 2: Implement Auto-Match Worker
**Level:** Intermediate | **Time:** 2 hours
- Read: ARCHITECTURE_L1_BASIC.md section 4
- Code: Worker with SKIP LOCKED + idempotent status check
- Test: Race condition with 2 workers

### Exercise 3: Implement Refund Worker
**Level:** Intermediate | **Time:** 1.5 hours
- Read: full.md section 8
- Code: Refund worker with idempotent key + UNIQUE constraint
- Test: Retry 10x, balance should only increase once

### Exercise 4: Setup Reconciliation
**Level:** Advanced | **Time:** 1.5 hours
- Read: QUICK_REFERENCE.md audit queries
- Code: Daily reconciliation job
- Test: Detect double payout scenario

### Exercise 5: Stress Test 1000 Users
**Level:** Advanced | **Time:** 2 hours
- Read: ARCHITECTURE_L1_BASIC.md section 6
- Code: Load test script (k6 or Bun)
- Measure: p99 latency, queue depth, DB connections
- Optimize: Worker concurrency + pool size

---

## 🚨 Critical Red Flags (Review Before Production)

Before deploying to production:

- [ ] **NO reuse of QueryRunner** after commit
- [ ] **Idempotent key** = UNIQUE constraint in DB
- [ ] **Auto-match NOT in money transaction** (separate queue job)
- [ ] **Refund = new QueryRunner + idempotent check**
- [ ] **SKIP LOCKED used** for finding opponent
- [ ] **Reconciliation job** runs daily
- [ ] **Monitoring alerts** for duplicate payouts
- [ ] **Load tested** with 1000+ concurrent users
- [ ] **Chaos tested** (worker crash, DB slow)
- [ ] **Runbook written** for ops team

---

## 📞 FAQ

**Q: Should I read all files?**
A: No. Pick the level matching your target scale:
- L1 (500-2k) → read ARCHITECTURE_L1_BASIC.md
- L2 (2k-10k) → read ARCHITECTURE_L2_ADVANCED.md
- L3 (10k-1M) → read ARCHITECTURE_L3_PRODUCTION_SCALE.md

**Q: What's the difference between full.md and ARCHITECTURE files?**
A: 
- **full.md** = Theory + why (complete guide)
- **ARCHITECTURE_Lx.md** = Implementation details for scale level X

**Q: How often should I re-read QUICK_REFERENCE.md?**
A: Bookmark it. Use it for quick lookups during coding.

**Q: Which section is hardest?**
A: Race condition (ARCHITECTURE_L2) and sharding (ARCHITECTURE_L3). Take time to understand SKIP LOCKED.

**Q: Can I skip ARCHITECTURE_L1 and go to L3?**
A: Not recommended. Each level builds on previous. L1 → L2 → L3 progression.

---

## ✅ Milestones Checklist

### After Reading full.md
- [ ] Understand state machine (PENDING → SETTLED/REFUNDED)
- [ ] Know why QueryRunner must be new per transaction
- [ ] Explain idempotent key to someone else
- [ ] List 3 anti-patterns and why they're bad
- [ ] Describe how to detect double payout

### After Reading ARCHITECTURE_L1_BASIC.md
- [ ] Code place bet (TX A) from memory
- [ ] Code auto-match worker with SKIP LOCKED
- [ ] Code refund worker with idempotent key
- [ ] Design schema with proper indexes
- [ ] Plan stress test for 1000 users

### After Reading ARCHITECTURE_L2_ADVANCED.md
- [ ] Explain outbox pattern to team
- [ ] Draw saga diagram with compensation
- [ ] Write SQL for finding balance mismatch
- [ ] Understand why partial indexes save space
- [ ] Identify race condition in code example

### After Reading ARCHITECTURE_L3_PRODUCTION_SCALE.md
- [ ] Explain ledger-first vs balance-first
- [ ] Design sharding strategy for 1M users
- [ ] Write horizontal scaling plan
- [ ] Setup monitoring with Prometheus + Grafana
- [ ] Create disaster recovery runbook

---

## 📞 Support & Questions

If stuck on a concept:
1. **Check QUICK_REFERENCE.md** for quick answers
2. **Review REVIEW_FULL_MD.md** for detailed analysis
3. **Re-read** the specific ARCHITECTURE_Lx.md section
4. **Code it** - hands-on is best learning

---

*Document version: 2024 | All files updated December 12, 2025*
