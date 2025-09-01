function formatNumNoRs(x){
  var n = Number(String(x||'').replace(/[^0-9.\-]/g,''))||0;
  return n.toLocaleString('en-LK',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function formatCurrency(value) {
    return 'Rs. ' + Number(value).toLocaleString('en-LK', {minimumFractionDigits: 2});
}

/* ArtGraphX POS v3.0 Offline build
   - All data in localStorage (no fetch)
   - Forgot password simulation (Option B): creates a reset token visible to user; admin can also reset passwords from Settings.
   - Invoice number consumed only on save.
   - SKU-only input, auto-fill product name & price, qty default 1
   - Amount Tendered + Change Due live, calculator modal copies value to Amount Tendered
*/


// Quotation numbering
function peekQuoteNo() {
    if (db && db.qseq) {
        return db.qseq.q;
    }
    return null; // or appropriate default value
}
function nextQuoteNo() {
    // Ensure qseq exists
    if (!db.qseq) {
        db.qseq = {q: 1000};
    }
    
    var n = db.qseq.q;
    db.qseq.q = n + 1;
    return n;
}
// storage keys
var K_INV = 'agx_inv_v3_offline',
    K_SALES = 'agx_sales_v3_offline',
    K_CUST = 'agx_cust_v3_offline',
    K_PUR = 'agx_pur_v3_offline';
var K_SETTINGS = 'agx_settings_v3_offline',
    K_USER = 'agx_user_v3_offline',
    K_SEQ = 'agx_seq_v3_offline',
    K_PWRESET = 'agx_pwreset_v3_offline';
var K_QUOTES = 'agx_quotes_v1_offline',
    K_QSEQ = 'agx_qseq_v1_offline';


const defaultSettings = {
  companyName: 'ArtGraphX Book Shop & Communication',
  address: 'No 304/1/1, Manik Agara Rd, Koratota Kaduwela, Sri Lanka, 10640',
  phone: '(+94) 078 630 7700',
  email: 'artgraphx25@gmail.com',
  currencyCode: 'LKR',
  currencyPrefix: 'Rs. ',
  logoDataUrl: ''
};

const defaultUsers = [
  { username:'admin', role:'admin', password:'1234', email:'artgraphx25@gmail.com' },
  { username:'cashier', role:'cashier', password:'0000', email:'' }
];

// helpers
// currency parsing/formatting helpers for text inputs
function parseMoney(str){ if(typeof str==='number') return str; const s=(str||'').toString().replace(/[^0-9.\-]/g,''); const n = Number(s||0); return isNaN(n)?0:n; }

const uid = ()=> Math.random().toString(36).slice(2)+Date.now().toString(36);
const fmtMoney=(v)=>'Rs. '+Number(v||0).toLocaleString('en-LK',{minimumFractionDigits:2,maximumFractionDigits:2});
function getSettings(){ return JSON.parse(localStorage.getItem(K_SETTINGS)||'null') || defaultSettings; }
function setSettings(v){ localStorage.setItem(K_SETTINGS, JSON.stringify(v)); }

function ensureInit(){
  if(!localStorage.getItem(K_INV)){
    localStorage.setItem(K_INV, JSON.stringify([
      {id:uid(), category:'Books', name:'CR Book A4', sku:'BK-CR-A4', mrp:400, discount:50, price:350, cost:220, qty:24},
      {id:uid(), category:'Books', name:'Textbook - Grade 6', sku:'BK-TXT-06', mrp:1300, discount:100, price:1200, cost:850, qty:12},
      {id:uid(), category:'Service', name:'Photocopy (per page)', sku:'SRV-PHOTO', mrp:10, discount:0, price:10, cost:0, qty:99999},
    ]));
  }
  if(!localStorage.getItem(K_CUST)){
    localStorage.setItem(K_CUST, JSON.stringify([{id:'cust_cash', name:'Cash', phone:'', email:''}]));
  }
  if(!localStorage.getItem(K_SALES)) localStorage.setItem(K_SALES, JSON.stringify([]));
  if(!localStorage.getItem(K_PUR)) localStorage.setItem(K_PUR, JSON.stringify([]));
  if(!localStorage.getItem(K_SETTINGS)) setSettings(defaultSettings);
  if(!localStorage.getItem(K_USER)) localStorage.setItem(K_USER, JSON.stringify(defaultUsers));
  if(!localStorage.getItem(K_SEQ)) localStorage.setItem(K_SEQ, JSON.stringify({invoice:1}));
  if(!localStorage.getItem(K_PWRESET)) localStorage.setItem(K_PWRESET, JSON.stringify({}));
}
ensureInit();

const db = {
  get inv(){ return JSON.parse(localStorage.getItem(K_INV)||'[]'); }, set inv(v){ localStorage.setItem(K_INV, JSON.stringify(v)); },
  get sales(){ return JSON.parse(localStorage.getItem(K_SALES)||'[]'); }, set sales(v){ localStorage.setItem(K_SALES, JSON.stringify(v)); },
  get cust(){ return JSON.parse(localStorage.getItem(K_CUST)||'[]'); }, set cust(v){ localStorage.setItem(K_CUST, JSON.stringify(v)); },
  get pur(){ return JSON.parse(localStorage.getItem(K_PUR)||'[]'); }, set pur(v){ localStorage.setItem(K_PUR, JSON.stringify(v)); },
  get users(){ return JSON.parse(localStorage.getItem(K_USER)||'[]'); }, set users(v){ localStorage.setItem(K_USER, JSON.stringify(v)); },
  get seq(){ return JSON.parse(localStorage.getItem(K_SEQ)||'{"invoice":1}'); }, set seq(v){ localStorage.setItem(K_SEQ, JSON.stringify(v)); },
  get reset(){ return JSON.parse(localStorage.getItem(K_PWRESET)||'{}'); }, set reset(v){ localStorage.setItem(K_PWRESET, JSON.stringify(v)); },

  get quotes(){ return JSON.parse(localStorage.getItem(K_QUOTES)||'[]'); },
  set quotes(v){ localStorage.setItem(K_QUOTES, JSON.stringify(v)); },
  get qseq(){ return JSON.parse(localStorage.getItem(K_QSEQ)||'{"q":1001}'); },
  set qseq(v){ localStorage.setItem(K_QSEQ, JSON.stringify(v)); },

};

let currentUser = null;
const app = document.getElementById('app');

function layout(contentHTML){
  const s = getSettings();
  const logo = s.logoDataUrl ? `<img src="${s.logoDataUrl}" alt="logo" />` : `<img src="" alt="logo" style="display:none" />`;
  const settingsButton = currentUser?.role==='admin' ? `<button class="nav-btn" data-section="settings">Settings</button>` : '';
  app.innerHTML = `
    <header class="topbar">
      <div class="brand-left">${logo}</div>
      <div class="brand-center">
        <div class="name">${s.companyName}</div>
        <div class="meta">${s.address}  ${s.phone}  ${s.email}</div>
      </div>
      <div class="brand-right">
        <div id="now">--</div>
        <div class="currency">${s.currencyCode} (${s.currencyPrefix.trim()})</div>
      </div>
    </header>
    <main class="wrap">
      <aside class="sidebar">
        <nav>
          <button class="nav-btn active" data-section="dashboard">Dashboard</button>
          <button class="nav-btn" data-section="invoice">Customer Invoice</button>
<button class="nav-btn" data-section="quotation">Customer Quotation</button>
          <button class="nav-btn" data-section="inventory">Inventory</button>
          <button class="nav-btn" data-section="sales">Sales</button>
          <button class="nav-btn" data-section="purchases">Purchases</button>
          <button class="nav-btn" data-section="customers">Customers</button>
          <button class="nav-btn" data-section="reports">Reports</button>
          ${settingsButton}
          <hr/>
          <button id="exportJson" class="nav-btn small">Export JSON (Backup)</button>
          <label class="nav-btn small file">Import JSON <input id="importFile" type="file" accept="application/json"/></label>
          <hr/>
          <div class="badge">User: ${currentUser?.username || ''} (${currentUser?.role || ''}) <span class="version"> v3.0</span></div>
          <button id="logoutBtn" class="nav-btn small">Logout</button>
        </nav>
      </aside>
      <section id="content" class="content"><div class="main-card">${contentHTML||''}</div></section>
    </main>
    <div class="footer-bar"><div class="left">Copyright  2025 ArtGraphX. All rights reserved.</div><div class="center">POS System Powered by <span class="powered"><img id="footerLogo" src="${s.logoDataUrl}" alt="logo" style="height:1em;vertical-align:-0.15em;margin-left:6px"/></span></div><div class="right">Version 1.0</div></div>
  `;

  document.querySelectorAll('.nav-btn[data-section]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      show(e.currentTarget.dataset.section);
    });
  });
  (function(){var _el=document.getElementById('exportJson'); if(_el) _el.addEventListener('click', exportJSON);})();
  document.getElementById('importFile').addEventListener('change', handleImport);
  document.getElementById('logoutBtn').addEventListener('click', ()=>{ currentUser=null; renderLogin(); });
  tick(); setInterval(tick,1000);
}

function tick(){ const n=document.getElementById('now'); if(n) n.textContent=new Date().toLocaleString('en-LK'); }

// LOGIN / REGISTER / FORGOT (Option B simulated)
function renderLogin(){
  app.innerHTML = `
    <div class="login-wrap" style="text-align:center">
<img src="${getSettings().logoDataUrl || ""
}" alt="logo" style="max-width:200px;height:auto;border-radius:6px;margin-bottom:14px"/>
      
<div style="margin-bottom:10px"></div>
      <div class="field"><label>Username<input id="u" class="input" placeholder="Username" style="text-align:center;margin-top:4px" style="text-align:center;margin-top:4px" /></label></div>
      <div class="field"><label>Password<input id="p" type="password" style="text-align:center;margin-bottom:20px" class="input" placeholder="Password" style="text-align:center;margin-top:4px" style="text-align:center;margin-top:4px" /></label></div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <button id="loginBtn" class="btn primary">Login</button>
        
        
      </div>
      <div style="margin-top:14px"></div><p class="badge" style="margin-top:8px;text-align:center">Admin can create users and reset passwords locally.</p>
<p style="text-align:center;margin-top:12px"><span style="font-size:12px;color:rgba(0,0,0,0.25)"><span style="font-size:12px;color:rgba(0,0,0,0.25)"><span style="font-size:12px;color:#b6b6b6">Version 7.1</span></span></span></p>
    </div>
  
    <div class="footer-bar">
      <div class="left">Copyright  2025 ArtGraphX. All rights reserved.</div>
      <div class="center">POS System Powered by <img src="${getSettings().logoDataUrl || 'logo-light-transparent-2.png'}" alt="logo"/></div>
      <div class="right">Version 1.0</div>
    </div>
`;
  document.getElementById('loginBtn').addEventListener('click', ()=>{
    const u = document.getElementById('u').value.trim();
    const p = document.getElementById('p').value;
    const found = db.users.find(x=>x.username===u && x.password===p);
    if(!found) return alert('Invalid credentials');
    currentUser = {username:found.username, role:found.role};
    layout(); show('dashboard'); document.querySelectorAll('.nav-btn').forEach(btn=>{btn.classList.toggle('active', btn.dataset.section==='dashboard');});
  });
  // submit on Enter key
  ['u','p'].forEach(id=>{
    const el = document.getElementById(id);
    el.addEventListener('keydown', (ev)=>{
      if(ev.key==='Enter'){ document.getElementById('loginBtn').click(); }
    });
  });
}

function renderRegister(){
  app.innerHTML = `
    <div class="login-wrap" style="text-align:center">
<img src="${getSettings().logoDataUrl || ""}" alt="logo" style="max-width:200px;height:auto;border-radius:6px;margin-bottom:14px"/>
      <h2>Create Account</h2>
      <div class="field"><label>Username<input id="r_u" class="input"/></label></div>
      <div class="field"><label>Password<input id="r_p" type="password" class="input"/></label></div>
      <div class="field"><label>Role<select id="r_role" class="input"><option value="cashier">Cashier</option><option value="admin">Admin</option></select></label></div>
      <div class="field"><label>Email<input id="r_email" class="input"/></label></div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <button id="createBtn" class="btn primary">Create</button>
        <button id="backBtn" class="btn ghost">Back</button>
      </div>
      <div style="margin-top:14px"></div><p class="badge" style="margin-top:8px">Accounts stored locally for offline use.</p>
    </div>
  `;
  document.getElementById('createBtn').addEventListener('click', ()=>{
    const u = document.getElementById('r_u').value.trim();
    const p = document.getElementById('r_p').value;
    const role = document.getElementById('r_role').value;
    const email = document.getElementById('r_email').value.trim();
    if(!u||!p) return alert('Username and password required');
    if(db.users.find(x=>x.username===u)) return alert('Username exists');
    const users = db.users; users.unshift({username:u, password:p, role, email}); db.users = users;
    alert('Account created. You can login now.'); renderLogin();
  });
  (function(){var _el=document.getElementById('backBtn'); if(_el) _el.addEventListener('click', renderLogin);})();
}

function renderForgotPassword(){
  // Simulated offline flow: user provides email -> token generated and shown -> user uses token to reset
  app.innerHTML = `
    <div class="login-wrap" style="text-align:center">
<img src="${getSettings().logoDataUrl || ""}" alt="logo" style="max-width:200px;height:auto;border-radius:6px;margin-bottom:14px"/>
      <h2>Reset password (offline)</h2>
      <div class="field"><label>Email<input id="fp_email" class="input" placeholder="Enter account email"/></label></div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <button id="sendReset" class="btn primary">Generate reset token</button>
        <button id="backBtn" class="btn ghost">Back</button>
      </div>
      <div style="margin-top:14px"></div><p class="badge" style="margin-top:8px">A reset token will be generated here (offline). Use it to set a new password.</p>
    </div>
  `;
  document.getElementById('sendReset').addEventListener('click', ()=>{
    const email = document.getElementById('fp_email').value.trim();
    if(!email) return alert('Enter email');
    const user = db.users.find(u=>u.email===email);
    if(!user) return alert('No account with this email in local data');
    const token = Math.random().toString(36).slice(2,9).toUpperCase();
    const reset = db.reset; reset[token] = { username:user.username, expires: Date.now()+ (1000*60*60) }; db.reset = reset;
    alert(`Reset token (offline): ${token}\nUse 'Use reset token' screen to set a new password.`);
    renderResetWithToken(token);
  });
  (function(){var _el=document.getElementById('backBtn'); if(_el) _el.addEventListener('click', renderLogin);})();
}

function renderResetWithToken(prefillToken=''){
  app.innerHTML = `
    <div class="login-wrap" style="text-align:center">
<img src="${getSettings().logoDataUrl || ""}" alt="logo" style="max-width:200px;height:auto;border-radius:6px;margin-bottom:14px"/>
      <h2>Use reset token</h2>
      <div class="field"><label>Token<input id="rt_token" class="input" value="${prefillToken}"/></label></div>
      <div class="field"><label>New Password<input id="rt_pw" type="password" class="input"/></label></div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <button id="doReset" class="btn primary">Reset password</button>
        <button id="backBtn" class="btn ghost">Back</button>
      </div>
    </div>
  `;
  document.getElementById('doReset').addEventListener('click', ()=>{
    const token = document.getElementById('rt_token').value.trim();
    const pw = document.getElementById('rt_pw').value;
    const reset = db.reset;
    if(!reset[token]) return alert('Invalid token');
    if(reset[token].expires < Date.now()) return alert('Token expired');
    const username = reset[token].username;
    const users = db.users;
    const u = users.find(x=>x.username===username);
    if(!u) return alert('User not found');
    u.password = pw; db.users = users;
    delete reset[token]; db.reset = reset;
    alert('Password reset. You can login now.');
    renderLogin();
  });
  (function(){var _el=document.getElementById('backBtn'); if(_el) _el.addEventListener('click', renderLogin);})();
}

// NAV & UI
function show(section){
  const routes = {
    'dashboard': renderDashboard,
    'invoice': renderInvoice,
    'inventory': renderInventory,
    'sales': renderSales,
    'purchases': renderPurchases,
    'customers': renderCustomers,
    'reports': renderReports,
    'quotation': renderQuotation,
    'settings': renderSettings,
  };
  (routes[section]||renderDashboard)();
}

function layoutAfterLogin(){
  layout();
  show('dashboard'); document.querySelectorAll('.nav-btn').forEach(btn=>{btn.classList.toggle('active', btn.dataset.section==='dashboard');});
}

// Dashboard (top 5 fast moving, pie for today, low stock box separate)
function renderDashboard(){
  const inv = db.inv, sales = db.sales;
  const today = (()=>{const d=new Date(); d.setHours(0,0,0,0); return d;})();
  const wk = (()=>{const d=new Date(); const day=(d.getDay()+6)%7; d.setHours(0,0,0,0); d.setDate(d.getDate()-day); return d;})();
  const mo = (()=>{const d=new Date(); d.setDate(1); d.setHours(0,0,0,0); return d;})();

  const todays = sales.filter(s=> new Date(s.date) >= today);
  const weekSales = sales.filter(s=> new Date(s.date) >= wk);
  const monthSales = sales.filter(s=> new Date(s.date) >= mo);

  const sum = arr => arr.reduce((a,b)=>a+b.total,0);
  const sumCost = arr => arr.reduce((a,b)=>a+b.costTotal,0);

  const tGross = sum(todays), tCost=sumCost(todays), tProfit=tGross-tCost;
  const wGross = sum(weekSales), wCost=sumCost(weekSales), wProfit=wGross-wCost;
  const mGross = sum(monthSales), mCost=sumCost(monthSales), mProfit=mGross-mCost;

  const qtyByItem = {};
  weekSales.forEach(s=> s.items.forEach(l=> qtyByItem[l.name]=(qtyByItem[l.name]||0)+l.qty ));
  const top5 = Object.entries(qtyByItem).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const totByCust = {};
  monthSales.forEach(s=> totByCust[s.customerName]=(totByCust[s.customerName]||0)+s.total );
  const bestCust = Object.entries(totByCust).sort((a,b)=>b[1]-a[1])[0];

  const low = inv.filter(i=> i.qty<=3);

  document.getElementById('content').innerHTML = `
    <div class="main-card">
      <div class="grid cols-4">
        <div class="card kpi"><div class="title">Today's Sales</div><div class="value">${fmtMoney(tGross)}</div></div>
        <div class="card kpi"><div class="title">Today's Cost</div><div class="value">${fmtMoney(tCost)}</div></div>
        <div class="card kpi"><div class="title">Today's Profit</div><div class="value">${fmtMoney(tProfit)}</div></div>
        <div class="card kpi"><div class="title">Fast Moving (7d)</div><div class="value" style="font-size:12px;font-weight:400">${top5.length? top5.map((x,i)=>`${i+1}. ${x[0]}  ${x[1]}`).join('<br/>') : ''}</div></div>
      </div>

      <div class="grid cols-3" style="margin-top:12px">
        <div class="card">
          <h3 style="margin:0 0 8px 0">Today  Sales Mix</h3>
          <div class="chart" id="pieToday"></div>
        </div>
        <div class="card">
          <h3 style="margin:0 0 8px 0">Weekly vs Profit</h3>
          <div class="chart" id="barWeek"></div>
        </div>
        <div class="${low.length? 'card low-box' : 'card'}">
          <h3 style="margin:0 0 8px 0">Low Stock (<= 3)</h3>
          ${ low.length ? `<ul>${low.map(i=>`<li class="low">${i.name}  ${i.qty}</li>`).join('')}</ul>` : '<p>No low stock.</p>' }
        </div>
      </div>

      <div class="grid cols-4" style="margin-top:12px"><div class="card kpi"><div class="title">Weekly Sales</div><div class="value smallval">${fmtMoney(wGross)}</div></div><div class="card kpi"><div class="title">Weekly Profit</div><div class="value smallval">${fmtMoney(wProfit)}</div></div><div class="card kpi"><div class="title">Monthly Sales</div><div class="value smallval">${fmtMoney(mGross)}</div></div><div class="card kpi"><div class="title">Monthly Profit</div><div class="value smallval">${fmtMoney(mProfit)}</div></div></div>
    </div>
  `;

  // pie and bars
  const pieData = {};
  todays.forEach(s=> s.items.forEach(l=> pieData[l.name]=(pieData[l.name]||0)+l.qty ));
  drawPie(document.getElementById('pieToday'), pieData);

  const dayMap = {};
  for(let i=0;i<7;i++){ const d=new Date(startOfWeek()); d.setDate(d.getDate()+i); const key=d.toISOString().slice(0,10); dayMap[key]={sales:0,cost:0,label:d.toLocaleDateString('en-LK',{weekday:'short'})}; }
  weekSales.forEach(s=>{ const key=new Date(s.date).toISOString().slice(0,10); if(dayMap[key]){ dayMap[key].sales+=s.total; dayMap[key].cost+=s.costTotal; } });
  drawBars(document.getElementById('barWeek'), Object.values(dayMap).map(d=>({label:d.label,sales:d.sales,profit:d.sales-d.cost})));
}

function drawPie(el,dataObj){ const entries=Object.entries(dataObj); if(!entries.length){ el.innerHTML='<div style="padding:12px;color:#9aa3b2">No data today.</div>'; return; } const total=entries.reduce((a,[,v])=>a+v,0); let acc=0; const colors=['#ef4444','#2563eb','#ef6666','#3b82f6','#a78bfa','#22d3ee','#f472b6']; const arcs=entries.map(([k,v],i)=>{ const start=(acc/total)*Math.PI*2; acc+=v; const end=(acc/total)*Math.PI*2; const x1=50+45*Math.cos(start), y1=50+45*Math.sin(start); const x2=50+45*Math.cos(end), y2=50+45*Math.sin(end); const large=(end-start)>Math.PI?1:0; const d=`M50,50 L${x1},${y1} A45,45 0 ${large} 1 ${x2},${y2} Z`; return `<path d="${d}" fill="${colors[i%colors.length]}" opacity="0.95"><title>${k}: ${v}</title></path>`; }).join(''); el.innerHTML=``; }
function drawBars(el,arr){ if(!arr.length){ el.innerHTML='<div style="padding:12px;color:#9aa3b2">No data.</div>'; return; } const max=Math.max(...arr.flatMap(d=>[d.sales,d.profit,1])); const bw=100/(arr.length*2+1); let x=bw; const bars=arr.map((d,i)=>{ const hs=(d.sales/max)*80, hp=(d.profit/max)*80; const yS=90-hs, yP=90-hp; const xs=x, xp=x+bw; const labelX=x; x+=bw*2; return `<rect x="${xs}" y="${yS}" width="${bw-2}" height="${hs}" fill="#60a5fa"><title>${d.label} Sales: ${d.sales}</title></rect><rect x="${xp}" y="${yP}" width="${bw-2}" height="${hp}" fill="#34d399"><title>${d.label} Profit: ${d.profit}</title></rect><text x="${labelX+bw/2}" y="98" font-size="3" text-anchor="middle" fill="#cbd5e1">${d.label}</text>`}).join(''); el.innerHTML=``; }

// Inventory, Purchases, Customers, Sales (simplified UI)

function renderInventory(){
  const inv=db.inv;
  content.innerHTML=`
    <div class="card">
      <h2>Add Product</h2>
      <div class="form-row">
        <div class="field"><label>Category <input id="inv_category" class="input" placeholder="e.g., Books"></label></div>
        <div class="field"><label>Item Name <input id="inv_name" class="input"></label></div>
        <div class="field"><label>SKU No. <input id="inv_sku" class="input"></label></div>
      </div>
      <div class="form-row">
        <div class="field"><label>MRP <input id="inv_mrp" class="input" type="number"></label></div>
        <div class="field"><label>Discount <input id="inv_discount" class="input" type="number" value="0"></label></div>
        <div class="field"><label>Unit Price <input id="inv_price" class="input" type="number"></label></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Cost Price <input id="inv_cost" class="input" type="number"></label></div>
        <div class="field"><label>Available Stock <input id="inv_qty" class="input" type="number"></label></div>
      </div>
      <div class="form-row button-row">
        <button class="btn primary" id="inv_add">Add Item</button>
        <button class="btn" id="inv_export_all">Export All Inventory</button>
        <input type="file" id="inv_import_file" accept=".csv" style="display:none" />
        <button class="btn" id="inv_import_btn">Import Products (CSV)</button>
      </div>
    </div>

    <div class="card" style="margin-top:15px">
      <h2>Search Inventory</h2>
      <div class="form-row" style="margin-top:8px; align-items:center">
        <div class="field" style="min-width:260px">
          <label>Search (Category / Item / SKU)
            <input id="inv_search" class="input" placeholder="Type to search..." />
          </label>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <button class="btn primary" id="inv_search_btn">Search / View</button>
          <button class="btn" id="inv_clear_btn">Clear</button>
        </div>
      </div>
      <div style="margin-top:8px">
        <button class="btn" id="inv_export_excel">Export to Excel</button>
        <button class="btn" id="inv_export_pdf">Export to PDF</button>
      </div>
      <div id="inv_table" style="margin-top:10px"></div>
    </div>
    `;

  const tbl=document.getElementById('inv_table'); 
  tbl.innerHTML = '<p>Enter a search term above and click Search to view products.</p>';

  const btn = document.getElementById('inv_search_btn');
  const btnClear = document.getElementById('inv_clear_btn');
  const btnExcel = document.getElementById('inv_export_excel');
  const btnPDF = document.getElementById('inv_export_pdf');
  const btnExportAll = document.getElementById('inv_export_all');
  const btnImport = document.getElementById('inv_import_btn');
  const fileInput = document.getElementById('inv_import_file');
  const input = document.getElementById('inv_search');
// --- Autocomplete dropdown: created dynamically so no HTML changes needed ---
(function() {
  try {
    const parent = input && input.parentElement;
    if (!parent) return;

    // Make parent relatively positioned to anchor the dropdown
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    // Create suggestions container if not present
    let suggestions = document.getElementById('search_suggestions');
    if (!suggestions) {
      suggestions = document.createElement('div');
      suggestions.id = 'search_suggestions';
      suggestions.className = 'suggestions';
      suggestions.style.minWidth = (input.offsetWidth || 200) + 'px';
      parent.appendChild(suggestions);
    }

    // Live search: update results as you type
    input.addEventListener('input', () => {
      const q = (input.value || '').trim().toLowerCase();
      if (!q) {
        suggestions.style.display = 'none';
        doSearch(); // show all or clear list
        return;
      }
      const matches = (Array.isArray(inv) ? inv : []).filter(it =>
        (it.name && String(it.name).toLowerCase().includes(q)) ||
        (it.sku && String(it.sku).toLowerCase().includes(q)) ||
        (it.category && String(it.category).toLowerCase().includes(q))
      ).slice(0, 10);

      // Build suggestion items
      suggestions.innerHTML = '';
      matches.forEach(it => {
        const row = document.createElement('div');
        row.className = 'suggestion-item';
        const skuText = it.sku ? ` (${it.sku})` : '';
        row.textContent = `${it.name || ''}`.trim();
        row.addEventListener('mousedown', (e) => {
          // mousedown so it fires before blur hides the list
          e.preventDefault();
          input.value = it.name || it.sku || '';
          suggestions.style.display = 'none';
          doSearch();
        });
        suggestions.appendChild(row);
      });
      suggestions.style.display = matches.length ? 'block' : 'none';
    });

    // Hide on blur/click outside
    document.addEventListener('click', (ev) => {
      if (!suggestions.contains(ev.target) && ev.target !== input) {
        suggestions.style.display = 'none';
      }
    });
    input.addEventListener('blur', () => {
      setTimeout(() => { suggestions.style.display = 'none'; }, 120);
    });
    // Allow Escape to close
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        suggestions.style.display = 'none';
        input.blur();
      }
    });
  } catch (e) {
    console.error('Autocomplete init failed:', e);
  }

  // Original add item function
  function addInventoryItem() {
    const category = document.getElementById('inv_category').value.trim();
    const name = document.getElementById('inv_name').value.trim();
    const sku = document.getElementById('inv_sku').value.trim();
    const mrp = parseFloat(document.getElementById('inv_mrp').value) || 0;
    const discount = parseFloat(document.getElementById('inv_discount').value) || 0;
    const price = parseFloat(document.getElementById('inv_price').value) || (mrp - discount);
    const cost = parseFloat(document.getElementById('inv_cost').value) || 0;
    const qty = parseInt(document.getElementById('inv_qty').value) || 0;

    if (!name || !sku) {
      alert("?? Item Name and SKU are required.");
      return;
    }

    const invList = db.inv;
    const existing = invList.find(p => p.sku === sku);
    
    if(existing){
      // Update existing item quantity instead of creating duplicate
      existing.qty += qty;
      existing.mrp = mrp || existing.mrp;
      existing.discount = discount || existing.discount;
      existing.price = price || existing.price;
      existing.cost = cost || existing.cost;
      existing.category = category || existing.category;
    } else {
      // Add new item
      const item = { id: uid(), category, name, sku, mrp, discount, price, cost, qty };
      invList.unshift(item);
    }
    
    db.inv = invList;
    alert("? Product added to inventory!");

    // Clear form
    document.getElementById('inv_category').value = '';
    document.getElementById('inv_name').value = '';
    document.getElementById('inv_sku').value = '';
    document.getElementById('inv_mrp').value = '';
    document.getElementById('inv_discount').value = '0';
    document.getElementById('inv_price').value = '';
    document.getElementById('inv_cost').value = '';
    document.getElementById('inv_qty').value = '';
  }

  // Set the original add function to the button
  document.getElementById('inv_add').onclick = addInventoryItem;

})();


  let lastResults = [];

  function doSearch(){
    const q = (input.value||'').toLowerCase().trim();
    if(!q){ tbl.innerHTML='<p>Enter a search term to view products.</p>'; lastResults=[]; return; }
    const list = inv.filter(i =>
      (i.category||'').toLowerCase().includes(q) ||
      (i.name||'').toLowerCase().includes(q) ||
      (i.sku||'').toLowerCase().includes(q)
    );
    lastResults = list;
    if(list.length===0){ tbl.innerHTML='<p>No matching inventory.</p>'; return; }
    tbl.innerHTML = `
      <table class="table" id="inv_results_table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Item Name</th>
            <th>SKU No.</th>
            <th>MRP</th>
            <th>Discount</th>
            <th>Unit Price</th>
            <th>Cost Price</th>
            <th>Total Cost Price</th>
            <th>Available Stock</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(i => `
            <tr>
              <td>${i.category || ''}</td>
              <td>${i.name || ''}</td>
              <td>${i.sku || ''}</td>
              <td>${fmtMoney(i.mrp || 0)}</td>
              <td>${fmtMoney(i.discount || 0)}</td>
              <td>${fmtMoney(i.price || 0)}</td>
              <td>${fmtMoney(i.cost || 0)}</td>
              <td>${fmtMoney((i.cost || 0) * (i.qty || 0))}</td>
              <td>${i.qty || 0}</td>
<td>
  <div class="action-icons">
    <div class="action-icons"><button class="icon-btn edit" onclick="editInventoryItem('${i.id}')" title="Edit"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<path fill="white" d="M362.7 19.3c25-25 65.5-25 
90.5 0l39.5 39.5c25 25 25 65.5 
0 90.5L233.4 408.6c-6.1 
6.1-13.6 10.7-21.9 
13.4l-85.2 28.4c-11.6 
3.9-24.4 .8-33-7.8s-11.7-21.4-7.8-33l28.4-85.2c2.7-8.3 
7.3-15.8 13.4-21.9L362.7 19.3z"/>
</svg></button>
    <button class="icon-btn delete" onclick="deleteInventoryItem('${i.id}')" title="Delete"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
<path fill="white" d="M135.2 17.7C140.6 7.3 
151.7 0 163.7 0H284.3c12 
0 23.1 7.3 28.5 
17.7L320 32h96c17.7 
0 32 14.3 32 32s-14.3 
32-32 32H32C14.3 96 0 
81.7 0 64s14.3-32 32-32h96l7.2-14.3zM53.2 
467c1.6 25.3 22.6 45 47.9 
45H346.9c25.3 0 46.3-19.7 
47.9-45L416 128H32l21.2 
339z"/>
</svg></button></div>
  </div>
</td>


            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }

  function exportToExcel(){
    if(lastResults.length===0){ alert('No data to export'); return; }
    let csv = 'Category,Item Name,SKU No.,MRP,Discount,Unit Price,Cost Price,Total Cost Price,Available Stock\n';
    lastResults.forEach(i=>{
      csv += `"${i.category||''}","${i.name||''}","${i.sku||''}",${i.mrp||0},${i.discount||0},${i.price||0},${i.cost||0},${(i.cost||0)*(i.qty||0)},${i.qty||0}\n`;
    });
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportAll(){
    if(inv.length===0){ alert('No inventory to export'); return; }
    let csv = 'Category,Item Name,SKU No.,MRP,Discount,Unit Price,Cost Price,Available Stock\n';
    inv.forEach(i=>{
      csv += `"${i.category||''}","${i.name||''}","${i.sku||''}",${i.mrp||0},${i.discount||0},${i.price||0},${i.cost||0},${i.qty||0}\n`;
    });
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_full_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importCSV(file){
    const reader = new FileReader();
    reader.onload = function(e){
      const text = e.target.result;
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      let invList = db.inv;
      
      for(let i = 1; i < lines.length; i++){
        const parts = lines[i].split(',');
        if(parts.length < 8) continue;
        
        const sku = parts[2].replace(/"/g, '').trim();
        const name = parts[1].replace(/"/g, '').trim();
        const category = parts[0].replace(/"/g, '').trim();
        const mrp = parseFloat(parts[3]) || 0;
        const discount = parseFloat(parts[4]) || 0;
        const price = parseFloat(parts[5]) || 0;
        const cost = parseFloat(parts[6]) || 0;
        const qty = parseInt(parts[7]) || 0;

        const existing = invList.find(p => p.sku === sku);
        
        if(existing){
          // Update existing item
          existing.qty += qty;
          existing.mrp = mrp || existing.mrp;
          existing.discount = discount || existing.discount;
          existing.price = price || existing.price;
          existing.cost = cost || existing.cost;
          existing.category = category || existing.category;
        } else {
          // Add new item
          const item = {
            id: uid(),
            category: category,
            name: name,
            sku: sku,
            mrp: mrp,
            discount: discount,
            price: price,
            cost: cost,
            qty: qty
          };
          invList.push(item);
        }
      }
      
      db.inv = invList;
      try { localStorage.setItem('inventory', JSON.stringify(invList)); } catch(e) {}

      alert('? Products imported successfully!');
      show('inventory'); // Refresh the inventory view
    };
    reader.readAsText(file);
  }

  function exportToPDF(){
    if(lastResults.length===0){ alert('No data to export'); return; }
    let win = window.open('', '', 'height=700,width=900');
    win.document.write('<html><head><title>Inventory Export</title></head><body>');
    win.document.write('<h2>Inventory Export</h2>');
    win.document.write('<table border="1" style="border-collapse:collapse;width:100%"><tr><th>Category</th><th>Item Name</th><th>SKU No.</th><th>MRP</th><th>Discount</th><th>Unit Price</th><th>Cost Price</th><th>Total Cost Price</th><th>Available Stock</th><th>Actions</th></tr>');
    lastResults.forEach(i=>{
      win.document.write('<tr>');
      win.document.write('<td>'+ (i.category||'') +'</td>');
      win.document.write('<td>'+ (i.name||'') +'</td>');
      win.document.write('<td>'+ (i.sku||'') +'</td>');
      win.document.write('<td>'+ fmtMoney(i.mrp||0) +'</td>');
      win.document.write('<td>'+ fmtMoney(i.discount||0) +'</td>');
      win.document.write('<td>'+ fmtMoney(i.price||0) +'</td>');
      win.document.write('<td>'+ fmtMoney(i.cost||0) +'</td>');
      win.document.write('<td>'+ fmtMoney((i.cost||0)*(i.qty||0)) +'</td>');
      win.document.write('<td>'+ (i.qty||0) +'</td>');
      win.document.write('</tr>');
    });
    win.document.write('</table></body></html>');
    win.document.close();
    win.print();
  }

  if(btn) btn.addEventListener('click', doSearch);
  if(input) input.addEventListener('keydown', ev=>{ if(ev.key==='Enter'){ ev.preventDefault(); doSearch(); } });
  if(btnClear) btnClear.addEventListener('click', ()=>{ input.value=''; tbl.innerHTML='<p>Enter a search term above and click Search to view products.</p>'; lastResults=[]; });
  if(btnExcel) btnExcel.addEventListener('click', exportToExcel);
  if(btnPDF) btnPDF.addEventListener('click', exportToPDF);
  if(btnExportAll) btnExportAll.addEventListener('click', exportAll);
  if(btnImport) btnImport.addEventListener('click', ()=> fileInput.click());
  if(fileInput) fileInput.addEventListener('change', ev=>{ if(ev.target.files.length>0) importCSV(ev.target.files[0]); });
}


// === FIXED + ENHANCED PURCHASE ORDER MANAGEMENT (Multi-item + Search) ===
function renderPurchases(){
  const content = document.getElementById('content');
  const inv = (typeof db !== 'undefined' && db.inv) ? db.inv : [];
  const STORAGE_KEY = 'po_orders_v2';
  const LEGACY_KEYS = ['agx_purchase_orders_v1','po_orders_v1','po_orders'];
  let poItems = [];
  let editingId = null; // track current PO being edited


  function loadAllPOs(){
    // Migrate legacy if exists
    for(const key of LEGACY_KEYS){
      const raw = localStorage.getItem(key);
      if(raw){
        try{
          const arr = JSON.parse(raw);
          if(Array.isArray(arr) && arr.length){
            const mapped = arr.map(x => {
              // Attempt to map legacy flat row into new structure
              return {
                id: x.id || Date.now()+Math.random(),
                poNo: x.poNo || x.po_no || x.PONo || '',
                date: x.date || x.po_date || x.Date || '',
                supplier: x.supplier || x.Supplier || x.po_supplier || '',
                phone: x.phone || x.contact || x.po_contact || '',
                email: x.email || x.po_email || '',
                whatsapp: x.whatsapp || x.po_whatsapp || '',
                location: x.location || x.po_location || '',
                items: x.items && Array.isArray(x.items) ? x.items : (x.product ? [{
                  category: x.category || '',
                  product: x.product || x.p_name || '',
                  cost: Number(x.cost || x.p_cost || 0),
                  qty: Number(x.qty || x.quantity || 1),
                  total: Number(x.total || 0)
                }] : [])
              };
            });
            const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.concat(mapped)));
            localStorage.removeItem(key);
          }
        }catch(e){ /* ignore */ }
      }
    }
    try{
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    }catch(e){ return []; }
  }

  function saveAllPOs(list){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list||[]));
  }

  function saveCurrentPO(){
    const poNo = document.getElementById('po_no').value.trim() || ('PO-' + new Date().getTime());
    const data = {
      id: Date.now()+Math.random(),
      poNo,
      date: (document.getElementById('po_date').value || new Date().toISOString().slice(0,10)),
      supplier: document.getElementById('po_supplier').value.trim(),
      location: document.getElementById('po_location').value.trim(),
      phone: document.getElementById('po_contact').value.trim(),
      email: document.getElementById('po_email').value.trim(),
      whatsapp: document.getElementById('po_whatsapp').value.trim(),
      items: poItems.slice()
    };
    if(!data.items.length){ alert('Add at least one item to the PO.'); return; }
    
const all = loadAllPOs();
if(editingId){
  // Update existing record
  const idx = all.findIndex(x => x.id === editingId);
  if(idx !== -1){
    data.id = editingId; // preserve id
    all[idx] = data;
  } else {
    all.push(data);
  }
  saveAllPOs(all);
  alert('Purchase Order updated: ' + data.poNo);
} else {
  all.push(data);
  saveAllPOs(all);
  alert('Purchase Order saved: ' + data.poNo);
}
// Reset items table and totals
poItems = [];
renderItems();
// Reset editing state and button label
editingId = null;
const saveBtn = document.getElementById('po_save');
if(saveBtn) saveBtn.textContent = 'Save Purchase Order';
// Optionally clear PO No so next save can auto-generate unless user keeps it
document.getElementById('po_no').value = '';
}

  const categories = [...new Set(inv.map(i => i.category).filter(Boolean))];

  content.innerHTML = `
    <div class="card">
      <h3>Purchase Order Management</h3>
      <div class="form-row">
        <div class="field"><label>PO No.<input id="po_no" class="input" placeholder="Auto/Manual"></label></div>
        <div class="field"><label>Date<input id="po_date" type="date" class="input"></label></div>
        <div class="field"><label>Supplier Name<input id="po_supplier" class="input" placeholder="Supplier"></label></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Location<input id="po_location" class="input" placeholder="Warehouse/Store"></label></div>
        <div class="field"><label>Contact No<input id="po_contact" class="input" placeholder="07X-XXXXXXX"></label></div>
        <div class="field"><label>Email<input id="po_email" class="input" placeholder="supplier@email.com"></label></div>
      </div>
      <div class="form-row">
        <div class="field"><label>WhatsApp<input id="po_whatsapp" class="input" placeholder="+94..."></label></div>
        <div class="field">
          <label>Product Category
            <select id="po_category" class="input">
              <option value="">-- Select Category --</option>
              ${categories.map(c=>`<option value="${c}">${c}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="field">
          <label>Product Name
            <select id="po_product" class="input">
              <option value="">-- Select Product --</option>
            </select>
          </label>
        </div>
      </div>
      <div class="form-row">
        <div class="field"><label>Product Cost<input id="po_cost" type="number" class="input" step="0.01"></label></div>
        <div class="field"><label>Qty<input id="po_qty" type="number" class="input" step="1" value="1"></label></div>
        <div class="field"><label>Total<input id="po_total" class="input" readonly></label></div>
      </div>
      <div class="form-row button-row">
        <button class="btn primary" id="po_add">Add Item</button>
        <button class="btn" id="po_save">Save Purchase Order</button>
        <button class="btn ghost" id="po_clear">Clear</button>
      </div>
      <div id="po_items" style="margin-top:12px"></div>
    </div>

    <div class="card">
      <h3>Purchase Order Search</h3>
      <div class="form-row">
        <div class="field"><label>PO No.<input id="s_po_no" class="input" placeholder="PO-..."></label></div>
        <div class="field"><label>Supplier<input id="s_supplier" class="input" placeholder="Supplier name"></label></div>
        <div class="field"><label>Phone<input id="s_phone" class="input" placeholder="07X-XXXXXXX"></label></div>
      </div>
      <div class="form-row">
        <div class="field"><label>From<input id="s_from" type="date" class="input"></label></div>
        <div class="field"><label>To<input id="s_to" type="date" class="input"></label></div>
        <div class="field" style="display:flex;gap:8px;align-items:end;">
          <button id="s_search" class="btn primary">Search</button>
          <button id="s_reset" class="btn ghost">Reset</button>
        </div>
      </div>
      <div id="s_results" style="display:none"></div>
    </div>
  `;

  // --- Element refs
  const categorySelect = document.getElementById('po_category');
  const productSelect = document.getElementById('po_product');
  const costInput=document.getElementById('po_cost'),
        qtyInput=document.getElementById('po_qty'),
        totalInput=document.getElementById('po_total');
  const itemsDiv = document.getElementById('po_items');

  // Populate products on category change
  categorySelect.addEventListener('change', ()=>{
    const products = inv.filter(i=>i.category===categorySelect.value);
    productSelect.innerHTML = `<option value="">-- Select Product --</option>` +
      products.map(p=>`<option value="${p.name}" data-cost="${p.cost||p.price||0}">${p.name}</option>`).join('');
  });

  // Auto-fill cost
  productSelect.addEventListener('change', ()=>{
    const opt = productSelect.options[productSelect.selectedIndex];
    costInput.value = (opt && opt.dataset.cost) ? opt.dataset.cost : '';
    recalc();
  });

  function recalc(){
    const c=Number(costInput.value||0), q=Number(qtyInput.value||0);
    totalInput.value=(c*q).toFixed(2);
  }
  costInput.addEventListener('input',recalc);
  qtyInput.addEventListener('input',recalc);

  // Add item
  document.getElementById('po_add').addEventListener('click', ()=>{
    const item = {
      category: categorySelect.value,
      product: productSelect.value,
      cost: Number(costInput.value||0),
      qty: Number(qtyInput.value||0) || 1,
      total: Number((Number(costInput.value||0) * (Number(qtyInput.value||0)||1)).toFixed(2))
    };
    if(!item.category || !item.product){ alert('Select category and product.'); return; }
    poItems.push(item);
    // reset qty only
    qtyInput.value = '1';
    recalc();
    renderItems();
  });

  (function(){var _el=document.getElementById('po_save'); if(_el) _el.addEventListener('click', saveCurrentPO);})();
  document.getElementById('po_clear').addEventListener('click', ()=>{
    poItems = [];
    renderItems();
  });

  function renderItems(){
    if(!poItems.length){ itemsDiv.innerHTML = '<p class="small" style="opacity:.8">No items added yet.</p>'; return; }
    const rows = poItems.map((i,idx)=>`
      <tr>
        <td>${i.category}</td>
        <td>${i.product}</td>
        <td>${i.cost.toFixed ? i.cost.toFixed(2) : i.cost}</td>
        <td>${i.qty}</td>
        <td>${i.total.toFixed ? i.total.toFixed(2) : i.total}</td>
        <td><button class="btn danger" data-rm="${idx}">Remove</button></td>
      </tr>
    `).join('');
    const grand = poItems.reduce((a,b)=>a+Number(b.total||0),0);
    itemsDiv.innerHTML = `
      <table class="table">
        <thead><tr><th>Category</th><th>Product</th><th>Cost</th><th>Qty</th><th>Total</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="4" style="text-align:right"><b>Grand Total</b></td><td><b>${grand.toFixed(2)}</b></td><td></td></tr></tfoot>
      </table>
    `;
    itemsDiv.querySelectorAll('button[data-rm]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const i = Number(e.currentTarget.getAttribute('data-rm'));
        poItems.splice(i,1);
        renderItems();
      });
    });
  }

  // --- Search
  function matchFilters(po, f){
    if(f.po_no && !String(po.poNo||'').toLowerCase().includes(f.po_no)) return false;
    if(f.supplier && !String(po.supplier||'').toLowerCase().includes(f.supplier)) return false;
    if(f.phone && !String(po.phone||'').toLowerCase().includes(f.phone)) return false;
    if(f.from || f.to){
      const d = new Date(po.date||'1970-01-01').getTime();
      if(f.from && d < new Date(f.from).getTime()) return false;
      if(f.to && d > new Date(f.to).getTime()) return false;
    }
    return true;
  }

  function renderSearch(){
    const resBox = document.getElementById('s_results');
    const list = loadAllPOs();
    if(!list.length){
      resBox.innerHTML = '<p class="small" style="opacity:.8">No purchase orders saved yet.</p>';
      return;
    }
    // default empty results until search pressed? We'll show all for convenience
    drawResults(list);
  }

  function drawResults(rows){
    const resBox = document.getElementById('s_results');
    if(!rows.length){ resBox.innerHTML = '<p class="small" style="opacity:.8">No results.</p>'; return; }
    const html = `
      <table class="table">
        <thead>
          <tr><th>PO No</th><th>Date</th><th>Supplier</th><th>Phone</th><th>Items</th><th>Total</th><th>Action</th></tr>
        </thead>
        <tbody>
          ${rows.map((o,idx)=>{
            const total = (o.items||[]).reduce((a,b)=>a+Number(b.total||0),0);
            return `
              <tr>
                <td>${o.poNo||''}</td>
                <td>${o.date||''}</td>
                <td>${o.supplier||''}</td>
                <td>${o.phone||''}</td>
                <td>${(o.items||[]).length}</td>
                <td>${total.toFixed(2)}</td>
                <td>
                  <button class="action-btn view" data-view="${idx}" title="View Items"><i class="fa-solid fa-eye"></i></button>
                  <button class="action-btn edit" data-edit="${idx}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                  <button class="action-btn delete" data-del="${idx}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <div id="po_modal" class="calc-modal" style="display:none; width:420px; max-height:70vh; overflow:auto">
        <div class="calc-display" style="text-align:left">PO Items</div>
        <div id="po_modal_body"></div>
        <div style="text-align:right; margin-top:8px"><button id="po_modal_close" class="btn">Close</button></div>
      </div>
    `;
    resBox.innerHTML = html;

    const data = loadAllPOs();
    resBox.querySelectorAll('button[data-view]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const i = Number(e.currentTarget.getAttribute('data-view'));
        const o = rows[i];
        const body = resBox.querySelector('#po_modal_body');
        const items = (o.items||[]).map(it=>`
          <tr>
            <td>${it.category||''}</td>
            <td>${it.product||''}</td>
            <td>${Number(it.cost||0).toFixed(2)}</td>
            <td>${Number(it.qty||0)}</td>
            <td>${Number(it.total||0).toFixed(2)}</td>
          </tr>
        `).join('');
        const total = (o.items||[]).reduce((a,b)=>a+Number(b.total||0),0);
        body.innerHTML = `
          <div class="small"><b>PO:</b> ${o.poNo||''} &nbsp; <b>Date:</b> ${o.date||''} &nbsp; <b>Supplier:</b> ${o.supplier||''}</div>
          <table class="table" style="margin-top:8px">
            <thead><tr><th>Category</th><th>Product</th><th>Cost</th><th>Qty</th><th>Total</th></tr></thead>
            <tbody>${items}</tbody>
            <tfoot><tr><td colspan="4" style="text-align:right"><b>Grand</b></td><td><b>${total.toFixed(2)}</b></td></tr></tfoot>
          </table>
        `;
        const modal = resBox.querySelector('#po_modal');
        modal.style.display = 'block';
        resBox.querySelector('#po_modal_close').onclick = ()=>{ modal.style.display='none'; };
      });
    });

    
    // Wire up edit buttons (load PO into the top form for editing)
    resBox.querySelectorAll('button[data-edit]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const i = Number(e.currentTarget.getAttribute('data-edit'));
        const o = rows[i];
        // Set editing mode
        editingId = o.id;
        // Fill form fields
        const set = (id,val)=>{ const el = document.getElementById(id); if(el) el.value = val||''; };
        set('po_no', o.poNo);
        set('po_date', o.date);
        set('po_supplier', o.supplier);
        set('po_location', o.location);
        set('po_contact', o.phone);
        set('po_email', o.email);
        set('po_whatsapp', o.whatsapp);
        // Load items
        poItems = (o.items||[]).map(it=>({ ...it }));
        // Re-render items table
        try { renderItems(); } catch(e){ console.warn('renderItems failed', e); }
        // Update save button label to indicate update
        const saveBtn = document.getElementById('po_save');
        if(saveBtn) saveBtn.textContent = 'Update Purchase Order';
        // Scroll to the top where the form is
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(_) { window.scrollTo(0,0); }
      });
    });
    resBox.querySelectorAll('button[data-del]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const i = Number(e.currentTarget.getAttribute('data-del'));
        const target = rows[i];
        if(!confirm('Delete PO ' + (target.poNo||'') + '?')) return;
        const all = loadAllPOs().filter(o => o.id !== target.id);
        saveAllPOs(all);
        // Refresh current filter
        document.getElementById('s_search').click();
      });
    });
  }

  // Wire search buttons
  document.getElementById('s_search').addEventListener('click', ()=>{
  const resultsDiv = document.getElementById('s_results');
  resultsDiv.style.display = 'block';
    const f = {
      po_no: document.getElementById('s_po_no').value.trim().toLowerCase(),
      supplier: document.getElementById('s_supplier').value.trim().toLowerCase(),
      phone: document.getElementById('s_phone').value.trim().toLowerCase(),
      from: document.getElementById('s_from').value,
      to: document.getElementById('s_to').value
    };
    const all = loadAllPOs().filter(o=>matchFilters(o,f));
    drawResults(all);
  });
  document.getElementById('s_reset').addEventListener('click', ()=>{
  document.getElementById('s_po_no').value = '';
  document.getElementById('s_supplier').value = '';
  document.getElementById('s_phone').value = '';
  document.getElementById('s_from').value = '';
  document.getElementById('s_to').value = '';
  const resultsDiv = document.getElementById('s_results');
  resultsDiv.innerHTML = '';
  resultsDiv.style.display = 'none';
});

  // Initial renders
  renderItems();
  renderSearch();
}



function renderCustomers(){ const canEdit=currentUser?.role==='admin'; const cust=db.cust; document.getElementById('content').innerHTML=`<div class="card"><h3>Customer Management</h3><div class="form-row"><div class="field"><label>Name<input id="cu_name" class="input"/></label></div><div class="field"><label>Phone<input id="cu_phone" class="input"/></label></div><div class="field"><label>Email<input id="cu_email" class="input"/></label></div><div><button class="btn primary" style="height:40px;display:flex;align-items:center;justify-content:center" id="cu_add">Add Customer</button></div></div><div id="cu_list" style="margin-top:10px"></div></div>`; document.getElementById('cu_add').addEventListener('click', ()=>{ if(currentUser?.role!=='admin') return alert('Admin only'); const name=val('cu_name'); if(!name) return alert('Name required'); const c={id:uid(),name,phone:val('cu_phone'),email:val('cu_email')}; const list=db.cust; list.unshift(c); db.cust=list; renderCustomers(); }); document.getElementById('cu_list').innerHTML= cust.length? `<table class="table"><thead><tr><th>Name</th><th>Phone</th><th>Email</th></tr></thead><tbody>${cust.map(c=>`<tr><td>${c.name}</td><td>${c.phone}</td><td>${c.email}</td></tr>`).join('')}</tbody></table>`: '<p>No customers yet.</p>'; }


function renderSales(){ 
  document.getElementById('content').innerHTML = `
    <div class="card">
      <h3>Sales</h3>
      <div class="form-row">
        <div class="field"><label>Invoice No.<input id="sale_invno" class="input" placeholder="Invoice No."/></label></div>
        <div class="field"><label>Customer Name<input id="sale_cust" class="input" placeholder="Customer Name"/></label></div>
        <div class="field"><label>Phone<input id="sale_phone" class="input" placeholder="Phone"/></label></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Date From<input type="date" id="sale_date_from" class="input"/></label></div>
        <div class="field"><label>Date To<input type="date" id="sale_date_to" class="input"/></label></div>
      </div>
      <div class="form-row button-row">
        <button class="btn primary" id="sale_search_btn">Search</button>
        <button class="btn" id="sale_clear_btn">Clear</button>
      </div>
      <div id="sales_results" style="margin-top:12px"></div>
    </div>
  `;

  const resultsDiv = document.getElementById('sales_results');
  const btnSearch = document.getElementById('sale_search_btn');
  const btnClear = document.getElementById('sale_clear_btn');

  function doSearch(){
    const invNo = document.getElementById('sale_invno').value.trim().toLowerCase();
    const cust = document.getElementById('sale_cust').value.trim().toLowerCase();
    const phone = document.getElementById('sale_phone').value.trim().toLowerCase();
    const dFrom = document.getElementById('sale_date_from').value;
    const dTo = document.getElementById('sale_date_to').value;

    let list = db.sales;

    if(invNo){
      list = list.filter(s => (s.invNo||'').toString().toLowerCase().includes(invNo));
    }
    if(cust){
      list = list.filter(s => (s.customerName||'').toLowerCase().includes(cust));
    }
    if(phone){
      list = list.filter(s => (s.customerPhone||'').toLowerCase().includes(phone));
    }
    if(dFrom){
      const from = new Date(dFrom + "T00:00:00");
      list = list.filter(s => new Date(s.date) >= from);
    }
    if(dTo){
      const to = new Date(dTo + "T23:59:59");
      list = list.filter(s => new Date(s.date) <= to);
    }

    if(!invNo && !cust && !phone && !dFrom && !dTo){
      resultsDiv.innerHTML = "<p>Please enter at least one filter above.</p>";
      return;
    }

    if(list.length===0){
      resultsDiv.innerHTML = "<p>No matching sales found.</p>";
      return;
    }

    resultsDiv.innerHTML = `
      <table class="table">
        <thead>
          <tr><th>Inv #</th><th>Date</th><th>Customer</th><th>Phone</th><th>Total</th><th></th></tr>
        </thead>
        <tbody>
          ${list.map(s => `
            <tr>
              <td>${s.invNo}</td>
              <td>${new Date(s.date).toLocaleString()}</td>
              <td>${s.customerName||''}</td>
              <td>${s.customerPhone||''}</td>
              <td>${fmtMoney(s.total)}</td>
              <td><button class="btn ghost" onclick="viewSale('${s.id}')">Open</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  btnSearch.addEventListener('click', doSearch);
  
  // Trigger search when pressing Enter in any sales filter input
  ['sale_invno','sale_cust','sale_phone','sale_date_from','sale_date_to'].forEach(function(id){
    var el = document.getElementById(id);
    if(el){ el.addEventListener('keydown', function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); doSearch(); } }); }
  });
btnClear.addEventListener('click', ()=>{
    document.getElementById('sale_invno').value='';
    document.getElementById('sale_cust').value='';
    document.getElementById('sale_phone').value='';
    document.getElementById('sale_date_from').value='';
    document.getElementById('sale_date_to').value='';
    resultsDiv.innerHTML='';
  });
}

window.viewSale=function(id){ const s=db.sales.find(x=>x.id===id); if(!s) return alert('Sale not found'); showInvoiceView(s); };

function renderReports(){ const sales=db.sales, inv=db.inv; const totalSales=sales.reduce((a,b)=>a+b.total,0); const totalCost=sales.reduce((a,b)=>a+b.costTotal,0); const profit=totalSales-totalCost; const stockRetail=inv.reduce((a,b)=>a+(b.price*b.qty),0); const stockCost=inv.reduce((a,b)=>a+(b.cost*b.qty),0); document.getElementById('content').innerHTML=`<div class="card"><h3>Reports & Analytics</h3><div class="grid cols-3"><div class="card kpi"><div class="title">Total Sales</div><div class="value">${fmtMoney(totalSales)}</div></div><div class="card kpi"><div class="title">Total Cost</div><div class="value">${fmtMoney(totalCost)}</div></div><div class="card kpi"><div class="title">Profit</div><div class="value">${fmtMoney(profit)}</div></div></div><div class="card" style="margin-top:12px"><h4 style="margin:0 0 8px 0">Stock Valuation</h4><p>Retail: <b>${fmtMoney(stockRetail)}</b> • Cost: <b>${fmtMoney(stockCost)}</b></p></div></div>`; }

// invoice helpers
function peekInvoiceNo(){ const seq=db.seq; return String(seq.invoice||1).padStart(5,'0'); }
function nextInvoiceNo(){ const seq=db.seq; const n=seq.invoice||1; seq.invoice=n+1; db.seq=seq; return String(n).padStart(5,'0'); }

function startOfWeek(){ const d=new Date(); const day=(d.getDay()+6)%7; d.setHours(0,0,0,0); d.setDate(d.getDate()-day); return d; }

// Invoice UI (SKU-only entry, fields blank at start)
function renderInvoice(){
  const inv=db.inv, cust=db.cust;
  const invNoPeek = peekInvoiceNo();
  window._cart = [];
  
  // --- initialize invoice date to today's date (editable for back-dating) ---
  requestAnimationFrame(()=>{var dInput=document.getElementById('inv_date');if(dInput){  var now=new Date();  var local=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);  if(!dInput.value){ dInput.value=local; }  dInput.removeAttribute('readonly');  dInput.removeAttribute('disabled');}});document.getElementById('content').innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><h3 style="margin:0;">Customer Invoice <span class="badge">Inv # ${invNoPeek}</span></h3><div style="display:flex;align-items:center;gap:6px;"><label for="inv_date" style="font-size:12px;">Date</label><input type="datetime-local" id="inv_date" class="input" style="height:32px;padding:4px 8px;border-radius:8px" /></div></div>
      <div class="form-row">
        <div class="field"><label>Customer<select id="c_sel" class="input">${cust.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}<option value="new">+ New customer</option></select></label></div>
        <div class="field"><label>Customer Name (if new)<input id="c_name" class="input" placeholder="Name"/></label></div>
        <div class="field"><label>Mobile (if new)<input id="c_phone" class="input" placeholder="07X"/></label></div>
      </div>

      <div class="form-row" style="margin-top:8px">
        <div class="field"><label>SKU Number<input id="sku_in" class="input" placeholder="Enter or scan SKU" / readonly></label></div>
        <div class="field"><label>Product Name<input id="p_name" class="input" placeholder="Type to search" /></label></div>
        <div class="field"><label>Qty<input id="p_qty" type="number" class="input" value="1" min="1" /></label></div>
      </div>

      <div class="form-row" style="margin-top:6px">
        <div class="field"><label>MRP<input id="p_mrp" class="input currency-lkr" value="0.00" / readonly></label></div>
        <div class="field"><label>Discount<input id="p_disc" class="input currency-lkr" value="0.00" /></label></div>
        <div class="field"><label>Unit Price<input id="p_price" class="input currency-lkr" value="0.00" /></label></div>
      </div>

      <div id="cart_area" style="margin-top:12px"></div>

      <div class="form-row" style="margin-top:12px">
        <div class="field"><label>Notes<input id="notes" class="input" placeholder="Notes (optional)" /></label></div>
        <div class="field"><label>Amount Tendered<input id="cash_given" class="input currency-lkr" value="0.00" /></label></div>
        <div class="field"><label>Change Due<input id="change_due" class="input currency-lkr" readonly value="0.00"/></label></div>
        <div style="display:flex;align-items:end"></div>
      </div>

      <div class="invoice-actions">
        <button class="btn primary" id="add_line">Add</button>
        <button class="btn primary" id="save_inv">Save</button>
        <button class="btn" id="print_inv">Print</button>
        <button class="btn ghost" id="close_inv">Close</button>
        <button class="btn" id="open_calc">Calc</button>
      </div>
    </div>

    <div id="calc_modal" style="display:none" class="calc-modal"><div class="calc-display" id="calc_display">0</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
        <button class="btn" style="height:40px;display:flex;align-items:center;justify-content:center" data-val="7">7</button><button class="btn" style="height:40px;display:flex;align-items:center;justify-content:center" data-val="8">8</button><button class="btn" style="height:40px;display:flex;align-items:center;justify-content:center" data-val="9">9</button><button class="btn" style="height:40px;display:flex;align-items:center;justify-content:center" data-op="/">/</button>
        <button class="btn" style="height:40px;display:flex;align-items:center;justify-content:center" data-val="4">4</button><button class="btn" style="height:40px;display:flex;align-items:center;justify-content:center" data-val="5">5</button><button class="btn" style="height:40px;display:flex;align-items:center;justify-content:center" data-val="6">6</button><button class="btn" style="height:40px;display:flex;align-items:center;justify-content:center" data-op="*">*</button>
        <button class="btn" style="height:40px;display:flex;align-items:center;justify-content:center" data-val="1">1</button><button class="btn" style="height:40px;display:flex;align-items:center;justify-content:center" data-val="2">2</button><button class="btn" style="height:40px;display:flex;align-items:center;justify-content:center" data-val="3">3</button><button class="btn" style="height:40px;display:flex;align-items:center;justify-content:center" data-op="-">-</button>
        <button class="btn" style="height:40px;display:flex;align-items:center;justify-content:center" data-val="0">0</button><button class="btn" style="height:40px;display:flex;align-items:center;justify-content:center" data-val=".">.</button><button class="btn" style="height:40px;display:flex;align-items:center;justify-content:center" id="calc_eq" class="btn">=</button><button class="btn" style="height:40px;display:flex;align-items:center;justify-content:center" data-op="+">+</button>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px"><button class="btn" style="height:40px;display:flex;align-items:center;justify-content:center" id="calc_copy">Copy</button><button class="btn" style="height:40px;display:flex;align-items:center;justify-content:center" id="calc_close">Close</button></div>
    </div>
  `;
  // customer autofill & new customer toggle
  const sel=document.getElementById('c_sel');
  const nameF=document.getElementById('c_name');
  const phoneF=document.getElementById('c_phone');
  function syncCustomer(){
    const id=sel.value;
    if(id==='new'){
      nameF.value=''; phoneF.value=''; nameF.readOnly=false; phoneF.readOnly=false;
    }else{
      const c=db.cust.find(x=>x.id===id) || {name:'',phone:''};
      nameF.value=c.name||''; phoneF.value=c.phone||''; nameF.readOnly=true; phoneF.readOnly=true;
    }
  }
  sel.addEventListener('change', syncCustomer); syncCustomer();

  // simple autocomplete for SKU & Product Name
  function makeAutocomplete(input, setFrom){
    let list;
    input.addEventListener('input', ()=>{
      const q=input.value.trim().toLowerCase();
      const matches=db.inv.filter(it=> (it.sku||'').toLowerCase().includes(q) || (it.name||'').toLowerCase().includes(q)).slice(0,6);
      if(!list){ list=document.createElement('div'); list.className='autocomplete'; if (input && input.id) { list.setAttribute('data-for', input.id); } document.body.appendChild(list);
      // close dropdown if clicking outside
      document.addEventListener('click', (e) => {
        if (list && !list.contains(e.target) && e.target !== input) {
          list.innerHTML = '';
        }
      });
      // close dropdown on ESC key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && list) {
          list.innerHTML = '';
        }
      });
      // close dropdown on TAB key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && list) {
          list.innerHTML = '';
        }
      });
 }
      const r=input.getBoundingClientRect(); list.style.left=r.left+'px'; list.style.top=(r.bottom+window.scrollY)+'px'; list.style.width=r.width+'px';
      list.innerHTML='';
      matches.forEach(m=>{
        const item=document.createElement('div'); item.className='ac-item'; item.textContent=(m.sku||'')+' — '+m.name; item.onclick=()=>{ setFrom(m); list.innerHTML=''; };
        list.appendChild(item);
      });
    });
  }
  makeAutocomplete(document.getElementById('sku_in'), (m)=>{ document.getElementById('sku_in').value=m.sku||''; document.getElementById('p_name').value=m.name||'';         document.getElementById('p_mrp').value = formatNumNoRs(m.mrp || 0);
    document.getElementById('p_mrp').value = formatNumNoRs(m.mrp || 0);
    document.getElementById('p_price').value = formatNumNoRs((m.price!=null?m.price:((m.mrp||0)-(m.discount||0)))); document.getElementById('p_disc').value = formatNumNoRs((m.disc!=null?m.disc:(m.discount||0))); document.getElementById('p_qty').value=1; });
  makeAutocomplete(document.getElementById('p_name'), (m)=>{ document.getElementById('sku_in').value=m.sku||''; document.getElementById('p_name').value=m.name||'';         document.getElementById('p_mrp').value = formatNumNoRs(m.mrp || 0);
    document.getElementById('p_mrp').value = formatNumNoRs(m.mrp || 0);
    document.getElementById('p_price').value = formatNumNoRs((m.price!=null?m.price:((m.mrp||0)-(m.discount||0)))); document.getElementById('p_disc').value = formatNumNoRs((m.disc!=null?m.disc:(m.discount||0))); document.getElementById('p_qty').value=1; });

  // SKU behavior
  const skuInput=document.getElementById('sku_in');
  const pName=document.getElementById('p_name'); const pPrice=document.getElementById('p_price'); const pQty=document.getElementById('p_qty'); const pMrp=document.getElementById('p_mrp'); const pDisc=document.getElementById('p_disc');
// --- SAFE PATCH: Auto-calc Unit Price = MRP - Discount when edited manually
['input','change','blur'].forEach(function(evt){
  try{
    const pMrp=document.getElementById('p_mrp');
    const pDisc=document.getElementById('p_disc');
    const pPrice=document.getElementById('p_price');
    if(pMrp && pDisc && pPrice){
      const recalc=function(){
        const mrp=parseMoney(pMrp.value||0);
        const disc=parseMoney(pDisc.value||0);
        const newPrice=Math.max(0, mrp - disc);
        pPrice.value = formatNumNoRs(newPrice);
      };
      pMrp.addEventListener(evt, recalc);
      pDisc.addEventListener(evt, recalc);
    }
  }catch(e){ /* no-op */ }
});
// --- END PATCH

  skuInput.addEventListener('input', ()=>{
    const valIn=skuInput.value.trim().toLowerCase();
    const item=db.inv.find(x=>(x.sku && x.sku.toLowerCase()===valIn) || (x.name && x.name.toLowerCase().startsWith(valIn)));
    if(item){
      pName.value=item.name||'';
      const mrp = Number(item.mrp ?? item.price ?? 0);
      const disc = Number(item.discount ?? 0);
      pMrp.value = formatNumNoRs(mrp);
      pDisc.value = formatNumNoRs(disc);
      pPrice.value = formatNumNoRs(Math.max(0, mrp - disc));
      pQty.value=1;
    } else {
      pName.value=''; pMrp.value='0.00'; pDisc.value='0.00'; pPrice.value='0.00';
    }
  });
  pName.addEventListener('input', ()=>{
    const valIn=pName.value.trim().toLowerCase();
    const item=db.inv.find(x=>(x.name && x.name.toLowerCase().startsWith(valIn)) || (x.sku && x.sku.toLowerCase()===valIn));
    if(item){
      skuInput.value=item.sku||'';
      const mrp = Number(item.mrp ?? item.price ?? 0);
      const disc = Number(item.discount ?? 0);
      pMrp.value = formatNumNoRs(mrp);
      pDisc.value = formatNumNoRs(disc);
      pPrice.value = formatNumNoRs(Math.max(0, mrp - disc));
      pQty.value=1;
    } else {
      skuInput.value=''; pMrp.value='0.00'; pDisc.value='0.00'; pPrice.value='0.00';
    }
  });

  document.getElementById('add_line').addEventListener('click', ()=>{
    const sku=skuInput.value.trim(); const item=db.inv.find(x=>x.sku && x.sku.toLowerCase()===sku.toLowerCase());
    if(!item) return alert('SKU not found'); const qty=Number(pQty.value||1); if(qty<=0) return alert('Qty must be >=1'); if(item.qty < qty) return alert('Not enough stock'); const price=parseMoney(pPrice.value||item.price), disc=parseMoney(document.getElementById('p_disc').value||0);
    _cart.push({pid:item.id, sku:item.sku, name:item.name, qty, mrp: parseMoney(document.getElementById('p_mrp').value||0), price, disc, cost:item.cost});
    drawCart();
    skuInput.value=''; pName.value=''; pPrice.value='0.00'; pQty.value=0; document.getElementById('p_disc').value='0.00'; skuInput.focus();

function setupAutocomplete(inputElem, type){
  inputElem.addEventListener('input', ()=>{
    const val = inputElem.value.trim().toLowerCase();
    const matches = db.inv.filter(it => 
      (it.sku && it.sku.toLowerCase().includes(val)) || 
      (it.name && it.name.toLowerCase().includes(val))
    );
    let list = document.getElementById(inputElem.id+'_list');
    if(!list){ 
      list = document.createElement('div'); 
      list.id = inputElem.id+'_list'; 
      list.style.position='absolute'; 
      list.style.background='#fff'; 
      list.style.zIndex=1000; 
      list.style.color='#000'; 
      list.style.width=inputElem.offsetWidth+'px'; 
      document.body.appendChild(list); 
    }
    list.innerHTML = '';
    const rect = inputElem.getBoundingClientRect();
    list.style.left = rect.left+'px'; 
    list.style.top = rect.bottom+'px';
    matches.slice(0,5).forEach(m=>{
      const item = document.createElement('div');
      item.style.padding='4px 8px'; 
      item.style.cursor='pointer';
      item.textContent = m.sku+' - '+m.name;
      item.onclick = ()=>{
        document.getElementById('sku_in').value = m.sku;
        document.getElementById('p_name').value = m.name;
        document.getElementById('p_price').value = formatNumNoRs((m.price!=null?m.price:((m.mrp||0)-(m.discount||0))));
        document.getElementById('p_qty').value = 0;
        list.innerHTML = '';
      };
      list.appendChild(item);
    });
  });
}
setupAutocomplete(document.getElementById('sku_in'),'sku');
setupAutocomplete(document.getElementById('p_name'),'name');


// --- Auto-calc Unit Price = MRP - Discount (invoice discount overrides inventory) ---
function updateUnitPrice() {
  let mrp = parseFloat(document.getElementById('mrp').value) || 0;
  let disc = document.getElementById('disc').value;
  let discVal = disc === "" ? 0 : parseFloat(disc);
  if (isNaN(discVal)) discVal = 0;
  document.getElementById('u_price').value = (mrp - discVal).toFixed(2);
}
// Trigger update when MRP or Discount changes
document.getElementById('mrp').addEventListener('input', updateUnitPrice);
document.getElementById('disc').addEventListener('input', updateUnitPrice);

document.getElementById('disc').addEventListener('input', updateUnitPrice);


  // Live recalc when Discount changes
  pDisc.addEventListener('input', ()=>{
    const mrp = parseMoney(pMrp.value||0);
    const disc = parseMoney(pDisc.value||0);
    pPrice.value = formatNumNoRs(Math.max(0, mrp - disc));
  });

  });

  
function drawCart() {
  if (!_cart.length) {
    document.getElementById('cart_area').innerHTML = '<p>No lines yet.</p>';
    return;
  }

  const rows = _cart.map((l, i) => {
    const lineTotal = (l.mrp - l.disc) * l.qty;
    return `
      <tr>
        <td>${l.sku || ''}</td>
        <td>${l.name}</td>
        <td>${l.qty}</td>
        <td>${fmtMoney(l.mrp)}</td>
        <td>${fmtMoney(l.mrp - l.disc)}</td>
        <td style="width:120px">${fmtMoney(l.disc)}</td>
        <td>${fmtMoney(lineTotal)}</td>
        <td>
          <button class="action-btn edit" onclick="editLine(${i})" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="action-btn delete" onclick="delLine(${i})" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`;
  }).join('');

  const totals = _cart.reduce((acc, l) => {
    acc.sub += l.qty * l.mrp;
    acc.disc += l.qty * l.disc;
    acc.cost += l.qty * l.cost;
    return acc;
  }, { sub: 0, disc: 0, cost: 0 });

  const grand = totals.sub - totals.disc;
  document.getElementById('cart_area').innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>SKU</th>
          <th>Product Name</th>
          <th>Qty</th>
          <th>MRP</th>
          <th>Unit Price</th>
          <th>Discount</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="4"></td>
          <td>Total Discount</td>
          <td>${fmtMoney(totals.disc)}</td>
          <td></td>
        </tr>
        <tr>
          <td colspan="4"></td>
          <td>Total Amount</td>
          <td>${fmtMoney(grand)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>`;

  const cash = Number(document.getElementById('cash_given').value || 0);
  document.getElementById('change_due').value =
    (Number(Math.max(0, cash - grand || 0))
      .toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}


  window.editLine=function(i){ const l=_cart[i]; if(!l) return; const qty=Number(prompt('Qty',l.qty)); if(Number.isNaN(qty)||qty<=0) return; const price=Number(prompt('Unit Price',l.price)); if(Number.isNaN(price)||price<0) return; const disc=Number(prompt('Discount',l.disc)); if(Number.isNaN(disc)||disc<0) return; _cart[i]={...l,qty,price,disc}; drawCart(); };
  window.delLine=function(i){ if(currentUser?.role!=='admin'){ const pin=prompt('Admin password required to delete line:'); const admin=db.users.find(u=>u.role==='admin' && u.password===pin); if(!admin) return alert('Invalid admin password'); } _cart.splice(i,1); drawCart(); };

  document.getElementById('cash_given').addEventListener('input', ()=>{ const cash=Number(document.getElementById('cash_given').value||0); const totals=_cart.reduce((acc,l)=>{acc.sub+=l.qty*l.mrp;acc.disc+=l.qty*l.disc;return acc;},{sub:0,disc:0}); const grand=totals.sub - totals.disc; document.getElementById('change_due').value = (Number(Math.max(0,cash-grand||0)).toLocaleString('en-LK',{minimumFractionDigits:2,maximumFractionDigits:2})); });

  document.getElementById('save_inv').addEventListener('click', ()=>{
    if(!_cart.length) return alert('No lines to save');
    let custId=document.getElementById('c_sel').value, custName='';
    if(custId==='new'){ custName=document.getElementById('c_name').value.trim()||'Customer'; const phone=document.getElementById('c_phone').value.trim(); const c={id:uid(), name:custName, phone, email:''}; const list=db.cust; list.unshift(c); db.cust=list; custId=c.id; } else { const c=db.cust.find(x=>x.id===custId); custName=c?c.name:'Customer'; }
    const totals=_cart.reduce((acc,l)=>{acc.sub+=l.qty*l.mrp;acc.disc+=l.qty*l.disc;acc.cost+=l.qty*l.cost;return acc;},{sub:0,disc:0,cost:0});
    const grand=totals.sub - totals.disc;
    
    // reduce inventory - robust: match by id or sku, coerce numbers
    (function(){
      const invList = db.inv.map(i => Object.assign({}, i, { qty: Number(i.qty||0) }));
      _cart.forEach(l=>{
        const pid = l.pid;
        const sku = (l.sku||'').toString().toLowerCase();
        let it = invList.find(x => x.id === pid);
        if(!it && sku) it = invList.find(x => (x.sku||'').toString().toLowerCase() === sku);
        if(it){
          it.qty = Math.max(0, Number(it.qty||0) - Number(l.qty||0));
        }
      });
      db.inv = invList;
      try { localStorage.setItem('inventory', JSON.stringify(invList)); } catch(e) {}

    })();

    // consume invoice number now
    const invNo = nextInvoiceNo();
    const sale = { id:uid(), invNo, date:(function(){var el=document.getElementById('inv_date');var v=el&&el.value;if(v){return new Date(v).toISOString();}return new Date().toISOString();})(), customerId:custId, customerName:custName, items:_cart.map(l=>({id:l.pid,name:l.name,qty:l.qty,price:l.price,disc:l.disc,cost:l.cost,sku:l.sku})), total:grand, discount:totals.disc, costTotal:totals.cost, notes:document.getElementById('notes').value.trim() };
    const sales=db.sales; sales.unshift(sale); db.sales=sales;
    const cash=Number(document.getElementById('cash_given').value||0); const change=Math.max(0,cash-grand);
    alert(`Saved. Change due: ${fmtMoney(change)}. Invoice # ${invNo}`);
    showInvoiceView(sale);
  });

  document.getElementById('print_inv').addEventListener('click', ()=> alert('Please save first, then print from the saved invoice view.'));
  document.getElementById('close_inv').addEventListener('click', ()=> show('dashboard'));

  // calculator modal behavior
  const calcModal=document.getElementById('calc_modal'); const calcDisplay=document.getElementById('calc_display');
  let calcExpr='';
  document.getElementById('open_calc').addEventListener('click', ()=>{ calcModal.style.display='block'; calcExpr=''; calcDisplay.textContent='0'; });
  calcModal.querySelectorAll('button[data-val]').forEach(b=> b.addEventListener('click', ()=>{ calcExpr += b.getAttribute('data-val'); calcDisplay.textContent = calcExpr; }));
  calcModal.querySelectorAll('button[data-op]').forEach(b=> b.addEventListener('click', ()=>{ calcExpr += b.getAttribute('data-op'); calcDisplay.textContent = calcExpr; }));
  document.getElementById('calc_eq').addEventListener('click', ()=>{ try{ const r=eval(calcExpr||'0'); calcDisplay.textContent = String(r); }catch(e){ calcDisplay.textContent='ERR'; } });
  document.getElementById('calc_copy').addEventListener('click', ()=>{ const v=calcDisplay.textContent.replace(/[^0-9.\-]/g,''); document.getElementById('cash_given').value = v; document.getElementById('cash_given').dispatchEvent(new Event('input')); });
  document.getElementById('calc_close').addEventListener('click', ()=>{ calcModal.style.display='none'; });
}

// view saved invoice
function showInvoiceView(s){
  const rows = s.items.map(l=>`<tr><td>${l.sku||''}</td><td>${l.name||l.product||''}</td><td>${l.qty||0}</td><td>${fmtMoney((l.mrp!=null?l.mrp:(l.price||0)+(l.disc||0)))}</td><td>${fmtMoney(l.price!=null?l.price:((l.mrp||0)-(l.disc||0)))}</td><td>${fmtMoney(l.disc||0)}</td><td>${fmtMoney((l.total!=null?l.total:((l.price!=null?l.price:((l.mrp||0)-(l.disc||0))) * (l.qty||0))))}</td></tr>`).join('');
  document.getElementById('content').innerHTML = `<div class="card"><h3>Invoice #${s.invNo}</h3><p>Date: ${new Date(s.date).toLocaleString()}</p><p>Customer: ${s.customerName}</p><table class="table"><thead><tr><th>SKU</th><th>Product Name</th><th>Qty</th><th>MRP</th><th>Unit Price</th><th>Discount</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><p style="font-weight:800">Total Discount: ${fmtMoney(s.discount)} &nbsp;&nbsp; Total: ${fmtMoney(s.total)}</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" style="height:40px;display:flex;align-items:center;justify-content:center" onclick="printInvoice('${s.id}')">Print</button> ${ currentUser?.role==='admin' ? `<button class="btn danger" onclick="deleteInvoice('${s.id}')">Delete</button>` : '' } <button class="btn ghost" style="height:40px;display:flex;align-items:center;justify-content:center" onclick="show('dashboard')">Close</button></div></div>`;
}

window.printInvoice=function(id){ const s=db.sales.find(x=>x.id===id); if(!s) return; const settings=getSettings(); const rows=s.items.map(l=>`<tr><td>${l.sku||''}</td><td>${l.name||l.product||''}</td><td>${l.qty||0}</td><td>${fmtMoney((l.mrp!=null?l.mrp:(l.price||0)+(l.disc||0)))}</td><td>${fmtMoney(l.price!=null?l.price:((l.mrp||0)-(l.disc||0)))}</td><td>${fmtMoney(l.disc||0)}</td><td>${fmtMoney((l.total!=null?l.total:((l.price!=null?l.price:((l.mrp||0)-(l.disc||0))) * (l.qty||0))))}</td></tr>`).join(''); const win=window.open('','_blank'); win.document.write(`<html><head><title>Invoice #${s.invNo}</title><style>body{font-family:Arial;padding:20px;color:#000;background:#fff}h2{margin:0 0 4px 0}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #000;padding:6px;text-align:left}.top{display:flex;gap:10px;align-items:center}.top img{max-width:200px;height:auto}</style></head><body><div class="top">${settings.logoDataUrl?`<img src="${settings.logoDataUrl}"/>`:''}<div><h2>${settings.companyName}</h2><div>${settings.address}</div><div>${settings.phone} • ${settings.email}</div></div></div><p>Invoice #: ${s.invNo} • Date: ${new Date(s.date).toLocaleString()}</p><p>Customer: ${s.customerName}</p><table><thead><tr><th>SKU</th><th>Product Name</th><th>Qty</th><th>MRP</th><th>Unit Price</th><th>Discount</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><h3>Total Discount: ${fmtMoney(s.discount)} &nbsp;&nbsp; Total: ${fmtMoney(s.total)}</h3></body></html>`); win.document.close(); win.print(); }

window.deleteInvoice=function(id){ if(currentUser?.role!=='admin') return alert('Admin only'); if(!confirm('Delete this invoice?')) return; db.sales = db.sales.filter(x=>x.id!==id); alert('Deleted'); renderSales(); }

// Settings - admin only can edit company info, logo, reset user password locally
function renderSettings(){
  if(currentUser?.role!=='admin'){ document.getElementById('content').innerHTML = `<div class="card"><h3>Settings</h3><div class="badge">Admin only</div></div>`; return; }
  const s=getSettings();
  document.getElementById('content').innerHTML = `
    <div class="card">
      <h3>Settings</h3>
      <div class="form-row">
        <div class="field"><label>Company Name<input id="st_name" class="input" value="${s.companyName}"/></label></div>
        <div class="field"><label>Address<input id="st_addr" class="input" value="${s.address}"/></label></div>
        <div class="field"><label>Phone<input id="st_phone" class="input" value="${s.phone}"/></label></div>
        <div class="field"><label>Email<input id="st_email" class="input" value="${s.email}"/></label></div>
      </div>
      <div class="form-row" style="margin-top:8px">
        <div class="field"><label>Currency Code<input id="st_cc" class="input" value="${s.currencyCode}"/></label></div>
        <div class="field"><label>Currency Prefix<input id="st_cp" class="input" value="${s.currencyPrefix}"/></label></div>
        <div class="field"><label>Logo (max width 200px)<input id="st_logo" type="file" class="input" accept="image/*"/></label></div>
        <div><img id="st_logo_prev" src="${s.logoDataUrl}" style="max-width:200px;height:auto;border-radius:8px"/></div>
      </div>
      <div style="margin-top:10px"><button class="btn primary" style="height:40px;display:flex;align-items:center;justify-content:center" id="st_save">Save Settings</button></div>

      <hr style="margin-top:14px;opacity:.06"/>

      <h4>Manage Users</h4>
      <div id="user_list" style="margin-top:8px"></div>
      <div style="margin-top:8px"><button class="btn danger" id="reset_user_pw">Reset selected user's password</button></div>
    </div>
  `;
  document.getElementById('st_logo').addEventListener('change', (e)=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ document.getElementById('st_logo_prev').src=r.result; const s=getSettings(); s.logoDataUrl=r.result; setSettings(s); layout(); show('settings'); }; r.readAsDataURL(f); });
  document.getElementById('st_save').addEventListener('click', ()=>{ const s=getSettings(); s.companyName=val('st_name'); s.address=val('st_addr'); s.phone=val('st_phone'); s.email=val('st_email'); s.currencyCode=val('st_cc'); s.currencyPrefix=val('st_cp'); setSettings(s); alert('Saved'); layout(); show('settings'); });

  // user list
  const users=db.users; document.getElementById('user_list').innerHTML = `<table class="table"><thead><tr><th>Username</th><th>Role</th><th>Email</th><th></th></tr></thead><tbody>${users.map(u=>`<tr data-usr="${u.username}"><td>${u.username}</td><td>${u.role}</td><td>${u.email||''}</td><td><button class="btn" style="height:40px;display:flex;align-items:center;justify-content:center" onclick="selectUser('${u.username}')">Select</button></td></tr>`).join('')}</tbody></table><div style="margin-top:8px"><input id="sel_user" class="input" placeholder="Selected username" readonly/></div>`;

  document.getElementById('reset_user_pw').addEventListener('click', ()=>{
    const sel=document.getElementById('sel_user').value.trim(); if(!sel) return alert('Select a user from the table first');
    const newpw = prompt('Enter new password for '+sel); if(!newpw) return;
    const users=db.users; const u=users.find(x=>x.username===sel); if(!u) return alert('User not found'); u.password=newpw; db.users=users; alert('Password updated for '+sel);
  });

  

  

  // ===== Manage Users (Admin-only) =====
  try{
    if(currentUser && currentUser.role === 'admin'){
      const setRoot = document.getElementById('content');
      if(setRoot){
        setRoot.insertAdjacentHTML('beforeend', `
          <div class="card um-card">
            <div class="um-header">
              <div>
                <div class="name">Manage Users</div>
                <div class="meta small">Create, reset, or delete users. Admin only.</div>
              </div>
              
            </div>

            <div class="um-list-wrap">
              <table class="table" id="um_table">
                <thead>
                  <tr><th>Username</th><th>Role</th><th>Email</th><th style="width:200px">Actions</th></tr>
                </thead>
                <tbody id="um_list"></tbody>
              </table>
            </div>
          
    <div class="um-actions-bottom" style="margin-top:10px">
      <button class="btn primary" id="um_open">Create a user</button>
    </div>
    </div>

          <!-- Modal: Create User -->
          <div class="modal" id="um_modal">
            <div class="panel">
              <div class="um-modal-head">
                <div class="name">Create User</div>
                <button class="btn ghost" id="um_close">✕</button>
              </div>
              <div class="form-row">
                <div class="field"><label>Username<input id="um_u" class="input" placeholder="e.g. cashier2" /></label></div>
                <div class="field"><label>Password<input id="um_p" type="password" class="input" placeholder="••••••••" /></label></div>
                <div class="field"><label>Role<select id="um_role" class="input">
                  <option value="cashier">Cashier</option>
                  <option value="admin">Admin</option>
                </select></label></div>
                <div class="field"><label>Email<input id="um_email" class="input" placeholder="name@example.com" /></label></div>
              </div>
              <div class="button-row">
                <button class="btn" id="um_cancel">Cancel</button>
                <button class="btn primary" id="um_create">Save user</button>
              </div>
            </div>
          </div>
        `);

        const el = (id)=>document.getElementById(id);

        const openModal = ()=> el('um_modal').classList.add('show');
        const closeModal = ()=> el('um_modal').classList.remove('show');
        el('um_open').addEventListener('click', openModal);
        el('um_close').addEventListener('click', closeModal);
        el('um_cancel').addEventListener('click', closeModal);

        // Render list
        const renderList = ()=>{
          const tb = el('um_list');
          if(!tb) return;
          const users = db.users || [];
          tb.innerHTML = users.map(u => `
            <tr>
              <td>${u.username}</td>
              <td><span class="badge ${u.role==='admin'?'badge-admin':'badge-cashier'}">${u.role||'cashier'}</span></td>
              <td>${u.email||''}</td>
              <td>
                <button class="btn small warn um-reset" data-u="${u.username}">Reset</button>
                ${u.username==='admin' ? '' : `<button class="btn small danger um-del" data-u="${u.username}">Delete</button>`}
              </td>
            </tr>
          `).join('');
          // Reset handlers
          tb.querySelectorAll('.um-reset').forEach(btn => {
            btn.addEventListener('click', (e)=>{
              const uname = e.currentTarget.getAttribute('data-u');
              const npw = prompt('Enter new password for "'+uname+'":');
              if(!npw) return;
              const users = db.users || [];
              const usr = users.find(x=>x.username===uname);
              if(!usr){ alert('User not found'); return; }
              usr.password = npw; db.users = users;
              alert('Password reset successful.');
            });
          });
          // Delete handlers
          tb.querySelectorAll('.um-del').forEach(btn => {
            btn.addEventListener('click', (e)=>{
              const uname = e.currentTarget.getAttribute('data-u');
              if(!confirm('Are you sure you want to delete user "'+uname+'"?')) return;
              let users = db.users || [];
              users = users.filter(x=>x.username!==uname);
              db.users = users;
              renderList();
              alert('🗑️ User deleted.');
            });
          });
        };
        renderList();

        // Create user
        el('um_create').addEventListener('click', ()=>{
          const u = el('um_u').value.trim();
          const p = el('um_p').value;
          const role = el('um_role').value;
          const email = el('um_email').value.trim();
          if(!u || !p){ alert('Username and password required'); return; }
          const users = db.users || [];
          if(users.find(x=>x.username===u)){ alert('Username already exists'); return; }
          users.unshift({username:u, password:p, role, email});
          db.users = users;
          closeModal();
          renderList();
          alert('✅ User created');
        });
      }
    }
  }catch(e){ console.error('Manage Users inject error', e); }
}

// helper to set selected user in settings
window.selectUser = function(username){ document.getElementById('sel_user').value = username; }

// export/import
function exportJSON(){ const payload={inventory:db.inv,sales:db.sales,customers:db.cust,purchases:db.pur,settings:getSettings(),seq:db.seq,users:db.users}; const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`artgraphx-pos-v3-offline-backup-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url); }
function handleImport(ev){ const f=ev.target.files[0]; if(!f) return; const reader=new FileReader(); reader.onload=()=>{ try{ const j=JSON.parse(reader.result); if(!confirm('Import will overwrite current data. Continue?')) return; if(j.inventory) db.inv=j.inventory; if(j.sales) db.sales=j.sales; if(j.customers) db.cust=j.customers; if(j.purchases) db.pur=j.purchases; if(j.settings) setSettings(j.settings); if(j.seq) db.seq=j.seq; if(j.users) db.users=j.users; alert('Import complete'); layout(); show('dashboard'); document.querySelectorAll('.nav-btn').forEach(btn=>{btn.classList.toggle('active', btn.dataset.section==='dashboard');}); }catch(e){ alert('Invalid JSON'); } }; reader.readAsText(f); }

function val(id){ return document.getElementById(id).value.trim(); }
function num(id){ return Number(document.getElementById(id).value||0); }

// initial boot
renderLogin();


var style = document.createElement('style');
style.innerHTML = `.btn:hover { transform: scale(1.05); transition: transform 0.2s ease-in-out; }`;
document.head.appendChild(style);


document.addEventListener('DOMContentLoaded', ()=>{
  const origRenderLogin = window.renderLogin;
  if (typeof origRenderLogin === 'function') {
    window.renderLogin = function(){
      origRenderLogin();
      const appEl = document.getElementById('app');
      if (appEl && !appEl.querySelector('.footer-bar')) {
        const s = typeof getSettings==='function' ? getSettings() : {};
        const logoUrl = (s && s.logoDataUrl) ? s.logoDataUrl : (document.getElementById('footerLogo')?.src || 'logo-light-transparent-2.png');
        appEl.innerHTML += `<div class="footer-bar">
          <div class="left">Copyright © 2025 ArtGraphX. All rights reserved.</div>
          <div class="center">POS System Powered by <img src="${logoUrl}" alt="logo"/></div>
          <div class="right">Version 1.0</div>
        </div>`;
      }
    };
  }
});


// Hide product dropdown on outside click
document.addEventListener('click', function(e) {
    const list = document.getElementById('productDropdown');
    if (list && !list.contains(e.target) && e.target.id !== 'productName') {
        list.style.display = 'none';
    }
});

;[ 'p_price','p_disc','cash_given' ].forEach(id=>{
  const el=document.getElementById(id); if(!el) return;
  el.addEventListener('input', ()=>{ el.value = String(el.value).replace(/[^0-9.\-]/g,''); });
});


function formatNumberWithCommas(x){
    var parts = parseFloat(x||0).toFixed(2).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
}
['p_price','p_disc','cash_given','change_due'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.addEventListener('blur', ()=>{
        let num = parseFloat(String(el.value).replace(/[^0-9.\-]/g,''));
        if(isNaN(num)) num = 0;
        el.value = formatNumberWithCommas(num);
    });
    el.addEventListener('input', ()=>{
        el.value = String(el.value).replace(/[^0-9.\-]/g,'');
    });
});



(function(){
  function formatNum(x){ 
    const n = Number(String(x||'').replace(/[^0-9.\-]/g,''))||0; 
    return n.toLocaleString('en-LK',{minimumFractionDigits:2,maximumFractionDigits:2}); 
  }
  ['p_price','p_disc','cash_given','change_due'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.addEventListener('input',()=>{
      el.value = String(el.value).replace(/[^0-9.\-]/g,'');
    });
    el.addEventListener('blur',()=>{
      el.value = formatNum(el.value);
    });
  });
})();


/*__NUM_INPUT_LISTENERS__*/
['p_price','p_disc','cash_given','change_due'].forEach(id=>{
  const el=document.getElementById(id);
  if(!el) return;
  el.addEventListener('input',()=>{
    el.value = String(el.value).replace(/[^0-9.\-]/g,'');
  });
  el.addEventListener('blur',()=>{
    el.value = formatNumNoRs(el.value);
  });
});


// Enter key triggers Add
document.addEventListener('keydown', function(e){
  if(e.key==='Enter'){
    const addBtn=document.getElementById('add_line');
    if(addBtn) addBtn.click();
  }
});


// === Inventory Management ===
function getInventory() {
    return JSON.parse(localStorage.getItem("inventory")) || [];
}

function saveInventory(inventory) {
    localStorage.setItem("inventory", JSON.stringify(inventory));
}

// Add Item button click
// Export JSON button click



// === Product Name Autocomplete for Customer Invoice (Final Force-Split) ===
(function(){
  let attached = false;
  const timer = setInterval(() => {
    const inputProductName = document.getElementById('invoice_product');
    if(inputProductName && !attached){
      attached = true;
      clearInterval(timer);

      const inputSKU = document.getElementById('invoice_sku');
      const inputPrice = document.getElementById('invoice_price');
      const inputMRP = document.getElementById('invoice_mrp');
      const inputQty = document.getElementById('invoice_qty');

      inputProductName.setAttribute('autocomplete','off');

      const suggestionsBox = document.createElement('div');
      suggestionsBox.id = 'product_suggestions';
      suggestionsBox.className = 'suggestions';
      suggestionsBox.style.display = 'none';
      (inputProductName.closest('.field') || inputProductName.parentElement || document.body).appendChild(suggestionsBox);

      let matches = [];
      let currentIndex = -1;

      function extractNameOnly(item){
        let raw = (item && item.name ? String(item.name) : '').trim();
        if(!raw) return '';
        const m = raw.match(/[-–—]/);
        if(m){
          const idx = raw.indexOf(m[0]);
          const after = raw.slice(idx+1).trim();
          if(after.length) return after;
        }
        return raw;
      }

      function renderSuggestions(){
        suggestionsBox.innerHTML = '';
        matches.forEach((item, idx) => {
          const el = document.createElement('div');
          el.className = 'suggestion-item';
          if(idx === currentIndex) el.classList.add('active');
          el.textContent = extractNameOnly(item);
          el.addEventListener('mousedown', e => { e.preventDefault(); applySelection(item); });
          suggestionsBox.appendChild(el);
        });
        suggestionsBox.style.display = matches.length ? 'block' : 'none';
      }

      function applySelection(item){
        inputProductName.value = extractNameOnly(item);
        if(inputSKU) inputSKU.value = item.sku || '';
        if(inputMRP) inputMRP.value = (typeof fmtMoney === 'function') ? fmtMoney(item.mrp || 0) : (item.mrp || 0);
        if(inputPrice) inputPrice.value = (typeof fmtMoney === 'function') ? fmtMoney(item.price || 0) : (item.price || 0);
        if(inputQty) inputQty.value = 1;
        suggestionsBox.style.display = 'none';
      }

      inputProductName.addEventListener('input', () => {
        const query = inputProductName.value.trim().toLowerCase();
        if(!query){ suggestionsBox.style.display = 'none'; return; }
        const inv = (window.db && Array.isArray(window.db.inv)) ? window.db.inv : (window.db && window.db.inv) || [];
        matches = inv.filter(item => {
          const name = (item.name || '').toLowerCase();
          const sku = (item.sku || '').toLowerCase();
          const cat = (item.category || '').toLowerCase();
          return name.includes(query) || sku.includes(query) || cat.includes(query);
        }).slice(0, 10);
        currentIndex = -1;
        renderSuggestions();
      });

      inputProductName.addEventListener('keydown', e => {
        if(!matches.length) return;
        if(e.key === 'ArrowDown'){ e.preventDefault(); currentIndex = (currentIndex+1) % matches.length; renderSuggestions(); }
        else if(e.key === 'ArrowUp'){ e.preventDefault(); currentIndex = (currentIndex-1+matches.length) % matches.length; renderSuggestions(); }
        else if(e.key === 'Enter'){ e.preventDefault(); if(currentIndex >= 0) applySelection(matches[currentIndex]); }
        else if(e.key === 'Escape'){ suggestionsBox.style.display = 'none'; }
      });

      document.addEventListener('click', e => {
        if(suggestionsBox.style.display === 'block' && !suggestionsBox.contains(e.target) && e.target !== inputProductName){
          suggestionsBox.style.display = 'none';
        }
      });
    }
  }, 400);
})();


// ===== Customer Quotation (A5 print) =====

function renderQuotation(){
  const cust=db.cust;
  const qNoPeek = peekQuoteNo();
  window._qcart = [];
  const today = new Date().toISOString().slice(0,10);
  document.getElementById('content').innerHTML = `
    <div class="card">
      <h3>Customer Quotation <span class="badge">Quote # ${qNoPeek}</span></h3>
      <div class="form-row">
        <div class="field"><label>Quote No<input id="q_no" class="input" value="${qNoPeek}" readonly/></label></div>
        <div class="field"><label>Date<input id="q_date" type="date" class="input" value="${today}"/></label></div>
        <div class="field"><label>Customer
          <select id="q_c_sel" class="input">
            <option value="cash">Cash</option>
            <option value="new">+ New customer</option>
            ${cust.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </label></div>
      </div>

      <div class="form-row">
        <div class="field"><label>Customer Name<input id="q_c_name" class="input" placeholder="Name"/></label></div>
        <div class="field"><label>Mobile<input id="q_c_phone" class="input" placeholder="07X"/></label></div>
        <div class="field"><label>Valid (days)<input id="q_valid_days" class="input" type="number" min="1" value="14"/></label></div>
      </div>

      <div class="form-row">
        <div class="field"><label>SKU<input id="q_sku" class="input" placeholder="Enter or scan SKU" /></label></div>
        <div class="field"><label>Product Name<select id="q_pname" class="input"></select></label></div>
        <div class="field"><label>QTY<input id="q_qty" type="number" class="input" value="1" min="1" /></label></div>
      </div>

      <div class="form-row">
        <div class="field"><label>MRP<input id="q_mrp" class="input currency-lkr" value="0.00" readonly/></label></div>
        <div class="field"><label>DISCOUNT<input id="q_disc" class="input currency-lkr" value="0.00"/></label></div>
        <div class="field"><label>UNIT PRICE<input id="q_price" class="input currency-lkr" value="0.00"/></label></div>
      </div>

      <div id="q_cart_area" style="margin-top:12px"></div>

      <div class="invoice-actions">
        <button class="btn" id="q_new">New Quotation</button>
        <button class="btn primary" id="q_add">Add Item</button>
        <button class="btn primary" id="q_save">Save Quotation</button>
        <button class="btn" id="q_print">Print</button>
        <button class="btn ghost" id="q_list">Quotation List</button>
      </div>
    </div>
  `;

  const skuInput=document.getElementById('q_sku');
  const pName=document.getElementById('q_pname');
  const pQty=document.getElementById('q_qty');
  const pMrp=document.getElementById('q_mrp');
  const pDisc=document.getElementById('q_disc');
  const pPrice=document.getElementById('q_price');
  const cSel=document.getElementById('q_c_sel');
  const cName=document.getElementById('q_c_name');
  const cPhone=document.getElementById('q_c_phone');

  function updateCustFields(){
    const val=cSel.value;
    if(val==='cash'){
      cName.value='Cash'; cPhone.value=''; cName.readOnly=true; cPhone.readOnly=true;
    }else if(val==='new'){
      cName.value=''; cPhone.value=''; cName.readOnly=false; cPhone.readOnly=false;
    }else{
      const c=db.cust.find(x=>x.id===val);
      if(c){ cName.value=c.name||''; cPhone.value=c.phone||''; }
      cName.readOnly=true; cPhone.readOnly=true;
    }
  }
  cSel.addEventListener('change', updateCustFields);
  updateCustFields();

  // Fill product dropdown with inventory
  pName.innerHTML = '<option value="">--Select--</option>' + db.inv.map(it=>`<option value="${it.id}">${it.name}</option>`).join('');
  pName.addEventListener('change', ()=>{
    const item=db.inv.find(x=>x.id==pName.value);
    if(item){
      skuInput.value=item.sku||'';
      const mrp = Number(item.mrp ?? item.price ?? 0);
      const disc = Number(item.disc ?? item.discount ?? 0);
      pMrp.value = formatNumNoRs(mrp);
      pDisc.value = formatNumNoRs(disc);
      pPrice.value = formatNumNoRs(Math.max(0, mrp - disc));
      pQty.value=1;
    }
  });

  skuInput.addEventListener('input', ()=>{
    const s = skuInput.value.trim().toLowerCase();
    const item = db.inv.find(x=>x.sku && x.sku.toLowerCase()===s);
    if(item){
      pName.value=item.id;
      const mrp = Number(item.mrp ?? item.price ?? 0);
      const disc = Number(item.disc ?? item.discount ?? 0);
      pMrp.value = formatNumNoRs(mrp);
      pDisc.value = formatNumNoRs(disc);
      pPrice.value = formatNumNoRs(Math.max(0, mrp - disc));
      pQty.value=1;
    }
  });

  pDisc.addEventListener('input', ()=>{
    const mrp=parseMoney(pMrp.value||0), disc=parseMoney(pDisc.value||0);
    pPrice.value = formatNumNoRs(Math.max(0, mrp - disc));
  });

  document.getElementById('q_add').addEventListener('click', ()=>{
    const item=db.inv.find(x=>x.id==pName.value);
    if(!item) return alert('Select product');
    const qty=Number(pQty.value||1);
    const price=parseMoney(pPrice.value||0);
    const disc=parseMoney(pDisc.value||0);
    window._qcart.push({pid:item.id, sku:item.sku, name:item.name, qty, mrp:parseMoney(pMrp.value||0), price, disc, cost:item.cost});
    drawQuoteCart();
    skuInput.value=''; pName.value=''; pPrice.value='0.00'; pQty.value='1'; pMrp.value='0.00'; pDisc.value='0.00'; 
  });

  (function(){var _el=document.getElementById('q_new'); if(_el) _el.addEventListener('click', renderQuotation);})();
  (function(){var _el=document.getElementById('q_save'); if(_el) _el.addEventListener('click', saveQuotation);})();
  document.getElementById('q_print').addEventListener('click', ()=>{
    if(!_qcart.length) return alert('Save quotation first');
    // Save first and then print the last saved
    saveQuotation(true);
  });
  (function(){var _el=document.getElementById('q_list'); if(_el) _el.addEventListener('click', renderQuotationList);})();

  drawQuoteCart();
}
function drawQuoteCart(){
  const area=document.getElementById('q_cart_area');
  if(!_qcart.length){
    area.innerHTML = '<div class="badge">No items yet</div>'; 
    return;
  }
  const rows=_qcart.map((l,i)=>`<tr>
    <td>${l.sku||''}</td><td>${l.name||''}</td><td><input type="number" min="1" value="${l.qty}" data-i="${i}" class="input qqty" style="width:80px"/></td>
    <td style="text-align:right">${formatNumNoRs(l.mrp)}</td>
    <td style="text-align:right">${formatNumNoRs(l.disc)}</td>
    <td style="text-align:right">${formatNumNoRs(l.price)}</td>
    <td style="text-align:right">${formatNumNoRs(l.qty*l.price)}</td>
    <td><button class="action-btn edit" onclick="editQuotation(${i})" title="Edit"><i class="fa-solid fa-pen"></i></button> <button class="action-btn delete" onclick="deleteQuotation(${i})" title="Delete"><i class="fa-solid fa-trash"></i></button></td>
  </tr>`).join('');
  const totals=_qcart.reduce((a,l)=>{a.sub+=l.qty*l.price; a.disc+=l.qty*l.disc; return a;},{sub:0,disc:0});
  const grand=totals.sub;
  area.innerHTML = `<table class="table">
    <thead><tr><th>SKU</th><th>Item</th><th>Qty</th><th>MRP</th><th>Discount</th><th>Unit</th><th>Total</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><td colspan="5"></td><td>Sub Total</td><td style="text-align:right">${formatNumNoRs(totals.sub+totals.disc)}</td><td></td></tr>
      <tr><td colspan="5"></td><td>Total Discount</td><td style="text-align:right">${formatNumNoRs(totals.disc)}</td><td></td></tr>
      <tr><td colspan="5"></td><td>Grand Total</td><td style="text-align:right">${formatNumNoRs(grand)}</td><td></td></tr>
    </tfoot>
  </table>`;
  // qty change
  document.querySelectorAll('.qqty').forEach(inp=>{
    inp.addEventListener('input', e=>{
      const i=Number(e.target.dataset.i);
      const v=Math.max(1, Number(e.target.value||1));
      _qcart[i].qty=v; drawQuoteCart();
    });
  });
  window.qDel=function(i){ _qcart.splice(i,1); drawQuoteCart(); }
}

function saveQuotation(){
  if(!_qcart.length) return alert('No items to save');
  let custId=document.getElementById('q_c_sel').value, custName='', phone='';
  if(custId==='new'){ 
    custName=document.getElementById('q_c_name').value.trim();
    phone=document.getElementById('q_c_phone').value.trim();
    if(!custName) return alert('Enter customer name');
    const list=db.cust; const c={id:'C'+Date.now(), name:custName, phone}; list.push(c); db.cust=list; custId=c.id;
  } else if(custId==='cash'){
    custName='Cash'; phone='';
  } else { 
    const c=db.cust.find(x=>x.id===custId); custName=c?.name||''; phone=c?.phone||''; 
  }

  const id = nextQuoteNo();
  const date = document.getElementById('q_date').value || new Date().toISOString().slice(0,10);
  const validDays = Math.max(1, Number(document.getElementById('q_valid_days').value||14));
  const validUntil = new Date(date); validUntil.setDate(validUntil.getDate()+validDays);
  const items = _qcart.map(l=>({...l}));
  const totals = items.reduce((a,l)=>{a.sub+=l.qty*l.price; a.disc+=l.qty*l.disc; return a;},{sub:0,disc:0});
  const grand = totals.sub;

  const s = { id, quoteNo:id, date, validUntil: validUntil.toISOString().slice(0,10), customerId:custId, customerName:custName, phone, items, subTotal: totals.sub+totals.disc, totalDiscount: totals.disc, total: grand, notes: (document.getElementById('q_notes')?.value||'') };
  const list = db.quotes; list.push(s); db.quotes=list;

  alert('Quotation saved. Quote # '+id);
  showQuotationView(s);
}

function renderQuotationList(){
  const list = db.quotes.slice().sort((a,b)=> b.id - a.id);
  document.getElementById('content').innerHTML = `
    <div class="card">
      <h3>Quotation List</h3>
      <table class="table">
        <thead><tr><th>Quote #</th><th>Date</th><th>Customer</th><th>Total</th><th>Valid Until</th><th></th></tr></thead>
        <tbody>${list.map(q=>`<tr>
          <td>${q.quoteNo}</td><td>${q.date}</td><td>${q.customerName||''}</td><td style="text-align:right">${formatNumNoRs(q.total)}</td><td>${q.validUntil}</td>
          <td><button class="btn small" onclick="showQuotationViewId(${q.id})">Open</button></td>
        </tr>`).join('')}</tbody>
      </table>
      <div class="invoice-actions"><button class="btn primary" onclick="renderQuotation()">New Quotation</button></div>
    </div>
  `;
  window.showQuotationViewId = function(id){
    const q = db.quotes.find(x=>x.id==id); if(q) showQuotationView(q);
  }
}

function showQuotationView(s){
  const set=getSettings();
  const rows = s.items.map(l=>`<tr><td>${l.sku||''}</td><td>${l.name||''}</td><td style="text-align:right">${l.qty}</td><td style="text-align:right">${formatNumNoRs(l.mrp)}</td><td style="text-align:right">${formatNumNoRs(l.disc)}</td><td style="text-align:right">${formatNumNoRs(l.price)}</td><td style="text-align:right">${formatNumNoRs(l.qty*l.price)}</td></tr>`).join('');
  document.getElementById('content').innerHTML = `
    <div class="card">
      <div class="print-sheet">
        <div class="q-header">
          <div class="q-left">
            ${set.logoDataUrl ? `<img src="${set.logoDataUrl}" style="max-width:140px;height:auto;border-radius:6px"/>` : ''}
            <div class="q-company">
              <div class="q-name">${set.companyName||''}</div>
              <div class="q-meta">${set.address||''} • ${set.phone||''} • ${set.email||''}</div>
            </div>
          </div>
          <div class="q-right">
            <div><strong>Quotation</strong></div>
            <div>Quote #: ${s.quoteNo}</div>
            <div>Date: ${s.date}</div>
            <div>Valid Until: ${s.validUntil}</div>
          </div>
        </div>

        <div class="q-to">
          <div><strong>To:</strong> ${s.customerName||'N/A'}</div>
          ${s.phone?`<div><strong>Phone:</strong> ${s.phone}</div>`:''}
        </div>

        <table class="table q-table">
          <thead><tr><th>SKU</th><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">MRP</th><th style="text-align:right">Discount</th><th style="text-align:right">Unit</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr><td colspan="5"></td><td>Sub Total</td><td style="text-align:right">${formatNumNoRs(s.subTotal)}</td></tr>
            <tr><td colspan="5"></td><td>Total Discount</td><td style="text-align:right">${formatNumNoRs(s.totalDiscount)}</td></tr>
            <tr><td colspan="5"></td><td>Grand Total</td><td style="text-align:right">${formatNumNoRs(s.total)}</td></tr>
          </tfoot>
        </table>

        ${s.notes?`<div class="q-notes"><strong>Notes:</strong> ${s.notes}</div>`:''}
      </div>

      <div class="invoice-actions">
        <button class="btn" onclick="renderQuotationList()">Back</button>
        <button class="btn primary" onclick="printQuotation(${s.id})">Print A5</button>
      </div>
    </div>
  `;
}

function printQuotation(id){
  const s = db.quotes.find(x=>x.id==id); if(!s) return alert('Not found');
  const set = getSettings();
  const rows = s.items.map(l=>`<tr><td>${l.sku||''}</td><td>${l.name||''}</td><td style="text-align:right">${l.qty}</td><td style="text-align:right">${formatNumNoRs(l.mrp)}</td><td style="text-align:right">${formatNumNoRs(l.disc)}</td><td style="text-align:right">${formatNumNoRs(l.price)}</td><td style="text-align:right">${formatNumNoRs(l.qty*l.price)}</td></tr>`).join('');
  const css = `
    <style>
      @page { size: A5; margin: 8mm; }
      body { font-family: Arial, sans-serif; }
      h1,h2,h3 { margin: 6px 0; }
      .q-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
      .q-company { font-size:12px; }
      table { width:100%; border-collapse: collapse; }
      th, td { border-bottom:1px solid #ccc; padding:6px; font-size:12px; text-align:left; }
      tfoot td { font-weight:700; }
    </style>`;
  const html = `
    <div class="q-head">
      <div>
        ${set.logoDataUrl?`<img src="${set.logoDataUrl}" style="max-height:60px"/>`:''}
        <div class="q-company"><div><strong>${set.companyName||''}</strong></div><div>${set.address||''} • ${set.phone||''} • ${set.email||''}</div></div>
      </div>
      <div style="text-align:right">
        <div><strong>Quotation</strong></div>
        <div>Quote #: ${s.quoteNo}</div>
        <div>Date: ${s.date}</div>
        <div>Valid Until: ${s.validUntil}</div>
      </div>
    </div>
    <div style="margin:6px 0"><strong>To:</strong> ${s.customerName||'N/A'} ${s.phone?(' • '+s.phone):''}</div>
    <table>
      <thead><tr><th>SKU</th><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">MRP</th><th style="text-align:right">Discount</th><th style="text-align:right">Unit</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="5"></td><td>Sub Total</td><td style="text-align:right">${formatNumNoRs(s.subTotal)}</td></tr>
        <tr><td colspan="5"></td><td>Total Discount</td><td style="text-align:right">${formatNumNoRs(s.totalDiscount)}</td></tr>
        <tr><td colspan="5"></td><td>Grand Total</td><td style="text-align:right">${formatNumNoRs(s.total)}</td></tr>
      </tfoot>
    </table>
    ${s.notes?`<div style="margin-top:6px"><strong>Notes:</strong> ${s.notes}</div>`:''}
  `;
  const w=window.open('','_blank','width=900,height=700');
  w.document.write('<html><head><title>Quotation</title>'+css+'</head><body>'+html+'</body></html>');
  w.document.close(); w.focus(); w.print(); w.close();
}

// === Inventory Edit/Delete functions ===
window.editInventoryItem = function(id){
  const item = db.inv.find(x => x.id === id);
  if(!item) return alert("Item not found");
  document.getElementById('inv_category').value = item.category || '';
  document.getElementById('inv_name').value = item.name || '';
  document.getElementById('inv_sku').value = item.sku || '';
  document.getElementById('inv_mrp').value = item.mrp || 0;
  document.getElementById('inv_discount').value = item.discount || 0;
  document.getElementById('inv_price').value = item.price || 0;
  document.getElementById('inv_cost').value = item.cost || 0;
  document.getElementById('inv_qty').value = item.qty || 0;

  // Change Add button to Update
  const btn = document.getElementById('inv_add');
  btn.textContent = "Update Item";
  btn.onclick = function(){
    item.category = document.getElementById('inv_category').value.trim();
    item.name = document.getElementById('inv_name').value.trim();
    item.sku = document.getElementById('inv_sku').value.trim();
    item.mrp = parseFloat(document.getElementById('inv_mrp').value)||0;
    item.discount = parseFloat(document.getElementById('inv_discount').value)||0;
    item.price = parseFloat(document.getElementById('inv_price').value)||0;
    item.cost = parseFloat(document.getElementById('inv_cost').value)||0;
    item.qty = parseInt(document.getElementById('inv_qty').value)||0;
    db.inv = db.inv.map(x => x.id === id ? item : x);
    alert("✅ Product updated successfully!");
    show('inventory');
  };
};

window.deleteInventoryItem = function(id){
  if(!confirm("⚠️ Are you sure you want to delete this product?")) return;
  db.inv = db.inv.filter(x => x.id !== id);
  alert("🗑️ Product deleted.");
  show('inventory');
};


// --- Quotation line controls (match Invoice/Inventory buttons) ---
function editQuotation(i){
  try{
    const l = _qcart[i] || {};
    // Fill back into fields for editing
    const set = (id, v) => { const el=document.getElementById(id); if(el) el.value = (v ?? ''); };
    set('q_sku', l.sku || '');
    set('q_pname', l.name || '');
    set('q_qty', l.qty || 1);
    set('q_mrp', l.mrp || 0);
    set('q_disc', l.disc || 0);
    set('q_price', l.price || 0);
    // Remove the line being edited so re-adding won't duplicate
    _qcart.splice(i,1);
    drawQuoteCart();
    const focusEl = document.getElementById('q_pname'); if(focusEl) focusEl.focus();
  }catch(e){ console.error('editQuotation error', e); }
}
function deleteQuotation(i){
  try{
    _qcart.splice(i,1);
    drawQuoteCart();
  }catch(e){ console.error('deleteQuotation error', e); }
}

// Clear PO search results initially
document.addEventListener('DOMContentLoaded', ()=>{
  const box=document.getElementById('po_results');
  if(box) box.innerHTML = '';
});


function clearPOMForm(){
  const ids=['po_no','po_date','po_supplier','po_location','po_contact','po_email','po_whatsapp'];
  ids.forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  poItems = [];
  try{ renderItems(); }catch(e){}
  editingId = null;
  const saveBtn=document.getElementById('po_save');
  if(saveBtn) saveBtn.textContent='Save Purchase Order';
}

// Hook up Clear button
(function(){var _el=document.getElementById('po_clear'); if(_el) _el.addEventListener('click', clearPOMForm);})();



/* === A5 Invoice Print Template === */
function renderInvoicePrint(data) {
  const invoiceHTML = `
  <div class="invoice-print">
    <div class="header">
      <img src="logo_black.png" class="logo"/>
      <h1>ArtGraphX Book Shop & Communication</h1>
      <p>No 304/1/1, Manik Agara Rd, Koratota Kaduwela, Sri Lanka, 10640</p>
      <p>Tel: (+94) 078 630 7700 | Email: artgraphx25@gmail.com</p>
      <hr/>
    </div>
    <div class="meta">
      <div class="left">
        <p><strong>Invoice No:</strong> ${data.invNo}</p>
        <p><strong>Date:</strong> ${data.date}</p>
        <p><strong>Cashier:</strong> ${data.cashier}</p>
      </div>
      <div class="right">
        <p><strong>Customer:</strong> ${data.customer}</p>
        <p><strong>Contact:</strong> ${data.contact}</p>
      </div>
    </div>
    <table class="items">
      <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
      <tbody>
        ${data.items.map(it => `<tr><td>${it.name}</td><td>${it.qty}</td><td>${it.price}</td><td>${it.total}</td></tr>`).join('')}
      </tbody>
    </table>
    <div class="summary">
      <p>Subtotal: ${data.subtotal}</p>
      <p>Discount: ${data.discount}</p>
      <p>Tax: ${data.tax}</p>
      <h2>Grand Total: ${data.total}</h2>
      <p><strong>Payment:</strong> ${data.payment}</p>
    </div>
    <div class="footer">
      <p>Thank you for your business!</p>
    </div>
  </div>
  <style>
  @media print {
    @page { size: A5; margin: 8mm; }
    body { background: #fff; color: #000; font-family: Arial, sans-serif; }
    .invoice-print { width: 100%; max-width: 100%; }
    .invoice-print .header { text-align: center; margin-bottom: 10px; }
    .invoice-print .header .logo { height: 60px; margin-bottom: 6px; }
    .invoice-print h1 { margin: 4px 0; font-size: 18px; font-weight: 900; }
    .invoice-print p { margin: 2px 0; font-size: 12px; }
    .invoice-print .meta { display: flex; justify-content: space-between; margin: 10px 0; font-size: 12px; }
    .invoice-print table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .invoice-print th, .invoice-print td { border-bottom: 1px solid #ccc; padding: 4px; text-align: left; }
    .invoice-print th { background: #f0f0f0; font-weight: 700; }
    .invoice-print td:nth-child(2),
    .invoice-print td:nth-child(3),
    .invoice-print td:nth-child(4) { text-align: right; }
    .invoice-print .summary { margin-top: 10px; text-align: right; font-size: 12px; }
    .invoice-print .summary h2 { margin-top: 6px; font-size: 14px; font-weight: 900; }
    .invoice-print .footer { margin-top: 20px; text-align: center; font-size: 12px; }
  }
  </style>
  `;
  const w = window.open("", "_blank");
  w.document.write(invoiceHTML);
  w.document.close();
  w.focus();
  w.print();
}
