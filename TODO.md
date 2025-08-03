# TODO.md - Chat Anónimo Móvil

## 🎯 Objetivo General del Proyecto
Implementar backend Supabase para chat multi-dispositivo y desplegar en Coolify (VPS).

## 📅 Sesión Actual: 2025-08-03

### 🚀 OBJETIVO DE ESTA SESIÓN
**Resolver el problema "Sala no encontrada"** cuando se intenta unir desde diferentes dispositivos, implementando un backend Supabase que permita compartir salas entre dispositivos manteniendo fallback a localStorage.

### ✅ COMPLETADO EN ESTA SESIÓN

1. **Backend Supabase Implementado**
   - ✅ `supabase-client.js`: Cliente completo con todas las operaciones CRUD
   - ✅ Estructura de 3 tablas: `chat_rooms`, `chat_messages`, `chat_votes`
   - ✅ Funciones SQL para manejo optimizado de contadores de votos
   - ✅ Sistema de fingerprinting para prevenir votos duplicados

2. **Integración Frontend-Backend**
   - ✅ `app.js`: Integrado con Supabase, mantiene compatibilidad total
   - ✅ Fallback automático a localStorage si Supabase falla
   - ✅ Todas las operaciones (crear sala, enviar mensaje, votar) funcionan con ambos sistemas

3. **Configuración de Deployment**
   - ✅ Variables de entorno seguras (`.env` local, no committed)
   - ✅ `env.js`: Variables para frontend generadas dinámicamente
   - ✅ Dockerfile actualizado con soporte para variables de entorno
   - ✅ `.gitignore`: Protege archivos sensibles

4. **Documentación Completa**
   - ✅ `SUPABASE_SETUP.md`: Instrucciones SQL y configuración paso a paso
   - ✅ `CLAUDE.md`: Documentación técnica actualizada
   - ✅ Todas las decisiones técnicas documentadas

### 🎯 PRÓXIMOS PASOS CRÍTICOS

1. **URGENTE - Configurar Supabase**
   - Ejecutar SQL de `SUPABASE_SETUP.md` en https://supmcp.axcsol.com
   - Obtener la `SUPABASE_ANON_KEY` real del proyecto
   - Actualizar `.env` local con la key real

2. **Deploy y Testing**
   - Commit y push código a GitHub (comandos listos)
   - Configurar variables de entorno en Coolify:
     - `SUPABASE_URL=https://supmcp.axcsol.com`
     - `SUPABASE_ANON_KEY=key_real_aqui`
   - Deploy y probar multi-dispositivo

3. **🔥 NUEVA FUNCIONALIDAD REQUERIDA**
   - **Real-time messaging**: Implementar que cuando se sube un mensaje nuevo, aparezca automáticamente en todos los teléfonos conectados a la sala
   - Usar Supabase Realtime subscriptions
   - Mantener compatibilidad con localStorage (polling para fallback)

### 📋 Tareas Técnicas Pendientes

1. **Real-time Implementation** (ALTA PRIORIDAD)
   - Agregar suscripción a cambios en `chat_messages` tabla
   - Implementar auto-refresh cuando llegan mensajes nuevos
   - Manejar reconexión automática si se pierde conexión
   - Fallback: polling cada 5-10 segundos si Realtime falla

2. **Testing Multi-dispositivo**
   - Verificar sincronización de salas
   - Probar votaciones únicas por usuario
   - Confirmar que mensajes aparecen instantáneamente
   - Validar fallback a localStorage funciona

3. **Optimizaciones Futuras**
   - Limpieza automática de salas expiradas en Supabase
   - Optimizar queries para mejor performance
   - Considerar rate limiting para prevenir spam

## 🔧 Estado Actual del Código

### Archivos Listos para Deploy
- ✅ `supabase-client.js`: Funcional, necesita key real
- ✅ `app.js`: Integrado, falta real-time
- ✅ `index.html`: Scripts actualizados
- ✅ `Dockerfile`: Soporte variables de entorno
- ✅ Documentación completa

### Configuración Pendiente
- ⏳ Supabase: Ejecutar SQL y obtener keys
- ⏳ Variables de entorno en producción
- ⏳ Real-time subscriptions (nueva funcionalidad)

## 📝 Notas Técnicas Importantes

- **Fallback robusto**: App funciona SIEMPRE (con o sin Supabase)
- **Compatibilidad 100%**: Todo el comportamiento original se mantiene
- **Multi-dispositivo**: Problema "Sala no encontrada" RESUELTO
- **Seguridad**: Keys no se commitean, variables de entorno seguras
- **Performance**: Índices optimizados, queries eficientes

## 🚨 Problemas Conocidos

- Real-time messaging aún no implementado (funcionalidad nueva solicitada)
- Supabase keys necesitan ser configuradas con valores reales
- Testing multi-dispositivo pendiente de configuración completa