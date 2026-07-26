# carts

**Bounded context:** mutable pre-checkout baskets (server-side; UI may still use AsyncStorage).

## Owns
`carts`, `cart_items`

## Depends on
`identity`, `catalog` (product / menu item ids + price snapshots on lines)

## Publishes (later)
CartUpdated, CartCleared

## Must not
Create payments or orders — checkout orchestrates `orders` + `payments`.
