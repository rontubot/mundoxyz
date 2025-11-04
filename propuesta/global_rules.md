# Reglas Generales • Bingo

Fecha: 2025-10-15

## Modalidades
- **Amistoso**: cada jugador puede elegir entre 1 y 10 cartones; no hay costo de entrada.
- **Fuego**: cada cartón tiene un costo mínimo de **10 🔥**. Al iniciar se descuenta del anfitrión (depósito al patrocinador) y de cada jugador listo; los montos de participantes se destinan al pozo.
- **Monedas**: mismo flujo que Fuego pero usando **coins** (mínimo 10 monedas por cartón). El anfitrión deposita el total al patrocinador y los jugadores aportan al pozo en monedas.

## Configuración de sala (host)
- **Visibilidad**: Privada / Pública.
- **Modo de victoria**: Línea (fila, columna o diagonal), 4 Esquinas, Cartón Lleno.
- **Cantidad de bolas**: seleccionar 75 o 90 números al crear la sala.
- **Costo de la partida**: Libre / Fuego / Monedas. En Fuego o Monedas el valor mínimo permitido es 10.
- **Cartones por jugador**: 1–10; cada jugador define su cantidad y marca "Listo".

## Flujo de juego
- **Lobby**: el anfitrión ajusta opciones; los jugadores ingresan por código, eligen cartones y marcan "Listo". Solo el anfitrión puede iniciar.
- **Inicio**: se generan cartones para cada jugador listo. El anfitrión transfiere su depósito directamente al patrocinador **tg:1417856820** y se cobran los participantes; los montos de los jugadores alimentan el pozo (🔥 o coins según modalidad).
- **Juego**: se extraen números según la bolsa (75 o 90). Las casillas centrales son **FREE**. El marcado es manual por el jugador; los números cantados solo resaltan.
- **Cantar**: el anfitrión dispone de un botón flotante "Cantar". El servidor valida contra los números llamados según el modo de victoria.
- **Fin**: al validar un Bingo, el estado pasa a "finished"; se muestra el ganador, distribución económica, botón "Revancha" e "Ir al Lobby".

## Economía y reparto del pozo
- Se gestionan dos pozos independientes: 🔥 y coins.
- Distribución al finalizar (en cada moneda): **70%** al ganador, **20%** al anfitrión, **10%** al patrocinador fijo **tg:1417856820**.
- Tras el reparto se registra la victoria en `memoryStore.recordBingoWin()` con totales y desglose por moneda.

## Registro histórico
- Cada partida ganada se almacena en memoria (`bingoWins`) con: sala, ganador, anfitrión, modo, conjunto de bolas y montos pagados.
- API futura podrá exponer este historial por usuario para estadísticas y reseñas.

## Tiempo real y UX
- Actualizaciones en vivo mediante **SSE** (estado de sala, números, banner de sala activa).
- Footer persistente en lobby y sala; el botón "Cantar" solo aparece para el anfitrión.
- Cartones mostrados en una cuadrícula de dos columnas con scroll independiente.

## Pruebas y operación
- Diagnóstico obligatorio con **Chrome DevTools MCP** (consola/red) y generación de regresiones con **TestSprite**.
- Validaciones manuales: creación de salas 75/90, modalidades Fuego/Monedas, payout 70/20/10, registro histórico.
- En **PowerShell 5.1**, evitar `&&`; usar `$LASTEXITCODE` o `cmd /c`.

## Notas técnicas
- Validación de victoria del lado del servidor; casilla central **FREE**.
- Controles: solo el anfitrión puede iniciar y extraer; los jugadores eligen cartones y se marcan "Listo".
- Código fuente actualizado en `backend/services/bingoStore.js`, `memoryStore.js`, `public/bingo.html` y `public/games.html` para reflejar estos cambios.
