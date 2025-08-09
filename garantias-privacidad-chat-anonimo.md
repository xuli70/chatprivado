# 🔒 GARANTÍAS DE PRIVACIDAD TOTAL - Chat Anónimo

## 📌 Nuestro Compromiso Fundamental

Tu privacidad es sagrada. Esta aplicación fue diseñada desde cero con un único principio: ANONIMATO REAL.

No pedimos registro. No guardamos datos personales. No rastreamos usuarios. No vendemos información. Punto.

## ✅ Lo Que GARANTIZAMOS

### 1. Anonimato Completo
- No pedimos tu nombre real; solo un alias temporal si creas una sala.
- No pedimos email; nunca te pediremos correo electrónico.
- No pedimos teléfono; sin verificación SMS ni WhatsApp.
- No pedimos contraseñas; sin cuentas que hackear.
- No guardamos tu IP; tu ubicación es tu asunto.
- No usamos cookies de tracking; sin seguimiento publicitario.
- No conectamos con redes sociales; sin login con Google/Facebook.

### 2. Identificador Anónimo Temporal
```
En lugar de "Usuario desconocido", apareces como "Anónimo #A1B2C3"
```
Se genera localmente en tu navegador, basado en características técnicas (no personales). No contiene tu nombre, email, IP, ubicación ni datos personales. Solo sirve para distinguir mensajes en una conversación, y se puede resetear borrando datos del navegador.

### 3. Datos con Fecha de Caducidad
Las salas y sus mensajes expiran automáticamente. El tiempo de expiración puede ser de 2 horas o el que se configure en la sala según las necesidades. No hay historial permanente, no hay perfiles de usuario, y la limpieza es automática según el tiempo de vida definido.

## 🛡️ Arquitectura de Privacidad

### Capa 1: Frontend (Tu Navegador)
```javascript
// Todo ocurre localmente primero
- Generación de identificadores: EN TU DISPOSITIVO
- Validación de mensajes: EN TU DISPOSITIVO
- Cifrado de fingerprint: EN TU DISPOSITIVO
- Decisión de envío: TÚ TIENES EL CONTROL
```

### Capa 2: Transmisión
```javascript
// Conexión segura HTTPS
- Certificado SSL/TLS válido
- Encriptación en tránsito
- Sin logs de acceso personal
- Sin metadata innecesaria
```

### Capa 3: Base de Datos
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

### Capa 4: Seguridad RLS (Row Level Security)
```sql
-- Políticas de seguridad implementadas:
- Solo puedes ver mensajes de salas que conoces
- No hay "super usuario" que vea todo
- Sin backdoors administrativos para espiar
- Aislamiento completo entre salas
```

## 🚫 Lo Que NO Hacemos

### NO Rastreamos
Sin Google Analytics, sin Facebook Pixel, sin Hotjar o grabación de sesión, sin seguimiento de clicks, sin heatmaps y sin A/B testing con tu data.

### NO Monetizamos
Sin venta de datos a terceros, sin perfiles para publicidad, sin análisis de comportamiento, sin minería de texto y sin análisis de sentimientos para marketing.

### NO Persistimos
Sin base de datos de usuarios, sin backups de conversaciones privadas, sin logs permanentes, sin archivo histórico y sin caché de largo plazo.

## 🔍 Transparencia

Promovemos prácticas transparentes de desarrollo y operación, sin código ofuscado, sin binarios compilados misteriosos, ni componentes que oculten lógica crítica.

## 🤔 Preguntas Frecuentes sobre Privacidad

### ¿Cómo sé que esto es verdad?
No hay servidor backend propietario oculto. Puedes usar las herramientas de desarrollador (F12) para ver qué datos se envían y verificar el comportamiento en tiempo real. La aplicación funciona incluso sin conexión (localStorage), dentro de sus límites.

### ¿Qué pasa con el identificador #A1B2C3?
Se genera con un hash de características del navegador, no incluye datos personales, funciona como un "número de asiento temporal" en el chat.

### ¿Y si soy administrador de una sala?
Solo se guarda el alias que elegiste para esa sala específica. La sala y sus datos expiran según el tiempo configurado (mínimo 2 horas por defecto), sin vinculación entre salas que crees. Puedes usar modo incógnito para ser anónimo incluso como admin.

### ¿Qué datos quedan en mi dispositivo?
```javascript
localStorage:
- anonymousChat_session: Sesión temporal actual (expira según la duración configurada de la sala; nunca más allá de lo necesario)
- anonymousChat_identifierMapping: Tu ID anónimo local
- Puedes borrar todo con: Configuración > Borrar datos de navegación
```

### ¿Y la función de IA?
Es opcional y requiere acción explícita del usuario. Solo analiza mensajes de la sala actual. No se envían datos personales y el admin puede deshabilitarla completamente.

### ¿Pueden recuperar mensajes borrados?
No. Cuando una sala expira (tras el tiempo configurado, por ejemplo 2 horas), se elimina completamente. Sin papelera de reciclaje, sin backups ocultos, sin logs de recuperación.

## 📜 Declaración de Derechos del Usuario

Tienes derecho a participar sin identificarte, salir sin dejar rastro, no ser rastreado, controlar tu participación, resetear tu identidad y entender cómo se manejan tus datos. Mantenemos una comunicación clara y sin letra pequeña.

## 🔐 Medidas Técnicas de Protección

### 1. Expiración Automática
```javascript
// Cada sala tiene vida limitada.
// Por defecto: 2 horas. Puede configurarse según necesidades al crear la sala.
const ROOM_EXPIRY_MS = configuredExpiryMs ?? (2 * 60 * 60 * 1000);
// Después de este tiempo: eliminación total
```

### 2. Sin Logs Personales
```javascript
// Lo que registramos:
console.log("Nueva sala creada"); // ✅ Genérico
// Lo que NO registramos:
console.log("Usuario Maxim creó sala"); // ❌ Nunca
```

### 3. Identificadores Locales
```javascript
// Generación en TU navegador:
function generateIdentifier() {
  // Usa características del navegador (no personales)
  // NO envía nada al servidor para generar
  // NO incluye tu nombre, email o IP
  return localHash; // Se queda en tu dispositivo
}
```

### 4. Principio de Mínima Información
```javascript
// Solo guardamos lo esencial para funcionar:
const message = {
  text: "Hola",          // necesario
  room: "ROOM1234",      // necesario
  timestamp: Date.now()  // necesario
  // NO guardamos: IP, browser, OS, location, etc.
}
```

## 💚 Nuestro Compromiso Contigo

"Tu privacidad no es negociable. No es una característica premium. No es opcional. Es el fundamento de esta aplicación."

Promesas que mantenemos: sin letra pequeña, sin cambios sorpresa (si algo cambia, será para más privacidad, no menos), sin monetización oculta y sin intercambio de tus datos.

## 📞 ¿Dudas o Preocupaciones?

Si tienes alguna pregunta sobre privacidad que no está respondida aquí, usa las herramientas de desarrollo para inspeccionar qué datos se envían (F12) o contáctanos por los canales habilitados en la aplicación.

## ✨ Conclusión

Chat Anónimo es lo que promete ser: un espacio para conversar de forma verdaderamente anónima. Sin trucos, sin letra pequeña y sin recolección oculta de datos. Tu privacidad es nuestra arquitectura, no una característica añadida.

Última actualización: Enero 2025

Tu privacidad está garantizada. Disfruta conversando con total tranquilidad.
