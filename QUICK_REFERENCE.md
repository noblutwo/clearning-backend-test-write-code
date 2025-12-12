# 📌 QUICK REFERENCE - Cheat Sheet Betting API

> File này giúp bạn nhanh chóng tìm kiếm thông tin mà không cần đọc toàn bộ full.md

---

## 🔥 QUICK QUESTIONS & ANSWERS

### Q1: Tại sao phải tạo QueryRunner mới cho refund?
**A:** Vì QueryRunner bị gắn chặt với 1 TX. Sau `commit()`, context không còn đảm bảo atomicity. Reuse = risk data corruption.

### Q2: Auto-match có đụng tiền không?
**A:** KHÔNG. Tiền đã trừ từ TX A. Auto-match chỉ update status (não money).

### Q3: Nếu 2 worker match cùng 1 bet sao?
**A:** Dùng `FOR UPDATE SKIP LOCKED` + pessimistic lock → một worker lock, cái kia skip.

### Q4: Refund bị gọi 10 lần thì sao?
**A:** Idempotent key. Unique constraint đảm bảo chỉ 1 lần thực thi.

### Q5: Audit như thế nào?
**A:** `SELECT ref_id, COUNT(*) FROM ledger GROUP BY ref_id HAVING > 1` → phát hiện double payout.

---

## 📊 CHEAT SHEET - State Machine

```
┌─────────────────────────────────────┐
│ PENDING (TX A)                      │
│ - Money deducted: balance -100      │
│ - Waiting for opponent              │
└──────────┬──────────────────────────┘
           │ Worker finds opponent
           ▼
┌─────────────────────────────────────┐
│ MATCHED (Worker)                    │
│ - Opponent found                    │
│ - Waiting for settlement            │
└──────────┬──────────────────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
SETTLED (TX C)  REFUNDED (TX B)
- Winner +200   - No opponent
- Loser -100    - Balance +100
```

---

## 🛠️ TRANSACTION QUICK GUIDE

### ✅ Transaction A (Bet Placement)

```ts
const qr = dataSource.createQueryRunner();
try {
  await qr.startTransaction();
  
  // 1. Lock wallet
  const wallet = await qr.manager.findOne(Wallet, 
    { where: { id: walletId }, lock: { mode: 'pessimistic_write' } }
  );
  
  // 2. Check balance
  if (wallet.balance < 100) throw new Error('Insufficient');
  
  // 3. Debit ledger (idempotent key!)
  await qr.manager.save(WalletLedger, {
    user_id: userId,
    amount: -100,
    idempotent_key: `BET:${betId}`
  });
  
  // 4. Update balance
  await qr.manager.update(Wallet, { id: walletId }, 
    { balance: () => 'balance - 100' }
  );
  
  // 5. Create bet
  await qr.manager.save(Bet, { 
    id: betId, 
    status: 'PENDING',
    amount: 100
  });
  
  await qr.commitTransaction();
  return { betId, status: 'PENDING' };
} finally {
  await qr.release();
}
```

### ✅ Worker: Auto-Match (NO MONEY)

```ts
const qr = dataSource.createQueryRunner();
try {
  await qr.startTransaction();
  
  // 1. Lock my bet
  const bet = await qr.manager.findOne(Bet, {
    where: { id: betId },
    lock: { mode: 'pessimistic_write' }
  });
  
  if (bet.status !== 'PENDING') return; // Idempotent guard
  
  // 2. Find opponent (SKIP LOCKED!)
  const opponent = await qr.manager.query(`
    SELECT * FROM bets
    WHERE round_id = $1 AND side != $2 AND status = 'PENDING'
    FOR UPDATE SKIP LOCKED LIMIT 1
  `, [bet.round_id, bet.side]);
  
  if (!opponent.length) return; // No opponent
  
  // 3. Update both bets (NO MONEY!)
  await qr.manager.update(Bet, 
    { id: betId }, 
    { status: 'MATCHED' }
  );
  
  await qr.manager.update(Bet, 
    { id: opponent[0].id }, 
    { status: 'MATCHED' }
  );
  
  // 4. Create match
  await qr.manager.save(Match, {
    bet_a_id: betId,
    bet_b_id: opponent[0].id
  });
  
  await qr.commitTransaction();
} finally {
  await qr.release();
}
```

### ✅ Worker: Refund (TX B - NEW!)

```ts
const qr = dataSource.createQueryRunner();
try {
  await qr.startTransaction();
  
  // 1. Check if already refunded (idempotent)
  const ledger = await qr.manager.findOne(WalletLedger, {
    where: { idempotent_key: `REFUND:${betId}` }
  });
  if (ledger) return; // Already done
  
  // 2. Lock wallet
  const wallet = await qr.manager.findOne(Wallet, {
    where: { user_id: userId },
    lock: { mode: 'pessimistic_write' }
  });
  
  // 3. Insert refund ledger (UNIQUE KEY!)
  await qr.manager.save(WalletLedger, {
    user_id: userId,
    amount: +100,
    type: 'REFUND',
    idempotent_key: `REFUND:${betId}`
  });
  
  // 4. Update balance
  await qr.manager.update(Wallet, { id: wallet.id },
    { balance: () => 'balance + 100' }
  );
  
  // 5. Update bet status
  await qr.manager.update(Bet, { id: betId },
    { status: 'REFUNDED' }
  );
  
  await qr.commitTransaction();
} finally {
  await qr.release();
}
```

---

## ❌ RED FLAGS - Nếu Thấy, Có Bug

- [ ] Có `await qr.commitTransaction()` rồi lại dùng `qr.manager`
- [ ] Auto-match gộp vào transaction tiền
- [ ] Ledger không có unique index trên idempotent_key
- [ ] Refund không check status trước
- [ ] Rollback transaction đã commit
- [ ] `SELECT ... FOR UPDATE` mà không trong transaction
- [ ] Worker retry không idempotent
- [ ] Balance = wallet.amount thay vì SUM(ledger)

---

## 🔍 AUDIT QUERIES

### Find Double Payout
```sql
SELECT reference_id, type, COUNT(*) as c
FROM wallet_ledgers
WHERE type = 'PAYOUT'
GROUP BY reference_id, type
HAVING COUNT(*) > 1;
```

### Find Balance Mismatch
```sql
SELECT w.user_id, w.balance as wallet_balance,
       COALESCE(l.sum, 0) as ledger_sum
FROM wallets w
LEFT JOIN (
  SELECT user_id, SUM(amount) as sum
  FROM wallet_ledgers
  GROUP BY user_id
) l ON w.user_id = l.user_id
WHERE w.balance::text <> l.sum::text;
```

### Count Ledger by Type
```sql
SELECT type, COUNT(*) as count
FROM wallet_ledgers
GROUP BY type;
```

---

## 📊 PERFORMANCE TARGETS

| Metric | Target | Action if Exceeded |
|--------|--------|-------------------|
| **API p99 latency** | < 200ms | Optimize queries, add cache |
| **Queue depth** | < 1000 | Add workers |
| **DB connections used** | < 80% | Scale pool or reduce concurrency |
| **Worker error rate** | < 1% | Investigate failures |
| **Duplicate payouts** | = 0 | CRITICAL: pause payouts |
| **Balance mismatch** | = 0 | CRITICAL: reconcile |

---

## 🚀 DEPLOYMENT CHECKLIST

Before going to production:

- [ ] Schema created with all indexes
- [ ] `idempotent_key` has UNIQUE constraint
- [ ] Auto-match uses `SKIP LOCKED`
- [ ] Refund uses separate QueryRunner + idempotent check
- [ ] BullMQ configured with retry + backoff
- [ ] Reconciliation job scheduled (daily)
- [ ] Monitoring alerts set up
- [ ] Load test: 1000 concurrent bets
- [ ] Chaos test: kill workers, DB slow
- [ ] Runbook written + ops trained

---

## 💡 QUICK TIPS

1. **Test concurrency locally:** Use k6 or Bun to simulate 100+ users
2. **Monitor queue:** Keep queue depth < 1000
3. **Watch p99 latency:** If > 500ms, reduce worker concurrency
4. **Audit daily:** Run reconciliation query at 2 AM
5. **Alert on:** duplicate payouts, balance mismatch, queue backlog

---

## 📚 FILE QUICK LINKS

| File | Purpose |
|------|---------|
| **full.md** | Complete guide, theory + practice |
| **ARCHITECTURE_L1_BASIC.md** | 500-2k users, basic queue pattern |
| **ARCHITECTURE_L2_ADVANCED.md** | 2k-10k users, event-driven |
| **ARCHITECTURE_L3_PRODUCTION_SCALE.md** | 10k-1M users, ledger-first |
| **REVIEW_FULL_MD.md** | Evaluation & improvement suggestions |
| **QUICK_REFERENCE.md** | This file - cheat sheet |

---

*Last updated: 2024 | Use this file for quick lookups*
