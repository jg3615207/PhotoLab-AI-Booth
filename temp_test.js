
const API = window.location.origin;
let allStylesForSessions = [];


let liveJobsWs = null;
let analyticsChart = null;

function switchTab(tabId, element) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  if(element) element.classList.add('active');

  if (tabId === 'tab-jobs') {
    startLiveJobs();
  } else {
    stopLiveJobs();
  }

  if (tabId === 'tab-analytics') {
    loadAnalytics();
  }
}

async function startLiveJobs() {
  try {
    const r = await fetch(`${API}/api/admin/maintenance/live-jobs`);
    const jobs = await r.json();
    renderJobs(jobs);
  } catch(e) {
    console.error("Failed to load live jobs", e);
  }

  if (liveJobsWs) liveJobsWs.close();
  const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = location.port ? `${location.hostname}:${location.port}` : location.hostname;
  try {
    liveJobsWs = new WebSocket(`${wsProto}//${wsHost}/api/ws/admin`);
    liveJobsWs.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.event === 'job_update') {
          setTimeout(startLiveJobs, 400);
        }
      } catch(err) {}
    };
  } catch(err) {}
}

function stopLiveJobs() {
  if (liveJobsWs) {
    liveJobsWs.close();
    liveJobsWs = null;
  }
}

function renderJobs(jobs) {
  const container = document.getElementById('jobs-list');
  if (!container) return;
  if (!jobs || jobs.length === 0) {
    container.innerHTML = '<div style="color:#888; padding:16px; text-align:center;">No active jobs currently processing.</div>';
    return;
  }
  
  container.innerHTML = jobs.map(j => `
    <div style="background:#0d0d1a; padding:14px; border-radius:8px; display:flex; gap:16px; align-items:center; border: 1px solid #2a2a4e;">
      <img src="${API}/api/uploads/${j.job_id}/input.jpg" onerror="this.style.display='none'" style="width:60px; height:60px; object-fit:cover; border-radius:6px; background:#1a1a2e;" title="Uploaded Guest Photo">
      <div style="flex-grow:1;">
        <div style="font-weight:bold; font-size:15px; color:#fff; margin-bottom:4px;">Job ${j.job_id}</div>
        <div style="font-size:12px; color:#aaa;">Session: <strong style="color:#ddd;">${j.event_id || 'default'}</strong> | Style: <strong style="color:#667eea;">${j.style_id}</strong></div>
      </div>
      <div>
        <span class="status ${j.status === 'processing' ? 'status-active' : 'status-inactive'}" style="font-size:12px; padding:4px 10px;">${j.status.toUpperCase()}</span>
      </div>
    </div>
  `).join('');
}

async function loadAnalytics() {
  try {
    const r = await fetch(`${API}/api/admin/maintenance/stats`);
    const data = await r.json();
    
    document.getElementById('stat-total').textContent = data.total;
    document.getElementById('stat-today').textContent = data.today;
    document.getElementById('stat-cost').textContent = '$' + (data.today * 0.03).toFixed(2);
    
    const ctx = document.getElementById('hourlyChart').getContext('2d');
    if (analyticsChart) analyticsChart.destroy();
    
    const labels = Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0') + ':00');
    const chartData = new Array(24).fill(0);
    
    if (data.hourly) {
      data.hourly.forEach(item => {
        chartData[parseInt(item.hour, 10)] = item.count;
      });
    }
    
    analyticsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Generations Today',
          data: chartData,
          backgroundColor: '#667eea',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, grid: { color: '#2a2a4e' }, ticks: { color: '#888' } },
          x: { grid: { color: '#2a2a4e' }, ticks: { color: '#888' } }
        },
        plugins: {
          legend: { labels: { color: '#ddd' } }
        }
      }
    });
  } catch(e) {
    console.error("Failed to load analytics", e);
  }
}


async function loadSessions() {
  const r = await fetch(`${API}/api/events`);
  const sessions = await r.json();
  const sr = await fetch(`${API}/api/styles?admin=true`);
  allStylesForSessions = await sr.json();
  
  const list = document.getElementById('session-list');
  list.innerHTML = sessions.filter(s=>!s.archived).map(s => {
    const limitText = s.frame_cap > 0 ? s.frame_cap : '∞';
    return `
    <div class="session-row" style="grid-template-columns: 30px 1fr 2fr 1fr 1fr;">
      <input type="checkbox" class="sess-bulk-cb" value="${s.id}">
      <div><strong>${s.id}</strong></div>
      <div>${s.name}</div>
      <div>${s.jobs_count} / ${limitText}</div>
      <div style="display:flex;gap:4px;">
        <button class="btn btn-primary btn-sm" onclick="editSession('${s.id}')">Edit</button>
        <button class="btn btn-secondary btn-sm" onclick="cloneSession('${s.id}')">Clone</button>
        <button class="btn btn-secondary btn-sm" onclick="showSessionQR('${s.id}')">QR</button>
        ${s.active ? `<button class="btn btn-danger btn-sm" onclick="toggleSessionActive('${s.id}', 0)">Disable</button>` : `<button class="btn btn-primary btn-sm" onclick="toggleSessionActive('${s.id}', 1)">Enable</button>`}
      </div>
    </div>
  `}).join('');
}

function toggleAllSess(checked) {
  document.querySelectorAll('.sess-bulk-cb').forEach(c => c.checked = checked);
}

function showSessionQR(id) {
  const url = `${window.location.origin}/?session=${id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
  openLightbox(qrUrl);
}

async function cloneSession(id) {
  const r = await fetch(`${API}/api/events/${id}`);
  const s = await r.json();
  
  openSessionForm(); // Opens clean form
  
  document.getElementById('sess-edit-mode').value = "0";
  document.getElementById('sess-id').value = '';
  document.getElementById('sess-id').disabled = false;
  document.getElementById('sess-name').value = `Copy of ${s.name}`;
  document.getElementById('sess-print').value = s.allow_auto_print;
  document.getElementById('sess-cap').value = s.frame_cap || 0;
  document.getElementById('sess-expire').value = s.expire_date || '';
  
  // wait short timeout to allow openSessionForm's styles innerHTML to populate
  setTimeout(() => {
    document.querySelectorAll('.sess-style-cb').forEach(cb => {
      cb.checked = s.allowed_styles.includes(cb.value);
    });
  }, 100);
}

async function openSessionForm(editId = null) {
  const stylesList = document.getElementById('sess-styles-list');
  if (!allStylesForSessions.length) {
    const sr = await fetch(`${API}/api/styles?admin=true`);
    allStylesForSessions = await sr.json();
  }
  
  if (editId) {
    const r = await fetch(`${API}/api/events/${editId}`);
    const s = await r.json();
    document.getElementById('sess-edit-mode').value = "1";
    document.getElementById('sess-id').value = s.id;
    document.getElementById('sess-id').disabled = true;
    document.getElementById('sess-name').value = s.name;
    document.getElementById('sess-print').value = s.allow_auto_print;
    document.getElementById('sess-cap').value = s.frame_cap || 0;
    document.getElementById('sess-expire').value = s.expire_date || '';
    document.getElementById('sess-filters').value = s.enable_filters || 0;
    document.getElementById('sess-retakes').value = s.retake_limit !== undefined ? s.retake_limit : 3;
    document.getElementById('sess-qr-bg').value = s.qr_bg_color || '#ffffff';
    document.getElementById('sess-qr-fg').value = s.qr_fg_color || '#000000';
    
    // Show uploads in edit mode
    document.getElementById('sess-logo-row').style.display = '';
    document.getElementById('sess-frame-row').style.display = '';
    
    const logoImg = document.getElementById('sess-logo-preview');
    if (s.logo_path) {
      logoImg.src = `${API}/api/events/${editId}/logo?t=${Date.now()}`;
      logoImg.style.display = '';
      document.getElementById('sess-logo-status').textContent = 'Logo active';
    } else {
      logoImg.style.display = 'none';
      document.getElementById('sess-logo-status').textContent = 'No logo uploaded';
    }
    
    const frameImg = document.getElementById('sess-frame-preview');
    if (s.frame_path) {
      frameImg.src = `${API}/api/events/${editId}/frame?t=${Date.now()}`;
      frameImg.style.display = '';
      document.getElementById('sess-frame-status').textContent = 'Frame active';
    } else {
      frameImg.style.display = 'none';
      document.getElementById('sess-frame-status').textContent = 'No frame uploaded';
    }

    stylesList.innerHTML = allStylesForSessions.map(style => `
      <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
        <input type="checkbox" class="sess-style-cb" value="${style.id}" ${s.allowed_styles.includes(style.id) ? 'checked' : ''}> 
        <img class="sess-style-thumb" src="${API}${style.thumbnail}" onerror="this.style.display='none'">
        <span style="color:#ddd">${style.name}</span>
      </label>
    `).join('');
  } else {
    document.getElementById('sess-edit-mode').value = "0";
    document.getElementById('sess-id').value = '';
    document.getElementById('sess-id').disabled = false;
    document.getElementById('sess-name').value = '';
    document.getElementById('sess-print').value = "1";
    document.getElementById('sess-cap').value = "0";
    document.getElementById('sess-expire').value = '';
    document.getElementById('sess-filters').value = "0";
    document.getElementById('sess-retakes').value = "3";
    document.getElementById('sess-qr-bg').value = "#ffffff";
    document.getElementById('sess-qr-fg').value = "#000000";
    
    // Hide uploads in new mode
    document.getElementById('sess-logo-row').style.display = 'none';
    document.getElementById('sess-frame-row').style.display = 'none';

    stylesList.innerHTML = allStylesForSessions.map(style => `
      <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
        <input type="checkbox" class="sess-style-cb" value="${style.id}"> 
        <img class="sess-style-thumb" src="${API}${style.thumbnail}" onerror="this.style.display='none'">
        <span style="color:#ddd">${style.name}</span>
      </label>
    `).join('');
  }
  
  document.getElementById('session-form').style.display = 'block';
}

function chooseSessFile(type) {
  document.getElementById(`sess-${type}-file`).click();
}

async function handleSessFileUpload(type, event) {
  const file = event.target.files[0];
  if (!file) return;
  const sessId = document.getElementById('sess-id').value;
  if (!sessId) return alert("Save the session first.");

  const form = new FormData();
  form.append('image', file);

  const r = await fetch(`${API}/api/events/${sessId}/${type}`, {
    method: 'POST',
    body: form
  });

  if (r.ok) {
    const preview = document.getElementById(`sess-${type}-preview`);
    preview.src = `${API}/api/events/${sessId}/${type}?t=${Date.now()}`;
    preview.style.display = '';
    document.getElementById(`sess-${type}-status`).textContent = file.name + ' uploaded';
    alert(`${type.toUpperCase()} uploaded successfully!`);
  } else {
    alert(`Failed to upload ${type}`);
  }
  event.target.value = '';
}

function closeSessionForm() {
  document.getElementById('session-form').style.display = 'none';
}

async function saveSession() {
  const isEdit = document.getElementById('sess-edit-mode').value === "1";
  const id = document.getElementById('sess-id').value.trim();
  const name = document.getElementById('sess-name').value.trim();
  
  if (!id || !name) return alert("ID and Name are required.");
  
  const allowed_styles = Array.from(document.querySelectorAll('.sess-style-cb:checked')).map(cb => cb.value);
  const allow_auto_print = parseInt(document.getElementById('sess-print').value);
  const frame_cap = parseInt(document.getElementById('sess-cap').value) || 0;
  const expire_date = document.getElementById('sess-expire').value;
  const enable_filters = parseInt(document.getElementById('sess-filters').value) || 0;
  const retake_limit = parseInt(document.getElementById('sess-retakes').value);
  const qr_bg_color = document.getElementById('sess-qr-bg').value;
  const qr_fg_color = document.getElementById('sess-qr-fg').value;
  
  const payload = {
    id, name, allowed_styles, allow_auto_print, frame_cap, expire_date, enable_filters, retake_limit, qr_bg_color, qr_fg_color
  };
  
  const method = isEdit ? 'PUT' : 'POST';
  const url = isEdit ? `${API}/api/events/${id}` : `${API}/api/events`;
  
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (r.ok) {
    closeSessionForm();
    loadSessions();
  } else {
    const e = await r.json();
    alert("Failed: " + e.detail);
  }
}

async function editSession(id) {
  await openSessionForm(id);

async function toggleSessionActive(id, active) {
  const r = await fetch(`${API}/api/events/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active })
  });
  if (r.ok) loadSessions();
}

async function bulkArchiveSessions() {
  const ids = Array.from(document.querySelectorAll('.sess-bulk-cb:checked')).map(c => c.value);
  if (!ids.length) return alert("Select sessions to archive.");
  if (!confirm(`Archive ${ids.length} sessions?`)) return;
  const r = await fetch(`${API}/api/admin/maintenance/events/bulk-archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  });
  if (r.ok) loadSessions();
}

async function bulkDeleteSessions() {
  const ids = Array.from(document.querySelectorAll('.sess-bulk-cb:checked')).map(c => c.value);
  if (!ids.length) return alert("Select sessions to delete.");
  if (!confirm(`Permanently delete ${ids.length} sessions?`)) return;
  const r = await fetch(`${API}/api/admin/maintenance/events/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  });
  if (r.ok) loadSessions();
}



let v2Models = [];
(async function(){ try { const r=await fetch(`${API}/api/styles/v2-models`); v2Models=await r.json(); } catch(e){} })();

async function refresh() {
  const r = await fetch(`${API}/api/styles?admin=true`);
  const styles = await r.json();
  const list = document.getElementById('style-list');
  let totalCost = 0;
  list.innerHTML = styles.map(s => {
    const statusClass = s.active ? 'status-active' : 'status-inactive';
    const statusText = s.active ? __('admin.js.statusActive') : __('admin.js.statusHidden');
    const refOk = s.rh_ref_file ? true : false;
    totalCost += parseFloat(s.cost_money || 0);
    return `<div class="style-row" data-id="${s.id}">
      <div class="drag-handle">&#9776;</div>
      <img class="thumb" src="${API}${s.thumbnail}" onclick="openLightbox('${API}${s.thumbnail}?t=${Date.now()}')" style="cursor:pointer" onerror="this.style.background='#2a2a4e'">
      <div><strong>${s.name}</strong><br><small>${s.id}</small></div>
      <div><small>${s.prompt_template ? s.prompt_template.substring(0,60)+'...' : '<i>'+__('admin.js.labelNoPrompt')+'</i>'}</small><br>
        <span class="status ${refOk ? 'status-active' : 'status-inactive'}">ref ${refOk ? __('admin.js.labelRefOk') : __('admin.js.labelRefNone')}</span>
        <span class="status status-inactive" id="frame-status-${s.id}">${__('admin.js.labelFramePlaceholder')}</span>
      </div>
      <div><small>${__('admin.js.labelMaxPrefix')}${s.max_people} ${s.aspect_ratio} ${s.resolution}</small></div>
      <div><span class="status ${s.provider === 'v2' ? 'status-active' : 'status-inactive'}">${s.provider === 'v2' ? (v2Models.find(m=>m.id===s.v2_model)?.name || __('admin.js.labelProviderV2')) : __('admin.js.labelProviderV1WF')}</span></div>
      <div><span class="status ${statusClass}">${statusText}</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">
        <div class="dropdown">
          <button class="dropdown-btn">Frame ▼</button>
          <div class="dropdown-menu">
            <button onclick="uploadFrame('${s.id}')">${__('admin.js.buttonUploadFrame')}</button>
            <button onclick="viewFrame('${s.id}')">${__('admin.js.buttonViewFrame')}</button>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="editStyle('${s.id}')">${__('admin.js.buttonEdit')}</button>
        <button class="btn btn-primary btn-sm" onclick="openTestModal('${s.id}')">${__('admin.js.buttonTest')}</button>
        ${s.active ? `<button class="btn btn-danger btn-sm" onclick="deactivate('${s.id}')">${__('admin.js.buttonHide')}</button>` : `<button class="btn btn-primary btn-sm" onclick="activate('${s.id}')">${__('admin.js.buttonShow')}</button>`}
      </div>
    </div>`;
  }).join('');
  styles.forEach(s => checkFrame(s.id));
  document.getElementById('total-cost').textContent = __('admin.js.totalCost', totalCost.toFixed(3));
  loadAISettings();
  initSortable();
}

let sortableInstance = null;
function initSortable() {
  const el = document.getElementById('style-list');
  if (sortableInstance) sortableInstance.destroy();
  sortableInstance = new Sortable(el, {
    handle: '.drag-handle',
    animation: 150,
    onEnd: async function () {
      const items = Array.from(el.children);
      const ids = items.map(item => item.dataset.id).filter(id => id);
      if (ids.length > 0) {
        await fetch(`${API}/api/styles/reorder`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ids})
        });
      }
    }
  });
}

async function createStyle() {
  const id = document.getElementById('f-id').value.trim();
  const name = document.getElementById('f-name').value.trim();
  if (!id || !name) return alert(__('admin.js.idNameRequired'));
  const form = new FormData();
  form.append('id', id);
  form.append('name', name);
  form.append('max_people', document.getElementById('f-max-people').value);
  form.append('aspect_ratio', document.getElementById('f-aspect').value);
  form.append('prompt_template', document.getElementById('f-prompt').value);
  form.append('resolution', document.getElementById('f-resolution').value);
  form.append('seed', document.getElementById('f-seed').value);
  form.append('provider', document.getElementById('f-provider').value);
  form.append('v2_model', document.getElementById('f-v2-model').value);
  const q = document.getElementById('f-v2-quality').value;
  if (q) form.append('v2_quality', q);
  form.append('transition_type', document.getElementById('f-transition').value);
  form.append('animated_thumbnail', document.getElementById('f-animated-thumb').value);
  form.append('dynamic_prompt_enabled', parseInt(document.getElementById('f-dynamic-prompt').value));
  const r = await fetch(`${API}/api/styles`, { method:'POST', body: form });
  if (r.ok) {
    if (creatingRefBlob) {
      const refForm = new FormData();
      refForm.append('image', creatingRefBlob);
      await fetch(`${API}/api/styles/${id}/ref-image`, { method: 'POST', body: refForm });
    }
    creatingRefBlob = null;
    document.getElementById('f-ref-preview').style.display = 'none';
    document.getElementById('f-ref-status').textContent = __('admin.html.placeholderNoRefSelected') || 'No reference image selected';
    document.getElementById('add-form').classList.remove('show');
    refresh();
  } else {
    const e = await r.json();
    alert(e.detail || __('admin.js.createFailed'));
  }
}

async function createStyleAndGenRef() {
  const id = document.getElementById('f-id').value.trim();
  const name = document.getElementById('f-name').value.trim();
  if (!id || !name) return alert(__('admin.js.idNameRequired') || 'Style ID and Display Name are required.');
  
  const form = new FormData();
  form.append('id', id);
  form.append('name', name);
  form.append('max_people', document.getElementById('f-max-people').value);
  form.append('aspect_ratio', document.getElementById('f-aspect').value);
  form.append('prompt_template', document.getElementById('f-prompt').value);
  form.append('resolution', document.getElementById('f-resolution').value);
  form.append('seed', document.getElementById('f-seed').value);
  form.append('provider', document.getElementById('f-provider').value);
  form.append('v2_model', document.getElementById('f-v2-model').value);
  const q = document.getElementById('f-v2-quality').value;
  if (q) form.append('v2_quality', q);
  form.append('transition_type', document.getElementById('f-transition').value);
  form.append('animated_thumbnail', document.getElementById('f-animated-thumb').value);
  form.append('dynamic_prompt_enabled', parseInt(document.getElementById('f-dynamic-prompt').value));
  
  const r = await fetch(`${API}/api/styles`, { method:'POST', body: form });
  if (r.ok) {
    if (creatingRefBlob) {
      const refForm = new FormData();
      refForm.append('image', creatingRefBlob);
      await fetch(`${API}/api/styles/${id}/ref-image`, { method: 'POST', body: refForm });
    }
    creatingRefBlob = null;
    document.getElementById('f-ref-preview').style.display = 'none';
    document.getElementById('f-ref-status').textContent = __('admin.html.placeholderNoRefSelected') || 'No reference image selected';
    document.getElementById('add-form').classList.remove('show');
    
    refresh();
    setTimeout(() => {
      editStyle(id);
      showGenForm(id);
    }, 300);
  } else {
    const e = await r.json();
    alert(e.detail || __('admin.js.createFailed'));
  }
}

async function uploadRef(styleId) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async () => {
    if (!input.files[0]) return;
    const form = new FormData();
    form.append('image', input.files[0]);
    const r = await fetch(`${API}/api/styles/${styleId}/ref-image`, { method:'POST', body: form });
    const d = await r.json();
    alert(d.status === 'ok' ? __('admin.js.refUploaded', d.rh_ref_file || __('admin.js.manualUploadNeeded')) : __('admin.js.createFailed'));
    refresh();
  };
  input.click();
}

async function uploadFrame(styleId) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/png';
  input.onchange = async () => {
    if (!input.files[0]) return;
    const form = new FormData();
    form.append('image', input.files[0]);
    const r = await fetch(`${API}/api/styles/${styleId}/frame`, { method:'POST', body: form });
    const d = await r.json();
    alert(d.status === 'ok' ? __('admin.js.frameUploaded') : __('admin.js.createFailed'));
    refresh();
  };
  input.click();
}

async function deactivate(id) { if (confirm(__('admin.js.confirmHide'))) { const f = new FormData(); f.append('active','0'); await fetch(`${API}/api/styles/${id}`, {method:'PUT', body:f}); refresh(); } }
async function activate(id) { const f = new FormData(); f.append('active','1'); await fetch(`${API}/api/styles/${id}`, {method:'PUT', body:f}); refresh(); }

let editingId = null;
async function editStyle(id) {
  editingId = id;
  editingRefBlob = null;
  const r = await fetch(`${API}/api/styles?admin=true`);
  const styles = await r.json();
  const s = styles.find(x => x.id === id);
  if (!s) return alert(__('admin.js.styleNotFound'));
  document.getElementById('e-name').value = s.name || '';
  document.getElementById('e-prompt').value = s.prompt_template || '';
  document.getElementById('e-max-people').value = s.max_people || 1;
  document.getElementById('e-aspect').value = s.aspect_ratio || '2:3';
  document.getElementById('e-resolution').value = s.resolution || '2k';
  document.getElementById('e-seed').value = s.seed || '';
  document.getElementById('e-provider').value = s.provider || 'v2';
  document.getElementById('e-v2-model').value = s.v2_model || 'nb2-cheap';
  document.getElementById('e-v2-quality').value = s.v2_quality || 'medium';
  document.getElementById('e-transition').value = s.transition_type || 'glitch';
  document.getElementById('e-animated-thumb').value = s.animated_thumbnail || '';
  document.getElementById('e-dynamic-prompt').value = s.dynamic_prompt_enabled || 0;
  
  const previewImg = document.getElementById('e-ref-preview');
  const statusSpan = document.getElementById('e-ref-status');
  if (s.rh_ref_file || s.rh_ref_url) {
    previewImg.src = `${API}/api/styles/${id}/ref.jpg?t=${Date.now()}`;
    previewImg.style.display = '';
    statusSpan.textContent = 'Current style reference active';
  } else {
    previewImg.style.display = 'none';
    statusSpan.textContent = __('admin.html.placeholderNoRefSelected') || 'No reference image selected';
  }
  
  toggleModelPicker('edit');
  document.getElementById('edit-overlay').classList.add('show');
}
function closeEdit() {
  editingId = null;
  editingRefBlob = null;
  document.getElementById('e-ref-preview').style.display = 'none';
  document.getElementById('e-ref-status').textContent = '';
  document.getElementById('edit-overlay').classList.remove('show');
}
async function saveStyle() {
  if (!editingId) return;
  const form = new FormData();
  form.append('name', document.getElementById('e-name').value);
  form.append('prompt_template', document.getElementById('e-prompt').value);
  form.append('max_people', document.getElementById('e-max-people').value);
  form.append('aspect_ratio', document.getElementById('e-aspect').value);
  form.append('resolution', document.getElementById('e-resolution').value);
  form.append('seed', document.getElementById('e-seed').value);
  form.append('provider', document.getElementById('e-provider').value);
  if (document.getElementById('e-provider').value === 'v2') {
    form.append('v2_model', document.getElementById('e-v2-model').value);
    const eq = document.getElementById('e-v2-quality').value;
    if (eq) form.append('v2_quality', eq);
  }
  form.append('transition_type', document.getElementById('e-transition').value);
  form.append('animated_thumbnail', document.getElementById('e-animated-thumb').value);
  form.append('dynamic_prompt_enabled', parseInt(document.getElementById('e-dynamic-prompt').value));
  const r = await fetch(`${API}/api/styles/${editingId}`, { method:'PUT', body: form });
  if (r.ok) {
    if (editingRefBlob) {
      const refForm = new FormData();
      refForm.append('image', editingRefBlob);
      await fetch(`${API}/api/styles/${editingId}/ref-image`, { method: 'POST', body: refForm });
    }
    editingRefBlob = null;
    closeEdit();
    refresh();
  } else {
    const e = await r.json();
    alert(e.detail || __('admin.js.saveFailed'));
  }
}

function openLightbox(url) {
  const img = document.getElementById('lightbox-img');
  img.src = url;
  document.getElementById('lightbox').classList.add('show');
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('show');
}
function viewRef(id) {
  openLightbox(`${API}/api/styles/${id}/ref.jpg?t=${Date.now()}`);
}
function viewFrame(id) {
  openLightbox(`${API}/api/styles/${id}/frame.png?t=${Date.now()}`);
}
async function checkFrame(id) {
  const el = document.getElementById(`frame-status-${id}`);
  if (!el) return;
  try {
    const r = await fetch(`${API}/api/styles/${id}/frame.png`, { method:'HEAD' });
    el.className = r.ok ? 'status status-active' : 'status status-inactive';
    el.textContent = r.ok ? __('admin.js.labelFrameOk') : __('admin.js.labelNoFrame');
  } catch {
    el.className = 'status status-inactive';
    el.textContent = __('admin.js.labelNoFrame');
  }
}

let genStyleId = null;

function showGenForm(styleId) {
  genStyleId = styleId;
  fetch(`${API}/api/styles?admin=true`).then(r=>r.json()).then(styles => {
    const s = styles.find(x => x.id === styleId);
    if (!s) return alert(__('admin.js.styleNotFound'));
    document.getElementById('gen-style-name').textContent = `${s.name} (${s.id})`;
    document.getElementById('gen-prompt').value = s.prompt_template || '';
    document.getElementById('gen-aspect').value = s.aspect_ratio || '2:3';
    document.getElementById('gen-resolution').value = s.resolution || '2k';
    document.getElementById('gen-v2-model').value = s.v2_model || 'nb2-cheap';
    document.getElementById('gen-v2-quality').value = s.v2_quality || 'medium';
    toggleModelPicker('gen');
    document.getElementById('gen-loading').style.display = 'none';
    document.getElementById('gen-btn').disabled = false;
    document.getElementById('gen-overlay').classList.add('show');
  });
}

function closeGenForm() {
  genStyleId = null;
  document.getElementById('gen-overlay').classList.remove('show');
  document.getElementById('gen-loading').style.display = 'none';
  document.getElementById('gen-btn').disabled = false;
}

async function generateRef() {
  if (!genStyleId) return;
  const prompt = document.getElementById('gen-prompt').value.trim();
  if (!prompt) return alert(__('admin.js.promptRequired'));

  document.getElementById('gen-loading').style.display = 'block';
  document.getElementById('gen-btn').disabled = true;

  try {
    const r = await fetch(`${API}/api/styles/${genStyleId}/generate-ref`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        prompt: prompt,
        aspect_ratio: document.getElementById('gen-aspect').value,
        resolution: document.getElementById('gen-resolution').value,
        v2_model: document.getElementById('gen-v2-model').value,
        v2_quality: document.getElementById('gen-v2-quality').value || null,
      })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || __('admin.js.generationFailed'));

    document.getElementById('gen-overlay').classList.remove('show');
    document.getElementById('preview-img').src = `${API}${data.preview_url}?t=${Date.now()}`;
    document.getElementById('preview-cost').textContent = `Cost: $${data.cost_money.toFixed(4)} | Time: ${data.cost_time}s | Task: ${data.task_id}`;
    document.getElementById('preview-overlay').classList.add('show');
  } catch(e) {
    alert(__('admin.js.aiGenFailed', e.message));
    document.getElementById('gen-loading').style.display = 'none';
    document.getElementById('gen-btn').disabled = false;
  }
}

async function acceptRef() {
  if (!genStyleId) return;
  try {
    const r = await fetch(`${API}/api/styles/${genStyleId}/accept-ref`, { method:'POST' });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || __('admin.js.acceptFailed'));
    document.getElementById('preview-overlay').classList.remove('show');
    
    if (editingId === genStyleId) {
      const previewImg = document.getElementById('e-ref-preview');
      const statusSpan = document.getElementById('e-ref-status');
      previewImg.src = `${API}/api/styles/${editingId}/ref.jpg?t=${Date.now()}`;
      previewImg.style.display = '';
      statusSpan.textContent = 'Current style reference active';
    }
    
    genStyleId = null;
    refresh();
  } catch(e) {
    alert(__('admin.js.saveRefFailed', e.message));
  }
}

async function regenerateRef() {
  document.getElementById('preview-overlay').classList.remove('show');
  await fetch(`${API}/api/styles/${genStyleId}/generate-ref`, { method:'DELETE' }).catch(()=>{});
  showGenForm(genStyleId);
  setTimeout(() => generateRef(), 500);
}

async function cancelPreview() {
  if (genStyleId) {
    await fetch(`${API}/api/styles/${genStyleId}/generate-ref`, { method:'DELETE' }).catch(()=>{});
  }
  document.getElementById('preview-overlay').classList.remove('show');
  genStyleId = null;
}

function toggleModelPicker(prefix) {
  const provider = document.getElementById(`${prefix}-provider`)?.value || 'v2';
  const modelRow = document.getElementById(`${prefix}-model-row`);
  const qualityRow = document.getElementById(`${prefix}-quality-row`);
  if (!modelRow) return;
  if (provider === 'v2') {
    modelRow.style.display = '';
    const modelId = document.getElementById(`${prefix}-v2-model`)?.value;
    if (qualityRow) {
      const model = v2Models.find(m => m.id === modelId);
      qualityRow.style.display = (model && model.has_quality) ? '' : 'none';
    }
  } else {
    modelRow.style.display = 'none';
    if (qualityRow) qualityRow.style.display = 'none';
  }
}

// Wire change handlers for model selects to toggle quality
document.getElementById('f-v2-model')?.addEventListener('change', () => toggleModelPicker('add'));
document.getElementById('e-v2-model')?.addEventListener('change', () => toggleModelPicker('edit'));
document.getElementById('gen-v2-model')?.addEventListener('change', () => toggleModelPicker('gen'));

let testStyleId = null;
let testImageBlob = null;
let testPollIntervals = [];
let testCameraStream = null;

async function openTestModal(styleId) {
  testStyleId = styleId;
  const r = await fetch(`${API}/api/styles?admin=true`);
  const styles = await r.json();
  const s = styles.find(x => x.id === styleId);
  if (!s) return alert(__('admin.js.styleNotFound'));
  
  document.getElementById('test-title').textContent = __('admin.js.testTitle', s.name);
  document.getElementById('test-prompt').value = s.prompt_template || '';
  document.getElementById('test-resolution').value = s.resolution || '2k';
  document.getElementById('test-quality').value = s.v2_quality || '';
  document.getElementById('test-aspect').value = s.aspect_ratio || '2:3';
  document.getElementById('test-seed').value = s.seed || '';
  
  resetTestImage();
  
  for (let i = 0; i < 4; i++) {
    const cell = document.getElementById(`test-cell-${i}`);
    cell.querySelector('.cell-media-container').innerHTML = '<span style="color: #555; font-size: 11px;">(Select model to test)</span>';
    cell.querySelector('.cell-cost').style.display = 'none';
    const select = cell.querySelector('.cell-model-select');
    if (i === 0) {
      select.value = s.v2_model || 'nb2-cheap';
    } else {
      select.value = '';
    }
  }
  
  document.getElementById('test-status').style.display = 'none';
  document.getElementById('test-overlay').classList.add('show');
}

function closeTestModal() {
  try {
    stopTestCamera();
  } catch(e) { console.error(e); }
  
  try {
    testPollIntervals.forEach(clearInterval);
    testPollIntervals = [];
  } catch(e) { console.error(e); }
  
  testStyleId = null;
  testImageBlob = null;
  
  try {
    const canvas = document.getElementById('test-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  } catch(e) { console.error(e); }
  
  try {
    document.getElementById('test-overlay').classList.remove('show');
  } catch(e) { console.error(e); }
}

function handleOverlayClick(event) {
  if (event.target === document.getElementById('test-overlay')) {
    closeTestModal();
  }
}

function resetTestImage() {
  testImageBlob = null;
  document.getElementById('test-preview-img').classList.remove('active');
  document.getElementById('test-camera-video').classList.remove('active');
  document.getElementById('test-placeholder').style.display = '';
  document.getElementById('test-capture-btn').style.display = 'none';
  stopTestCamera();
  switchTestTab('upload');
}

function switchTestTab(tab) {
  document.querySelectorAll('.test-tab').forEach(t => t.classList.remove('active'));
  if (tab === 'upload') {
    document.querySelectorAll('.test-tab')[0].classList.add('active');
    stopTestCamera();
    document.getElementById('test-camera-video').classList.remove('active');
    document.getElementById('test-capture-btn').style.display = 'none';
    if (testImageBlob) {
      document.getElementById('test-preview-img').classList.add('active');
      document.getElementById('test-placeholder').style.display = 'none';
    }
  } else {
    document.querySelectorAll('.test-tab')[1].classList.add('active');
    startTestCamera();
  }
}

async function startTestCamera() {
  try {
    testCameraStream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: {ideal:1080}, height: {ideal:1920}, facingMode: 'user' } 
    });
    const video = document.getElementById('test-camera-video');
    video.srcObject = testCameraStream;
    video.classList.add('active');
    document.getElementById('test-preview-img').classList.remove('active');
    document.getElementById('test-placeholder').style.display = 'none';
    document.getElementById('test-capture-btn').style.display = '';
  } catch(e) {
    alert(__('admin.js.cameraNotAvailable', e.message));
    switchTestTab('upload');
  }
}

function stopTestCamera() {
  try {
    if (testCameraStream) {
      testCameraStream.getTracks().forEach(t => {
        try { t.stop(); } catch(err) {}
      });
      testCameraStream = null;
    }
  } catch(e) { console.error(e); }
  
  try {
    const video = document.getElementById('test-camera-video');
    if (video) video.classList.remove('active');
  } catch(e) { console.error(e); }
}

function captureTestPhoto() {
  const video = document.getElementById('test-camera-video');
  const canvas = document.getElementById('test-canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  canvas.toBlob(blob => {
    testImageBlob = blob;
    document.getElementById('test-preview-img').src = URL.createObjectURL(blob);
    document.getElementById('test-preview-img').classList.add('active');
    stopTestCamera();
    document.getElementById('test-capture-btn').style.display = 'none';
    document.querySelectorAll('.test-tab')[0].classList.add('active');
    document.querySelectorAll('.test-tab')[1].classList.remove('active');
  }, 'image/jpeg', 0.95);
}

function handleTestFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  testImageBlob = file;
  document.getElementById('test-preview-img').src = URL.createObjectURL(file);
  document.getElementById('test-preview-img').classList.add('active');
  document.getElementById('test-placeholder').style.display = 'none';
  stopTestCamera();
  document.getElementById('test-capture-btn').style.display = 'none';
}

async function submitTest() {
  if (!testImageBlob) return alert(__('admin.js.testPhotoRequired'));
  
  document.getElementById('test-status').style.display = 'block';
  document.getElementById('test-status-text').textContent = __('admin.js.runningTest');
  
  testPollIntervals.forEach(clearInterval);
  testPollIntervals = [];
  
  let activeJobs = 0;
  
  for (let i = 0; i < 4; i++) {
    const cell = document.getElementById(`test-cell-${i}`);
    const modelSelect = cell.querySelector('.cell-model-select');
    const modelId = modelSelect.value;
    const mediaContainer = cell.querySelector('.cell-media-container');
    const costEl = cell.querySelector('.cell-cost');
    
    if (!modelId) {
      mediaContainer.innerHTML = '<span style="color: #555; font-size: 11px;">(Select model to test)</span>';
      costEl.style.display = 'none';
      continue;
    }
    
    mediaContainer.innerHTML = '<div style="color:#667eea;font-size:12px;padding:8px;"><span class="spinner"></span> Running...</div>';
    costEl.style.display = 'none';
    
    const overrides = getTestOverrides();
    overrides.model = modelId;
    
    activeJobs++;
    
    (async (slotIndex, cellEl, selectVal) => {
      const jobId = await runSingleTest(overrides, slotIndex);
      if (jobId) {
        pollTestJob(jobId, cellEl, slotIndex);
      }
    })(i, cell, modelId);
  }
  
  if (activeJobs === 0) {
    document.getElementById('test-status').style.display = 'none';
    alert("Please select at least one model in the grid slots to test.");
  }
}

function getTestOverrides() {
  return {
    prompt: document.getElementById('test-prompt').value,
    resolution: document.getElementById('test-resolution').value,
    quality: document.getElementById('test-quality').value || null,
    aspect: document.getElementById('test-aspect').value,
    seed: document.getElementById('test-seed').value || null,
  };
}

async function runSingleTest(overrides, slotIndex) {
  const form = new FormData();
  form.append('image', testImageBlob, 'test.jpg');
  form.append('style_id', testStyleId);
  if (overrides.prompt) form.append('prompt_override', overrides.prompt);
  if (overrides.model) form.append('model_override', overrides.model);
  if (overrides.resolution) form.append('resolution_override', overrides.resolution);
  if (overrides.quality) form.append('quality_override', overrides.quality);
  if (overrides.aspect) form.append('aspect_override', overrides.aspect);
  if (overrides.seed) form.append('seed_override', overrides.seed);

  try {
    const r = await fetch(`${API}/api/capture`, { method: 'POST', body: form });
    const data = await r.json();
    if (data.error) {
      updateResultCell(slotIndex, null, data.error);
      return null;
    }
    return data.job_id;
  } catch(e) {
    updateResultCell(slotIndex, null, __('admin.js.requestFailed', e.message));
    return null;
  }
}

function updateResultCell(index, imageUrl, errorMsg) {
  const cell = document.getElementById(`test-cell-${index}`);
  if (!cell) return;
  const media = cell.querySelector('.cell-media-container');
  const cost = cell.querySelector('.cell-cost');
  if (errorMsg) {
    media.innerHTML = `<div style="color:#e44;font-size:12px;padding:8px;">Error: ${errorMsg}</div>`;
    cost.style.display = 'none';
  } else if (imageUrl) {
    const img = document.createElement('img');
    img.src = `${imageUrl}?t=${Date.now()}`;
    img.style.cssText = 'max-width:100%; max-height:180px; object-fit:contain; border-radius:4px; cursor:pointer;';
    img.onerror = function() {
      this.outerHTML = `<div style="color:#e44;font-size:12px;padding:8px;">${__('admin.js.imageLoadFailed')}</div>`;
    };
    img.onclick = () => openLightbox(imageUrl);
    media.innerHTML = '';
    media.appendChild(img);
    cost.textContent = __('admin.js.clickToViewFull') || 'Click to view';
    cost.style.display = 'block';
  }
  checkAllTestsComplete();
}

function pollTestJob(jobId, cell, index) {
  const iv = setInterval(async () => {
    try {
      const r = await fetch(`${API}/api/job/${jobId}`);
      const job = await r.json();
      const media = cell.querySelector('.cell-media-container');
      if (job.status === 'done') {
        clearInterval(iv);
        const fn = job.print_image ? job.print_image.split(/[/\\]/).slice(-2).join('/') : job.output_image;
        const url = `${API}/api/images/${fn}`;
        updateResultCell(index, url, null);
      } else if (job.status === 'failed') {
         clearInterval(iv);
         updateResultCell(index, null, job.error_message || __('admin.js.unknownError'));
      } else {
         media.innerHTML = `<div style="color:#667eea;font-size:12px;padding:8px;"><span class="spinner"></span> Running (${job.status})...</div>`;
      }
    } catch(e) {
       // keep polling
    }
  }, 2000);
  testPollIntervals.push(iv);
}

function checkAllTestsComplete() {
  const cells = document.querySelectorAll('#test-results .test-result-cell');
  let allDone = true;
  let activeCount = 0;
  cells.forEach(c => {
    const modelId = c.querySelector('.cell-model-select').value;
    if (modelId) {
      activeCount++;
      const media = c.querySelector('.cell-media-container');
      const isDone = media.querySelector('img') || media.innerHTML.includes('Error:');
      if (!isDone) {
        allDone = false;
      }
    }
  });
  if (allDone && activeCount > 0) {
    document.getElementById('test-status').style.display = 'none';
  }
}

window.addEventListener('langchange', function(e) {
  var btn = document.getElementById('lang-btn');
  if (btn) btn.textContent = e.detail.lang === 'en' ? '中文' : 'English';
});

const promptHistories = {};
let creatingRefBlob = null;
let editingRefBlob = null;
let pendingVisionAnalysis = null;

function chooseLocalRef(prefix) {
  document.getElementById(prefix + '-ref-file').click();
}

function handleModalRefUpload(prefix, event) {
  const file = event.target.files[0];
  if (!file) return;
  if (prefix === 'f') {
    creatingRefBlob = file;
  } else {
    editingRefBlob = file;
  }
  const preview = document.getElementById(prefix + '-ref-preview');
  const status = document.getElementById(prefix + '-ref-status');
  preview.src = URL.createObjectURL(file);
  preview.style.display = '';
  status.textContent = file.name + ' (' + (file.size/1024).toFixed(1) + ' KB)';
  
  if (pendingVisionAnalysis) {
    const textareaId = pendingVisionAnalysis;
    pendingVisionAnalysis = null;
    let btn = null;
    document.querySelectorAll('button').forEach(b => {
      if (b.getAttribute('onclick') && b.getAttribute('onclick').includes('optimizePromptFieldWithVision') && b.getAttribute('onclick').includes(textareaId)) {
        btn = b;
      }
    });
    runVisionAnalysis(textareaId, file, btn);
  }
  event.target.value = '';
}

async function optimizePromptFieldWithVision(textareaId, prefix, buttonEl) {
  let refBlob = (prefix === 'f') ? creatingRefBlob : editingRefBlob;
  if (!refBlob && prefix === 'e' && editingId) {
    const previewImg = document.getElementById('e-ref-preview');
    if (previewImg && previewImg.style.display !== 'none') {
      try {
        buttonEl.disabled = true;
        buttonEl.textContent = 'Reading Ref...';
        const response = await fetch(previewImg.src);
        const fetchedBlob = await response.blob();
        refBlob = new File([fetchedBlob], "ref.jpg", { type: "image/jpeg" });
        editingRefBlob = refBlob;
      } catch (e) {
        console.error("Failed to read existing ref image:", e);
      } finally {
        buttonEl.disabled = false;
        buttonEl.textContent = '📷 Gen with Ref';
      }
    }
  }
  
  if (!refBlob) {
    alert("No reference image has been selected/uploaded. Please select a Reference Image first. It will be saved for this style and analyzed by Vision AI.");
    pendingVisionAnalysis = textareaId;
    chooseLocalRef(prefix);
    return;
  }
  
  runVisionAnalysis(textareaId, refBlob, buttonEl);
}

async function runVisionAnalysis(textareaId, file, buttonEl) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;
  
  const origText = buttonEl ? buttonEl.textContent : '📷 Gen with Ref';
  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.textContent = '📷 Analyzing Ref...';
  }
  
  try {
    const form = new FormData();
    form.append('image', file);
    
    const r = await fetch('/api/styles/analyze-vision', {
      method: 'POST',
      body: form
    });
    
    const data = await r.json();
    if (!r.ok) {
      throw new Error(data.detail || 'Vision analysis failed');
    }
    
    promptHistories[textareaId] = textarea.value;
    const undoBtn = document.getElementById('undo-' + textareaId);
    if (undoBtn) undoBtn.disabled = false;
    
    textarea.value = data.optimized_prompt;
  } catch (e) {
    alert('Vision optimization failed: ' + e.message);
  } finally {
    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.textContent = origText;
    }
  }
}

async function optimizePromptField(textareaId, buttonEl) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;
  const rawPrompt = textarea.value.trim();
  if (!rawPrompt) {
    alert(__('admin.js.promptRequired') || 'Please enter a prompt first.');
    return;
  }
  
  const origText = buttonEl.textContent;
  buttonEl.disabled = true;
  buttonEl.textContent = '✨ Optimizing...';
  
  try {
    const form = new FormData();
    form.append('raw_prompt', rawPrompt);
    
    const r = await fetch('/api/styles/optimize-prompt', {
      method: 'POST',
      body: form
    });
    
    if (!r.ok) {
      const errData = await r.json().catch(() => ({}));
      throw new Error(errData.detail || 'Server returned an error');
    }
    
    const data = await r.json();
    
    promptHistories[textareaId] = textarea.value;
    const undoBtn = document.getElementById('undo-' + textareaId);
    if (undoBtn) undoBtn.disabled = false;
    
    textarea.value = data.optimized_prompt;
  } catch (e) {
    alert('Failed to optimize prompt: ' + e.message);
  } finally {
    buttonEl.disabled = false;
    buttonEl.textContent = origText;
  }
}

function undoPromptField(textareaId, buttonEl) {
  const textarea = document.getElementById(textareaId);
  if (textarea && promptHistories[textareaId] !== undefined) {
    textarea.value = promptHistories[textareaId];
    delete promptHistories[textareaId];
  }
  buttonEl.disabled = true;
}

async function loadAISettings() {
  try {
    const r = await fetch('/api/styles/settings');
    if (r.ok) {
      const data = await r.json();
      document.getElementById('s-api-base').value = data.openai_base_url || '';
      document.getElementById('s-api-key').value = data.openai_api_key || '';
      document.getElementById('s-model').value = data.openai_model || '';
      const customCssEl = document.getElementById('s-custom-css');
      if (customCssEl) customCssEl.value = data.custom_css || '';
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

async function testAISettings(btn) {
  const apiBase = document.getElementById('s-api-base').value.trim();
  const apiKey = document.getElementById('s-api-key').value.trim();
  const model = document.getElementById('s-model').value.trim();
  
  if (!apiBase || !apiKey || !model) {
    alert('Please fill in all settings fields.');
    return;
  }
  
  const statusDiv = document.getElementById('settings-status');
  statusDiv.style.color = '#667eea';
  statusDiv.textContent = 'Testing connection...';
  btn.disabled = true;
  
  try {
    const form = new FormData();
    form.append('api_key', apiKey);
    form.append('base_url', apiBase);
    form.append('model', model);
    
    const r = await fetch('/api/styles/settings/test', {
      method: 'POST',
      body: form
    });
    
    const data = await r.json();
    if (!r.ok) {
      throw new Error(data.detail || 'Test failed');
    }
    
    statusDiv.style.color = '#4f4';
    statusDiv.textContent = 'Connection test successful! Response: "' + data.response + '"';
  } catch (e) {
    statusDiv.style.color = '#f44';
    statusDiv.textContent = 'Connection test failed: ' + e.message;
  } finally {
    btn.disabled = false;
  }
}

async function saveAISettings(btn) {
  const apiBase = document.getElementById('s-api-base').value.trim();
  const apiKey = document.getElementById('s-api-key').value.trim();
  const model = document.getElementById('s-model').value.trim();
  
  if (!apiBase || !apiKey || !model) {
    alert('Please fill in all settings fields.');
    return;
  }
  
  const statusDiv = document.getElementById('settings-status');
  statusDiv.style.color = '#667eea';
  statusDiv.textContent = 'Testing and saving settings...';
  btn.disabled = true;
  
  try {
    const form = new FormData();
    form.append('api_key', apiKey);
    form.append('base_url', apiBase);
    form.append('model', model);
    const customCssEl = document.getElementById('s-custom-css');
    if (customCssEl) form.append('custom_css', customCssEl.value);
    
    const r = await fetch('/api/styles/settings/save', {
      method: 'POST',
      body: form
    });
    
    const data = await r.json();
    if (!r.ok) {
      throw new Error(data.detail || 'Save failed');
    }
    
    statusDiv.style.color = '#4f4';
    statusDiv.textContent = 'Settings saved successfully!';
    await loadAISettings(); // reload to get masked key
  } catch (e) {
    statusDiv.style.color = '#f44';
    statusDiv.textContent = 'Save failed: ' + e.message;
  } finally {
    btn.disabled = false;
  }
}

// Re-apply translations after dynamic DOM updates
const origRefresh = refresh;
refresh = function() {
  origRefresh();
  setTimeout(() => window.dispatchEvent(new Event('langchange')), 100);
};

async function clearCache() {
  if (!confirm("Are you sure you want to clear all uploads and cached images?")) return;
  try {
    const r = await fetch('/api/admin/maintenance/clear-cache', { method: 'POST' });
    const data = await r.json();
    if (r.ok) {
      alert(`Cache cleared successfully! Deleted ${data.cleared_files} files.`);
    } else {
      alert(`Failed: ${data.detail}`);
    }
  } catch (e) {
    alert(`Error: ${e.message}`);
  }
}

loadAISettings();
refresh();
loadSessions();
