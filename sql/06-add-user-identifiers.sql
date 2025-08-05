-- Migración: Agregar sistema de identificadores únicos para usuarios anónimos
-- Fecha: 2025-08-05
-- Propósito: Permitir identificar usuarios anónimos de forma persistente sin revelar información personal

-- 1. Agregar columna user_identifier a la tabla chat_messages
ALTER TABLE chat_messages 
ADD COLUMN user_identifier VARCHAR(10);

-- 2. Crear índice para mejorar performance en consultas por identifier
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_identifier 
ON chat_messages(user_identifier);

-- 3. Crear tabla para mapear fingerprints a identifiers (opcional, para administración)
CREATE TABLE IF NOT EXISTS user_identifiers (
    id SERIAL PRIMARY KEY,
    fingerprint_hash VARCHAR(50) UNIQUE NOT NULL,
    user_identifier VARCHAR(10) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Crear políticas RLS para la tabla user_identifiers
ALTER TABLE user_identifiers ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura pública (necesario para mostrar identifiers)
CREATE POLICY "Enable read access for all users" ON user_identifiers
    FOR SELECT USING (true);

-- Política para permitir inserción de nuevos identifiers
CREATE POLICY "Enable insert for authenticated users" ON user_identifiers
    FOR INSERT WITH CHECK (true);

-- Política para actualizar last_seen
CREATE POLICY "Enable update for authenticated users" ON user_identifiers
    FOR UPDATE USING (true);

-- 5. Función para generar identifier único automáticamente
CREATE OR REPLACE FUNCTION generate_user_identifier()
RETURNS VARCHAR(10) AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result VARCHAR(10) := '';
    i INTEGER := 0;
    random_char CHAR(1);
BEGIN
    -- Generar 6 caracteres aleatorios
    FOR i IN 1..6 LOOP
        SELECT substr(chars, ceil(random() * length(chars))::integer, 1) INTO random_char;
        result := result || random_char;
    END LOOP;
    
    -- Verificar que no exista ya este identifier
    WHILE EXISTS(SELECT 1 FROM user_identifiers WHERE user_identifier = result) LOOP
        result := '';
        FOR i IN 1..6 LOOP
            SELECT substr(chars, ceil(random() * length(chars))::integer, 1) INTO random_char;
            result := result || random_char;
        END LOOP;
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 6. Función para obtener o crear identifier para un fingerprint
CREATE OR REPLACE FUNCTION get_or_create_user_identifier(fingerprint_hash VARCHAR(50))
RETURNS VARCHAR(10) AS $$
DECLARE
    existing_identifier VARCHAR(10);
    new_identifier VARCHAR(10);
BEGIN
    -- Buscar identifier existente
    SELECT user_identifier INTO existing_identifier 
    FROM user_identifiers 
    WHERE fingerprint_hash = $1;
    
    -- Si existe, actualizar last_seen y devolverlo
    IF existing_identifier IS NOT NULL THEN
        UPDATE user_identifiers 
        SET last_seen = NOW() 
        WHERE fingerprint_hash = $1;
        RETURN existing_identifier;
    END IF;
    
    -- Si no existe, crear uno nuevo
    SELECT generate_user_identifier() INTO new_identifier;
    
    INSERT INTO user_identifiers (fingerprint_hash, user_identifier)
    VALUES ($1, new_identifier);
    
    RETURN new_identifier;
END;
$$ LANGUAGE plpgsql;

-- 7. Comentarios explicativos
COMMENT ON COLUMN chat_messages.user_identifier IS 'Identificador único anónimo del usuario (ej: A1B2C3)';
COMMENT ON TABLE user_identifiers IS 'Mapeo entre fingerprints de usuarios y sus identificadores únicos anónimos';
COMMENT ON FUNCTION get_or_create_user_identifier IS 'Obtiene identifier existente o crea uno nuevo para un fingerprint';

-- 8. Estadísticas (opcional - para verificar la migración)
DO $$
BEGIN
    RAISE NOTICE 'Migración completada:';
    RAISE NOTICE '- Columna user_identifier agregada a chat_messages';
    RAISE NOTICE '- Tabla user_identifiers creada';
    RAISE NOTICE '- Funciones de generación de identifiers creadas';
    RAISE NOTICE '- Políticas RLS configuradas';
END $$;