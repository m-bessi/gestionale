/*************************
 * 0. AUTH CHECK
 *************************/
async function checkAuth() {
  try {
    const res = await fetch('http://localhost:3000/api/session', { credentials: 'include' });
    const data = await res.json();
    if (!data.authenticated || data.user.role !== 'admin') {
      window.location.href = '/login.html';
      return;
    }
    // Mostra nome tenant
    if (data.user.tenant_name) {
      document.getElementById('tenantName').textContent = data.user.tenant_name;
    }
  } catch (error) {
    window.location.href = '/login.html';
  }
}
checkAuth();

async function logout() {
  await fetch('http://localhost:3000/api/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/login.html';
}

/*************************
 * 1. DATABASE API (MYSQL)
 *************************/
const DB = {
  get: async (table) => {
    try {
      const res = await fetch(`http://localhost:3000/api/${table}`, { credentials: 'include' });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Errore GET');
      }
      return await res.json();
    } catch (error) {
      console.error('Errore GET', error);
      return [];
    }
  },

  insert: async (table, item) => {
    try {
      const res = await fetch(`http://localhost:3000/api/${table}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
        credentials: 'include'
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Errore insert');
      }
      return await res.json();
    } catch (error) {
      console.error('Errore INSERT', error);
      alert('❌ Errore salvataggio: ' + error.message);
      return null;
    }
  },

  update: async (table, id, newData) => {
    try {
      const res = await fetch(`http://localhost:3000/api/${table}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData),
        credentials: 'include'
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Errore update');
      }
      return await res.json();
    } catch (error) {
      console.error('Errore UPDATE', error);
      alert('❌ Errore aggiornamento: ' + error.message);
    }
  },

  delete: async (table, id) => {
    try {
      const res = await fetch(`http://localhost:3000/api/${table}/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Errore delete');
      return await res.json();
    } catch (error) {
      console.error('Errore DELETE', error);
      alert('❌ Errore eliminazione');
    }
  }
};

/*************************
 * 2. STATE & INIT
 *************************/
let currentEditingId = null;
let currentEditingTable = null;
let allClientsData = [];
let allBusinessesData = [];
let allCompaniesData = [];
let allPoliciesData = [];
let allDashboardData = [];

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupModals();
  setupForms();
  setupSearchFilters();
  loadAllData();
});

/*************************
 * 3. NAVIGATION
 *************************/
function setupNavigation() {
  const buttons = document.querySelectorAll(".menu-item");
  const tabs = document.querySelectorAll(".tab");

  buttons.forEach(btn => {
    btn.onclick = () => {
      buttons.forEach(b => b.classList.remove("active"));
      tabs.forEach(t => t.classList.add("hidden"));

      btn.classList.add("active");
      const targetId = `tab-${btn.dataset.tab}`;
      document.getElementById(targetId).classList.remove("hidden");
      document.getElementById("pageTitle").innerText = btn.innerText;
      
      if(btn.dataset.tab === 'dashboard') renderDashboard();
    };
  });
}

/*************************
 * 4. LOAD & RENDER DATA
 *************************/
async function loadAllData() {
  await renderClients();
  await renderBusinesses();
  await renderCompanies();
  await renderPolicies();
  await renderDashboard();
}

async function renderClients() {
  const list = await DB.get("clients");
  console.log("Dati clienti ricevuti:", list);
  const tbody = document.getElementById("clientsBody");
  const empty = document.getElementById("clientsEmpty");
  
  tbody.innerHTML = "";
  if (!list || !list.length) { 
    empty.classList.remove("hidden"); 
    return; 
  }
  empty.classList.add("hidden");

  list.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.nome} ${c.cognome}</td>
      <td>${formatDate(c.birth_date) || "-"}</td>
      <td>${c.cf}</td>
      <td>${c.indirizzo || "-"}</td>
      <td>${c.piva || "-"}</td>
      <td>${c.email || "-"}</td>
      <td>${c.telefono || "-"}</td>
      <td class="right row-actions">
        <button class="btn" style="padding:6px 10px;" onclick="editItem('clients', ${c.id})">✏️</button>
        <button class="btn btn-danger" style="padding:6px 10px;" onclick="deleteItem('clients', ${c.id})">🗑</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function renderBusinesses() {
  const list = await DB.get("businesses");
  const tbody = document.getElementById("businessesBody");
  const empty = document.getElementById("businessesEmpty");

  tbody.innerHTML = "";
  if (!list || !list.length) { 
    empty.classList.remove("hidden"); 
    return; 
  }
  empty.classList.add("hidden");

  list.forEach(b => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${b.nome}</td>
      <td>${b.amministratore}</td>
      <td>${b.indirizzo || "-"}</td>
      <td>${b.piva || "-"}</td>
      <td class="right row-actions">
        <button class="btn" style="padding:6px 10px;" onclick="editItem('businesses', ${b.id})">✏️</button>
        <button class="btn btn-danger" style="padding:6px 10px;" onclick="deleteItem('businesses', ${b.id})">🗑</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function renderCompanies() {
  const list = await DB.get("companies");
  const tbody = document.getElementById("companiesBody");
  const empty = document.getElementById("companiesEmpty");
  const select = document.getElementById("policy_company_id");

  tbody.innerHTML = "";
  select.innerHTML = '<option value="">Seleziona...</option>';

  if (!list || !list.length) { 
    empty.classList.remove("hidden"); 
    return; 
  }
  empty.classList.add("hidden");

  list.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.nome}</td>
      <td>${c.indirizzo || "-"}</td>
      <td class="right row-actions">
        <button class="btn" style="padding:6px 10px;" onclick="editItem('companies', ${c.id})">✏️</button>
        <button class="btn btn-danger" style="padding:6px 10px;" onclick="deleteItem('companies', ${c.id})">🗑</button>
      </td>
    `;
    tbody.appendChild(tr);

    const opt = document.createElement("option");
    opt.value = c.id;
    opt.innerText = c.nome;
    select.appendChild(opt);
  });
}

async function renderPolicies() {
  const list = await DB.get("policies");
  const tbody = document.getElementById("policiesBody");
  const empty = document.getElementById("policiesEmpty");

  tbody.innerHTML = "";
  if (!list || !list.length) { 
    empty.classList.remove("hidden"); 
    return; 
  }
  empty.classList.add("hidden");

  const clients = await DB.get("clients");
  const businesses = await DB.get("businesses");
  const companies = await DB.get("companies");

  list.forEach(p => {
    const status = getPolicyStatus(p.data_scadenza);
    const badgeClass = status === 'active' ? 'ok' : (status === 'warning' ? 'warn' : 'danger');
    const badgeText = status === 'active' ? 'ATTIVA' : (status === 'warning' ? 'IN SCADENZA' : 'SCADUTA');

    const holderName = p.holder_type === 'client' 
      ? (clients.find(c => c.id === p.holder_id)?.nome || 'N/A') + ' ' + (clients.find(c => c.id === p.holder_id)?.cognome || '')
      : (businesses.find(b => b.id === p.holder_id)?.nome || 'N/A');
    
    const companyName = companies.find(c => c.id === p.company_id)?.nome || 'N/A';

    const tr = document.createElement("tr");
    const pdfLink = p.pdf_polizza_name 
      ? `<a href="/uploads/${p.pdf_polizza_name}" target="_blank" style="color: #1d4ed8; text-decoration: none;">📄</a>`
      : '-';
    tr.innerHTML = `
      <td><span class="badge ${badgeClass}">${badgeText}</span></td>
      <td>${p.targa}</td>
      <td>${p.policy_code}</td>
      <td>${companyName}</td>
      <td>${holderName}</td>
      <td>${formatDate(p.data_emissione)}</td>
      <td>${formatDate(p.data_scadenza)}</td>
      <td>${pdfLink}</td>
      <td class="right row-actions">
        <button class="btn" style="padding:6px 10px;" onclick="editItem('policies', ${p.id})">✏️</button>
        <button class="btn btn-danger" style="padding:6px 10px;" onclick="deleteItem('policies', ${p.id})">🗑</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function renderDashboard() {
  const policies = await DB.get("policies");
  const tbody = document.getElementById("dashboardBody");
  const empty = document.getElementById("dashboardEmpty");
  tbody.innerHTML = "";

  const today = new Date();
  const limit = new Date();
  limit.setDate(today.getDate() + 30);

  const filtered = (policies || []).filter(p => {
    const d = new Date(p.data_scadenza);
    return d >= today && d <= limit;
  }).sort((a, b) => {
    const dateA = new Date(a.data_scadenza);
    const dateB = new Date(b.data_scadenza);
    return dateA - dateB;
  });

  if (filtered.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  const clients = await DB.get("clients");
  const businesses = await DB.get("businesses");
  const companies = await DB.get("companies");

  filtered.forEach(p => {
    const holderName = p.holder_type === 'client' 
      ? (clients.find(c => c.id === p.holder_id)?.nome || 'N/A') + ' ' + (clients.find(c => c.id === p.holder_id)?.cognome || '')
      : (businesses.find(b => b.id === p.holder_id)?.nome || 'N/A');
    
    const companyName = companies.find(c => c.id === p.company_id)?.nome || 'N/A';
    const pdfLink = p.pdf_polizza_name 
      ? `<a href="/uploads/${p.pdf_polizza_name}" target="_blank" style="color: #1d4ed8; text-decoration: none;">📄</a>`
      : '-';

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="badge warn">IN SCADENZA</span></td>
      <td>${p.targa}</td>
      <td>${p.policy_code}</td>
      <td>${companyName}</td>
      <td>${holderName}</td>
      <td>${formatDate(p.data_emissione)}</td>
      <td>${formatDate(p.data_scadenza)}</td>
      <td>${pdfLink}</td>
    `;
    tbody.appendChild(tr);
  });
}

/*************************
 * 5. MODALS & FORMS
 *************************/
function setupModals() {
  document.getElementById("btnNewClient").onclick = () => openModal("client");
  document.getElementById("btnNewBusiness").onclick = () => openModal("business");
  document.getElementById("btnNewCompany").onclick = () => openModal("company");
  document.getElementById("btnNewPolicy").onclick = () => openModal("policy");

  document.querySelectorAll("[data-close]").forEach(el => {
    el.onclick = () => {
      document.getElementById(el.dataset.close + "Modal").classList.add("hidden");
    };
  });
}

function openModal(type) {
  currentEditingId = null;
  currentEditingTable = null;
  document.getElementById(type + "Form").reset();
  
  if(type === 'policy') {
    document.getElementById('holder_id').value = '';
    document.getElementById('holder_type').value = '';
    document.getElementById('holderSearch').value = '';
  }

  const titles = {
    client: "Nuovo Cliente", 
    business: "Nuova Azienda",
    company: "Nuova Compagnia", 
    policy: "Nuova Polizza"
  };
  document.getElementById(type + "ModalTitle").innerText = titles[type];
  document.getElementById(type + "Modal").classList.remove("hidden");
}

function setupForms() {
  handleForm("clientForm", "clients", renderClients);
  handleForm("businessForm", "businesses", renderBusinesses);
  handleForm("companyForm", "companies", renderCompanies);
  handleForm("policyForm", "policies", renderPolicies);

  const holderInput = document.getElementById("holderSearch");
  if(holderInput) {
    holderInput.addEventListener("input", (e) => searchHolder(e.target.value));
  }
}

function handleForm(formId, table, renderFn) {
  document.getElementById(formId).onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    
    // Se è una polizza con file PDF, fai l'upload prima
    const pdfFile = formData.get('pdf_file');
    if (table === 'policies' && pdfFile && pdfFile.size > 0) {
      try {
        const pdfFormData = new FormData();
        pdfFormData.append('pdf', pdfFile);
        
        const uploadRes = await fetch('http://localhost:3000/api/upload-pdf', {
          method: 'POST',
          body: pdfFormData,
          credentials: 'include'
        });
        
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          formData.set('pdf_polizza_name', uploadData.filename);
        } else {
          const errorData = await uploadRes.json();
          alert('❌ Errore upload PDF: ' + (errorData.error || 'Errore sconosciuto'));
          return;
        }
      } catch (error) {
        console.error('Errore upload:', error);
        alert('❌ Errore durante il caricamento del PDF: ' + error.message);
        return;
      }
    }
    
    // Rimuovi il file PDF dal formData (non serve inviarlo al DB)
    formData.delete('pdf_file');
    
    const data = Object.fromEntries(formData);

    // Validazioni per polizze
    if (table === 'policies') {
      if (!data.holder_id || !data.holder_type) {
        alert("❌ Seleziona un contraente");
        return;
      }
      if (!data.company_id) {
        alert("❌ Seleziona una compagnia");
        return;
      }
      
      const emissione = new Date(data.data_emissione);
      const scadenza = new Date(data.data_scadenza);
      if (emissione > scadenza) {
        alert("❌ Data emissione non può essere dopo la scadenza!");
        return;
      }
      
      delete data.holderSearch;
    }

    if (currentEditingId) {
      await DB.update(table, currentEditingId, data);
    } else {
      await DB.insert(table, data);
    }

    document.getElementById(formId.replace("Form", "Modal")).classList.add("hidden");
    await renderFn();
    if (table === 'policies' || table === 'clients' || table === 'businesses' || table === 'companies') {
      await renderDashboard();
    }
  };
}

window.editItem = async function(table, id) {
  const list = await DB.get(table);
  const item = list.find(x => x.id == id);
  if (!item) return;

  currentEditingId = id;
  currentEditingTable = table;

  const map = { 'clients': 'client', 'businesses': 'business', 'companies': 'company', 'policies': 'policy' };
  const type = map[table];
  
  // Popola i campi
  Object.keys(item).forEach(key => {
    const input = document.getElementById(type + '_' + key) || document.getElementById(key);
    if (input) input.value = item[key];
  });
  
  if(table === 'policies') {
    const clients = await DB.get("clients");
    const businesses = await DB.get("businesses");
    
    let holderName = '';
    if (item.holder_type === 'client') {
      const client = clients.find(c => c.id === item.holder_id);
      holderName = client ? `${client.nome} ${client.cognome}` : '';
    } else {
      const business = businesses.find(b => b.id === item.holder_id);
      holderName = business ? business.nome : '';
    }
    
    document.getElementById('holderSearch').value = holderName;
    document.getElementById('holder_id').value = item.holder_id;
    document.getElementById('holder_type').value = item.holder_type;
    
    // Mostra il PDF attuale se esiste
    const pdfCurrentDiv = document.getElementById('policy_pdf_current');
    if (item.pdf_polizza_name) {
      pdfCurrentDiv.innerHTML = `<strong>File caricato:</strong> <a href="/uploads/${item.pdf_polizza_name}" target="_blank">📄 ${item.pdf_polizza_name}</a>`;
    } else {
      pdfCurrentDiv.innerHTML = '';
    }
  }

  document.getElementById(type + "ModalTitle").innerText = "Modifica " + type;
  document.getElementById(type + "Modal").classList.remove("hidden");
};

window.deleteItem = async function(table, id) {
  const policies = await DB.get("policies");
  let errorMessage = null;

  if (table === 'clients') {
    if (policies.some(p => p.holder_type === 'client' && p.holder_id == id)) {
      errorMessage = "Impossibile eliminare: ha polizze attive.";
    }
  }
  else if (table === 'businesses') {
    if (policies.some(p => p.holder_type === 'business' && p.holder_id == id)) {
      errorMessage = "Impossibile eliminare: ha polizze attive.";
    }
  }
  else if (table === 'companies') {
    if (policies.some(p => p.company_id == id)) {
      errorMessage = "Impossibile eliminare: ha polizze associate.";
    }
  }

  if (errorMessage) {
    alert("⚠️ " + errorMessage);
    return;
  }

  if (confirm("Sei sicuro di voler eliminare?")) {
    await DB.delete(table, id);
    await loadAllData();
  }
};

/*************************
 * 6. UTILS
 *************************/
async function searchHolder(query) {
  const resultsBox = document.getElementById("holderResults");
  resultsBox.innerHTML = "";
  if (query.length < 1) { 
    resultsBox.classList.add("hidden"); 
    return; 
  }

  const clients = await DB.get("clients");
  const businesses = await DB.get("businesses");

  const foundClients = (clients || []).filter(c => 
    (c.nome + " " + c.cognome).toLowerCase().includes(query.toLowerCase()) || 
    c.cf.toLowerCase().includes(query.toLowerCase())
  );

  const foundBiz = (businesses || []).filter(b => 
    b.nome.toLowerCase().includes(query.toLowerCase())
  );

  const all = [
    ...foundClients.map(c => ({...c, type: 'client'})), 
    ...foundBiz.map(b => ({...b, type: 'business'}))
  ];

  if(all.length === 0) { 
    resultsBox.classList.add("hidden"); 
    return; 
  }

  resultsBox.classList.remove("hidden");
  
  all.forEach(item => {
    const div = document.createElement("div");
    const isClient = item.type === 'client';
    
    const label = isClient
      ? `👤 ${item.nome} ${item.cognome} (${item.cf})` 
      : `🏢 ${item.nome}`;
      
    div.innerText = label;
    div.onclick = () => {
      document.getElementById("holderSearch").value = label;
      document.getElementById("holder_id").value = item.id;
      document.getElementById("holder_type").value = item.type;
      resultsBox.classList.add("hidden");
    };
    resultsBox.appendChild(div);
  });
}

function getPolicyStatus(dateStr) {
  const today = new Date();
  const target = new Date(dateStr);
  const diffTime = target - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "expired";
  if (diffDays <= 30) return "warning";
  return "active";
}

function formatDate(isoStr) {
  if (!isoStr) return "";
  // Se contiene "T" (ISO complete), prendi la parte prima della T
  if (isoStr.includes('T')) return isoStr.split('T')[0];
  // Se è già nel formato YYYY-MM-DD, restituiscilo così
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return isoStr;
  // Fallback per altri formati
  return isoStr;
}

/*************************
 * 7. SEARCH & FILTER
 *************************/
function setupSearchFilters() {
  const searchInputs = {
    'dashboardSearch': () => filterDashboard(),
    'clientsSearch': () => filterClients(),
    'businessesSearch': () => filterBusinesses(),
    'companiesSearch': () => filterCompanies(),
    'policiesSearch': () => filterPolicies()
  };

  Object.keys(searchInputs).forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', searchInputs[id]);
    }
  });
}

function filterDashboard() {
  const query = document.getElementById('dashboardSearch').value.toLowerCase();
  const tbody = document.getElementById('dashboardBody');
  const rows = tbody.querySelectorAll('tr');

  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(query) ? '' : 'none';
  });
}

function filterClients() {
  const query = document.getElementById('clientsSearch').value.toLowerCase();
  const tbody = document.getElementById('clientsBody');
  const rows = tbody.querySelectorAll('tr');

  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(query) ? '' : 'none';
  });
}

function filterBusinesses() {
  const query = document.getElementById('businessesSearch').value.toLowerCase();
  const tbody = document.getElementById('businessesBody');
  const rows = tbody.querySelectorAll('tr');

  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(query) ? '' : 'none';
  });
}

function filterCompanies() {
  const query = document.getElementById('companiesSearch').value.toLowerCase();
  const tbody = document.getElementById('companiesBody');
  const rows = tbody.querySelectorAll('tr');

  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(query) ? '' : 'none';
  });
}

function filterPolicies() {
  const query = document.getElementById('policiesSearch').value.toLowerCase();
  const tbody = document.getElementById('policiesBody');
  const rows = tbody.querySelectorAll('tr');

  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(query) ? '' : 'none';
  });
}