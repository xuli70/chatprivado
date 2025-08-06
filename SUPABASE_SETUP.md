# Configuración de Supabase para Chat Anónimo Móvil

## 📋 Pasos para configurar Supabase

### ⚠️ IMPORTANTE: Si las tablas ya existen

Si recibes el error `ERROR: 42P07: relation "chat_rooms" already exists`, ejecuta **solo** el paso **1B** (RLS y Políticas). Si es tu primera instalación, ejecuta el paso **1A**.

### 1A. PRIMERA INSTALACIÓN - Crear todas las tablas

**Solo ejecuta esto si es tu primera vez configurando Supabase:**

Accede al **SQL Editor** de tu proyecto Supabase (https://supmcp.axcsol.com) y ejecuta el siguiente código:

```sql
-- Tabla para las salas de chat
CREATE TABLE chat_rooms (
    id VARCHAR(10) PRIMARY KEY,
    creator VARCHAR(100) NOT NULL,
    question TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    message_limit INTEGER DEFAULT 200
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

### 1B. ACTUALIZACIÓN - Solo RLS y Políticas (si las tablas ya existen)

**Ejecuta esto si ya tienes las tablas creadas y solo necesitas configurar los permisos:**

```sql
-- Habilitar RLS (Row Level Security) - REQUERIDO para v3.0
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_votes ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen (por si ya las habías creado)
DROP POLICY IF EXISTS "Allow public access" ON chat_rooms;
DROP POLICY IF EXISTS "Allow public access" ON chat_messages;
DROP POLICY IF EXISTS "Allow public access" ON chat_votes;
DROP POLICY IF EXISTS "Allow all operations on chat_rooms" ON chat_rooms;
DROP POLICY IF EXISTS "Allow all operations on chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "Allow all operations on chat_votes" ON chat_votes;

-- Crear políticas actualizadas para Chat Anónimo v3.0
CREATE POLICY "chat_rooms_policy" ON chat_rooms FOR ALL USING (true);
CREATE POLICY "chat_messages_policy" ON chat_messages FOR ALL USING (true);
CREATE POLICY "chat_votes_policy" ON chat_votes FOR ALL USING (true);

-- Verificar que los índices existen (crear solo si no existen)
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_votes_message_id ON chat_votes(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_expires_at ON chat_rooms(expires_at);

-- Actualizar o crear las funciones (siempre seguro ejecutar)
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

### 5. Verificar la Configuración

**Después de ejecutar el SQL, verifica que todo esté correcto:**

```sql
-- Verificar que las tablas existen
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('chat_rooms', 'chat_messages', 'chat_votes');

-- Verificar que RLS está habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('chat_rooms', 'chat_messages', 'chat_votes');

-- Verificar que las políticas existen
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('chat_rooms', 'chat_messages', 'chat_votes');
```

**✅ Resultado esperado:**
- 3 tablas encontradas
- RLS = true para todas las tablas
- 3 políticas activas

## 🚀 Cómo probar

### Desarrollo Local
1. Abre `index.html` en tu navegador
2. **Verifica en la consola del navegador:**
   - ✅ `Conexión a Supabase establecida exitosamente`
   - ✅ `💓 Iniciando sistema de heartbeat`
   - ✅ Estado: `🟢 Tiempo Real`
3. Crea una sala en un navegador
4. Únete desde otro navegador/dispositivo con el código
5. ¡Los mensajes deberían sincronizarse instantáneamente!

### Producción (Coolify)
1. **Variables de entorno en Coolify:**
   ```
   SUPABASE_URL=https://supmcp.axcsol.com
   SUPABASE_ANON_KEY=tu_clave_real_aqui
   ```
2. **Reinicia el contenedor** después de agregar las variables
3. **Verifica en la consola del navegador** que muestre `Tiempo Real`
4. Los datos se compartirán entre todos los dispositivos automáticamente

### 🚨 Troubleshooting

**Si sigue mostrando "Modo Local":**

1. **Verifica las variables en producción:**
   ```javascript
   // En la consola del navegador de tu sitio desplegado:
   console.log('URL:', window.env?.SUPABASE_URL);
   console.log('Key exists:', !!window.env?.SUPABASE_ANON_KEY);
   ```

2. **Verifica la conexión a Supabase:**
   ```javascript
   // En la consola:
   debugPolling()
   ```

3. **Errores comunes:**
   - `Variables undefined` → Reinicia el contenedor en Coolify
   - `PGRST116 error` → Ejecuta el SQL del paso 1B
   - `Connection timeout` → Verifica que la URL de Supabase sea correcta

## 🔄 Sistema de Fallback Inteligente

La aplicación **siempre funciona**, incluso sin Supabase:

- **🟢 Modo Supabase**: Tiempo real completo, multi-dispositivo
- **🔴 Modo Local**: localStorage con polling adaptativo
- **🟡 Modo Reconexión**: Transición automática entre modos

## 🗑️ Limpieza Automática Avanzada

- **Salas**: Auto-eliminación después de 2 horas
- **Estados de mensaje**: Cleanup cada 30 segundos
- **Memory leaks**: Detección y prevención automática
- **DOM**: Optimización continua de elementos

## 🚀 Próximos Pasos Después de la Configuración

1. **✅ Configurar Supabase** (este documento)
2. **🧪 Testing multi-dispositivo** con usuarios reales
3. **📊 Monitoreo en producción** usando herramientas de debug
4. **⚡ Optimización basada en métricas** reales

## 📝 Notas Técnicas - Chat Anónimo v3.0

### 🆕 Nuevas Características de v3.0
- **🔄 Polling Adaptativo**: 500ms→1s→2s→5s según actividad
- **🔗 Reconexión Automática**: Recovery sin intervención manual
- **💓 Sistema Heartbeat**: Health checks cada 30 segundos
- **📱 UX Indicators**: Estados visuales de mensaje y escritura
- **🧪 Edge Case Testing**: Suite completa de pruebas

### 🔧 Arquitectura Técnica
- **Fingerprinting**: ID único generado en el cliente para votos
- **Anti-duplicados**: Previene ecos y mensajes repetidos
- **Fallback robusto**: localStorage cuando Supabase no disponible
- **Memory management**: Auto-limpieza y optimización continua
- **Performance**: Índices optimizados + polling inteligente

### 🎯 Comandos de Debug Disponibles
```javascript
// Estado completo del sistema
debugPolling()

// Tests individuales
testPolling()
testReconnection()

// Suite completa de edge cases
runEdgeTests()

// Reporte de performance
performanceReport()

// Optimización completa
optimizeSystem()
```