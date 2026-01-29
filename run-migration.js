// Script per eseguire la migrazione dal codice
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    multipleStatements: true
  });

  try {
    console.log('🔄 Inizio migrazione...');

    // 1. Crea tabella TENANTS
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tenants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(150) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
    console.log('✅ Tabella tenants creata');

    // 2. Crea tabella USERS
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT DEFAULT NULL,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        nome VARCHAR(100) NOT NULL,
        cognome VARCHAR(100) NOT NULL,
        email VARCHAR(150),
        role ENUM('admin','super_admin') DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant (tenant_id)
      ) ENGINE=InnoDB
    `);
    console.log('✅ Tabella users creata');

    // 3. Inserisci tenant default
    await connection.execute(`INSERT INTO tenants (nome) VALUES ('Default') ON DUPLICATE KEY UPDATE nome = nome`);
    console.log('✅ Tenant Default creato');

    // 4. Aggiungi colonne tenant_id
    const tables = ['clients', 'businesses', 'companies', 'policies'];
    for (const table of tables) {
      try {
        await connection.execute(`ALTER TABLE ${table} ADD COLUMN tenant_id INT NOT NULL DEFAULT 1`);
        console.log(`✅ Colonna tenant_id aggiunta a ${table}`);
      } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
          console.log(`⚠️  Colonna tenant_id già presente in ${table}`);
        } else {
          throw e;
        }
      }
    }

    // 5. Rimuovi vincolo UNIQUE su cf
    try {
      await connection.execute(`ALTER TABLE clients DROP INDEX cf`);
      console.log('✅ Rimosso vincolo UNIQUE su clients.cf');
    } catch (e) {
      console.log('⚠️  Vincolo cf già rimosso o inesistente');
    }

    // 6. Aggiungi vincoli UNIQUE per tenant
    try {
      await connection.execute(`ALTER TABLE clients ADD UNIQUE KEY unique_cf_per_tenant (tenant_id, cf)`);
      console.log('✅ Aggiunto vincolo unique_cf_per_tenant');
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  Vincolo unique_cf_per_tenant già esistente');
      }
    }

    try {
      await connection.execute(`ALTER TABLE policies ADD UNIQUE KEY unique_policy_code_per_tenant (tenant_id, policy_code)`);
      console.log('✅ Aggiunto vincolo unique_policy_code_per_tenant');
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  Vincolo unique_policy_code_per_tenant già esistente');
      }
    }

    // 7. Aggiungi foreign keys
    const fkMappings = [
      { table: 'users', fk: 'fk_user_tenant', ref: 'tenants' },
      { table: 'clients', fk: 'fk_client_tenant', ref: 'tenants' },
      { table: 'businesses', fk: 'fk_business_tenant', ref: 'tenants' },
      { table: 'companies', fk: 'fk_company_tenant', ref: 'tenants' },
      { table: 'policies', fk: 'fk_policy_tenant', ref: 'tenants' }
    ];

    for (const { table, fk, ref } of fkMappings) {
      try {
        await connection.execute(`ALTER TABLE ${table} ADD CONSTRAINT ${fk} FOREIGN KEY (tenant_id) REFERENCES ${ref}(id) ON UPDATE CASCADE ON DELETE CASCADE`);
        console.log(`✅ Foreign key ${fk} aggiunta`);
      } catch (e) {
        if (e.code === 'ER_DUP_KEYNAME') {
          console.log(`⚠️  Foreign key ${fk} già esistente`);
        } else {
          console.log(`⚠️  Errore FK ${fk}:`, e.message);
        }
      }
    }

    // 8. Crea super admin
    const passwordHash = await bcrypt.hash('admin123', 10);
    try {
      await connection.execute(
        `INSERT INTO users (tenant_id, username, password, nome, cognome, role) VALUES (NULL, ?, ?, 'Super', 'Admin', 'super_admin')`,
        ['superadmin', passwordHash]
      );
      console.log('✅ Super admin creato');
      console.log('   Username: superadmin');
      console.log('   Password: admin123');
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        console.log('⚠️  Super admin già esistente');
      } else {
        throw e;
      }
    }

    console.log('\n🎉 Migrazione completata con successo!');
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
  } finally {
    await connection.end();
  }
}

migrate();
