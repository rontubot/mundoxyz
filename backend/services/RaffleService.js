/**
 * RaffleService - Servicio completo para el sistema de rifas
 * Implementa todas las operaciones principales del sistema
 */
const { Pool } = require('pg');
const crypto = require('crypto');

class RaffleService {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
        });
    }

    /**
     * Generar código aleatorio de CAPTCHA matemático
     */
    generateMathCaptcha() {
        const operations = ['+', '-', '*'];
        const operation = operations[Math.floor(Math.random() * operations.length)];
        let num1, num2, answer;
        
        switch(operation) {
            case '+':
                num1 = Math.floor(Math.random() * 50) + 1;
                num2 = Math.floor(Math.random() * 50) + 1;
                answer = num1 + num2;
                break;
            case '-':
                num1 = Math.floor(Math.random() * 50) + 10;
                num2 = Math.floor(Math.random() * num1);
                answer = num1 - num2;
                break;
            case '*':
                num1 = Math.floor(Math.random() * 12) + 1;
                num2 = Math.floor(Math.random() * 12) + 1;
                answer = num1 * num2;
                break;
        }
        
        const token = crypto.randomBytes(32).toString('hex');
        
        return {
            question: `${num1} ${operation} ${num2} = ?`,
            answer: answer.toString(),
            token: token,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutos
        };
    }

    /**
     * Verificar CAPTCHA matemático
     */
    verifyMathCaptcha(token, userAnswer) {
        // En implementación real, verificar contra base de datos o caché
        // Por ahora, simplificado
        return { valid: true };
    }

    /**
     * Crear nueva rifa
     */
    async createRaffle(hostId, raffleData) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Verificar límites de experiencia del usuario (simple check)
            const userCheck = await client.query(
                'SELECT experience FROM users WHERE id = $1',
                [hostId]
            );

            if (!userCheck.rows[0]) {
                throw new Error('Usuario no encontrado');
            }

            const userExperience = parseInt(userCheck.rows[0].experience) || 0;
            
            // Límite simple: necesita al menos 10 de experiencia para crear rifas
            if (userExperience < 10) {
                throw new Error(`Necesitas al menos 10 puntos de experiencia para crear rifas. Tienes ${userExperience}.`);
            }

            // Generar código único de 6 dígitos numéricos
            let code;
            let isUnique = false;
            let attempts = 0;
            
            while (!isUnique && attempts < 10) {
                code = Math.floor(100000 + Math.random() * 900000).toString();
                
                const existingCode = await client.query(
                    'SELECT id FROM raffles WHERE code = $1',
                    [code]
                );
                
                if (existingCode.rows.length === 0) {
                    isUnique = true;
                }
                attempts++;
            }
            
            if (!isUnique) {
                throw new Error('No se pudo generar un código único. Intenta nuevamente.');
            }

            // Verificar balance del host
            let finalCost = parseFloat(raffleData.cost_per_number) || 10;
            let isCompanyMode = raffleData.is_company_mode || false;
            
            const hostWalletCheck = await client.query(`
                SELECT w.fires_balance 
                FROM wallets w 
                WHERE w.user_id = $1
            `, [hostId]);
            
            if (!hostWalletCheck.rows[0]) {
                throw new Error('Wallet del host no encontrado');
            }
            
            const hostBalance = parseFloat(hostWalletCheck.rows[0].fires_balance);
            const totalCostForHost = finalCost + (isCompanyMode ? 3000 : 0);
            
            if (hostBalance < totalCostForHost) {
                throw new Error(`Necesitas ${totalCostForHost} fuegos. Tienes ${hostBalance} fuegos.`);
            }
            
            // Descontar del host: costo del número + modo empresa (si aplica)
            await client.query(`
                UPDATE wallets 
                SET fires_balance = fires_balance - $1 
                WHERE user_id = $2
            `, [totalCostForHost, hostId]);
            
            // Transferir el costo del número al admin (idtg 1417856820)
            const adminIdtg = '1417856820'; // ID del admin en tabla users
            
            // Verificar si el admin existe en users
            const adminCheck = await client.query(`
                SELECT id FROM users WHERE idtg = $1
            `, [adminIdtg]);
            
            if (adminCheck.rows.length > 0) {
                const adminUserId = adminCheck.rows[0].id;
                
                // Acreditar al admin
                await client.query(`
                    UPDATE wallets 
                    SET fires_balance = fires_balance + $1 
                    WHERE user_id = $2
                `, [finalCost, adminUserId]);
                
                // Registrar transacción del admin
                await client.query(`
                    INSERT INTO wallet_transactions 
                    (wallet_id, type, currency, amount, balance_before, balance_after, reference, description)
                    VALUES (
                        (SELECT id FROM wallets WHERE user_id = $1),
                        'raffle_host_fee', 'fires', $2,
                        (SELECT fires_balance - $2 FROM wallets WHERE user_id = $1),
                        (SELECT fires_balance FROM wallets WHERE user_id = $1),
                        $3, 'Comisión creación rifa ' || $3
                    )
                `, [adminUserId, finalCost, code]);
            }
            
            // Registrar transacción del host
            await client.query(`
                INSERT INTO wallet_transactions 
                (wallet_id, type, currency, amount, balance_before, balance_after, reference, description)
                VALUES (
                    (SELECT id FROM wallets WHERE user_id = $1),
                    'raffle_creation_cost', 'fires', $2,
                    (SELECT fires_balance + $2 FROM wallets WHERE user_id = $1),
                    (SELECT fires_balance FROM wallets WHERE user_id = $1),
                    $3, 'Creación de rifa ' || $3 || (CASE WHEN $4 THEN ' (Modo Empresa)' ELSE '' END)
                )
            `, [hostId, totalCostForHost, code, isCompanyMode]);

            // Insertar rifa principal
            const raffleResult = await client.query(`
                INSERT INTO raffles (
                    code, name, host_id, description, mode, type,
                    entry_price_fire, numbers_range, visibility, status,
                    is_company_mode, company_cost, close_type, 
                    scheduled_close_at, terms_conditions,
                    prize_meta, host_meta
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, 'pending',
                    $10, $11, $12,
                    $13, $14,
                    $15, $16
                ) RETURNING *
            `, [
                code,
                raffleData.name,
                hostId,
                raffleData.description || null,
                raffleData.mode || 'fire',
                raffleData.type || 'public',
                finalCost,
                raffleData.numbers_range || 100,
                raffleData.visibility || 'public',
                isCompanyMode,
                isCompanyMode ? 3000 : 0,
                raffleData.close_type || 'auto_full',
                raffleData.scheduled_close_at || null,
                raffleData.terms_conditions || null,
                JSON.stringify(raffleData.prize_meta || {}),
                JSON.stringify(raffleData.host_meta || {})
            ]);

            const raffle = raffleResult.rows[0];

            // Si es modo empresa, crear configuración de empresa
            if (isCompanyMode && raffleData.company_config) {
                await client.query(`
                    INSERT INTO raffle_companies (
                        raffle_id, company_name, company_rif,
                        primary_color, secondary_color, logo_url
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    raffle.id,
                    raffleData.company_config.company_name,
                    raffleData.company_config.company_rif,
                    raffleData.company_config.primary_color || '#FF6B6B',
                    raffleData.company_config.secondary_color || '#4ECDC4',
                    raffleData.company_config.logo_url || null
                ]);
            }

            // Generar números disponibles para la rifa
            await this.generateRaffleNumbers(client, raffle.id, raffle.numbers_range);

            await client.query('COMMIT');

            // Obtener rifa completa con relaciones
            return await this.getRaffleDetails(raffle.id);

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Generar números disponibles para una rifa
     */
    async generateRaffleNumbers(client, raffleId, numbersRange) {
        const rangeConfig = this.getNumberRangeConfig(numbersRange);
        const { start, end, format } = rangeConfig;

        for (let i = start; i <= end; i++) {
            const formattedNumber = this.formatNumber(i, format);
            
            await client.query(`
                INSERT INTO raffle_numbers (raffle_id, number)
                VALUES ($1, $2)
                ON CONFLICT (raffle_id, number) DO NOTHING
            `, [raffleId, formattedNumber]);
        }

        // Actualizar total_numbers en raffles
        await client.query(`
            UPDATE raffles 
            SET total_numbers = $1
            WHERE id = $2
        `, [end - start + 1, raffleId]);
    }

    /**
     * Obtener configuración de rango de números
     */
    getNumberRangeConfig(range) {
        switch(range) {
            case 99:
                return { start: 0, end: 99, format: '00' };
            case 999:
                return { start: 0, end: 999, format: '000' };
            case 9999:
                return { start: 0, end: 9999, format: '0000' };
            default:
                return { start: 0, end: range - 1, format: '00' };
        }
    }

    /**
     * Formatear número según configuración
     */
    formatNumber(number, format) {
        return number.toString().padStart(format.length, '0');
    }

    /**
     * Comprar número de rifa
     */
    async purchaseNumber(userId, raffleId, number, captchaData) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Verificar CAPTCHA
            const captchaValid = this.verifyMathCaptcha(captchaData.token, captchaData.answer);
            if (!captchaData.valid) {
                throw new Error('CAPTCHA incorrecto. Por favor intenta nuevamente.');
            }

            // Obtener detalles de la rifa
            const raffle = await client.query(`
                SELECT * FROM raffles WHERE id = $1 AND status = 'pending'
            `, [raffleId]);

            if (!raffle.rows[0]) {
                throw new Error('La rifa no existe o no está activa');
            }

            const raffleData = raffle.rows[0];
            const cost = parseFloat(raffleData.entry_price_fire);

            // Verificar disponibilidad del número
            const numberCheck = await client.query(`
                SELECT * FROM raffle_numbers 
                WHERE raffle_id = $1 AND number = $2
            `, [raffleId, number]);

            if (!numberCheck.rows[0]) {
                throw new Error('El número no existe en esta rifa');
            }

            const numberData = numberCheck.rows[0];
            if (numberData.status !== 'available') {
                throw new Error('El número no está disponible');
            }

            // Verificar balance del usuario
            const wallet = await client.query(`
                SELECT * FROM wallets WHERE user_id = $1
            `, [userId]);

            if (!wallet.rows[0] || parseFloat(wallet.rows[0].fires_balance) < cost) {
                throw new Error('Balance insuficiente');
            }

            // Para compras mayores a 5000 fuegos, verificar contraseña
            if (cost > 5000) {
                // Aquí debería verificarse la contraseña del usuario
                // Por ahora, simplificado
            }

            // Procesar compra según modo
            if (raffleData.mode === 'fire') {
                // Modo fuego: descontar directamente
                await this.processFirePurchase(client, userId, raffleId, number, cost);
            } else if (raffleData.mode === 'prize') {
                // Modo premio: crear solicitud de aprobación
                await this.processPrizePurchase(client, userId, raffleId, number, cost, captchaData);
            }

            await client.query('COMMIT');

            return await this.getRaffleDetails(raffleId);

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Procesar compra en modo fuego
     */
    async processFirePurchase(client, userId, raffleId, number, cost) {
        // Descontar balance
        await client.query(`
            UPDATE wallets 
            SET fires_balance = fires_balance - $1 
            WHERE user_id = $2
        `, [cost, userId]);

        // Actualizar estado del número
        await client.query(`
            UPDATE raffle_numbers 
            SET status = 'purchased', purchased_by = $1, purchased_at = CURRENT_TIMESTAMP
            WHERE raffle_id = $2 AND number = $3
        `, [userId, raffleId, number]);

        // Registrar compra
        const purchaseResult = await client.query(`
            INSERT INTO raffle_purchases (
                raffle_id, user_id, number, cost_amount, currency, 
                purchase_type, status
            ) VALUES ($1, $2, $3, $4, 'fires', 'fire', 'confirmed')
            RETURNING id
        `, [raffleId, userId, number, cost]);

        // Crear ticket digital
        await this.createDigitalTicket(client, raffleId, userId, number, purchaseResult.rows[0].id);

        // Actualizar pozo de la rifa
        await client.query(`
            UPDATE raffles 
            SET pot_fires = pot_fires + $1, purchased_numbers = purchased_numbers + 1
            WHERE id = $2
        `, [cost, raffleId]);

        // Verificar si la rifa se completó para cerrarla automáticamente
        await this.checkRaffleCompletion(client, raffleId);
    }

    /**
     * Procesar compra en modo premio
     */
    async processPrizePurchase(client, userId, raffleId, number, cost, captchaData) {
        // Reservar número
        await client.query(`
            UPDATE raffle_numbers 
            SET status = 'pending_approval', reserved_by = $1, reserved_at = CURRENT_TIMESTAMP,
                expires_at = CURRENT_TIMESTAMP + INTERVAL '24 hours'
            WHERE raffle_id = $2 AND number = $3
        `, [userId, raffleId, number]);

        // Crear solicitud de aprobación
        await client.query(`
            INSERT INTO raffle_requests (
                raffle_id, user_id, number, payment_reference, message, status
            ) VALUES ($1, $2, $3, $4, $5, 'pending')
        `, [raffleId, userId, number, captchaData.payment_reference || null, captchaData.message || null]);
    }

    /**
     * Aprobar solicitud de compra (modo premio)
     */
    async approvePurchase(hostId, requestId) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Obtener solicitud
            const request = await client.query(`
                SELECT rr.*, r.host_id, r.entry_price_fire
                FROM raffle_requests rr
                JOIN raffles r ON rr.ripple_id = r.id
                WHERE rr.id = $1 AND rr.status = 'pending'
            `, [requestId]);

            if (!request.rows[0]) {
                throw new Error('Solicitud no encontrada o ya procesada');
            }

            const requestData = request.rows[0];
            
            // Verificar que sea el host
            if (requestData.host_id !== hostId) {
                throw new Error('No autorizado para aprobar esta solicitud');
            }

            const cost = parseFloat(requestData.entry_price_fire);

            // Procesar compra aprobada
            await client.query(`
                UPDATE raffle_numbers 
                SET status = 'purchased', purchased_by = $1, purchased_at = CURRENT_TIMESTAMP
                WHERE raffle_id = $2 AND number = $3
            `, [requestData.user_id, requestData.raffle_id, requestData.number]);

            // Actualizar solicitud
            await client.query(`
                UPDATE raffle_requests 
                SET status = 'approved', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [hostId, requestId]);

            // Registrar compra
            const purchaseResult = await client.query(`
                INSERT INTO raffle_purchases (
                    raffle_id, user_id, number, cost_amount, currency, 
                    purchase_type, status
                ) VALUES ($1, $2, $3, $4, 'fires', 'prize', 'confirmed')
                RETURNING id
            `, [requestData.raffle_id, requestData.user_id, requestData.number, cost]);

            // Crear ticket
            await this.createDigitalTicket(client, requestData.raffle_id, requestData.user_id, 
                requestData.number, purchaseResult.rows[0].id);

            await client.query('COMMIT');

            return { success: true, message: 'Compra aprobada exitosamente' };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Crear ticket digital con QR
     */
    async createDigitalTicket(client, raffleId, userId, number, purchaseId) {
        const ticketNumber = `TICKET-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
        // Generar QR (simulado por ahora)
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${ticketNumber}`;

        await client.query(`
            INSERT INTO raffle_tickets (
                raffle_id, user_id, number, ticket_number, qr_code_url, purchase_id
            ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [raffleId, userId, number, ticketNumber, qrCodeUrl, purchaseId]);
    }

    /**
     * Verificar si la rifa se completó para cerrar
     */
    async checkRaffleCompletion(client, raffleId) {
        const raffle = await client.query(`
            SELECT * FROM raffles WHERE id = $1
        `, [raffleId]);

        const raffleData = raffle.rows[0];
        
        if (raffleData.mode === 'fire' && raffleData.close_type === 'auto_full') {
            // Verificar si todos los números están comprados
            const totalNumbers = await client.query(`
                SELECT COUNT(*) as total FROM raffle_numbers WHERE raffle_id = $1
            `, [raffleId]);

            const purchasedNumbers = await client.query(`
                SELECT COUNT(*) as purchased FROM raffle_numbers 
                WHERE raffle_id = $1 AND status = 'purchased'
            `, [raffleId]);

            if (totalNumbers.rows[0].total === purchasedNumbers.rows[0].purchased) {
                // Cerrar rifa y seleccionar ganador
                await this.closeRaffleAndSelectWinner(client, raffleId);
            }
        }
    }

    /**
     * Cerrar rifa y seleccionar ganador
     */
    async closeRaffleAndSelectWinner(client, raffleId) {
        // Obtener número ganador aleatorio
        const winnerNumber = await client.query(`
            SELECT number FROM raffle_numbers 
            WHERE raffle_id = $1 AND status = 'purchased'
            ORDER BY RANDOM() LIMIT 1
        `, [raffleId]);

        if (winnerNumber.rows[0]) {
            const winningNumber = winnerNumber.rows[0].number;
            const purchasedBy = await client.query(`
                SELECT purchased_by FROM raffle_numbers 
                WHERE raffle_id = $1 AND number = $2
            `, [raffleId, winningNumber]);

            // Actualizar rifa
            await client.query(`
                UPDATE raffles 
                SET status = 'finished', winning_number = $1, winner_id = $2, ended_at = CURRENT_TIMESTAMP
                WHERE id = $3
            `, [parseInt(winningNumber), purchasedBy.rows[0].purchased_by, raffleId]);

            // Distribuir premios (70/20/10)
            await this.distributePrizes(client, raffleId, winningNumber, purchasedBy.rows[0].purchased_by);

            // Registrar ganador
            await client.query(`
                INSERT INTO raffle_winners (raffle_id, user_id, winning_number, prize_amount, prize_type)
                VALUES ($1, $2, $3, (SELECT pot_fires * 0.7 FROM raffles WHERE id = $1), 'fire')
            `, [raffleId, purchasedBy.rows[0].purchased_by, winningNumber]);

            // Dar experiencia a todos los participantes (2 puntos)
            await client.query(`
                UPDATE users 
                SET experience = experience + 2
                WHERE id IN (
                    SELECT DISTINCT purchased_by 
                    FROM raffle_numbers 
                    WHERE raffle_id = $1 AND status = 'purchased' AND purchased_by IS NOT NULL
                )
            `, [raffleId]);
        }
    }

    /**
     * Distribuir premios (70% ganador, 20% host, 10% plataforma)
     */
    async distributePrizes(client, raffleId, winningNumber, winnerId) {
        const raffle = await client.query(`
            SELECT * FROM raffles WHERE id = $1
        `, [raffleId]);

        const raffleData = raffle.rows[0];
        const totalPot = parseFloat(raffleData.pot_fires);

        // Premio para el ganador (70%)
        const winnerPrize = Math.floor(totalPot * 0.7);
        await client.query(`
            UPDATE wallets 
            SET fires_balance = fires_balance + $1 
            WHERE user_id = $2
        `, [winnerPrize, winnerId]);

        // Premio para el host (20%)
        const hostPrize = Math.floor(totalPot * 0.2);
        await client.query(`
            UPDATE wallets 
            SET fires_balance = fires_balance + $1 
            WHERE user_id = $2
        `, [hostPrize, raffleData.host_id]);

        // Comisión para plataforma (10%) - va a admin secreto
        const platformCommission = totalPot - winnerPrize - hostPrize;
        const adminId = '1417856820'; // Admin secreto
        
        // Verificar si existe wallet del admin
        const adminWallet = await client.query(`
            SELECT id FROM wallets WHERE user_id = $1
        `, [adminId]);

        if (adminWallet.rows[0]) {
            await client.query(`
                UPDATE wallets 
                SET fires_balance = fires_balance + $1 
                WHERE user_id = $2
            `, [platformCommission, adminId]);
        }
    }

    /**
     * Obtener detalles completos de una rifa
     */
    async getRaffleDetails(raffleId) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT 
                    r.*,
                    u.username as host_username,
                    rc.company_name,
                    rc.logo_url,
                    rc.primary_color,
                    rc.secondary_color,
                    COUNT(CASE WHEN rn.status = 'purchased' THEN 1 END) as purchased_count
                FROM raffles r
                JOIN users u ON r.host_id = u.id
                LEFT JOIN raffle_companies rc ON r.id = rc.raffle_id
                LEFT JOIN raffle_numbers rn ON r.id = rn.raffle_id
                WHERE r.id = $1
                GROUP BY r.id, u.username, rc.company_name, rc.logo_url, rc.primary_color, rc.secondary_color
            `, [raffleId]);

            if (result.rows[0]) {
                // Obtener números de la rifa
                const numbers = await client.query(`
                    SELECT * FROM raffle_numbers 
                    WHERE raffle_id = $1 
                    ORDER BY number
                `, [raffleId]);

                result.rows[0].numbers = numbers.rows;

                // Obtener solicitudes pendientes si es modo premio
                if (result.rows[0].mode === 'prize') {
                    const requests = await client.query(`
                        SELECT 
                            rr.*,
                            u.username as user_username
                        FROM raffle_requests rr
                        JOIN users u ON rr.user_id = u.id
                        WHERE rr.raffle_id = $1 AND rr.status = 'pending'
                    `, [raffleId]);

                    result.rows[0].pending_requests = requests.rows;
                }
            }

            return result.rows[0];

        } finally {
            client.release();
        }
    }

    /**
     * Listar rifas públicas (para lobby)
     */
    async listPublicRaffles(page = 1, limit = 20, filters = {}) {
        const client = await this.pool.connect();
        try {
            let query = `
                SELECT 
                    r.id,
                    r.code,
                    r.name,
                    u.username as host_username,
                    r.mode,
                    COALESCE(r.type, 'public') as type,
                    r.status,
                    COALESCE(r.cost_per_number, 10) as cost_per_number,
                    (COALESCE(r.pot_fires, 0) + COALESCE(r.pot_coins, 0)) as current_pot,
                    r.numbers_range,
                    COALESCE(r.is_company_mode, false) as is_company_mode,
                    r.created_at,
                    NULL as company_name,
                    NULL as logo_url,
                    COUNT(DISTINCT CASE WHEN rn.state IN ('reserved', 'sold') THEN rn.id END) as purchased_count
                FROM raffles r
                LEFT JOIN users u ON u.id = r.host_id
                LEFT JOIN raffle_numbers rn ON rn.raffle_id = r.id
                WHERE r.status IN ('pending', 'active', 'finished')
                GROUP BY r.id, u.username
            `;
            
            const params = [];
            let paramIndex = 1;

            // Aplicar filtros
            if (filters.mode) {
                query += ` AND r.mode = $${paramIndex++}`;
                params.push(filters.mode);
            }

            if (filters.type) {
                query += ` AND r.type = $${paramIndex++}`;
                params.push(filters.type);
            }

            if (filters.company_mode !== undefined) {
                query += ` AND r.is_company_mode = $${paramIndex++}`;
                params.push(filters.company_mode);
            }

            if (filters.search) {
                query += ` AND (r.name ILIKE $${paramIndex++} OR r.host_username ILIKE $${paramIndex++})`;
                params.push(`%${filters.search}%`, `%${filters.search}%`);
            }

            // Ordenamiento y paginación
            query += ` ORDER BY r.created_at DESC`;
            query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
            params.push(limit, (page - 1) * limit);

            const result = await client.query(query, params);

            // Obtener total para paginación (contar distintos raffles)
            let countQuery = query.split('ORDER BY')[0].replace(/SELECT.*?FROM/, 'SELECT COUNT(DISTINCT r.id) as count FROM');
            // Remover el GROUP BY para el count
            countQuery = countQuery.replace(/GROUP BY.*$/, '');
            const countResult = await client.query(countQuery, params.slice(0, -2));
            
            return {
                raffles: result.rows,
                pagination: {
                    page: page,
                    limit: limit,
                    total: parseInt(countResult.rows[0]?.count || 0),
                    totalPages: Math.ceil((countResult.rows[0]?.count || 0) / limit)
                }
            };

        } finally {
            client.release();
        }
    }

    /**
     * Obtener rifas activas del usuario
     */
    async getUserActiveRaffles(userId) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT 
                    r.*,
                    u.username as host_username,
                    rc.company_name,
                    rc.logo_url
                FROM raffles r
                JOIN users u ON r.host_id = u.id
                LEFT JOIN raffle_companies rc ON r.id = rc.raffle_id
                WHERE r.host_id = $1 AND r.status IN ('pending', 'active')
                ORDER BY r.created_at DESC
            `, [userId]);

            return result.rows;

        } finally {
            client.release();
        }
    }

    /**
     * Obtener rifas en las que participó el usuario
     */
    async getUserParticipatedRaffles(userId) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT DISTINCT
                    r.*,
                    u.username as host_username,
                    rc.company_name,
                    rc.logo_url,
                    rt.ticket_number,
                    rt.qr_code_url,
                    rn.number as user_number
                FROM raffles r
                JOIN users u ON r.host_id = u.id
                LEFT JOIN raffle_companies rc ON r.id = rc.raffle_id
                JOIN raffle_tickets rt ON r.id = rt.raffle_id
                JOIN raffle_numbers rn ON rt.number_id = rn.id
                WHERE rt.user_id = $1
                ORDER BY r.created_at DESC
            `, [userId]);

            return result.rows;

        } finally {
            client.release();
        }
    }

    /**
     * Obtener rifa por código
     */
    async getRaffleByCode(code) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT 
                    r.*,
                    u.username as host_username,
                    rc.company_name,
                    rc.logo_url,
                    rc.primary_color,
                    rc.secondary_color,
                    COUNT(CASE WHEN rn.status = 'purchased' THEN 1 END) as purchased_count
                FROM raffles r
                JOIN users u ON r.host_id = u.id
                LEFT JOIN raffle_companies rc ON r.id = rc.raffle_id
                LEFT JOIN raffle_numbers rn ON r.id = rn.raffle_id
                WHERE r.code = $1
                GROUP BY r.id, u.username, rc.company_name, rc.logo_url, rc.primary_color, rc.secondary_color
            `, [code]);

            if (result.rows[0]) {
                // Obtener números de la rifa
                const numbers = await client.query(`
                    SELECT * FROM raffle_numbers 
                    WHERE raffle_id = $1 
                    ORDER BY number
                `, [result.rows[0].id]);

                result.rows[0].numbers = numbers.rows;

                // Obtener solicitudes pendientes si es modo premio
                if (result.rows[0].mode === 'prize') {
                    const requests = await client.query(`
                        SELECT 
                            rr.*,
                            u.username as user_username
                        FROM raffle_requests rr
                        JOIN users u ON rr.user_id = u.id
                        WHERE rr.raffle_id = $1 AND rr.status = 'pending'
                    `, [result.rows[0].id]);

                    result.rows[0].pending_requests = requests.rows;
                }
            }

            return result.rows[0];

        } finally {
            client.release();
        }
    }

    /**
     * Rechazar solicitud de compra
     */
    async rejectPurchase(hostId, requestId, reason = null) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Obtener solicitud
            const request = await client.query(`
                SELECT rr.*, r.host_id
                FROM raffle_requests rr
                JOIN raffles r ON rr.raffle_id = r.id
                WHERE rr.id = $1 AND rr.status = 'pending'
            `, [requestId]);

            if (!request.rows[0]) {
                throw new Error('Solicitud no encontrada o ya procesada');
            }

            const requestData = request.rows[0];
            
            // Verificar que sea el host
            if (requestData.host_id !== hostId) {
                throw new Error('No autorizado para rechazar esta solicitud');
            }

            // Liberar número reservado
            await client.query(`
                UPDATE raffle_numbers 
                SET status = 'available', reserved_by = NULL, reserved_at = NULL, expires_at = NULL
                WHERE raffle_id = $1 AND number = $2
            `, [requestData.raffle_id, requestData.number]);

            // Actualizar solicitud
            await client.query(`
                UPDATE raffle_requests 
                SET status = 'rejected', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP, admin_notes = $2
                WHERE id = $3
            `, [hostId, reason, requestId]);

            await client.query('COMMIT');

            return { success: true, message: 'Compra rechazada' };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Obtener números de rifa
     */
    async getRaffleNumbers(code) {
        const client = await this.pool.connect();
        try {
            // Obtener ID de rifa por código
            const raffle = await client.query(`
                SELECT id FROM raffles WHERE code = $1
            `, [code]);

            if (!raffle.rows[0]) {
                throw new Error('Rifa no encontrada');
            }

            const numbers = await client.query(`
                SELECT 
                    rn.*,
                    u.username as purchased_username
                FROM raffle_numbers rn
                LEFT JOIN users u ON rn.purchased_by = u.id
                WHERE rn.raffle_id = $1
                ORDER BY rn.number
            `, [raffle.rows[0].id]);

            return numbers.rows;

        } finally {
            client.release();
        }
    }

    /**
     * Cerrar rifa manualmente
     */
    async closeRaffleManually(userId, code) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Obtener rifa
            const raffle = await client.query(`
                SELECT * FROM raffles WHERE code = $1
            `, [code]);

            if (!raffle.rows[0]) {
                throw new Error('Rifa no encontrada');
            }

            const raffleData = raffle.rows[0];

            // Verificar que sea el host
            if (raffleData.host_id !== userId) {
                throw new Error('Solo el host puede cerrar la rifa');
            }

            if (raffleData.status !== 'pending' && raffleData.status !== 'active') {
                throw new Error('La rifa no está activa');
            }

            // Cerrar y seleccionar ganador
            await this.closeRaffleAndSelectWinner(client, raffleData.id);

            await client.query('COMMIT');

            return await this.getRaffleDetails(raffleData.id);

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Validar ticket digital
     */
    async validateTicket(code, ticketNumber) {
        const client = await this.pool.connect();
        try {
            // Obtener rifa
            const raffle = await client.query(`
                SELECT id FROM raffles WHERE code = $1
            `, [code]);

            if (!raffle.rows[0]) {
                return null;
            }

            // Buscar ticket
            const ticket = await client.query(`
                SELECT 
                    rt.*,
                    r.name as raffle_name,
                    r.code as raffle_code,
                    u.username as owner_username,
                    rn.number as ticket_number
                FROM raffle_tickets rt
                JOIN raffles r ON rt.raffle_id = r.id
                JOIN users u ON rt.user_id = u.id
                JOIN raffle_numbers rn ON rt.number_id = rn.id
                WHERE rt.ticket_number = $1 AND r.code = $2
            `, [ticketNumber, code]);

            return ticket.rows[0] || null;

        } finally {
            client.release();
        }
    }

    /**
     * Obtener estadísticas del sistema
     */
    async getSystemStats() {
        const client = await this.pool.connect();
        try {
            const stats = await client.query(`
                SELECT 
                    COUNT(*) as total_raffles,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_raffles,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_raffles,
                    COUNT(CASE WHEN status = 'finished' THEN 1 END) as finished_raffles,
                    COALESCE(SUM(pot_fires), 0) as total_fires_in_play,
                    COALESCE(SUM(pot_coins), 0) as total_coins_in_play,
                    COUNT(CASE WHEN is_company_mode = true THEN 1 END) as company_raffles
                FROM raffles
            `);

            const todayStats = await client.query(`
                SELECT 
                    COUNT(*) as created_today,
                    COUNT(CASE WHEN status = 'finished' THEN 1 END) as finished_today
                FROM raffles 
                WHERE DATE(created_at) = CURRENT_DATE
            `);

            return {
                ...stats.rows[0],
                ...todayStats.rows[0]
            };

        } finally {
            client.release();
        }
    }

    /**
     * Generar PDF para ganador (simulado)
     */
    async generateWinnerPDF(raffleId) {
        // En implementación real, usar librería como Puppeteer o PDFKit
        const pdfUrl = `https://api.mundoxyz.com/raffles/${raffleId}/winner-certificate.pdf`;
        
        // Aquí se generaría el PDF con:
        // - Datos de la rifa
        // - Información del ganador
        // - Código QR del ticket
        // - Datos legales y términos
        
        return pdfUrl;
    }
}

module.exports = RaffleService;
