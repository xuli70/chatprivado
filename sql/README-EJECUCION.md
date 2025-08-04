# 📋 Instrucciones para Ejecutar Scripts SQL

## 🎯 Objetivo
Implementar sistema de persistencia permanente mediante columna `is_active` en Supabase.

## 📁 Archivos en este directorio

### `01-add-is-active-column.sql`
- **Propósito**: Agregar columna `is_active` a tabla `chat_rooms`
- **Qué hace**: 
  - Agrega columna `is_active BOOLEAN DEFAULT true`
  - Actualiza salas existentes a `is_active = true`
  - Crea índices para optimizar performance

### `02-verify-changes.sql`
- **Propósito**: Verificar que los cambios se aplicaron correctamente
- **Qué hace**: 
  - Verifica que la columna existe
  - Confirma que los índices se crearon
  - Muestra estadísticas de salas activas/inactivas

## 🚀 Pasos para Ejecutar

### Paso 1: Acceder a Supabase
1. Ve a tu proyecto Supabase: https://supmcp.axcsol.com
2. Navega a **SQL Editor** en el menú lateral
3. Crea una nueva query

### Paso 2: Ejecutar Script Principal
1. Copia el contenido completo de `01-add-is-active-column.sql`
2. Pégalo en el SQL Editor
3. Haz clic en **Run** (o presiona Ctrl+Enter)
4. **Resultado esperado**: 
   ```
   ALTER TABLE
   UPDATE X (donde X = número de salas actualizadas)
   CREATE INDEX
   CREATE INDEX
   ```

### Paso 3: Verificar Cambios
1. Copia el contenido de `02-verify-changes.sql`
2. Pégalo en una nueva query del SQL Editor
3. Ejecuta el script
4. **Resultados esperados**:
   - Columna `is_active` existe con tipo `boolean`
   - Índices `idx_chat_rooms_is_active` e `idx_chat_rooms_active_created` creados
   - Todas las salas existentes marcadas como "Activas"
   - 0 salas sin estado definido

## ✅ Criterios de Éxito

Después de ejecutar ambos scripts, deberías ver:

1. **Columna creada**: `is_active` aparece en la estructura de la tabla
2. **Índices activos**: 2 nuevos índices creados para performance
3. **Datos migrados**: Todas las salas existentes tienen `is_active = true`
4. **Sin errores**: Todos los comandos se ejecutaron exitosamente

## 🚨 En caso de error

### Error: "column 'is_active' already exists"
- **Causa**: La columna ya fue agregada anteriormente
- **Solución**: Ejecutar solo las partes del script que no fallaron

### Error: "index already exists"
- **Causa**: Los índices ya fueron creados
- **Solución**: El sistema ya está actualizado, continuar con verificación

### Error de permisos
- **Causa**: Usuario sin permisos para ALTER TABLE
- **Solución**: Verificar que tienes permisos de administrador en Supabase

## 📞 Después de Ejecutar

Una vez completados ambos scripts exitosamente:

1. **Notificar**: Confirma que los scripts se ejecutaron sin errores
2. **Resultado**: El sistema estará listo para la nueva lógica de persistencia
3. **Siguiente paso**: Actualizar el código frontend para usar `is_active`

## 🔧 Impacto en la Aplicación

### Antes (sistema actual):
- Salas expiran automáticamente después de 2 horas
- Se eliminan permanentemente por tiempo

### Después (nuevo sistema):
- Salas permanecen activas indefinidamente
- Solo el admin puede marcarlas como inactivas
- Usuarios regulares solo ven salas activas
- Admin ve todas las salas (activas + inactivas)

---

💡 **Nota**: Estos cambios son **reversibles**. Si necesitas volver al sistema anterior, las columnas pueden eliminarse sin perder datos existentes.