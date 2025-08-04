// Cliente de Supabase para Chat Anónimo Móvil
// Maneja todas las operaciones de base de datos con fallback a localStorage

class SupabaseClient {
    constructor() {
        this.supabaseUrl = this.getEnvVar('SUPABASE_URL');
        this.supabaseKey = this.getEnvVar('SUPABASE_ANON_KEY');
        this.client = null;
        this.isOnline = true;
        
        // Generar fingerprint único para el usuario (para votaciones)
        this.userFingerprint = this.generateUserFingerprint();
        
        // Inicializar sistema de polling adaptativo
        this.pollingIntervals = new Map();
        this.pollingState = new Map();
        
        // Sistema de reconexión y heartbeat
        this.reconnectionState = {
            isReconnecting: false,
            reconnectAttempts: 0,
            maxReconnectAttempts: 5,
            reconnectDelay: 1000, // Comenzar con 1 segundo
            maxReconnectDelay: 30000, // Máximo 30 segundos
            heartbeatInterval: null,
            lastHeartbeat: null,
            networkStatus: navigator.onLine
        };
        
        // Configurar listeners para optimización de polling
        this.setupPollingOptimizations();
        
        this.initializeClient();
    }

    // Obtener variables de entorno (compatible con diferentes entornos)
    getEnvVar(name) {
        // En desarrollo local con archivo .env
        if (typeof process !== 'undefined' && process.env) {
            return process.env[name];
        }
        
        // En producción (variables de entorno del servidor)
        if (typeof window !== 'undefined' && window.env) {
            return window.env[name];
        }
        
        // Fallback hardcodeado (temporal, para desarrollo)
        const defaults = {
            'SUPABASE_URL': 'https://supmcp.axcsol.com',
            'SUPABASE_ANON_KEY': 'your_supabase_anon_key_here'
        };
        
        return defaults[name];
    }

    // Inicializar cliente de Supabase
    async initializeClient() {
        try {
            if (!this.supabaseUrl || !this.supabaseKey || this.supabaseKey === 'your_supabase_anon_key_here') {
                console.warn('Supabase no configurado correctamente, usando localStorage');
                this.isOnline = false;
                return;
            }

            // Importar Supabase dinámicamente (CDN)
            if (typeof window !== 'undefined' && !window.supabase) {
                await this.loadSupabaseFromCDN();
            }

            if (window.supabase) {
                this.client = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);
                
                // Probar conexión
                const { data, error } = await this.client.from('chat_rooms').select('count').limit(1);
                if (error && error.code === 'PGRST116') {
                    console.warn('Tablas de chat no existen en Supabase, usando localStorage');
                    this.isOnline = false;
                } else if (!error) {
                    console.log('✅ Conexión a Supabase establecida exitosamente');
                    this.isOnline = true;
                    // Iniciar sistema de heartbeat
                    this.startHeartbeat();
                }
            } else {
                this.isOnline = false;
            }
        } catch (error) {
            console.warn('Error inicializando Supabase:', error);
            this.isOnline = false;
        }
    }

    // Cargar Supabase desde CDN
    async loadSupabaseFromCDN() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Generar fingerprint único para el usuario
    generateUserFingerprint() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Chat anónimo fingerprint', 2, 2);
        
        const fingerprint = [
            navigator.userAgent,
            navigator.language,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset(),
            canvas.toDataURL()
        ].join('|');
        
        // Hash simple del fingerprint
        let hash = 0;
        for (let i = 0; i < fingerprint.length; i++) {
            const char = fingerprint.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convertir a 32bit integer
        }
        
        return Math.abs(hash).toString(36);
    }

    // ==================== GESTIÓN DE SALAS ====================

    async createRoom(room) {
        if (!this.isOnline) {
            return this.createRoomLocal(room);
        }

        try {
            const roomData = {
                id: room.id,
                creator: room.creator,
                question: room.question,
                created_at: room.createdAt,
                expires_at: room.expiresAt,
                message_limit: room.messageLimit
            };

            const { data, error } = await this.client
                .from('chat_rooms')
                .insert([roomData])
                .select();

            if (error) {
                console.error('Error creando sala en Supabase:', error);
                return this.createRoomLocal(room);
            }

            console.log('Sala creada en Supabase:', room.id);
            return data[0];
        } catch (error) {
            console.error('Error en createRoom:', error);
            return this.createRoomLocal(room);
        }
    }

    async getRoom(roomId) {
        if (!this.isOnline) {
            return this.getRoomLocal(roomId);
        }

        try {
            // Obtener datos de la sala
            const { data: roomData, error: roomError } = await this.client
                .from('chat_rooms')
                .select('*')
                .eq('id', roomId)
                .single();

            if (roomError) {
                console.error('Error obteniendo sala de Supabase:', roomError);
                return this.getRoomLocal(roomId);
            }

            // Obtener mensajes de la sala
            const { data: messages, error: messagesError } = await this.client
                .from('chat_messages')
                .select('*')
                .eq('room_id', roomId)
                .order('created_at', { ascending: true });

            if (messagesError) {
                console.error('Error obteniendo mensajes:', messagesError);
                messages = [];
            }

            // Convertir formato de Supabase al formato de la app
            const room = {
                id: roomData.id,
                creator: roomData.creator,
                question: roomData.question,
                createdAt: roomData.created_at,
                expiresAt: roomData.expires_at,
                messageLimit: roomData.message_limit,
                messages: messages.map(msg => ({
                    id: msg.id,
                    text: msg.text,
                    isAnonymous: msg.is_anonymous,
                    author: msg.author,
                    timestamp: msg.created_at,
                    votes: {
                        likes: msg.likes || 0,
                        dislikes: msg.dislikes || 0
                    }
                }))
            };

            return room;
        } catch (error) {
            console.error('Error en getRoom:', error);
            return this.getRoomLocal(roomId);
        }
    }

    // ==================== GESTIÓN DE MENSAJES ====================

    async sendMessage(roomId, message) {
        if (!this.isOnline) {
            return this.sendMessageLocal(roomId, message);
        }

        try {
            const messageData = {
                room_id: roomId,
                text: message.text,
                is_anonymous: message.isAnonymous,
                author: message.author,
                created_at: message.timestamp,
                likes: 0,
                dislikes: 0
            };

            const { data, error } = await this.client
                .from('chat_messages')
                .insert([messageData])
                .select();

            if (error) {
                console.error('Error enviando mensaje a Supabase:', error);
                return this.sendMessageLocal(roomId, message);
            }

            // Convertir formato de respuesta
            const savedMessage = {
                id: data[0].id,
                text: data[0].text,
                isAnonymous: data[0].is_anonymous,
                author: data[0].author,
                timestamp: data[0].created_at,
                votes: {
                    likes: data[0].likes,
                    dislikes: data[0].dislikes
                }
            };

            console.log('Mensaje enviado a Supabase');
            return savedMessage;
        } catch (error) {
            console.error('Error en sendMessage:', error);
            return this.sendMessageLocal(roomId, message);
        }
    }

    // ==================== GESTIÓN DE VOTOS ====================

    async voteMessage(messageId, voteType, currentVote) {
        if (!this.isOnline) {
            return this.voteMessageLocal(messageId, voteType, currentVote);
        }

        try {
            // Primero, manejar el voto anterior si existe
            if (currentVote) {
                await this.client
                    .from('chat_votes')
                    .delete()
                    .eq('message_id', messageId)
                    .eq('user_fingerprint', this.userFingerprint);

                // Decrementar el contador anterior
                const { error: decrementError } = await this.client
                    .from('chat_messages')
                    .update({ [currentVote]: this.client.rpc('decrement_vote', { message_id: messageId, vote_type: currentVote }) })
                    .eq('id', messageId);
            }

            // Si es el mismo voto, solo eliminar
            if (currentVote === voteType) {
                return { success: true, removed: true };
            }

            // Agregar nuevo voto
            const { error: voteError } = await this.client
                .from('chat_votes')
                .insert([{
                    message_id: messageId,
                    user_fingerprint: this.userFingerprint,
                    vote_type: voteType,
                    created_at: new Date().toISOString()
                }]);

            if (voteError) {
                console.error('Error guardando voto:', voteError);
                return this.voteMessageLocal(messageId, voteType, currentVote);
            }

            // Incrementar contador
            const column = voteType === 'like' ? 'likes' : 'dislikes';
            const { error: incrementError } = await this.client
                .from('chat_messages')
                .update({ [column]: this.client.rpc('increment_vote', { message_id: messageId, vote_type: voteType }) })
                .eq('id', messageId);

            if (incrementError) {
                console.error('Error actualizando contador:', incrementError);
            }

            return { success: true, newVote: voteType };
        } catch (error) {
            console.error('Error en voteMessage:', error);
            return this.voteMessageLocal(messageId, voteType, currentVote);
        }
    }

    async getUserVoteForMessage(messageId) {
        if (!this.isOnline) {
            return this.getUserVoteForMessageLocal(messageId);
        }

        try {
            const { data, error } = await this.client
                .from('chat_votes')
                .select('vote_type')
                .eq('message_id', messageId)
                .eq('user_fingerprint', this.userFingerprint)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error obteniendo voto del usuario:', error);
                return null;
            }

            return data ? data.vote_type : null;
        } catch (error) {
            console.error('Error en getUserVoteForMessage:', error);
            return this.getUserVoteForMessageLocal(messageId);
        }
    }

    // ==================== FUNCIONES DE FALLBACK (localStorage) ====================

    createRoomLocal(room) {
        localStorage.setItem(`room_${room.id}`, JSON.stringify(room));
        return room;
    }

    getRoomLocal(roomId) {
        const roomData = localStorage.getItem(`room_${roomId}`);
        return roomData ? JSON.parse(roomData) : null;
    }

    sendMessageLocal(roomId, message) {
        const room = this.getRoomLocal(roomId);
        if (!room) return null;

        // Asignar ID único al mensaje
        message.id = Date.now();
        room.messages.push(message);
        this.createRoomLocal(room);
        
        return message;
    }

    voteMessageLocal(messageId, voteType, currentVote) {
        // Implementación simplificada para localStorage
        // En la práctica, esto se maneja en la clase principal
        return { success: true, useLocalStorage: true };
    }

    getUserVoteForMessageLocal(messageId) {
        const votes = localStorage.getItem('userVotes');
        if (!votes) return null;
        
        const userVotes = JSON.parse(votes);
        const voteKey = Object.keys(userVotes).find(key => key.includes(`-${messageId}`));
        return voteKey ? userVotes[voteKey] : null;
    }

    // ==================== UTILIDADES ====================

    async cleanupExpiredRooms() {
        if (!this.isOnline) {
            return this.cleanupExpiredRoomsLocal();
        }

        try {
            const now = new Date().toISOString();
            const { error } = await this.client
                .from('chat_rooms')
                .delete()
                .lt('expires_at', now);

            if (error) {
                console.error('Error limpiando salas expiradas:', error);
            }
        } catch (error) {
            console.error('Error en cleanupExpiredRooms:', error);
        }
    }

    cleanupExpiredRoomsLocal() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('room_')) {
                const roomData = localStorage.getItem(key);
                if (roomData) {
                    const room = JSON.parse(roomData);
                    if (new Date() > new Date(room.expiresAt)) {
                        localStorage.removeItem(key);
                    }
                }
            }
        });
    }

    // Verificar si Supabase está disponible
    isSupabaseAvailable() {
        return this.isOnline && this.client !== null;
    }

    // Configurar optimizaciones para el polling
    setupPollingOptimizations() {
        // Page Visibility API - pausar polling cuando la pestaña no está activa
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                const isVisible = !document.hidden;
                console.log(`Visibilidad de página cambió: ${isVisible ? 'visible' : 'oculta'}`);
                
                // Ajustar polling basado en visibilidad
                this.pollingState.forEach((state, roomId) => {
                    if (isVisible) {
                        // Reactivar polling normal cuando la página es visible
                        state.lastActivityTime = Date.now() - 5000; // Simular actividad reciente
                    }
                    // El polling ya se ajusta automáticamente en calculateNextInterval
                });
            });
        }

        // Network status changes (si está disponible)
        if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
            window.addEventListener('online', () => {
                console.log('Conexión de red restaurada');
                this.handleNetworkChange(true);
            });
            
            window.addEventListener('offline', () => {
                console.log('Conexión de red perdida');
                this.handleNetworkChange(false);
            });
        }
    }

    // Manejar cambios de red
    handleNetworkChange(isOnline) {
        console.log(`Estado de red cambió: ${isOnline ? 'online' : 'offline'}`);
        this.reconnectionState.networkStatus = isOnline;
        
        if (isOnline) {
            console.log('Red restaurada - iniciando reconexión automática');
            this.startReconnectionProcess();
        } else {
            console.log('Red perdida - pausando heartbeat y marcando como offline');
            this.pauseHeartbeat();
            this.isOnline = false;
        }
    }

    // Iniciar proceso de reconexión automática
    async startReconnectionProcess() {
        if (this.reconnectionState.isReconnecting) {
            console.log('Reconexión ya en progreso, saltando');
            return;
        }

        this.reconnectionState.isReconnecting = true;
        this.reconnectionState.reconnectAttempts = 0;
        
        console.log('🔄 Iniciando proceso de reconexión automática');
        
        // Notificar al UI sobre el estado de reconexión
        this.notifyConnectionStatusChange('reconnecting', {
            attempt: 0,
            maxAttempts: this.reconnectionState.maxReconnectAttempts
        });
        
        const reconnectAttempt = async () => {
            if (!navigator.onLine) {
                console.log('Red no disponible, deteniendo reconexión');
                this.reconnectionState.isReconnecting = false;
                return false;
            }

            this.reconnectionState.reconnectAttempts++;
            console.log(`Intento de reconexión ${this.reconnectionState.reconnectAttempts}/${this.reconnectionState.maxReconnectAttempts}`);

            try {
                // Intentar reconectar a Supabase
                await this.initializeClient();
                
                if (this.isOnline && this.client) {
                    console.log('✅ Reconexión exitosa a Supabase');
                    this.reconnectionState.isReconnecting = false;
                    this.reconnectionState.reconnectAttempts = 0;
                    this.reconnectionState.reconnectDelay = 1000; // Reset delay
                    
                    // Notificar éxito de reconexión
                    this.notifyConnectionStatusChange('online', {
                        wasReconnecting: true
                    });
                    
                    // Reiniciar heartbeat
                    this.startHeartbeat();
                    
                    return true;
                }
            } catch (error) {
                console.error(`Error en intento de reconexión ${this.reconnectionState.reconnectAttempts}:`, error);
            }

            // Si no se pudo reconectar y aún hay intentos
            if (this.reconnectionState.reconnectAttempts < this.reconnectionState.maxReconnectAttempts) {
                // Notificar intento fallido
                this.notifyConnectionStatusChange('reconnecting', {
                    attempt: this.reconnectionState.reconnectAttempts,
                    maxAttempts: this.reconnectionState.maxReconnectAttempts
                });
                
                // Calcular delay exponencial con jitter
                const jitter = Math.random() * 1000; // 0-1 segundo de jitter
                const delay = Math.min(
                    this.reconnectionState.reconnectDelay * Math.pow(2, this.reconnectionState.reconnectAttempts - 1) + jitter,
                    this.reconnectionState.maxReconnectDelay
                );
                
                console.log(`⏳ Próximo intento en ${Math.round(delay/1000)}s`);
                
                setTimeout(reconnectAttempt, delay);
            } else {
                console.error('❌ Agotados todos los intentos de reconexión');
                this.reconnectionState.isReconnecting = false;
                
                // Notificar falla completa
                this.notifyConnectionStatusChange('offline', {
                    wasOnline: true,
                    exhaustedRetries: true
                });
            }

            return false;
        };

        return await reconnectAttempt();
    }

    // ==================== REAL-TIME MESSAGING ====================

    // Suscribirse a mensajes nuevos en una sala
    subscribeToRoomMessages(roomId, onNewMessage) {
        if (!this.isSupabaseAvailable()) {
            // Fallback: usar polling para localStorage
            return this.startPollingForMessages(roomId, onNewMessage);
        }

        try {
            console.log(`Suscribiéndose a mensajes de sala: ${roomId}`);
            
            const channel = this.client
                .channel(`room_messages_${roomId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'chat_messages',
                        filter: `room_id=eq.${roomId}`
                    },
                    (payload) => {
                        console.log('Nuevo mensaje recibido:', payload);
                        
                        // Convertir formato de Supabase al formato de la app
                        const message = {
                            id: payload.new.id,
                            text: payload.new.text,
                            isAnonymous: payload.new.is_anonymous,
                            author: payload.new.author,
                            timestamp: payload.new.created_at,
                            votes: {
                                likes: payload.new.likes || 0,
                                dislikes: payload.new.dislikes || 0
                            }
                        };
                        
                        onNewMessage(message);
                    }
                )
                .subscribe((status) => {
                    console.log(`Estado de suscripción para sala ${roomId}:`, status);
                });

            // Guardar referencia del canal para poder desuscribirse
            if (!this.subscriptions) {
                this.subscriptions = new Map();
            }
            this.subscriptions.set(roomId, channel);

            return channel;
        } catch (error) {
            console.error('Error suscribiéndose a mensajes en tiempo real:', error);
            // Fallback a polling
            return this.startPollingForMessages(roomId, onNewMessage);
        }
    }

    // Desuscribirse de mensajes de una sala
    unsubscribeFromRoom(roomId) {
        if (this.subscriptions && this.subscriptions.has(roomId)) {
            const channel = this.subscriptions.get(roomId);
            if (channel && typeof channel.unsubscribe === 'function') {
                channel.unsubscribe();
                console.log(`Desuscrito de sala: ${roomId}`);
            }
            this.subscriptions.delete(roomId);
        }

        // Detener polling adaptativo si existe
        if (this.pollingIntervals && this.pollingIntervals.has(roomId)) {
            const intervalOrTimeout = this.pollingIntervals.get(roomId);
            clearTimeout(intervalOrTimeout); // Ahora usamos timeout en lugar de interval
            this.pollingIntervals.delete(roomId);
            console.log(`Polling adaptativo detenido para sala: ${roomId}`);
        }

        // Limpiar estado del polling
        if (this.pollingState && this.pollingState.has(roomId)) {
            const pollingState = this.pollingState.get(roomId);
            pollingState.isActive = false; // Marcar como inactivo
            this.pollingState.delete(roomId);
            console.log(`Estado de polling limpiado para sala: ${roomId}`);
        }
    }

    // Sistema de polling adaptativo para localStorage (fallback)
    startPollingForMessages(roomId, onNewMessage) {
        console.log(`Iniciando polling adaptativo para sala: ${roomId}`);
        
        if (!this.pollingIntervals) {
            this.pollingIntervals = new Map();
        }

        if (!this.pollingState) {
            this.pollingState = new Map();
        }

        // Detener polling anterior si existe
        if (this.pollingIntervals.has(roomId)) {
            clearInterval(this.pollingIntervals.get(roomId));
        }

        // Estado del polling adaptativo
        const pollingState = {
            knownMessageIds: new Set(),
            lastActivityTime: Date.now(),
            currentInterval: 1000, // Comenzar con 1 segundo
            isActive: true,
            consecutiveEmptyPolls: 0
        };
        this.pollingState.set(roomId, pollingState);
        
        // Cargar mensajes existentes para evitar duplicados iniciales
        this.getRoomLocal(roomId).then(initialRoom => {
            if (initialRoom && initialRoom.messages) {
                initialRoom.messages.forEach(msg => {
                    pollingState.knownMessageIds.add(msg.id);
                });
            }
        }).catch(error => {
            console.error('Error cargando mensajes iniciales para polling:', error);
        });

        // Función de polling adaptativo
        const adaptivePolling = () => {
            // No hacer polling si la página no está visible (optimización de batería)
            if (document.hidden) {
                this.scheduleNextPoll(roomId, adaptivePolling, 5000); // Polling muy lento cuando no está visible
                return;
            }

            try {
                this.getRoomLocal(roomId).then(room => {
                    if (!room || !room.messages) {
                        pollingState.consecutiveEmptyPolls++;
                        this.scheduleNextPoll(roomId, adaptivePolling, this.calculateNextInterval(roomId));
                        return;
                    }

                    // Buscar mensajes nuevos que no conocemos
                    const newMessages = room.messages.filter(message => 
                        !pollingState.knownMessageIds.has(message.id)
                    );

                    if (newMessages.length > 0) {
                        console.log(`Encontrados ${newMessages.length} mensajes nuevos en polling`);
                        pollingState.lastActivityTime = Date.now();
                        pollingState.consecutiveEmptyPolls = 0;
                        
                        // Procesar mensajes nuevos
                        newMessages.forEach(message => {
                            pollingState.knownMessageIds.add(message.id);
                            onNewMessage(message);
                        });
                    } else {
                        pollingState.consecutiveEmptyPolls++;
                    }

                    // Programar siguiente polling
                    this.scheduleNextPoll(roomId, adaptivePolling, this.calculateNextInterval(roomId));
                    
                }).catch(error => {
                    console.error('Error en polling de mensajes:', error);
                    pollingState.consecutiveEmptyPolls++;
                    this.scheduleNextPoll(roomId, adaptivePolling, this.calculateNextInterval(roomId));
                });

            } catch (error) {
                console.error('Error en polling de mensajes:', error);
                pollingState.consecutiveEmptyPolls++;
                this.scheduleNextPoll(roomId, adaptivePolling, this.calculateNextInterval(roomId));
            }
        };

        // Iniciar polling
        adaptivePolling();
        return true; // Indicar que el polling se inició
    }

    // Calcular intervalo adaptativo basado en actividad
    calculateNextInterval(roomId) {
        const pollingState = this.pollingState.get(roomId);
        if (!pollingState) return 1000;

        const timeSinceLastActivity = Date.now() - pollingState.lastActivityTime;
        const recentActivity = timeSinceLastActivity < 30000; // 30 segundos
        const veryRecentActivity = timeSinceLastActivity < 10000; // 10 segundos

        // Polling muy frecuente si hay actividad muy reciente
        if (veryRecentActivity) {
            pollingState.currentInterval = 500; // 500ms
        }
        // Polling normal si hay actividad reciente
        else if (recentActivity) {
            pollingState.currentInterval = 1000; // 1s
        }
        // Polling lento si no hay actividad reciente pero menos de 2 minutos
        else if (timeSinceLastActivity < 120000) {
            pollingState.currentInterval = 2000; // 2s
        }
        // Polling muy lento para salas inactivas
        else {
            pollingState.currentInterval = 5000; // 5s
        }

        // Log del intervalo calculado para debugging
        if (pollingState.currentInterval !== 1000) { // Solo log si no es el intervalo por defecto
            console.log(`Polling adaptativo - Sala ${roomId}: ${pollingState.currentInterval}ms (actividad hace ${Math.round(timeSinceLastActivity/1000)}s)`);
        }

        return pollingState.currentInterval;
    }

    // Notificar actividad en una sala (para optimizar polling)
    notifyRoomActivity(roomId) {
        const pollingState = this.pollingState.get(roomId);
        if (pollingState) {
            pollingState.lastActivityTime = Date.now();
            pollingState.consecutiveEmptyPolls = 0;
            console.log(`Actividad notificada para sala ${roomId} - polling acelerado`);
        }
    }

    // Obtener estado del polling para debugging
    getPollingState(roomId) {
        return this.pollingState.get(roomId);
    }

    // ==================== SISTEMA DE HEARTBEAT ====================

    // Iniciar sistema de heartbeat para detectar problemas de conexión
    startHeartbeat() {
        if (!this.isSupabaseAvailable()) {
            console.log('Supabase no disponible, saltando heartbeat');
            return;
        }

        // Limpiar heartbeat anterior si existe
        this.pauseHeartbeat();

        console.log('💓 Iniciando sistema de heartbeat');
        
        this.reconnectionState.heartbeatInterval = setInterval(async () => {
            await this.performHeartbeat();
        }, 30000); // Heartbeat cada 30 segundos

        // Realizar primer heartbeat inmediatamente
        this.performHeartbeat();
    }

    // Pausar sistema de heartbeat
    pauseHeartbeat() {
        if (this.reconnectionState.heartbeatInterval) {
            clearInterval(this.reconnectionState.heartbeatInterval);
            this.reconnectionState.heartbeatInterval = null;
            console.log('⏸️ Heartbeat pausado');
        }
    }

    // Realizar heartbeat - ping simple a Supabase
    async performHeartbeat() {
        if (!this.client || !navigator.onLine) {
            return;
        }

        try {
            console.log('💓 Realizando heartbeat...');
            const startTime = Date.now();
            
            // Hacer una consulta simple y rápida
            const { error } = await this.client
                .from('chat_rooms')
                .select('count')
                .limit(1);

            const responseTime = Date.now() - startTime;
            this.reconnectionState.lastHeartbeat = Date.now();

            if (error) {
                console.warn('❌ Heartbeat falló:', error.message);
                this.handleHeartbeatFailure();
            } else {
                console.log(`✅ Heartbeat exitoso (${responseTime}ms)`);
                // Reset reconnection state on successful heartbeat
                this.reconnectionState.reconnectAttempts = 0;
                this.reconnectionState.reconnectDelay = 1000;
            }
        } catch (error) {
            console.error('❌ Error en heartbeat:', error);
            this.handleHeartbeatFailure();
        }
    }

    // Manejar falla de heartbeat
    handleHeartbeatFailure() {
        console.warn('💔 Heartbeat falló - posible problema de conexión');
        
        // Si hay múltiples fallas seguidas, iniciar reconexión
        const timeSinceLastSuccess = Date.now() - (this.reconnectionState.lastHeartbeat || 0);
        
        if (timeSinceLastSuccess > 60000) { // 1 minuto sin heartbeat exitoso
            console.warn('🔄 Múltiples heartbeats fallidos - iniciando reconexión');
            this.isOnline = false;
            
            // Notificar problema de conexión
            this.notifyConnectionStatusChange('error', {
                reason: 'heartbeat_failed'
            });
            
            this.startReconnectionProcess();
        }
    }

    // Notificar cambios de estado de conexión al UI
    notifyConnectionStatusChange(status, details = {}) {
        // Emitir evento personalizado para que la app principal pueda escuchar
        if (typeof window !== 'undefined' && window.chatApp) {
            if (window.chatApp.updateConnectionStatusEnhanced) {
                window.chatApp.updateConnectionStatusEnhanced(status, details);
            } else {
                // Fallback al método original
                const statusText = {
                    'online': 'Tiempo Real',
                    'offline': 'Modo Local',
                    'reconnecting': 'Reconectando...',
                    'error': 'Error Conexión'
                }[status] || 'Desconocido';
                
                window.chatApp.updateConnectionStatus(status, statusText);
            }
        }
        
        console.log(`🔄 Notificando cambio de estado: ${status}`, details);
    }

    // Obtener estado de reconexión para debugging
    getReconnectionState() {
        return {
            ...this.reconnectionState,
            timeSinceLastHeartbeat: this.reconnectionState.lastHeartbeat ? 
                Date.now() - this.reconnectionState.lastHeartbeat : null
        };
    }

    // Programar siguiente polling
    scheduleNextPoll(roomId, pollingFunction, interval) {
        const pollingState = this.pollingState.get(roomId);
        if (!pollingState || !pollingState.isActive) return;

        const timeoutId = setTimeout(pollingFunction, interval);
        this.pollingIntervals.set(roomId, timeoutId);
    }

    // Limpiar todas las suscripciones
    cleanup() {
        // Pausar heartbeat
        this.pauseHeartbeat();
        
        // Desuscribirse de todos los canales
        if (this.subscriptions) {
            this.subscriptions.forEach((channel, roomId) => {
                this.unsubscribeFromRoom(roomId);
            });
            this.subscriptions.clear();
        }

        // Detener todos los polling adaptativos
        if (this.pollingIntervals) {
            this.pollingIntervals.forEach((intervalOrTimeout, roomId) => {
                clearTimeout(intervalOrTimeout); // Ahora usamos timeout
            });
            this.pollingIntervals.clear();
        }

        // Limpiar estados de polling
        if (this.pollingState) {
            this.pollingState.forEach((state, roomId) => {
                state.isActive = false;
            });
            this.pollingState.clear();
        }

        // Reset reconnection state
        this.reconnectionState.isReconnecting = false;
        this.reconnectionState.reconnectAttempts = 0;
    }
}

// Exportar para uso global
window.SupabaseClient = SupabaseClient;

/* 
SQL para crear las tablas en Supabase (ejecutar manualmente en el SQL Editor):

-- Tabla para las salas de chat
CREATE TABLE chat_rooms (
    id VARCHAR(10) PRIMARY KEY,
    creator VARCHAR(100) NOT NULL,
    question TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    message_limit INTEGER DEFAULT 50
);

-- Tabla para los mensajes
CREATE TABLE chat_messages (
    id BIGSERIAL PRIMARY KEY,
    room_id VARCHAR(10) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_anonymous BOOLEAN NOT NULL,
    author VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    likes INTEGER DEFAULT 0,
    dislikes INTEGER DEFAULT 0
);

-- Tabla para los votos (prevenir duplicados)
CREATE TABLE chat_votes (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_fingerprint VARCHAR(50) NOT NULL,
    vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('like', 'dislike')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_fingerprint)
);

-- Índices para mejorar performance
CREATE INDEX idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX idx_chat_votes_message_id ON chat_votes(message_id);
CREATE INDEX idx_chat_rooms_expires_at ON chat_rooms(expires_at);

-- Funciones para manejar contadores de votos
CREATE OR REPLACE FUNCTION increment_vote(message_id BIGINT, vote_type TEXT)
RETURNS INTEGER AS $$
BEGIN
    IF vote_type = 'like' THEN
        UPDATE chat_messages SET likes = likes + 1 WHERE id = message_id;
        RETURN (SELECT likes FROM chat_messages WHERE id = message_id);
    ELSE
        UPDATE chat_messages SET dislikes = dislikes + 1 WHERE id = message_id;
        RETURN (SELECT dislikes FROM chat_messages WHERE id = message_id);
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_vote(message_id BIGINT, vote_type TEXT)
RETURNS INTEGER AS $$
BEGIN
    IF vote_type = 'like' THEN
        UPDATE chat_messages SET likes = GREATEST(likes - 1, 0) WHERE id = message_id;
        RETURN (SELECT likes FROM chat_messages WHERE id = message_id);
    ELSE
        UPDATE chat_messages SET dislikes = GREATEST(dislikes - 1, 0) WHERE id = message_id;
        RETURN (SELECT dislikes FROM chat_messages WHERE id = message_id);
    END IF;
END;
$$ LANGUAGE plpgsql;
*/