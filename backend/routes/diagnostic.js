const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Endpoint de diagnóstico para Bingo
router.get('/bingo-status/:code', async (req, res) => {
  const { code } = req.params;
  
  try {
    // 1. Obtener sala
    const roomQuery = await pool.query(
      'SELECT * FROM bingo_rooms WHERE code = $1',
      [code]
    );
    
    if (roomQuery.rows.length === 0) {
      return res.json({ error: 'Sala no encontrada', code });
    }
    
    const room = roomQuery.rows[0];
    
    // 2. Obtener cartones
    const cardsQuery = await pool.query(
      'SELECT id, user_id, marked_numbers FROM bingo_cards WHERE room_id = $1',
      [room.id]
    );
    
    // 3. Diagnosticar marked_numbers
    const cardsDiagnostic = cardsQuery.rows.map(card => {
      const markedRaw = card.marked_numbers;
      const markedType = typeof markedRaw;
      const isArray = Array.isArray(markedRaw);
      
      let markedParsed = markedRaw;
      let parseError = null;
      
      if (typeof markedRaw === 'string') {
        try {
          markedParsed = JSON.parse(markedRaw);
        } catch (e) {
          parseError = e.message;
        }
      }
      
      return {
        cardId: card.id,
        userId: card.user_id,
        marked_numbers_raw: markedRaw,
        marked_numbers_type: markedType,
        marked_numbers_isArray: isArray,
        marked_numbers_count_before_parse: markedRaw?.length || 0,
        marked_numbers_parsed: markedParsed,
        marked_numbers_count_after_parse: markedParsed?.length || 0,
        parse_error: parseError
      };
    });
    
    // 4. Estado de la sala
    const diagnostic = {
      timestamp: new Date().toISOString(),
      room: {
        id: room.id,
        code: room.code,
        status: room.status,
        host_id: room.host_id,
        bingo_mode: room.bingo_mode,
        victory_mode: room.victory_mode,
        drawn_numbers_count: room.drawn_numbers?.length || 0,
        drawn_numbers: room.drawn_numbers
      },
      cards: cardsDiagnostic,
      summary: {
        total_cards: cardsQuery.rows.length,
        cards_with_string_marked: cardsDiagnostic.filter(c => c.marked_numbers_type === 'string').length,
        cards_with_array_marked: cardsDiagnostic.filter(c => c.marked_numbers_isArray).length,
        cards_with_parse_error: cardsDiagnostic.filter(c => c.parse_error).length
      }
    };
    
    res.json(diagnostic);
    
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;
