// Script to check app.js file size
const fs = require('fs');

try {
    const stats = fs.statSync('app.js');
    console.log(`Tamaño actual de app.js: ${stats.size} bytes`);
    
    // Previous size from conversation
    const originalSize = 110564;
    const reduction = originalSize - stats.size;
    const percentage = ((reduction / originalSize) * 100).toFixed(1);
    
    console.log(`Tamaño original: ${originalSize} bytes`);
    console.log(`Reducción lograda: ${reduction} bytes (${percentage}%)`);
    
} catch (error) {
    console.error('Error:', error.message);
}