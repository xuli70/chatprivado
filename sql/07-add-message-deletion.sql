-- ================================================================
-- SISTEMA DE BORRADO DE MENSAJES POR ADMINISTRADOR
-- ================================================================
-- Este script añade las columnas necesarias para implementar 
-- soft delete de mensajes por parte del administrador

-- 1. AÑADIR COLUMNAS PARA SOFT DELETE
-- ================================================================

ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS deleted_by TEXT;

ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 2. CREAR ÍNDICES PARA OPTIMIZAR CONSULTAS
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_chat_messages_is_deleted 
ON chat_messages(is_deleted);

CREATE INDEX IF NOT EXISTS idx_chat_messages_deleted_at 
ON chat_messages(deleted_at) WHERE deleted_at IS NOT NULL;

-- 3. FUNCIÓN PARA BORRADO POR ADMINISTRADOR
-- ================================================================

CREATE OR REPLACE FUNCTION admin_delete_message(
    message_id_param BIGINT,
    admin_identifier_param TEXT
) RETURNS JSON AS $$
DECLARE
    result_row chat_messages%ROWTYPE;
    result JSON;
BEGIN
    -- Actualizar el mensaje marcándolo como borrado
    UPDATE chat_messages 
    SET 
        is_deleted = TRUE,
        deleted_by = admin_identifier_param,
        deleted_at = NOW()
    WHERE id = message_id_param
    RETURNING * INTO result_row;
    
    -- Verificar si se encontró el mensaje
    IF result_row.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Mensaje no encontrado'
        );
    END IF;
    
    -- Retornar resultado exitoso
    RETURN json_build_object(
        'success', true,
        'message', json_build_object(
            'id', result_row.id,
            'is_deleted', result_row.is_deleted,
            'deleted_by', result_row.deleted_by,
            'deleted_at', result_row.deleted_at
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. FUNCIÓN PARA RESTAURAR MENSAJE (OPCIONAL)
-- ================================================================

CREATE OR REPLACE FUNCTION admin_restore_message(
    message_id_param BIGINT
) RETURNS JSON AS $$
DECLARE
    result_row chat_messages%ROWTYPE;
BEGIN
    -- Restaurar el mensaje
    UPDATE chat_messages 
    SET 
        is_deleted = FALSE,
        deleted_by = NULL,
        deleted_at = NULL
    WHERE id = message_id_param
    RETURNING * INTO result_row;
    
    -- Verificar si se encontró el mensaje
    IF result_row.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Mensaje no encontrado'
        );
    END IF;
    
    -- Retornar resultado exitoso
    RETURN json_build_object(
        'success', true,
        'message', json_build_object(
            'id', result_row.id,
            'is_deleted', result_row.is_deleted
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. ACTUALIZAR POLÍTICAS RLS PARA BORRADO
-- ================================================================

-- Verificar si la política ya existe antes de crearla
DO $$
BEGIN
    -- Eliminar política existente si existe
    DROP POLICY IF EXISTS "Allow admin to delete messages" ON chat_messages;
    
    -- Crear nueva política para permitir UPDATE (borrado/restauración)
    CREATE POLICY "Allow admin to delete messages" 
    ON chat_messages FOR UPDATE 
    USING (true);
    
    RAISE NOTICE 'Política para borrado de mensajes creada exitosamente';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creando política: %', SQLERRM;
END $$;

-- Los mensajes borrados siguen siendo visibles para mostrar el placeholder
-- No necesitamos cambiar las políticas SELECT existentes

-- 6. COMENTARIOS SOBRE USAGE
-- ================================================================

-- Para usar estas funciones desde JavaScript:
-- 
-- Borrar mensaje:
-- const result = await supabase.rpc('admin_delete_message', {
--     message_id_param: messageId,
--     admin_identifier_param: 'Admin'
-- });
--
-- Restaurar mensaje:
-- const result = await supabase.rpc('admin_restore_message', {
--     message_id_param: messageId
-- });

-- ================================================================
-- VERIFICACIÓN DE INSTALACIÓN
-- ================================================================

-- Verificar que las columnas se crearon correctamente
DO $$
BEGIN
    -- Verificar columna is_deleted
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'is_deleted'
    ) THEN
        RAISE EXCEPTION 'Error: Columna is_deleted no se creó correctamente';
    END IF;
    
    -- Verificar columna deleted_by
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'deleted_by'
    ) THEN
        RAISE EXCEPTION 'Error: Columna deleted_by no se creó correctamente';
    END IF;
    
    -- Verificar columna deleted_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'deleted_at'
    ) THEN
        RAISE EXCEPTION 'Error: Columna deleted_at no se creó correctamente';
    END IF;
    
    RAISE NOTICE 'Instalación exitosa: Sistema de borrado de mensajes configurado correctamente';
END $$;