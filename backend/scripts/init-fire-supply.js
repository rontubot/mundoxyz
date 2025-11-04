const { query, initDatabase } = require('../db');

async function initializeFireSupply() {
  try {
    // Inicializar base de datos primero
    await initDatabase();
    console.log('Inicializando fire_supply...');

    // Crear tabla si no existe
    await query(`
      CREATE TABLE IF NOT EXISTS fire_supply (
        id INTEGER PRIMARY KEY DEFAULT 1,
        total_max DECIMAL(20, 2) NOT NULL DEFAULT 10000,
        total_emitted DECIMAL(20, 2) NOT NULL DEFAULT 0,
        total_burned DECIMAL(20, 2) NOT NULL DEFAULT 0,
        total_circulating DECIMAL(20, 2) NOT NULL DEFAULT 0,
        total_reserved DECIMAL(20, 2) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT single_row CHECK (id = 1)
      )
    `);

    console.log('Tabla fire_supply creada o ya existe');

    // Verificar si existe el registro
    const existing = await query('SELECT * FROM fire_supply WHERE id = 1');

    if (existing.rows.length === 0) {
      console.log('Insertando registro inicial...');
      await query(`
        INSERT INTO fire_supply (id, total_max, total_emitted, total_burned, total_circulating, total_reserved)
        VALUES (1, 10000, 0, 0, 0, 0)
      `);
    }

    // Calcular valores reales basados en wallets existentes
    console.log('Calculando valores reales...');
    const result = await query(`
      UPDATE fire_supply 
      SET 
        total_circulating = COALESCE((SELECT SUM(fires_balance) FROM wallets), 0),
        total_emitted = COALESCE((SELECT SUM(fires_balance) FROM wallets), 0) + COALESCE(total_burned, 0),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
      RETURNING *
    `);

    console.log('fire_supply inicializado correctamente:');
    console.log(result.rows[0]);

    process.exit(0);
  } catch (error) {
    console.error('Error inicializando fire_supply:', error);
    process.exit(1);
  }
}

initializeFireSupply();
