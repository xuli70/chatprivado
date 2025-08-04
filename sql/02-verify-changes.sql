-- ====================================================================
-- SCRIPT: Verificar cambios en base de datos
-- DESCRIPCIÓN: Validar que la columna is_active se agregó correctamente
--              y que los índices están funcionando
-- FECHA: 2025-08-04
-- ====================================================================

-- 1. Verificar que la columna is_active se agregó correctamente
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'chat_rooms' 
    AND column_name = 'is_active';

-- 2. Verificar que los índices se crearon correctamente
SELECT 
    indexname,
    indexdef,
    tablename
FROM pg_indexes 
WHERE tablename = 'chat_rooms' 
    AND indexname IN ('idx_chat_rooms_is_active', 'idx_chat_rooms_active_created')
ORDER BY indexname;

-- 3. Verificar estructura completa de la tabla chat_rooms
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'chat_rooms'
ORDER BY ordinal_position;

-- 4. Contar salas por estado (activas vs inactivas)
SELECT 
    CASE 
        WHEN is_active = true THEN 'Activas'
        WHEN is_active = false THEN 'Inactivas'
        ELSE 'Sin estado'
    END as estado,
    COUNT(*) as total_salas
FROM chat_rooms 
GROUP BY is_active
ORDER BY is_active DESC;

-- 5. Mostrar sample de salas con el nuevo campo
SELECT 
    id,
    creator,
    created_at,
    expires_at,
    is_active,
    CASE 
        WHEN is_active THEN '✅ Activa'
        ELSE '❌ Inactiva'
    END as estado_visual
FROM chat_rooms 
ORDER BY created_at DESC 
LIMIT 10;

-- 6. Verificar que todas las salas existentes tienen is_active = true
SELECT COUNT(*) as salas_sin_estado
FROM chat_rooms 
WHERE is_active IS NULL;

-- ====================================================================
-- RESULTADO ESPERADO:
-- - Query 1: Columna is_active existe con tipo BOOLEAN y DEFAULT true
-- - Query 2: Ambos índices existen y están definidos correctamente
-- - Query 3: Tabla tiene todas las columnas incluyendo is_active
-- - Query 4: Todas las salas están marcadas como 'Activas'
-- - Query 5: Sample de salas muestra ✅ Activa para todas
-- - Query 6: 0 salas sin estado (todas tienen is_active definido)
-- ====================================================================