/*
# Mi Gestión Comercial SPAR — core schema

1. New Tables
- `clients` — commercial clients of the sales rep
  - `id` (uuid, primary key)
  - `user_id` (uuid, owner, defaults to the authenticated user)
  - `code` (text, client code, may be null)
  - `name` (text, not null — client or shop name)
  - `tax_id` (text — CIF / NIF)
  - `contact_name`, `phone`, `email`, `address`, `city`, `postal_code`, `notes` (text)
  - `created_at` (timestamptz)
- `products` — product catalog
  - `id` (uuid, primary key), `user_id` (owner, defaults to auth.uid())
  - `code` (text, not null — product code), `barcode_ean`, `spar_ref`, `spar_code` (text)
  - `description` (text, not null), `category`, `unit` (text)
  - `price` (numeric 12,2, not null, default 0), `discount_pct` (numeric 5,2, default 0)
  - `active` (boolean, default true), `photo_url` (text — storage path)
  - `created_at` (timestamptz)
- `orders` — orders placed to clients
  - `id` (uuid pk), `user_id` (owner, defaults to auth.uid())
  - `order_number` (integer, not null — sequential per user)
  - `client_id` (uuid, references clients, on delete set null)
  - `order_date` (date, not null, default today)
  - `status` (text, check in pendiente/enviado/entregado/cancelado, default pendiente)
  - `subtotal`, `discount_total`, `total` (numeric 12,2, not null, default 0)
  - `notes` (text)
  - `created_at` (timestamptz)
- `order_items` — order lines
  - `id` (uuid pk), `order_id` (uuid, references orders, on delete cascade)
  - `product_id` (uuid, references products, on delete set null)
  - `product_code`, `description`, `unit` (text, snapshot of the product)
  - `quantity` (numeric 12,3, not null), `unit_price` (numeric 12,2, not null)
  - `discount_pct` (numeric 5,2, default 0), `line_total` (numeric 12,2, not null)
  - `position` (integer, keeps line order)

2. Security
- RLS enabled on all four tables; every policy scoped `TO authenticated`
  with `auth.uid() = user_id` (orders/order_items scope through the owner).
- Grants limited to `authenticated` for the verbs the app uses.

3. Notes
- `order_number` defaults to a per-user sequence computed at insert time
  (max + 1) in the application layer; no cross-user sequence is used.
- Products referenced by order lines are kept (on delete set null) so past
  orders always keep their snapshot columns.
*/

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  code text,
  name text NOT NULL,
  tax_id text,
  contact_name text,
  phone text,
  email text,
  address text,
  city text,
  postal_code text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  barcode_ean text,
  spar_ref text,
  spar_code text,
  description text NOT NULL,
  category text,
  unit text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number integer NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  order_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente','enviado','entregado','cancelado')),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_total numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_code text,
  description text,
  unit text,
  quantity numeric(12,3) NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL,
  position integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_clients_user_name ON clients (user_id, name);
CREATE INDEX IF NOT EXISTS idx_products_user_code ON products (user_id, code);
CREATE INDEX IF NOT EXISTS idx_orders_user_date ON orders (user_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_client ON orders (client_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id, position);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_items TO authenticated;

DROP POLICY IF EXISTS "select_own_clients" ON clients;
CREATE POLICY "select_own_clients" ON clients FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_clients" ON clients;
CREATE POLICY "insert_own_clients" ON clients FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_clients" ON clients;
CREATE POLICY "update_own_clients" ON clients FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_clients" ON clients;
CREATE POLICY "delete_own_clients" ON clients FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_products" ON products;
CREATE POLICY "select_own_products" ON products FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_products" ON products;
CREATE POLICY "insert_own_products" ON products FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_products" ON products;
CREATE POLICY "update_own_products" ON products FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_products" ON products;
CREATE POLICY "delete_own_products" ON products FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_orders" ON orders;
CREATE POLICY "select_own_orders" ON orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_orders" ON orders;
CREATE POLICY "insert_own_orders" ON orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_orders" ON orders;
CREATE POLICY "update_own_orders" ON orders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_orders" ON orders;
CREATE POLICY "delete_own_orders" ON orders FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_order_items" ON order_items;
CREATE POLICY "select_own_order_items" ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "insert_own_order_items" ON order_items;
CREATE POLICY "insert_own_order_items" ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "update_own_order_items" ON order_items;
CREATE POLICY "update_own_order_items" ON order_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "delete_own_order_items" ON order_items;
CREATE POLICY "delete_own_order_items" ON order_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
    )
  );
