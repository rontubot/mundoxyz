require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { createServer } = require('http');
const { Server } = require('socket.io');
const logger = require('./utils/logger');
const config = require('./config/config');
const { initDatabase } = require('./db');
const { initRedis } = require('./services/redis');

// Import routes
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const economyRoutes = require('./routes/economy');
const welcomeRoutes = require('./routes/welcome');
const adminRoutes = require('./routes/admin');
const rolesRoutes = require('./routes/roles');
const healthRoutes = require('./routes/health');
const gameRoutes = require('./routes/games');
const bingoV2Routes = require('./routes/bingoV2');
const rafflesRoutes = require('./routes/raffles');
const marketRoutes = require('./routes/market');
const tictactoeRoutes = require('./routes/tictactoe');
const diagnosticRoutes = require('./routes/diagnostic');
const debugXpRoutes = require('./routes/debug-xp');

// Create Express app
const app = express();
const server = createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      // Allow same origins as Express CORS
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        config.server.frontendUrl,
        'http://localhost:3000',
        'http://localhost:3001',
        'https://web.telegram.org',
        'https://telegram.org',
        /^https:\/\/.*\.telegram\.org$/,
        /^https?:\/\/.*\.up\.railway\.app$/
      ];

      const isAllowed = allowedOrigins.some(allowed => {
        if (!allowed) return false;
        if (allowed instanceof RegExp) return allowed.test(origin);
        return allowed === origin;
      });

      callback(null, isAllowed);
    },
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Initialize Bingo V2 Socket handlers
const handleBingoV2Socket = require('./socket/bingoV2');
handleBingoV2Socket(io);

// Socket.IO connection handler
io.on('connection', (socket) => {
  logger.info('New socket connection:', socket.id);
  
  // Initialize TicTacToe socket handlers
  const { initTicTacToeSocket } = require('./socket/tictactoe');
  initTicTacToeSocket(io, socket);
  
  socket.on('disconnect', () => {
    logger.info('Socket disconnected:', socket.id);
  });
});

// Make io available to routes
app.set('io', io);

// Readiness flags
let dbReady = false;
let redisReady = false;

// Trust proxy - Always enable in production (Railway, Heroku, etc.)
// This is required for rate limiting and getting correct client IPs
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust first proxy (Railway)
  logger.info('Trust proxy enabled for production');
} else if (config.server.trustProxyHops) {
  app.set('trust proxy', config.server.trustProxyHops);
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "https://telegram.org", "https://web.telegram.org"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://telegram.org", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: ["'self'", "wss:", "https:", "http:"],
      frameSrc: ["'self'", "https://web.telegram.org"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"]
    }
  },
  crossOriginEmbedderPolicy: false,
  frameguard: false // Deshabilitado para Telegram WebApp
}));

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      config.server.frontendUrl,
      'http://localhost:3000',
      'http://localhost:3001',
      'https://web.telegram.org',
      'https://telegram.org',
      /^https:\/\/.*\.telegram\.org$/,
      /^https?:\/\/.*\.up\.railway\.app$/
    ];

    const isAllowed = allowedOrigins.some(allowed => {
      if (!allowed) return false;
      if (allowed instanceof RegExp) return allowed.test(origin);
      return allowed === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'x-admin-username', 'x-admin-code', 'x-test-runner']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.maxRequests,
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for test runner
    if (config.server.allowTestRunner && req.headers['x-test-runner'] === 'testsprite') {
      return true;
    }
    // Skip for Telegram user agent
    if (req.headers['user-agent'] && req.headers['user-agent'].includes('TelegramBot')) {
      return true;
    }
    return false;
  }
});

// Block API requests until DB is ready
app.use('/api', (req, res, next) => {
  if (!dbReady) {
    return res.status(503).json({ error: 'Service initializing, please retry' });
  }
  next();
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  next();
});

// Serve static files in production
const buildPath = path.join(__dirname, '../frontend/build');
if (process.env.NODE_ENV === 'production' || fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  logger.info(`Serving static files from: ${buildPath}`);
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/economy', economyRoutes);
app.use('/api/welcome', welcomeRoutes);
app.use('/api/gifts', require('./routes/gifts'));
app.use('/api/admin', adminRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/tictactoe', (req, res, next) => {
  req.io = io;
  next();
}, tictactoeRoutes);
app.use('/api/bingo/v2', (req, res, next) => {
  req.io = io;
  next();
}, bingoV2Routes);
app.use('/api/raffles', rafflesRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/diagnostic', diagnosticRoutes);
app.use('/api/debug-xp', debugXpRoutes);

// Config endpoint for frontend
app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.send(`window.APP_CONFIG = {
    API_URL: '${config.server.apiUrl || ''}',
    TELEGRAM_BOT_USERNAME: '${config.telegram.botUsername}',
    PUBLIC_WEBAPP_URL: '${config.telegram.webappUrl}',
    FEATURES: {
      TTT_V2: ${config.features.tttV2},
      TTT_DB_WALLET: ${config.features.tttDbWallet},
      WELCOME_AUTOSTART: ${config.features.welcomeAutostart}
    }
  };`);
});

// Catch-all route for React app (production)
if (process.env.NODE_ENV === 'production' || fs.existsSync(buildPath)) {
  app.get('*', (req, res) => {
    const indexPath = path.join(buildPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Frontend build not found');
    }
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  // Don't leak error details in production
  const isDev = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Internal server error',
    stack: isDev ? err.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize services and start server
async function startServer() {
  try {
    const PORT = config.server.port;

    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📱 Telegram Bot: @${config.telegram.botUsername}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
    });

    (async () => {
      try {
        await initDatabase();
        dbReady = true;
        logger.info('✅ Database connected');
        
        // Start Bingo V2 failure detection job
        const bingoV2FailureDetection = require('./jobs/bingoV2FailureDetection');
        bingoV2FailureDetection.start();
        logger.info('✅ Bingo V2 Failure Detection Job started');
        
        // Start Gift Expiration Job
        const giftService = require('./services/giftService');
        setInterval(async () => {
          try {
            await giftService.expireOldGifts();
          } catch (error) {
            logger.error('Error in gift expiration job:', error);
          }
        }, 3600000); // Run every hour
        logger.info('✅ Gift Expiration Job started - runs every hour');
      } catch (error) {
        logger.error('Failed to initialize database:', error);
      }
    })();

    (async () => {
      try {
        await initRedis();
        redisReady = true;
        logger.info('✅ Redis connected');
      } catch (error) {
        logger.error('Failed to initialize Redis:', error);
      }
    })();

    // Initialize Telegram bot
    (async () => {
      try {
        const bot = require('./bot/telegram-bot');
        const telegramService = require('./services/telegramService');
        if (bot) {
          telegramService.setBot(bot);
          logger.info('✅ Telegram bot started');
        } else {
          logger.warn('⚠️  Telegram bot not initialized (missing token)');
        }
      } catch (error) {
        logger.error('Failed to initialize Telegram bot:', error);
      }
    })();
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

module.exports = { app, server };
