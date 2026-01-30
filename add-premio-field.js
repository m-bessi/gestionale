const mysql = require('mysql2/promise');
require('dotenv').config();

async function addPremioField() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'gestionale_assicurazioni'
  });

  try {
    console.log('🔧 Aggiunta colonna premio alla tabella policies...');
    await connection.execute(`
      ALTER TABLE policies 
      ADD COLUMN IF NOT EXISTS premio DECIMAL(10, 2) DEFAULT 0.00
    `);
    console.log('✅ Colonna premio aggiunta con successo!');
    console.log('ℹ️  Tipo: DECIMAL(10, 2) - consente importi fino a 99.999.999,99');
  } catch (err) {
    console.error('❌ Errore:', err.message);
  } finally {
    await connection.end();
  }
}

addPremioField();
