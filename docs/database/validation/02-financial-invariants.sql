-- Financial invariant checks (read-only)

-- Unbalanced posted journals
SELECT je.id, je.entry_number,
       SUM(jl.debit_amount) AS debits,
       SUM(jl.credit_amount) AS credits
FROM journal_entries je
JOIN journal_lines jl ON jl.journal_entry_id = je.id
WHERE je.status = 'POSTED'
GROUP BY je.id, je.entry_number
HAVING SUM(jl.debit_amount) <> SUM(jl.credit_amount);

-- Posted journals with fewer than 2 lines
SELECT je.id, je.entry_number, COUNT(jl.id) AS line_count
FROM journal_entries je
LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
WHERE je.status = 'POSTED'
GROUP BY je.id, je.entry_number
HAVING COUNT(jl.id) < 2;

-- Payment allocations that do not sum to payment amount
SELECT p.id, p.amount AS payment_amount, COALESCE(SUM(a.amount), 0) AS allocated
FROM payments p
LEFT JOIN payment_allocations a ON a.payment_id = p.id
WHERE p.status = 'SUCCESS'
GROUP BY p.id, p.amount
HAVING COALESCE(SUM(a.amount), 0) <> p.amount
   AND EXISTS (SELECT 1 FROM payment_allocations x WHERE x.payment_id = p.id);

-- Escrow held without successful payment
SELECT e.id
FROM escrow_holds e
JOIN payments p ON p.id = e.payment_id
WHERE e.status = 'HELD' AND p.status <> 'SUCCESS';

-- Negative wallet balances (should be prevented by CHECK)
SELECT id, balance_amount, hold_amount
FROM wallets
WHERE balance_amount < 0 OR hold_amount < 0;

-- Delivery pricing rules must split exactly
SELECT id, name, customer_charge, rider_pay, platform_commission
FROM delivery_pricing_rules
WHERE customer_charge <> rider_pay + platform_commission;

-- Core payments must not store gateway checkout ids (those live on provider tx)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'payments'
  AND column_name IN ('checkout_request_id', 'mpesa_ref', 'merchant_request_id', 'mpesa_phone');
