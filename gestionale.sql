-- Crea il database (modifica il nome se vuoi)
CREATE DATABASE IF NOT EXISTS gestionale_assicurazioni
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE gestionale_assicurazioni;

-- TENANTS
CREATE TABLE IF NOT EXISTS tenants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- USERS (Amministratori dei tenant)
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

-- CLIENTI
CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  nome VARCHAR(100) NOT NULL,
  cognome VARCHAR(100) NOT NULL,
  birth_date DATE NOT NULL,
  cf VARCHAR(16) NOT NULL,
  indirizzo TEXT,
  piva VARCHAR(11),
  email VARCHAR(150),
  telefono VARCHAR(50),
  
  INDEX idx_tenant (tenant_id),
  UNIQUE KEY unique_cf_per_tenant (tenant_id, cf),
  CONSTRAINT fk_client_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- AZIENDE (contraenti business)
CREATE TABLE IF NOT EXISTS businesses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  nome VARCHAR(150) NOT NULL,
  amministratore VARCHAR(150) NOT NULL,
  indirizzo TEXT,
  piva VARCHAR(11),
  
  INDEX idx_tenant (tenant_id),
  CONSTRAINT fk_business_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- COMPAGNIE
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  nome VARCHAR(150) NOT NULL,
  indirizzo TEXT,
  
  INDEX idx_tenant (tenant_id),
  CONSTRAINT fk_company_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- POLIZZE
CREATE TABLE IF NOT EXISTS policies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  targa VARCHAR(10) NOT NULL,
  policy_code VARCHAR(100) NOT NULL,
  holder_type ENUM('client','business') NOT NULL,
  holder_id INT NOT NULL,
  company_id INT NOT NULL,
  data_emissione DATE NOT NULL,
  data_scadenza DATE NOT NULL,
  pdf_polizza_name VARCHAR(255),

  INDEX idx_targa (targa),
  INDEX idx_holder (holder_type, holder_id),
  INDEX idx_company (company_id),
  INDEX idx_tenant (tenant_id),
  UNIQUE KEY unique_policy_code_per_tenant (tenant_id, policy_code),
  CONSTRAINT fk_policy_company FOREIGN KEY (company_id) REFERENCES companies(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_policy_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;