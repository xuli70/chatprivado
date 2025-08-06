// Script de testing rápido para el sistema administrador
// Pegar en la consola del navegador después de cargar la aplicación

console.log('🚀 Iniciando test del sistema administrador...');

// 1. Crear salas de prueba
function crearSalasPrueba() {
    const salas = [
        {
            id: 'ADMIN1',
            creator: 'Administrador',
            question: 'Sala de prueba admin 1',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7200000).toISOString(),
            messageLimit: 200,
            messages: []
        },
        {
            id: 'USER1',
            creator: 'Usuario Regular',
            question: 'Sala de usuario normal',
            createdAt: new Date(Date.now() - 8000000).toISOString(), // Hace más de 2 horas (expirada)
            expiresAt: new Date(Date.now() - 1000000).toISOString(),
            messageLimit: 200,
            messages: []
        },
        {
            id: 'RECENT1',
            creator: 'Usuario Test',
            question: 'Sala reciente',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7200000).toISOString(),
            messageLimit: 200,
            messages: []
        }
    ];

    salas.forEach(sala => {
        localStorage.setItem(`room_${sala.id}`, JSON.stringify(sala));
        console.log(`✅ Sala creada: ${sala.id} (${sala.creator})`);
    });
}

// 2. Testing de funciones
function testSistemaAdmin() {
    console.log('\n📋 Testing getAllRooms():');
    const rooms1 = app.getAllRooms();
    console.log(`- getAllRooms() encontró: ${rooms1.length} salas`);
    rooms1.forEach(room => {
        const expired = app.isRoomExpired(room) ? 'EXPIRADA' : 'ACTIVA';
        console.log(`  - ${room.id}: ${expired}`);
    });

    console.log('\n📋 Testing getAllRooms(true):');
    const rooms2 = app.getAllRooms(true);
    console.log(`- getAllRooms(true) encontró: ${rooms2.length} salas`);
    rooms2.forEach(room => {
        const expired = app.isRoomExpired(room) ? 'EXPIRADA' : 'ACTIVA';
        console.log(`  - ${room.id}: ${expired}`);
    });

    console.log('\n🔍 Testing adminListRooms():');
    app.adminListRooms();
}

// 3. Función para limpiar
function limpiarSalasPrueba() {
    ['ADMIN1', 'USER1', 'RECENT1'].forEach(id => {
        localStorage.removeItem(`room_${id}`);
    });
    console.log('🗑️ Salas de prueba eliminadas');
}

// Auto-ejecutar si la app existe
if (typeof app !== 'undefined') {
    crearSalasPrueba();
    setTimeout(() => testSistemaAdmin(), 1000);
} else {
    console.log('⚠️ App no encontrada. Asegúrate de que la aplicación esté cargada.');
    console.log('Funciones disponibles: crearSalasPrueba(), testSistemaAdmin(), limpiarSalasPrueba()');
}