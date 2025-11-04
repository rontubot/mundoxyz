const bcrypt = require('bcryptjs');
const logger = require('./logger');

/**
 * Hashea una respuesta de seguridad
 * Convierte a lowercase y trim para evitar case sensitivity
 */
async function hashSecurityAnswer(answer) {
  if (!answer || typeof answer !== 'string') {
    throw new Error('Respuesta de seguridad inválida');
  }
  
  // Normalizar: lowercase y trim
  const normalized = answer.toLowerCase().trim();
  
  if (normalized.length < 3) {
    throw new Error('Respuesta de seguridad debe tener al menos 3 caracteres');
  }
  
  if (normalized.length > 255) {
    throw new Error('Respuesta de seguridad muy larga (máximo 255 caracteres)');
  }
  
  // Hashear con bcrypt (10 rounds)
  const hash = await bcrypt.hash(normalized, 10);
  
  logger.info('Security answer hashed', { length: normalized.length });
  
  return hash;
}

/**
 * Compara una respuesta de seguridad con su hash
 */
async function compareSecurityAnswer(answer, hash) {
  if (!answer || !hash) {
    return false;
  }
  
  try {
    // Normalizar la respuesta igual que al hashear
    const normalized = answer.toLowerCase().trim();
    
    // Comparar con bcrypt
    const isMatch = await bcrypt.compare(normalized, hash);
    
    logger.info('Security answer comparison', { matched: isMatch });
    
    return isMatch;
  } catch (error) {
    logger.error('Error comparing security answer:', error);
    return false;
  }
}

/**
 * Valida formato de respuesta de seguridad
 */
function validateSecurityAnswer(answer) {
  if (!answer || typeof answer !== 'string') {
    return { valid: false, error: 'Respuesta de seguridad requerida' };
  }
  
  const trimmed = answer.trim();
  
  if (trimmed.length < 3) {
    return { valid: false, error: 'Respuesta debe tener al menos 3 caracteres' };
  }
  
  if (trimmed.length > 255) {
    return { valid: false, error: 'Respuesta muy larga (máximo 255 caracteres)' };
  }
  
  return { valid: true };
}

module.exports = {
  hashSecurityAnswer,
  compareSecurityAnswer,
  validateSecurityAnswer
};
