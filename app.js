// Aplicación de Chat Anónimo
// Gestión completa de funcionalidades frontend

// Importar utilidades modularizadas
import { escapeHtml, generateRoomCode, copyToClipboard, calculateLocalStorageUsage, getUserIdentifierForFingerprint, cleanupOldIdentifierMappings } from './js/modules/utils.js';
import { cacheElements, showScreen, updateCharacterCount, updateCounters } from './js/modules/dom-manager.js';
import { showModal, hideModal, cleanupModal, showConfirmModal, handleConfirm, showToast, showEmptyState } from './js/modules/ui-manager.js';
import { saveRoom, loadRoom, saveUserVotes, loadFromStorage, isRoomExpired, cleanupExpiredRooms, getStorageStats, cleanupCorruptedData } from './js/modules/storage-manager.js';
import { saveCurrentSession, restoreSession, clearCurrentSession, getCurrentSession, getSessionStats, validateSession, cleanupExpiredSessions, updateSessionTimestamp } from './js/modules/session-manager.js';
import { sendMessage, loadMessages, addMessageToChat, processMessage, formatMessage, searchMessages, getMessageStats, validateMessage, sortMessages } from './js/modules/message-manager.js';
import { initializePDFEventListeners, getRoomPDFs, createPDFPreviewHTML, uploadPDF, getRoomPDFStats } from './js/modules/pdf-manager.js';
import { initTheme, handleThemeToggle, listenForSystemThemeChanges } from './js/modules/theme-manager.js';
import { AiAnalysisManager } from './js/modules/ai-analysis-manager.js';

class AnonymousChatApp {
    constructor() {
        // Configuración por defecto
        this.config = {
            messageLimit: 200,
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
        
        // Inicializar tema
        initTheme();
        listenForSystemThemeChanges(false); // No auto-switch si hay preferencia guardada
        
        // Configurar event listeners del modal PDF
        this.setupPdfModalListeners();
        
        // Inicializar cliente de Supabase y esperar a que esté listo
        if (typeof SupabaseClient !== 'undefined') {
            this.supabaseClient = new SupabaseClient();
            // Dar tiempo para que se inicialice
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Inicializar sistema de PDFs
        initializePDFEventListeners(this);
        
        // Inicializar sistema de análisis IA
        this.aiManager = new AiAnalysisManager();
        window.aiManager = this.aiManager; // Instancia global para acceso desde HTML
        window.chatApp = this; // Referencia global para el toast
        this.aiManager.init();
        
        this.loadFromStorage();
        
        // Inicializar manejo del teclado virtual para móviles
        this.handleVirtualKeyboard();
        
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

    // Manejo del teclado virtual en móviles
    handleVirtualKeyboard() {
        // Detectar si estamos en un dispositivo móvil
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (!isMobile) return;
        
        // Usar Visual Viewport API si está disponible
        if ('visualViewport' in window) {
            let lastKeyboardHeight = 0;
            
            const handleViewportChange = () => {
                const viewport = window.visualViewport;
                const keyboardHeight = window.innerHeight - viewport.height;
                const inputContainer = document.querySelector('.chat-input-container');
                
                if (inputContainer) {
                    // Solo ajustar si hay un cambio significativo (más de 50px)
                    if (Math.abs(keyboardHeight - lastKeyboardHeight) > 50) {
                        if (keyboardHeight > 100) { // Teclado visible
                            // Mover el input sobre el teclado
                            inputContainer.style.transform = `translateY(-${keyboardHeight}px)`;
                            
                            // Ajustar el scroll del chat para ver los últimos mensajes
                            const chatMessages = document.getElementById('chatMessages');
                            if (chatMessages) {
                                setTimeout(() => {
                                    chatMessages.scrollTop = chatMessages.scrollHeight;
                                }, 100);
                            }
                        } else { // Teclado oculto
                            inputContainer.style.transform = 'translateY(0)';
                        }
                        lastKeyboardHeight = keyboardHeight;
                    }
                }
            };
            
            // Escuchar cambios en el viewport
            window.visualViewport.addEventListener('resize', handleViewportChange);
            window.visualViewport.addEventListener('scroll', handleViewportChange);
        }
        
        // Fallback para navegadores sin Visual Viewport API
        // Manejo adicional cuando el input recibe focus
        if (this.elements && this.elements.inputs && this.elements.inputs.messageInput) {
            this.elements.inputs.messageInput.addEventListener('focus', () => {
                // Esperar a que el teclado se abra completamente
                setTimeout(() => {
                    // Asegurar que el input sea visible
                    const inputContainer = document.querySelector('.chat-input-container');
                    if (inputContainer) {
                        inputContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    }
                    
                    // Scroll al final de los mensajes
                    const chatMessages = document.getElementById('chatMessages');
                    if (chatMessages) {
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                }, 300);
            });
            
            // Restaurar posición cuando se pierde el focus
            this.elements.inputs.messageInput.addEventListener('blur', () => {
                setTimeout(() => {
                    const inputContainer = document.querySelector('.chat-input-container');
                    if (inputContainer && !window.visualViewport) {
                        inputContainer.style.transform = 'translateY(0)';
                    }
                }, 100);
            });
        }
    }

    cacheElements() {
        this.elements = cacheElements();
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
        
        // Botón de análisis IA
        if (this.elements.buttons.aiAnalysis) {
            this.elements.buttons.aiAnalysis.addEventListener('click', () => {
                if (this.aiManager) {
                    this.aiManager.openAnalysisModal();
                } else {
                    this.showToast('Sistema de IA no disponible', 'error');
                }
            });
        }
        
        // Botón de cambio de tema
        if (this.elements.buttons.themeToggle) {
            this.elements.buttons.themeToggle.addEventListener('click', () => {
                handleThemeToggle((message, type) => this.showToast(message, type));
            });
        }

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
        showScreen(screenId, this.elements, this.state);
    }

    generateRoomCode() {
        return generateRoomCode();
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

        // Ya no verificamos expiración - las salas no expiran automáticamente
        /*
        if (this.isRoomExpired(room)) {
            this.showToast('Esta sala ha expirado', 'error');
            return;
        }
        */

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
                // Ya no mostramos estado de expiración porque las salas no expiran
                const timeStatus = ''; // isExpired ? ' (Expiró naturalmente)' : ' (Dentro del tiempo)';
                const messageCount = room.messages ? room.messages.length : 0;
                
                // 🔍 DEBUG: Logging detallado para diagnosticar problema botón "Entrar"
                console.log(`🔍 SALA ${room.id}:`, {
                    isActive: isActive,
                    isExpired: isExpired,
                    shouldShowEnterButton: isActive && !isExpired,
                    room_isActive_raw: room.isActive,
                    createdAt: room.createdAt,
                    expiresAt: room.expiresAt,
                    now: new Date().toISOString()
                });
                
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
                    // Sala activa - Mostrar botón Entrar y Eliminar
                    roomsHTML += `
                        <button class="btn btn--primary btn--sm admin-join-btn" data-room-id="${room.id}">
                            🚪 Entrar
                        </button>
                        <button class="btn btn--danger btn--sm admin-delete-btn" data-room-id="${room.id}">
                            🗑️ Eliminar
                        </button>
                    `;
                } else {
                    // Sala eliminada (solo por admin) - Solo reactivar
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
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                const roomId = button.getAttribute('data-room-id');
                if (roomId) {
                    console.log('🗑️ Click eliminar sala:', roomId);
                    await this.adminDeleteRoom(roomId);
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
        
        // Event listeners para botones de entrar (NUEVA funcionalidad)
        const joinButtons = document.querySelectorAll('.admin-join-btn');
        joinButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                const roomId = button.getAttribute('data-room-id');
                if (roomId) {
                    console.log('🚪 Click entrar a sala:', roomId);
                    await this.adminJoinExistingRoom(roomId);
                }
            });
        });
        
        console.log(`✅ Event listeners configurados: ${deleteButtons.length} eliminar, ${reactivateButtons.length} reactivar, ${joinButtons.length} entrar`);
        
        // 🔍 DEBUG: Información detallada de botones encontrados
        console.log('🔍 DEBUG BOTONES:', {
            totalDeleteButtons: deleteButtons.length,
            totalReactivateButtons: reactivateButtons.length, 
            totalJoinButtons: joinButtons.length,
            adminJoinExistingRoomExists: typeof this.adminJoinExistingRoom === 'function'
        });
    }

    // 📝 FUNCIONES ADMINISTRADOR - Actualizar límite de mensajes
    async adminUpdateRoomLimit(roomId, newLimit) {
        console.log('📝 Admin: Actualizar límite de sala', roomId, 'a', newLimit);
        
        try {
            if (this.supabaseClient.isOnline) {
                const { error } = await this.supabaseClient.client
                    .from('chat_rooms')
                    .update({ message_limit: newLimit })
                    .eq('id', roomId);
                
                if (error) {
                    console.error('Error actualizando límite:', error);
                    this.showToast('Error al actualizar límite', 'error');
                    return false;
                }
                
                console.log('✅ Límite actualizado en Supabase');
                this.showToast(`Límite actualizado a ${newLimit} mensajes`, 'success');
                
                // Si es la sala actual, actualizar también en memoria
                if (this.state.currentRoom && this.state.currentRoom.id === roomId) {
                    this.state.currentRoom.messageLimit = newLimit;
                    this.updateCounters();
                }
                
                return true;
            } else {
                // Actualizar en localStorage
                const roomData = localStorage.getItem(`room_${roomId}`);
                if (roomData) {
                    const room = JSON.parse(roomData);
                    room.messageLimit = newLimit;
                    localStorage.setItem(`room_${roomId}`, JSON.stringify(room));
                    
                    // Si es la sala actual, actualizar también en memoria
                    if (this.state.currentRoom && this.state.currentRoom.id === roomId) {
                        this.state.currentRoom.messageLimit = newLimit;
                        this.updateCounters();
                    }
                    
                    this.showToast(`Límite actualizado a ${newLimit} mensajes (local)`, 'success');
                    return true;
                }
            }
        } catch (error) {
            console.error('Error en adminUpdateRoomLimit:', error);
            this.showToast('Error al actualizar límite', 'error');
            return false;
        }
    }

    // 🔄 Actualizar límites masivamente
    async adminUpdateAllRoomsLimit(newLimit = 200) {
        console.log('🔄 Admin: Actualizar todos los límites a', newLimit);
        
        try {
            if (this.supabaseClient.isOnline) {
                const { error } = await this.supabaseClient.client
                    .from('chat_rooms')
                    .update({ message_limit: newLimit })
                    .eq('is_active', true);
                
                if (error) {
                    console.error('Error actualizando límites:', error);
                    this.showToast('Error al actualizar límites', 'error');
                    return false;
                }
                
                console.log('✅ Todos los límites actualizados en Supabase');
                this.showToast(`Todos los límites actualizados a ${newLimit} mensajes`, 'success');
                
                // Si hay sala actual, actualizar también
                if (this.state.currentRoom) {
                    this.state.currentRoom.messageLimit = newLimit;
                    this.updateCounters();
                }
                
                return true;
            } else {
                this.showToast('Actualización masiva solo disponible con conexión', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error en adminUpdateAllRoomsLimit:', error);
            this.showToast('Error al actualizar límites', 'error');
            return false;
        }
    }

    // 🗑️ FUNCIONES ADMINISTRADOR - Eliminación manual de salas
    async adminDeleteRoom(roomId) {
        console.log('🗑️ Admin: Eliminar sala', roomId);
        
        try {
            // Obtener la sala desde donde esté disponible (Supabase o localStorage)
            let room = null;
            
            // Primero intentar desde Supabase si está disponible
            if (this.supabaseClient && this.supabaseClient.isSupabaseAvailable()) {
                room = await this.supabaseClient.getRoom(roomId);
            }
            
            // Si no se encontró en Supabase, buscar en localStorage
            if (!room) {
                const roomKey = `room_${roomId}`;
                const roomData = localStorage.getItem(roomKey);
                if (roomData) {
                    room = JSON.parse(roomData);
                }
            }
            
            if (!room) {
                this.showToast(`Sala ${roomId} no encontrada`, 'error');
                return;
            }
            
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

    // 🚪 NUEVA FUNCIÓN: Admin entra directamente a sala existente
    async adminJoinExistingRoom(roomId) {
        console.log('🚪 Admin: Entrando a sala existente', roomId);
        
        try {
            // 1. Cargar la sala desde Supabase/localStorage
            const room = await this.loadRoom(roomId);
            
            if (!room) {
                this.showToast(`Sala ${roomId} no encontrada`, 'error');
                return;
            }
            
            // 2. Verificar que la sala no haya expirado
            if (this.isRoomExpired(room)) {
                this.showToast(`Sala ${roomId} ha expirado`, 'error');
                return;
            }
            
            // 3. Verificar que la sala esté activa
            if (room.isActive === false) {
                this.showToast(`Sala ${roomId} está eliminada. Reactívala primero.`, 'error');
                return;
            }
            
            console.log('✅ Sala válida, configurando estado admin...');
            
            // 4. Configurar estado del administrador
            this.state.currentRoom = room;
            this.state.currentUser = {
                name: 'Administrador',
                isCreator: false, // El admin NO es el creador original
                adminIncognito: false // Por defecto visible como Administrador
            };
            this.state.isAdmin = true; // Mantener estado admin
            
            // 5. Cerrar modal de salas y guardar sesión
            this.hideModal();
            this.saveCurrentSession();
            
            // 6. Ir directamente al chat
            this.startChat();
            
            // 7. Mostrar confirmación
            this.showToast(`Entraste como admin a sala ${roomId}`, 'success');
            console.log('🚪 Admin entró exitosamente a sala:', roomId);
            
        } catch (error) {
            console.error('Error entrando a sala:', error);
            this.showToast('Error al entrar a la sala', 'error');
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
   • adminJoinExistingRoom("ID") - Entrar directamente a sala existente
   • adminDeleteRoom("ID") - Eliminar sala (soft delete)
   • adminReactivateRoom("ID") - Reactivar sala eliminada
   • adminUpdateRoomLimit("ID", 200) - Actualizar límite de una sala
   • adminUpdateAllRoomsLimit(200) - Actualizar límite de todas las salas`;
            
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
        this.loadRoomPDFs(); // Cargar PDFs de la sala
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
            const chatActions = document.querySelector('.chat-actions-compact');
            if (chatActions) {
                incognitoControl = document.createElement('button');
                incognitoControl.id = 'adminIncognitoControl';
                incognitoControl.className = 'btn btn--xs';
                
                // Insertar antes del primer botón
                chatActions.insertBefore(incognitoControl, chatActions.firstChild);
            }
        }

        if (incognitoControl) {
            // Actualizar texto según estado actual
            const isIncognito = this.state.currentUser?.adminIncognito || false;
            incognitoControl.textContent = isIncognito ? '🎭' : '👑';
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
        
        // Actualizar visibilidad de botones de admin
        this.updateAdminButtonsVisibility();
        
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
                    const functions = ['showAdminPanel', 'adminCreateRoom', 'adminListRooms', 'adminJoinExistingRoom', 'adminShowStats', 'toggleAdminIncognito'];
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

        // 🤖 INTERCEPTAR CONSULTAS IA - Detectar mensajes que empiezan con **IA
        if (messageText.startsWith('**IA')) {
            console.log('🤖 Detectada consulta IA inline:', messageText);
            await this.handleAIQuery(messageText);
            return;
        }

        // Usar el límite de la sala actual, no el de config
        const messageLimit = this.state.currentRoom.messageLimit || this.config.messageLimit;
        if (this.state.currentRoom.messages.length >= messageLimit) {
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

        const user = {
            name: authorName,
            isCreator: !isAnonymous,
            adminIncognito: this.state.currentUser.adminIncognito || false
        };
        
        const message = processMessage(messageText, user, this.state.currentRoom.id, this.supabaseClient);

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
        const callbacks = {
            handleVote: (e) => this.handleVote(e),
            handleAdminDelete: (e) => this.handleAdminDeleteMessage(e),
            handleAdminRestore: (e) => this.handleAdminRestoreMessage(e)
        };
        
        const messageEl = addMessageToChat(message, this.elements, isRealtime, callbacks);
        
        // Actualizar visibilidad de botones de admin para el nuevo mensaje
        setTimeout(() => {
            this.updateAdminButtonsVisibility();
        }, 10);
        
        return messageEl;
    }

    async handleVote(e) {
        try {
            // Debug: Confirmar que se ejecuta handleVote
            console.debug('🎯 handleVote ejecutado', { 
                target: e.currentTarget,
                messageId: e.currentTarget.getAttribute('data-message-id'),
                voteType: e.currentTarget.getAttribute('data-vote-type')
            });

            const messageId = parseInt(e.currentTarget.getAttribute('data-message-id'));
            const voteType = e.currentTarget.getAttribute('data-vote-type');
            
            // Validaciones de entrada
            if (!messageId || !voteType) {
                console.error('❌ handleVote: Datos faltantes', { messageId, voteType });
                return;
            }
            
            if (!this.state.currentRoom) {
                console.error('❌ handleVote: No hay sala actual');
                return;
            }
            
            const userVoteKey = `${this.state.currentRoom.id}-${messageId}`;
            const currentVote = this.state.userVotes.get(userVoteKey);

            // Encontrar el mensaje
            const message = this.state.currentRoom.messages.find(m => m.id === messageId);
            if (!message) {
                console.error('❌ handleVote: Mensaje no encontrado', { messageId });
                return;
            }
            
            console.debug('✅ handleVote: Datos válidos', { messageId, voteType, currentVote });

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
                
                // Actualizar contadores con los valores devueltos por Supabase
                if (result.updatedVotes) {
                    message.votes = result.updatedVotes;
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
            
            console.debug('✅ handleVote: Votación completada exitosamente');
            
        } catch (error) {
            console.error('❌ Error en handleVote:', error);
            
            // Mostrar error al usuario
            this.showToast('Error al procesar voto. Inténtalo de nuevo.', 'error');
            
            // En desarrollo, mostrar más detalles
            if (window.location.hostname === 'localhost') {
                console.error('Stack trace completo:', error.stack);
            }
        }
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

    // ==================== GESTIÓN DE BORRADO DE MENSAJES ====================

    async handleAdminDeleteMessage(e) {
        if (!this.state.isAdmin) {
            this.showToast('Solo el administrador puede borrar mensajes', 'error');
            return;
        }

        try {
            const messageId = parseInt(e.currentTarget.getAttribute('data-message-id'));
            const messageEl = e.currentTarget.closest('.message');
            const deleteButton = e.currentTarget; // Capturar referencia al botón
            
            if (!messageId) {
                console.error('ID de mensaje no válido');
                return;
            }

            // Crear callback para confirmación
            const confirmDeleteCallback = async () => {
                try {
                    // Mostrar indicador de carga
                    const originalText = deleteButton.innerHTML;
                    deleteButton.innerHTML = '⏳';
                    deleteButton.disabled = true;

                    // Ejecutar borrado
                    const adminIdentifier = this.state.isAdmin ? 'Administrador' : 'Admin';
                    const result = await this.supabaseClient.adminDeleteMessage(messageId, adminIdentifier);

                    if (result.success) {
                        this.showToast('Mensaje borrado exitosamente', 'success');
                        
                        // Recargar mensajes para mostrar el estado actualizado
                        if (this.state.currentRoom?.id) {
                            const updatedRoom = await this.loadRoom(this.state.currentRoom.id);
                            if (updatedRoom) {
                                this.state.currentRoom = updatedRoom;
                                this.loadMessages();
                            }
                        }
                        
                    } else {
                        console.error('Error borrando mensaje:', result.error);
                        this.showToast('Error al borrar mensaje: ' + (result.error || 'Error desconocido'), 'error');
                        
                        // Restaurar botón
                        deleteButton.innerHTML = originalText;
                        deleteButton.disabled = false;
                    }
                } catch (deleteError) {
                    console.error('Error en callback de borrado:', deleteError);
                    this.showToast('Error al borrar mensaje. Inténtalo de nuevo.', 'error');
                    
                    // Restaurar botón
                    deleteButton.innerHTML = originalText;
                    deleteButton.disabled = false;
                }
            };

            // Mostrar modal de confirmación con callback
            this.showConfirmModal(
                'Confirmar borrado',
                '¿Estás seguro de que quieres borrar este mensaje?\n\nEsta acción se puede deshacer desde el modo administrador.',
                confirmDeleteCallback,
                'Borrar',
                'danger'
            );

        } catch (error) {
            console.error('Error en handleAdminDeleteMessage:', error);
            this.showToast('Error al borrar mensaje. Inténtalo de nuevo.', 'error');
        }
    }

    async handleAdminRestoreMessage(e) {
        if (!this.state.isAdmin) {
            this.showToast('Solo el administrador puede restaurar mensajes', 'error');
            return;
        }

        try {
            const messageId = parseInt(e.currentTarget.getAttribute('data-message-id'));
            
            if (!messageId) {
                console.error('ID de mensaje no válido');
                return;
            }

            // Mostrar indicador de carga
            const originalText = e.currentTarget.innerHTML;
            e.currentTarget.innerHTML = '⏳';
            e.currentTarget.disabled = true;

            // Ejecutar restauración
            const result = await this.supabaseClient.adminRestoreMessage(messageId);

            if (result.success) {
                this.showToast('Mensaje restaurado exitosamente', 'success');
                
                // Recargar mensajes para mostrar el estado actualizado
                if (this.state.currentRoom?.id) {
                    const updatedRoom = await this.loadRoom(this.state.currentRoom.id);
                    if (updatedRoom) {
                        this.state.currentRoom = updatedRoom;
                        this.loadMessages();
                    }
                }
                
            } else {
                console.error('Error restaurando mensaje:', result.error);
                this.showToast('Error al restaurar mensaje: ' + (result.error || 'Error desconocido'), 'error');
                
                // Restaurar botón
                e.currentTarget.innerHTML = originalText;
                e.currentTarget.disabled = false;
            }

        } catch (error) {
            console.error('Error en handleAdminRestoreMessage:', error);
            this.showToast('Error al restaurar mensaje. Inténtalo de nuevo.', 'error');
        }
    }

    updateAdminButtonsVisibility() {
        if (!this.state.isAdmin) {
            // Ocultar todos los botones de admin si no es admin
            document.querySelectorAll('.admin-delete-btn, .admin-restore-btn').forEach(btn => {
                btn.style.display = 'none';
            });
            return;
        }

        // Mostrar botones de admin apropiados
        document.querySelectorAll('.message').forEach(messageEl => {
            const isDeleted = messageEl.classList.contains('message-deleted');
            const deleteBtn = messageEl.querySelector('.admin-delete-btn');
            const restoreBtn = messageEl.querySelector('.admin-restore-btn');

            if (deleteBtn && !isDeleted) {
                deleteBtn.style.display = 'inline-block';
            }
            if (restoreBtn && isDeleted) {
                restoreBtn.style.display = 'inline-block';
            }
        });
    }

    loadMessages() {
        const callbacks = {
            handleVote: (e) => this.handleVote(e),
            showEmptyState: () => this.showEmptyState(),
            updateVoteButtonStates: (messageId, userVote) => this.updateVoteButtonStates(messageId, userVote),
            getUserVote: (roomId, messageId) => {
                const userVoteKey = `${roomId}-${messageId}`;
                return this.state.userVotes.get(userVoteKey);
            },
            handleAdminDelete: (e) => this.handleAdminDeleteMessage(e),
            handleAdminRestore: (e) => this.handleAdminRestoreMessage(e)
        };
        
        loadMessages(this.state.currentRoom, this.elements, callbacks);
        
        // Actualizar visibilidad de botones de admin después de cargar mensajes
        setTimeout(() => {
            this.updateAdminButtonsVisibility();
        }, 100);
    }

    showEmptyState() {
        showEmptyState(this.state.currentRoom.id, this.elements);
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
        updateCounters(this.elements, this.state, this.config);
    }

    updateCharacterCount() {
        updateCharacterCount(this.elements);
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
        return copyToClipboard(text);
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
        showModal(modalType, this.elements);
    }

    hideModal() {
        hideModal(this.elements);
    }
    
    // 🧹 NUEVA FUNCIÓN: Limpiar contenido del modal para evitar conflictos
    cleanupModal() {
        cleanupModal();
        // Limpiar callback anterior
        this.confirmCallback = null;
    }

    showConfirmModal(title, message, confirmCallback, buttonText = 'Confirmar', buttonStyle = 'primary') {
        showConfirmModal(title, message, confirmCallback, buttonText, buttonStyle, this.elements, this);
    }

    handleConfirm() {
        handleConfirm(this.elements, this);
    }

    showToast(message, type = 'info') {
        showToast(message, type, this.elements);
    }

    // Gestión de almacenamiento
    async saveRoom(room) {
        return await saveRoom(room, this.supabaseClient, () => this.saveCurrentSession());
    }

    async loadRoom(roomId) {
        return await loadRoom(roomId, this.supabaseClient);
    }

    async sendMessage(roomId, message) {
        return await sendMessage(roomId, message, this.supabaseClient);
    }

    saveUserVotes() {
        saveUserVotes(this.state.userVotes);
    }

    loadFromStorage() {
        const result = loadFromStorage(this.config);
        this.state.userVotes = result.userVotes;
    }

    isRoomExpired(room) {
        return isRoomExpired(room);
    }

    cleanupExpiredRooms() {
        return cleanupExpiredRooms();
    }

    // ==================== GESTIÓN DE SESIÓN ====================

    saveCurrentSession() {
        return saveCurrentSession(this.state.currentRoom, this.state.currentUser, this.state.isAdmin);
    }

    async restoreSession() {
        const result = await restoreSession(
            (roomId) => this.loadRoom(roomId),
            (room) => this.isRoomExpired(room)
        );

        if (result.success) {
            // Restaurar estado en la aplicación
            this.state.currentRoom = result.sessionData.currentRoom;
            this.state.currentUser = result.sessionData.currentUser;
            
            // SEGURIDAD: NO restaurar estado admin automáticamente
            // El admin debe volver a autenticarse en cada sesión
            this.state.isAdmin = false;
            
            return true;
        }

        return false;
    }

    clearCurrentSession() {
        return clearCurrentSession();
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
        return escapeHtml(text);
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
        return calculateLocalStorageUsage();
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
    
    // =====================================================
    // MÉTODOS PARA GESTIÓN DE PDFs
    // =====================================================
    
    /**
     * Cargar y mostrar PDFs de la sala actual
     */
    async loadRoomPDFs() {
        if (!this.state.currentRoom) {
            console.warn('loadRoomPDFs: No hay sala actual');
            return;
        }
        
        try {
            const pdfs = await getRoomPDFs(this.state.currentRoom.id, this.supabaseClient);
            this.displayPDFs(pdfs);
            
            // Mostrar/ocultar sección de adjuntos
            const attachmentsSection = document.getElementById('attachmentsSection');
            if (attachmentsSection) {
                if (pdfs && pdfs.length > 0) {
                    attachmentsSection.classList.remove('hidden');
                } else {
                    attachmentsSection.classList.add('hidden');
                }
            }
            
        } catch (error) {
            console.error('Error cargando PDFs de la sala:', error);
        }
    }
    
    /**
     * Mostrar lista de PDFs en la interfaz
     * @param {Array} pdfs - Lista de PDFs
     */
    displayPDFs(pdfs) {
        const attachmentsList = document.getElementById('attachmentsList');
        if (!attachmentsList) {
            console.warn('displayPDFs: No se encontró attachmentsList');
            return;
        }
        
        if (!pdfs || pdfs.length === 0) {
            attachmentsList.innerHTML = '<p class="no-attachments">No hay archivos en esta sala</p>';
            return;
        }
        
        // Generar HTML para cada PDF
        const pdfHTML = pdfs.map(pdf => createPDFPreviewHTML(pdf)).join('');
        attachmentsList.innerHTML = pdfHTML;
        
        // Configurar event listeners para los PDFs
        this.setupPDFEventListeners();
    }
    
    /**
     * Configurar event listeners específicos para PDFs
     */
    setupPDFEventListeners() {
        // Toggle para mostrar/ocultar lista de adjuntos
        const toggleBtn = document.getElementById('toggleAttachments');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const attachmentsList = document.getElementById('attachmentsList');
                if (attachmentsList) {
                    const isHidden = attachmentsList.style.display === 'none';
                    attachmentsList.style.display = isHidden ? 'block' : 'none';
                    toggleBtn.textContent = isHidden ? '↑' : '↓';
                }
            });
        }
        
        // Event listeners para preview y download (manejados por pdf-manager.js)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-pdf-preview')) {
                const attachment = e.target.closest('.pdf-attachment');
                if (attachment) {
                    this.previewPDF(attachment.dataset.attachmentId);
                }
            }
            
            if (e.target.classList.contains('btn-pdf-download')) {
                const attachment = e.target.closest('.pdf-attachment');
                if (attachment) {
                    this.downloadPDF(attachment.dataset.attachmentId);
                }
            }
        });
    }
    
    /**
     * Abrir preview de PDF en modal
     * @param {string} attachmentId - ID del attachment
     */
    async previewPDF(attachmentId) {
        try {
            const pdfs = await getRoomPDFs(this.state.currentRoom.id, this.supabaseClient);
            const pdf = pdfs.find(p => p.id === attachmentId);
            
            if (!pdf) {
                this.showToast('Archivo no encontrado', 'error');
                return;
            }
            
            // Mostrar modal de preview
            const modal = document.getElementById('pdfPreviewModal');
            const title = document.getElementById('pdfPreviewTitle');
            const frame = document.getElementById('pdfPreviewFrame');
            
            if (modal && title && frame) {
                title.textContent = pdf.original_filename;
                frame.src = pdf.url;
                modal.classList.remove('hidden');
                
                // Guardar el attachment ID para el botón de descarga
                modal.dataset.currentAttachmentId = attachmentId;
                
                // Los event listeners ya están configurados en setupPdfModalListeners()
                // Solo necesitamos mostrar el modal
            }
            
        } catch (error) {
            console.error('Error abriendo preview PDF:', error);
            this.showToast('Error abriendo preview', 'error');
        }
    }
    
    /**
     * Cerrar modal de preview PDF
     */
    closePdfModal() {
        const modal = document.getElementById('pdfPreviewModal');
        const frame = document.getElementById('pdfPreviewFrame');
        
        if (modal) {
            modal.classList.add('hidden');
            if (frame) {
                frame.src = '';
            }
            // Restaurar scroll del body si estaba bloqueado
            document.body.style.overflow = '';
        }
    }
    
    /**
     * Configurar event listeners del modal PDF (solo una vez)
     */
    setupPdfModalListeners() {
        const modal = document.getElementById('pdfPreviewModal');
        if (!modal) return;
        
        // Verificar si ya se configuraron los listeners
        if (modal.dataset.listenersConfigured === 'true') return;
        
        // Botones de cerrar
        const closeButtons = modal.querySelectorAll('#closePdfModal, #closePdfPreview');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.closePdfModal());
        });
        
        // Click fuera del modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closePdfModal();
            }
        });
        
        // ESC key para cerrar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                this.closePdfModal();
            }
        });
        
        // Botón de descarga
        const downloadBtn = document.getElementById('downloadPdfBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', async () => {
                // Obtener el ID del attachment actual desde el modal
                const modal = document.getElementById('pdfPreviewModal');
                if (modal && modal.dataset.currentAttachmentId) {
                    await this.downloadPDF(modal.dataset.currentAttachmentId);
                }
            });
        }
        
        // Marcar que los listeners ya están configurados
        modal.dataset.listenersConfigured = 'true';
    }
    
    /**
     * Descargar PDF
     * @param {string} attachmentId - ID del attachment
     */
    async downloadPDF(attachmentId) {
        try {
            const pdfs = await getRoomPDFs(this.state.currentRoom.id, this.supabaseClient);
            const pdf = pdfs.find(p => p.id === attachmentId);
            
            if (!pdf) {
                this.showToast('Archivo no encontrado', 'error');
                return;
            }
            
            // Crear enlace temporal para descarga
            const link = document.createElement('a');
            link.href = pdf.url;
            link.download = pdf.original_filename;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showToast('Descarga iniciada', 'success');
            
        } catch (error) {
            console.error('Error descargando PDF:', error);
            this.showToast('Error en descarga', 'error');
        }
    }
    
    /**
     * Obtener estadísticas de PDFs de la sala
     * @returns {Promise<Object>} Estadísticas
     */
    async getPDFStats() {
        if (!this.state.currentRoom) {
            return { totalFiles: 0, totalSizeMB: 0 };
        }
        
        try {
            return await getRoomPDFStats(this.state.currentRoom.id, this.supabaseClient);
        } catch (error) {
            console.error('Error obteniendo estadísticas PDF:', error);
            return { totalFiles: 0, totalSizeMB: 0 };
        }
    }

    // 🤖 IA INLINE QUERIES - Procesar consultas IA desde chat input
    async handleAIQuery(messageText) {
        console.log('🤖 Procesando consulta IA inline:', messageText);
        
        // Limpiar input inmediatamente
        this.elements.inputs.messageInput.value = '';
        this.updateCharacterCount();

        // Verificar que el manager IA esté disponible
        if (!this.aiManager) {
            this.showToast('Sistema IA no disponible', 'error');
            return;
        }

        // Extraer la consulta (remover **IA del inicio)
        const query = messageText.substring(4).trim();
        if (!query) {
            this.showToast('Consulta IA vacía. Ejemplo: **IA analizar sentimientos', 'warning');
            return;
        }

        // Mostrar indicador visual de que se está procesando
        this.showAIQueryIndicator(query);

        try {
            // Obtener mensajes de la sala actual desde la BD
            const messages = await this.aiManager.getMessagesFromCurrentRoom();
            
            if (!messages || messages.length === 0) {
                this.hideAIQueryIndicator();
                this.showToast('No hay mensajes para analizar en esta sala', 'warning');
                return;
            }

            // Determinar tipo de análisis basado en la consulta
            const analysisType = this.determineAnalysisType(query);
            
            // Ejecutar análisis IA
            const result = await this.aiManager.performOpenAIAnalysis(messages, analysisType);
            
            // Mostrar resultado como mensaje especial en el chat
            this.renderAIResponse(query, result, analysisType, messages.length);
            
            // Limpiar indicador
            this.hideAIQueryIndicator();
            
            console.log('✅ Consulta IA completada exitosamente');

        } catch (error) {
            console.error('❌ Error procesando consulta IA:', error);
            this.hideAIQueryIndicator();
            
            // Mostrar error como mensaje especial
            this.renderAIError(query, error.message);
        }
    }

    // 🎯 Determinar tipo de análisis basado en la consulta del usuario
    determineAnalysisType(query) {
        const lowerQuery = query.toLowerCase();
        
        if (lowerQuery.includes('sentiment') || lowerQuery.includes('emoci') || 
            lowerQuery.includes('ánimo') || lowerQuery.includes('estado')) {
            return 'sentiment';
        }
        
        if (lowerQuery.includes('tema') || lowerQuery.includes('tópico') || 
            lowerQuery.includes('asunto') || lowerQuery.includes('topic')) {
            return 'topic';
        }
        
        if (lowerQuery.includes('resumen') || lowerQuery.includes('summary') || 
            lowerQuery.includes('resumir') || lowerQuery.includes('síntesis')) {
            return 'summary';
        }
        
        // Por defecto usar summary para consultas generales
        return 'summary';
    }

    // 💬 Renderizar respuesta IA como mensaje especial en el chat
    renderAIResponse(query, result, analysisType, messagesAnalyzed) {
        // Crear mensaje especial para la respuesta IA
        const aiResponse = {
            id: `ai_${Date.now()}`,
            text: result,
            isAnonymous: false,
            author: '🤖 Análisis IA',
            timestamp: new Date().toISOString(),
            votes: { likes: 0, dislikes: 0 },
            isAIResponse: true, // Marca especial
            aiMetadata: {
                query: query,
                analysisType: analysisType,
                messagesAnalyzed: messagesAnalyzed,
                model: this.aiManager.model || 'gpt-4o-mini'
            }
        };

        // Agregar al chat sin enviarlo a la BD (solo visual)
        this.addAIMessageToChat(aiResponse);
        
        // Mostrar toast informativo
        this.showToast(`Análisis completado: ${messagesAnalyzed} mensajes analizados`, 'success');
    }

    // ❌ Renderizar error IA como mensaje especial
    renderAIError(query, errorMessage) {
        const aiError = {
            id: `ai_error_${Date.now()}`,
            text: `Error procesando consulta: "${query}"\n\n${errorMessage}`,
            isAnonymous: false,
            author: '🤖 Error IA',
            timestamp: new Date().toISOString(),
            votes: { likes: 0, dislikes: 0 },
            isAIError: true // Marca especial
        };

        this.addAIMessageToChat(aiError);
        this.showToast('Error en análisis IA', 'error');
    }

    // 📱 Agregar mensaje IA al chat con estilo especial
    addAIMessageToChat(aiMessage) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message ai-message';
        messageEl.setAttribute('data-message-id', aiMessage.id);

        const timeStr = new Date(aiMessage.timestamp).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Formatear texto IA con mejor presentación
        const formattedText = this.formatAIText(aiMessage.text);

        let metadataHTML = '';
        if (aiMessage.aiMetadata) {
            const { query, analysisType, messagesAnalyzed, model } = aiMessage.aiMetadata;
            metadataHTML = `
                <div class="ai-metadata">
                    <small>
                        📊 Consulta: "${query}" | 
                        🎯 Tipo: ${this.getAnalysisTypeName(analysisType)} | 
                        📈 Mensajes: ${messagesAnalyzed} | 
                        🤖 Inteligencia Artificial
                    </small>
                </div>
            `;
        }

        messageEl.innerHTML = `
            <div class="message-header ai-header">
                <span class="message-author ai-author">${aiMessage.author}</span>
                <span class="message-time">${timeStr}</span>
                <span class="ai-indicator">🎯</span>
            </div>
            <div class="message-content ai-content">${formattedText}</div>
            ${metadataHTML}
            <div class="ai-actions">
                <button class="ai-action-btn" onclick="chatApp.copyAIResponse('${aiMessage.id}')">
                    📋 Copiar
                </button>
                <button class="ai-action-btn" onclick="chatApp.exportAIResponse('${aiMessage.id}')">
                    📄 Exportar
                </button>
            </div>
        `;

        this.elements.displays.chatMessages.appendChild(messageEl);
        
        // Scroll suave y efecto visual
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
        
        setTimeout(() => {
            messageEl.classList.add('ai-message-highlight');
            setTimeout(() => {
                messageEl.classList.remove('ai-message-highlight');
            }, 3000);
        }, 100);
    }

    // 📝 Formatear texto IA para mejor legibilidad
    formatAIText(text) {
        return text
            .replace(/\n\n/g, '</p><p class="ai-paragraph">')
            .replace(/\n/g, '<br>')
            .replace(/(^\d+\.\s)/gm, '<strong class="ai-number">$1</strong>')
            .replace(/^/, '<p class="ai-paragraph">')
            .replace(/$/, '</p>');
    }

    // 🎯 Obtener nombre legible del tipo de análisis
    getAnalysisTypeName(analysisType) {
        const names = {
            sentiment: 'Análisis de Sentimientos',
            topic: 'Análisis Temático',
            summary: 'Resumen de Conversación'
        };
        return names[analysisType] || 'Análisis';
    }

    // ⌛ Mostrar indicador de que se está procesando consulta IA
    showAIQueryIndicator(query) {
        // Crear elemento indicador temporal
        const indicator = document.createElement('div');
        indicator.id = 'ai-query-indicator';
        indicator.className = 'ai-query-indicator';
        indicator.innerHTML = `
            <div class="ai-processing">
                <div class="ai-spinner"></div>
                <div class="ai-processing-text">
                    <strong>🤖 Procesando consulta IA...</strong>
                    <small>Consulta: "${query}"</small>
                </div>
            </div>
        `;

        // Insertar antes del input de mensajes
        const chatInput = document.querySelector('.chat-input');
        if (chatInput) {
            chatInput.insertAdjacentElement('beforebegin', indicator);
        }
    }

    // 🚫 Ocultar indicador de procesamiento IA
    hideAIQueryIndicator() {
        const indicator = document.getElementById('ai-query-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    // 📋 Copiar respuesta IA al clipboard
    copyAIResponse(messageId) {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageEl) return;

        const content = messageEl.querySelector('.ai-content');
        if (content) {
            // Extraer texto sin HTML
            const text = content.innerText || content.textContent;
            navigator.clipboard.writeText(text).then(() => {
                this.showToast('Respuesta IA copiada al portapapeles', 'success');
            }).catch(() => {
                this.showToast('Error copiando respuesta', 'error');
            });
        }
    }

    // 📄 Exportar respuesta IA como archivo
    exportAIResponse(messageId) {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageEl) return;

        const content = messageEl.querySelector('.ai-content');
        const metadata = messageEl.querySelector('.ai-metadata');
        
        if (content) {
            const text = content.innerText || content.textContent;
            const metaText = metadata ? (metadata.innerText || metadata.textContent) : '';
            
            const filename = `respuesta-ia-${new Date().toISOString().split('T')[0]}.txt`;
            const fullContent = `RESPUESTA DE ANÁLISIS IA\n======================\n\n${metaText}\n\nRESULTADO:\n${text}\n\n---\nGenerado por Chat Anónimo v3.0 con IA inline`;

            const blob = new Blob([fullContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showToast('Respuesta IA exportada', 'success');
        }
    }
}


// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Prevenir múltiples inicializaciones que causan mensajes duplicados
    if (window.chatApp) {
        console.warn('⚠️ La aplicación ya fue inicializada, evitando duplicación');
        return;
    }
    
    console.log('🚀 Iniciando aplicación Chat Anónimo Móvil v3.0 (Sistema de Fluidez Ultra-Avanzado)...');
    window.chatApp = new AnonymousChatApp();
    
    console.log('✅ Aplicación inicializada correctamente - Event listeners únicos establecidos');
});

// ==================== FUNCIONES DE DEBUGGING GLOBALES ====================

// Funciones de debugging para testing - disponibles en consola
window.debugPolling = () => {
    if (window.chatApp) {
        console.log('Estado del polling:', window.chatApp.getPollingDebugInfo());
    } else {
        console.error('❌ window.chatApp no está disponible');
    }
};

window.debugVoting = () => {
    if (!window.chatApp) {
        console.error('❌ window.chatApp no existe');
        return;
    }
    
    const app = window.chatApp;
    console.log('🔍 DEBUG SISTEMA DE VOTACIÓN');
    console.log('=====================================');
    console.log('📊 Estado actual:', {
        currentRoom: app.state.currentRoom?.id || 'No hay sala',
        messagesCount: app.state.currentRoom?.messages?.length || 0,
        userVotes: Array.from(app.state.userVotes.entries()),
    });
    
    // Verificar botones en DOM
    const voteButtons = document.querySelectorAll('.vote-btn');
    console.log(`🎯 Botones de votación en DOM: ${voteButtons.length}`);
    
    voteButtons.forEach((btn, index) => {
        const messageId = btn.getAttribute('data-message-id');
        const voteType = btn.getAttribute('data-vote-type');
        const hasClickListener = btn.onclick !== null;
        
        console.log(`  Botón ${index + 1}:`, {
            messageId,
            voteType,
            hasClickListener,
            classes: btn.className
        });
    });
    
    console.log('=====================================');
};

window.testPolling = () => {
    if (window.chatApp) {
        window.chatApp.testPollingSystem();
    } else {
        console.error('❌ window.chatApp no está disponible');
    }
};

window.testReconnection = () => {
    if (window.chatApp) {
        window.chatApp.testReconnectionSystem();
    } else {
        console.error('❌ window.chatApp no está disponible');
    }
};

window.runEdgeTests = () => {
    if (window.chatApp) {
        window.chatApp.runEdgeCaseTests();
    } else {
        console.error('❌ window.chatApp no está disponible');
    }
};

window.performanceReport = () => {
    if (window.chatApp) {
        return window.chatApp.generatePerformanceReport();
    } else {
        console.error('❌ window.chatApp no está disponible');
        return null;
    }
};

// Función para crear salas de testing
window.createTestRoom = function() {
    const roomId = 'TEST' + Math.random().toString(36).substr(2, 4).toUpperCase();
    const room = {
        id: roomId,
        creator: 'Usuario Test',
        question: '¿Esta es una pregunta de prueba para testing?',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 horas
        messageLimit: 200,
        messages: [{
            id: Date.now(),
            text: 'Mensaje inicial de testing',
            isAnonymous: false,
            author: 'Usuario Test',
            timestamp: new Date().toISOString(),
            votes: { likes: 0, dislikes: 0 }
        }],
        isActive: true
    };
    
    localStorage.setItem(`room_${roomId}`, JSON.stringify(room));
    console.log(`🧪 Sala de test creada: ${roomId}`);
    return roomId;
};

// Información de comandos disponibles en desarrollo
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('\n🔧 === COMANDOS DE DEBUGGING DISPONIBLES ===');
    console.log('🔍 ESTADO:');
    console.log('- debugPolling(): Ver estado del sistema de polling');
    console.log('- debugVoting(): Debug del sistema de votación');
    console.log('- performanceReport(): Generar reporte de performance');
    console.log('🧪 TESTS:');
    console.log('- testPolling(): Probar sistema de polling');
    console.log('- testReconnection(): Probar reconexión automática');
    console.log('- runEdgeTests(): Ejecutar tests de casos edge');
    console.log('- createTestRoom(): Crear sala de prueba');
    console.log('🚀 ¡Sistema listo para debugging!\n');
}

// Exportar clase para acceso global (opcional)
window.AnonymousChatApp = AnonymousChatApp;