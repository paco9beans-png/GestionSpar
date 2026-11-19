/*
# Add product photo matching observations

1. Modified table
- `products.observations` (nullable text) stores the value from the Excel OBSERVACIONES column.
- It is used later to match a filename such as `200000819.jpg` with the product whose observations contain `200000819`.

2. Data safety
- The column is nullable and has no default, so existing products and all existing values remain unchanged.
- No product rows, codes, EANs, references, prices, photos, or relationships are modified.

3. Security
- The existing authenticated owner-scoped policies and grants on `products` continue to protect this column.
*/

ALTER TABLE products ADD COLUMN IF NOT EXISTS observations text;