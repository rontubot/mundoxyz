/**
 * Routes API - Sistema de Rifas Completo
 * Implementa todos los endpoints para rifas con modo empresas, premio, CAPTCHA, etc.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const RaffleService = require('../services/RaffleService');
const multer = require('multer');
const AWS = require('aws-sdk');

const raffleService = new RaffleService();

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos de imagen'));
        }
    }
});

/**
 * GET /api/raffles/public
 * Listar rifas públicas para el lobby con paginación
 */
router.get('/public', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const filters = {
            mode: req.query.mode,
            type: req.query.type,
            company_mode: req.query.company_mode === 'true' ? true : 
                         req.query.company_mode === 'false' ? false : undefined,
            search: req.query.search
        };

        const result = await raffleService.listPublicRaffles(page, limit, filters);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error listing public raffles:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/raffles/active
 * Obtener rifas activas del usuario actual
 */
router.get('/active', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const raffles = await raffleService.getUserActiveRaffles(userId);
        
        res.json({
            success: true,
            data: raffles
        });
    } catch (error) {
        console.error('Error getting active raffles:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/raffles/participated
 * Obtener rifas en las que participó el usuario
 */
router.get('/participated', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const raffles = await raffleService.getUserParticipatedRaffles(userId);
        
        res.json({
            success: true,
            data: raffles
        });
    } catch (error) {
        console.error('Error getting participated raffles:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/create
 * Crear nueva rifa con todas las configuraciones
 */
router.post('/create', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const raffleData = req.body;

        // Validar datos requeridos
        if (!raffleData.name) {
            return res.status(400).json({
                success: false,
                error: 'El nombre de la rifa es requerido'
            });
        }

        if (!raffleData.mode || !['fire', 'prize'].includes(raffleData.mode)) {
            return res.status(400).json({
                success: false,
                error: 'Modo de rifa inválido (fire/prize)'
            });
        }

        if (raffleData.is_company_mode && !raffleData.company_config) {
            return res.status(400).json({
                success: false,
                error: 'Configuración de empresa requerida para modo empresas'
            });
        }

        const raffle = await raffleService.createRaffle(userId, raffleData);
        
        res.json({
            success: true,
            data: raffle,
            message: 'Rifa creada exitosamente'
        });
    } catch (error) {
        console.error('Error creating raffle:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/raffles/active
 * Obtener rifas activas del usuario actual
 */
router.get('/active', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const raffles = await raffleService.getUserActiveRaffles(userId);
        
        res.json({
            success: true,
            data: raffles
        });
    } catch (error) {
        console.error('Error getting active raffles:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/raffles/participated
 * Obtener rifas en las que participó el usuario
 */
router.get('/participated', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const raffles = await raffleService.getUserParticipatedRaffles(userId);
        
        res.json({
            success: true,
            data: raffles
        });
    } catch (error) {
        console.error('Error getting participated raffles:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/create
 * Crear nueva rifa con todas las configuraciones
 */
router.post('/create', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const raffleData = req.body;

        // Validar datos requeridos
        if (!raffleData.name) {
            return res.status(400).json({
                success: false,
                error: 'El nombre de la rifa es requerido'
            });
        }

        if (!raffleData.mode || !['fire', 'prize'].includes(raffleData.mode)) {
            return res.status(400).json({
                success: false,
                error: 'Modo de rifa inválido (fire/prize)'
            });
        }

        if (raffleData.is_company_mode && !raffleData.company_config) {
            return res.status(400).json({
                success: false,
                error: 'Configuración de empresa requerida para modo empresas'
            });
        }

        const raffle = await raffleService.createRaffle(userId, raffleData);
        
        res.json({
            success: true,
            data: raffle,
            message: 'Rifa creada exitosamente'
        });
    } catch (error) {
        console.error('Error creating raffle:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/raffles/:code
 * Obtener detalles completos de una rifa por código
 */
router.get('/:code', async (req, res) => {
    try {
        const code = req.params.code;
        
        const raffle = await raffleService.getRaffleByCode(code);
        
        if (!raffle) {
            return res.status(404).json({
                success: false,
                error: 'Rifa no encontrada'
            });
        }
        
        res.json({
            success: true,
            data: raffle
        });
    } catch (error) {
        console.error('Error getting raffle details:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/purchase
 * Comprar número de rifa con CAPTCHA matemático
 */
router.post('/purchase', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { raffle_id, number, captcha_data } = req.body;

        if (!raffle_id || !number || !captcha_data) {
            return res.status(400).json({
                success: false,
                error: 'Datos incompletos para la compra'
            });
        }

        const result = await raffleService.purchaseNumber(userId, raffle_id, number, captcha_data);
        
        res.json({
            success: true,
            data: result,
            message: 'Número comprado exitosamente'
        });
    } catch (error) {
        console.error('Error purchasing number:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/captcha
 * Generar nuevo CAPTCHA matemático
 */
router.post('/captcha', (req, res) => {
    try {
        const captcha = raffleService.generateMathCaptcha();
        
        res.json({
            success: true,
            data: captcha
        });
    } catch (error) {
        console.error('Error generating captcha:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/approve-purchase
 * Aprobar solicitud de compra (modo premio) - Solo host
 */
router.post('/approve-purchase', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { request_id } = req.body;

        if (!request_id) {
            return res.status(400).json({
                success: false,
                error: 'ID de solicitud requerido'
            });
        }

        const result = await raffleService.approvePurchase(userId, request_id);
        
        res.json({
            success: true,
            data: result,
            message: 'Compra aprobada exitosamente'
        });
    } catch (error) {
        console.error('Error approving purchase:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/reject-purchase
 * Rechazar solicitud de compra - Solo host
 */
router.post('/reject-purchase', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { request_id, reason } = req.body;

        if (!request_id) {
            return res.status(400).json({
                success: false,
                error: 'ID de solicitud requerido'
            });
        }

        const result = await raffleService.rejectPurchase(userId, request_id, reason);
        
        res.json({
            success: true,
            data: result,
            message: 'Compra rechazada'
        });
    } catch (error) {
        console.error('Error rejecting purchase:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/upload-logo
 * Subir logo para modo empresa (AWS S3)
 */
router.post('/upload-logo', verifyToken, upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó archivo de imagen'
            });
        }

        const fileName = `raffle-logos/${Date.now()}-${req.file.originalname}`;
        
        const params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: fileName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            ACL: 'public-read'
        };

        const uploadResult = await s3.upload(params).promise();
        
        res.json({
            success: true,
            data: {
                logo_url: uploadResult.Location
            },
            message: 'Logo subido exitosamente'
        });
    } catch (error) {
        console.error('Error uploading logo:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/upload-prize-image
 * Subir imagen del premio (AWS S3)
 */
router.post('/upload-prize-image', verifyToken, upload.single('prize_image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó archivo de imagen del premio'
            });
        }

        const fileName = `raffle-prizes/${Date.now()}-${req.file.originalname}`;
        
        const params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: fileName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            ACL: 'public-read'
        };

        const uploadResult = await s3.upload(params).promise();
        
        res.json({
            success: true,
            data: {
                image_url: uploadResult.Location
            },
            message: 'Imagen del premio subida exitosamente'
        });
    } catch (error) {
        console.error('Error uploading prize image:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/raffles/:code/numbers
 * Obtener grid completo de números de una rifa
 */
router.get('/:code/numbers', async (req, res) => {
    try {
        const code = req.params.code;
        
        const numbers = await raffleService.getRaffleNumbers(code);
        
        res.json({
            success: true,
            data: numbers
        });
    } catch (error) {
        console.error('Error getting raffle numbers:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/:code/close
 * Cerrar rifa manualmente - Solo host
 */
router.post('/:code/close', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const code = req.params.code;

        const result = await raffleService.closeRaffleManually(userId, code);
        
        res.json({
            success: true,
            data: result,
            message: 'Rifa cerrada exitosamente'
        });
    } catch (error) {
        console.error('Error closing raffle:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/raffles/:code/ticket/:ticketNumber
 * Validar ticket digital con QR
 */
router.get('/:code/ticket/:ticketNumber', async (req, res) => {
    try {
        const code = req.params.code;
        const ticketNumber = req.params.ticketNumber;
        
        const ticket = await raffleService.validateTicket(code, ticketNumber);
        
        if (!ticket) {
            return res.status(404).json({
                success: false,
                error: 'Ticket no encontrado o inválido'
            });
        }
        
        res.json({
            success: true,
            data: ticket
        });
    } catch (error) {
        console.error('Error validating ticket:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/raffles/stats/overview
 * Estadísticas generales del sistema de rifas
 */
router.get('/stats/overview', async (req, res) => {
    try {
        const stats = await raffleService.getSystemStats();
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error getting system stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/generate-pdf
 * Generar PDF de certificado para ganador con QR
 */
router.post('/generate-pdf', verifyToken, async (req, res) => {
    try {
        const { raffle_id } = req.body;
        
        if (!raffle_id) {
            return res.status(400).json({
                success: false,
                error: 'ID de rifa requerido'
            });
        }

        const pdfUrl = await raffleService.generateWinnerPDF(raffle_id);
        
        res.json({
            success: true,
            data: { pdf_url: pdfUrl },
            message: 'PDF generado exitosamente'
        });
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/purchase
 * Comprar número de rifa con CAPTCHA matemático
 */
router.post('/purchase', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { raffle_id, number, captcha_data } = req.body;

        if (!raffle_id || !number || !captcha_data) {
            return res.status(400).json({
                success: false,
                error: 'Datos incompletos para la compra'
            });
        }

        const result = await raffleService.purchaseNumber(userId, raffle_id, number, captcha_data);
        
        res.json({
            success: true,
            data: result,
            message: 'Número comprado exitosamente'
        });
    } catch (error) {
        console.error('Error purchasing number:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/captcha
 * Generar nuevo CAPTCHA matemático
 */
router.post('/captcha', (req, res) => {
    try {
        const captcha = raffleService.generateMathCaptcha();
        
        res.json({
            success: true,
            data: captcha
        });
    } catch (error) {
        console.error('Error generating captcha:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/approve-purchase
 * Aprobar solicitud de compra (modo premio) - Solo host
 */
router.post('/approve-purchase', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { request_id } = req.body;

        if (!request_id) {
            return res.status(400).json({
                success: false,
                error: 'ID de solicitud requerido'
            });
        }

        const result = await raffleService.approvePurchase(userId, request_id);
        
        res.json({
            success: true,
            data: result,
            message: 'Compra aprobada exitosamente'
        });
    } catch (error) {
        console.error('Error approving purchase:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/reject-purchase
 * Rechazar solicitud de compra - Solo host
 */
router.post('/reject-purchase', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { request_id, reason } = req.body;

        if (!request_id) {
            return res.status(400).json({
                success: false,
                error: 'ID de solicitud requerido'
            });
        }

        const result = await raffleService.rejectPurchase(userId, request_id, reason);
        
        res.json({
            success: true,
            data: result,
            message: 'Compra rechazada'
        });
    } catch (error) {
        console.error('Error rejecting purchase:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/upload-logo
 * Subir logo para modo empresa (AWS S3)
 */
router.post('/upload-logo', verifyToken, upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó archivo de imagen'
            });
        }

        const fileName = `raffle-logos/${Date.now()}-${req.file.originalname}`;
        
        const params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: fileName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            ACL: 'public-read'
        };

        const uploadResult = await s3.upload(params).promise();
        
        res.json({
            success: true,
            data: {
                logo_url: uploadResult.Location
            },
            message: 'Logo subido exitosamente'
        });
    } catch (error) {
        console.error('Error uploading logo:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/upload-prize-image
 * Subir imagen del premio (AWS S3)
 */
router.post('/upload-prize-image', verifyToken, upload.single('prize_image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó archivo de imagen del premio'
            });
        }

        const fileName = `raffle-prizes/${Date.now()}-${req.file.originalname}`;
        
        const params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: fileName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            ACL: 'public-read'
        };

        const uploadResult = await s3.upload(params).promise();
        
        res.json({
            success: true,
            data: {
                image_url: uploadResult.Location
            },
            message: 'Imagen del premio subida exitosamente'
        });
    } catch (error) {
        console.error('Error uploading prize image:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/raffles/:code/numbers
 * Obtener grid completo de números de una rifa
 */
router.get('/:code/numbers', async (req, res) => {
    try {
        const code = req.params.code;
        
        const numbers = await raffleService.getRaffleNumbers(code);
        
        res.json({
            success: true,
            data: numbers
        });
    } catch (error) {
        console.error('Error getting raffle numbers:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/:code/close
 * Cerrar rifa manualmente - Solo host
 */
router.post('/:code/close', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const code = req.params.code;

        const result = await raffleService.closeRaffleManually(userId, code);
        
        res.json({
            success: true,
            data: result,
            message: 'Rifa cerrada exitosamente'
        });
    } catch (error) {
        console.error('Error closing raffle:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/raffles/:code/ticket/:ticketNumber
 * Validar ticket digital con QR
 */
router.get('/:code/ticket/:ticketNumber', async (req, res) => {
    try {
        const code = req.params.code;
        const ticketNumber = req.params.ticketNumber;
        
        const ticket = await raffleService.validateTicket(code, ticketNumber);
        
        if (!ticket) {
            return res.status(404).json({
                success: false,
                error: 'Ticket no encontrado o inválido'
            });
        }
        
        res.json({
            success: true,
            data: ticket
        });
    } catch (error) {
        console.error('Error validating ticket:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/raffles/stats/overview
 * Estadísticas generales del sistema de rifas
 */
router.get('/stats/overview', async (req, res) => {
    try {
        const stats = await raffleService.getSystemStats();
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error getting system stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/generate-pdf
 * Generar PDF de certificado para ganador con QR
 */
router.post('/generate-pdf', verifyToken, async (req, res) => {
    try {
        const { raffle_id } = req.body;
        
        if (!raffle_id) {
            return res.status(400).json({
                success: false,
                error: 'ID de rifa requerido'
            });
        }

        const pdfUrl = await raffleService.generateWinnerPDF(raffle_id);
        
        res.json({
            success: true,
            data: { pdf_url: pdfUrl },
            message: 'PDF generado exitosamente'
        });
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
