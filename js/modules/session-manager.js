// Session Manager Module
// Gestión completa de sesiones de usuario (persistencia, restauración, limpieza)

export function saveCurrentSession(currentRoom, currentUser, isAdmin = false) {
    if (!currentRoom || !currentUser) {
        // No hay sesión activa para guardar
        localStorage.removeItem('currentSession');
        return false;
    }

    const sessionData = {
        roomId: currentRoom.id,
        user: {
            name: currentUser.name,
            isCreator: currentUser.isCreator,
            adminIncognito: currentUser.adminIncognito || false
        },
        isAdmin: isAdmin || false,
        timestamp: new Date().toISOString()
    };

    try {
        localStorage.setItem('currentSession', JSON.stringify(sessionData));
        console.log('Sesión guardada:', sessionData);
        return true;
    } catch (error) {
        console.error('Error guardando sesión:', error);
        return false;
    }
}

export async function restoreSession(loadRoomCallback, isRoomExpiredCallback) {
    const sessionData = localStorage.getItem('currentSession');
    if (!sessionData) {
        console.log('No hay sesión guardada para restaurar');
        return { success: false, reason: 'no_session' };
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
            return { success: false, reason: 'session_expired' };
        }

        // Cargar la sala usando el callback proporcionado
        if (!loadRoomCallback) {
            console.error('loadRoomCallback not provided');
            return { success: false, reason: 'no_callback' };
        }

        const room = await loadRoomCallback(session.roomId);
        if (!room) {
            console.log('Sala no encontrada, eliminando sesión');
            localStorage.removeItem('currentSession');
            return { success: false, reason: 'room_not_found' };
        }

        // Verificar que la sala no haya expirado usando el callback
        if (isRoomExpiredCallback && isRoomExpiredCallback(room)) {
            console.log('Sala expirada, eliminando sesión');
            localStorage.removeItem('currentSession');
            return { success: false, reason: 'room_expired' };
        }

        console.log('Sesión restaurada exitosamente:', {
            isAdmin: session.isAdmin,
            user: session.user
        });

        return {
            success: true,
            sessionData: {
                currentRoom: room,
                currentUser: session.user,
                isAdmin: session.isAdmin || false
            }
        };

    } catch (error) {
        console.error('Error restaurando sesión:', error);
        localStorage.removeItem('currentSession');
        return { success: false, reason: 'restore_error', error: error.message };
    }
}

export function clearCurrentSession() {
    try {
        localStorage.removeItem('currentSession');
        console.log('Sesión actual eliminada');
        return true;
    } catch (error) {
        console.error('Error eliminando sesión:', error);
        return false;
    }
}

export function getCurrentSession() {
    try {
        const sessionData = localStorage.getItem('currentSession');
        if (!sessionData) {
            return null;
        }

        const session = JSON.parse(sessionData);
        
        // Verificar si la sesión es válida (no muy antigua)
        const sessionTime = new Date(session.timestamp);
        const now = new Date();
        const timeDiff = now - sessionTime;
        const maxSessionTime = 24 * 60 * 60 * 1000; // 24 horas

        if (timeDiff > maxSessionTime) {
            localStorage.removeItem('currentSession');
            return null;
        }

        return session;
    } catch (error) {
        console.error('Error obteniendo sesión actual:', error);
        localStorage.removeItem('currentSession');
        return null;
    }
}

export function getSessionStats() {
    const session = getCurrentSession();
    
    if (!session) {
        return {
            hasSession: false,
            sessionAge: 0,
            isExpired: true,
            roomId: null,
            userType: null
        };
    }

    const sessionTime = new Date(session.timestamp);
    const now = new Date();
    const sessionAge = now - sessionTime;
    const maxSessionTime = 24 * 60 * 60 * 1000; // 24 horas
    
    return {
        hasSession: true,
        sessionAge: sessionAge,
        sessionAgeHours: Math.round(sessionAge / (60 * 60 * 1000) * 100) / 100,
        isExpired: sessionAge > maxSessionTime,
        roomId: session.roomId,
        userType: session.user.isCreator ? 'creator' : 'participant',
        isAdmin: session.isAdmin || false,
        adminIncognito: session.user.adminIncognito || false,
        timestamp: session.timestamp
    };
}

export function validateSession(session = null) {
    const sessionToValidate = session || getCurrentSession();
    
    if (!sessionToValidate) {
        return {
            isValid: false,
            issues: ['no_session']
        };
    }

    const issues = [];
    
    // Verificar estructura requerida
    if (!sessionToValidate.roomId) {
        issues.push('missing_room_id');
    }
    
    if (!sessionToValidate.user || !sessionToValidate.user.name) {
        issues.push('missing_user_data');
    }
    
    if (!sessionToValidate.timestamp) {
        issues.push('missing_timestamp');
    }
    
    // Verificar edad de la sesión
    if (sessionToValidate.timestamp) {
        const sessionTime = new Date(sessionToValidate.timestamp);
        const now = new Date();
        const timeDiff = now - sessionTime;
        const maxSessionTime = 24 * 60 * 60 * 1000; // 24 horas
        
        if (timeDiff > maxSessionTime) {
            issues.push('session_expired');
        }
        
        if (isNaN(sessionTime.getTime())) {
            issues.push('invalid_timestamp');
        }
    }

    return {
        isValid: issues.length === 0,
        issues: issues,
        sessionAge: sessionToValidate.timestamp ? 
            new Date() - new Date(sessionToValidate.timestamp) : 0
    };
}

export function cleanupExpiredSessions() {
    const session = getCurrentSession();
    
    if (!session) {
        return { cleaned: false, reason: 'no_session_found' };
    }
    
    const validation = validateSession(session);
    
    if (!validation.isValid && validation.issues.includes('session_expired')) {
        clearCurrentSession();
        return { 
            cleaned: true, 
            reason: 'session_expired',
            sessionAge: validation.sessionAge 
        };
    }
    
    return { 
        cleaned: false, 
        reason: 'session_still_valid',
        sessionAge: validation.sessionAge 
    };
}

export function updateSessionTimestamp() {
    const session = getCurrentSession();
    
    if (!session) {
        return false;
    }
    
    try {
        session.timestamp = new Date().toISOString();
        localStorage.setItem('currentSession', JSON.stringify(session));
        console.log('Timestamp de sesión actualizado');
        return true;
    } catch (error) {
        console.error('Error actualizando timestamp de sesión:', error);
        return false;
    }
}