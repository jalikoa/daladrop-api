-- Backfill: gas products must carry cylinder_type_id for GAS_DELIVERY pricing
-- (MultiCheckoutService.resolveGasCylinderTypeId requires it — see
-- src/modules/orders/use-cases/multi-checkout.service.ts).
--
-- 006_verticals_events.sql now seeds cylinder_type_id directly on INSERT, but
-- this UPDATE is idempotent and safe to re-run against databases seeded
-- before that fix (or any GAS store product missing the column).
-- Depends on cylinder_types from 002_daladrop_pricing_and_policies.sql.

-- QuickGas Kisumu: K-Gas 13kg Refill
UPDATE products
SET cylinder_type_id = 'c0000000-0000-4000-8000-000000000013', -- 13kg
    updated_at = NOW()
WHERE id = '21000000-0000-4000-8000-000000000003'::uuid
  AND cylinder_type_id IS NULL;

-- QuickGas Kisumu: K-Gas 6kg Refill
UPDATE products
SET cylinder_type_id = 'c0000000-0000-4000-8000-000000000006', -- 6kg
    updated_at = NOW()
WHERE id = '21000000-0000-4000-8000-000000000004'::uuid
  AND cylinder_type_id IS NULL;

-- Safety net: any other active GAS store product with a name/description
-- hinting at a specific cylinder weight but no cylinder_type_id set yet.
UPDATE products p
SET cylinder_type_id = ct.id,
    updated_at = NOW()
FROM stores s, cylinder_types ct
WHERE p.store_id = s.id
  AND s.store_type = 'GAS'::"StoreType"
  AND p.cylinder_type_id IS NULL
  AND p.deleted_at IS NULL
  AND (
    (ct.code = 'CYL_13KG' AND (p.name ILIKE '%13kg%' OR p.description ILIKE '%13kg%'))
    OR
    (ct.code = 'CYL_6KG' AND (p.name ILIKE '%6kg%' OR p.description ILIKE '%6kg%'))
  );
