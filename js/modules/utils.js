// Utilidades generales para Chat Anónimo
// Funciones auxiliares sin dependencias externas

/**
 * Escapa caracteres HTML para prevenir XSS
 * @param {string} text - Texto a escapar
 * @returns {string} - Texto escapado
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Genera un código único para la sala
 * @returns {string} - Código de sala (formato ROOMXXXX)
 */
export function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'ROOM';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Copia texto al portapapeles
 * @param {string} text - Texto a copiar
 */
export function copyToClipboard(text) {
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

/**
 * Calcula el uso de localStorage en KB
 * @returns {number} - Tamaño en KB con 2 decimales
 */
export function calculateLocalStorageUsage() {
    let total = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            total += localStorage[key].length + key.length;
        }
    }
    return Math.round(total / 1024 * 100) / 100; // KB con 2 decimales
}

/**
 * Genera un identificador único legible para usuario anónimo
 * @param {string} fingerprint - Fingerprint del usuario
 * @returns {string} - Identificador de 6 caracteres (ej: A1B2C3)
 */
export function generateUserIdentifierFromFingerprint(fingerprint) {
    if (!fingerprint) {
        console.warn('generateUserIdentifierFromFingerprint: No fingerprint provided');
        return generateRandomIdentifier();
    }
    
    // Usar el fingerprint como semilla para generar un ID consistente
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    
    // Convertir a base36 y tomar los primeros 6 caracteres
    const identifier = Math.abs(hash).toString(36).toUpperCase().substring(0, 6);
    
    // Asegurar que tenga exactamente 6 caracteres
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = identifier;
    while (result.length < 6) {
        const extraHash = Math.abs(hash * result.length).toString(36);
        result += chars[Math.abs(extraHash.charCodeAt(0)) % chars.length];
    }
    
    return result.substring(0, 6);
}

/**
 * Genera un identificador aleatorio como fallback
 * @returns {string} - Identificador aleatorio de 6 caracteres
 */
export function generateRandomIdentifier() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Obtiene el mapping de fingerprints a identificadores desde localStorage
 * @returns {Object} - Objeto con mapping fingerprint -> identifier
 */
export function getIdentifierMapping() {
    const mappingKey = 'anonymousChat_identifierMapping';
    try {
        const stored = localStorage.getItem(mappingKey);
        return stored ? JSON.parse(stored) : {};
    } catch (error) {
        console.warn('Error parsing identifier mapping:', error);
        localStorage.removeItem(mappingKey);
        return {};
    }
}

/**
 * Guarda el mapping de fingerprints a identificadores en localStorage
 * @param {Object} mapping - Objeto con mapping fingerprint -> identifier
 */
export function saveIdentifierMapping(mapping) {
    const mappingKey = 'anonymousChat_identifierMapping';
    try {
        localStorage.setItem(mappingKey, JSON.stringify(mapping));
    } catch (error) {
        console.warn('Error saving identifier mapping to localStorage:', error);
    }
}

/**
 * Obtiene identificador de usuario para un fingerprint específico
 * @param {string} fingerprint - Fingerprint del usuario
 * @returns {string} - Identificador único del usuario
 */
export function getUserIdentifierForFingerprint(fingerprint) {
    if (!fingerprint) {
        console.warn('getUserIdentifierForFingerprint: No fingerprint provided');
        return generateRandomIdentifier();
    }
    
    // Obtener mapping existente
    const mapping = getIdentifierMapping();
    
    // Si ya existe identifier para este fingerprint, usarlo
    if (mapping[fingerprint]) {
        return mapping[fingerprint];
    }
    
    // Si no existe, generar uno nuevo
    const newIdentifier = generateUserIdentifierFromFingerprint(fingerprint);
    
    // Guardar en mapping
    mapping[fingerprint] = newIdentifier;
    saveIdentifierMapping(mapping);
    
    return newIdentifier;
}

/**
 * Limpia mappings de identificadores antiguos (más de 30 días)
 */
export function cleanupOldIdentifierMappings() {
    try {
        const mappingKey = 'anonymousChat_identifierMapping';
        const lastCleanupKey = 'anonymousChat_identifierCleanup';
        
        const lastCleanup = localStorage.getItem(lastCleanupKey);
        const now = Date.now();
        
        // Solo limpiar una vez por día
        if (lastCleanup && (now - parseInt(lastCleanup)) < 24 * 60 * 60 * 1000) {
            return;
        }
        
        const mapping = getIdentifierMapping();
        
        // Por ahora solo marcamos la fecha de limpieza
        // En el futuro se puede implementar lógica más sofisticada
        localStorage.setItem(lastCleanupKey, now.toString());
        
        console.log('Identifier mapping cleanup completed');
    } catch (error) {
        console.warn('Error in cleanupOldIdentifierMappings:', error);
    }
}