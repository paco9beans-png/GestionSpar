/*
# Create client commercial roadmaps

1. New Tables
- `client_roadmaps` stores each imported commercial roadmap for one client, including the optional subclient, source filename, and import date.
- `client_roadmap_items` stores the article snapshot from the document: description, EAN, reference, price, tariff, units sold, last purchase date, and the manual quantity to serve.

2. Data rules
- Roadmaps are independent from purchase history and orders.
- Units sold are informational only and are never copied into order quantities.
- `quantity_to_order` defaults to zero and `selected` defaults to false so every new order quantity is manually confirmed.
- Existing clients, products, orders, order items, and history are not changed or deleted.

3. Security
- Both tables use authenticated owner-scoped access through `user_id`.
- Child rows are authorized through their owning roadmap.
- CRUD grants are limited to authenticated users.

4. Indexes
- Client/date, roadmap/client, and article identifiers are indexed for mobile lookup and import updates.
*/

CREATE TABLE IF NOT EXISTS client_roadmaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  subclient_code text,
  subclient_name text,
  source_name text,
  document_date date,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_roadmap_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id uuid NOT NULL REFERENCES client_roadmaps(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  ean text,
  reference text,
  description text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  tariff text,
  units_sold numeric(12,3) NOT NULL DEFAULT 0,
  last_purchase_date date,
  quantity_to_order numeric(12,3) NOT NULL DEFAULT 0,
  selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_roadmaps_user_client ON client_roadmaps (user_id, client_id, imported_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_roadmap_items_roadmap ON client_roadmap_items (roadmap_id, description);
CREATE INDEX IF NOT EXISTS idx_client_roadmap_items_ean ON client_roadmap_items (ean);
CREATE INDEX IF NOT EXISTS idx_client_roadmap_items_reference ON client_roadmap_items (reference);

ALTER TABLE client_roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_roadmap_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON client_roadmaps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON client_roadmap_items TO authenticated;

DROP POLICY IF EXISTS "select_own_client_roadmaps" ON client_roadmaps;
CREATE POLICY "select_own_client_roadmaps" ON client_roadmaps FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_client_roadmaps" ON client_roadmaps;
CREATE POLICY "insert_own_client_roadmaps" ON client_roadmaps FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM clients WHERE clients.id = client_roadmaps.client_id AND clients.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "update_own_client_roadmaps" ON client_roadmaps;
CREATE POLICY "update_own_client_roadmaps" ON client_roadmaps FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM clients WHERE clients.id = client_roadmaps.client_id AND clients.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "delete_own_client_roadmaps" ON client_roadmaps;
CREATE POLICY "delete_own_client_roadmaps" ON client_roadmaps FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_client_roadmap_items" ON client_roadmap_items;
CREATE POLICY "select_own_client_roadmap_items" ON client_roadmap_items FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM client_roadmaps WHERE client_roadmaps.id = client_roadmap_items.roadmap_id AND client_roadmaps.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "insert_own_client_roadmap_items" ON client_roadmap_items;
CREATE POLICY "insert_own_client_roadmap_items" ON client_roadmap_items FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM client_roadmaps WHERE client_roadmaps.id = client_roadmap_items.roadmap_id AND client_roadmaps.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "update_own_client_roadmap_items" ON client_roadmap_items;
CREATE POLICY "update_own_client_roadmap_items" ON client_roadmap_items FOR UPDATE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM client_roadmaps WHERE client_roadmaps.id = client_roadmap_items.roadmap_id AND client_roadmaps.user_id = auth.uid()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM client_roadmaps WHERE client_roadmaps.id = client_roadmap_items.roadmap_id AND client_roadmaps.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "delete_own_client_roadmap_items" ON client_roadmap_items;
CREATE POLICY "delete_own_client_roadmap_items" ON client_roadmap_items FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM client_roadmaps WHERE client_roadmaps.id = client_roadmap_items.roadmap_id AND client_roadmaps.user_id = auth.uid()
  ));