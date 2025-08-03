# Chat Anónimo Móvil 📱💬

Una aplicación web móvil de chat anónimo desarrollada completamente con tecnologías frontend: HTML5, CSS3 y JavaScript vanilla. Permite crear espacios de diálogo dinámicos donde los usuarios pueden plantear preguntas específicas y recibir respuestas anónimas, fomentando la participación honesta sin prejuicios.

## 🚀 Características Principales

### ✨ **Interfaz Mobile-First**
- Diseño completamente responsivo optimizado para dispositivos móviles
- Navegación intuitiva con elementos táctiles de 48px mínimo
- Breakpoints adaptativos: 320px, 768px, 1024px+
- Experiencia fluida en smartphones y tablets

### 🔒 **Chat Anónimo**
- El creador de la sala es visible únicamente en la pregunta inicial
- Participantes completamente anónimos en sus respuestas
- Códigos únicos de sala de 6 caracteres para unirse
- Diferenciación visual clara entre creador y usuarios anónimos

### 👍 **Sistema de Votaciones**
- Botones de like/dislike para cada mensaje
- Contadores visuales de votos en tiempo real
- Animaciones suaves al interactuar
- Prevención de votos múltiples por usuario

### ⏱️ **Control y Límites**
- Límite de 50 mensajes por sala
- Tiempo máximo de 2 horas por conversación
- Temporizadores visuales en tiempo real
- Alertas cuando se acercan los límites

### 💾 **Almacenamiento Local**
- Persistencia completa usando localStorage
- Gestión automática de limpieza de datos antiguos
- Opción manual de borrar datos del usuario
- Optimización de espacio (máximo 5MB)

## 🏗️ Arquitectura del Código

### **Estructura HTML (index.html)**
```html
<!DOCTYPE html>
<html lang="es">
<head>
    <!-- Meta tags optimizados para móvil -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
    <!-- Pantalla de Bienvenida -->
    <div id="welcomeScreen" class="screen active">
        <!-- Botones principales y logo -->
    </div>
    
    <!-- Pantalla de Crear Sala -->
    <div id="createRoomScreen" class="screen">
        <!-- Formulario de creación -->
    </div>
    
    <!-- Pantalla de Unirse a Sala -->
    <div id="joinRoomScreen" class="screen">
        <!-- Input de código de sala -->
    </div>
    
    <!-- Pantalla Principal de Chat -->
    <div id="chatScreen" class="screen">
        <!-- Área de mensajes y controles -->
    </div>
    
    <!-- Modal de Confirmación -->
    <div id="confirmModal" class="modal">
        <!-- Diálogos de confirmación -->
    </div>
</body>
</html>
```

**Características HTML:**
- **Semántica correcta**: Uso de elementos apropiados (`<form>`, `<button>`, `<input>`)
- **Accesibilidad**: Labels asociados, atributos ARIA donde es necesario
- **Estructura modular**: Pantallas separadas con navegación por JavaScript
- **Formularios validados**: Inputs con validación HTML5 nativa

### **Estilos CSS (style.css)**

#### **Sistema de Tokens de Color**
```css
:root {
    /* Colores primitivos */
    --color-white: rgba(255, 255, 255, 1);
    --color-cream-50: rgba(252, 252, 249, 1);
    --color-teal-500: rgba(33, 128, 141, 1);
    
    /* Colores semánticos */
    --color-background: var(--color-cream-50);
    --color-primary: var(--color-teal-500);
    --color-text: var(--color-charcoal-700);
    
    /* Fondos dinámicos para mensajes */
    --color-bg-1: rgba(59, 130, 246, 0.08);
    --color-bg-2: rgba(245, 158, 11, 0.08);
    /* ... 8 colores rotativos */
}
```

#### **Diseño Responsivo**
```css
/* Mobile First - Base styles para 320px+ */
.container {
    max-width: 100%;
    padding: 1rem;
}

/* Tablet - 768px+ */
@media (min-width: 768px) {
    .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 2rem;
    }
}

/* Desktop - 1024px+ */
@media (min-width: 1024px) {
    .container {
        max-width: 800px;
        padding: 3rem;
    }
}
```

#### **Componentes Modulares**
- **Botones**: Sistema de variantes (primary, outline, success, danger)
- **Cards**: Contenedores reutilizables con sombras y bordes redondeados
- **Forms**: Estilos consistentes para inputs y labels
- **Animations**: Transiciones suaves para interacciones

### **Lógica JavaScript (app.js)**

#### **Arquitectura de Clase Principal**
```javascript
class AnonymousChatApp {
    constructor() {
        this.config = {
            messageLimit: 50,
            timeLimit: 7200000, // 2 horas
            maxStorageSize: 5242880, // 5MB
            autoCleanup: true
        };
        
        this.state = {
            currentScreen: 'welcomeScreen',
            currentRoom: null,
            currentUser: null,
            userVotes: new Map(),
            timers: new Map()
        };
        
        this.init();
    }
}
```

#### **Módulos Funcionales**

**1. Gestión de Pantallas**
```javascript
showScreen(screenId) {
    // Ocultar todas las pantallas
    Object.values(this.elements.screens).forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Mostrar pantalla solicitada
    this.elements.screens[screenId].classList.add('active');
    this.state.currentScreen = screenId;
}
```

**2. Sistema de Salas**
```javascript
createRoom(creatorName, question) {
    const roomCode = this.generateRoomCode(); // 6 caracteres únicos
    const room = {
        id: roomCode,
        creator: creatorName,
        question: question,
        createdAt: Date.now(),
        expiresAt: Date.now() + this.config.timeLimit,
        messages: [],
        messageCount: 0
    };
    
    this.saveRoom(room);
    return room;
}
```

**3. Gestión de Mensajes**
```javascript
sendMessage(text, isAnonymous = true) {
    const message = {
        id: Date.now(),
        text: text,
        isAnonymous: isAnonymous,
        timestamp: Date.now(),
        votes: { likes: 0, dislikes: 0 },
        backgroundColor: this.getRandomBackgroundColor()
    };
    
    this.state.currentRoom.messages.push(message);
    this.state.currentRoom.messageCount++;
    
    this.saveRoom(this.state.currentRoom);
    this.renderMessages();
    this.updateCounters();
}
```

**4. Sistema de Votaciones**
```javascript
vote(messageId, voteType) {
    const voteKey = `${messageId}_${voteType}`;
    
    // Prevenir votos duplicados
    if (this.state.userVotes.has(voteKey)) {
        return false;
    }
    
    const message = this.findMessage(messageId);
    message.votes[voteType]++;
    
    this.state.userVotes.set(voteKey, true);
    this.saveUserVotes();
    this.saveRoom(this.state.currentRoom);
    
    return true;
}
```

**5. Almacenamiento Local**
```javascript
// Guardar sala
saveRoom(room) {
    try {
        const rooms = this.getAllRooms();
        rooms[room.id] = room;
        localStorage.setItem('anonymousChat_rooms', JSON.stringify(rooms));
    } catch (error) {
        this.handleStorageError(error);
    }
}

// Limpieza automática
cleanupOldRooms() {
    const rooms = this.getAllRooms();
    const now = Date.now();
    
    Object.keys(rooms).forEach(roomId => {
        if (rooms[roomId].expiresAt < now) {
            delete rooms[roomId];
        }
    });
    
    localStorage.setItem('anonymousChat_rooms', JSON.stringify(rooms));
}
```

**6. Temporizadores en Tiempo Real**
```javascript
startRoomTimer(room) {
    const timerId = setInterval(() => {
        const timeLeft = room.expiresAt - Date.now();
        
        if (timeLeft <= 0) {
            this.expireRoom(room);
            clearInterval(timerId);
        } else {
            this.updateTimeDisplay(timeLeft);
        }
    }, 1000);
    
    this.state.timers.set(room.id, timerId);
}
```

## 📱 Funcionalidades Implementadas

### **1. Flujo de Usuario Completo**
- **Bienvenida**: Pantalla inicial con opciones claras
- **Crear Sala**: Formulario con validación en tiempo real
- **Código de Sala**: Generación automática y opción de copiar
- **Unirse**: Validación de códigos existentes
- **Chat**: Interfaz completa con mensajes y votaciones
- **Controles**: Salir, limpiar datos, compartir

### **2. Experiencia Móvil Optimizada**
- **Touch Targets**: Todos los elementos interactivos ≥48px
- **Scroll Suave**: Desplazamiento automático a nuevos mensajes
- **Haptic Feedback**: Feedback visual inmediato en interacciones
- **Keyboard Handling**: Gestión inteligente del teclado virtual

### **3. Sistema de Privacidad**
- **Datos Locales**: Todo almacenado en localStorage del usuario
- **Anonimato**: Identidades protegidas después de la pregunta inicial
- **Limpieza**: Opciones granulares de borrado de datos
- **Transparencia**: Avisos claros sobre privacidad local

### **4. Gestión de Estado Avanzada**
- **Persistencia**: Estado completo guardado entre sesiones
- **Sincronización**: Updates automáticos de contadores y timers
- **Error Handling**: Manejo robusto de errores de storage
- **Memory Management**: Limpieza automática de timers y eventos

## 🛠️ Instalación y Uso

### **Requisitos**
- Navegador web moderno (Chrome 60+, Safari 12+, Firefox 60+)
- JavaScript habilitado
- Almacenamiento local disponible (localStorage)

### **Instalación**
1. Descarga los archivos: `index.html`, `style.css`, `app.js`
2. Coloca todos los archivos en el mismo directorio
3. Abre `index.html` en tu navegador web
4. ¡La aplicación está lista para usar!

### **Uso Básico**
1. **Crear Sala**: Introduce tu nombre y pregunta inicial
2. **Compartir**: Copia el código de 6 caracteres generado
3. **Invitar**: Comparte el código con otros participantes
4. **Participar**: Los usuarios se unen usando el código
5. **Conversar**: Intercambio anónimo de mensajes con votaciones
6. **Monitorear**: Observa límites de tiempo y mensajes

## 🔧 Personalización

### **Configuración de Límites**
```javascript
// En app.js, modificar constructor:
this.config = {
    messageLimit: 100,     // Cambiar límite de mensajes
    timeLimit: 3600000,    // 1 hora en lugar de 2
    maxStorageSize: 10485760, // 10MB en lugar de 5MB
    autoCleanup: false     // Desactivar limpieza automática
};
```

### **Colores y Temas**
```css
/* En style.css, modificar variables CSS: */
:root {
    --color-primary: rgba(200, 50, 100, 1);     /* Color principal */
    --color-background: rgba(250, 250, 250, 1); /* Fondo */
    --color-text: rgba(30, 30, 30, 1);          /* Texto */
}
```

### **Textos de Interfaz**
Todos los textos están centralizados en el HTML y pueden modificarse fácilmente buscando las clases correspondientes.

## 📊 Rendimiento y Compatibilidad

### **Optimizaciones Implementadas**
- **CSS Grid/Flexbox**: Layouts eficientes sin frameworks
- **Event Delegation**: Gestión optimizada de eventos
- **Debounced Updates**: Actualizaciones controladas de interfaz
- **Memory Cleanup**: Limpieza automática de timers y listeners
- **Lazy Loading**: Renderizado bajo demanda de mensajes

### **Compatibilidad de Navegadores**
- ✅ Chrome 60+ (Android/Desktop)
- ✅ Safari 12+ (iOS/macOS)
- ✅ Firefox 60+ (Android/Desktop)
- ✅ Edge 79+ (Windows/Android)
- ⚠️ Opera 47+ (con limitaciones menores)

### **Dispositivos Testados**
- 📱 Smartphones: iPhone 8+, Android 7+
- 📲 Tablets: iPad Air+, Android tablets 10"+
- 💻 Desktop: Resoluciones 1024px+

## 🔐 Privacidad y Seguridad

### **Datos Almacenados Localmente**
- Salas creadas y unidas
- Mensajes enviados y recibidos
- Votos realizados (para prevenir duplicados)
- Configuraciones de usuario

### **Datos NO Almacenados**
- Información personal identificable
- Direcciones IP o ubicación
- Datos de navegación externa
- Cookies de terceros

### **Limpieza de Datos**
- **Automática**: Salas expiradas eliminadas cada 24h
- **Manual**: Botón "Limpiar Datos" elimina todo
- **Por Sala**: Salir de sala elimina participación local

## 🚀 Futuras Mejoras

### **Funcionalidades Planeadas**
- [ ] Notificaciones push para nuevos mensajes
- [ ] Exportar conversaciones como texto
- [ ] Temas de color adicionales (modo oscuro)
- [ ] Soporte para emojis y reacciones expandidas
- [ ] Sistema de moderación básico

### **Optimizaciones Técnicas**
- [ ] Service Worker para funcionamiento offline
- [ ] Compresión de datos en localStorage
- [ ] Animaciones más fluidas con requestAnimationFrame
- [ ] Soporte para PWA (Progressive Web App)

## 🤝 Contribuciones

Este proyecto es de código abierto y acepta contribuciones. Para contribuir:

1. Haz fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Añadir nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

MIT License - Ver archivo LICENSE para más detalles.

## 📞 Soporte

Para reportar bugs o solicitar features:
- Abre un issue en el repositorio
- Incluye detalles del navegador y dispositivo
- Proporciona pasos para reproducir el problema

---

**Desarrollado con ❤️ usando tecnologías web nativas**
*Optimizado para la privacidad y la experiencia móvil*