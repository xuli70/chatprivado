-- ================================================================
-- DIAGNÓSTICO RLS Y POLÍTICAS - DEBUG SCRIPT
-- ================================================================
-- Este script ayuda a diagnosticar problemas con Row Level Security
-- y las políticas de la base de datos

-- 1. VERIFICAR POLÍTICAS EXISTENTES
-- ================================================================

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('chat_rooms', 'chat_messages', 'chat_votes', 'chat_attachments')
ORDER BY tablename, policyname;

-- 2. VERIFICAR ESTADO RLS
-- ================================================================

SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('chat_rooms', 'chat_messages', 'chat_votes', 'chat_attachments');

-- Información adicional sobre RLS
SELECT 
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' 
AND c.relname IN ('chat_rooms', 'chat_messages', 'chat_votes', 'chat_attachments');

-- 3. VERIFICAR FOREIGN KEYS
-- ================================================================

SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name IN ('chat_rooms', 'chat_messages', 'chat_votes', 'chat_attachments');

-- 4. VERIFICAR ESTRUCTURA TABLA CHAT_MESSAGES
-- ================================================================

SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'chat_messages' 
ORDER BY ordinal_position;

-- 5. VERIFICAR SI HAY SALAS DE PRUEBA
-- ================================================================

SELECT 
    id, 
    creator, 
    created_at, 
    is_active,
    CASE 
        WHEN expires_at > NOW() THEN 'Activa'
        ELSE 'Expirada'
    END as status
FROM chat_rooms 
WHERE id LIKE 'TEST%' OR id = 'TESTROOM'
ORDER BY created_at DESC;

-- 6. VERIFICAR MENSAJES DE PRUEBA
-- ================================================================

SELECT 
    cm.id,
    cm.room_id,
    cm.text,
    cm.author,
    cm.created_at,
    cm.is_deleted,
    cm.deleted_by,
    cm.deleted_at
FROM chat_messages cm
WHERE cm.room_id LIKE 'TEST%' OR cm.room_id = 'TESTROOM'
ORDER BY cm.created_at DESC
LIMIT 10;

-- 7. TEST BÁSICO DE INSERCIÓN (PARA DEBUG)
-- ================================================================

-- Comentado por defecto - descomenta para probar
-- INSERT INTO chat_rooms (
--     id, 
--     creator, 
--     question, 
--     created_at, 
--     expires_at, 
--     message_limit, 
--     is_active
-- ) VALUES (
--     'DEBUGROOM', 
--     'Debug User', 
--     'Test question for debug', 
--     NOW(), 
--     NOW() + INTERVAL '2 hours', 
--     200, 
--     true
-- ) ON CONFLICT (id) DO NOTHING;

-- 8. CREAR POLÍTICAS BÁSICAS SI NO EXISTEN
-- ================================================================

-- Verificar y crear políticas básicas para testing
DO $$
BEGIN
    -- Política para SELECT en chat_rooms
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'chat_rooms' AND policyname = 'Enable read access for all users'
    ) THEN
        CREATE POLICY "Enable read access for all users" ON "public"."chat_rooms"
        AS PERMISSIVE FOR SELECT
        TO public
        USING (true);
        RAISE NOTICE 'Política SELECT para chat_rooms creada';
    END IF;

    -- Política para INSERT en chat_rooms
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'chat_rooms' AND policyname = 'Enable insert for all users'
    ) THEN
        CREATE POLICY "Enable insert for all users" ON "public"."chat_rooms"
        AS PERMISSIVE FOR INSERT
        TO public
        WITH CHECK (true);
        RAISE NOTICE 'Política INSERT para chat_rooms creada';
    END IF;

    -- Política para SELECT en chat_messages
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'chat_messages' AND policyname = 'Enable read access for all users'
    ) THEN
        CREATE POLICY "Enable read access for all users" ON "public"."chat_messages"
        AS PERMISSIVE FOR SELECT
        TO public
        USING (true);
        RAISE NOTICE 'Política SELECT para chat_messages creada';
    END IF;

    -- Política para INSERT en chat_messages
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'chat_messages' AND policyname = 'Enable insert for all users'
    ) THEN
        CREATE POLICY "Enable insert for all users" ON "public"."chat_messages"
        AS PERMISSIVE FOR INSERT
        TO public
        WITH CHECK (true);
        RAISE NOTICE 'Política INSERT para chat_messages creada';
    END IF;

    -- Política para UPDATE en chat_messages (para borrado)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'chat_messages' AND policyname = 'Allow admin to delete messages'
    ) THEN
        CREATE POLICY "Allow admin to delete messages" ON "public"."chat_messages"
        AS PERMISSIVE FOR UPDATE
        TO public
        USING (true);
        RAISE NOTICE 'Política UPDATE para chat_messages creada';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creando políticas: %', SQLERRM;
END $$;

-- 9. INFORMACIÓN FINAL
-- ================================================================

SELECT 'Debug script ejecutado exitosamente' as status,
       NOW() as timestamp;