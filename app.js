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
            timers: new Map(),
            messageStates: new Map(), // Para rastrear estados de mensajes (enviando, enviado, entregado)
            typingIndicator: {
                isTyping: false,
                timeout: null,
                lastActivity: null
            }
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
        
        // Inicializar cliente de Supabase y esperar a que esté listo
        if (typeof SupabaseClient !== 'undefined') {
            this.supabaseClient = new SupabaseClient();
            // Dar tiempo para que se inicialice
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        this.loadFromStorage();
        
        // Intentar restaurar sesión previa
        const sessionRestored = await this.restoreSession();
        if (sessionRestored) {
            // Si se restauró la sesión, ir directamente al chat
            this.startChat();
            // Mostrar notificación de sesión restaurada
            setTimeout(() => {
                this.showToast(`Sesión restaurada: ${this.state.currentRoom.id}`, 'success');
            }, 1000);
        } else {
            // Si no hay sesión, mostrar pantalla de bienvenida
            this.showScreen('welcomeScreen');
        }
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
        this.elements.inputs.messageInput.addEventListener('input', () => {
            this.updateCharacterCount();
            this.handleTypingActivity();
        });
        this.elements.inputs.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.elements.forms.message.requestSubmit();
            }
        });
        
        // Detener typing indicator cuando se pierde el focus
        this.elements.inputs.messageInput.addEventListener('blur', () => {
            this.stopTypingIndicator();
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

        // Guardar sesión
        this.saveCurrentSession();

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
        
        // Guardar sesión
        this.saveCurrentSession();
        
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

        // Notificar actividad al sistema de polling adaptativo
        if (this.supabaseClient && this.supabaseClient.notifyRoomActivity) {
            this.supabaseClient.notifyRoomActivity(this.state.currentRoom.id);
        }

        // Marcar mensaje como 'enviando'
        const tempMessageId = `temp_${Date.now()}`;
        this.setMessageState(tempMessageId, 'sending');
        this.showMessageState(tempMessageId, 'Enviando...');

        // Enviar mensaje a Supabase
        const savedMessage = await this.sendMessage(this.state.currentRoom.id, message);
        if (savedMessage) {
            // Marcar como enviado exitosamente
            this.setMessageState(tempMessageId, 'sent');
            this.showMessageState(tempMessageId, 'Enviado', 2000);
            
            // Actualizar el estado local con el mensaje guardado
            this.state.currentRoom.messages.push(savedMessage);
            this.addMessageToChat(savedMessage);
            // Actualizar la referencia con el mensaje guardado
            this.lastSentMessage.id = savedMessage.id;
            
            // Marcar como entregado después de un breve delay
            setTimeout(() => {
                this.setMessageState(savedMessage.id, 'delivered');
            }, 1000);
        } else {
            // Marcar como error si falla
            this.setMessageState(tempMessageId, 'error');
            this.showMessageState(tempMessageId, 'Error al enviar', 5000);
            
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

        // Actualizar sesión guardada
        this.saveCurrentSession();
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
        const counterTimer = setInterval(() => {
            if (this.isRoomExpired(this.state.currentRoom)) {
                this.showToast('La sala ha expirado', 'error');
                clearInterval(counterTimer);
                return;
            }
            this.updateCounters();
        }, 60000);

        // Timer para limpiar estados de mensajes cada 30 segundos
        const cleanupTimer = setInterval(() => {
            this.cleanupMessageStates();
        }, 30000);

        this.state.timers.set(this.state.currentRoom.id, counterTimer);
        this.state.timers.set(`${this.state.currentRoom.id}_cleanup`, cleanupTimer);
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

        // Limpiar estados de UX
        this.stopTypingIndicator();
        this.state.messageStates.clear();
        
        // Optimización final al salir
        this.optimizeDOM();

        // Limpiar sesión guardada
        this.clearCurrentSession();

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
        
        // Limpiar suscripciones de real-time
        this.cleanupRealtimeMessaging();

        // Limpiar estados de UX
        this.stopTypingIndicator();
        this.state.messageStates.clear();
        
        // Limpiar sesión guardada
        this.clearCurrentSession();
        
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
        
        // Guardar sesión actual para persistencia
        this.saveCurrentSession();
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

    // ==================== GESTIÓN DE SESIÓN ====================

    saveCurrentSession() {
        if (!this.state.currentRoom || !this.state.currentUser) {
            // No hay sesión activa para guardar
            localStorage.removeItem('currentSession');
            return;
        }

        const sessionData = {
            roomId: this.state.currentRoom.id,
            user: {
                name: this.state.currentUser.name,
                isCreator: this.state.currentUser.isCreator
            },
            timestamp: new Date().toISOString()
        };

        localStorage.setItem('currentSession', JSON.stringify(sessionData));
        console.log('Sesión guardada:', sessionData);
    }

    async restoreSession() {
        const sessionData = localStorage.getItem('currentSession');
        if (!sessionData) {
            console.log('No hay sesión guardada para restaurar');
            return false;
        }

        try {
            const session = JSON.parse(sessionData);
            console.log('Intentando restaurar sesión:', session);

            // Verificar que la sesión no sea muy antigua (más de 24 horas)
            const sessionTime = new Date(session.timestamp);
            const now = new Date();
            const timeDiff = now - sessionTime;
            const maxSessionTime = 24 * 60 * 60 * 1000; // 24 horas

            if (timeDiff > maxSessionTime) {
                console.log('Sesión expirada, eliminando');
                localStorage.removeItem('currentSession');
                return false;
            }

            // Cargar la sala
            const room = await this.loadRoom(session.roomId);
            if (!room) {
                console.log('Sala no encontrada, eliminando sesión');
                localStorage.removeItem('currentSession');
                return false;
            }

            // Verificar que la sala no haya expirado
            if (this.isRoomExpired(room)) {
                console.log('Sala expirada, eliminando sesión');
                localStorage.removeItem('currentSession');
                return false;
            }

            // Restaurar estado
            this.state.currentRoom = room;
            this.state.currentUser = session.user;

            console.log('Sesión restaurada exitosamente');
            return true;

        } catch (error) {
            console.error('Error restaurando sesión:', error);
            localStorage.removeItem('currentSession');
            return false;
        }
    }

    clearCurrentSession() {
        localStorage.removeItem('currentSession');
        console.log('Sesión actual eliminada');
    }

    cleanup() {
        // Limpiar timers al cerrar
        this.state.timers.forEach(timer => clearInterval(timer));
        
        // Limpiar suscripciones de real-time
        this.cleanupRealtimeMessaging();
        
        // Limpiar estados de UX
        this.stopTypingIndicator();
        this.state.messageStates.clear();
        
        // Optimización final
        this.optimizeDOM();
        
        console.log('🧽 Cleanup completo ejecutado');
    }

    // ==================== REAL-TIME MESSAGING ====================

    setupRealtimeMessaging() {
        if (!this.state.currentRoom) {
            console.warn('No hay sala actual para configurar real-time messaging');
            this.updateConnectionStatus('offline', 'Sin sala');
            return;
        }

        if (!this.supabaseClient) {
            console.warn('SupabaseClient no está disponible, usando modo local');
            this.updateConnectionStatus('offline', 'Modo Local');
            return;
        }

        const roomId = this.state.currentRoom.id;
        console.log(`Configurando real-time messaging para sala: ${roomId}`);

        // Determinar estado de conexión inicial
        if (this.supabaseClient.isSupabaseAvailable()) {
            this.updateConnectionStatus('online', 'Tiempo Real');
            console.log('Configurando Supabase real-time para sala:', roomId);
        } else {
            this.updateConnectionStatus('offline', 'Modo Local');
            console.log('Configurando polling local para sala:', roomId);
        }

        // Suscribirse a mensajes nuevos
        try {
            this.supabaseClient.subscribeToRoomMessages(roomId, (newMessage) => {
                this.handleNewRealtimeMessage(newMessage);
            });
        } catch (error) {
            console.error('Error configurando real-time messaging:', error);
            this.updateConnectionStatus('offline', 'Error Conexión');
        }
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

        // Notificar actividad al sistema de polling adaptativo
        if (this.supabaseClient && this.supabaseClient.notifyRoomActivity) {
            this.supabaseClient.notifyRoomActivity(this.state.currentRoom.id);
        }

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
        
        // Actualizar sesión guardada
        this.saveCurrentSession();
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
        this.elements.displays.connectionStatus.classList.remove('online', 'offline', 'reconnecting');
        
        // Agregar nueva clase
        this.elements.displays.connectionStatus.classList.add(status);
        
        // Actualizar texto
        this.elements.displays.connectionText.textContent = text;
        
        console.log(`Estado de conexión actualizado: ${status} - ${text}`);
    }

    // Nuevas funciones de estado mejoradas
    updateConnectionStatusEnhanced(status, details = {}) {
        const statusMap = {
            'online': { text: 'Tiempo Real', icon: '🟢' },
            'offline': { text: 'Modo Local', icon: '🔴' },
            'reconnecting': { text: 'Reconectando...', icon: '🟡' },
            'error': { text: 'Error Conexión', icon: '⚠️' }
        };
        
        const config = statusMap[status] || statusMap['offline'];
        let displayText = config.text;
        
        // Agregar detalles adicionales si están disponibles
        if (details.attempt && status === 'reconnecting') {
            displayText = `Reconectando... (${details.attempt}/${details.maxAttempts})`;
        }
        
        this.updateConnectionStatus(status, displayText);
        
        // Mostrar toast para cambios importantes
        if (status === 'online' && details.wasReconnecting) {
            this.showToast('✅ Conexión restaurada', 'success');
        } else if (status === 'offline' && details.wasOnline) {
            this.showToast('⚠️ Usando modo local', 'warning');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==================== MESSAGE STATES & TYPING INDICATORS ====================

    // Establecer estado de un mensaje
    setMessageState(messageId, state) {
        this.state.messageStates.set(messageId, {
            state: state, // 'sending', 'sent', 'delivered', 'error'
            timestamp: Date.now()
        });
        console.log(`Mensaje ${messageId}: ${state}`);
    }

    // Mostrar estado visual del mensaje
    showMessageState(messageId, text, duration = 3000) {
        // Crear o actualizar elemento de estado
        let stateElement = document.getElementById(`message-state-${messageId}`);
        
        if (!stateElement) {
            stateElement = document.createElement('div');
            stateElement.id = `message-state-${messageId}`;
            stateElement.className = 'message-state-indicator';
            
            // Insertar al final del chat
            this.elements.displays.chatMessages.appendChild(stateElement);
        }
        
        stateElement.textContent = text;
        stateElement.style.display = 'block';
        
        // Auto-hide después del duration
        if (duration > 0) {
            setTimeout(() => {
                if (stateElement && stateElement.parentNode) {
                    stateElement.style.display = 'none';
                }
            }, duration);
        }
    }

    // Manejar actividad de escritura
    handleTypingActivity() {
        const now = Date.now();
        this.state.typingIndicator.lastActivity = now;
        
        // Si no está escribiendo, mostrar indicador
        if (!this.state.typingIndicator.isTyping) {
            this.showTypingIndicator();
        }
        
        // Reset del timeout
        if (this.state.typingIndicator.timeout) {
            clearTimeout(this.state.typingIndicator.timeout);
        }
        
        // Ocultar después de 2 segundos de inactividad
        this.state.typingIndicator.timeout = setTimeout(() => {
            this.stopTypingIndicator();
        }, 2000);
    }

    // Mostrar indicador de escritura
    showTypingIndicator() {
        if (this.state.typingIndicator.isTyping) return;
        
        this.state.typingIndicator.isTyping = true;
        
        // Crear elemento de typing indicator si no existe
        let typingElement = document.getElementById('typing-indicator');
        if (!typingElement) {
            typingElement = document.createElement('div');
            typingElement.id = 'typing-indicator';
            typingElement.className = 'typing-indicator';
            typingElement.innerHTML = `
                <div class="typing-content">
                    <span class="typing-text">Escribiendo</span>
                    <div class="typing-dots">
                        <span class="dot"></span>
                        <span class="dot"></span>
                        <span class="dot"></span>
                    </div>
                </div>
            `;
            this.elements.displays.chatMessages.appendChild(typingElement);
        }
        
        typingElement.style.display = 'block';
        typingElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
        
        console.log('✍️ Mostrando indicador de escritura');
    }

    // Ocultar indicador de escritura
    stopTypingIndicator() {
        if (!this.state.typingIndicator.isTyping) return;
        
        this.state.typingIndicator.isTyping = false;
        
        const typingElement = document.getElementById('typing-indicator');
        if (typingElement) {
            typingElement.style.display = 'none';
        }
        
        if (this.state.typingIndicator.timeout) {
            clearTimeout(this.state.typingIndicator.timeout);
            this.state.typingIndicator.timeout = null;
        }
        
        console.log('✒️ Ocultando indicador de escritura');
    }

    // Limpiar estados de mensajes antiguos (llamar periódicamente)
    cleanupMessageStates() {
        const now = Date.now();
        const maxAge = 60000; // 1 minuto
        
        for (const [messageId, stateData] of this.state.messageStates.entries()) {
            if (now - stateData.timestamp > maxAge) {
                this.state.messageStates.delete(messageId);
                
                // Limpiar elemento visual si existe
                const element = document.getElementById(`message-state-${messageId}`);
                if (element && element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            }
        }
    }

    // ==================== DEBUGGING TOOLS ====================

    // Obtener estado del polling para debugging
    getPollingDebugInfo() {
        if (!this.supabaseClient) {
            return 'No hay cliente de Supabase disponible';
        }

        const debugInfo = {
            networkStatus: navigator.onLine,
            supabaseAvailable: this.supabaseClient.isSupabaseAvailable(),
            pageVisible: !document.hidden
        };

        // Estado de reconexión
        if (this.supabaseClient.getReconnectionState) {
            const reconnectionState = this.supabaseClient.getReconnectionState();
            debugInfo.reconnection = {
                isReconnecting: reconnectionState.isReconnecting,
                attempts: reconnectionState.reconnectAttempts,
                maxAttempts: reconnectionState.maxReconnectAttempts,
                lastHeartbeat: reconnectionState.timeSinceLastHeartbeat ? 
                    Math.round(reconnectionState.timeSinceLastHeartbeat / 1000) + 's ago' : 'never'
            };
        }

        // Estado de polling si hay sala activa
        if (this.state.currentRoom) {
            debugInfo.room = {
                id: this.state.currentRoom.id,
                messagesCount: this.state.currentRoom.messages.length
            };

            const pollingState = this.supabaseClient.getPollingState(this.state.currentRoom.id);
            if (pollingState) {
                const timeSinceActivity = Date.now() - pollingState.lastActivityTime;
                debugInfo.polling = {
                    currentInterval: pollingState.currentInterval + 'ms',
                    timeSinceLastActivity: Math.round(timeSinceActivity / 1000) + 's',
                    consecutiveEmptyPolls: pollingState.consecutiveEmptyPolls,
                    knownMessagesCount: pollingState.knownMessageIds.size,
                    isActive: pollingState.isActive
                };
            } else {
                debugInfo.polling = 'No hay estado de polling';
            }
        } else {
            debugInfo.room = 'No hay sala activa';
        }
        
        return debugInfo;
    }

    // Función para testing manual del sistema completo
    testPollingSystem() {
        console.log('=== TESTING SISTEMA DE CHAT FLUIDO ===');
        console.log('Estado actual:', this.getPollingDebugInfo());
        
        // Simular actividad
        if (this.supabaseClient && this.state.currentRoom) {
            console.log('Simulando actividad en la sala...');
            this.supabaseClient.notifyRoomActivity(this.state.currentRoom.id);
            
            setTimeout(() => {
                console.log('Estado después de simular actividad:', this.getPollingDebugInfo());
            }, 1000);
        }
        
        // Testing de reconexión si está disponible
        if (this.supabaseClient && this.supabaseClient.startReconnectionProcess) {
            console.log('Para probar reconexión: testReconnection()');
        }
    }

    // Función para testing manual de reconexión
    testReconnectionSystem() {
        if (!this.supabaseClient) {
            console.log('No hay cliente de Supabase para probar reconexión');
            return;
        }
        
        console.log('=== TESTING SISTEMA DE RECONEXIÓN ===');
        console.log('Estado antes:', this.supabaseClient.getReconnectionState());
        
        // Simular pérdida y recuperación de conexión
        console.log('Simulando pérdida de conexión...');
        this.supabaseClient.handleNetworkChange(false);
        
        setTimeout(() => {
            console.log('Simulando recuperación de conexión...');
            this.supabaseClient.handleNetworkChange(true);
        }, 2000);
    }

    // ==================== EDGE CASE TESTING SUITE ====================

    // Test comprehensivo de casos edge
    runEdgeCaseTests() {
        console.log('🧪 === INICIANDO TESTS DE CASOS EDGE ===');
        
        const tests = [
            () => this.testMultipleTabsScenario(),
            () => this.testNetworkInterruption(),
            () => this.testRapidMessaging(),
            () => this.testSessionPersistence(),
            () => this.testPollingUnderLoad(),
            () => this.testHeartbeatFailure(),
            () => this.testMemoryLeaks()
        ];
        
        let testIndex = 0;
        const runNextTest = () => {
            if (testIndex < tests.length) {
                console.log(`📋 Test ${testIndex + 1}/${tests.length} iniciando...`);
                tests[testIndex]();
                testIndex++;
                setTimeout(runNextTest, 5000); // 5 segundos entre tests
            } else {
                console.log('✅ === TODOS LOS TESTS COMPLETADOS ===');
                this.generatePerformanceReport();
            }
        };
        
        runNextTest();
    }

    // Test: Múltiples pestañas
    testMultipleTabsScenario() {
        console.log('📋 Test: Múltiples pestañas');
        
        // Simular otra pestaña enviando mensajes
        if (this.state.currentRoom) {
            const mockMessage = {
                id: Date.now() + Math.random(),
                text: `Mensaje desde otra pestaña - Test ${Date.now()}`,
                isAnonymous: true,
                author: 'Anónimo',
                timestamp: new Date().toISOString(),
                votes: { likes: 0, dislikes: 0 }
            };
            
            // Simular mensaje externo
            setTimeout(() => {
                this.handleNewRealtimeMessage(mockMessage);
                console.log('✅ Test múltiples pestañas: Mensaje externo procesado');
            }, 1000);
        }
    }

    // Test: Interrupción de red
    testNetworkInterruption() {
        console.log('📋 Test: Interrupción de red');
        
        // Simular caída y recuperación de red
        if (this.supabaseClient) {
            this.supabaseClient.handleNetworkChange(false);
            
            setTimeout(() => {
                this.supabaseClient.handleNetworkChange(true);
                console.log('✅ Test interrupción de red: Ciclo completo');
            }, 3000);
        }
    }

    // Test: Mensajería rápida
    testRapidMessaging() {
        console.log('📋 Test: Mensajería rápida');
        
        if (!this.state.currentRoom) {
            console.log('⚠️ Test saltado: No hay sala activa');
            return;
        }
        
        // Enviar múltiples mensajes rápidamente
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const mockMessage = {
                    id: Date.now() + i,
                    text: `Mensaje rápido ${i + 1}/5`,
                    isAnonymous: true,
                    author: 'Test',
                    timestamp: new Date().toISOString(),
                    votes: { likes: 0, dislikes: 0 }
                };
                this.handleNewRealtimeMessage(mockMessage);
            }, i * 200); // 200ms entre mensajes
        }
        
        setTimeout(() => {
            console.log('✅ Test mensajería rápida: Completado');
        }, 1500);
    }

    // Test: Persistencia de sesión
    testSessionPersistence() {
        console.log('📋 Test: Persistencia de sesión');
        
        const sessionData = localStorage.getItem('currentSession');
        if (sessionData) {
            try {
                const session = JSON.parse(sessionData);
                const sessionAge = Date.now() - new Date(session.timestamp).getTime();
                console.log(`✅ Sesión encontrada, edad: ${Math.round(sessionAge/1000)}s`);
            } catch (error) {
                console.error('❌ Error parsing session:', error);
            }
        } else {
            console.log('⚠️ No hay sesión guardada');
        }
    }

    // Test: Polling bajo carga
    testPollingUnderLoad() {
        console.log('📋 Test: Polling bajo carga');
        
        if (this.supabaseClient && this.state.currentRoom) {
            // Simular actividad intensa
            for (let i = 0; i < 10; i++) {
                setTimeout(() => {
                    this.supabaseClient.notifyRoomActivity(this.state.currentRoom.id);
                }, i * 100);
            }
            
            setTimeout(() => {
                const pollingState = this.supabaseClient.getPollingState(this.state.currentRoom.id);
                console.log('✅ Test polling bajo carga:', pollingState?.currentInterval + 'ms');
            }, 2000);
        }
    }

    // Test: Falla de heartbeat
    testHeartbeatFailure() {
        console.log('📋 Test: Falla de heartbeat');
        
        if (this.supabaseClient && this.supabaseClient.handleHeartbeatFailure) {
            // Simular falla de heartbeat
            this.supabaseClient.handleHeartbeatFailure();
            console.log('✅ Test heartbeat failure: Simulado');
        }
    }

    // Test: Memory leaks
    testMemoryLeaks() {
        console.log('📋 Test: Memory leaks');
        
        const before = {
            timers: this.state.timers.size,
            messageStates: this.state.messageStates.size,
            userVotes: this.state.userVotes.size
        };
        
        // Limpiar estados
        this.cleanupMessageStates();
        
        const after = {
            timers: this.state.timers.size,
            messageStates: this.state.messageStates.size,
            userVotes: this.state.userVotes.size
        };
        
        console.log('✅ Test memory leaks - Before:', before, 'After:', after);
    }

    // Generar reporte de performance
    generatePerformanceReport() {
        console.log('📈 === REPORTE DE PERFORMANCE ===');
        
        const report = {
            timestamp: new Date().toISOString(),
            system: {
                userAgent: navigator.userAgent,
                online: navigator.onLine,
                memory: performance.memory ? {
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB',
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
                } : 'No disponible'
            },
            app: this.getPollingDebugInfo(),
            localStorage: {
                usage: this.calculateLocalStorageUsage() + 'KB',
                items: Object.keys(localStorage).length
            },
            recommendations: this.generateOptimizationRecommendations()
        };
        
        console.log('📈 Reporte completo:', report);
        return report;
    }

    // Calcular uso de localStorage
    calculateLocalStorageUsage() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length + key.length;
            }
        }
        return Math.round(total / 1024 * 100) / 100; // KB con 2 decimales
    }

    // Generar recomendaciones de optimización
    generateOptimizationRecommendations() {
        const recommendations = [];
        
        if (this.state.messageStates.size > 50) {
            recommendations.push('Considerar aumentar frecuencia de limpieza de estados');
        }
        
        if (this.calculateLocalStorageUsage() > 1000) {
            recommendations.push('localStorage > 1MB - considerar limpieza');
        }
        
        if (this.state.timers.size > 10) {
            recommendations.push('Múltiples timers activos - revisar cleanup');
        }
        
        return recommendations.length > 0 ? recommendations : ['Sistema optimizado correctamente'];
    }

    // ==================== OPTIMIZACIONES FINALES ====================

    // Optimización de DOM - Eliminar elementos innecesarios
    optimizeDOM() {
        // Remover indicadores viejos que puedan haber quedado
        const oldIndicators = document.querySelectorAll('.message-state-indicator[style*="display: none"]');
        oldIndicators.forEach(el => {
            if (el.parentNode) el.parentNode.removeChild(el);
        });
        
        // Remover typing indicators duplicados (edge case)
        const typingIndicators = document.querySelectorAll('.typing-indicator');
        if (typingIndicators.length > 1) {
            for (let i = 1; i < typingIndicators.length; i++) {
                if (typingIndicators[i].parentNode) {
                    typingIndicators[i].parentNode.removeChild(typingIndicators[i]);
                }
            }
        }
        
        console.log('🧽 DOM optimizado - elementos innecesarios removidos');
    }

    // Optimización de eventos - Prevenir memory leaks
    optimizeEventListeners() {
        // Verificar que no hay listeners duplicados
        const messageInput = this.elements.inputs.messageInput;
        if (messageInput) {
            // Clonar elemento para remover todos los listeners
            const newInput = messageInput.cloneNode(true);
            messageInput.parentNode.replaceChild(newInput, messageInput);
            this.elements.inputs.messageInput = newInput;
            
            // Re-bind solo los listeners necesarios
            newInput.addEventListener('input', () => {
                this.updateCharacterCount();
                this.handleTypingActivity();
            });
            
            newInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.elements.forms.message.requestSubmit();
                }
            });
            
            newInput.addEventListener('blur', () => {
                this.stopTypingIndicator();
            });
            
            console.log('🎯 Event listeners optimizados');
        }
    }

    // Optimización completa del sistema
    performFullOptimization() {
        console.log('🚀 === INICIANDO OPTIMIZACIÓN COMPLETA ===');
        
        // Limpiezas
        this.cleanupMessageStates();
        this.optimizeDOM();
        
        // Optimizaciones de memoria
        this.optimizeEventListeners();
        
        // Forzar garbage collection si está disponible
        if (window.gc) {
            window.gc();
            console.log('🗑️ Garbage collection ejecutado');
        }
        
        // Generar reporte post-optimización
        setTimeout(() => {
            const report = this.generatePerformanceReport();
            console.log('✅ === OPTIMIZACIÓN COMPLETADA ===');
            console.log('Recomendaciones post-optimización:', report.recommendations);
        }, 1000);
    }
}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new AnonymousChatApp();
    
    // Funciones de debugging globales para testing
    window.debugPolling = () => {
        if (window.chatApp) {
            console.log('Estado del polling:', window.chatApp.getPollingDebugInfo());
        }
    };
    
    window.testPolling = () => {
        if (window.chatApp) {
            window.chatApp.testPollingSystem();
        }
    };
    
    window.testReconnection = () => {
        if (window.chatApp) {
            window.chatApp.testReconnectionSystem();
        }
    };
    
    window.runEdgeTests = () => {
        if (window.chatApp) {
            window.chatApp.runEdgeCaseTests();
        }
    };
    
    window.performanceReport = () => {
        if (window.chatApp) {
            return window.chatApp.generatePerformanceReport();
        }
    };
    
    // Mostrar información de debugging cada 15 segundos en modo desarrollo
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        setInterval(() => {
            if (window.chatApp) {
                const debugInfo = window.chatApp.getPollingDebugInfo();
                if (debugInfo.room !== 'No hay sala activa') {
                    console.log('🔄 Debug Sistema:', debugInfo);
                }
            }
        }, 15000); // Cada 15 segundos para no saturar la consola
    }
    
    // Información de comandos disponibles
    console.log('🔧 === COMANDOS DE DEBUGGING DISPONIBLES ===');
    console.log('🔍 ESTADO:');
    console.log('- debugPolling(): Ver estado actual completo del sistema');
    console.log('- performanceReport(): Generar reporte de performance detallado');
    console.log('');
    console.log('🧪 TESTS INDIVIDUALES:');
    console.log('- testPolling(): Probar sistema de polling adaptativo');
    console.log('- testReconnection(): Probar sistema de reconexión automática');
    console.log('');
    console.log('🚀 TESTS AVANZADOS:');
    console.log('- runEdgeTests(): Ejecutar suite completa de tests de casos edge');
    console.log('');
    console.log('⚙️ AUTO-DEBUG:');
    console.log('- Auto-debug activado cada 15s en localhost');
    console.log('- Limpieza automática de estados cada 30s');
    console.log('');
    console.log('🎉 === SISTEMA DE FLUIDEZ CONVERSACIONAL v3.0 ===');
    console.log('✅ Polling Adaptativo | ✅ Reconexión Auto | ✅ UX Indicators | ✅ Edge Testing');
    console.log('🚀 ¡LISTO PARA CONVERSACIONES ULTRA-FLUIDAS!');
});