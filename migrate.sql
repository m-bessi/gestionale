-- Script di migrazione per multi-tenant
-- Esegui questo file per aggiornare il database esistente

USE gestionale_assicurazioni;

-- 1. Crea tabella TENANTS
CREATE TABLE IF NOT EXISTS tenants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Crea tabella USERS
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
  
  INDEX idx_tenant (tenant_id),
  CONSTRAINT fk_user_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Inserisci un tenant di default (se non esistono dati)
INSERT INTO tenants (nome) VALUES ('Default')
ON DUPLICATE KEY UPDATE nome = nome;

-- 4. Aggiungi colonna tenant_id alle tabelle esistenti
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1;

-- 5. Rimuovi vincolo UNIQUE su clients.cf (sarà unico per tenant)
ALTER TABLE clients DROP INDEX IF EXISTS cf;

-- 6. Aggiungi nuovi vincoli UNIQUE per tenant
ALTER TABLE clients ADD UNIQUE KEY unique_cf_per_tenant (tenant_id, cf);
ALTER TABLE policies ADD UNIQUE KEY unique_policy_code_per_tenant (tenant_id, policy_code);

-- 7. Aggiungi indici per tenant_id
ALTER TABLE clients ADD INDEX IF NOT EXISTS idx_tenant (tenant_id);
ALTER TABLE businesses ADD INDEX IF NOT EXISTS idx_tenant (tenant_id);
ALTER TABLE companies ADD INDEX IF NOT EXISTS idx_tenant (tenant_id);
ALTER TABLE policies ADD INDEX IF NOT EXISTS idx_tenant (tenant_id);

-- 8. Aggiungi foreign keys per tenant_id
ALTER TABLE clients ADD CONSTRAINT fk_client_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  ON UPDATE CASCADE ON DELETE CASCADE;
  
ALTER TABLE businesses ADD CONSTRAINT fk_business_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  ON UPDATE CASCADE ON DELETE CASCADE;
  
ALTER TABLE companies ADD CONSTRAINT fk_company_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  ON UPDATE CASCADE ON DELETE CASCADE;

-- Rimuovi vecchia foreign key su policies e ricreala con nome nuovo
ALTER TABLE policies DROP FOREIGN KEY IF EXISTS fk_company;
ALTER TABLE policies ADD CONSTRAINT fk_policy_company FOREIGN KEY (company_id) REFERENCES companies(id)
  ON UPDATE CASCADE ON DELETE RESTRICT;
  
ALTER TABLE policies ADD CONSTRAINT fk_policy_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 9. Crea un super admin (modifica username/password a piacere)
-- Username: superadmin
-- Password: admin123
INSERT INTO users (tenant_id, username, password, nome, cognome, role) 
VALUES (NULL, 'superadmin', '$2b$10$D8JVRfc.GN5OEueEHLsxnuFMrOoJMcrzC4H63YWgn4WknmsVr3x7q', 'Super', 'Admin', 'super_admin')
ON DUPLICATE KEY UPDATE username = username;

SELECT 'Migrazione completata con successo!' as status;
