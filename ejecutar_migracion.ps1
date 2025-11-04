Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "EJECUTANDO MIGRACION LA VIEJA EN RAILWAY" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

$nodeVersion = node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Node.js no esta instalado" -ForegroundColor Red
    exit 1
}

Write-Host "Node.js encontrado: $nodeVersion" -ForegroundColor Green

if (-not (Test-Path "MIGRACION_LA_VIEJA.sql")) {
    Write-Host "ERROR: No se encuentra MIGRACION_LA_VIEJA.sql" -ForegroundColor Red
    exit 1
}

Write-Host "Archivo SQL encontrado" -ForegroundColor Green
Write-Host ""

Write-Host "Verificando driver PostgreSQL..." -ForegroundColor Yellow

if (-not (Test-Path "node_modules\pg")) {
    Write-Host "Instalando driver pg..." -ForegroundColor Yellow
    npm install pg --no-save
}

Write-Host ""
Write-Host "Ejecutando migracion..." -ForegroundColor Cyan
Write-Host ""

node ejecutar_migracion.js

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "MIGRACION COMPLETADA EXITOSAMENTE" -ForegroundColor Green
    Write-Host ""
    Write-Host "Proximos pasos:" -ForegroundColor Cyan
    Write-Host "1. Refrescar la pagina web" -ForegroundColor White
    Write-Host "2. Tu balance de 4.75 fires deberia aparecer" -ForegroundColor White
    Write-Host "3. Podras crear salas en modo Fires" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "Error al ejecutar la migracion" -ForegroundColor Red
    exit 1
}
