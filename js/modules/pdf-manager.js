// PDF Manager Module
// Gestión completa de archivos PDF: upload, download, preview, validación

import { escapeHtml } from './utils.js';
import { showToast } from './ui-manager.js';

// Configuración para PDFs
const PDF_CONFIG = {
    maxFileSize: 10 * 1024 * 1024, // 10MB en bytes
    allowedMimeTypes: ['application/pdf'],
    allowedExtensions: ['.pdf'],
    bucketName: 'chat-pdfs'
};

// Estado del gestor de PDFs
let uploadInProgress = false;
let currentUploads = new Map(); // Para tracking de uploads múltiples

/**
 * Validar archivo PDF antes de subir
 * @param {File} file - Archivo a validar
 * @returns {Object} - {isValid: boolean, error: string}
 */
export function validatePDFFile(file) {
    if (!file) {
        return { isValid: false, error: 'No se seleccionó ningún archivo' };
    }

    // Validar extensión
    const fileName = file.name.toLowerCase();
    const hasValidExtension = PDF_CONFIG.allowedExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension) {
        return { isValid: false, error: 'Solo se permiten archivos PDF' };
    }

    // Validar tipo MIME
    if (!PDF_CONFIG.allowedMimeTypes.includes(file.type)) {
        return { isValid: false, error: 'Tipo de archivo no válido. Solo PDFs.' };
    }

    // Validar tamaño
    if (file.size > PDF_CONFIG.maxFileSize) {
        const maxSizeMB = PDF_CONFIG.maxFileSize / (1024 * 1024);
        return { isValid: false, error: `El archivo es demasiado grande. Máximo ${maxSizeMB}MB` };
    }

    return { isValid: true, error: null };
}

/**
 * Subir archivo PDF a Supabase Storage
 * @param {File} file - Archivo PDF a subir
 * @param {string} roomId - ID de la sala
 * @param {string} uploadedBy - Nombre del usuario que sube
 * @param {Object} supabaseClient - Cliente de Supabase
 * @param {Function} onProgress - Callback para progreso (opcional)
 * @returns {Promise<Object>} - Datos del archivo subido
 */
export async function uploadPDF(file, roomId, uploadedBy, supabaseClient, onProgress = null) {
    // Validar archivo
    const validation = validatePDFFile(file);
    if (!validation.isValid) {
        throw new Error(validation.error);
    }

    if (uploadInProgress) {
        throw new Error('Ya hay una subida en progreso. Espera a que termine.');
    }

    uploadInProgress = true;

    try {
        // Generar nombre único para el archivo
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substr(2, 9);
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniqueFileName = `${roomId}_${timestamp}_${randomId}_${safeFileName}`;
        const filePath = `${PDF_CONFIG.bucketName}/${uniqueFileName}`;

        // Simular progreso si no hay cliente Supabase
        if (!supabaseClient || !supabaseClient.isSupabaseAvailable()) {
            if (onProgress) {
                onProgress(25);
                await new Promise(resolve => setTimeout(resolve, 500));
                onProgress(50);
                await new Promise(resolve => setTimeout(resolve, 500));
                onProgress(75);
                await new Promise(resolve => setTimeout(resolve, 500));
                onProgress(100);
            }
            
            // Retornar datos simulados para localStorage
            return {
                id: `local_${timestamp}`,
                filename: uniqueFileName,
                original_filename: file.name,
                file_path: `mock://${filePath}`,
                file_size: file.size,
                mime_type: file.type,
                uploaded_by: uploadedBy,
                room_id: roomId,
                created_at: new Date().toISOString(),
                url: URL.createObjectURL(file) // URL temporal para preview local
            };
        }

        // Subir a Supabase Storage
        if (onProgress) onProgress(10);
        
        const { data: uploadResult, error: uploadError } = await supabaseClient.client.storage
            .from(PDF_CONFIG.bucketName)
            .upload(uniqueFileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            // Verificar si es error de bucket no encontrado
            if (uploadError.message && uploadError.message.includes('Bucket not found')) {
                throw new Error('El bucket de almacenamiento no está configurado. Por favor, crea el bucket "chat-pdfs" en Supabase Storage.');
            }
            throw new Error(`Error subiendo archivo: ${uploadError.message}`);
        }

        if (onProgress) onProgress(60);

        // Obtener URL pública del archivo
        const { data: urlData } = supabaseClient.client.storage
            .from(PDF_CONFIG.bucketName)
            .getPublicUrl(uniqueFileName);

        if (onProgress) onProgress(80);

        // Guardar metadata en la base de datos
        const attachmentData = {
            filename: uniqueFileName,
            original_filename: file.name,
            file_path: uploadResult.path,
            file_size: file.size,
            mime_type: file.type,
            uploaded_by: uploadedBy,
            room_id: roomId
        };

        const { data: dbResult, error: dbError } = await supabaseClient.client
            .from('chat_attachments')
            .insert([attachmentData])
            .select()
            .single();

        if (dbError) {
            // Si falla la DB, intentar eliminar el archivo subido
            await supabaseClient.client.storage
                .from(PDF_CONFIG.bucketName)
                .remove([uniqueFileName]);
            throw new Error(`Error guardando metadata: ${dbError.message}`);
        }

        if (onProgress) onProgress(100);

        // Retornar datos completos
        return {
            ...dbResult,
            url: urlData.publicUrl
        };

    } catch (error) {
        console.error('Error en uploadPDF:', error);
        throw error;
    } finally {
        uploadInProgress = false;
    }
}

/**
 * Obtener lista de PDFs de una sala
 * @param {string} roomId - ID de la sala
 * @param {Object} supabaseClient - Cliente Supabase
 * @returns {Promise<Array>} - Lista de archivos
 */
export async function getRoomPDFs(roomId, supabaseClient) {
    if (!supabaseClient || !supabaseClient.isSupabaseAvailable()) {
        // Fallback: buscar en localStorage
        const attachments = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(`pdf_${roomId}_`)) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    attachments.push(data);
                } catch (error) {
                    console.warn('Error parsing PDF data from localStorage:', error);
                }
            }
        }
        return attachments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    try {
        const { data, error } = await supabaseClient.client
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
            url: supabaseClient.client.storage
                .from(PDF_CONFIG.bucketName)
                .getPublicUrl(attachment.filename).data.publicUrl
        }));

    } catch (error) {
        console.error('Error en getRoomPDFs:', error);
        return [];
    }
}

/**
 * Eliminar PDF
 * @param {string} attachmentId - ID del attachment
 * @param {Object} supabaseClient - Cliente Supabase
 * @returns {Promise<boolean>} - Éxito de la operación
 */
export async function deletePDF(attachmentId, supabaseClient) {
    if (!supabaseClient || !supabaseClient.isSupabaseAvailable()) {
        // Fallback localStorage
        localStorage.removeItem(`pdf_attachment_${attachmentId}`);
        return true;
    }

    try {
        // Obtener datos del attachment
        const { data: attachment, error: getError } = await supabaseClient.client
            .from('chat_attachments')
            .select('*')
            .eq('id', attachmentId)
            .single();

        if (getError || !attachment) {
            throw new Error('Archivo no encontrado');
        }

        // Marcar como inactivo en BD (soft delete)
        const { error: updateError } = await supabaseClient.client
            .from('chat_attachments')
            .update({ is_active: false })
            .eq('id', attachmentId);

        if (updateError) {
            throw new Error(`Error eliminando metadata: ${updateError.message}`);
        }

        // Opcional: eliminar archivo físico de Storage
        // await supabaseClient.client.storage
        //     .from(PDF_CONFIG.bucketName)
        //     .remove([attachment.filename]);

        return true;

    } catch (error) {
        console.error('Error en deletePDF:', error);
        return false;
    }
}

/**
 * Crear componente UI para preview de PDF
 * @param {Object} attachment - Datos del archivo
 * @returns {string} - HTML del componente
 */
export function createPDFPreviewHTML(attachment) {
    const sizeFormatted = formatFileSize(attachment.file_size);
    const dateFormatted = new Date(attachment.created_at).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });

    return `
        <div class="pdf-attachment" data-attachment-id="${attachment.id}">
            <div class="pdf-icon">📄</div>
            <div class="pdf-info">
                <div class="pdf-name" title="${escapeHtml(attachment.original_filename)}">
                    ${escapeHtml(attachment.original_filename)}
                </div>
                <div class="pdf-meta">
                    ${sizeFormatted} • ${dateFormatted} • ${escapeHtml(attachment.uploaded_by)}
                </div>
            </div>
            <div class="pdf-actions">
                <button class="btn-pdf-preview" title="Vista previa">👁️</button>
                <button class="btn-pdf-download" title="Descargar">⬇️</button>
            </div>
        </div>
    `;
}

/**
 * Crear botón de upload para el chat
 * @returns {string} - HTML del botón
 */
export function createUploadButtonHTML() {
    return `
        <button id="uploadPDFBtn" class="btn-attachment" title="Subir PDF" type="button">
            📎
        </button>
        <input type="file" id="pdfFileInput" accept=".pdf" style="display: none;">
    `;
}

/**
 * Mostrar progreso de subida
 * @param {number} progress - Porcentaje (0-100)
 */
export function showUploadProgress(progress) {
    let progressBar = document.getElementById('pdfUploadProgress');
    
    if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.id = 'pdfUploadProgress';
        progressBar.className = 'pdf-upload-progress';
        progressBar.innerHTML = `
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
            <div class="progress-text">Subiendo PDF... 0%</div>
        `;
        document.querySelector('.chat-input-container').appendChild(progressBar);
    }
    
    const fill = progressBar.querySelector('.progress-fill');
    const text = progressBar.querySelector('.progress-text');
    
    fill.style.width = `${progress}%`;
    text.textContent = `Subiendo PDF... ${progress}%`;
    
    if (progress >= 100) {
        setTimeout(() => {
            if (progressBar && progressBar.parentNode) {
                progressBar.parentNode.removeChild(progressBar);
            }
        }, 1500);
    }
}

/**
 * Inicializar event listeners para PDFs
 * @param {Object} app - Instancia de la aplicación principal
 */
export function initializePDFEventListeners(app) {
    // Event listener para botón de upload
    document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'uploadPDFBtn') {
            const fileInput = document.getElementById('pdfFileInput');
            if (fileInput) {
                fileInput.click();
            }
        }
    });

    // Event listener para selección de archivo
    document.addEventListener('change', async (e) => {
        if (e.target && e.target.id === 'pdfFileInput') {
            const file = e.target.files[0];
            if (file && app.state.currentRoom) {
                try {
                    const attachment = await uploadPDF(
                        file,
                        app.state.currentRoom.id,
                        app.state.currentUser || 'Anónimo',
                        app.supabaseClient,
                        showUploadProgress
                    );
                    
                    showToast('PDF subido exitosamente', 'success');
                    
                    // Recargar PDFs de la sala
                    if (app.loadRoomPDFs) {
                        await app.loadRoomPDFs();
                    }
                    
                } catch (error) {
                    showToast(error.message || 'Error subiendo PDF', 'error');
                } finally {
                    // Limpiar input
                    e.target.value = '';
                }
            }
        }
    });

    // Event listeners para acciones de PDF
    document.addEventListener('click', (e) => {
        const pdfAttachment = e.target.closest('.pdf-attachment');
        if (!pdfAttachment) return;

        const attachmentId = pdfAttachment.dataset.attachmentId;

        if (e.target.classList.contains('btn-pdf-preview')) {
            openPDFPreview(attachmentId, app);
        } else if (e.target.classList.contains('btn-pdf-download')) {
            downloadPDF(attachmentId, app);
        }
    });
}

/**
 * Abrir preview de PDF en modal
 * @param {string} attachmentId - ID del attachment
 * @param {Object} app - Instancia de la aplicación
 */
async function openPDFPreview(attachmentId, app) {
    try {
        const pdfs = await getRoomPDFs(app.state.currentRoom.id, app.supabaseClient);
        const attachment = pdfs.find(pdf => pdf.id === attachmentId);
        
        if (!attachment) {
            showToast('Archivo no encontrado', 'error');
            return;
        }

        // Crear modal para preview
        const modal = document.createElement('div');
        modal.className = 'modal-overlay pdf-preview-modal';
        modal.innerHTML = `
            <div class="modal-content pdf-preview-content">
                <div class="modal-header">
                    <h3>${escapeHtml(attachment.original_filename)}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <iframe src="${attachment.url}" 
                            width="100%" 
                            height="600px" 
                            style="border: none;">
                    </iframe>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listener para cerrar modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('modal-close')) {
                document.body.removeChild(modal);
            }
        });

    } catch (error) {
        showToast('Error abriendo preview', 'error');
        console.error('Error en openPDFPreview:', error);
    }
}

/**
 * Descargar PDF
 * @param {string} attachmentId - ID del attachment
 * @param {Object} app - Instancia de la aplicación
 */
async function downloadPDF(attachmentId, app) {
    try {
        const pdfs = await getRoomPDFs(app.state.currentRoom.id, app.supabaseClient);
        const attachment = pdfs.find(pdf => pdf.id === attachmentId);
        
        if (!attachment) {
            showToast('Archivo no encontrado', 'error');
            return;
        }

        // Crear enlace temporal para descarga
        const link = document.createElement('a');
        link.href = attachment.url;
        link.download = attachment.original_filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('Descarga iniciada', 'success');

    } catch (error) {
        showToast('Error en descarga', 'error');
        console.error('Error en downloadPDF:', error);
    }
}

/**
 * Formatear tamaño de archivo
 * @param {number} bytes - Tamaño en bytes
 * @returns {string} - Tamaño formateado
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Obtener estadísticas de PDFs de una sala
 * @param {string} roomId - ID de la sala
 * @param {Object} supabaseClient - Cliente Supabase
 * @returns {Promise<Object>} - Estadísticas
 */
export async function getRoomPDFStats(roomId, supabaseClient) {
    const pdfs = await getRoomPDFs(roomId, supabaseClient);
    
    const totalFiles = pdfs.length;
    const totalSize = pdfs.reduce((sum, pdf) => sum + pdf.file_size, 0);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    
    return {
        totalFiles,
        totalSize,
        totalSizeMB,
        mostRecent: pdfs.length > 0 ? pdfs[0].created_at : null
    };
}