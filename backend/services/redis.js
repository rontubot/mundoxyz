const redis = require('redis');
const config = require('../config/config');
const logger = require('../utils/logger');

let client = null;

// Initialize Redis connection
async function initRedis() {
  try {
    // Skip Redis in production if not explicitly configured
    if (process.env.NODE_ENV === 'production' && 
        (!process.env.REDIS_HOST || process.env.REDIS_HOST === 'localhost')) {
      logger.warn('Redis not configured for production. Running without cache.');
      return null;
    }

    // Skip Redis in development if explicitly disabled
    if (process.env.REDIS_ENABLED === 'false') {
      logger.info('Redis explicitly disabled.');
      return null;
    }

    const redisConfig = {
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          // Stop reconnecting after 3 attempts
          if (retries > 3) {
            logger.warn('Redis reconnect attempts exhausted. Disabling Redis.');
            return false; // Stop reconnecting
          }
          return Math.min(retries * 100, 3000);
        }
      }
    };

    if (config.redis.password) {
      redisConfig.password = config.redis.password;
    }

    if (config.redis.db) {
      redisConfig.database = config.redis.db;
    }

    client = redis.createClient(redisConfig);

    // Error handling
    client.on('error', (err) => {
      logger.error('Redis Client Error:', err.message);
    });

    client.on('connect', () => {
      logger.info('Redis Client Connected');
    });

    client.on('ready', () => {
      logger.info('Redis Client Ready');
    });

    client.on('end', () => {
      logger.warn('Redis Client Connection Closed');
    });

    client.on('reconnecting', () => {
      logger.warn('Redis Client Reconnecting...');
    });

    // Connect to Redis with timeout
    await Promise.race([
      client.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
      )
    ]);

    logger.info('Redis initialized successfully');
    return client;
  } catch (error) {
    logger.warn('Failed to initialize Redis (running without cache):', error.message);
    // Cleanup failed client
    if (client) {
      try {
        await client.disconnect();
      } catch (_) {}
      client = null;
    }
    // Don't throw - Redis is optional, app can work without it
    return null;
  }
}

// Get value from cache
async function get(key) {
  if (!client || !client.isOpen) return null;
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error(`Redis GET error for key ${key}:`, error);
    return null;
  }
}

// Set value in cache with optional TTL
async function set(key, value, ttlSeconds = null) {
  if (!client || !client.isOpen) return false;
  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await client.setEx(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }
    return true;
  } catch (error) {
    logger.error(`Redis SET error for key ${key}:`, error);
    return false;
  }
}

// Delete key from cache
async function del(key) {
  if (!client || !client.isOpen) return false;
  try {
    await client.del(key);
    return true;
  } catch (error) {
    logger.error(`Redis DEL error for key ${key}:`, error);
    return false;
  }
}

// Check if key exists
async function exists(key) {
  if (!client || !client.isOpen) return false;
  try {
    const result = await client.exists(key);
    return result === 1;
  } catch (error) {
    logger.error(`Redis EXISTS error for key ${key}:`, error);
    return false;
  }
}

// Set with expiration (for sessions, temporary data)
async function setex(key, seconds, value) {
  if (!client || !client.isOpen) return false;
  try {
    const serialized = JSON.stringify(value);
    await client.setEx(key, seconds, serialized);
    return true;
  } catch (error) {
    logger.error(`Redis SETEX error for key ${key}:`, error);
    return false;
  }
}

// Increment counter
async function incr(key) {
  if (!client || !client.isOpen) return null;
  try {
    const value = await client.incr(key);
    return value;
  } catch (error) {
    logger.error(`Redis INCR error for key ${key}:`, error);
    return null;
  }
}

// Decrement counter
async function decr(key) {
  if (!client || !client.isOpen) return null;
  try {
    const value = await client.decr(key);
    return value;
  } catch (error) {
    logger.error(`Redis DECR error for key ${key}:`, error);
    return null;
  }
}

// Get all keys matching pattern
async function keys(pattern) {
  if (!client || !client.isOpen) return [];
  try {
    const keys = await client.keys(pattern);
    return keys;
  } catch (error) {
    logger.error(`Redis KEYS error for pattern ${pattern}:`, error);
    return [];
  }
}

// Hash operations
async function hset(key, field, value) {
  if (!client || !client.isOpen) return false;
  try {
    await client.hSet(key, field, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error(`Redis HSET error for key ${key}:`, error);
    return false;
  }
}

async function hget(key, field) {
  if (!client || !client.isOpen) return null;
  try {
    const value = await client.hGet(key, field);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error(`Redis HGET error for key ${key}:`, error);
    return null;
  }
}

async function hgetall(key) {
  if (!client || !client.isOpen) return null;
  try {
    const hash = await client.hGetAll(key);
    const result = {};
    for (const [field, value] of Object.entries(hash)) {
      try {
        result[field] = JSON.parse(value);
      } catch {
        result[field] = value;
      }
    }
    return result;
  } catch (error) {
    logger.error(`Redis HGETALL error for key ${key}:`, error);
    return null;
  }
}

// List operations
async function lpush(key, value) {
  if (!client || !client.isOpen) return false;
  try {
    await client.lPush(key, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error(`Redis LPUSH error for key ${key}:`, error);
    return false;
  }
}

async function rpush(key, value) {
  if (!client || !client.isOpen) return false;
  try {
    await client.rPush(key, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error(`Redis RPUSH error for key ${key}:`, error);
    return false;
  }
}

async function lrange(key, start, stop) {
  if (!client || !client.isOpen) return [];
  try {
    const list = await client.lRange(key, start, stop);
    return list.map(item => {
      try {
        return JSON.parse(item);
      } catch {
        return item;
      }
    });
  } catch (error) {
    logger.error(`Redis LRANGE error for key ${key}:`, error);
    return [];
  }
}

// Set operations
async function sadd(key, member) {
  if (!client || !client.isOpen) return false;
  try {
    await client.sAdd(key, member);
    return true;
  } catch (error) {
    logger.error(`Redis SADD error for key ${key}:`, error);
    return false;
  }
}

async function smembers(key) {
  if (!client || !client.isOpen) return [];
  try {
    const members = await client.sMembers(key);
    return members;
  } catch (error) {
    logger.error(`Redis SMEMBERS error for key ${key}:`, error);
    return [];
  }
}

async function sismember(key, member) {
  if (!client || !client.isOpen) return false;
  try {
    const isMember = await client.sIsMember(key, member);
    return isMember;
  } catch (error) {
    logger.error(`Redis SISMEMBER error for key ${key}:`, error);
    return false;
  }
}

// Pub/Sub operations
async function publish(channel, message) {
  if (!client || !client.isOpen) return false;
  try {
    await client.publish(channel, JSON.stringify(message));
    return true;
  } catch (error) {
    logger.error(`Redis PUBLISH error for channel ${channel}:`, error);
    return false;
  }
}

// Subscribe to channel (returns subscriber client)
async function subscribe(channel, callback) {
  if (!client || !client.isOpen) return null;
  try {
    const subscriber = client.duplicate();
    await subscriber.connect();
    
    await subscriber.subscribe(channel, (message) => {
      try {
        const parsed = JSON.parse(message);
        callback(parsed);
      } catch {
        callback(message);
      }
    });
    
    return subscriber;
  } catch (error) {
    logger.error(`Redis SUBSCRIBE error for channel ${channel}:`, error);
    return null;
  }
}

// Close Redis connection
async function closeRedis() {
  if (client && client.isOpen) {
    await client.quit();
    logger.info('Redis connection closed');
  }
}

// Check Redis health
async function checkHealth() {
  if (!client || !client.isOpen) {
    return { status: 'disconnected', connected: false };
  }
  try {
    await client.ping();
    return { status: 'healthy', connected: true };
  } catch (error) {
    return { status: 'unhealthy', connected: false, error: error.message };
  }
}

module.exports = {
  initRedis,
  get,
  set,
  del,
  exists,
  setex,
  incr,
  decr,
  keys,
  hset,
  hget,
  hgetall,
  lpush,
  rpush,
  lrange,
  sadd,
  smembers,
  sismember,
  publish,
  subscribe,
  closeRedis,
  checkHealth,
  get client() { return client; }
};
