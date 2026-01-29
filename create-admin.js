// Script per generare password hash per super admin
const bcrypt = require('bcrypt');

async function createHash() {
  const password = 'admin123';
  const hash = await bcrypt.hash(password, 10);
  console.log('Password: admin123');
  console.log('Hash:', hash);
  console.log('\nEsegui questo SQL:');
  console.log(`INSERT INTO users (tenant_id, username, password, nome, cognome, role) VALUES (NULL, 'superadmin', '${hash}', 'Super', 'Admin', 'super_admin');`);
}

createHash();
