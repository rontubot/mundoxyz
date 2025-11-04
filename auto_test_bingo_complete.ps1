# Script automatizado para esperar deploy y probar flujo completo de Bingo
# Autor: Sistema automatizado MUNDOXYZ
# Fecha: 31 Oct 2025

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  INICIANDO PRUEBA AUTOMATIZADA" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# 1. Mostrar información del último commit
Write-Host "📦 Último commit pusheado:" -ForegroundColor Yellow
$lastCommit = git log -1 --oneline
Write-Host "   $lastCommit" -ForegroundColor White
Write-Host ""

# 2. Esperar para que Railway haga el deploy
$waitTime = 360
Write-Host "⏱️ Esperando $waitTime segundos para que Railway complete el deploy..." -ForegroundColor Yellow
Write-Host "   Hora inicio: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Gray

# Barra de progreso
$totalSteps = 36
for ($i = 1; $i -le $totalSteps; $i++) {
    Start-Sleep -Seconds 10
    $percentage = [math]::Round(($i / $totalSteps) * 100)
    $remaining = $waitTime - ($i * 10)
    Write-Progress -Activity "Esperando deploy de Railway" -Status "$remaining segundos restantes" -PercentComplete $percentage
}

Write-Progress -Activity "Esperando deploy de Railway" -Completed
Write-Host "   Hora fin: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Gray
Write-Host "✅ Tiempo de espera completado" -ForegroundColor Green
Write-Host ""

# 3. Verificar que el servidor esté respondiendo
Write-Host "🔍 Verificando estado del servidor..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "https://confident-bravery-production-ce7b.up.railway.app/api/health" -Method Get
    Write-Host "✅ Servidor respondiendo:" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor White
    Write-Host "   Timestamp: $($health.timestamp)" -ForegroundColor White
} catch {
    Write-Host "❌ ERROR: El servidor no responde" -ForegroundColor Red
    Write-Host "   Verifica en Railway dashboard si el deploy fue exitoso" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# 4. Instrucciones para pruebas manuales
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  PRUEBAS MANUALES REQUERIDAS" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 FLUJO DE PRUEBA COMPLETO:" -ForegroundColor Yellow
Write-Host ""

Write-Host "1️⃣ ABRIR DOS NAVEGADORES:" -ForegroundColor Cyan
Write-Host "   - Navegador 1 (Normal): Usuario prueba1" -ForegroundColor White
Write-Host "   - Navegador 2 (Incógnito): Usuario prueba2" -ForegroundColor White
Write-Host ""

Write-Host "2️⃣ LOGIN:" -ForegroundColor Cyan
Write-Host "   - prueba1 / 123456789" -ForegroundColor White
Write-Host "   - prueba2 / Mirame12veces." -ForegroundColor White
Write-Host ""

Write-Host "3️⃣ CREAR SALA (con prueba1):" -ForegroundColor Cyan
Write-Host "   - Modo: 75 números" -ForegroundColor White
Write-Host "   - Victoria: Línea" -ForegroundColor White
Write-Host "   - Costo: 1 fuego" -ForegroundColor White
Write-Host "   - Jugadores: 2" -ForegroundColor White
Write-Host "   - Cartones: 1" -ForegroundColor White
Write-Host ""

Write-Host "4️⃣ UNIRSE A SALA (con prueba2):" -ForegroundColor Cyan
Write-Host "   - Usar el código de sala creado" -ForegroundColor White
Write-Host ""

Write-Host "5️⃣ INICIAR PARTIDA:" -ForegroundColor Cyan
Write-Host "   - Host (prueba1) inicia la partida" -ForegroundColor White
Write-Host ""

Write-Host "6️⃣ JUGAR:" -ForegroundColor Cyan
Write-Host "   - Activar Auto-Cantar" -ForegroundColor White
Write-Host "   - Marcar números hasta completar línea" -ForegroundColor White
Write-Host ""

Write-Host "7️⃣ CANTAR BINGO:" -ForegroundColor Cyan
Write-Host "   - Presionar botón '¡BINGO!' cuando aparezca el modal" -ForegroundColor White
Write-Host ""

Write-Host "8️⃣ VERIFICAR:" -ForegroundColor Cyan
Write-Host "   ✅ Modal de celebración aparece" -ForegroundColor Green
Write-Host "   ✅ Muestra nombre del ganador" -ForegroundColor Green
Write-Host "   ✅ Muestra premio total" -ForegroundColor Green
Write-Host "   ✅ Botón 'Aceptar' funciona" -ForegroundColor Green
Write-Host "   ✅ Regresa al lobby" -ForegroundColor Green
Write-Host ""

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  DIAGNÓSTICO SI FALLA" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Si el modal de celebración NO aparece:" -ForegroundColor Yellow
Write-Host ""

Write-Host "1. Abre el endpoint de diagnóstico:" -ForegroundColor White
$url = "https://confident-bravery-production-ce7b.up.railway.app/api/diagnostic/bingo-status/[CODIGO_SALA]"
Write-Host "   $url" -ForegroundColor Gray
Write-Host ""

Write-Host "2. Abre DevTools (F12) y busca en Console:" -ForegroundColor White
Write-Host "   - [FRONTEND] Evento bingo:game_over recibido" -ForegroundColor Gray
Write-Host ""

Write-Host "3. En Railway logs busca:" -ForegroundColor White
Write-Host "   - PARSEO DE MARKED_NUMBERS" -ForegroundColor Gray
Write-Host "   - RESULTADO DE VALIDACION" -ForegroundColor Gray
Write-Host "   - RETORNANDO BINGO VALIDO" -ForegroundColor Gray
Write-Host ""

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  FIN DEL SCRIPT" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ El servidor está listo para pruebas" -ForegroundColor Green
Write-Host "📝 Sigue los pasos indicados arriba" -ForegroundColor Yellow
Write-Host "🔍 Si hay problemas, usa las herramientas de diagnóstico" -ForegroundColor Yellow
