/* Firebase LocalStorage Bridge (no app code changes)
   - Adds a small settings modal to paste Firebase config.
   - When enabled, mirrors localStorage <-> Firestore 'kv' collection.
   - Keeps behavior synchronous for the app by caching in localStorage.
*/

(function(){
  const CFG_KEY = 'firebase_config_json';
  const ENABLE_KEY = 'firebase_enabled';
  const DEVICE_ID_KEY = 'firebase_device_id';
  const LS = window.localStorage;
  let firebaseEnabled = false;
  let app = null, db = null, unsubAll = [];
  let syncing = false;

  function ensureDeviceId(){
    let id = LS.getItem(DEVICE_ID_KEY);
    if(!id){
      id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      LS.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }
  const deviceId = ensureDeviceId();

  function loadConfig(){
    try { return JSON.parse(LS.getItem(CFG_KEY) || '{}'); } catch(e){ return {}; }
  }

  function saveConfig(cfg){ LS.setItem(CFG_KEY, JSON.stringify(cfg||{})); }
  function setEnabled(v){ LS.setItem(ENABLE_KEY, v?'1':''); firebaseEnabled = !!v; }
  function getEnabled(){ return !!LS.getItem(ENABLE_KEY); }

  // Minimal UI
  function injectUI(){
    const style = document.createElement('style');
    style.textContent = `.fb-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.4);z-index:99999}
      .fb-card{background:#fff;max-width:720px;width:96%;padding:16px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.2);font-family:system-ui,Segoe UI,Roboto,Arial}
      .fb-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .fb-card h3{margin:0 0 8px 0}
      .fb-card label{display:block;font-size:12px;color:#555;margin:6px 0 2px}
      .fb-card input,.fb-card textarea{width:100%;padding:8px;border:1px solid #ddd;border-radius:10px;font-size:13px}
      .fb-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}
      .fb-btn{padding:8px 12px;border-radius:999px;border:1px solid #ddd;cursor:pointer;background:#fafafa}
      .fb-btn.primary{background:#111;color:#fff;border-color:#111}
      .fb-toggle{display:flex;align-items:center;gap:8px;margin:6px 0}
      .fb-badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;background:#f1f5f9;color:#111}`;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.className = 'fb-modal';
    modal.innerHTML = `<div class="fb-card">
        <h3>Firebase Connection</h3>
        <div class="fb-toggle"><input type="checkbox" id="fb_enable"><label for="fb_enable">Enable Firebase Cloud Sync</label></div>
        <div class="fb-row">
          <div><label>apiKey</label><input id="fb_apiKey"/></div>
          <div><label>authDomain</label><input id="fb_authDomain"/></div>
          <div><label>projectId</label><input id="fb_projectId"/></div>
          <div><label>storageBucket</label><input id="fb_storageBucket"/></div>
          <div><label>messagingSenderId</label><input id="fb_messagingSenderId"/></div>
          <div><label>appId</label><input id="fb_appId"/></div>
        </div>
        <div class="fb-actions">
          <button class="fb-btn" id="fb_close">Close</button>
          <button class="fb-btn primary" id="fb_save">Save & Connect</button>
        </div>
        <div style="margin-top:8px">
          <span class="fb-badge">Uses Firestore 'kv' collection. Syncs all keys.</span>
        </div>
      </div>`;
    document.body.appendChild(modal);

    function open(){ modal.style.display='flex'; restoreForm(); }
    function close(){ modal.style.display='none'; }
    function restoreForm(){
      const cfg = loadConfig();
      ['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId'].forEach(k=>{
        const el = document.getElementById('fb_'+k); if(el) el.value = cfg[k] || '';
      });
      document.getElementById('fb_enable').checked = getEnabled();
    }
    document.getElementById('fb_close').onclick = close;
    document.getElementById('fb_save').onclick = async ()=>{
      const cfg = {};
      ['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId'].forEach(k=>{
        cfg[k] = document.getElementById('fb_'+k).value.trim();
      });
      saveConfig(cfg);
      setEnabled(document.getElementById('fb_enable').checked);
      close();
      await initFirebase();
    };

    // Add entry point button to any existing "Settings" nav, otherwise floating gear
    const maybeInsert = ()=>{
      const btn = document.createElement('button');
      btn.textContent = 'Firebase';
      btn.className = 'btn small';
      btn.style.marginLeft = '8px';
      btn.onclick = open;
      // Try to find a settings header/action area:
      const settingsHeader = document.querySelector('.settings-actions, .um-actions, .set-actions, header .brand-right');
      if(settingsHeader){
        settingsHeader.appendChild(btn);
      } else {
        const fab = document.createElement('button');
        fab.innerHTML = '☁︎';
        fab.title = 'Firebase settings';
        fab.style.cssText = 'position:fixed;right:14px;bottom:14px;height:44px;width:44px;border-radius:50%;border:1px solid #ddd;background:#fff;box-shadow:0 8px 20px rgba(0,0,0,.15);cursor:pointer;z-index:99998';
        fab.onclick = open;
        document.body.appendChild(fab);
      }
    };
    maybeInsert();
  }

  // Dynamically load Firebase SDK from CDN
  function loadFirebaseSDK(){
    return new Promise((resolve, reject)=>{
      if(window.firebase && window.firebase.app){ return resolve(); }
      const s1 = document.createElement('script');
      s1.src = "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js";
      const s2 = document.createElement('script');
      s2.src = "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js";
      const s3 = document.createElement('script');
      s3.src = "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js";
      s3.onload = ()=> resolve();
      s2.onload = ()=> document.head.appendChild(s3);
      s2.onerror = reject;
      s1.onload = ()=> document.head.appendChild(s2);
      s1.onerror = reject;
      document.head.appendChild(s1);
    });
  }

  async function initFirebase(){
    unsubAll.forEach(u=>{ try{u();}catch(e){} });
    unsubAll = [];
    if(!getEnabled()) return;
    const cfg = loadConfig();
    if(!cfg || !cfg.apiKey || !cfg.projectId){ console.warn('[FirebaseBridge] Missing config'); return; }

    try{
      await loadFirebaseSDK();
      if(!window.firebase) return;
      if(!app){
        app = firebase.initializeApp(cfg);
        db = firebase.firestore();
        // Anonymous auth for secured rules
        try { await firebase.auth().signInAnonymously(); } catch(e) { console.warn('Anon auth failed', e); }
      } else {
        // reinit settings if needed
      }
      console.log('[FirebaseBridge] Connected.');
      await primeFromFirestore();
      attachLiveSync();
    }catch(e){
      console.error('[FirebaseBridge] init error', e);
    }
  }

  async function primeFromFirestore(){
    try{
      // Pull all docs in 'kv' and write to localStorage if not present or remote newer
      const snap = await db.collection('kv').get();
      snap.forEach(doc=>{
        try{
          const d = doc.data()||{};
          const val = typeof d.value === 'string' ? d.value : JSON.stringify(d.value||{});
          const existing = LS.getItem(doc.id);
          if(existing == null){
            LS.setItem(doc.id, val);
          } else {
            // naive: always prefer remote if timestamps exist and are newer
            try{
              const eObj = JSON.parse(existing);
              const rObj = JSON.parse(val);
              // if both have _updatedAt compare, else overwrite
              if(rObj && rObj._updatedAt && (!eObj || !eObj._updatedAt || rObj._updatedAt > eObj._updatedAt)){
                LS.setItem(doc.id, val);
              }
            }catch(_){ /* fallback overwrite */ }
          }
        }catch(e){ console.warn('prime err', e); }
      });
    }catch(e){ console.warn('[FirebaseBridge] prime error', e); }
  }

  function attachLiveSync(){
    // watch remote changes
    const unsub = db.collection('kv').onSnapshot(snap=>{
      snap.docChanges().forEach(change=>{
        const doc = change.doc;
        if(change.type === 'modified' || change.type === 'added'){
          const data = doc.data()||{};
          if(data.deviceId === deviceId) return; // skip our own writes
          try{
            const val = typeof data.value === 'string' ? data.value : JSON.stringify(data.value||{});
            syncing = true;
            LS.setItem(doc.id, val);
          } finally { syncing = false; }
        } else if(change.type === 'removed'){
          syncing = true;
          LS.removeItem(doc.id);
          syncing = false;
        }
      });
    });
    unsubAll.push(unsub);
  }

  async function pushToFirestore(key, value){
    try{
      if(!db) return;
      const payload = { value: value, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), deviceId, ts: Date.now() };
      await db.collection('kv').doc(key).set(payload, { merge: true });
    }catch(e){ console.warn('[FirebaseBridge] push error', e); }
  }

  // Monkey-patch localStorage to mirror to Firestore
  (function(){
    const _setItem = LS.setItem.bind(LS);
    const _removeItem = LS.removeItem.bind(LS);
    LS.setItem = function(k, v){
      _setItem(k, v);
      if(!syncing && getEnabled()) pushToFirestore(k, v);
    };
    LS.removeItem = function(k){
      _removeItem(k);
      if(!syncing && getEnabled() && db){
        db.collection('kv').doc(k).delete().catch(()=>{});
      }
    };
    // Also mirror clear() as best-effort (dangerous)
    const _clear = LS.clear.bind(LS);
    LS.clear = function(){
      const keys = Object.keys(LS);
      _clear();
      if(getEnabled() && db){
        keys.forEach(k=> db.collection('kv').doc(k).delete().catch(()=>{}) );
      }
    };
  })();

  // Wait for DOM to inject UI then initialize
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>{ injectUI(); initFirebase(); });
  } else {
    injectUI(); initFirebase();
  }
})();