// Script de debugging para ejecutar en Console del navegador
// Copiar y pegar en Console (F12) para diagnosticar el problema

console.log('='.repeat(50));
console.log('🔍 DIAGNÓSTICO FRONTEND - MUNDOXYZ');
console.log('='.repeat(50));

// 1. Verificar elementos básicos
console.log('\n📦 1. VERIFICACIÓN DE LIBRERÍAS:');
console.log('- React cargado:', typeof window.React !== 'undefined' ? '✅' : '❌');
console.log('- ReactDOM cargado:', typeof window.ReactDOM !== 'undefined' ? '✅' : '❌');
console.log('- Axios cargado:', typeof window.axios !== 'undefined' ? '✅' : '❌');

// 2. Verificar root element
console.log('\n🎯 2. VERIFICACIÓN DEL DOM:');
const root = document.getElementById('root');
console.log('- Elemento #root existe:', root ? '✅' : '❌');
if (root) {
  console.log('- #root tiene contenido:', root.innerHTML.length > 100 ? '✅' : '❌ (vacío)');
  console.log('- #root innerHTML length:', root.innerHTML.length);
}

// 3. Verificar localStorage
console.log('\n💾 3. VERIFICACIÓN DE STORAGE:');
try {
  const user = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  console.log('- Usuario en localStorage:', user ? '✅' : '❌');
  console.log('- Token en localStorage:', token ? '✅' : '❌');
  
  if (user) {
    const userData = JSON.parse(user);
    console.log('- Username:', userData.username);
    console.log('- Fires balance:', userData.fires_balance);
  }
} catch (e) {
  console.error('❌ Error leyendo localStorage:', e.message);
}

// 4. Verificar estilos
console.log('\n🎨 4. VERIFICACIÓN DE ESTILOS:');
const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
console.log('- Hojas de estilo cargadas:', styles.length);
console.log('- Color de fondo body:', window.getComputedStyle(document.body).backgroundColor);

// 5. Verificar errores
console.log('\n❌ 5. ERRORES CAPTURADOS:');
const errors = [];
window.addEventListener('error', (e) => {
  errors.push({
    message: e.message,
    filename: e.filename,
    lineno: e.lineno
  });
});
console.log('- Listener de errores instalado ✅');
console.log('- Errores actuales:', errors.length);

// 6. Verificar API URL
console.log('\n🌐 6. CONFIGURACIÓN DE API:');
if (window.axios && window.axios.defaults) {
  console.log('- Axios baseURL:', window.axios.defaults.baseURL || '(no configurado)');
  console.log('- Axios withCredentials:', window.axios.defaults.withCredentials);
}

// 7. Test de conexión
console.log('\n🔌 7. TEST DE CONEXIÓN:');
console.log('Probando conexión al backend...');
fetch('/api/economy/balance', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
})
.then(r => {
  console.log('✅ Respuesta del servidor:', r.status);
  return r.json();
})
.then(d => {
  console.log('✅ Balance recibido:', d);
})
.catch(e => {
  console.error('❌ Error de conexión:', e.message);
});

// 8. Información del navegador
console.log('\n🌐 8. INFORMACIÓN DEL NAVEGADOR:');
console.log('- User Agent:', navigator.userAgent);
console.log('- Viewport:', window.innerWidth + 'x' + window.innerHeight);
console.log('- Online:', navigator.onLine ? '✅' : '❌');

console.log('\n' + '='.repeat(50));
console.log('Diagnóstico completado. Revisa los resultados arriba.');
console.log('Si algo muestra ❌, ese podría ser el problema.');
console.log('='.repeat(50));
