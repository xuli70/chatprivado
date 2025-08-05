// Gestión de componentes UI para Chat Anónimo
// Funciones para modales, toasts y elementos de interfaz

/**
 * Muestra un modal específico
 * @param {string} modalType - Tipo de modal a mostrar
 * @param {Object} elements - Referencias a elementos DOM
 */
export function showModal(modalType, elements) {
    const modal = elements.modals[modalType];
    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * Oculta todos los modales y limpia su contenido
 * @param {Object} elements - Referencias a elementos DOM
 */
export function hideModal(elements) {
    Object.values(elements.modals).forEach(modal => {
        modal.classList.add('hidden');
    });
    
    // Limpiar contenido del modal para evitar conflictos en siguientes usos
    cleanupModal();
}

/**
 * Limpia el contenido del modal para evitar conflictos
 */
export function cleanupModal() {
    console.log('Limpiando contenido del modal');
    
    // Restaurar contenido original del modal de confirmación
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    
    if (confirmTitle) {
        confirmTitle.textContent = 'Confirmar acción';
    }
    
    if (confirmMessage) {
        // Restaurar a contenido de texto simple, no HTML
        confirmMessage.innerHTML = '';
        confirmMessage.textContent = '¿Estás seguro?';
    }
    
    if (confirmBtn) {
        confirmBtn.textContent = 'Confirmar';
        confirmBtn.className = 'btn btn--primary btn--lg';
    }
    
    console.log('Modal limpiado correctamente');
}

/**
 * Muestra un modal de confirmación con callback
 * @param {string} title - Título del modal
 * @param {string} message - Mensaje del modal
 * @param {Function} confirmCallback - Callback a ejecutar al confirmar
 * @param {string} buttonText - Texto del botón (por defecto: 'Confirmar')
 * @param {string} buttonStyle - Estilo del botón ('primary' o 'danger')
 * @param {Object} elements - Referencias a elementos DOM
 * @param {Object} state - Estado para almacenar el callback
 */
export function showConfirmModal(title, message, confirmCallback, buttonText = 'Confirmar', buttonStyle = 'primary', elements, state) {
    elements.modals.confirmTitle.textContent = title;
    elements.modals.confirmMessage.textContent = message;
    state.confirmCallback = confirmCallback;
    
    // Actualizar texto del botón si se proporciona
    const confirmBtn = elements.buttons.confirm;
    if (confirmBtn) {
        confirmBtn.textContent = buttonText;
        
        // Actualizar estilo del botón
        confirmBtn.className = 'btn btn--lg';
        if (buttonStyle === 'danger') {
            confirmBtn.classList.add('btn--danger');
        } else {
            confirmBtn.classList.add('btn--primary');
        }
    }
    
    showModal('confirm', elements);
}

/**
 * Maneja la confirmación del modal
 * @param {Object} elements - Referencias a elementos DOM
 * @param {Object} state - Estado que contiene el callback
 */
export function handleConfirm(elements, state) {
    if (state.confirmCallback) {
        state.confirmCallback();
        state.confirmCallback = null;
    }
    hideModal(elements);
}

/**
 * Muestra una notificación toast
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo de toast ('info', 'success', 'error', 'warning')
 * @param {Object} elements - Referencias a elementos DOM
 */
export function showToast(message, type = 'info', elements = null) {
    // Si no se proporcionan elementos, intentar obtenerlos del DOM directamente
    if (!elements) {
        const toastContainer = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        
        if (toastContainer && toastMessage) {
            elements = {
                toast: {
                    container: toastContainer,
                    message: toastMessage
                }
            };
        } else {
            // Fallback: crear toast temporal si no existe
            console.log(`Toast: ${message} (${type})`);
            return;
        }
    }
    
    elements.toast.message.textContent = message;
    elements.toast.container.className = `toast ${type}`;
    elements.toast.container.classList.remove('hidden');
    
    setTimeout(() => {
        elements.toast.container.classList.add('hidden');
    }, 3000);
}

/**
 * Muestra un estado vacío en el chat
 * @param {string} roomId - ID de la sala actual
 * @param {Object} elements - Referencias a elementos DOM
 */
export function showEmptyState(roomId, elements) {
    elements.displays.chatMessages.innerHTML = `
        <div class="empty-state">
            <h3>¡Bienvenido al chat!</h3>
            <p>Comparte el código <strong>${roomId}</strong> para que otros se unan y comenzar la conversación.</p>
        </div>
    `;
}