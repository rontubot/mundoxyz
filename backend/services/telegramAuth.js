const crypto = require('crypto');
const config = require('../config/config');
const logger = require('../utils/logger');

// Cache for replay protection
const replayCache = new Map();

// Clean replay cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [hash, timestamp] of replayCache.entries()) {
    if (now - timestamp > config.telegram.replayTtlSec * 1000) {
      replayCache.delete(hash);
    }
  }
}, 60000); // Clean every minute

/**
 * Verify Telegram WebApp initData
 * @param {string} initData - The initData string from Telegram WebApp
 * @returns {object|null} Parsed user data if valid, null otherwise
 */
function verifyTelegramWebAppData(initData) {
  try {
    // Allow unverified in development if configured
    if (config.telegram.allowUnverifiedInit && config.server.env === 'development') {
      logger.warn('Skipping Telegram verification (development mode)');
      return parseTelegramInitData(initData);
    }

    if (!config.telegram.botToken) {
      logger.error('TELEGRAM_BOT_TOKEN not configured');
      return null;
    }

    // Parse the initData string
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');

    // Check for hash
    if (!hash) {
      logger.error('No hash in initData');
      return null;
    }

    // Check replay attack
    if (replayCache.has(hash)) {
      logger.warn('Replay attack detected', { hash });
      return null;
    }

    // Sort parameters and create data check string
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Create secret key
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(config.telegram.botToken)
      .digest();

    // Calculate hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Verify hash
    if (calculatedHash !== hash) {
      logger.error('Invalid hash in Telegram initData');
      return null;
    }

    // Check auth_date freshness
    const authDate = parseInt(urlParams.get('auth_date'), 10);
    if (!authDate) {
      logger.error('No auth_date in initData');
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const age = now - authDate;
    
    if (age > config.telegram.authMaxSkewSec) {
      logger.error('Telegram auth data too old', { age, maxAge: config.telegram.authMaxSkewSec });
      return null;
    }

    // Store hash to prevent replay
    replayCache.set(hash, Date.now());

    // Parse user data
    const userData = parseTelegramInitData(initData);
    
    if (userData) {
      logger.info('Telegram WebApp auth successful', { 
        userId: userData.id, 
        username: userData.username 
      });
    }

    return userData;
  } catch (error) {
    logger.error('Error verifying Telegram WebApp data:', error);
    return null;
  }
}

/**
 * Verify Telegram Login Widget data
 * @param {object} data - The data object from Telegram Login Widget
 * @returns {object|null} User data if valid, null otherwise
 */
function verifyTelegramWidgetData(data) {
  try {
    // Allow unverified in development if configured
    if (config.telegram.allowUnverifiedInit && config.server.env === 'development') {
      logger.warn('Skipping Telegram widget verification (development mode)');
      return data;
    }

    if (!config.telegram.botToken) {
      logger.error('TELEGRAM_BOT_TOKEN not configured');
      return null;
    }

    const { hash, ...dataToCheck } = data;

    if (!hash) {
      logger.error('No hash in widget data');
      return null;
    }

    // Create data check string
    const dataCheckString = Object.keys(dataToCheck)
      .sort()
      .map(key => `${key}=${dataToCheck[key]}`)
      .join('\n');

    // Calculate hash
    const secretKey = crypto
      .createHash('sha256')
      .update(config.telegram.botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Verify hash
    if (calculatedHash !== hash) {
      logger.error('Invalid hash in Telegram widget data');
      return null;
    }

    // Check auth_date freshness
    const authDate = parseInt(data.auth_date, 10);
    if (!authDate) {
      logger.error('No auth_date in widget data');
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const age = now - authDate;
    
    if (age > config.telegram.authMaxSkewSec) {
      logger.error('Telegram widget auth data too old', { age });
      return null;
    }

    logger.info('Telegram widget auth successful', { 
      userId: data.id, 
      username: data.username 
    });

    return data;
  } catch (error) {
    logger.error('Error verifying Telegram widget data:', error);
    return null;
  }
}

/**
 * Parse Telegram initData string into user object
 * @param {string} initData - The initData string
 * @returns {object|null} Parsed user data
 */
function parseTelegramInitData(initData) {
  try {
    const urlParams = new URLSearchParams(initData);
    const userParam = urlParams.get('user');
    
    if (!userParam) {
      logger.error('No user data in initData');
      return null;
    }

    const user = JSON.parse(decodeURIComponent(userParam));
    
    // Add additional data from initData
    return {
      ...user,
      auth_date: parseInt(urlParams.get('auth_date'), 10),
      query_id: urlParams.get('query_id'),
      hash: urlParams.get('hash'),
      start_param: urlParams.get('start_param')
    };
  } catch (error) {
    logger.error('Error parsing Telegram initData:', error);
    return null;
  }
}

/**
 * Generate Telegram WebApp URL with start parameter
 * @param {string} startParam - Optional start parameter
 * @returns {string} WebApp URL
 */
function generateWebAppUrl(startParam = null) {
  const baseUrl = `https://t.me/${config.telegram.botUsername}`;
  
  if (startParam) {
    return `${baseUrl}?start=${startParam}`;
  }
  
  return baseUrl;
}

/**
 * Check if user is Tote (admin)
 * @param {string|number} userId - Telegram user ID
 * @returns {boolean}
 */
function isToteUser(userId) {
  const toteId = config.telegram.toteId;
  return String(userId) === String(toteId);
}

/**
 * Format user identifier
 * @param {string} provider - Provider type (tg, em, db)
 * @param {string} id - User ID
 * @returns {string} Formatted identifier
 */
function formatUserIdentifier(provider, id) {
  return `${provider}:${id}`;
}

/**
 * Parse user identifier
 * @param {string} identifier - Formatted identifier (e.g., 'tg:123456')
 * @returns {object} { provider, id }
 */
function parseUserIdentifier(identifier) {
  const [provider, ...idParts] = identifier.split(':');
  return {
    provider,
    id: idParts.join(':')
  };
}

module.exports = {
  verifyTelegramWebAppData,
  verifyTelegramWidgetData,
  parseTelegramInitData,
  generateWebAppUrl,
  isToteUser,
  formatUserIdentifier,
  parseUserIdentifier
};
