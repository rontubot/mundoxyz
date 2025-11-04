# Script PowerShell para ejecutar limpieza de salas
# Uso: .\ejecutar_limpieza.ps1

Write-Host "🧹 LIMPIEZA DE SALAS DUPLICADAS" -ForegroundColor Cyan
Write-Host ""

$dbUrl = "postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway"

Write-Host "▶️  Ejecutando script de limpieza..." -ForegroundColor Yellow

# Establecer variable de entorno temporalmente solo para este comando
$env:DB_CONNECTION = $dbUrl
node limpiar_salas_ahora.js

Write-Host ""
Write-Host "✅ Proceso completado" -ForegroundColor Green
