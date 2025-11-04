const { query } = require('../db');

/**
 * Valida si un texto contiene palabras ofensivas
 * @param {string} text - Texto a validar
 * @returns {Promise<boolean>} - True si contiene palabras ofensivas
 */
async function containsOffensiveWords(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  const normalized = text.toLowerCase().trim();
  
  if (normalized.length === 0) {
    return false;
  }
  
  try {
    // Obtener lista de palabras ofensivas desde BD
    const result = await query('SELECT word FROM offensive_words');
    const offensiveWords = result.rows.map(row => row.word.toLowerCase());
    
    // Verificar si contiene alguna palabra ofensiva
    for (const word of offensiveWords) {
      // Buscar palabra completa o como parte de una palabra más larga
      const regex = new RegExp(`\\b${word}\\b|${word}`, 'i');
      if (regex.test(normalized)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking offensive words:', error);
    // En caso de error, mejor ser conservador y rechazar
    return false;
  }
}

/**
 * Agrega una nueva palabra ofensiva a la lista
 * @param {string} word - Palabra a agregar
 * @returns {Promise<boolean>} - True si se agregó exitosamente
 */
async function addOffensiveWord(word) {
  if (!word || typeof word !== 'string') {
    return false;
  }
  
  try {
    await query(
      'INSERT INTO offensive_words (word) VALUES ($1) ON CONFLICT (word) DO NOTHING',
      [word.toLowerCase().trim()]
    );
    return true;
  } catch (error) {
    console.error('Error adding offensive word:', error);
    return false;
  }
}

/**
 * Elimina una palabra de la lista de palabras ofensivas
 * @param {string} word - Palabra a eliminar
 * @returns {Promise<boolean>} - True si se eliminó exitosamente
 */
async function removeOffensiveWord(word) {
  if (!word || typeof word !== 'string') {
    return false;
  }
  
  try {
    await query(
      'DELETE FROM offensive_words WHERE LOWER(word) = LOWER($1)',
      [word.trim()]
    );
    return true;
  } catch (error) {
    console.error('Error removing offensive word:', error);
    return false;
  }
}

module.exports = {
  containsOffensiveWords,
  addOffensiveWord,
  removeOffensiveWord
};
