const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
});

async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');
  
  const migrationsDir = path.join(__dirname, 'migrations');
  
  try {
    // Crear tabla de migraciones si no existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Obtener migraciones ya ejecutadas
    const executedResult = await pool.query('SELECT filename FROM migrations');
    const executed = new Set(executedResult.rows.map(row => row.filename));
    
    // Obtener archivos de migración
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    // Filtrar solo las no ejecutadas
    const pending = files.filter(file => !executed.has(file));
    
    console.log(`Found ${files.length} migration files`);
    console.log(`Already executed: ${executed.size}`);
    console.log(`Pending: ${pending.length}\n`);
    
    for (const file of pending) {
      console.log(`📝 Running migration: ${file}`);
      
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      try {
        // Iniciar transacción
        await pool.query('BEGIN');
        
        // Ejecutar migración
        await pool.query(sql);
        
        // Registrar como ejecutada
        await pool.query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [file]
        );
        
        // Confirmar transacción
        await pool.query('COMMIT');
        
        console.log(`✅ ${file} completed successfully\n`);
      } catch (error) {
        // Rollback en caso de error
        await pool.query('ROLLBACK');
        console.error(`❌ Error in ${file}:`, error.message);
        
        // Si es la migración 006, intentar arreglarla
        if (file === '006_bingo_host_abandonment.sql') {
          console.log('⚠️  Attempting fix for migration 006...');
          await fixMigration006();
        } else {
          throw error;
        }
      }
    }
    
    console.log('✅ All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Fix específico para migración 006
async function fixMigration006() {
  try {
    // Crear tablas faltantes si no existen
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bingo_drawn_numbers (
        id SERIAL PRIMARY KEY,
        room_id INTEGER REFERENCES bingo_rooms(id),
        number INTEGER,
        drawn_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS bingo_audit_logs (
        id SERIAL PRIMARY KEY,
        room_id INTEGER,
        user_id UUID,
        action VARCHAR(100),
        details JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log('✅ Missing tables created for migration 006');
    
    // Ahora intentar la migración 006 nuevamente
    const sql = fs.readFileSync(
      path.join(__dirname, 'migrations', '006_bingo_host_abandonment.sql'), 
      'utf8'
    );
    
    await pool.query('BEGIN');
    await pool.query(sql);
    await pool.query(
      'INSERT INTO migrations (filename) VALUES ($1)',
      ['006_bingo_host_abandonment.sql']
    );
    await pool.query('COMMIT');
    
    console.log('✅ Migration 006 applied successfully after fix');
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Could not apply fix for migration 006:', error.message);
  }
}

// Run migrations
runMigrations();
