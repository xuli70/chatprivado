# Configuración de Supabase para Chat Anónimo Móvil

## 📋 Pasos para configurar Supabase

### 1. Crear las tablas en Supabase

Accede al **SQL Editor** de tu proyecto Supabase (https://supmcp.axcsol.com) y ejecuta el siguiente código:

```sql
-- Tabla para las salas de chat
CREATE TABLE chat_rooms (
    id VARCHAR(10) PRIMARY KEY,
    creator VARCHAR(100) NOT NULL,
    question TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    message_limit INTEGER DEFAULT 50
);

-- Tabla para los mensajes
CREATE TABLE chat_messages (
    id BIGSERIAL PRIMARY KEY,
    room_id VARCHAR(10) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_anonymous BOOLEAN NOT NULL,
    author VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    likes INTEGER DEFAULT 0,
    dislikes INTEGER DEFAULT 0
);

-- Tabla para los votos (prevenir duplicados)
CREATE TABLE chat_votes (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_fingerprint VARCHAR(50) NOT NULL,
    vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('like', 'dislike')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_fingerprint)
);

-- Índices para mejorar performance
CREATE INDEX idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX idx_chat_votes_message_id ON chat_votes(message_id);
CREATE INDEX idx_chat_rooms_expires_at ON chat_rooms(expires_at);

-- Funciones para manejar contadores de votos
CREATE OR REPLACE FUNCTION increment_vote(message_id BIGINT, vote_type TEXT)
RETURNS INTEGER AS $$
BEGIN
    IF vote_type = 'like' THEN
        UPDATE chat_messages SET likes = likes + 1 WHERE id = message_id;
        RETURN (SELECT likes FROM chat_messages WHERE id = message_id);
    ELSE
        UPDATE chat_messages SET dislikes = dislikes + 1 WHERE id = message_id;
        RETURN (SELECT dislikes FROM chat_messages WHERE id = message_id);
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_vote(message_id BIGINT, vote_type TEXT)
RETURNS INTEGER AS $$
BEGIN
    IF vote_type = 'like' THEN
        UPDATE chat_messages SET likes = GREATEST(likes - 1, 0) WHERE id = message_id;
        RETURN (SELECT likes FROM chat_messages WHERE id = message_id);
    ELSE
        UPDATE chat_messages SET dislikes = GREATEST(dislikes - 1, 0) WHERE id = message_id;
        RETURN (SELECT dislikes FROM chat_messages WHERE id = message_id);
    END IF;
END;
$$ LANGUAGE plpgsql;
```

### 2. Obtener las claves de acceso

1. Ve a **Settings** → **API** en tu proyecto Supabase
2. Copia los siguientes valores:
   - **URL**: `https://supmcp.axcsol.com`
   - **anon key**: La clave pública (anon/public key)

### 3. Configuración para Desarrollo Local

Edita el archivo `.env` en la raíz del proyecto:

```env
# Configuración de Supabase para Chat Anónimo Móvil
SUPABASE_URL=https://supmcp.axcsol.com
SUPABASE_ANON_KEY=tu_clave_anon_key_real_aqui
NODE_ENV=development
```

**⚠️ IMPORTANTE**: Reemplaza `tu_clave_anon_key_real_aqui` con tu clave real de Supabase.

### 4. Configuración para Producción (Coolify/VPS)

En tu VPS/Coolify, configura las siguientes **variables de entorno**:

```
SUPABASE_URL=https://supmcp.axcsol.com
SUPABASE_ANON_KEY=tu_clave_anon_key_real_aqui
```

### 5. Políticas de Seguridad (Opcional)

Por ahora, las tablas están **sin RLS (Row Level Security)** para simplificar la implementación. Si quieres agregar seguridad más adelante:

```sql
-- Habilitar RLS
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_votes ENABLE ROW LEVEL SECURITY;

-- Permitir acceso público a todas las operaciones (temporalmente)
CREATE POLICY "Allow public access" ON chat_rooms FOR ALL TO anon USING (true);
CREATE POLICY "Allow public access" ON chat_messages FOR ALL TO anon USING (true);
CREATE POLICY "Allow public access" ON chat_votes FOR ALL TO anon USING (true);
```

## 🚀 Cómo probar

### Desarrollo Local
1. Abre `index.html` en tu navegador
2. Verifica en la consola que no hay errores de Supabase
3. Crea una sala en un navegador
4. Únete desde otro navegador con el código
5. ¡Los mensajes deberían sincronizarse!

### Producción
1. Configura las variables de entorno en Coolify
2. Despliega la aplicación
3. Los datos se compartirán entre todos los dispositivos

## 🔄 Fallback a localStorage

Si Supabase no está disponible o configurado, la aplicación automáticamente usará **localStorage** como antes. Esto asegura que la app funcione siempre, incluso sin backend.

## 🗑️ Limpieza Automática

Las salas expiradas se eliminan automáticamente después de 2 horas tanto en Supabase como en localStorage.

## 📝 Notas Técnicas

- **Fingerprinting**: Cada usuario tiene un ID único generado en el cliente para gestionar votos
- **Votaciones**: Previene votos duplicados usando la tabla `chat_votes`
- **Compatibilidad**: Mantiene 100% de compatibilidad con la funcionalidad original
- **Performance**: Índices optimizados para consultas frecuentes