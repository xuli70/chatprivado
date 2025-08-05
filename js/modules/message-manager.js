// Message Manager Module
// Gestión completa de mensajería (envío, renderizado, carga, procesamiento)

// Importar funciones necesarias de otros módulos
import { escapeHtml } from './utils.js';

export async function sendMessage(roomId, message, supabaseClient) {
    if (!roomId || !message) {
        console.error('sendMessage: roomId and message are required');
        return null;
    }

    if (supabaseClient && supabaseClient.isSupabaseAvailable()) {
        try {
            return await supabaseClient.sendMessage(roomId, message);
        } catch (error) {
            console.error('Error enviando mensaje a Supabase:', error);
            return null;
        }
    }
    
    console.warn('sendMessage: Supabase not available, message not sent');
    return null;
}

export function loadMessages(currentRoom, elements, callbacks = {}) {
    if (!currentRoom || !elements || !elements.displays || !elements.displays.chatMessages) {
        console.error('loadMessages: Invalid parameters');
        return;
    }

    // Limpiar mensajes existentes
    elements.displays.chatMessages.innerHTML = '';
    
    if (!currentRoom.messages || !currentRoom.messages.length) {
        if (callbacks.showEmptyState) {
            callbacks.showEmptyState();
        }
        return;
    }

    currentRoom.messages.forEach(message => {
        addMessageToChat(message, elements, false, callbacks);
        
        // Restaurar estado de votos del usuario si se proporcionó callback
        if (callbacks.updateVoteButtonStates && callbacks.getUserVote) {
            const userVote = callbacks.getUserVote(currentRoom.id, message.id);
            if (userVote) {
                callbacks.updateVoteButtonStates(message.id, userVote);
            }
        }
    });
}

export function addMessageToChat(message, elements, isRealtime = false, callbacks = {}) {
    if (!message || !elements || !elements.displays || !elements.displays.chatMessages) {
        console.error('addMessageToChat: Invalid parameters');
        return null;
    }

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

    // Escapar HTML de forma segura
    const escapedText = escapeHtml(message.text);

    messageEl.innerHTML = `
        <div class="message-header">
            <span class="message-author">${message.author}</span>
            <span class="message-time">${timeStr}</span>
            ${isRealtime ? '<span class="realtime-indicator">📡</span>' : ''}
        </div>
        <div class="message-content">${escapedText}</div>
        <div class="message-actions">
            <button class="vote-btn like-btn" data-message-id="${message.id}" data-vote-type="like">
                👍 <span class="vote-count">${message.votes.likes}</span>
            </button>
            <button class="vote-btn dislike-btn" data-message-id="${message.id}" data-vote-type="dislike">
                👎 <span class="vote-count">${message.votes.dislikes}</span>
            </button>
        </div>
    `;

    elements.displays.chatMessages.appendChild(messageEl);
    
    // Efectos visuales para mensajes en tiempo real
    if (isRealtime) {
        // Resaltar brevemente el mensaje nuevo
        setTimeout(() => {
            messageEl.classList.add('message-highlight');
            setTimeout(() => {
                messageEl.classList.remove('message-highlight', 'realtime-indicator');
            }, 2000);
        }, 100);
    }
    
    // Scroll suave al mensaje
    messageEl.scrollIntoView({ behavior: 'smooth', block: 'end' });

    // Bind voting events si se proporcionó callback
    if (callbacks.handleVote) {
        const voteButtons = messageEl.querySelectorAll('.vote-btn');
        voteButtons.forEach(btn => {
            btn.addEventListener('click', callbacks.handleVote);
        });
    }

    return messageEl;
}

export function processMessage(messageText, user, roomId) {
    if (!messageText || !user || !roomId) {
        return null;
    }

    // Limpiar y validar el mensaje
    const cleanedText = messageText.trim();
    if (!cleanedText) {
        return null;
    }

    // Crear objeto mensaje
    const message = {
        id: Date.now(), // Timestamp como ID único
        text: cleanedText,
        isAnonymous: !user.isCreator || user.adminIncognito,
        author: (!user.isCreator || user.adminIncognito) ? 'Anónimo' : user.name,
        timestamp: new Date().toISOString(),
        votes: {
            likes: 0,
            dislikes: 0
        }
    };

    return message;
}

export function formatMessage(message) {
    if (!message) {
        return null;
    }

    // Crear una copia del mensaje con formato mejorado
    const formatted = { ...message };

    // Formatear timestamp
    if (formatted.timestamp) {
        formatted.formattedTime = new Date(formatted.timestamp).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        formatted.formattedDate = new Date(formatted.timestamp).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    // Formatear texto con seguridad
    if (formatted.text) {
        formatted.escapedText = escapeHtml(formatted.text);
        formatted.textLength = formatted.text.length;
    }

    // Información adicional
    formatted.isCreatorMessage = !formatted.isAnonymous;
    formatted.totalVotes = (formatted.votes?.likes || 0) + (formatted.votes?.dislikes || 0);
    formatted.voteRatio = formatted.totalVotes > 0 ? 
        ((formatted.votes?.likes || 0) / formatted.totalVotes * 100).toFixed(1) : 0;

    return formatted;
}

export function searchMessages(messages, query, options = {}) {
    if (!messages || !Array.isArray(messages) || !query) {
        return [];
    }

    const searchTerm = query.toLowerCase().trim();
    if (!searchTerm) {
        return messages;
    }

    const {
        searchInAuthor = true,
        searchInContent = true,
        caseSensitive = false,
        limit = null
    } = options;

    const results = messages.filter(message => {
        if (!message) return false;

        let matches = false;

        // Buscar en contenido
        if (searchInContent && message.text) {
            const text = caseSensitive ? message.text : message.text.toLowerCase();
            matches = matches || text.includes(caseSensitive ? query : searchTerm);
        }

        // Buscar en autor
        if (searchInAuthor && message.author) {
            const author = caseSensitive ? message.author : message.author.toLowerCase();
            matches = matches || author.includes(caseSensitive ? query : searchTerm);
        }

        return matches;
    });

    return limit ? results.slice(0, limit) : results;
}

export function getMessageStats(messages) {
    if (!messages || !Array.isArray(messages)) {
        return {
            total: 0,
            anonymous: 0,
            creator: 0,
            totalVotes: 0,
            totalLikes: 0,
            totalDislikes: 0,
            averageLength: 0,
            mostVoted: null,
            mostRecent: null
        };
    }

    const stats = {
        total: messages.length,
        anonymous: 0,
        creator: 0,
        totalVotes: 0,
        totalLikes: 0,
        totalDislikes: 0,
        averageLength: 0,
        mostVoted: null,
        mostRecent: null
    };

    if (messages.length === 0) {
        return stats;
    }

    let totalCharacters = 0;
    let maxVotes = -1;
    let mostRecentTime = 0;

    messages.forEach(message => {
        // Contar tipos de mensajes
        if (message.isAnonymous) {
            stats.anonymous++;
        } else {
            stats.creator++;
        }

        // Contar votos
        const likes = message.votes?.likes || 0;
        const dislikes = message.votes?.dislikes || 0;
        stats.totalLikes += likes;
        stats.totalDislikes += dislikes;
        stats.totalVotes += likes + dislikes;

        // Longitud de texto
        if (message.text) {
            totalCharacters += message.text.length;
        }

        // Mensaje más votado
        const messageVotes = likes + dislikes;
        if (messageVotes > maxVotes) {
            maxVotes = messageVotes;
            stats.mostVoted = message;
        }

        // Mensaje más reciente
        const messageTime = new Date(message.timestamp).getTime();
        if (messageTime > mostRecentTime) {
            mostRecentTime = messageTime;
            stats.mostRecent = message;
        }
    });

    stats.averageLength = Math.round(totalCharacters / messages.length);

    return stats;
}

export function validateMessage(message) {
    if (!message || typeof message !== 'object') {
        return {
            isValid: false,
            errors: ['Message is not an object']
        };
    }

    const errors = [];

    // Validar campos requeridos
    if (!message.id) {
        errors.push('Missing message ID');
    }

    if (!message.text || typeof message.text !== 'string') {
        errors.push('Missing or invalid message text');
    }

    if (typeof message.isAnonymous !== 'boolean') {
        errors.push('Missing or invalid isAnonymous flag');
    }

    if (!message.author || typeof message.author !== 'string') {
        errors.push('Missing or invalid author');
    }

    if (!message.timestamp) {
        errors.push('Missing timestamp');
    } else {
        const date = new Date(message.timestamp);
        if (isNaN(date.getTime())) {
            errors.push('Invalid timestamp format');
        }
    }

    // Validar votos
    if (!message.votes || typeof message.votes !== 'object') {
        errors.push('Missing or invalid votes object');
    } else {
        if (typeof message.votes.likes !== 'number' || message.votes.likes < 0) {
            errors.push('Invalid likes count');
        }
        if (typeof message.votes.dislikes !== 'number' || message.votes.dislikes < 0) {
            errors.push('Invalid dislikes count');
        }
    }

    // Validar longitud del texto
    if (message.text && message.text.length > 280) {
        errors.push('Message text exceeds 280 characters');
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

export function sortMessages(messages, sortBy = 'timestamp', order = 'asc') {
    if (!messages || !Array.isArray(messages)) {
        return [];
    }

    const sortedMessages = [...messages];

    sortedMessages.sort((a, b) => {
        let valueA, valueB;

        switch (sortBy) {
            case 'timestamp':
                valueA = new Date(a.timestamp).getTime();
                valueB = new Date(b.timestamp).getTime();
                break;
            case 'votes':
                valueA = (a.votes?.likes || 0) + (a.votes?.dislikes || 0);
                valueB = (b.votes?.likes || 0) + (b.votes?.dislikes || 0);
                break;
            case 'likes':
                valueA = a.votes?.likes || 0;
                valueB = b.votes?.likes || 0;
                break;
            case 'author':
                valueA = a.author || '';
                valueB = b.author || '';
                break;
            case 'length':
                valueA = a.text ? a.text.length : 0;
                valueB = b.text ? b.text.length : 0;
                break;
            default:
                valueA = a[sortBy];
                valueB = b[sortBy];
        }

        if (order === 'desc') {
            return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
        } else {
            return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
        }
    });

    return sortedMessages;
}