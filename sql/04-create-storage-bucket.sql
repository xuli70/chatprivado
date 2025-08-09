-- =====================================================
-- CREAR BUCKET DE STORAGE PARA PDFs
-- =====================================================
-- Archivo: sql/04-create-storage-bucket.sql
-- Propósito: Crear el bucket 'chat-pdfs' en Supabase Storage
-- =====================================================

-- NOTA: Este script debe ejecutarse desde el Dashboard de Supabase
-- en la sección de Storage, NO en el SQL Editor

-- =====================================================
-- OPCIÓN 1: CREAR BUCKET DESDE EL DASHBOARD (RECOMENDADO)
-- =====================================================
-- 1. Ve a tu proyecto en Supabase: your-supabase-url
-- 2. En el menú lateral, haz clic en "Storage"
-- 3. Haz clic en "Create Bucket"
-- 4. Configura:
--    - Bucket name: chat-pdfs
--    - Public bucket: ✅ (marcado)
--    - File size limit: 10MB
--    - Allowed MIME types: application/pdf
-- 5. Haz clic en "Create bucket"

-- =====================================================
-- OPCIÓN 2: CREAR BUCKET VÍA SQL (SI TIENES PERMISOS)
-- =====================================================
-- Si tienes permisos de administrador, puedes ejecutar esto en SQL Editor:

-- Verificar si el bucket ya existe
DO $$
BEGIN
    -- Intentar crear el bucket solo si no existe
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'chat-pdfs') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'chat-pdfs', 
            'chat-pdfs', 
            true, 
            10485760, -- 10MB en bytes
            ARRAY['application/pdf']::text[]
        );
        RAISE NOTICE 'Bucket chat-pdfs creado exitosamente';
    ELSE
        RAISE NOTICE 'Bucket chat-pdfs ya existe';
    END IF;
END $$;

-- =====================================================
-- POLÍTICAS DE SEGURIDAD PARA EL BUCKET (SIN RLS)
-- =====================================================
-- Como solicitaste sin RLS, estas políticas permiten acceso público total

-- Primero, eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "Allow public read access on chat-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload on chat-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update on chat-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete on chat-pdfs" ON storage.objects;

-- Crear políticas nuevas
-- Permitir lectura pública
CREATE POLICY "Allow public read access on chat-pdfs" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'chat-pdfs');

-- Permitir subida pública
CREATE POLICY "Allow public upload on chat-pdfs" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'chat-pdfs');

-- Permitir actualización pública
CREATE POLICY "Allow public update on chat-pdfs" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'chat-pdfs');

-- Permitir eliminación pública
CREATE POLICY "Allow public delete on chat-pdfs" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'chat-pdfs');

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Para verificar que el bucket fue creado correctamente:

-- 1. Verificar en la tabla de buckets
SELECT * FROM storage.buckets WHERE id = 'chat-pdfs';

-- 2. Verificar las políticas
SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%chat-pdfs%';

-- =====================================================
-- TROUBLESHOOTING
-- =====================================================
-- Si recibes error "permission denied for schema storage":
-- 1. Usa el Dashboard de Supabase en lugar de SQL
-- 2. Contacta al administrador para que cree el bucket

-- Si recibes error "Bucket not found" en la aplicación:
-- 1. Verifica que el bucket se llame exactamente 'chat-pdfs'
-- 2. Verifica que sea público
-- 3. Reinicia la aplicación después de crear el bucket