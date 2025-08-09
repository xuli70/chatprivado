-- ================================================================
-- RLS SIMPLE ROLLBACK - Chat Anónimo
-- ================================================================
-- 
-- OBJETIVO: Rollback completo del RLS, restaurando el sistema
--           al estado anterior (sin RLS habilitado)
--
-- USO: Ejecutar este script completo en Supabase SQL Editor
--      en caso de que la implementación RLS cause problemas
--
-- ⚠️  EJECUTAR SOLO SI HAY PROBLEMAS con rls-simple-enable.sql
-- ================================================================

-- ================================================================
-- INFORMACIÓN DE ROLLBACK
-- ================================================================

-- Este script realizará un rollback completo:
-- 1. Eliminar todas las políticas RLS creadas
-- 2. Deshabilitar RLS en todas las tablas
-- 3. Restaurar el estado original (acceso público total)
-- 
-- DESPUÉS DEL ROLLBACK:
-- ✅ La aplicación funcionará exactamente como antes de RLS
-- ✅ No habrá restricciones de acceso
-- ❌ No habrá protección contra acceso externo malicioso

-- ================================================================
-- PASO 1: ELIMINAR TODAS LAS POLÍTICAS RLS
-- ================================================================

-- Eliminar políticas de CHAT_ROOMS
DROP POLICY IF EXISTS "chat_rooms_allow_all_public" ON chat_rooms;

-- Eliminar políticas de CHAT_MESSAGES  
DROP POLICY IF EXISTS "chat_messages_allow_all_public" ON chat_messages;

-- Eliminar políticas de CHAT_VOTES
DROP POLICY IF EXISTS "chat_votes_allow_all_public" ON chat_votes;

-- Eliminar políticas de CHAT_ATTACHMENTS
DROP POLICY IF EXISTS "chat_attachments_allow_all_public" ON chat_attachments;

-- Eliminar políticas de USER_IDENTIFIERS
DROP POLICY IF EXISTS "user_identifiers_allow_all_public" ON user_identifiers;

-- ================================================================
-- PASO 2: DESHABILITAR RLS EN TODAS LAS TABLAS
-- ================================================================

-- Deshabilitar RLS en tabla de salas de chat
ALTER TABLE chat_rooms DISABLE ROW LEVEL SECURITY;

-- Deshabilitar RLS en tabla de mensajes
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;

-- Deshabilitar RLS en tabla de votos
ALTER TABLE chat_votes DISABLE ROW LEVEL SECURITY;

-- Deshabilitar RLS en tabla de archivos adjuntos (PDFs)
ALTER TABLE chat_attachments DISABLE ROW LEVEL SECURITY;

-- Deshabilitar RLS en tabla de identificadores de usuarios
ALTER TABLE user_identifiers DISABLE ROW LEVEL SECURITY;

-- ================================================================
-- PASO 3: VERIFICACIÓN DE ROLLBACK
-- ================================================================

-- Verificar que RLS está deshabilitado en todas las tablas
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN (
    'chat_rooms', 
    'chat_messages', 
    'chat_votes', 
    'chat_attachments', 
    'user_identifiers'
)
AND schemaname = 'public'
ORDER BY tablename;

-- Verificar que no hay políticas restantes
SELECT 
    schemaname,
    tablename,
    policyname
FROM pg_policies 
WHERE tablename IN (
    'chat_rooms', 
    'chat_messages', 
    'chat_votes', 
    'chat_attachments', 
    'user_identifiers'
)
AND schemaname = 'public'
ORDER BY tablename, policyname;

-- ================================================================
-- RESULTADO ESPERADO DEL ROLLBACK
-- ================================================================

-- Después de ejecutar este script:
-- 
-- ✅ RLS deshabilitado: rowsecurity = false en todas las tablas
-- ✅ Sin políticas: La consulta de políticas no devuelve resultados
-- ✅ Estado original restaurado: Sistema funciona como antes de RLS
-- ✅ Acceso público total: Sin restricciones de acceso

-- ================================================================
-- TESTING POST-ROLLBACK RECOMENDADO
-- ================================================================

-- Después del rollback, verificar que todo funciona:
-- 1. Crear una sala de chat
-- 2. Enviar mensajes
-- 3. Votar mensajes (like/dislike)  
-- 4. Subir archivos PDF
-- 5. Descargar archivos PDF
-- 6. Usar funcionalidades de IA
-- 7. Verificar identificadores únicos
-- 8. Probar acceso admin
--
-- Todo debe funcionar exactamente como antes de implementar RLS.

-- ================================================================
-- NOTAS IMPORTANTES
-- ================================================================

-- DESPUÉS DEL ROLLBACK:
--
-- ✅ VENTAJAS:
-- - Sistema funciona idénticamente a como funcionaba antes
-- - No hay complejidad adicional
-- - No hay restricciones de acceso
--
-- ❌ DESVENTAJAS:  
-- - No hay protección contra acceso externo malicioso
-- - Cualquier persona con la URL de Supabase puede acceder directamente
-- - Base de datos completamente abierta (solo protegida por anon key)
--
-- ALTERNATIVAS DESPUÉS DEL ROLLBACK:
-- 1. Investigar por qué falló la implementación RLS
-- 2. Considerar implementación RLS más simple
-- 3. Mantener sistema actual sin RLS (menos seguro pero funcional)
-- 4. Implementar protección a nivel de aplicación (frontend)

-- ================================================================
-- LOG DE ROLLBACK
-- ================================================================

-- Registrar cuando se ejecutó el rollback
-- (Solo para referencia, no es crítico si falla)
DO $$
BEGIN
    -- Intentar crear una tabla de logs si no existe
    CREATE TABLE IF NOT EXISTS rls_rollback_log (
        id SERIAL PRIMARY KEY,
        rollback_date TIMESTAMPTZ DEFAULT NOW(),
        reason TEXT DEFAULT 'RLS implementation rollback executed',
        executed_by TEXT DEFAULT current_user
    );
    
    -- Insertar registro de rollback
    INSERT INTO rls_rollback_log (reason) 
    VALUES ('RLS Simple implementation rolled back - sistema restaurado a estado original');
    
EXCEPTION WHEN OTHERS THEN
    -- Si no se puede crear el log, continuar sin error
    NULL;
END $$;

COMMIT;