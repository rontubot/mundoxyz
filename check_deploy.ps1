Write-Host "Verificando estado del deploy de Railway..." -ForegroundColor Cyan
Write-Host ""

# Verificar Backend
Write-Host "1. Verificando Backend API..." -ForegroundColor Yellow
try {
    $backendResponse = Invoke-WebRequest -Uri "https://confident-bravery-production-ce7b.up.railway.app/api/health" -Method GET -UseBasicParsing -TimeoutSec 10
    Write-Host "   ✓ Backend activo - Status: $($backendResponse.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Backend no responde o está desplegando" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor DarkRed
}

Write-Host ""

# Verificar Frontend
Write-Host "2. Verificando Frontend..." -ForegroundColor Yellow
try {
    $frontendResponse = Invoke-WebRequest -Uri "https://confident-bravery-production-ce7b.up.railway.app/" -Method GET -UseBasicParsing -TimeoutSec 10
    if ($frontendResponse.StatusCode -eq 200) {
        Write-Host "   ✓ Frontend activo - Status: $($frontendResponse.StatusCode)" -ForegroundColor Green
        
        # Verificar si contiene el bundle JavaScript
        if ($frontendResponse.Content -match "main\.[a-f0-9]+\.js") {
            Write-Host "   ✓ Bundle JavaScript encontrado" -ForegroundColor Green
        } else {
            Write-Host "   ⚠ Bundle JavaScript no encontrado en el HTML" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "   ✗ Frontend no responde o está desplegando" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor DarkRed
}

Write-Host ""

# Verificar ruta específica de Raffles
Write-Host "3. Verificando rutas de Raffles..." -ForegroundColor Yellow
try {
    $rafflesResponse = Invoke-WebRequest -Uri "https://confident-bravery-production-ce7b.up.railway.app/api/raffles/public" -Method GET -UseBasicParsing -TimeoutSec 10
    Write-Host "   ✓ API de Raffles respondiendo - Status: $($rafflesResponse.StatusCode)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "   ⚠ Ruta /api/raffles/public no encontrada (404)" -ForegroundColor Yellow
    } elseif ($_.Exception.Response.StatusCode -eq 500) {
        Write-Host "   ✗ Error interno del servidor (500) en /api/raffles/public" -ForegroundColor Red
    } else {
        Write-Host "   ✗ Error al acceder a API de Raffles" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor DarkRed
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verificación completada" -ForegroundColor Cyan
