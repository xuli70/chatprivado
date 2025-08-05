# 📁 Configuración de Storage para PDFs - Chat Anónimo

## 🚨 PROBLEMA ACTUAL
El sistema de PDFs está implementado pero falta crear el bucket `chat-pdfs` en Supabase Storage.

Error actual: **"Bucket not found"**

## ✅ SOLUCIÓN RÁPIDA - Crear Bucket (2 minutos)

### Opción 1: Desde el Dashboard de Supabase (RECOMENDADO)

1. **Accede a Supabase**
   - Ve a: https://supmcp.axcsol.com
   - Inicia sesión con tus credenciales

2. **Ve a Storage**
   - En el menú lateral izquierdo, haz clic en **"Storage"** 📁

3. **Crea el Bucket**
   - Haz clic en el botón **"New bucket"** o **"Create bucket"**
   - Completa los campos:
     ```
     Bucket name: chat-pdfs
     Public bucket: ✅ (IMPORTANTE: debe estar marcado)
     File size limit: 10 (MB)
     Allowed MIME types: application/pdf
     ```
   - Haz clic en **"Create bucket"**

4. **¡Listo!** 🎉
   - El bucket está creado y configurado
   - Recarga la aplicación y el upload de PDFs funcionará

### Opción 2: Desde SQL Editor (Si tienes permisos admin)

1. Ve a **SQL Editor** en Supabase
2. Ejecuta el contenido del archivo: `sql/04-create-storage-bucket.sql`
3. Si recibes error de permisos, usa la Opción 1

## 🧪 VERIFICACIÓN

Para verificar que el bucket está correctamente configurado:

1. **En Supabase Dashboard**:
   - Ve a Storage → deberías ver `chat-pdfs` en la lista
   - Debe mostrar "Public" como tipo

2. **En la aplicación**:
   - Intenta subir un PDF
   - No deberías ver el error "Bucket not found"
   - El archivo debería subirse exitosamente

## 📝 CONFIGURACIÓN ACTUAL DEL SISTEMA

- **Tamaño máximo**: 10MB por archivo
- **Tipos permitidos**: Solo PDFs (.pdf)
- **Acceso**: Público (sin RLS como solicitaste)
- **Nombre del bucket**: `chat-pdfs` (no cambiar)

## 🔧 TROUBLESHOOTING

### Error: "Bucket not found"
- Verifica que el nombre sea exactamente `chat-pdfs` (con guión, minúsculas)
- Verifica que sea público
- Recarga la aplicación después de crear el bucket

### Error: "File too large"
- El límite es 10MB
- Reduce el tamaño del PDF antes de subir

### Error: "Invalid file type"
- Solo se permiten archivos PDF
- Verifica que la extensión sea .pdf

## 📱 USO DEL SISTEMA

Una vez configurado el bucket:

1. **En el chat**, verás el botón 📎 junto al input de mensaje
2. **Haz clic** en 📎 para seleccionar un PDF
3. **Espera** a que se muestre la barra de progreso
4. **El PDF** aparecerá en la sección "Archivos de la sala"
5. **Puedes** hacer clic en 👁️ para preview o ⬇️ para descargar

## 🚀 ESTADO ACTUAL

- ✅ Código frontend completamente implementado
- ✅ Código backend (funciones) implementado
- ✅ Base de datos configurada (tabla chat_attachments)
- ❌ **Bucket de Storage pendiente de crear**

**Próximo paso**: Crear el bucket siguiendo las instrucciones de arriba.

---

💡 **Tip**: Si tienes problemas, puedes usar el archivo `test-pdf-system.html` para hacer pruebas completas del sistema.