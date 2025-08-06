/**
 * Theme Manager Module
 * Manages light/dark theme switching for the application
 */

// Storage key for theme preference
const THEME_STORAGE_KEY = 'anonymousChat_theme';

// Theme constants
const THEMES = {
    LIGHT: 'light',
    DARK: 'dark'
};

// Theme icons
const THEME_ICONS = {
    LIGHT: '☀️',
    DARK: '🌙'
};

/**
 * Initialize theme based on saved preference or system default
 * @returns {string} Current theme
 */
export function initTheme() {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    
    if (savedTheme) {
        // Use saved preference
        setTheme(savedTheme);
        return savedTheme;
    }
    
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const defaultTheme = prefersDark ? THEMES.DARK : THEMES.LIGHT;
    
    // Set and save default theme
    setTheme(defaultTheme);
    saveThemePreference(defaultTheme);
    
    return defaultTheme;
}

/**
 * Get current theme
 * @returns {string} Current theme ('light' or 'dark')
 */
export function getTheme() {
    const htmlElement = document.documentElement;
    return htmlElement.getAttribute('data-color-scheme') === 'dark' ? THEMES.DARK : THEMES.LIGHT;
}

/**
 * Set theme
 * @param {string} theme - Theme to set ('light' or 'dark')
 */
export function setTheme(theme) {
    const htmlElement = document.documentElement;
    
    if (theme === THEMES.DARK) {
        htmlElement.setAttribute('data-color-scheme', 'dark');
    } else {
        htmlElement.removeAttribute('data-color-scheme');
    }
    
    // Update theme toggle button icon if it exists
    updateThemeToggleButton(theme);
}

/**
 * Toggle between light and dark themes
 * @returns {string} New theme after toggle
 */
export function toggleTheme() {
    const currentTheme = getTheme();
    const newTheme = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    
    // Apply new theme
    setTheme(newTheme);
    
    // Save preference
    saveThemePreference(newTheme);
    
    return newTheme;
}

/**
 * Save theme preference to localStorage
 * @param {string} theme - Theme to save
 */
export function saveThemePreference(theme) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
        console.error('Error saving theme preference:', error);
    }
}

/**
 * Update theme toggle button icon
 * @param {string} theme - Current theme
 */
export function updateThemeToggleButton(theme) {
    const button = document.getElementById('themeToggleBtn');
    if (!button) return;
    
    const iconElement = button.querySelector('.theme-icon');
    if (!iconElement) return;
    
    // Set icon based on current theme (show opposite icon)
    // If in dark mode, show sun icon (to switch to light)
    // If in light mode, show moon icon (to switch to dark)
    const icon = theme === THEMES.DARK ? THEME_ICONS.LIGHT : THEME_ICONS.DARK;
    iconElement.textContent = icon;
    
    // Update button title
    const nextTheme = theme === THEMES.DARK ? 'claro' : 'oscuro';
    button.title = `Cambiar a modo ${nextTheme}`;
}

/**
 * Add theme transition for smooth switching
 */
export function enableThemeTransition() {
    const htmlElement = document.documentElement;
    
    // Add transition class
    htmlElement.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    
    // Remove transition after animation completes
    setTimeout(() => {
        htmlElement.style.transition = '';
    }, 300);
}

/**
 * Handle theme toggle with transition
 * @param {Function} showToast - Optional toast notification function
 * @returns {string} New theme
 */
export function handleThemeToggle(showToast = null) {
    // Enable smooth transition
    enableThemeTransition();
    
    // Toggle theme
    const newTheme = toggleTheme();
    
    // Show notification if function provided
    if (showToast) {
        const themeText = newTheme === THEMES.DARK ? 'oscuro' : 'claro';
        showToast(`Modo ${themeText} activado`, 'success');
    }
    
    return newTheme;
}

/**
 * Listen for system theme changes
 * @param {boolean} autoSwitch - Whether to automatically switch theme based on system preference
 */
export function listenForSystemThemeChanges(autoSwitch = false) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    mediaQuery.addEventListener('change', (e) => {
        // Only auto-switch if no saved preference and autoSwitch is enabled
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (!savedTheme && autoSwitch) {
            const newTheme = e.matches ? THEMES.DARK : THEMES.LIGHT;
            setTheme(newTheme);
        }
    });
}

/**
 * Get theme statistics for debugging
 * @returns {Object} Theme statistics
 */
export function getThemeStats() {
    return {
        currentTheme: getTheme(),
        savedPreference: localStorage.getItem(THEME_STORAGE_KEY),
        systemPreference: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
        hasDataAttribute: document.documentElement.hasAttribute('data-color-scheme')
    };
}

// Export all functions as default object for compatibility
export default {
    initTheme,
    getTheme,
    setTheme,
    toggleTheme,
    saveThemePreference,
    updateThemeToggleButton,
    enableThemeTransition,
    handleThemeToggle,
    listenForSystemThemeChanges,
    getThemeStats,
    THEMES,
    THEME_ICONS
};