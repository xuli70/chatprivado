# 🔧 SOLUCIÓN: Error "Bucket not found" - Sistema PDF

## 🚨 PROBLEMA IDENTIFICADO
El sistema de PDFs está completamente implementado pero produce error **"Bucket not found"** al intentar subir archivos, aun después de crear el bucket en Supabase.

## 🔍 DIAGNÓSTICO COMPLETO

### Herramientas de Diagnóstico Creadas
1. **`debug-storage-bucket.html`** - Diagnóstico completo del sistema
2. **`test-bucket-fix.html`** - Test rápido y validación
3. **`test-pdf-system.html`** - Test completo del sistema PDF

### Causas Posibles del Error

#### 1. **Bucket No Existe (Más Común)**
- El bucket `chat-pdfs` no ha sido creado en Supabase Storage
- El nombre del bucket es incorrecto (debe ser exactamente `chat-pdfs`)

#### 2. **Bucket No Es Público**
- El bucket existe pero no está marcado como público
- Las políticas RLS bloquean el acceso público

#### 3. **Configuración de Supabase**
- Cliente Supabase no inicializado correctamente
- Variables de entorno incorrectas (URL/ANON_KEY)
- Problemas de permisos en la base de datos

#### 4. **Caché del Navegador**
- Cliente Supabase tiene información cacheada incorrecta
- Necesita refresh completo de la página

## ✅ SOLUCIONES PASO A PASO

### Solución 1: Crear Bucket Desde Dashboard (RECOMENDADO)

1. **Acceder a Supabase**
   ```
   URL: https://supmcp.axcsol.com
   ```

2. **Navegar a Storage**
   - En el menú lateral izquierdo → **"Storage"**

3. **Crear Bucket**
   - Click en **"New bucket"** o **"Create bucket"**
   - **Nombre**: `chat-pdfs` (exactamente, minúsculas con guión)
   - **Público**: ✅ **DEBE estar marcado**
   - **Límite de tamaño**: 10MB (opcional)
   - **Tipos MIME**: `application/pdf` (opcional)

4. **Confirmar Creación**
   - Click en **"Create"**
   - Verificar que aparezca en la lista como "Public"

### Solución 2: SQL Manual (Si Dashboard No Funciona)

Ejecutar en **SQL Editor** de Supabase:

```sql
-- 1. Crear el bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-pdfs', 'chat-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Verificar que se creó
SELECT * FROM storage.buckets WHERE id = 'chat-pdfs';

-- 3. Crear políticas básicas
CREATE POLICY "chat_pdfs_public_read" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'chat-pdfs');

CREATE POLICY "chat_pdfs_public_upload" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'chat-pdfs');

CREATE POLICY "chat_pdfs_public_update" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'chat-pdfs');

CREATE POLICY "chat_pdfs_public_delete" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'chat-pdfs');
```

### Solución 3: Verificación de Configuración

1. **Verificar Variables de Entorno**
   ```javascript
   // En browser console
   console.log(window.env);
   
   // Debe mostrar:
   // SUPABASE_URL: "https://supmcp.axcsol.com"
   // SUPABASE_ANON_KEY: "eyJ0eXAiOiJKV1Q..." (no debe ser la dummy key)
   ```

2. **Test Cliente Supabase**
   ```javascript
   // En browser console
   const client = new SupabaseClient();
   console.log(client.isSupabaseAvailable());
   ```

3. **Limpiar Caché**
   - Presionar **Ctrl+F5** para refresh completo
   - O limpiar caché del navegador

## 🧪 VALIDACIÓN DE LA SOLUCIÓN

### Método 1: Usar Herramientas de Test
1. Abrir `test-bucket-fix.html`
2. Click en **"Diagnóstico Completo"**
3. Verificar que muestre "✅ BUCKET 'chat-pdfs' ENCONTRADO"
4. Click en **"Test Upload Real"** para validar funcionamiento

### Método 2: Test Manual en la App
1. Abrir la aplicación principal (`index.html`)
2. Unirse a una sala de prueba
3. Click en el botón 📎 (adjuntar)
4. Seleccionar un PDF pequeño
5. Verificar que se muestre progreso y se suba correctamente

### Método 3: Verificación en Supabase
1. Ve a **Supabase Dashboard** → **Storage**
2. Click en el bucket `chat-pdfs`
3. Debe aparecer el archivo subido en el test

## 🔧 TROUBLESHOOTING AVANZADO

### Error Persiste Después de Crear Bucket

1. **Verificar Nombre Exacto**
   ```sql
   SELECT id, name, public FROM storage.buckets WHERE id LIKE '%pdf%';
   ```

2. **Verificar Políticas**
   ```sql
   SELECT policyname, cmd 
   FROM pg_policies 
   WHERE tablename = 'objects' 
   AND policyname LIKE '%chat_pdfs%';
   ```

3. **Test Conexión Directa**
   ```javascript
   // En browser console de la app
   supabaseClient.client.storage.listBuckets()
     .then(result => console.log('Buckets:', result.data))
     .catch(error => console.error('Error:', error));
   ```

### Error de Permisos

Si aparece error de permisos en lugar de "Bucket not found":

```sql
-- Eliminar políticas existentes (si hay conflicto)
DROP POLICY IF EXISTS "chat_pdfs_public_read" ON storage.objects;
DROP POLICY IF EXISTS "chat_pdfs_public_upload" ON storage.objects;
DROP POLICY IF EXISTS "chat_pdfs_public_update" ON storage.objects;
DROP POLICY IF EXISTS "chat_pdfs_public_delete" ON storage.objects;

-- Volver a crear políticas básicas
CREATE POLICY "chat_pdfs_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'chat-pdfs');
CREATE POLICY "chat_pdfs_public_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-pdfs');
```

## 📋 CHECKLIST DE VERIFICACIÓN

Antes de reportar que el problema persiste, verificar:

- [ ] Bucket `chat-pdfs` existe en Supabase Storage
- [ ] Bucket está marcado como **Público**
- [ ] Nombre es exactamente `chat-pdfs` (minúsculas, con guión)
- [ ] Variables de entorno están configuradas correctamente
- [ ] Cliente Supabase se inicializa sin errores
- [ ] Se ha hecho refresh completo de la página (Ctrl+F5)
- [ ] Test con `test-bucket-fix.html` muestra bucket encontrado
- [ ] No hay errores en la consola del navegador

## 🎯 RESULTADO ESPERADO

Después de aplicar la solución:

1. ✅ El botón 📎 en el chat funciona correctamente
2. ✅ Se puede seleccionar y subir archivos PDF
3. ✅ Se muestra barra de progreso durante la subida
4. ✅ Los PDFs aparecen en la sección "Archivos de la sala"
5. ✅ Se puede hacer preview (👁️) y descarga (⬇️)
6. ✅ Los archivos se sincronizan entre dispositivos

## 📞 SOPORTE ADICIONAL

Si el problema persiste después de seguir todos los pasos:

1. Ejecutar `debug-storage-bucket.html` y exportar el log completo
2. Verificar en la consola del navegador si hay errores adicionales
3. Comprobar en Supabase Dashboard → Logs si hay errores del lado del servidor
4. Verificar que la versión de Supabase JS client sea compatible (v2)

---

## 📁 ARCHIVOS DE DIAGNÓSTICO DISPONIBLES

- `debug-storage-bucket.html` - Diagnóstico completo y detallado
- `test-bucket-fix.html` - Test rápido y solución paso a paso  
- `test-pdf-system.html` - Test completo del sistema PDF
- `sql/03-add-pdf-support.sql` - Script de base de datos completo
- `sql/05-simple-bucket-setup.sql` - Setup básico del bucket

**Estado del sistema**: ✅ Código 100% implementado - Solo falta configuración del bucket en Supabase.