// Gestión de elementos DOM para Chat Anónimo
// Funciones para manipular la interfaz de usuario

/**
 * Cachea todas las referencias a elementos DOM
 * @returns {Object} - Objeto con todas las referencias organizadas por categoría
 */
export function cacheElements() {
    return {
        // Pantallas
        screens: {
            welcomeScreen: document.getElementById('welcomeScreen'),
            joinRoomScreen: document.getElementById('joinRoomScreen'),
            chatScreen: document.getElementById('chatScreen')
        },

        // Botones principales
        buttons: {
            joinRoom: document.getElementById('joinRoomBtn'),
            backToWelcome: document.getElementById('backToWelcome'),
            backToWelcomeFromJoin: document.getElementById('backToWelcomeFromJoin'),
            shareRoom: document.getElementById('shareRoomBtn'),
            refreshRoom: document.getElementById('refreshRoomBtn'),
            leaveRoom: document.getElementById('leaveRoomBtn'),
            aiAnalysis: document.getElementById('aiAnalysisBtn'),
            copyCode: document.getElementById('copyCodeBtn'),
            startChat: document.getElementById('startChatBtn'),
            closeModal: document.getElementById('closeModal'),
            confirm: document.getElementById('confirmBtn'),
            cancel: document.getElementById('cancelBtn'),
            themeToggle: document.getElementById('themeToggleBtn')
        },

        // Formularios
        forms: {
            joinRoom: document.getElementById('joinRoomForm'),
            message: document.getElementById('messageForm')
        },

        // Inputs
        inputs: {
            roomCode: document.getElementById('roomCode'),
            messageInput: document.getElementById('messageInput')
        },

        // Displays
        displays: {
            roomCode: document.getElementById('roomCodeDisplay'),
            displayRoomCode: document.getElementById('displayRoomCode'),
            messageCounter: document.getElementById('messageCounter'),
            chatMessages: document.getElementById('chatMessages'),
            characterCount: document.querySelector('.character-count'),
            connectionStatus: document.getElementById('connectionStatus'),
            connectionText: document.querySelector('.connection-text')
        },

        // Modales
        modals: {
            roomCode: document.getElementById('roomCodeModal'),
            confirm: document.getElementById('confirmModal'),
            confirmTitle: document.getElementById('confirmTitle'),
            confirmMessage: document.getElementById('confirmMessage')
        },

        // Toast
        toast: {
            container: document.getElementById('toast'),
            message: document.getElementById('toastMessage')
        }
    };
}

/**
 * Muestra una pantalla específica y oculta las demás
 * @param {string} screenId - ID de la pantalla a mostrar
 * @param {Object} elements - Referencias a elementos DOM
 * @param {Object} state - Estado de la aplicación
 */
export function showScreen(screenId, elements, state) {
    // Ocultar todas las pantallas
    Object.values(elements.screens).forEach(screen => {
        screen.classList.remove('active');
    });

    // Mostrar la pantalla solicitada
    const targetScreen = elements.screens[screenId];
    if (targetScreen) {
        targetScreen.classList.add('active');
        state.currentScreen = screenId;
    }
}

/**
 * Actualiza el contador de caracteres del input de mensaje
 * @param {Object} elements - Referencias a elementos DOM
 */
export function updateCharacterCount(elements) {
    const text = elements.inputs.messageInput.value;
    const count = text.length;
    const limit = 280;
    
    elements.displays.characterCount.textContent = `${count}/${limit}`;
    
    // Actualizar clase según límite
    elements.displays.characterCount.classList.remove('warning', 'error');
    if (count > limit * 0.8) {
        elements.displays.characterCount.classList.add('warning');
    }
    if (count > limit) {
        elements.displays.characterCount.classList.add('error');
    }

    // Habilitar/deshabilitar botón de envío
    const sendBtn = elements.forms.message.querySelector('.send-btn');
    sendBtn.disabled = count === 0 || count > limit;
}

/**
 * Actualiza los contadores de mensajes y tiempo
 * @param {Object} elements - Referencias a elementos DOM
 * @param {Object} state - Estado de la aplicación
 * @param {Object} config - Configuración de la aplicación
 */
export function updateCounters(elements, state, config) {
    if (!state.currentRoom) return;

    // Contador de mensajes - usar el límite de la sala actual, no de config
    const messageCount = state.currentRoom.messages.length;
    const messageLimit = state.currentRoom.messageLimit || config.messageLimit;
    elements.displays.messageCounter.textContent = `💬 ${messageCount}/${messageLimit}`;

}