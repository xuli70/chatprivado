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