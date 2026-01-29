const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateUsernameConstraint() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'gestionale_assicurazioni'
  });

  try {
    console.log('🔧 Rimozione vincolo UNIQUE su username...');
    await connection.execute('ALTER TABLE users DROP INDEX username');
    console.log('✅ Vincolo UNIQUE rimosso');

    console.log('🔧 Aggiunta vincolo UNIQUE composito (tenant_id, username)...');
    await connection.execute('ALTER TABLE users ADD UNIQUE KEY unique_username_per_tenant (tenant_id, username)');
    console.log('✅ Vincolo composito aggiunto');

    console.log('\n✅ Aggiornamento completato!');
    console.log('ℹ️  Ora gli username possono essere duplicati tra tenant diversi');
  } catch (err) {
    console.error('❌ Errore:', err.message);
  } finally {
    await connection.end();
  }
}

updateUsernameConstraint();
