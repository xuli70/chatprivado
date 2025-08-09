# 🔒 GARANTÍAS DE PRIVACIDAD TOTAL - Chat Anónimo

## 📌 Nuestro Compromiso Fundamental

**Tu privacidad es sagrada. Esta aplicación fue diseñada desde cero con un único principio: ANONIMATO REAL.**

No pedimos registro. No guardamos datos personales. No rastreamos usuarios. No vendemos información. Punto.

---

## ✅ Lo Que GARANTIZAMOS

### 1. **Anonimato Completo**
- ✅ **NO pedimos tu nombre real** - Solo un alias temporal si creas una sala
- ✅ **NO pedimos email** - Nunca te pediremos correo electrónico
- ✅ **NO pedimos teléfono** - Sin verificación SMS ni WhatsApp
- ✅ **NO pedimos contraseñas** - Sin cuentas que hackear
- ✅ **NO guardamos tu IP** - Tu ubicación es tu asunto
- ✅ **NO usamos cookies de tracking** - Sin seguimiento publicitario
- ✅ **NO conectamos con redes sociales** - Sin login con Google/Facebook

### 2. **Identificador Anónimo Temporal**
```
En lugar de "Usuario desconocido", apareces como "Anónimo #A1B2C3"
```
- Este código se genera **localmente en tu navegador**
- Se basa en características técnicas (no personales) del navegador
- **NO contiene**: Tu nombre, email, IP, ubicación, ni datos personales
- **Solo sirve para**: Distinguir mensajes en una conversación
- **Se puede resetear**: Borrando datos del navegador

### 3. **Datos con Fecha de Caducidad**
- **Salas expiran en 2 horas** - Automáticamente eliminadas
- **Sin historial permanente** - No hay archivo de conversaciones
- **Sin perfiles de usuario** - No construimos un perfil sobre ti
- **Limpieza automática** - Sistema borra todo después de 2 horas

---

## 🛡️ Arquitectura de Privacidad

### **Capa 1: Frontend (Tu Navegador)**
```javascript
// Todo ocurre localmente primero
- Generación de identificadores: EN TU DISPOSITIVO
- Validación de mensajes: EN TU DISPOSITIVO  
- Cifrado de fingerprint: EN TU DISPOSITIVO
- Decisión de envío: TÚ TIENES EL CONTROL
```

### **Capa 2: Transmisión**
```javascript
// Conexión segura HTTPS
- Certificado SSL/TLS válido
- Encriptación en tránsito
- Sin logs de acceso personal
- Sin metadata innecesaria
```

### **Capa 3: Base de Datos**
```sql
-- Lo que guardamos (temporalmente):
- room_id: "ROOM1234" (código aleatorio)
- message: "Tu mensaje" (texto plano)
- author: "Anónimo #A1B2C3" (identificador temporal)
- timestamp: "2025-01-15 10:30:00" (hora del mensaje)

-- Lo que NO guardamos:
- IP address ❌
- Email ❌
- Nombre real ❌
- Ubicación GPS ❌
- Dispositivo específico ❌
- Sistema operativo detallado ❌
- Historial de navegación ❌
```

### **Capa 4: Seguridad RLS (Row Level Security)**
```sql
-- Políticas de seguridad implementadas:
- Solo puedes ver mensajes de salas que conoces
- No hay "super usuario" que vea todo
- Sin backdoors administrativos para espiar
- Aislamiento completo entre salas
```

---

## 🚫 Lo Que NO Hacemos

### **NO Rastreamos**
- ❌ Sin Google Analytics
- ❌ Sin Facebook Pixel  
- ❌ Sin Hotjar o grabación de sesión
- ❌ Sin seguimiento de clicks
- ❌ Sin heatmaps
- ❌ Sin A/B testing con tu data

### **NO Monetizamos**
- ❌ Sin venta de datos a terceros
- ❌ Sin perfiles para publicidad
- ❌ Sin análisis de comportamiento
- ❌ Sin minería de texto
- ❌ Sin análisis de sentimientos para marketing

### **NO Persistimos**
- ❌ Sin base de datos de usuarios
- ❌ Sin backups de conversaciones privadas
- ❌ Sin logs permanentes
- ❌ Sin archivo histórico
- ❌ Sin caché de largo plazo

---

## 🔍 Transparencia Total

### **Código Abierto**
```bash
# Puedes auditar cada línea de código
- Frontend: JavaScript vanilla (sin librerías ocultas)
- Backend: Supabase open source
- Sin código ofuscado
- Sin binarios compilados misteriosos
```

### **Tecnologías Usadas**
```javascript
// Stack minimalista y transparente:
- HTML5 + CSS3 + JavaScript (estándar web)
- Supabase (base de datos open source)
- Sin frameworks pesados que oculten lógica
- Sin dependencias no auditables
```

---

## 🤔 Preguntas Frecuentes sobre Privacidad

### **"¿Cómo sé que esto es verdad?"**
- El código es 100% auditable en GitHub
- No hay servidor backend propietario oculto
- Puedes usar las herramientas de desarrollador (F12) para ver qué datos se envían
- La aplicación funciona incluso sin conexión (localStorage)

### **"¿Qué pasa con el identificador #A1B2C3?"**
- Se genera con un hash de características del navegador
- NO incluye datos personales
- Es como un "número de asiento temporal" en el chat
- Puedes cambiarlo borrando datos del navegador

### **"¿Y si soy administrador de una sala?"**
- Solo se guarda el alias que elegiste para esa sala específica
- Expira en 2 horas junto con la sala
- Sin vinculación entre salas que crees
- Puedes usar modo incógnito para ser anónimo incluso como admin

### **"¿Qué datos quedan en mi dispositivo?"**
```javascript
localStorage:
- anonymousChat_session: Sesión temporal actual (expira en 24h)
- anonymousChat_identifierMapping: Tu ID anónimo local
- Puedes borrar todo con: Configuración > Borrar datos de navegación
```

### **"¿Y la función de IA?"**
- Es OPCIONAL y requiere acción explícita del usuario
- Solo analiza mensajes de la sala actual
- No se envían datos personales a OpenAI
- El admin puede deshabilitarla completamente

### **"¿Pueden recuperar mensajes borrados?"**
- NO. Cuando una sala expira (2 horas), se elimina completamente
- Sin papelera de reciclaje
- Sin backups ocultos
- Sin logs de recuperación

---

## 📜 Declaración de Derechos del Usuario

### **Tienes derecho a:**
1. **Participar sin identificarte** - Siempre serás anónimo
2. **Salir sin dejar rastro** - Un click y desapareces
3. **No ser rastreado** - Sin cookies ni fingerprinting invasivo
4. **Controlar tu participación** - Entras y sales cuando quieras
5. **Resetear tu identidad** - Borra datos locales y eres nuevo
6. **Verificar el código** - Todo es open source y auditable

---

## 🔐 Medidas Técnicas de Protección

### **1. Expiración Automática**
```javascript
// Cada sala tiene vida limitada
const ROOM_EXPIRY = 2 * 60 * 60 * 1000; // 2 horas
// Después de este tiempo: ELIMINACIÓN TOTAL
```

### **2. Sin Logs Personales**
```javascript
// Lo que registramos:
console.log("Nueva sala creada"); // ✅ Genérico
// Lo que NO registramos:
console.log("Usuario Juan creó sala"); // ❌ Nunca
```

### **3. Identificadores Locales**
```javascript
// Generación en TU navegador:
function generateIdentifier() {
    // Usa características del navegador (no personales)
    // NO envía nada a servidor para generar
    // NO incluye tu nombre, email, o IP
    return localHash; // Se queda en tu dispositivo
}
```

### **4. Principio de Mínima Información**
```javascript
// Solo guardamos lo esencial para funcionar:
message = {
    text: "Hola", // El mensaje (necesario)
    room: "ROOM1234", // Sala (necesario)
    timestamp: Date.now() // Cuándo (necesario)
    // NO guardamos: IP, browser, OS, location, etc.
}
```

---

## 💚 Nuestro Compromiso Contigo

> **"Tu privacidad no es negociable. No es una característica premium. No es opcional. Es el fundamento de esta aplicación."**

### **Promesas que mantenemos:**
- 🤝 **Sin letra pequeña** - Lo que ves es lo que hay
- 🤝 **Sin cambios sorpresa** - Si algo cambia, será para más privacidad, no menos
- 🤝 **Sin venta futura** - Si el proyecto cambia de manos, el código sigue siendo abierto
- 🤝 **Sin monetización oculta** - Gratis significa gratis, no "gratis a cambio de tus datos"

---

## 📞 ¿Dudas o Preocupaciones?

Si tienes alguna pregunta sobre privacidad que no está respondida aquí:

1. **Revisa el código fuente** - Todo está ahí, sin secretos
2. **Abre un issue en GitHub** - Comunidad abierta a responder
3. **Usa las herramientas de desarrollo** - Inspecciona qué datos se envían (F12)
4. **Prueba en modo incógnito** - Verifica que funciona sin rastros

---

## ✨ Conclusión

**Chat Anónimo es lo que promete ser: Un espacio para conversar de forma verdaderamente anónima.**

Sin trucos. Sin letra pequeña. Sin recolección oculta de datos.

Tu privacidad es nuestra arquitectura, no una característica añadida.

---

*Última actualización: Enero 2025*

*Este documento es parte del código abierto y puede ser auditado y verificado por cualquier persona.*

**🔒 Tu privacidad está garantizada. Disfruta conversando con total tranquilidad.**