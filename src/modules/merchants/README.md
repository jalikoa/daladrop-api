# merchants

**Bounded context:** seller organizations and selling locations.

## Owns
`merchants`, `stores`, `store_opening_hours`, `merchant_contracts`

## Depends on
`identity` (owner user)

## Publishes (later)
MerchantOnboarded, StoreOpened, StoreClosed, ContractActivated

## Must not
Own product catalog lines, order fulfilment, or commission posting (contracts define terms; `accounting`/`wallets` settle).

## Notes
`storeType`: RESTAURANT | MARKET | LIQUOR | GAS | GENERAL | EVENT.  
Markets / liquor / gas are store types — not separate modules.  
Event hosts are merchants with `isOrganizer`.
