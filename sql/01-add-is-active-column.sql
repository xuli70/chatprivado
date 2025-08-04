-- ====================================================================
-- SCRIPT: Agregar columna is_active para persistencia permanente
-- DESCRIPCIÓN: Implementa sistema donde las salas persisten hasta 
--              eliminación manual por administrador
-- FECHA: 2025-08-04
-- ====================================================================

-- 1. Agregar columna is_active a la tabla chat_rooms
-- Esta columna controlará si una sala está disponible para usuarios
ALTER TABLE chat_rooms ADD COLUMN is_active BOOLEAN DEFAULT true;

-- 2. Actualizar todas las salas existentes para que estén activas
-- Asegurar que salas creadas antes del cambio sigan funcionando
UPDATE chat_rooms SET is_active = true WHERE is_active IS NULL;

-- 3. Crear índice para optimizar consultas por estado activo
-- Mejora performance al filtrar salas activas vs inactivas
CREATE INDEX idx_chat_rooms_is_active ON chat_rooms(is_active);

-- 4. Crear índice compuesto para consultas admin
-- Optimiza consultas que filtran por estado y fecha
CREATE INDEX idx_chat_rooms_active_created ON chat_rooms(is_active, created_at);

-- ====================================================================
-- RESULTADO ESPERADO:
-- - Columna is_active agregada con valor DEFAULT true
-- - Todas las salas existentes marcadas como activas
-- - Índices creados para optimizar performance
-- - Sistema listo para persistencia permanente
-- ====================================================================