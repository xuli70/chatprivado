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

    // Generar identificador único legible para usuario anónimo (ej: A1B2C3)
    generateUserIdentifier(fingerprint = null) {
        const fp = fingerprint || this.userFingerprint;
        
        // Usar el fingerprint como semilla para generar un ID consistente
        let hash = 0;
        for (let i = 0; i < fp.length; i++) {
            const char = fp.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        // Convertir a base36 y tomar los primeros 6 caracteres
        const identifier = Math.abs(hash).toString(36).toUpperCase().substring(0, 6);
        
        // Asegurar que tenga exactamente 6 caracteres (rellenar con caracteres si es necesario)
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = identifier;
        while (result.length < 6) {
            const extraHash = Math.abs(hash * result.length).toString(36);
            result += chars[Math.abs(extraHash.charCodeAt(0)) % chars.length];
        }
        
        return result.substring(0, 6);
    }

    // Obtener o generar identificador de usuario desde localStorage
    getUserIdentifier() {
        const storageKey = 'anonymousChat_userIdentifier';
        const mappingKey = 'anonymousChat_identifierMapping';
        
        // Intentar obtener desde localStorage
        let identifier = localStorage.getItem(storageKey);
        let mapping = {};
        
        try {
            const storedMapping = localStorage.getItem(mappingKey);
            if (storedMapping) {
                mapping = JSON.parse(storedMapping);
            }
        } catch (error) {
            console.warn('Error parsing identifier mapping:', error);
            localStorage.removeItem(mappingKey);
        }
        
        // Si ya existe un identifier para este fingerprint, usarlo
        if (mapping[this.userFingerprint]) {
            identifier = mapping[this.userFingerprint];
            localStorage.setItem(storageKey, identifier);
            return identifier;
        }
        
        // Si no existe, generar uno nuevo
        if (!identifier) {
            identifier = this.generateUserIdentifier();
        }
        
        // Guardar mapping fingerprint -> identifier
        mapping[this.userFingerprint] = identifier;
        
        try {
            localStorage.setItem(storageKey, identifier);
            localStorage.setItem(mappingKey, JSON.stringify(mapping));
        } catch (error) {
            console.warn('Error saving user identifier to localStorage:', error);
        }
        
        return identifier;
    }

    // Obtener o crear identificador de usuario usando Supabase
    async getOrCreateUserIdentifierFromSupabase() {
        if (!this.isOnline || !this.client) {
            return this.getUserIdentifier(); // Fallback a localStorage
        }
        
        try {
            // Usar la función SQL para obtener o crear identifier
            const { data, error } = await this.client
                .rpc('get_or_create_user_identifier', {
                    fingerprint_hash: this.userFingerprint
                });
                
            if (error) {
                console.warn('Error getting identifier from Supabase:', error);
                return this.getUserIdentifier(); // Fallback a localStorage
            }
            
            // Guardar también en localStorage para acceso rápido
            const identifier = data;
            localStorage.setItem('anonymousChat_userIdentifier', identifier);
            
            // Actualizar mapping local
            const mappingKey = 'anonymousChat_identifierMapping';
            let mapping = {};
            try {
                const storedMapping = localStorage.getItem(mappingKey);
                if (storedMapping) {
                    mapping = JSON.parse(storedMapping);
                }
            } catch (e) { /* ignore */ }
            
            mapping[this.userFingerprint] = identifier;
            localStorage.setItem(mappingKey, JSON.stringify(mapping));
            
            return identifier;
        } catch (error) {
            console.warn('Error in getOrCreateUserIdentifierFromSupabase:', error);
            return this.getUserIdentifier(); // Fallback a localStorage
        }
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
                message_limit: room.messageLimit,
                is_active: true  // Nueva columna para persistencia permanente
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
            // Obtener datos de la sala - solo salas activas
            const { data: roomData, error: roomError } = await this.client
                .from('chat_rooms')
                .select('*')
                .eq('id', roomId)
                .eq('is_active', true)  // Solo obtener salas activas
                .single();

            if (roomError) {
                console.error('Error obteniendo sala de Supabase:', roomError);
                return this.getRoomLocal(roomId);
            }

            // Obtener mensajes de la sala (incluyendo campos de borrado)
            const { data: messages, error: messagesError } = await this.client
                .from('chat_messages')
                .select('*, is_deleted, deleted_by, deleted_at')
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
                // Usar el valor exacto de BD, o 200 como valor por defecto si no existe
                messageLimit: roomData.message_limit || 200,
                messages: messages.map(msg => ({
                    id: msg.id,
                    text: msg.text,
                    isAnonymous: msg.is_anonymous,
                    author: msg.author,
                    userIdentifier: msg.user_identifier,
                    timestamp: msg.created_at,
                    votes: {
                        likes: msg.likes || 0,
                        dislikes: msg.dislikes || 0
                    },
                    // Campos de borrado
                    isDeleted: msg.is_deleted || false,
                    deletedBy: msg.deleted_by,
                    deletedAt: msg.deleted_at
                }))
            };

            return room;
        } catch (error) {
            console.error('Error en getRoom:', error);
            return this.getRoomLocal(roomId);
        }
    }

    async deleteRoom(roomId) {
        if (!this.isOnline) {
            return this.deleteRoomLocal(roomId);
        }

        try {
            // NUEVO SISTEMA: Soft delete - marcar sala como inactiva en lugar de eliminar
            // Los mensajes y votos se conservan para que el admin pueda reactivar la sala
            
            // Marcar sala como inactiva (soft delete)
            const { error: roomError } = await this.client
                .from('chat_rooms')
                .update({ is_active: false })
                .eq('id', roomId);

            if (roomError) {
                console.error('Error marcando sala como inactiva en Supabase:', roomError);
                throw roomError;
            }

            console.log('Sala marcada como inactiva en Supabase:', roomId);
            
            // También eliminar de localStorage como backup
            this.deleteRoomLocal(roomId);
            
            return { success: true };
        } catch (error) {
            console.error('Error en deleteRoom:', error);
            // Fallback a eliminación local
            return this.deleteRoomLocal(roomId);
        }
    }

    // 🔍 Obtener solo salas activas (para usuarios regulares)
    async getAllActiveRooms() {
        if (!this.isOnline) {
            return this.getAllActiveRoomsLocal();
        }

        try {
            const { data: rooms, error } = await this.client
                .from('chat_rooms')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error obteniendo salas activas:', error);
                return this.getAllActiveRoomsLocal();
            }

            console.log(`✅ Obtenidas ${rooms.length} salas activas de Supabase`);
            return rooms.map(room => this.convertSupabaseRoomToApp(room));
        } catch (error) {
            console.error('Error en getAllActiveRooms:', error);
            return this.getAllActiveRoomsLocal();
        }
    }

    // 🔍 Obtener todas las salas con estado (para administradores)
    async getAllRoomsWithStatus() {
        if (!this.isOnline) {
            return this.getAllRoomsWithStatusLocal();
        }

        try {
            const { data: rooms, error } = await this.client
                .from('chat_rooms')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error obteniendo todas las salas:', error);
                return this.getAllRoomsWithStatusLocal();
            }

            console.log(`✅ Obtenidas ${rooms.length} salas total de Supabase (activas + inactivas)`);
            return rooms.map(room => this.convertSupabaseRoomToApp(room));
        } catch (error) {
            console.error('Error en getAllRoomsWithStatus:', error);
            return this.getAllRoomsWithStatusLocal();
        }
    }

    // 🔄 Reactivar sala (para administradores)
    async reactivateRoom(roomId) {
        if (!this.isOnline) {
            return { success: false, message: 'Sin conexión a Supabase' };
        }

        try {
            const { error } = await this.client
                .from('chat_rooms')
                .update({ is_active: true })
                .eq('id', roomId);

            if (error) {
                console.error('Error reactivando sala:', error);
                return { success: false, message: error.message };
            }

            console.log('✅ Sala reactivada:', roomId);
            return { success: true, message: 'Sala reactivada exitosamente' };
        } catch (error) {
            console.error('Error en reactivateRoom:', error);
            return { success: false, message: error.message };
        }
    }

    // 🔄 Convertir formato Supabase a formato App
    convertSupabaseRoomToApp(supabaseRoom) {
        return {
            id: supabaseRoom.id,
            creator: supabaseRoom.creator,
            question: supabaseRoom.question,
            createdAt: supabaseRoom.created_at,
            expiresAt: supabaseRoom.expires_at,
            messageLimit: supabaseRoom.message_limit,
            isActive: supabaseRoom.is_active,  // Nueva propiedad
            messages: [] // Se llenarán cuando se necesiten
        };
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
                user_identifier: message.userIdentifier,
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
                userIdentifier: data[0].user_identifier,
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

                // Decrementar el contador anterior usando RPC
                const { error: decrementError } = await this.client.rpc('decrement_vote', { 
                    message_id: messageId, 
                    vote_type: currentVote 
                });
                
                if (decrementError) {
                    console.error('Error decrementando voto:', decrementError);
                }
            }

            // Si es el mismo voto, solo eliminar
            if (currentVote === voteType) {
                // Obtener los contadores actualizados después de decrementar
                const { data: updatedMessage, error: fetchError } = await this.client
                    .from('chat_messages')  
                    .select('likes, dislikes')
                    .eq('id', messageId)
                    .single();

                if (fetchError) {
                    console.error('Error obteniendo contadores actualizados:', fetchError);
                    return { success: true, removed: true };
                }

                return { 
                    success: true, 
                    removed: true,
                    updatedVotes: {
                        likes: updatedMessage.likes,
                        dislikes: updatedMessage.dislikes
                    }
                };
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

            // Incrementar contador usando RPC
            const { error: incrementError } = await this.client.rpc('increment_vote', { 
                message_id: messageId, 
                vote_type: voteType 
            });

            if (incrementError) {
                console.error('Error incrementando voto:', incrementError);
            }

            // Obtener los contadores actualizados
            const { data: updatedMessage, error: fetchError } = await this.client
                .from('chat_messages')
                .select('likes, dislikes')
                .eq('id', messageId)
                .single();

            if (fetchError) {
                console.error('Error obteniendo contadores actualizados:', fetchError);
                return { success: true, newVote: voteType };
            }

            return { 
                success: true, 
                newVote: voteType,
                updatedVotes: {
                    likes: updatedMessage.likes,
                    dislikes: updatedMessage.dislikes
                }
            };
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

    // ==================== GESTIÓN DE BORRADO DE MENSAJES ====================

    async adminDeleteMessage(messageId, adminIdentifier) {
        if (!this.isOnline) {
            return this.adminDeleteMessageLocal(messageId, adminIdentifier);
        }

        try {
            // Usar la función RPC para borrado seguro
            const { data, error } = await this.client.rpc('admin_delete_message', {
                message_id_param: messageId,
                admin_identifier_param: adminIdentifier
            });

            if (error) {
                console.error('Error borrando mensaje en Supabase:', error);
                return {
                    success: false,
                    error: error.message
                };
            }

            if (data && data.success) {
                console.log('Mensaje borrado exitosamente por administrador');
                return {
                    success: true,
                    message: data.message
                };
            } else {
                return {
                    success: false,
                    error: data?.error || 'Error desconocido'
                };
            }

        } catch (error) {
            console.error('Error en adminDeleteMessage:', error);
            return this.adminDeleteMessageLocal(messageId, adminIdentifier);
        }
    }

    async adminRestoreMessage(messageId) {
        if (!this.isOnline) {
            return this.adminRestoreMessageLocal(messageId);
        }

        try {
            // Usar la función RPC para restaurar mensaje
            const { data, error } = await this.client.rpc('admin_restore_message', {
                message_id_param: messageId
            });

            if (error) {
                console.error('Error restaurando mensaje en Supabase:', error);
                return {
                    success: false,
                    error: error.message
                };
            }

            if (data && data.success) {
                console.log('Mensaje restaurado exitosamente');
                return {
                    success: true,
                    message: data.message
                };
            } else {
                return {
                    success: false,
                    error: data?.error || 'Error desconocido'
                };
            }

        } catch (error) {
            console.error('Error en adminRestoreMessage:', error);
            return this.adminRestoreMessageLocal(messageId);
        }
    }

    // ==================== FUNCIONES DE FALLBACK (localStorage) ====================

    createRoomLocal(room) {
        // Asegurar que las salas locales tengan la propiedad isActive
        if (room.isActive === undefined) {
            room.isActive = true;
        }
        localStorage.setItem(`room_${room.id}`, JSON.stringify(room));
        return room;
    }

    getRoomLocal(roomId) {
        const roomData = localStorage.getItem(`room_${roomId}`);
        return roomData ? JSON.parse(roomData) : null;
    }

    deleteRoomLocal(roomId) {
        console.log('Marcando sala como inactiva en localStorage:', roomId);
        const roomKey = `room_${roomId}`;
        const roomData = localStorage.getItem(roomKey);
        
        if (roomData) {
            try {
                const room = JSON.parse(roomData);
                // Soft delete: marcar como inactiva en lugar de eliminar
                room.isActive = false;
                localStorage.setItem(roomKey, JSON.stringify(room));
                console.log('✅ Sala marcada como inactiva en localStorage:', roomId);
            } catch (error) {
                console.error('Error marcando sala como inactiva:', error);
                // Fallback: eliminar completamente si no se puede parsear
                localStorage.removeItem(roomKey);
            }
        }
        
        return { success: true, useLocalStorage: true };
    }

    // 🔍 Fallback: Obtener salas activas de localStorage
    getAllActiveRoomsLocal() {
        const rooms = [];
        const keys = Object.keys(localStorage);
        
        keys.forEach(key => {
            if (key.startsWith('room_')) {
                try {
                    const roomData = localStorage.getItem(key);
                    if (roomData) {
                        const room = JSON.parse(roomData);
                        // En localStorage, consideramos activas todas las salas que no han expirado
                        // o que tienen isActive !== false
                        if (room.isActive !== false) {
                            rooms.push(room);
                        }
                    }
                } catch (error) {
                    console.error('Error cargando sala local:', key, error);
                }
            }
        });
        
        // Ordenar por fecha de creación (más recientes primero)
        rooms.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        console.log(`📋 localStorage: ${rooms.length} salas activas encontradas`);
        return rooms;
    }

    // 🔍 Fallback: Obtener todas las salas con estado de localStorage
    getAllRoomsWithStatusLocal() {
        const rooms = [];
        const keys = Object.keys(localStorage);
        
        keys.forEach(key => {
            if (key.startsWith('room_')) {
                try {
                    const roomData = localStorage.getItem(key);
                    if (roomData) {
                        const room = JSON.parse(roomData);
                        // Agregar isActive si no existe (compatibilidad con salas viejas)
                        if (room.isActive === undefined) {
                            room.isActive = true;
                        }
                        rooms.push(room);
                    }
                } catch (error) {
                    console.error('Error cargando sala local:', key, error);
                }
            }
        });
        
        // Ordenar por fecha de creación (más recientes primero)
        rooms.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        console.log(`📋 localStorage: ${rooms.length} salas totales encontradas`);
        return rooms;
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

    adminDeleteMessageLocal(messageId, adminIdentifier) {
        // Buscar el mensaje en localStorage
        const keys = Object.keys(localStorage);
        let messageFound = false;

        keys.forEach(key => {
            if (key.startsWith('room_')) {
                const roomData = localStorage.getItem(key);
                if (roomData) {
                    const room = JSON.parse(roomData);
                    const messageIndex = room.messages.findIndex(msg => msg.id === messageId);
                    
                    if (messageIndex !== -1) {
                        // Marcar mensaje como borrado
                        room.messages[messageIndex].isDeleted = true;
                        room.messages[messageIndex].deletedBy = adminIdentifier;
                        room.messages[messageIndex].deletedAt = new Date().toISOString();
                        
                        localStorage.setItem(key, JSON.stringify(room));
                        messageFound = true;
                    }
                }
            }
        });

        return {
            success: messageFound,
            error: messageFound ? null : 'Mensaje no encontrado'
        };
    }

    adminRestoreMessageLocal(messageId) {
        // Buscar el mensaje en localStorage
        const keys = Object.keys(localStorage);
        let messageFound = false;

        keys.forEach(key => {
            if (key.startsWith('room_')) {
                const roomData = localStorage.getItem(key);
                if (roomData) {
                    const room = JSON.parse(roomData);
                    const messageIndex = room.messages.findIndex(msg => msg.id === messageId);
                    
                    if (messageIndex !== -1) {
                        // Restaurar mensaje
                        room.messages[messageIndex].isDeleted = false;
                        room.messages[messageIndex].deletedBy = null;
                        room.messages[messageIndex].deletedAt = null;
                        
                        localStorage.setItem(key, JSON.stringify(room));
                        messageFound = true;
                    }
                }
            }
        });

        return {
            success: messageFound,
            error: messageFound ? null : 'Mensaje no encontrado'
        };
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
                            userIdentifier: payload.new.user_identifier,
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
    
    // =====================================================
    // FUNCIONES DE STORAGE PARA PDFs
    // =====================================================
    
    /**
     * Subir archivo PDF a Supabase Storage
     * @param {File} file - Archivo PDF
     * @param {string} roomId - ID de la sala
     * @param {string} uploadedBy - Usuario que sube el archivo
     * @returns {Promise<Object>} - Datos del archivo subido
     */
    async uploadPDFToStorage(file, roomId, uploadedBy) {
        if (!this.isSupabaseAvailable()) {
            throw new Error('Supabase no disponible');
        }
        
        try {
            // Generar nombre único
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substr(2, 9);
            const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const uniqueFileName = `${roomId}_${timestamp}_${randomId}_${safeFileName}`;
            
            // Subir a Storage
            const { data: uploadResult, error: uploadError } = await this.client.storage
                .from('chat-pdfs')
                .upload(uniqueFileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (uploadError) {
                throw new Error(`Error subiendo archivo: ${uploadError.message}`);
            }
            
            // Obtener URL pública
            const { data: urlData } = this.client.storage
                .from('chat-pdfs')
                .getPublicUrl(uniqueFileName);
            
            // Guardar metadata en BD
            const attachmentData = {
                filename: uniqueFileName,
                original_filename: file.name,
                file_path: uploadResult.path,
                file_size: file.size,
                mime_type: file.type,
                uploaded_by: uploadedBy,
                room_id: roomId
            };
            
            const { data: dbResult, error: dbError } = await this.client
                .from('chat_attachments')
                .insert([attachmentData])
                .select()
                .single();
            
            if (dbError) {
                // Si falla la BD, intentar eliminar el archivo subido
                await this.client.storage
                    .from('chat-pdfs')
                    .remove([uniqueFileName]);
                throw new Error(`Error guardando metadata: ${dbError.message}`);
            }
            
            return {
                ...dbResult,
                url: urlData.publicUrl
            };
            
        } catch (error) {
            console.error('Error en uploadPDFToStorage:', error);
            throw error;
        }
    }
    
    /**
     * Obtener PDFs de una sala
     * @param {string} roomId - ID de la sala
     * @returns {Promise<Array>} - Lista de PDFs
     */
    async getRoomPDFsFromStorage(roomId) {
        if (!this.isSupabaseAvailable()) {
            return [];
        }
        
        try {
            const { data, error } = await this.client
                .from('chat_attachments')
                .select('*')
                .eq('room_id', roomId)
                .eq('is_active', true)
                .order('created_at', { ascending: false });
            
            if (error) {
                throw new Error(`Error obteniendo PDFs: ${error.message}`);
            }
            
            // Agregar URLs públicas
            return data.map(attachment => ({
                ...attachment,
                url: this.client.storage
                    .from('chat-pdfs')
                    .getPublicUrl(attachment.filename).data.publicUrl
            }));
            
        } catch (error) {
            console.error('Error en getRoomPDFsFromStorage:', error);
            return [];
        }
    }
    
    /**
     * Eliminar PDF (soft delete)
     * @param {string} attachmentId - ID del attachment
     * @returns {Promise<boolean>} - Éxito de la operación
     */
    async deletePDFFromStorage(attachmentId) {
        if (!this.isSupabaseAvailable()) {
            return false;
        }
        
        try {
            const { error } = await this.client
                .from('chat_attachments')
                .update({ is_active: false })
                .eq('id', attachmentId);
            
            if (error) {
                throw new Error(`Error eliminando PDF: ${error.message}`);
            }
            
            return true;
            
        } catch (error) {
            console.error('Error en deletePDFFromStorage:', error);
            return false;
        }
    }
    
    /**
     * Vincular PDF a un mensaje
     * @param {string} attachmentId - ID del attachment
     * @param {string} messageId - ID del mensaje
     * @returns {Promise<boolean>} - Éxito de la operación
     */
    async linkPDFToMessage(attachmentId, messageId) {
        if (!this.isSupabaseAvailable()) {
            return false;
        }
        
        try {
            const { error } = await this.client
                .from('chat_attachments')
                .update({ message_id: messageId })
                .eq('id', attachmentId);
            
            if (error) {
                throw new Error(`Error vinculando PDF a mensaje: ${error.message}`);
            }
            
            return true;
            
        } catch (error) {
            console.error('Error en linkPDFToMessage:', error);
            return false;
        }
    }
    
    /**
     * Obtener estadísticas de PDFs de una sala
     * @param {string} roomId - ID de la sala
     * @returns {Promise<Object>} - Estadísticas
     */
    async getRoomPDFStats(roomId) {
        if (!this.isSupabaseAvailable()) {
            return { totalFiles: 0, totalSizeMB: 0, mostRecent: null };
        }
        
        try {
            // Usar función SQL si existe, sino calcular manualmente
            const { data, error } = await this.client
                .rpc('get_room_attachments_stats', { room_id_param: roomId });
            
            if (error || !data || data.length === 0) {
                // Fallback: calcular manualmente
                const pdfs = await this.getRoomPDFsFromStorage(roomId);
                const totalFiles = pdfs.length;
                const totalSize = pdfs.reduce((sum, pdf) => sum + pdf.file_size, 0);
                const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
                const mostRecent = pdfs.length > 0 ? pdfs[0].created_at : null;
                
                return { totalFiles, totalSizeMB, mostRecent };
            }
            
            return data[0]; // RPC devuelve array con un elemento
            
        } catch (error) {
            console.error('Error en getRoomPDFStats:', error);
            return { totalFiles: 0, totalSizeMB: 0, mostRecent: null };
        }
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
    message_limit INTEGER DEFAULT 200
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