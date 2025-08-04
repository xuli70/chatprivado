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
            isAdmin: false, // Sistema administrador incógnito
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
            joinRoomScreen: document.getElementById('joinRoomScreen'),
            chatScreen: document.getElementById('chatScreen')
        };

        // Botones principales
        this.elements.buttons = {
            joinRoom: document.getElementById('joinRoomBtn'),
            backToWelcome: document.getElementById('backToWelcome'),
            backToWelcomeFromJoin: document.getElementById('backToWelcomeFromJoin'),
            shareRoom: document.getElementById('shareRoomBtn'),
            refreshRoom: document.getElementById('refreshRoomBtn'),
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
            joinRoom: document.getElementById('joinRoomForm'),
            message: document.getElementById('messageForm')
        };

        // Inputs
        this.elements.inputs = {
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
        this.elements.buttons.joinRoom.addEventListener('click', () => this.showScreen('joinRoomScreen'));
        this.elements.buttons.backToWelcome.addEventListener('click', () => this.showScreen('welcomeScreen'));
        this.elements.buttons.backToWelcomeFromJoin.addEventListener('click', () => this.showScreen('welcomeScreen'));

        // Formularios
        this.elements.forms.joinRoom.addEventListener('submit', (e) => this.handleJoinRoom(e));
        this.elements.forms.message.addEventListener('submit', (e) => this.handleSendMessage(e));

        // Botones del chat
        this.elements.buttons.shareRoom.addEventListener('click', () => this.shareRoom());
        this.elements.buttons.refreshRoom.addEventListener('click', () => this.refreshRoom());
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

        // 🔐 SISTEMA ADMINISTRADOR INCÓGNITO - Detectar password admin
        const adminPassword = window.env?.ADMIN_PASSWORD || 'ADMIN2025';
        
        if (roomCode === adminPassword) {
            console.log('🔑 Acceso de administrador detectado');
            this.state.isAdmin = true;
            this.showAdminPanel();
            return;
        }

        // 📝 Flujo normal - Unirse a sala existente
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

    // 🔐 SISTEMA ADMINISTRADOR INCÓGNITO - Panel dinámico
    showAdminPanel() {
        console.log('🛠️ Mostrando panel de administrador');
        
        // Limpiar el campo de entrada
        this.elements.inputs.roomCode.value = '';
        
        // Transformar la pantalla joinRoomScreen en Admin Panel
        const joinScreen = this.elements.screens.joinRoomScreen;
        const container = joinScreen.querySelector('.container');
        
        // Generar HTML del Admin Panel dinámicamente
        container.innerHTML = `
            <div class="screen-header">
                <button id="backToWelcomeFromAdmin" class="btn-back">← Volver</button>
                <h2>🔑 Panel Administrador</h2>
            </div>

            <div class="admin-panel">
                <div class="admin-actions">
                    <button id="adminCreateRoom" class="btn btn--primary btn--lg btn--full-width">
                        ➕ Crear Nueva Sala
                    </button>
                    <button id="adminListRooms" class="btn btn--outline btn--lg btn--full-width">
                        📋 Ver Salas Existentes
                    </button>
                    <button id="adminStats" class="btn btn--outline btn--lg btn--full-width">
                        📊 Estadísticas del Sistema
                    </button>
                </div>
                
                <div class="admin-info">
                    <p><small>🔒 Modo Administrador Activo</small></p>
                    <p><small>Funciones especiales: Crear salas, gestionar contenido, modo incógnito</small></p>
                </div>
            </div>
        `;
        
        // Configurar eventos del Admin Panel
        this.setupAdminPanelEvents();
        
        // Mostrar la pantalla
        this.showScreen('joinRoomScreen');
        this.showToast('Acceso de administrador concedido', 'success');
    }

    // 🔧 Configurar eventos del Admin Panel
    setupAdminPanelEvents() {
        // Botón volver
        const backBtn = document.getElementById('backToWelcomeFromAdmin');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.state.isAdmin = false; // Salir del modo admin
                this.restoreJoinRoomScreen(); // Restaurar pantalla original
                this.showScreen('welcomeScreen');
            });
        }

        // Botones de funciones admin
        const createBtn = document.getElementById('adminCreateRoom');
        const listBtn = document.getElementById('adminListRooms');
        const statsBtn = document.getElementById('adminStats');

        if (createBtn) createBtn.addEventListener('click', () => this.adminCreateRoom());
        if (listBtn) listBtn.addEventListener('click', () => this.adminListRooms());
        if (statsBtn) statsBtn.addEventListener('click', () => this.adminShowStats());
    }

    // 🔄 Restaurar pantalla original de Join Room
    restoreJoinRoomScreen() {
        const joinScreen = this.elements.screens.joinRoomScreen;
        const container = joinScreen.querySelector('.container');
        
        // Restaurar HTML original
        container.innerHTML = `
            <div class="screen-header">
                <button id="backToWelcomeFromJoin" class="btn-back">← Volver</button>
                <h2>Unirse a Sala</h2>
            </div>

            <form id="joinRoomForm" class="form">
                <div class="form-group">
                    <label for="roomCode" class="form-label">Código de sala</label>
                    <input type="text" id="roomCode" class="form-control" placeholder="Ej: ROOM123" maxlength="10" required>
                </div>

                <button type="submit" class="btn btn--primary btn--lg btn--full-width">
                    Unirse a Sala
                </button>
            </form>
        `;
        
        // Restaurar referencias de elementos
        this.elements.inputs.roomCode = document.getElementById('roomCode');
        this.elements.forms.joinRoom = document.getElementById('joinRoomForm');
        
        // Restaurar eventos
        this.elements.buttons.backToWelcomeFromJoin = document.getElementById('backToWelcomeFromJoin');
        if (this.elements.buttons.backToWelcomeFromJoin) {
            this.elements.buttons.backToWelcomeFromJoin.addEventListener('click', () => this.showScreen('welcomeScreen'));
        }
        if (this.elements.forms.joinRoom) {
            this.elements.forms.joinRoom.addEventListener('submit', (e) => this.handleJoinRoom(e));
        }
    }

    // 🏗️ FUNCIONES ADMINISTRADOR - Crear sala
    adminCreateRoom() {
        console.log('🏗️ Admin: Crear nueva sala');
        
        // Usar el modal de confirmación para crear sala
        this.showConfirmModal(
            '➕ Crear Nueva Sala',
            '¿Crear una sala de administrador? Podrás aparecer como anónimo o identificarte.',
            () => this.executeAdminCreateRoom(),
            'Crear Sala'
        );
    }

    async executeAdminCreateRoom() {
        // Generar datos de sala automáticamente para administrador
        const roomId = this.generateRoomCode();
        const room = {
            id: roomId,
            creator: 'Administrador',
            question: 'Sala de diálogo creada por administrador',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + this.config.timeLimit).toISOString(),
            messageLimit: this.config.messageLimit,
            messages: [{
                id: Date.now(),
                text: 'Sala creada por administrador. ¡Participa en el diálogo!',
                isAnonymous: false,
                author: 'Administrador',
                timestamp: new Date().toISOString(),
                votes: { likes: 0, dislikes: 0 }
            }]
        };

        // Guardar sala
        await this.saveRoom(room);
        
        // Configurar estado - Admin inicia en modo identificado
        this.state.currentRoom = room;
        this.state.currentUser = { 
            name: 'Administrador', 
            isCreator: true, 
            adminIncognito: false // 🎭 Modo identificado por defecto, puede cambiar
        };
        
        // Guardar sesión
        this.saveCurrentSession();
        
        // Ir al chat
        this.startChat();
        this.showToast(`Sala creada: ${roomId}`, 'success');
    }

    // 📋 FUNCIONES ADMINISTRADOR - Listar salas existentes
    async adminListRooms() {
        console.log('📋 Admin: Ver salas existentes');
        
        try {
            // NUEVA LÓGICA: Usar vista admin con soporte is_active
            const rooms = await this.getAllRooms(true); // adminView = true
            
            if (rooms.length === 0) {
                this.showConfirmModal(
                    '📋 Salas del Sistema',
                    'No hay salas en el sistema.',
                    () => this.hideModal(),
                    'Cerrar'
                );
                return;
            }
            
            // Crear interfaz HTML dinámica con botones de acción
            this.showAdminRoomsModal(rooms);
            
        } catch (error) {
            console.error('Error en adminListRooms:', error);
            this.showToast('Error obteniendo lista de salas', 'error');
        }
    }

    // 📋 NUEVA FUNCIÓN: Modal personalizado para listado de salas admin
    showAdminRoomsModal(rooms) {
        console.log('📋 Mostrando modal personalizado con', rooms.length, 'salas');
        
        // LIMPIAR MODAL ANTES DE USAR (crítico para evitar contenido anterior)
        this.cleanupModal();
        
        // Generar HTML dinámico para cada sala
        let roomsHTML = '<div class="admin-rooms-list">';
        
        if (rooms.length === 0) {
            roomsHTML += '<p class="no-rooms">No hay salas en el sistema.</p>';
        } else {
            rooms.forEach((room, index) => {
                const isActive = room.isActive !== false;
                const status = isActive ? '✅ Activa' : '❌ Eliminada';
                const isExpired = this.isRoomExpired(room);
                const timeStatus = isExpired ? ' (Expiró naturalmente)' : ' (Dentro del tiempo)';
                const messageCount = room.messages ? room.messages.length : 0;
                
                roomsHTML += `
                <div class="room-item ${isActive ? 'room-active' : 'room-inactive'}">
                    <div class="room-header">
                        <h4>${room.id}</h4>
                        <span class="room-status">${status}${timeStatus}</span>
                    </div>
                    <div class="room-info">
                        <p><strong>Creador:</strong> ${room.creator}</p>
                        <p><strong>Pregunta:</strong> ${room.question}</p>
                        <p><strong>Mensajes:</strong> ${messageCount}/${room.messageLimit}</p>
                        <p><strong>Creada:</strong> ${new Date(room.createdAt).toLocaleString()}</p>
                    </div>
                    <div class="room-actions">
                `;
                
                if (isActive) {
                    roomsHTML += `
                        <button class="btn btn--danger btn--sm admin-delete-btn" data-room-id="${room.id}">
                            🗑️ Eliminar
                        </button>
                    `;
                } else {
                    roomsHTML += `
                        <button class="btn btn--primary btn--sm admin-reactivate-btn" data-room-id="${room.id}">
                            🔄 Reactivar
                        </button>
                    `;
                }
                
                roomsHTML += `
                    </div>
                </div>
                `;
            });
        }
        
        roomsHTML += '</div>';
        
        // Insertar HTML dinámico en el modal
        const confirmMessage = document.getElementById('confirmMessage');
        if (confirmMessage) {
            confirmMessage.innerHTML = roomsHTML;
        }
        
        // Configurar modal
        const confirmTitle = document.getElementById('confirmTitle');
        if (confirmTitle) {
            confirmTitle.textContent = '📋 Salas del Sistema (Vista Administrador)';
        }
        
        // Configurar callback para cerrar
        this.confirmCallback = () => this.hideModal();
        
        // Configurar botón de cerrar
        const confirmBtn = document.getElementById('confirmBtn');
        if (confirmBtn) {
            confirmBtn.textContent = 'Cerrar';
            confirmBtn.className = 'btn btn--outline btn--lg';
        }
        
        // Mostrar modal
        this.showModal('confirm');
        
        // Agregar event listeners a los botones de acción después de mostrar el modal
        this.setupAdminRoomActionListeners();
    }
    
    // 👂 NUEVA FUNCIÓN: Configurar event listeners para botones de acción admin
    setupAdminRoomActionListeners() {
        console.log('👂 Configurando event listeners para botones admin');
        
        // Event listeners para botones de eliminar
        const deleteButtons = document.querySelectorAll('.admin-delete-btn');
        deleteButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const roomId = button.getAttribute('data-room-id');
                if (roomId) {
                    console.log('🗑️ Click eliminar sala:', roomId);
                    this.adminDeleteRoom(roomId);
                }
            });
        });
        
        // Event listeners para botones de reactivar
        const reactivateButtons = document.querySelectorAll('.admin-reactivate-btn');
        reactivateButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const roomId = button.getAttribute('data-room-id');
                if (roomId) {
                    console.log('🔄 Click reactivar sala:', roomId);
                    this.adminReactivateRoom(roomId);
                }
            });
        });
        
        console.log(`✅ Event listeners configurados: ${deleteButtons.length} eliminar, ${reactivateButtons.length} reactivar`);
    }

    // 🗑️ FUNCIONES ADMINISTRADOR - Eliminación manual de salas
    adminDeleteRoom(roomId) {
        console.log('🗑️ Admin: Eliminar sala', roomId);
        
        // Verificar que la sala existe
        const roomKey = `room_${roomId}`;
        const roomData = localStorage.getItem(roomKey);
        
        if (!roomData) {
            this.showToast(`Sala ${roomId} no encontrada`, 'error');
            return;
        }
        
        try {
            const room = JSON.parse(roomData);
            
            // Mostrar confirmación con detalles de la sala
            const messageCount = room.messages ? room.messages.length : 0;
            const confirmText = `¿Eliminar permanentemente la sala ${roomId}?\n\n` +
                              `Creador: ${room.creator}\n` +
                              `Mensajes: ${messageCount}\n` +
                              `Creada: ${new Date(room.createdAt).toLocaleString()}\n\n` +
                              `Esta acción NO se puede deshacer.`;
            
            this.showConfirmModal(
                '🗑️ Confirmar Eliminación',
                confirmText,
                () => this.executeAdminDeleteRoom(roomId),
                'Eliminar Sala',
                'danger'
            );
            
        } catch (error) {
            console.error('Error al procesar sala para eliminación:', error);
            this.showToast('Error al procesar la sala', 'error');
        }
    }
    
    // 🗑️ Ejecutar eliminación de sala (confirmada) - NUEVA LÓGICA SOFT DELETE
    async executeAdminDeleteRoom(roomId) {
        console.log('🗑️ Ejecutando eliminación (soft delete) de sala:', roomId);
        
        try {
            // NUEVA LÓGICA: Usar soft delete de Supabase
            if (this.supabaseClient && this.supabaseClient.isSupabaseAvailable()) {
                const result = await this.supabaseClient.deleteRoom(roomId);
                if (result.success) {
                    console.log('✅ Sala marcada como inactiva en Supabase:', roomId);
                } else {
                    throw new Error('Error en soft delete de Supabase');
                }
            } else {
                // Fallback: soft delete en localStorage
                const roomKey = `room_${roomId}`;
                const roomData = localStorage.getItem(roomKey);
                if (roomData) {
                    const room = JSON.parse(roomData);
                    room.isActive = false;
                    localStorage.setItem(roomKey, JSON.stringify(room));
                    console.log('✅ Sala marcada como inactiva en localStorage:', roomId);
                }
            }
            
            // Si el usuario está actualmente en esta sala, sacarlo
            if (this.state.currentRoom && this.state.currentRoom.id === roomId) {
                console.log('🚪 Usuario estaba en la sala eliminada, redirigiendo...');
                this.clearCurrentSession();
                this.showScreen('welcomeScreen');
                this.showToast('La sala fue eliminada por el administrador', 'warning');
            } else {
                this.showToast(`Sala ${roomId} eliminada (se puede reactivar)`, 'success');
            }
            
            // Cerrar modal
            this.hideModal();
            
        } catch (error) {
            console.error('Error eliminando sala:', error);
            this.showToast('Error al eliminar la sala', 'error');
        }
    }

    // 🔄 NUEVA FUNCIÓN: Reactivar sala eliminada (solo admin)
    async adminReactivateRoom(roomId) {
        console.log('🔄 Admin: Reactivar sala', roomId);
        
        try {
            // Verificar que la sala existe y está inactiva
            const rooms = await this.getAllRooms(true); // Vista admin
            const room = rooms.find(r => r.id === roomId);
            
            if (!room) {
                this.showToast(`Sala ${roomId} no encontrada`, 'error');
                return;
            }
            
            if (room.isActive !== false) {
                this.showToast(`Sala ${roomId} ya está activa`, 'warning');
                return;
            }
            
            // Mostrar confirmación
            const confirmText = `¿Reactivar la sala ${roomId}?\n\n` +
                              `Creador: ${room.creator}\n` +
                              `Pregunta: ${room.question}\n` +
                              `Creada: ${new Date(room.createdAt).toLocaleString()}\n\n` +
                              `La sala volverá a estar disponible para usuarios.`;
            
            this.showConfirmModal(
                '🔄 Confirmar Reactivación',
                confirmText,
                () => this.executeAdminReactivateRoom(roomId),
                'Reactivar Sala',
                'primary'
            );
            
        } catch (error) {
            console.error('Error al procesar reactivación:', error);
            this.showToast('Error al procesar la reactivación', 'error');
        }
    }
    
    // 🔄 Ejecutar reactivación de sala (confirmada)
    async executeAdminReactivateRoom(roomId) {
        console.log('🔄 Ejecutando reactivación de sala:', roomId);
        
        try {
            // Reactivar usando Supabase
            if (this.supabaseClient && this.supabaseClient.isSupabaseAvailable()) {
                const result = await this.supabaseClient.reactivateRoom(roomId);
                if (result.success) {
                    console.log('✅ Sala reactivada en Supabase:', roomId);
                } else {
                    throw new Error(result.message || 'Error reactivando en Supabase');
                }
            } else {
                // Fallback: reactivar en localStorage
                const roomKey = `room_${roomId}`;
                const roomData = localStorage.getItem(roomKey);
                if (roomData) {
                    const room = JSON.parse(roomData);
                    room.isActive = true;
                    localStorage.setItem(roomKey, JSON.stringify(room));
                    console.log('✅ Sala reactivada en localStorage:', roomId);
                } else {
                    throw new Error('Sala no encontrada en localStorage');
                }
            }
            
            this.showToast(`Sala ${roomId} reactivada exitosamente`, 'success');
            this.hideModal();
            
        } catch (error) {
            console.error('Error reactivando sala:', error);
            this.showToast(`Error reactivando sala: ${error.message}`, 'error');
        }
    }

    // 📊 FUNCIONES ADMINISTRADOR - Estadísticas del sistema
    async adminShowStats() {
        console.log('📊 Admin: Mostrar estadísticas');
        
        try {
            // NUEVA LÓGICA: Usar vista admin con soporte is_active
            const rooms = await this.getAllRooms(true); // adminView = true  
            const activeRooms = rooms.filter(room => room.isActive !== false);
            const inactiveRooms = rooms.filter(room => room.isActive === false);
            const expiredRooms = rooms.filter(room => this.isRoomExpired(room));
        
            let totalMessages = 0;
            rooms.forEach(room => {
                totalMessages += room.messages ? room.messages.length : 0;
            });
            
            const storageUsage = this.calculateLocalStorageUsage();
            
            const stats = `📊 Estadísticas del Sistema (Nueva Lógica):

🏠 Salas:
   • Total: ${rooms.length}
   • Activas: ${activeRooms.length}
   • Eliminadas (inactivas): ${inactiveRooms.length}
   • Expiradas por tiempo: ${expiredRooms.length}

💬 Mensajes:
   • Total: ${totalMessages}
   • Promedio por sala: ${rooms.length > 0 ? Math.round(totalMessages / rooms.length) : 0}

💾 Almacenamiento:
   • Uso local: ${Math.round(storageUsage / 1024)} KB
   • Límite: ${Math.round(this.config.maxStorageSize / 1024)} KB

🔧 Sistema:
   • Modo: ${this.supabaseClient?.isSupabaseAvailable() ? 'Supabase + Local' : 'Solo Local'}
   • Persistencia: ✅ Columna is_active implementada
   • Admin: ✅ Activo

🎮 Comandos disponibles:
   • adminListRooms() - Ver todas las salas
   • adminDeleteRoom("ID") - Eliminar sala (soft delete)
   • adminReactivateRoom("ID") - Reactivar sala eliminada`;
            
            this.showConfirmModal(
                '📊 Estadísticas del Sistema',
                stats,
                () => this.hideModal(),
                'Cerrar'
            );
            
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            this.showToast('Error obteniendo estadísticas del sistema', 'error');
        }
    }

    // 🔍 Obtener todas las salas del sistema con nueva lógica is_active
    async getAllRooms(adminView = false) {
        console.log(`📋 getAllRooms llamado con adminView: ${adminView}`);
        
        // Usar Supabase si está disponible
        if (this.supabaseClient && this.supabaseClient.isSupabaseAvailable()) {
            try {
                if (adminView) {
                    // Admin: obtener TODAS las salas (activas + inactivas)
                    return await this.supabaseClient.getAllRoomsWithStatus();
                } else {
                    // Usuario regular: obtener solo salas activas
                    return await this.supabaseClient.getAllActiveRooms();
                }
            } catch (error) {
                console.error('Error obteniendo salas de Supabase:', error);
                // Fallback a localStorage
            }
        }
        
        // Fallback: usar localStorage
        const rooms = [];
        const keys = Object.keys(localStorage);
        
        keys.forEach(key => {
            if (key.startsWith('room_')) {
                try {
                    const roomData = localStorage.getItem(key);
                    if (roomData) {
                        const room = JSON.parse(roomData);
                        
                        // Asegurar compatibilidad: agregar isActive si no existe
                        if (room.isActive === undefined) {
                            room.isActive = true;
                        }
                        
                        // Filtrar según vista
                        if (adminView) {
                            // Admin: todas las salas
                            rooms.push(room);
                        } else {
                            // Usuario: solo salas activas
                            if (room.isActive === true) {
                                rooms.push(room);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error cargando sala:', key, error);
                }
            }
        });
        
        // Ordenar por fecha de creación (más recientes primero)
        rooms.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        console.log(`📋 getAllRooms retorna ${rooms.length} salas (adminView: ${adminView})`);
        return rooms;
    }

    startChat() {
        this.hideModal();
        this.showScreen('chatScreen');
        this.elements.displays.roomCode.textContent = this.state.currentRoom.id;
        this.loadMessages();
        this.startTimers();
        this.setupRealtimeMessaging();
        
        // 🔒 CONTROL DE VISIBILIDAD: Botón compartir solo para admin
        const shareBtn = this.elements.buttons.shareRoom;
        if (shareBtn) {
            if (this.state.isAdmin) {
                shareBtn.style.display = 'inline-block';
                shareBtn.textContent = '🔗 Compartir (Admin)';
            } else {
                shareBtn.style.display = 'none';
            }
        }

        // 🎭 CONTROL MODO INCÓGNITO: Solo para administradores
        this.setupAdminIncognitoControl();
        
        this.elements.inputs.messageInput.focus();
    }

    // 🎭 CONFIGURAR CONTROL DE MODO INCÓGNITO ADMIN
    setupAdminIncognitoControl() {
        if (!this.state.isAdmin) return;

        // Buscar si ya existe el control
        let incognitoControl = document.getElementById('adminIncognitoControl');
        
        if (!incognitoControl) {
            // Crear control dinámicamente
            const chatActions = document.querySelector('.chat-actions');
            if (chatActions) {
                incognitoControl = document.createElement('button');
                incognitoControl.id = 'adminIncognitoControl';
                incognitoControl.className = 'btn btn--outline btn--sm';
                
                // Insertar antes del primer botón
                chatActions.insertBefore(incognitoControl, chatActions.firstChild);
            }
        }

        if (incognitoControl) {
            // Actualizar texto según estado actual
            const isIncognito = this.state.currentUser?.adminIncognito || false;
            incognitoControl.textContent = isIncognito ? '🎭 Modo: Incógnito' : '👑 Modo: Admin';
            incognitoControl.title = isIncognito ? 'Actualmente apareces como Anónimo. Click para identificarte como Administrador.' : 'Actualmente apareces como Administrador. Click para modo incógnito.';
            
            
            // Configurar evento (remover anterior si existe)
            incognitoControl.replaceWith(incognitoControl.cloneNode(true));
            incognitoControl = document.getElementById('adminIncognitoControl');
            
            incognitoControl.addEventListener('click', () => {
                this.toggleAdminIncognito();
            });
        }
    }

    // 🔄 ALTERNAR MODO INCÓGNITO ADMINISTRADOR
    toggleAdminIncognito() {
        if (!this.state.isAdmin) return;

        // Cambiar estado
        this.state.currentUser.adminIncognito = !this.state.currentUser.adminIncognito;
        
        // Actualizar control visual
        this.setupAdminIncognitoControl();
        
        // Mostrar notificación
        const mode = this.state.currentUser.adminIncognito ? 'incógnito (Anónimo)' : 'identificado (Administrador)';
        this.showToast(`Modo cambiado: ${mode}`, 'success');
        
        console.log(`🎭 Admin modo: ${this.state.currentUser.adminIncognito ? 'Incógnito' : 'Identificado'}`);
    }

    // 🧪 TESTING SISTEMA ADMINISTRADOR - Función de verificación completa
    testAdminSystem() {
        console.log('🧪 === INICIANDO TESTING SISTEMA ADMINISTRADOR ===');
        
        const tests = [
            {
                name: 'Variables de entorno',
                test: () => {
                    const hasAdminPassword = window.env?.ADMIN_PASSWORD !== undefined;
                    console.log('✅ ADMIN_PASSWORD:', hasAdminPassword ? 'Configurado' : '❌ Falta');
                    return hasAdminPassword;
                }
            },
            {
                name: 'Estado administrador',
                test: () => {
                    console.log('✅ Estado isAdmin:', this.state.isAdmin);
                    console.log('✅ Admin incógnito:', this.state.currentUser?.adminIncognito);
                    return this.state.hasOwnProperty('isAdmin');
                }
            },
            {
                name: 'Funciones administrador',
                test: () => {
                    const functions = ['showAdminPanel', 'adminCreateRoom', 'adminListRooms', 'adminShowStats', 'toggleAdminIncognito'];
                    let allExist = true;
                    functions.forEach(fn => {
                        const exists = typeof this[fn] === 'function';
                        console.log(`✅ ${fn}:`, exists ? 'Disponible' : '❌ Falta');
                        if (!exists) allExist = false;
                    });
                    return allExist;
                }
            },
            {
                name: 'Restricciones implementadas',
                test: () => {
                    // Simular test de restricción shareRoom
                    const originalAdmin = this.state.isAdmin;
                    this.state.isAdmin = false;
                    
                    // Mock console.log para capturar
                    let restrictionTriggered = false;
                    const originalLog = console.log;
                    console.log = (msg) => {
                        if (msg.includes('🚫 Intento de compartir código denegado')) {
                            restrictionTriggered = true;
                        }
                        originalLog(msg);
                    };
                    
                    // Simular intento de compartir como no-admin
                    if (this.state.currentRoom) {
                        this.shareRoom();
                    }
                    
                    // Restaurar
                    console.log = originalLog;
                    this.state.isAdmin = originalAdmin;
                    
                    console.log('✅ Restricciones shareRoom:', restrictionTriggered ? 'Funcionando' : '❌ No aplicadas');
                    return restrictionTriggered;
                }
            },
            {
                name: 'UI elementos',
                test: () => {
                    const elements = [
                        'welcomeScreen sin botón crear',
                        'joinRoomScreen disponible',
                        'Modal de confirmación disponible'
                    ];
                    
                    const createBtn = document.getElementById('createRoomBtn');
                    const joinScreen = document.getElementById('joinRoomScreen');
                    const confirmModal = document.getElementById('confirmModal');
                    
                    console.log('✅ Botón crear eliminado:', !createBtn ? 'Sí' : '❌ Aún existe');
                    console.log('✅ Pantalla unirse:', joinScreen ? 'Disponible' : '❌ Falta');
                    console.log('✅ Modal confirmación:', confirmModal ? 'Disponible' : '❌ Falta');
                    
                    return !createBtn && joinScreen && confirmModal;
                }
            }
        ];
        
        let passedTests = 0;
        const totalTests = tests.length;
        
        tests.forEach(test => {
            console.log(`\n🔍 Testing: ${test.name}`);
            try {
                const result = test.test();
                if (result) {
                    console.log(`✅ ${test.name}: PASSED`);
                    passedTests++;
                } else {
                    console.log(`❌ ${test.name}: FAILED`);
                }
            } catch (error) {
                console.log(`❌ ${test.name}: ERROR -`, error.message);
            }
        });
        
        console.log(`\n🎯 === RESULTADO TESTING ===`);
        console.log(`Tests pasados: ${passedTests}/${totalTests}`);
        console.log(`Porcentaje éxito: ${Math.round((passedTests/totalTests) * 100)}%`);
        
        if (passedTests === totalTests) {
            console.log(`🎉 SISTEMA ADMINISTRADOR: 100% FUNCIONAL`);
        } else {
            console.log(`⚠️ SISTEMA ADMINISTRADOR: Necesita ajustes`);
        }
        
        return {
            passed: passedTests,
            total: totalTests,
            percentage: Math.round((passedTests/totalTests) * 100),
            success: passedTests === totalTests
        };
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

        // 🎭 MODO INCÓGNITO ADMINISTRADOR - Lógica de identificación
        let authorName, isAnonymous;
        
        console.log('💬 ENVIANDO MENSAJE - Estado actual:', {
            isAdmin: this.state.isAdmin,
            isCreator: this.state.currentUser.isCreator,
            adminIncognito: this.state.currentUser.adminIncognito,
            userName: this.state.currentUser.name
        });
        
        // 🔐 LÓGICA MEJORADA: Usar isAdmin O isCreator para detectar administrador
        const isAdministrator = this.state.isAdmin || this.state.currentUser.isCreator;
        
        if (isAdministrator) {
            // Si es administrador (por isAdmin o isCreator) con modo incógnito activado
            if (this.state.isAdmin && this.state.currentUser.adminIncognito) {
                authorName = 'Anónimo';
                isAnonymous = true;
                console.log('🎭 Administrador enviando mensaje en modo incógnito');
            } else {
                // Administrador sin incógnito
                authorName = this.state.currentUser.name;
                isAnonymous = false;
                console.log('👑 Administrador enviando mensaje identificado como:', authorName);
            }
        } else {
            // Usuario regular siempre anónimo
            authorName = 'Anónimo';
            isAnonymous = true;
            console.log('👤 Usuario regular enviando mensaje anónimo');
        }
        
        console.log('💬 RESULTADO - Mensaje será enviado como:', { authorName, isAnonymous });

        const message = {
            id: Date.now(),
            text: messageText,
            isAnonymous: isAnonymous,
            author: authorName,
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
        // 🔒 RESTRICCIÓN: Solo administradores pueden compartir códigos
        if (!this.state.isAdmin) {
            this.showToast('Solo los administradores pueden compartir códigos de sala', 'error');
            console.log('🚫 Intento de compartir código denegado - usuario no es admin');
            return;
        }

        const roomCode = this.state.currentRoom.id;
        const shareText = `¡Únete a mi chat anónimo! Código: ${roomCode}`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Chat Anónimo',
                text: shareText
            });
        } else {
            this.copyToClipboard(shareText);
            this.showToast('Enlace copiado al portapapeles (Admin)', 'success');
        }
    }

    async refreshRoom() {
        if (!this.state.currentRoom) {
            this.showToast('No hay sala activa para actualizar', 'error');
            return;
        }

        this.showToast('Actualizando sala...', 'info');

        try {
            // Recargar datos de la sala desde Supabase/localStorage
            const updatedRoom = await this.loadRoom(this.state.currentRoom.id);
            
            if (!updatedRoom) {
                this.showToast('Error: Sala no encontrada', 'error');
                return;
            }

            // Verificar que la sala no haya expirado
            if (this.isRoomExpired(updatedRoom)) {
                this.showToast('La sala ha expirado', 'error');
                return;
            }

            // Actualizar estado local con datos frescos
            this.state.currentRoom = updatedRoom;
            
            // Refrescar la interfaz
            this.loadMessages(); // Recargar todos los mensajes
            this.updateCounters(); // Actualizar contadores de tiempo y mensajes
            
            // Reestablecer conexión real-time si es necesario
            this.cleanupRealtimeMessaging();
            this.setupRealtimeMessaging();
            
            // Guardar sesión actualizada
            this.saveCurrentSession();
            
            this.showToast('Sala actualizada ✅', 'success');
            
            console.log('Sala actualizada exitosamente:', updatedRoom.id);
            
        } catch (error) {
            console.error('Error actualizando sala:', error);
            this.showToast('Error al actualizar la sala', 'error');
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
        
        // Limpiar contenido del modal para evitar conflictos en siguientes usos
        this.cleanupModal();
    }
    
    // 🧹 NUEVA FUNCIÓN: Limpiar contenido del modal para evitar conflictos
    cleanupModal() {
        console.log('🧹 Limpiando contenido del modal');
        
        // Restaurar contenido original del modal de confirmación
        const confirmTitle = document.getElementById('confirmTitle');
        const confirmMessage = document.getElementById('confirmMessage');
        const confirmBtn = document.getElementById('confirmBtn');
        
        if (confirmTitle) {
            confirmTitle.textContent = 'Confirmar acción';
        }
        
        if (confirmMessage) {
            // Restaurar a contenido de texto simple, no HTML
            confirmMessage.innerHTML = '';
            confirmMessage.textContent = '¿Estás seguro?';
        }
        
        if (confirmBtn) {
            confirmBtn.textContent = 'Confirmar';
            confirmBtn.className = 'btn btn--primary btn--lg';
        }
        
        // Limpiar callback anterior
        this.confirmCallback = null;
        
        console.log('✅ Modal limpiado correctamente');
    }

    showConfirmModal(title, message, confirmCallback, buttonText = 'Confirmar', buttonStyle = 'primary') {
        this.elements.modals.confirmTitle.textContent = title;
        this.elements.modals.confirmMessage.textContent = message;
        this.confirmCallback = confirmCallback;
        
        // Actualizar texto del botón si se proporciona
        const confirmBtn = this.elements.buttons.confirm;
        if (confirmBtn) {
            confirmBtn.textContent = buttonText;
            
            // Actualizar estilo del botón
            confirmBtn.className = 'btn btn--lg';
            if (buttonStyle === 'danger') {
                confirmBtn.classList.add('btn--danger');
            } else {
                confirmBtn.classList.add('btn--primary');
            }
        }
        
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
                isCreator: this.state.currentUser.isCreator,
                adminIncognito: this.state.currentUser.adminIncognito || false
            },
            isAdmin: this.state.isAdmin || false, // 🔐 Guardar estado admin
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
            this.state.isAdmin = session.isAdmin || false; // 🔐 Restaurar estado admin

            console.log('Sesión restaurada exitosamente:', {
                isAdmin: this.state.isAdmin,
                user: this.state.currentUser
            });
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