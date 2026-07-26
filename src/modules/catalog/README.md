# catalog

**Bounded context:** sellable inventory and restaurant menus.

## Owns
`categories`, `products`, `menu_categories`, `menu_items`, `modifier_groups`, `modifier_options`, `cylinder_types`

## Depends on
`merchants` (store id)

## Publishes (later)
ProductPublished, ProductStockChanged, MenuUpdated

## Must not
Own carts, orders, delivery fee calculation, or favourites.

## Notes
Gas cylinders are `cylinder_types` + product linkage.  
Food uses menu_* + modifiers; other verticals use `products`.  
Ticket types may optionally link a `productId` from `events`.
