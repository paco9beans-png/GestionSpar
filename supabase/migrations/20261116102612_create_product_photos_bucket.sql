/*
# Product photo storage bucket

1. Storage
- Creates the `product-photos` bucket (private) if it does not exist.
- Policy: an authenticated user may upload/read/update/delete files whose
  path starts with their own user id (`auth.uid()`/…).
- Clients upload to `product-photos/<user_id>/<filename>` and read through
  signed URLs; order lines never depend on storage (they snapshot text).

2. Notes
- The signed-URL read policy keeps photos private to the owner.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'product-photos') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('product-photos', 'product-photos', false);
  END IF;
END $$;

DROP POLICY IF EXISTS "product_photos_owner_read" ON storage.objects;
CREATE POLICY "product_photos_owner_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "product_photos_owner_insert" ON storage.objects;
CREATE POLICY "product_photos_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "product_photos_owner_update" ON storage.objects;
CREATE POLICY "product_photos_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'product-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "product_photos_owner_delete" ON storage.objects;
CREATE POLICY "product_photos_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
