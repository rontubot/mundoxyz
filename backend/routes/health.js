const express = require('express');
const router = express.Router();
const { checkHealth: checkDbHealth } = require('../db');
const { checkHealth: checkRedisHealth } = require('../services/redis');
const os = require('os');

// Basic health check
router.get('/', async (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'mundoxyz',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Detailed health check
router.get('/detailed', async (req, res) => {
  try {
    // Check database
    const dbHealth = await checkDbHealth();
    
    // Check Redis
    const redisHealth = await checkRedisHealth();
    
    // System info
    const systemInfo = {
      uptime: process.uptime(),
      memory: {
        used: process.memoryUsage(),
        system: {
          total: os.totalmem(),
          free: os.freemem(),
          usage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2) + '%'
        }
      },
      cpu: {
        cores: os.cpus().length,
        loadAverage: os.loadavg()
      },
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
    
    // Overall health status
    const isHealthy = dbHealth.status === 'healthy' && redisHealth.status !== 'unhealthy';
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        api: 'healthy',
        database: dbHealth,
        redis: redisHealth
      },
      system: systemInfo
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Database health check
router.get('/db', async (req, res) => {
  try {
    const health = await checkDbHealth();
    res.status(health.connected ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      connected: false,
      error: error.message
    });
  }
});

// Redis health check
router.get('/redis', async (req, res) => {
  try {
    const health = await checkRedisHealth();
    res.status(health.connected ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      connected: false,
      error: error.message
    });
  }
});

// Readiness check (for Kubernetes/Docker)
router.get('/ready', async (req, res) => {
  try {
    const dbHealth = await checkDbHealth();
    
    if (dbHealth.connected) {
      res.status(200).json({ ready: true });
    } else {
      res.status(503).json({ ready: false, reason: 'Database not connected' });
    }
  } catch (error) {
    res.status(503).json({ ready: false, reason: error.message });
  }
});

// Liveness check (for Kubernetes/Docker)
router.get('/live', (req, res) => {
  res.status(200).json({ alive: true });
});

module.exports = router;
