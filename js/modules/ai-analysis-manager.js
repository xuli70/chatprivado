/**
 * AI Analysis Manager
 * Sistema de análisis inteligente de mensajes de chat usando OpenAI
 * Módulo completamente independiente y autónomo
 */

// Import necesario para obtener mensajes de la base de datos
import { getAllRoomMessagesFromDB } from './message-manager.js';

export class AiAnalysisManager {
    constructor() {
        this.apiKey = window.env?.OPENAI_API_KEY || '';
        this.model = window.env?.AI_MODEL || 'gpt-4o-mini';
        this.cache = new Map(); // Cache de análisis para evitar re-análisis costosos
        this.isAnalyzing = false;
        
        // Límites de rate limiting
        this.maxTokensPerRequest = 4000;
        this.lastRequestTime = 0;
        this.minRequestInterval = 3000; // 3 segundos entre requests
        
        console.log('🤖 AI Analysis Manager inicializado');
    }

    /**
     * Inicializar el módulo IA
     * Método público que configura event listeners y UI
     */
    init() {
        this.setupEventListeners();
        this.checkApiKeyAvailability();
    }

    /**
     * Verificar disponibilidad de API Key
     */
    checkApiKeyAvailability() {
        if (!this.apiKey || this.apiKey.trim() === '') {
            console.warn('⚠️ OpenAI API Key no configurada - Funciones IA deshabilitadas');
            this.disableAiFeatures();
            return false;
        }
        
        console.log('✅ OpenAI API Key configurada correctamente');
        return true;
    }

    /**
     * Configurar event listeners para botones IA
     */
    setupEventListeners() {
        // Buscar botón IA en admin panel (se creará en index.html)
        const aiButton = document.getElementById('aiAnalysisBtn');
        if (aiButton) {
            aiButton.addEventListener('click', () => this.openAnalysisModal());
        }

        // Event listeners para opciones de análisis
        this.setupAnalysisOptions();
    }

    /**
     * Configurar opciones de análisis en modal
     */
    setupAnalysisOptions() {
        // Sentiment Analysis
        const sentimentBtn = document.getElementById('analysisOptionSentiment');
        if (sentimentBtn) {
            sentimentBtn.addEventListener('click', () => this.runAnalysis('sentiment'));
        }

        // Topic Analysis  
        const topicBtn = document.getElementById('analysisOptionTopic');
        if (topicBtn) {
            topicBtn.addEventListener('click', () => this.runAnalysis('topic'));
        }

        // Summary Analysis
        const summaryBtn = document.getElementById('analysisOptionSummary');
        if (summaryBtn) {
            summaryBtn.addEventListener('click', () => this.runAnalysis('summary'));
        }
    }

    /**
     * Abrir modal de análisis IA
     */
    openAnalysisModal() {
        console.log('🤖 Intentando abrir modal de análisis IA...');
        
        const modal = document.getElementById('aiAnalysisModal');
        if (!modal) {
            console.error('❌ Modal aiAnalysisModal no encontrado en DOM');
            this.showToast('Error: Modal IA no encontrado', 'error');
            return;
        }

        // Siempre mostrar el modal, independientemente de la API Key
        modal.style.display = 'flex';
        modal.classList.remove('hidden');
        
        // Reset resultados previos
        this.clearPreviousResults();
        
        // Verificar API Key después de mostrar el modal
        if (!this.checkApiKeyAvailability()) {
            const resultContainer = document.getElementById('aiAnalysisResult');
            if (resultContainer) {
                resultContainer.innerHTML = `
                    <div class="ai-error">
                        <h4>⚠️ Configuración Requerida</h4>
                        <p>OpenAI API Key no configurada.</p>
                        <p>Configure OPENAI_API_KEY en las variables de entorno para usar el análisis IA.</p>
                        <p><small>El modal se muestra para testing, pero las funciones IA están deshabilitadas.</small></p>
                    </div>
                `;
            }
        }
        
        console.log('✅ Modal de análisis IA abierto');
    }

    /**
     * Cerrar modal de análisis IA
     */
    closeAnalysisModal() {
        const modal = document.getElementById('aiAnalysisModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.add('hidden');
            console.log('🤖 Modal de análisis IA cerrado');
        }
    }

    /**
     * Ejecutar análisis según el tipo seleccionado
     */
    async runAnalysis(analysisType) {
        if (this.isAnalyzing) {
            this.showError('Análisis en progreso, por favor espere...');
            return;
        }

        // Rate limiting check
        const now = Date.now();
        if (now - this.lastRequestTime < this.minRequestInterval) {
            const waitTime = Math.ceil((this.minRequestInterval - (now - this.lastRequestTime)) / 1000);
            this.showError(`Por favor espere ${waitTime} segundos antes del próximo análisis.`);
            return;
        }

        try {
            this.isAnalyzing = true;
            this.showLoadingState(analysisType);

            // Obtener mensajes del chat actual desde la base de datos
            const messages = await this.getMessagesFromCurrentRoom();
            
            if (!messages || messages.length === 0) {
                throw new Error('No hay mensajes para analizar en la sala actual.');
            }

            // Verificar cache
            const cacheKey = this.generateCacheKey(messages, analysisType);
            if (this.cache.has(cacheKey)) {
                console.log('📋 Usando resultado del cache');
                const cachedResult = this.cache.get(cacheKey);
                this.showAnalysisResult(analysisType, cachedResult);
                return;
            }

            // Ejecutar análisis con OpenAI
            const result = await this.performOpenAIAnalysis(messages, analysisType);
            
            // Guardar en cache
            this.cache.set(cacheKey, result);
            
            // Mostrar resultado
            this.showAnalysisResult(analysisType, result);
            
            this.lastRequestTime = Date.now();

        } catch (error) {
            console.error('❌ Error en análisis IA:', error);
            this.showError(`Error en el análisis: ${error.message}`);
        } finally {
            this.isAnalyzing = false;
            this.hideLoadingState();
        }
    }

    /**
     * Obtener TODOS los mensajes de la sala actual desde la base de datos
     * Versión mejorada que accede directamente a Supabase
     */
    async getMessagesFromCurrentRoom() {
        try {
            // Obtener sala actual desde la aplicación global
            const currentRoom = window.chatApp?.state?.currentRoom;
            const supabaseClient = window.chatApp?.supabaseClient;

            if (!currentRoom) {
                throw new Error('No hay sala activa');
            }

            if (!supabaseClient) {
                console.warn('Supabase no disponible, intentando fallback DOM');
                return this.getMessagesFromDOM();
            }

            console.log(`🔍 Obteniendo mensajes de sala ${currentRoom.id} desde base de datos...`);

            // Usar la nueva función para obtener TODOS los mensajes
            const messages = await getAllRoomMessagesFromDB(currentRoom.id, supabaseClient);

            if (messages.length === 0) {
                throw new Error(`No se encontraron mensajes en la sala ${currentRoom.id}`);
            }

            // Procesar mensajes para el análisis IA
            const processedMessages = messages.map(msg => ({
                id: msg.id,
                text: msg.text,
                author: this.formatAuthorForAnalysis(msg.author, msg.isAnonymous, msg.userIdentifier),
                timestamp: this.formatTimestamp(msg.timestamp),
                votes: msg.votes,
                isAnonymous: msg.isAnonymous,
                userIdentifier: msg.userIdentifier
            }));

            // Limitar a últimos 200 mensajes (nuevo límite del sistema)
            const limitedMessages = processedMessages.slice(-200);
            
            console.log(`📊 Preparados ${limitedMessages.length} mensajes para análisis IA`);
            return limitedMessages;

        } catch (error) {
            console.error('Error obteniendo mensajes de BD:', error);
            
            // Fallback al DOM si hay problemas con la BD
            console.log('🔄 Usando fallback: mensajes del DOM');
            return this.getMessagesFromDOM();
        }
    }

    /**
     * Fallback: Obtener mensajes del DOM (método anterior)
     */
    getMessagesFromDOM() {
        const messageElements = document.querySelectorAll('.message');
        const messages = [];

        messageElements.forEach(msgElement => {
            const textElement = msgElement.querySelector('.message-text');
            const authorElement = msgElement.querySelector('.message-author');
            const timeElement = msgElement.querySelector('.message-time');

            if (textElement && textElement.textContent.trim()) {
                messages.push({
                    text: textElement.textContent.trim(),
                    author: authorElement?.textContent?.trim() || 'Anónimo',
                    timestamp: timeElement?.textContent?.trim() || 'Desconocido',
                    votes: { likes: 0, dislikes: 0 }, // No disponible en DOM
                    source: 'DOM'
                });
            }
        });

        return messages.slice(-50); // Límite menor para fallback
    }

    /**
     * Formatear autor para análisis IA
     */
    formatAuthorForAnalysis(author, isAnonymous, userIdentifier) {
        if (!isAnonymous) {
            return author; // Creator name
        }
        
        if (userIdentifier) {
            return `Anónimo #${userIdentifier}`;
        }
        
        return 'Anónimo';
    }

    /**
     * Formatear timestamp para análisis
     */
    formatTimestamp(timestamp) {
        try {
            const date = new Date(timestamp);
            return date.toLocaleString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return timestamp || 'Fecha desconocida';
        }
    }

    /**
     * Realizar análisis con OpenAI API
     */
    async performOpenAIAnalysis(messages, analysisType) {
        const prompt = this.buildPrompt(messages, analysisType);
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: this.getSystemPrompt(analysisType)
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: this.maxTokensPerRequest,
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || 'Sin respuesta del modelo IA';
    }

    /**
     * Generar prompts del sistema para cada tipo de análisis
     */
    getSystemPrompt(analysisType) {
        const systemPrompts = {
            sentiment: `Eres un experto en análisis de sentimientos. Analiza el tono emocional de una conversación de chat anónimo. 
            
Proporciona:
1. Sentimiento general (Positivo/Neutral/Negativo) con porcentaje
2. Emociones principales detectadas
3. Evolución del sentimiento a lo largo de la conversación
4. Comentarios sobre la dinámica emocional

Responde en español de manera clara y profesional.`,

            topic: `Eres un experto en análisis temático. Identifica y categoriza los temas principales discutidos en una conversación de chat anónimo.

Proporciona:
1. Temas principales (máximo 5) con relevancia
2. Palabras clave más frecuentes
3. Categorización temática (tecnología, personal, trabajo, etc.)
4. Flujo de temas durante la conversación

Responde en español de manera clara y estructurada.`,

            summary: `Eres un experto en síntesis de conversaciones. Crea un resumen conciso y estructurado de una conversación de chat anónimo.

Proporciona:
1. Resumen ejecutivo (2-3 líneas)
2. Puntos clave de la conversación
3. Conclusiones o resoluciones alcanzadas
4. Participación general (nivel de actividad)

Responde en español de manera clara y profesional.`
        };

        return systemPrompts[analysisType] || systemPrompts.summary;
    }

    /**
     * Construir prompt específico con los mensajes
     */
    buildPrompt(messages, analysisType) {
        const roomInfo = window.chatApp?.state?.currentRoom;
        const roomId = roomInfo?.id || 'Desconocida';
        
        let prompt = `Analiza la siguiente conversación de chat anónimo:\n\n`;
        prompt += `INFORMACIÓN DE LA SALA:\n`;
        prompt += `- ID de sala: ${roomId}\n`;
        prompt += `- Total de mensajes: ${messages.length}\n`;
        prompt += `- Fuente de datos: ${messages[0]?.source || 'Base de datos Supabase'}\n`;
        prompt += `- Período: ${messages[0]?.timestamp || 'N/A'} → ${messages[messages.length - 1]?.timestamp || 'N/A'}\n\n`;
        
        prompt += `CONVERSACIÓN:\n`;
        messages.forEach((msg, index) => {
            let messageInfo = `[${msg.timestamp}] ${msg.author}: ${msg.text}`;
            
            // Agregar información de votos si está disponible
            if (msg.votes && (msg.votes.likes > 0 || msg.votes.dislikes > 0)) {
                messageInfo += ` [👍${msg.votes.likes} 👎${msg.votes.dislikes}]`;
            }
            
            prompt += messageInfo + '\n';
        });

        prompt += `\n\nCONTEXTO ADICIONAL:\n`;
        prompt += `- Análisis solicitado: ${analysisType}\n`;
        prompt += `- Usuarios únicos identificados: ${this.countUniqueUsers(messages)}\n`;
        prompt += `- Mensajes con votos: ${this.countMessagesWithVotes(messages)}\n`;
        
        return prompt;
    }

    /**
     * Contar usuarios únicos en los mensajes
     */
    countUniqueUsers(messages) {
        const uniqueAuthors = new Set(messages.map(msg => msg.author));
        return uniqueAuthors.size;
    }

    /**
     * Contar mensajes que tienen votos
     */
    countMessagesWithVotes(messages) {
        return messages.filter(msg => 
            msg.votes && (msg.votes.likes > 0 || msg.votes.dislikes > 0)
        ).length;
    }

    /**
     * Generar clave de cache
     */
    generateCacheKey(messages, analysisType) {
        const messageTexts = messages.map(m => m.text).join('|');
        const hash = this.simpleHash(messageTexts + analysisType);
        return `${analysisType}_${hash}`;
    }

    /**
     * Hash simple para cache
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    /**
     * Mostrar estado de carga
     */
    showLoadingState(analysisType) {
        const resultContainer = document.getElementById('aiAnalysisResult');
        if (resultContainer) {
            resultContainer.innerHTML = `
                <div class="ai-loading">
                    <div class="loading-spinner"></div>
                    <p>🤖 Analizando mensajes con IA...</p>
                    <p class="loading-detail">Tipo: ${this.getAnalysisTypeName(analysisType)}</p>
                </div>
            `;
        }
    }

    /**
     * Ocultar estado de carga
     */
    hideLoadingState() {
        // El loading se oculta cuando se muestra el resultado
    }

    /**
     * Mostrar resultado del análisis
     */
    showAnalysisResult(analysisType, result) {
        const resultContainer = document.getElementById('aiAnalysisResult');
        const roomInfo = window.chatApp?.state?.currentRoom;
        const roomId = roomInfo?.id || 'N/A';
        
        if (resultContainer) {
            resultContainer.innerHTML = `
                <div class="ai-result">
                    <div class="ai-result-header">
                        <h4>📊 ${this.getAnalysisTypeName(analysisType)}</h4>
                        <div class="ai-room-info">
                            <small>🏠 Sala: <strong>${roomId}</strong> | 📈 Fuente: Chat Actual</small>
                        </div>
                    </div>
                    <div class="ai-result-content">
                        ${this.formatAnalysisResult(result)}
                    </div>
                    <div class="ai-result-footer">
                        <small>🤖 Análisis Inteligencia Artificial | ${new Date().toLocaleString()}</small>
                        <button class="btn btn--sm" onclick="aiManager.exportAnalysis('${analysisType}', '${result.replace(/'/g, "\\'")}')">
                            📄 Exportar
                        </button>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Formatear resultado de análisis para mostrar
     */
    formatAnalysisResult(result) {
        // Convertir texto plano en HTML formateado
        return result
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/(\d+\.)\s/g, '<strong>$1</strong> ')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }

    /**
     * Obtener nombre legible del tipo de análisis
     */
    getAnalysisTypeName(analysisType) {
        const names = {
            sentiment: 'Análisis de Sentimientos',
            topic: 'Análisis Temático', 
            summary: 'Resumen de Conversación'
        };
        return names[analysisType] || 'Análisis';
    }

    /**
     * Mostrar error
     */
    showError(message) {
        const resultContainer = document.getElementById('aiAnalysisResult');
        if (resultContainer) {
            resultContainer.innerHTML = `
                <div class="ai-error">
                    <h4>❌ Error</h4>
                    <p>${message}</p>
                </div>
            `;
        }

        this.showToast(message, 'error');
    }

    /**
     * Mostrar toast notification
     */
    showToast(message, type = 'info') {
        // Intentar usar el sistema de toast existente
        if (window.chatApp && window.chatApp.showToast) {
            window.chatApp.showToast(message, type);
            return;
        }

        // Fallback: mostrar en consola
        console.log(`🍞 Toast ${type}: ${message}`);
    }

    /**
     * Limpiar resultados previos
     */
    clearPreviousResults() {
        const resultContainer = document.getElementById('aiAnalysisResult');
        if (resultContainer) {
            resultContainer.innerHTML = `
                <div class="ai-placeholder">
                    <p>🤖 Selecciona un tipo de análisis para comenzar</p>
                </div>
            `;
        }
    }

    /**
     * Exportar análisis como archivo de texto
     */
    exportAnalysis(analysisType, result) {
        const filename = `analisis-${analysisType}-${new Date().toISOString().split('T')[0]}.txt`;
        const content = `ANÁLISIS DE CHAT ANÓNIMO
=========================

Tipo: ${this.getAnalysisTypeName(analysisType)}
Fecha: ${new Date().toLocaleString()}
Modelo IA: ${this.model}

RESULTADO:
${result}

---
Generado por Chat Anónimo v3.0 con IA`;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`📄 Análisis exportado: ${filename}`);
    }

    /**
     * Deshabilitar funciones IA cuando no hay API key
     */
    disableAiFeatures() {
        const aiButton = document.getElementById('aiAnalysisBtn');
        if (aiButton) {
            aiButton.disabled = true;
            aiButton.title = 'OpenAI API Key no configurada';
            aiButton.style.opacity = '0.5';
        }
    }

    /**
     * Obtener estadísticas de uso del cache
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }

    /**
     * Limpiar cache (para testing o mantenimiento)
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Cache de análisis IA limpiado');
    }
}

// Instancia global para uso desde HTML
window.aiManager = null;

console.log('🤖 AI Analysis Manager module loaded');