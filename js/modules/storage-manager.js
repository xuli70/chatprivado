// Storage Manager Module
// Gestión completa de persistencia de datos (Supabase + localStorage)

export async function saveRoom(room, supabaseClient, saveCurrentSessionCallback) {
    if (supabaseClient && supabaseClient.isSupabaseAvailable()) {
        try {
            await supabaseClient.createRoom(room);
        } catch (error) {
            console.error('Error guardando sala en Supabase:', error);
            // Fallback a localStorage
            localStorage.setItem(`room_${room.id}`, JSON.stringify(room));
        }
    } else {
        // Fallback a localStorage
        localStorage.setItem(`room_${room.id}`, JSON.stringify(room));
    }
    
    saveUserVotes();
    
    // Guardar sesión actual para persistencia
    if (saveCurrentSessionCallback) {
        saveCurrentSessionCallback();
    }
}

export async function loadRoom(roomId, supabaseClient) {
    if (supabaseClient && supabaseClient.isSupabaseAvailable()) {
        try {
            const room = await supabaseClient.getRoom(roomId);
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

export function saveUserVotes(userVotesMap) {
    if (!userVotesMap) {
        console.warn('saveUserVotes: No userVotesMap provided');
        return;
    }
    
    const votesData = Object.fromEntries(userVotesMap);
    localStorage.setItem('userVotes', JSON.stringify(votesData));
}

export function loadFromStorage(config = {}) {
    const result = {
        userVotes: new Map(),
        cleanupPerformed: false
    };
    
    // Cargar votos del usuario
    const votesData = localStorage.getItem('userVotes');
    if (votesData) {
        try {
            const votes = JSON.parse(votesData);
            result.userVotes = new Map(Object.entries(votes));
        } catch (error) {
            console.error('Error parsing userVotes from localStorage:', error);
            result.userVotes = new Map();
        }
    }

    // Limpiar salas expiradas automáticamente
    if (config.autoCleanup) {
        result.cleanupPerformed = cleanupExpiredRooms();
    }
    
    return result;
}

export function isRoomExpired(room) {
    // DESHABILITADO: Las salas NO expiran automáticamente
    // Solo el administrador puede desactivar salas manualmente
    return false;
    
    /* Código original comentado para referencia:
    const now = new Date();
    const expiresAt = new Date(room.expiresAt);
    const isExpired = now > expiresAt;
    
    // DEBUG: Log detallado de expiración
    if (room.id && room.id.startsWith('TEST')) {
        console.log(`EXPIRATION CHECK para ${room.id}:`, {
            now: now.toISOString(),
            expiresAt: room.expiresAt,
            expiresAtDate: expiresAt.toISOString(),
            isExpired: isExpired,
            timeUntilExpiry: Math.round((expiresAt - now) / 1000 / 60) + ' minutos'
        });
    }
    
    return isExpired;
    */
}

export function cleanupExpiredRooms() {
    // DESHABILITADO: No limpiamos salas "expiradas" automáticamente
    // Las salas solo se eliminan por acción manual del administrador
    return false;
    
    /* Código original comentado:
    const keys = Object.keys(localStorage);
    let cleanedCount = 0;
    
    keys.forEach(key => {
        if (key.startsWith('room_')) {
            const roomData = localStorage.getItem(key);
            if (roomData) {
                try {
                    const room = JSON.parse(roomData);
                    if (isRoomExpired(room)) {
                        localStorage.removeItem(key);
                        cleanedCount++;
                    }
                } catch (error) {
                    console.error('Error parsing room data for cleanup:', error);
                    // Remove corrupted data
                    localStorage.removeItem(key);
                    cleanedCount++;
                }
            }
        }
    });
    
    if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired rooms`);
    }
    
    return cleanedCount > 0;
    */
}

// Función auxiliar para obtener estadísticas de almacenamiento
export function getStorageStats() {
    const stats = {
        rooms: 0,
        votes: 0,
        sessions: 0,
        totalKeys: 0,
        storageUsage: {
            used: 0,
            total: 5 * 1024 * 1024 // 5MB típico en navegadores
        }
    };
    
    try {
        const keys = Object.keys(localStorage);
        stats.totalKeys = keys.length;
        
        keys.forEach(key => {
            if (key.startsWith('room_')) {
                stats.rooms++;
            } else if (key === 'userVotes') {
                stats.votes++;
            } else if (key === 'currentSession') {
                stats.sessions++;
            }
            
            // Calcular uso aproximado
            const value = localStorage.getItem(key);
            if (value) {
                stats.storageUsage.used += (key.length + value.length) * 2; // UTF-16
            }
        });
        
        // Calcular porcentaje de uso
        stats.storageUsage.percentage = (stats.storageUsage.used / stats.storageUsage.total * 100).toFixed(1);
        
    } catch (error) {
        console.error('Error calculating storage stats:', error);
    }
    
    return stats;
}

// Función auxiliar para limpiar datos corruptos
export function cleanupCorruptedData() {
    const keys = Object.keys(localStorage);
    let cleanedCount = 0;
    
    keys.forEach(key => {
        if (key.startsWith('room_') || key === 'userVotes' || key === 'currentSession') {
            const value = localStorage.getItem(key);
            if (value) {
                try {
                    JSON.parse(value);
                } catch (error) {
                    console.warn(`Removing corrupted data for key: ${key}`);
                    localStorage.removeItem(key);
                    cleanedCount++;
                }
            }
        }
    });
    
    return cleanedCount;
}