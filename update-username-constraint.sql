-- Permetti username duplicati tra tenant diversi
-- Gli username devono essere unici solo all'interno dello stesso tenant

-- Rimuovi il vincolo UNIQUE globale su username (se esiste)
ALTER TABLE users DROP INDEX username;

-- Aggiungi vincolo UNIQUE composito (tenant_id, username)
-- Questo permette lo stesso username su tenant diversi
-- NOTA: Super admin ha tenant_id NULL, quindi può esserci solo un super admin con quel username
ALTER TABLE users ADD UNIQUE KEY unique_username_per_tenant (tenant_id, username);
