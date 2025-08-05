-- =====================================================
-- CONFIGURACIÓN SIMPLE DEL BUCKET PARA PDFs
-- =====================================================
-- IMPORTANTE: Primero crea el bucket desde el Dashboard de Supabase
-- Luego ejecuta estas políticas en el SQL Editor

-- =====================================================
-- PASO 1: CREAR EL BUCKET (desde Dashboard)
-- =====================================================
-- 1. Ve a Storage en Supabase
-- 2. Click en "New bucket"
-- 3. Nombre: chat-pdfs
-- 4. Public: ✅ (marcado)
-- 5. Click en "Create"

-- =====================================================
-- PASO 2: EJECUTAR ESTAS POLÍTICAS (en SQL Editor)
-- =====================================================

-- Verificar que el bucket existe
SELECT * FROM storage.buckets WHERE id = 'chat-pdfs';

-- Si el bucket existe, crear las políticas de acceso público
-- (ejecuta cada política por separado si hay errores)

-- 1. Política para lectura pública
CREATE POLICY "chat_pdfs_public_read" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'chat-pdfs');

-- 2. Política para subida pública
CREATE POLICY "chat_pdfs_public_upload" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'chat-pdfs');

-- 3. Política para actualización pública
CREATE POLICY "chat_pdfs_public_update" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'chat-pdfs');

-- 4. Política para eliminación pública
CREATE POLICY "chat_pdfs_public_delete" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'chat-pdfs');

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================
-- Ejecuta esto para ver las políticas creadas:
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE 'chat_pdfs%';

-- Deberías ver 4 políticas listadas

-- =====================================================
-- SI HAY ERRORES
-- =====================================================
-- Si alguna política ya existe, primero elimínala:
/*
DROP POLICY "chat_pdfs_public_read" ON storage.objects;
DROP POLICY "chat_pdfs_public_upload" ON storage.objects;
DROP POLICY "chat_pdfs_public_update" ON storage.objects;
DROP POLICY "chat_pdfs_public_delete" ON storage.objects;
*/

-- Luego vuelve a ejecutar las políticas CREATE POLICY de arriba