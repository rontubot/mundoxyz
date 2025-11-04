const logger = require('./logger');

/**
 * Generador de Cartones de Bingo
 * Soporta dos modos:
 * - 75 números: Formato americano (5x5 con centro libre)
 * - 90 números: Formato británico/europeo (9x3)
 */

class BingoCardGenerator {
  /**
   * Genera un cartón de bingo según el modo especificado
   * @param {number} mode - 75 o 90
   * @returns {Object} Cartón con estructura específica
   */
  static generateCard(mode) {
    if (mode === 75) {
      return this.generate75Card();
    } else if (mode === 90) {
      return this.generate90Card();
    } else {
      throw new Error(`Modo de bingo inválido: ${mode}. Debe ser 75 o 90.`);
    }
  }

  /**
   * Genera cartón de 75 números (formato americano)
   * Estructura 5x5 con centro libre
   * B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
   */
  static generate75Card() {
    const card = {
      mode: 75,
      structure: 'grid_5x5',
      columns: {
        B: [], // 1-15
        I: [], // 16-30
        N: [], // 31-45 (con centro libre)
        G: [], // 46-60
        O: []  // 61-75
      },
      grid: [],
      allNumbers: []
    };

    // Rangos para cada columna
    const ranges = {
      B: { min: 1, max: 15 },
      I: { min: 16, max: 30 },
      N: { min: 31, max: 45 },
      G: { min: 46, max: 60 },
      O: { min: 61, max: 75 }
    };

    // Generar números para cada columna
    Object.keys(ranges).forEach(letter => {
      const range = ranges[letter];
      const numbers = this.getRandomNumbers(range.min, range.max, 5);
      card.columns[letter] = numbers.sort((a, b) => a - b);
    });

    // Construir grid 5x5
    for (let row = 0; row < 5; row++) {
      const gridRow = [];
      ['B', 'I', 'N', 'G', 'O'].forEach((letter, col) => {
        // Centro libre en N (posición 2,2)
        if (letter === 'N' && row === 2) {
          gridRow.push({ value: 'FREE', marked: true, free: true });
        } else {
          const value = card.columns[letter][row];
          gridRow.push({ value, marked: false, free: false });
          card.allNumbers.push(value);
        }
      });
      card.grid.push(gridRow);
    }

    // Remover el número del centro de la columna N
    card.columns.N.splice(2, 1);

    logger.info('Cartón de 75 números generado', { 
      totalNumbers: card.allNumbers.length,
      hasFreeSpace: true 
    });

    return card;
  }

  /**
   * Genera cartón de 90 números (formato británico/europeo)
   * Estructura 9x3 (27 celdas totales, 15 con números)
   * Cada fila tiene exactamente 5 números
   * Cada columna tiene reglas específicas de distribución
   */
  static generate90Card() {
    const card = {
      mode: 90,
      structure: 'grid_9x3',
      grid: [],
      allNumbers: [],
      strips: [] // Para compatibilidad con formato de tiras
    };

    // Definir rangos por columna
    const columnRanges = [
      { min: 1, max: 9 },    // Columna 0: 1-9
      { min: 10, max: 19 },  // Columna 1: 10-19
      { min: 20, max: 29 },  // Columna 2: 20-29
      { min: 30, max: 39 },  // Columna 3: 30-39
      { min: 40, max: 49 },  // Columna 4: 40-49
      { min: 50, max: 59 },  // Columna 5: 50-59
      { min: 60, max: 69 },  // Columna 6: 60-69
      { min: 70, max: 79 },  // Columna 7: 70-79
      { min: 80, max: 90 }   // Columna 8: 80-90 (incluye 90)
    ];

    // Inicializar grid vacío
    for (let row = 0; row < 3; row++) {
      card.grid.push(new Array(9).fill(null));
    }

    // Determinar cuántos números por columna (1-3 números, total 15)
    const numbersPerColumn = this.distributeNumbers90();
    
    // Generar números para cada columna
    for (let col = 0; col < 9; col++) {
      const count = numbersPerColumn[col];
      if (count > 0) {
        const range = columnRanges[col];
        const maxNumbers = col === 8 ? 11 : 10; // Columna 8 tiene 11 números (80-90)
        const numbers = this.getRandomNumbers(range.min, range.max, count);
        
        // Ordenar números de menor a mayor
        numbers.sort((a, b) => a - b);
        
        // Distribuir en las filas disponibles
        const availableRows = this.getAvailableRowsForColumn(card.grid, col);
        numbers.forEach((num, idx) => {
          if (idx < availableRows.length) {
            const row = availableRows[idx];
            card.grid[row][col] = { value: num, marked: false };
            card.allNumbers.push(num);
          }
        });
      }
    }

    // Validar que cada fila tenga exactamente 5 números
    for (let row = 0; row < 3; row++) {
      const rowNumbers = card.grid[row].filter(cell => cell !== null).length;
      if (rowNumbers !== 5) {
        // Ajustar si es necesario
        logger.warn('Fila con cantidad incorrecta de números', { 
          row, 
          expected: 5, 
          actual: rowNumbers 
        });
      }
    }

    // Convertir nulls a espacios vacíos para visualización
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 9; col++) {
        if (card.grid[row][col] === null) {
          card.grid[row][col] = { value: null, marked: false, empty: true };
        }
      }
    }

    // Crear formato de tiras (3 tiras de 1x9)
    card.strips = card.grid.map(row => row.map(cell => cell.value));

    logger.info('Cartón de 90 números generado', { 
      totalNumbers: card.allNumbers.length,
      expectedNumbers: 15 
    });

    return card;
  }

  /**
   * Distribuye 15 números entre 9 columnas
   * Cada columna puede tener 1, 2 o 3 números
   * Cada fila debe tener exactamente 5 números
   */
  static distributeNumbers90() {
    const distribution = new Array(9).fill(0);
    const rowCounts = [0, 0, 0]; // Contador por fila
    
    // Primero, asegurar al menos 1 número por columna que tenga números
    const columnsWithNumbers = this.shuffleArray([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    
    // Distribuir 15 números
    let numbersPlaced = 0;
    
    // Primera pasada: asegurar 5 números por fila
    for (let row = 0; row < 3; row++) {
      const availableCols = [];
      for (let col = 0; col < 9; col++) {
        if (distribution[col] < 3) {
          availableCols.push(col);
        }
      }
      
      // Seleccionar 5 columnas aleatorias para esta fila
      const selectedCols = this.shuffleArray(availableCols).slice(0, 5);
      selectedCols.forEach(col => {
        distribution[col]++;
        numbersPlaced++;
      });
    }
    
    // Ajustar si no son exactamente 15 números
    while (numbersPlaced < 15) {
      for (let col = 0; col < 9 && numbersPlaced < 15; col++) {
        if (distribution[col] < 3) {
          distribution[col]++;
          numbersPlaced++;
        }
      }
    }
    
    while (numbersPlaced > 15) {
      for (let col = 8; col >= 0 && numbersPlaced > 15; col--) {
        if (distribution[col] > 1) {
          distribution[col]--;
          numbersPlaced--;
        }
      }
    }
    
    return distribution;
  }

  /**
   * Obtiene las filas disponibles para colocar números en una columna
   */
  static getAvailableRowsForColumn(grid, col) {
    const available = [];
    for (let row = 0; row < 3; row++) {
      // Verificar que la fila no tenga ya 5 números
      const rowNumbers = grid[row].filter(cell => cell !== null).length;
      if (rowNumbers < 5 && grid[row][col] === null) {
        available.push(row);
      }
    }
    return this.shuffleArray(available);
  }

  /**
   * Genera números aleatorios únicos en un rango
   */
  static getRandomNumbers(min, max, count) {
    const numbers = [];
    const available = [];
    
    for (let i = min; i <= max; i++) {
      available.push(i);
    }
    
    for (let i = 0; i < count && available.length > 0; i++) {
      const index = Math.floor(Math.random() * available.length);
      numbers.push(available.splice(index, 1)[0]);
    }
    
    return numbers;
  }

  /**
   * Mezcla un array (Fisher-Yates)
   */
  static shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Valida que un cartón tenga la estructura correcta
   */
  static validateCard(card) {
    try {
      if (!card || !card.mode || !card.grid) {
        return { valid: false, error: 'Estructura de cartón inválida' };
      }

      if (card.mode === 75) {
        // Validar cartón de 75
        if (card.grid.length !== 5) {
          return { valid: false, error: 'Grid debe ser 5x5' };
        }
        
        let numbersCount = 0;
        for (let row of card.grid) {
          if (row.length !== 5) {
            return { valid: false, error: 'Cada fila debe tener 5 columnas' };
          }
          numbersCount += row.filter(cell => !cell.free).length;
        }
        
        if (numbersCount !== 24) { // 25 - 1 espacio libre
          return { valid: false, error: 'Debe tener 24 números más espacio libre' };
        }
        
        // Verificar centro libre
        if (!card.grid[2][2].free) {
          return { valid: false, error: 'Centro debe ser espacio libre' };
        }
      } else if (card.mode === 90) {
        // Validar cartón de 90
        if (card.grid.length !== 3) {
          return { valid: false, error: 'Grid debe ser 3x9' };
        }
        
        let totalNumbers = 0;
        for (let row of card.grid) {
          if (row.length !== 9) {
            return { valid: false, error: 'Cada fila debe tener 9 columnas' };
          }
          
          const rowNumbers = row.filter(cell => cell.value !== null).length;
          if (rowNumbers !== 5) {
            return { valid: false, error: `Cada fila debe tener exactamente 5 números` };
          }
          totalNumbers += rowNumbers;
        }
        
        if (totalNumbers !== 15) {
          return { valid: false, error: 'Debe tener exactamente 15 números' };
        }
      } else {
        return { valid: false, error: 'Modo de cartón no soportado' };
      }

      return { valid: true };
    } catch (error) {
      logger.error('Error validando cartón:', error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Genera múltiples cartones únicos
   */
  static generateMultipleCards(mode, count) {
    const cards = [];
    const usedHashes = new Set();
    
    for (let i = 0; i < count; i++) {
      let attempts = 0;
      let card;
      let hash;
      
      do {
        card = this.generateCard(mode);
        hash = this.getCardHash(card);
        attempts++;
        
        if (attempts > 100) {
          throw new Error('No se pudieron generar suficientes cartones únicos');
        }
      } while (usedHashes.has(hash));
      
      usedHashes.add(hash);
      cards.push(card);
    }
    
    logger.info('Múltiples cartones generados', { 
      mode, 
      count, 
      uniqueCards: cards.length 
    });
    
    return cards;
  }

  /**
   * Genera un hash único para un cartón
   */
  static getCardHash(card) {
    return card.allNumbers.sort((a, b) => a - b).join('-');
  }
}

module.exports = BingoCardGenerator;
