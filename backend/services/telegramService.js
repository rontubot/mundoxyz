const logger = require('../utils/logger');

class TelegramService {
  constructor() {
    this.bot = null;
    this.adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || '1417856820';
  }

  async sendAdminMessage(message, options = {}) {
    try {
      if (!this.bot) {
        logger.warn('Telegram bot not initialized, skipping message');
        return false;
      }

      await this.bot.sendMessage(this.adminChatId, message, {
        parse_mode: 'HTML',
        ...options
      });

      logger.info('Admin message sent via Telegram');
      return true;
    } catch (error) {
      logger.error('Error sending Telegram message:', error);
      return false;
    }
  }

  async notifyHostDisconnection(roomCode, hostName) {
    const message = `
🚨 <b>Host Desconectado</b>

Sala: <code>${roomCode}</code>
Host: ${hostName}
Tiempo: ${new Date().toLocaleString('es-ES')}

La sala ha sido pausada esperando reconexión.
    `;

    return this.sendAdminMessage(message);
  }

  async notifyBingoWinner(roomCode, winnerName, prize) {
    const message = `
🎉 <b>¡BINGO!</b>

Sala: <code>${roomCode}</code>
Ganador: ${winnerName}
Premio: ${prize}
Tiempo: ${new Date().toLocaleString('es-ES')}
    `;

    return this.sendAdminMessage(message);
  }

  async notifyRedemptionRequest(redemptionData) {
    const {
      redemption_id,
      username,
      email,
      fires_amount,
      cedula,
      phone,
      bank_code,
      bank_name,
      bank_account
    } = redemptionData;

    const message = `
🔥 <b>Nueva Solicitud de Canje</b>

<b>Usuario:</b> ${username}
<b>Email:</b> ${email}
<b>Monto:</b> ${fires_amount} 🔥

<b>📋 Datos de Pago:</b>
• <b>Cédula:</b> <code>${cedula}</code>
• <b>Teléfono:</b> <code>${phone}</code>
${bank_code ? `• <b>Banco:</b> ${bank_name} (${bank_code})` : ''}
${bank_account ? `• <b>Cuenta:</b> <code>${bank_account}</code>` : ''}

<b>ID Canje:</b> <code>${redemption_id}</code>
<b>Fecha:</b> ${new Date().toLocaleString('es-ES', { 
      dateStyle: 'short', 
      timeStyle: 'short' 
    })}

💰 <i>Procesa este canje desde el panel de admin en MundoXYZ</i>
    `;

    return this.sendAdminMessage(message);
  }

  async notifyRedemptionCompleted(redemptionData) {
    const {
      username,
      fires_amount,
      transaction_id
    } = redemptionData;

    const message = `
✅ <b>Canje Completado</b>

<b>Usuario:</b> ${username}
<b>Monto:</b> ${fires_amount} 🔥
<b>ID Transacción:</b> <code>${transaction_id}</code>
<b>Fecha:</b> ${new Date().toLocaleString('es-ES', { 
      dateStyle: 'short', 
      timeStyle: 'short' 
    })}
    `;

    return this.sendAdminMessage(message);
  }

  async notifyRedemptionRejected(redemptionData) {
    const {
      username,
      fires_amount,
      reason
    } = redemptionData;

    const message = `
❌ <b>Canje Rechazado</b>

<b>Usuario:</b> ${username}
<b>Monto:</b> ${fires_amount} 🔥
<b>Razón:</b> ${reason}
<b>Fecha:</b> ${new Date().toLocaleString('es-ES', { 
      dateStyle: 'short', 
      timeStyle: 'short' 
    })}

<i>Los fuegos han sido devueltos al usuario</i>
    `;

    return this.sendAdminMessage(message);
  }

  setBot(bot) {
    this.bot = bot;
    logger.info('Telegram bot configured for service');
  }
}

module.exports = new TelegramService();
