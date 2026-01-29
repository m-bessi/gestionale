-- Crea il database (modifica il nome se vuoi)
CREATE DATABASE IF NOT EXISTS gestionale_assicurazioni
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE gestionale_assicurazioni;

-- CLIENTI
CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  cognome VARCHAR(100) NOT NULL,
  birth_date DATE NOT NULL,
  cf VARCHAR(16) NOT NULL UNIQUE,
  indirizzo TEXT,
  piva VARCHAR(11),
  email VARCHAR(150),
  telefono VARCHAR(50)
) ENGINE=InnoDB;

-- AZIENDE (contraenti business)
CREATE TABLE IF NOT EXISTS businesses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  amministratore VARCHAR(150) NOT NULL,
  indirizzo TEXT,
  piva VARCHAR(11)
) ENGINE=InnoDB;

-- COMPAGNIE
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  indirizzo TEXT
) ENGINE=InnoDB;

-- POLIZZE
CREATE TABLE IF NOT EXISTS policies (
  id INT AUTO_INCREMENT PRIMARY KEY,
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
  CONSTRAINT fk_company FOREIGN KEY (company_id) REFERENCES companies(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;