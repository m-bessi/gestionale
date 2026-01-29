const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
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
app.use(cors());
app.use(express.json());
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
app.get('/api/:table', async (req, res) => {
  try {
    const table = req.params.table;
    const allowedTables = ['clients', 'businesses', 'companies', 'policies'];
    
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Tabella non valida' });
    }
    
    let results = await executeQuery(`SELECT * FROM ${table}`);
    
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
app.get('/api/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const allowedTables = ['clients', 'businesses', 'companies', 'policies'];
    
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Tabella non valida' });
    }
    
    let results = await executeQuery(
      `SELECT * FROM ${table} WHERE id = ?`,
      [id]
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
app.post('/api/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const data = req.body;
    const allowedTables = ['clients', 'businesses', 'companies', 'policies'];
    
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Tabella non valida' });
    }
    
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
app.put('/api/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const data = req.body;
    const allowedTables = ['clients', 'businesses', 'companies', 'policies'];
    
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Tabella non valida' });
    }
    
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
    
    const updates = Object.keys(data).map(key => `${key} = ?`).join(',');
    const values = [...Object.values(data), id];
    
    const query = `UPDATE ${table} SET ${updates} WHERE id = ?`;
    await executeQuery(query, values);
    
    res.json({ id: parseInt(id), ...data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Cancella record
app.delete('/api/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const allowedTables = ['clients', 'businesses', 'companies', 'policies'];
    
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Tabella non valida' });
    }
    
    await executeQuery(`DELETE FROM ${table} WHERE id = ?`, [id]);
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard - Polizze in scadenza
app.get('/api/dashboard/expiring', async (req, res) => {
  try {
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
      WHERE p.data_scadenza BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
      ORDER BY p.data_scadenza ASC
    `;
    
    const results = await executeQuery(query);
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