const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function updatePassword() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });

  try {
    const passwordHash = await bcrypt.hash('admin123', 10);
    console.log('Nuovo hash generato:', passwordHash);
    
    await connection.execute(
      `UPDATE users SET password = ? WHERE username = 'superadmin'`,
      [passwordHash]
    );
    
    console.log('✅ Password super admin aggiornata!');
    console.log('Username: superadmin');
    console.log('Password: admin123');
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await connection.end();
  }
}

updatePassword();
