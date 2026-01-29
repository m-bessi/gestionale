const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const session = require('express-session');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();

// Configurazione multer per upload PDF
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo file PDF sono consentiti'));
    }
  }
});

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'gestionale-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // true in produzione con HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 ore
  }
}));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Pool di connessioni MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Funzione helper per eseguire query
async function executeQuery(query, params = []) {
  const connection = await pool.getConnection();
  try {
    const [results] = await connection.execute(query, params);
    return results;
  } catch (error) {
    throw error;
  } finally {
    connection.release();
  }
}

// Middleware di autenticazione
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ error: 'Non autenticato' });
}

// Funzione per convertire date dal formato ISO al formato DATE
function convertDate(dateStr) {
  if (!dateStr) return null;
  // Prende solo YYYY-MM-DD da 2026-01-22T23:00:00
  if (dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }
  return dateStr;
}

// ============= API ENDPOINTS =============

// POST - Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password, tenant_name } = req.body;
    
    console.log('[LOGIN] Tentativo login:', { username, tenant_name: tenant_name || 'SUPER_ADMIN' });
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username e password richiesti' });
    }
    
    // Query per super admin o admin normale
    let query = `SELECT u.*, t.nome as tenant_name 
                 FROM users u 
                 LEFT JOIN tenants t ON u.tenant_id = t.id 
                 WHERE u.username = ?`;
    let params = [username];
    
    // Se è specificato il tenant, filtra per tenant
    if (tenant_name) {
      query += ` AND (u.role = 'admin' AND t.nome = ?)`;
      params.push(tenant_name);
    } else {
      // Senza tenant, può essere solo super_admin
      query += ` AND u.role = 'super_admin'`;
    }
    
    console.log('[LOGIN] Query:', query);
    console.log('[LOGIN] Params:', params);
    
    const users = await executeQuery(query, params);
    
    console.log('[LOGIN] Utenti trovati:', users.length);
    
    if (users.length === 0) {
      console.log('[LOGIN] Nessun utente trovato');
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    
    const user = users[0];
    console.log('[LOGIN] Utente trovato:', user.username, 'role:', user.role);
    
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    console.log('[LOGIN] Password match:', passwordMatch);
    
    if (!passwordMatch) {
      console.log('[LOGIN] Password errata');
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    
    // Salva sessione
    req.session.userId = user.id;
    req.session.tenantId = user.tenant_id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.tenantName = user.tenant_name;
    
    console.log('[LOGIN] Login riuscito per:', user.username);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        nome: user.nome,
        cognome: user.cognome,
        role: user.role,
        tenant_id: user.tenant_id,
        tenant_name: user.tenant_name
      }
    });
  } catch (error) {
    console.error('Errore login:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Errore durante il logout' });
    }
    res.json({ success: true });
  });
});

// GET - Verifica sessione
app.get('/api/session', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      authenticated: true,
      user: {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.role,
        tenant_id: req.session.tenantId,
        tenant_name: req.session.tenantName
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Middleware per super admin
function requireSuperAdmin(req, res, next) {
  if (req.session && req.session.userId && req.session.role === 'super_admin') {
    return next();
  }
  res.status(403).json({ error: 'Accesso negato: richiesti privilegi di super admin' });
}

// POST - Crea tenant (solo super admin)
app.post('/api/tenants', requireSuperAdmin, async (req, res) => {
  try {
    const { nome } = req.body;
    
    if (!nome) {
      return res.status(400).json({ error: 'Nome tenant richiesto' });
    }
    
    const result = await executeQuery('INSERT INTO tenants (nome) VALUES (?)', [nome]);
    
    res.status(201).json({
      id: result.insertId,
      nome
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Lista tutti i tenant (solo super admin)
app.get('/api/tenants', requireSuperAdmin, async (req, res) => {
  try {
    const tenants = await executeQuery(`
      SELECT 
        t.*,
        COUNT(u.id) as user_count
      FROM tenants t
      LEFT JOIN users u ON u.tenant_id = t.id
      GROUP BY t.id
      ORDER BY t.nome
    `);
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Crea utente admin per tenant (solo super admin)
app.post('/api/admin-users', requireSuperAdmin, async (req, res) => {
  try {
    const { tenant_id, username, password, nome, cognome, email } = req.body;
    
    if (!tenant_id || !username || !password || !nome || !cognome) {
      return res.status(400).json({ error: 'Campi richiesti mancanti' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await executeQuery(
      'INSERT INTO users (tenant_id, username, password, nome, cognome, email, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [tenant_id, username, hashedPassword, nome, cognome, email, 'admin']
    );
    
    res.status(201).json({
      id: result.insertId,
      tenant_id,
      username,
      nome,
      cognome,
      email
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Username già esistente' });
    }
    res.status(500).json({ error: error.message });
  }
});

// GET - Lista utenti admin (solo super admin)
app.get('/api/admin-users', requireSuperAdmin, async (req, res) => {
  try {
    const users = await executeQuery(`
      SELECT u.id, u.tenant_id, u.username, u.nome, u.cognome, u.email, u.created_at, t.nome as tenant_name
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.role = 'admin'
      ORDER BY t.nome, u.username
    `);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Upload PDF (DEVE ESSERE PRIMA DEGLI ENDPOINT GENERICI)
app.post('/api/upload-pdf', upload.single('pdf'), (req, res) => {
  console.log('[UPLOAD] Ricevuta richiesta file:', req.file?.originalname);
  try {
    if (!req.file) {
      console.log('[UPLOAD] Errore: nessun file ricevuto');
      return res.status(400).json({ error: 'Nessun file caricato' });
    }
    
    // Rinomina il file con estensione .pdf
    const filename = `policy_${Date.now()}.pdf`;
    const oldPath = req.file.path;
    const newPath = path.join(uploadDir, filename);
    
    fs.renameSync(oldPath, newPath);
    console.log('[UPLOAD] File salvato come:', filename);
    
    res.json({ 
      success: true, 
      filename: filename,
      url: `/uploads/${filename}`
    });
  } catch (error) {
    console.log('[UPLOAD] Errore:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET - Recupera tutti i record da una tabella
app.get('/api/:table', requireAuth, async (req, res) => {
  try {
    const table = req.params.table;
    const allowedTables = ['clients', 'businesses', 'companies', 'policies'];
    
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Tabella non valida' });
    }
    
    const tenantId = req.session.tenantId;
    let results = await executeQuery(`SELECT * FROM ${table} WHERE tenant_id = ?`, [tenantId]);
    
    // Formatta le date
    results = results.map(row => {
      if (row.birth_date) row.birth_date = formatDateOutput(row.birth_date);
      if (row.data_emissione) row.data_emissione = formatDateOutput(row.data_emissione);
      if (row.data_scadenza) row.data_scadenza = formatDateOutput(row.data_scadenza);
      return row;
    });
    
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Recupera singolo record
app.get('/api/:table/:id', requireAuth, async (req, res) => {
  try {
    const { table, id } = req.params;
    const allowedTables = ['clients', 'businesses', 'companies', 'policies'];
    
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Tabella non valida' });
    }
    
    const tenantId = req.session.tenantId;
    let results = await executeQuery(
      `SELECT * FROM ${table} WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Record non trovato' });
    }
    
    let result = results[0];
    if (result.birth_date) result.birth_date = formatDateOutput(result.birth_date);
    if (result.data_emissione) result.data_emissione = formatDateOutput(result.data_emissione);
    if (result.data_scadenza) result.data_scadenza = formatDateOutput(result.data_scadenza);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Crea nuovo record
app.post('/api/:table', requireAuth, async (req, res) => {
  try {
    const { table } = req.params;
    const data = req.body;
    const allowedTables = ['clients', 'businesses', 'companies', 'policies'];
    
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Tabella non valida' });
    }
    
    // Aggiungi tenant_id automaticamente
    const tenantId = req.session.tenantId;
    data.tenant_id = tenantId;
    
    // Converti le date se presenti
    if (data.birth_date) {
      data.birth_date = convertDate(data.birth_date);
    }
    if (data.data_emissione) {
      data.data_emissione = convertDate(data.data_emissione);
    }
    if (data.data_scadenza) {
      data.data_scadenza = convertDate(data.data_scadenza);
    }
    
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(',');
    const values = Object.values(data);
    
    const query = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`;
    const result = await executeQuery(query, values);
    
    res.status(201).json({
      id: result.insertId,
      ...data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Aggiorna record
app.put('/api/:table/:id', requireAuth, async (req, res) => {
  try {
    const { table, id } = req.params;
    const data = req.body;
    const allowedTables = ['clients', 'businesses', 'companies', 'policies'];
    
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Tabella non valida' });
    }
    
    const tenantId = req.session.tenantId;
    
    // Converti le date se presenti
    if (data.birth_date) {
      data.birth_date = convertDate(data.birth_date);
    }
    if (data.data_emissione) {
      data.data_emissione = convertDate(data.data_emissione);
    }
    if (data.data_scadenza) {
      data.data_scadenza = convertDate(data.data_scadenza);
    }
    
    // Rimuovi tenant_id dai dati aggiornabili (non deve essere modificato)
    delete data.tenant_id;
    
    const updates = Object.keys(data).map(key => `${key} = ?`).join(',');
    const values = [...Object.values(data), id, tenantId];
    
    const query = `UPDATE ${table} SET ${updates} WHERE id = ? AND tenant_id = ?`;
    await executeQuery(query, values);
    
    res.json({ id: parseInt(id), ...data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Cancella record
app.delete('/api/:table/:id', requireAuth, async (req, res) => {
  try {
    const { table, id } = req.params;
    const allowedTables = ['clients', 'businesses', 'companies', 'policies'];
    
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Tabella non valida' });
    }
    
    const tenantId = req.session.tenantId;
    await executeQuery(`DELETE FROM ${table} WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard - Polizze in scadenza
app.get('/api/dashboard/expiring', requireAuth, async (req, res) => {
  try {
    const tenantId = req.session.tenantId;
    const query = `
      SELECT 
        p.*,
        c.nome as company_name,
        CASE 
          WHEN p.holder_type = 'client' THEN CONCAT(cl.nome, ' ', cl.cognome)
          ELSE b.nome 
        END as holder_name
      FROM policies p
      JOIN companies c ON p.company_id = c.id
      LEFT JOIN clients cl ON p.holder_type = 'client' AND p.holder_id = cl.id
      LEFT JOIN businesses b ON p.holder_type = 'business' AND p.holder_id = b.id
      WHERE p.tenant_id = ? AND p.data_scadenza BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
      ORDER BY p.data_scadenza ASC
    `;
    
    const results = await executeQuery(query, [tenantId]);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Funzione per formattare date senza timezone issues
function formatDateOutput(dateObj) {
  if (!dateObj) return null;
  if (typeof dateObj === 'string') return dateObj;
  
  // Se è un oggetto Date, prendi anno-mese-giorno direttamente
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Gestione errori multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'Errore upload: ' + err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// Avvio server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server avviato su http://localhost:${PORT}`);
  console.log(`📊 Database: ${process.env.DB_NAME}`);
  console.log(`🔗 Accedi da: http://localhost:${PORT}`);
});