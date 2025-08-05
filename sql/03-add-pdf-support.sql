-- =====================================================
-- SOPORTE PARA SUBIDA DE PDFs - Chat Anónimo
-- =====================================================
-- Archivo: sql/03-add-pdf-support.sql
-- Propósito: Agregar funcionalidad completa de PDFs
-- Ejecutar en: Panel SQL de Supabase (https://supmcp.axcsol.com)
-- =====================================================

-- 1. CREAR TABLA PARA ADJUNTOS PDF
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id BIGINT REFERENCES chat_messages(id) ON DELETE CASCADE,
    room_id VARCHAR(10) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    uploaded_by VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CREAR ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_chat_attachments_message_id ON chat_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_room_id ON chat_attachments(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_created_at ON chat_attachments(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_is_active ON chat_attachments(is_active);

-- 3. CREAR TRIGGER PARA UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_attachments_updated_at 
    BEFORE UPDATE ON chat_attachments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 4. FUNCIÓN PARA OBTENER ESTADÍSTICAS DE ARCHIVOS
-- =====================================================
CREATE OR REPLACE FUNCTION get_room_attachments_stats(room_id_param VARCHAR(10))
RETURNS TABLE (
    total_files INTEGER,
    total_size_mb NUMERIC,
    most_recent_upload TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_files,
        ROUND(SUM(file_size::NUMERIC) / 1048576, 2) as total_size_mb,
        MAX(created_at) as most_recent_upload
    FROM chat_attachments 
    WHERE chat_attachments.room_id = room_id_param 
      AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- 5. FUNCIÓN PARA LIMPIAR ARCHIVOS HUÉRFANOS
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_orphaned_attachments()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Marcar como inactivos los adjuntos de mensajes eliminados
    UPDATE chat_attachments 
    SET is_active = false 
    WHERE message_id NOT IN (SELECT id FROM chat_messages)
      AND is_active = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INSTRUCCIONES PARA STORAGE BUCKET
-- =====================================================
-- NOTA: Los buckets deben crearse a través de la interfaz de Supabase
-- o usando la función siguiente si tienes permisos de administrador:

/*
-- CREAR BUCKET PARA PDFs (EJECUTAR SOLO SI TIENES PERMISOS ADMIN)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-pdfs', 'chat-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- POLÍTICA PARA PERMITIR LECTURA PÚBLICA
CREATE POLICY "Allow public read access" ON storage.objects
FOR SELECT USING (bucket_id = 'chat-pdfs');

-- POLÍTICA PARA PERMITIR SUBIDA PÚBLICA  
CREATE POLICY "Allow public upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'chat-pdfs');

-- POLÍTICA PARA PERMITIR ELIMINACIÓN PÚBLICA
CREATE POLICY "Allow public delete" ON storage.objects
FOR DELETE USING (bucket_id = 'chat-pdfs');
*/

-- =====================================================
-- VERIFICACIÓN DE LA INSTALACIÓN
-- =====================================================
-- Ejecutar estas consultas para verificar que todo se instaló correctamente:

/*
-- Verificar tabla creada
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chat_attachments' 
ORDER BY ordinal_position;

-- Verificar índices
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename = 'chat_attachments';

-- Verificar funciones
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name IN ('get_room_attachments_stats', 'cleanup_orphaned_attachments');

-- Verificar bucket (si se creó)
SELECT * FROM storage.buckets WHERE id = 'chat-pdfs';
*/

-- =====================================================
-- DATOS DE PRUEBA (OPCIONAL)
-- =====================================================
-- Descomentar para insertar datos de prueba:

/*
INSERT INTO chat_attachments (
    message_id, 
    room_id, 
    filename, 
    original_filename,
    file_path, 
    file_size, 
    uploaded_by
) VALUES (
    1, 
    'TEST123', 
    'documento-test.pdf', 
    'Mi Documento.pdf',
    'chat-pdfs/documento-test.pdf', 
    1024000, 
    'Usuario Test'
);
*/

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
-- ✅ Script completado exitosamente
-- 🔄 Próximo paso: Ejecutar en Supabase SQL Editor
-- 📝 Verificar: Tablas, índices, funciones creadas
-- 🗂️ Crear bucket: 'chat-pdfs' desde panel de Storage
-- =====================================================