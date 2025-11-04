const { Pool } = require('pg');
const config = require('../config/config');
const logger = require('../utils/logger');

// Configure connection
const poolConfig = config.database.url ? {
  connectionString: config.database.url,
  ssl: config.database.sslMode === 'require' ? {
    rejectUnauthorized: false
  } : false,
  max: config.database.poolMax,
  idleTimeoutMillis: config.database.poolIdleMs
} : {
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  ssl: config.database.sslMode === 'require' ? {
    rejectUnauthorized: false
  } : false,
  max: config.database.poolMax,
  idleTimeoutMillis: config.database.poolIdleMs
};

// Create pool instance
let pool = null;

// Initialize database connection
async function initDatabase() {
  try {
    pool = new Pool(poolConfig);
    
    // Test connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    logger.info(`Database connected at ${result.rows[0].now}`);
    
    // Set up error handlers
    pool.on('error', (err) => {
      logger.error('Unexpected database error:', err);
    });
    
    pool.on('connect', () => {
      logger.debug('New database client connected');
    });
    
    pool.on('acquire', () => {
      logger.debug('Client acquired from pool');
    });
    
    pool.on('remove', () => {
      logger.debug('Client removed from pool');
    });
    
    return pool;
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

// Query helper with automatic client handling
async function query(text, params) {
  if (!pool) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      logger.warn(`Slow query (${duration}ms):`, { query: text, params });
    }
    
    return result;
  } catch (error) {
    logger.error('Database query error:', { 
      query: text, 
      params, 
      error: error.message 
    });
    throw error;
  }
}

// Transaction helper
async function transaction(callback) {
  if (!pool) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Get a client from the pool
async function getClient() {
  if (!pool) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return pool.connect();
}

// Check database health
async function checkHealth() {
  try {
    const result = await query('SELECT 1 as health');
    return { 
      status: 'healthy', 
      connected: true,
      poolSize: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return { 
      status: 'unhealthy', 
      connected: false, 
      error: error.message 
    };
  }
}

// Close database connection
async function closeDatabase() {
  if (pool) {
    await pool.end();
    logger.info('Database connection pool closed');
  }
}

// Export database utilities
module.exports = {
  initDatabase,
  query,
  transaction,
  getClient,
  checkHealth,
  closeDatabase,
  get pool() { return pool; }
};
