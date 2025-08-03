// Aplicación de Chat Anónimo
// Gestión completa de funcionalidades frontend

class AnonymousChatApp {
    constructor() {
        // Configuración por defecto
        this.config = {
            messageLimit: 50,
            timeLimit: 7200000, // 2 horas en ms
            maxStorageSize: 5242880, // 5MB
            autoCleanup: true
        };

        // Estado de la aplicación
        this.state = {
            currentScreen: 'welcomeScreen',
            currentRoom: null,
            currentUser: null,
            userVotes: new Map(), // Para rastrear votos del usuario
            timers: new Map()
        };

        // Elementos del DOM
        this.elements = {};
        
        // Cliente de Supabase
        this.supabaseClient = null;
        
        // Inicializar aplicación
        this.init();
    }

    async init() {
        this.cacheElements();
        this.bindEvents();
        
        // Inicializar cliente de Supabase
        if (typeof SupabaseClient !== 'undefined') {
            this.supabaseClient = new SupabaseClient();
        }
        
        this.loadFromStorage();
        this.showScreen('welcomeScreen');
    }

    cacheElements() {
        // Pantallas
        this.elements.screens = {
            welcomeScreen: document.getElementById('welcomeScreen'),
            createRoomScreen: document.getElementById('createRoomScreen'),
            joinRoomScreen: document.getElementById('joinRoomScreen'),
            chatScreen: document.getElementById('chatScreen')
        };

        // Botones principales
        this.elements.buttons = {
            createRoom: document.getElementById('createRoomBtn'),
            joinRoom: document.getElementById('joinRoomBtn'),
            backToWelcome: document.getElementById('backToWelcome'),
            backToWelcomeFromJoin: document.getElementById('backToWelcomeFromJoin'),
            shareRoom: document.getElementById('shareRoomBtn'),
            leaveRoom: document.getElementById('leaveRoomBtn'),
            clearData: document.getElementById('clearDataBtn'),
            copyCode: document.getElementById('copyCodeBtn'),
            startChat: document.getElementById('startChatBtn'),
            closeModal: document.getElementById('closeModal'),
            confirm: document.getElementById('confirmBtn'),
            cancel: document.getElementById('cancelBtn')
        };

        // Formularios
        this.elements.forms = {
            createRoom: document.getElementById('createRoomForm'),
            joinRoom: document.getElementById('joinRoomForm'),
            message: document.getElementById('messageForm')
        };

        // Inputs
        this.elements.inputs = {
            creatorName: document.getElementById('creatorName'),
            initialQuestion: document.getElementById('initialQuestion'),
            roomCode: document.getElementById('roomCode'),
            messageInput: document.getElementById('messageInput')
        };

        // Displays
        this.elements.displays = {
            roomCode: document.getElementById('roomCodeDisplay'),
            displayRoomCode: document.getElementById('displayRoomCode'),
            timeCounter: document.getElementById('timeCounter'),
            messageCounter: document.getElementById('messageCounter'),
            chatMessages: document.getElementById('chatMessages'),
            characterCount: document.querySelector('.character-count'),
            connectionStatus: document.getElementById('connectionStatus'),
            connectionText: document.querySelector('.connection-text')
        };

        // Modales
        this.elements.modals = {
            roomCode: document.getElementById('roomCodeModal'),
            confirm: document.getElementById('confirmModal'),
            confirmTitle: document.getElementById('confirmTitle'),
            confirmMessage: document.getElementById('confirmMessage')
        };

        // Toast
        this.elements.toast = {
            container: document.getElementById('toast'),
            message: document.getElementById('toastMessage')
        };
    }

    bindEvents() {
        // Navegación
        this.elements.buttons.createRoom.addEventListener('click', () => this.showScreen('createRoomScreen'));
        this.elements.buttons.joinRoom.addEventListener('click', () => this.showScreen('joinRoomScreen'));
        this.elements.buttons.backToWelcome.addEventListener('click', () => this.showScreen('welcomeScreen'));
        this.elements.buttons.backToWelcomeFromJoin.addEventListener('click', () => this.showScreen('welcomeScreen'));

        // Formularios
        this.elements.forms.createRoom.addEventListener('submit', (e) => this.handleCreateRoom(e));
        this.elements.forms.joinRoom.addEventListener('submit', (e) => this.handleJoinRoom(e));
        this.elements.forms.message.addEventListener('submit', (e) => this.handleSendMessage(e));

        // Botones del chat
        this.elements.buttons.shareRoom.addEventListener('click', () => this.shareRoom());
        this.elements.buttons.leaveRoom.addEventListener('click', () => this.confirmLeaveRoom());
        this.elements.buttons.clearData.addEventListener('click', () => this.confirmClearData());

        // Modal
        this.elements.buttons.copyCode.addEventListener('click', () => this.copyRoomCode());
        this.elements.buttons.startChat.addEventListener('click', () => this.startChat());
        this.elements.buttons.closeModal.addEventListener('click', () => this.hideModal());
        this.elements.buttons.confirm.addEventListener('click', () => this.handleConfirm());
        this.elements.buttons.cancel.addEventListener('click', () => this.hideModal());

        // Input de mensaje
        this.elements.inputs.messageInput.addEventListener('input', () => this.updateCharacterCount());
        this.elements.inputs.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.elements.forms.message.requestSubmit();
            }
        });

        // Limpiar datos automáticamente al cerrar
        window.addEventListener('beforeunload', () => this.cleanup());
        window.addEventListener('unload', () => this.cleanup());
    }

    showScreen(screenId) {
        // Ocultar todas las pantallas
        Object.values(this.elements.screens).forEach(screen => {
            screen.classList.remove('active');
        });

        // Mostrar la pantalla solicitada
        const targetScreen = this.elements.screens[screenId];
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.state.currentScreen = screenId;
        }
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = 'ROOM';
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async handleCreateRoom(e) {
        e.preventDefault();
        
        const creatorName = this.elements.inputs.creatorName.value.trim();
        const initialQuestion = this.elements.inputs.initialQuestion.value.trim();

        if (!creatorName || !initialQuestion) {
            this.showToast('Por favor completa todos los campos', 'error');
            return;
        }

        const roomCode = this.generateRoomCode();
        const now = new Date();
        
        const room = {
            id: roomCode,
            creator: creatorName,
            question: initialQuestion,
            createdAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + this.config.timeLimit).toISOString(),
            messageLimit: this.config.messageLimit,
            messages: []
        };

        await this.saveRoom(room);
        this.state.currentRoom = room;
        this.state.currentUser = { name: creatorName, isCreator: true };

        // Mostrar modal con código
        this.elements.displays.displayRoomCode.textContent = roomCode;
        this.showModal('roomCode');
        this.copyToClipboard(roomCode);
    }

    async handleJoinRoom(e) {
        e.preventDefault();
        
        const roomCode = this.elements.inputs.roomCode.value.trim().toUpperCase();
        
        if (!roomCode) {
            this.showToast('Ingresa un código de sala', 'error');
            return;
        }

        const room = await this.loadRoom(roomCode);
        
        if (!room) {
            this.showToast('Sala no encontrada', 'error');
            return;
        }

        if (this.isRoomExpired(room)) {
            this.showToast('Esta sala ha expirado', 'error');
            return;
        }

        this.state.currentRoom = room;
        this.state.currentUser = { name: 'Anónimo', isCreator: false };
        this.startChat();
    }

    startChat() {
        this.hideModal();
        this.showScreen('chatScreen');
        this.elements.displays.roomCode.textContent = this.state.currentRoom.id;
        this.loadMessages();
        this.startTimers();
        this.setupRealtimeMessaging();
        this.elements.inputs.messageInput.focus();
    }

    async handleSendMessage(e) {
        e.preventDefault();
        
        const messageText = this.elements.inputs.messageInput.value.trim();
        
        if (!messageText) return;

        if (this.state.currentRoom.messages.length >= this.config.messageLimit) {
            this.showToast('Se ha alcanzado el límite de mensajes', 'error');
            return;
        }

        if (this.isRoomExpired(this.state.currentRoom)) {
            this.showToast('La sala ha expirado', 'error');
            return;
        }

        const message = {
            id: Date.now(),
            text: messageText,
            isAnonymous: !this.state.currentUser.isCreator,
            author: this.state.currentUser.isCreator ? this.state.currentUser.name : 'Anónimo',
            timestamp: new Date().toISOString(),
            votes: { likes: 0, dislikes: 0 }
        };

        // Guardar referencia del último mensaje enviado para evitar ecos
        this.lastSentMessage = {
            text: message.text,
            author: message.author,
            timestamp: message.timestamp
        };

        // Enviar mensaje a Supabase
        const savedMessage = await this.sendMessage(this.state.currentRoom.id, message);
        if (savedMessage) {
            // Actualizar el estado local con el mensaje guardado
            this.state.currentRoom.messages.push(savedMessage);
            this.addMessageToChat(savedMessage);
            // Actualizar la referencia con el mensaje guardado
            this.lastSentMessage.id = savedMessage.id;
        } else {
            // Fallback: usar el mensaje original si Supabase falla
            this.state.currentRoom.messages.push(message);
            this.addMessageToChat(message);
        }

        this.elements.inputs.messageInput.value = '';
        this.updateCharacterCount();
        this.updateCounters();

        // Solo el creador puede enviar el primer mensaje no anónimo
        if (this.state.currentUser.isCreator) {
            this.state.currentUser.isCreator = false; // Después del primer mensaje, también es anónimo
        }
    }

    addMessageToChat(message, isRealtime = false) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${!message.isAnonymous ? 'creator-message' : ''}`;
        messageEl.setAttribute('data-message-id', message.id);

        // Agregar clase especial para mensajes en tiempo real
        if (isRealtime) {
            messageEl.classList.add('realtime-message');
        }

        const timeStr = new Date(message.timestamp).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageEl.innerHTML = `
            <div class="message-header">
                <span class="message-author">${message.author}</span>
                <span class="message-time">${timeStr}</span>
                ${isRealtime ? '<span class="realtime-indicator">📡</span>' : ''}
            </div>
            <div class="message-content">${this.escapeHtml(message.text)}</div>
            <div class="message-actions">
                <button class="vote-btn like-btn" data-message-id="${message.id}" data-vote-type="like">
                    👍 <span class="vote-count">${message.votes.likes}</span>
                </button>
                <button class="vote-btn dislike-btn" data-message-id="${message.id}" data-vote-type="dislike">
                    👎 <span class="vote-count">${message.votes.dislikes}</span>
                </button>
            </div>
        `;

        this.elements.displays.chatMessages.appendChild(messageEl);
        
        // Scroll suave para mensajes en tiempo real
        if (isRealtime) {
            // Resaltar brevemente el mensaje nuevo
            setTimeout(() => {
                messageEl.classList.add('message-highlight');
                setTimeout(() => {
                    messageEl.classList.remove('message-highlight', 'realtime-indicator');
                }, 2000);
            }, 100);
        }
        
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'end' });

        // Bind voting events
        const voteButtons = messageEl.querySelectorAll('.vote-btn');
        voteButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleVote(e));
        });
    }

    async handleVote(e) {
        const messageId = parseInt(e.currentTarget.getAttribute('data-message-id'));
        const voteType = e.currentTarget.getAttribute('data-vote-type');
        
        const userVoteKey = `${this.state.currentRoom.id}-${messageId}`;
        const currentVote = this.state.userVotes.get(userVoteKey);

        // Encontrar el mensaje
        const message = this.state.currentRoom.messages.find(m => m.id === messageId);
        if (!message) return;

        // Usar Supabase para gestionar el voto
        if (this.supabaseClient && this.supabaseClient.isSupabaseAvailable()) {
            const result = await this.supabaseClient.voteMessage(messageId, voteType, currentVote);
            if (result.success) {
                // Actualizar estado local basado en el resultado de Supabase
                if (result.removed) {
                    this.state.userVotes.delete(userVoteKey);
                } else if (result.newVote) {
                    this.state.userVotes.set(userVoteKey, result.newVote);
                }
                
                // Recargar la sala para obtener los contadores actualizados
                const updatedRoom = await this.loadRoom(this.state.currentRoom.id);
                if (updatedRoom) {
                    const updatedMessage = updatedRoom.messages.find(m => m.id === messageId);
                    if (updatedMessage) {
                        message.votes = updatedMessage.votes;
                    }
                }
            }
        } else {
            // Fallback: manejo local
            // Remover voto anterior si existe
            if (currentVote) {
                message.votes[currentVote]--;
            }

            // Si es el mismo voto, solo remover
            if (currentVote === voteType) {
                this.state.userVotes.delete(userVoteKey);
            } else {
                // Agregar nuevo voto
                message.votes[voteType]++;
                this.state.userVotes.set(userVoteKey, voteType);
            }
            
            await this.saveRoom(this.state.currentRoom);
        }

        this.updateMessageVoteDisplay(messageId, message.votes);
        this.updateVoteButtonStates(messageId, this.state.userVotes.get(userVoteKey));
    }

    updateMessageVoteDisplay(messageId, votes) {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageEl) return;

        const likeCount = messageEl.querySelector('.like-btn .vote-count');
        const dislikeCount = messageEl.querySelector('.dislike-btn .vote-count');

        if (likeCount) likeCount.textContent = votes.likes;
        if (dislikeCount) dislikeCount.textContent = votes.dislikes;
    }

    updateVoteButtonStates(messageId, userVote) {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageEl) return;

        const likeBtn = messageEl.querySelector('.like-btn');
        const dislikeBtn = messageEl.querySelector('.dislike-btn');

        // Reset states
        likeBtn.classList.remove('voted-like');
        dislikeBtn.classList.remove('voted-dislike');

        // Set current vote state
        if (userVote === 'like') {
            likeBtn.classList.add('voted-like');
        } else if (userVote === 'dislike') {
            dislikeBtn.classList.add('voted-dislike');
        }
    }

    loadMessages() {
        this.elements.displays.chatMessages.innerHTML = '';
        
        if (!this.state.currentRoom.messages.length) {
            this.showEmptyState();
            return;
        }

        this.state.currentRoom.messages.forEach(message => {
            this.addMessageToChat(message);
            
            // Restaurar estado de votos del usuario
            const userVoteKey = `${this.state.currentRoom.id}-${message.id}`;
            const userVote = this.state.userVotes.get(userVoteKey);
            if (userVote) {
                this.updateVoteButtonStates(message.id, userVote);
            }
        });
    }

    showEmptyState() {
        this.elements.displays.chatMessages.innerHTML = `
            <div class="empty-state">
                <h3>¡Bienvenido al chat!</h3>
                <p>Comparte el código <strong>${this.state.currentRoom.id}</strong> para que otros se unan y comenzar la conversación.</p>
            </div>
        `;
    }

    startTimers() {
        this.updateCounters();
        
        // Timer para actualizar contador cada minuto
        const timer = setInterval(() => {
            if (this.isRoomExpired(this.state.currentRoom)) {
                this.showToast('La sala ha expirado', 'error');
                clearInterval(timer);
                return;
            }
            this.updateCounters();
        }, 60000);

        this.state.timers.set(this.state.currentRoom.id, timer);
    }

    updateCounters() {
        if (!this.state.currentRoom) return;

        // Contador de mensajes
        const messageCount = this.state.currentRoom.messages.length;
        const messageLimit = this.config.messageLimit;
        this.elements.displays.messageCounter.textContent = `💬 ${messageCount}/${messageLimit}`;

        // Contador de tiempo
        const now = new Date();
        const expiresAt = new Date(this.state.currentRoom.expiresAt);
        const timeLeft = expiresAt.getTime() - now.getTime();

        if (timeLeft <= 0) {
            this.elements.displays.timeCounter.textContent = '⏱️ Expirado';
            return;
        }

        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        this.elements.displays.timeCounter.textContent = `⏱️ ${hours}:${minutes.toString().padStart(2, '0')}`;
    }

    updateCharacterCount() {
        const text = this.elements.inputs.messageInput.value;
        const count = text.length;
        const limit = 280;
        
        this.elements.displays.characterCount.textContent = `${count}/${limit}`;
        
        // Actualizar clase según límite
        this.elements.displays.characterCount.classList.remove('warning', 'error');
        if (count > limit * 0.8) {
            this.elements.displays.characterCount.classList.add('warning');
        }
        if (count > limit) {
            this.elements.displays.characterCount.classList.add('error');
        }

        // Habilitar/deshabilitar botón de envío
        const sendBtn = this.elements.forms.message.querySelector('.send-btn');
        sendBtn.disabled = count === 0 || count > limit;
    }

    shareRoom() {
        const roomCode = this.state.currentRoom.id;
        const shareText = `¡Únete a mi chat anónimo! Código: ${roomCode}`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Chat Anónimo',
                text: shareText
            });
        } else {
            this.copyToClipboard(shareText);
            this.showToast('Enlace copiado al portapapeles', 'success');
        }
    }

    copyRoomCode() {
        const roomCode = this.elements.displays.displayRoomCode.textContent;
        this.copyToClipboard(roomCode);
        this.showToast('Código copiado', 'success');
    }

    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            // Fallback para navegadores más antiguos
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    }

    confirmLeaveRoom() {
        this.showConfirmModal(
            'Salir de la sala',
            '¿Estás seguro de que quieres salir de la sala?',
            () => this.leaveRoom()
        );
    }

    confirmClearData() {
        this.showConfirmModal(
            'Limpiar datos',
            'Esto eliminará todos los chats guardados. ¿Continuar?',
            () => this.clearAllData()
        );
    }

    leaveRoom() {
        // Limpiar timers
        if (this.state.timers.has(this.state.currentRoom.id)) {
            clearInterval(this.state.timers.get(this.state.currentRoom.id));
            this.state.timers.delete(this.state.currentRoom.id);
        }

        // Limpiar suscripciones de real-time
        this.cleanupRealtimeMessaging();

        this.state.currentRoom = null;
        this.state.currentUser = null;
        this.showScreen('welcomeScreen');
        this.showToast('Has salido de la sala', 'success');
    }

    clearAllData() {
        localStorage.clear();
        this.state.userVotes.clear();
        
        // Limpiar timers
        this.state.timers.forEach(timer => clearInterval(timer));
        this.state.timers.clear();
        
        this.state.currentRoom = null;
        this.state.currentUser = null;
        this.showScreen('welcomeScreen');
        this.showToast('Datos eliminados', 'success');
    }

    showModal(modalType) {
        const modal = this.elements.modals[modalType];
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    hideModal() {
        Object.values(this.elements.modals).forEach(modal => {
            modal.classList.add('hidden');
        });
    }

    showConfirmModal(title, message, confirmCallback) {
        this.elements.modals.confirmTitle.textContent = title;
        this.elements.modals.confirmMessage.textContent = message;
        this.confirmCallback = confirmCallback;
        this.showModal('confirm');
    }

    handleConfirm() {
        if (this.confirmCallback) {
            this.confirmCallback();
            this.confirmCallback = null;
        }
        this.hideModal();
    }

    showToast(message, type = 'info') {
        this.elements.toast.message.textContent = message;
        this.elements.toast.container.className = `toast ${type}`;
        this.elements.toast.container.classList.remove('hidden');
        
        setTimeout(() => {
            this.elements.toast.container.classList.add('hidden');
        }, 3000);
    }

    // Gestión de almacenamiento
    async saveRoom(room) {
        if (this.supabaseClient && this.supabaseClient.isSupabaseAvailable()) {
            try {
                await this.supabaseClient.createRoom(room);
            } catch (error) {
                console.error('Error guardando sala en Supabase:', error);
                // Fallback a localStorage
                localStorage.setItem(`room_${room.id}`, JSON.stringify(room));
            }
        } else {
            // Fallback a localStorage
            localStorage.setItem(`room_${room.id}`, JSON.stringify(room));
        }
        this.saveUserVotes();
    }

    async loadRoom(roomId) {
        if (this.supabaseClient && this.supabaseClient.isSupabaseAvailable()) {
            try {
                const room = await this.supabaseClient.getRoom(roomId);
                if (room) {
                    return room;
                }
            } catch (error) {
                console.error('Error cargando sala de Supabase:', error);
            }
        }
        
        // Fallback a localStorage
        const roomData = localStorage.getItem(`room_${roomId}`);
        return roomData ? JSON.parse(roomData) : null;
    }

    async sendMessage(roomId, message) {
        if (this.supabaseClient && this.supabaseClient.isSupabaseAvailable()) {
            try {
                return await this.supabaseClient.sendMessage(roomId, message);
            } catch (error) {
                console.error('Error enviando mensaje a Supabase:', error);
                return null;
            }
        }
        return null;
    }

    saveUserVotes() {
        const votesData = Object.fromEntries(this.state.userVotes);
        localStorage.setItem('userVotes', JSON.stringify(votesData));
    }

    loadFromStorage() {
        // Cargar votos del usuario
        const votesData = localStorage.getItem('userVotes');
        if (votesData) {
            const votes = JSON.parse(votesData);
            this.state.userVotes = new Map(Object.entries(votes));
        }

        // Limpiar salas expiradas automáticamente
        if (this.config.autoCleanup) {
            this.cleanupExpiredRooms();
        }
    }

    isRoomExpired(room) {
        return new Date() > new Date(room.expiresAt);
    }

    cleanupExpiredRooms() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('room_')) {
                const roomData = localStorage.getItem(key);
                if (roomData) {
                    const room = JSON.parse(roomData);
                    if (this.isRoomExpired(room)) {
                        localStorage.removeItem(key);
                    }
                }
            }
        });
    }

    cleanup() {
        // Limpiar timers al cerrar
        this.state.timers.forEach(timer => clearInterval(timer));
        
        // Limpiar suscripciones de real-time
        this.cleanupRealtimeMessaging();
    }

    // ==================== REAL-TIME MESSAGING ====================

    setupRealtimeMessaging() {
        if (!this.supabaseClient || !this.state.currentRoom) {
            console.warn('No se puede configurar real-time messaging');
            this.updateConnectionStatus('offline', 'Sin conexión');
            return;
        }

        const roomId = this.state.currentRoom.id;
        console.log(`Configurando real-time messaging para sala: ${roomId}`);

        // Determinar estado de conexión inicial
        if (this.supabaseClient.isSupabaseAvailable()) {
            this.updateConnectionStatus('online', 'Tiempo Real');
        } else {
            this.updateConnectionStatus('offline', 'Modo Local');
        }

        // Suscribirse a mensajes nuevos
        this.supabaseClient.subscribeToRoomMessages(roomId, (newMessage) => {
            this.handleNewRealtimeMessage(newMessage);
        });
    }

    handleNewRealtimeMessage(message) {
        // Verificar que no es un mensaje duplicado
        const existingMessage = this.state.currentRoom.messages.find(m => m.id === message.id);
        if (existingMessage) {
            console.log('Mensaje duplicado ignorado:', message.id);
            return;
        }

        // Verificar que el mensaje no es del usuario actual (evitar eco)
        // Para esto comparamos el timestamp - si es muy reciente probablemente lo envió este usuario
        const messageTime = new Date(message.timestamp);
        const now = new Date();
        const timeDiff = now - messageTime;
        
        // Si el mensaje es de menos de 1 segundo, verificar si coincide con el último mensaje enviado
        if (timeDiff < 1000 && this.lastSentMessage && 
            this.lastSentMessage.text === message.text && 
            this.lastSentMessage.author === message.author) {
            console.log('Evitando eco del propio mensaje');
            return;
        }

        console.log('Agregando mensaje en tiempo real:', message);

        // Agregar mensaje al estado y a la interfaz
        this.state.currentRoom.messages.push(message);
        this.addMessageToChat(message, true); // true = es mensaje en tiempo real

        // Actualizar contador de mensajes
        this.updateCounters();

        // Mostrar notificación si no está en foco
        if (!document.hasFocus()) {
            this.showToast(`Nuevo mensaje de ${message.author}`, 'info');
        }

        // Guardar estado actualizado
        this.saveRoom(this.state.currentRoom);
    }

    cleanupRealtimeMessaging() {
        if (this.supabaseClient && this.state.currentRoom) {
            this.supabaseClient.unsubscribeFromRoom(this.state.currentRoom.id);
            console.log('Real-time messaging limpiado');
        }
    }

    updateConnectionStatus(status, text) {
        if (!this.elements.displays.connectionStatus || !this.elements.displays.connectionText) {
            return;
        }

        // Remover clases anteriores
        this.elements.displays.connectionStatus.classList.remove('online', 'offline');
        
        // Agregar nueva clase
        this.elements.displays.connectionStatus.classList.add(status);
        
        // Actualizar texto
        this.elements.displays.connectionText.textContent = text;
        
        console.log(`Estado de conexión actualizado: ${status} - ${text}`);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new AnonymousChatApp();
});