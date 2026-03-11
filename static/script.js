const state = {
  stats: {},
  users: [],
  groups: [],
  logs: [],
  password: localStorage.getItem('dashboard_pwd') || ''
};

// Global Fetch Wrapper with Auth
async function authFetch(url, options = {}) {
  const headers = options.headers || {};
  headers['X-Dashboard-Password'] = state.password;
  
  const res = await fetch(url, { ...options, headers });
  
  if (res.status === 401) {
    showLogin();
    throw new Error('Unauthorized');
  }
  return res;
}

// UI Elements
const els = {
  statUsers: document.getElementById('stat-users'),
  statGroups: document.getElementById('stat-groups'),
  statUptime: document.getElementById('stat-uptime'),
  botStatusDot: document.getElementById('bot-status-dot'),
  botStatusText: document.getElementById('bot-status-text'),
  logsContainer: document.getElementById('logs-container'),
  masterUsersBody: document.getElementById('master-users-body'),
  broadcastsBody: document.getElementById('broadcasts-body'),
  tokenInput: document.getElementById('bot-token-input'),
  maskedToken: document.getElementById('masked-token-view'),
  welcomeImgInput: document.getElementById('welcome-img-input'),
  fallbackImgInput: document.getElementById('fallback-img-input'),
  coupleBgInput: document.getElementById('couple-bg-input')
};

async function init() {
  if (!state.password) {
    showLogin();
    return;
  }
  
  hideLogin();
  await refreshData();
  await refreshLogs();
  await refreshConfig();
  await refreshMood();
  
  // Polling
  setInterval(() => { if(state.password) refreshData(); }, 15000);
  setInterval(() => { if(state.password) refreshLogs(); }, 4000);
}

function showLogin() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.style.display = 'flex';
}

function hideLogin() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.style.display = 'none';
}

function logout() {
  localStorage.removeItem('dashboard_pwd');
  location.reload();
}

function downloadDB() {
  window.location.href = `/api/download_db?pwd=${state.password}`;
}

async function attemptLogin() {
  const pwdInput = document.getElementById('login-password');
  const errText = document.getElementById('login-error');
  const pwd = pwdInput.value;
  
  if (!pwd) return;
  
  state.password = pwd; // Temporary set to test
  try {
    const res = await authFetch('/api/config');
    if (res.ok) {
      localStorage.setItem('dashboard_pwd', pwd);
      hideLogin();
      init();
    }
  } catch (e) {
    errText.style.display = 'block';
    state.password = '';
  }
}

async function refreshData() {
  try {
    const res = await authFetch('/api/data');
    const data = await res.json();
    
    // Update State
    state.stats = data.stats;
    state.users = data.users;
    state.groups = data.groups;
    
    // Update Stats UI
    if (els.statUsers) els.statUsers.innerText = data.stats.total_users;
    if (els.statGroups) els.statGroups.innerText = data.stats.total_groups;
    if (els.statUptime) els.statUptime.innerText = data.stats.uptime;
    
    // Update Status
    if (els.botStatusDot) {
      if (data.stats.status === 'online') {
        els.botStatusDot.classList.add('online');
        if (els.botStatusText) els.botStatusText.innerText = 'System Online';
      } else {
        els.botStatusDot.classList.remove('online');
        if (els.botStatusText) els.botStatusText.innerText = 'System Offline';
      }
    }
    
    renderMasterTable(data.users);
    renderMasterGroups(data.groups);
    renderRecentTables(data.users, data.groups);
    renderBroadcastHistory(data.broadcasts);
    renderBannedUsers(data.banned_users);
    refreshFiles();
    
  } catch (e) {
    console.error("Data Refresh Failed", e);
  }
}

async function refreshFiles() {
  try {
    const res = await authFetch('/api/files');
    const files = await res.json();
    renderFiles(files);
  } catch (e) {}
}

function renderFiles(files) {
  const fBody = document.getElementById('files-body');
  if (!fBody) return;
  
  if (!files || files.length === 0) {
    fBody.innerHTML = '<tr><td colspan="3">Storage segments clear.</td></tr>';
  } else {
    fBody.innerHTML = files.map(f => `
      <tr>
        <td><code>${f.name}</code></td>
        <td><span class="v-tag" style="background:var(--secondary)">${f.size}</span></td>
        <td style="font-family: monospace; font-size: 0.8rem;">${f.time}</td>
      </tr>
    `).join('');
  }
}

function renderBannedUsers(banned) {
  const bBody = document.getElementById('banned-users-body');
  if (!bBody) return;
  
  if (!banned || banned.length === 0) {
    bBody.innerHTML = '<tr><td colspan="2">No active bans in neural network.</td></tr>';
  } else {
    bBody.innerHTML = banned.map(uid => `
      <tr>
        <td><code>${uid}</code></td>
        <td><span class="v-tag" style="background:var(--danger); box-shadow:none;">BLACK-LISTED</span></td>
      </tr>
    `).join('');
  }
}

async function refreshLogs() {
  try {
    const res = await authFetch('/api/logs');
    const logs = await res.json();
    
    if (els.logsContainer) {
      const newContent = logs.map(log => {
        let type = 'info';
        const low = log.toLowerCase();
        if (low.includes('error')) type = 'error';
        if (low.includes('warn')) type = 'warn';
        if (low.includes('system') || low.includes('init')) type = 'system';
        return `<div class="log-entry ${type}">${log}</div>`;
      }).join('');
      
      if (els.logsContainer.innerHTML !== newContent) {
        els.logsContainer.innerHTML = newContent;
        els.logsContainer.scrollTop = els.logsContainer.scrollHeight;
      }
    }
  } catch (e) {}
}

async function refreshConfig() {
  try {
    const res = await authFetch('/api/config');
    const config = await res.json();
    if (els.maskedToken) els.maskedToken.innerText = config.token;
    if (els.welcomeImgInput && config.welcome_img) els.welcomeImgInput.value = config.welcome_img;
    if (els.fallbackImgInput && config.fallback_img) els.fallbackImgInput.value = config.fallback_img;
    
    // Track inputs
    const trackUserInp = document.getElementById('tracked-user-input');
    const fwdGroupInp = document.getElementById('forward-group-input');
    if (trackUserInp && config.tracked_user_id) trackUserInp.value = config.tracked_user_id;
    if (fwdGroupInp && config.forward_group_id) fwdGroupInp.value = config.forward_group_id;
    if (els.coupleBgInput && config.couple_bg) els.coupleBgInput.value = config.couple_bg;
  } catch (e) {}
}

async function refreshMood() {
  try {
    const res = await authFetch('/api/mood');
    const data = await res.json();
    const moodSelect = document.getElementById('bot-mood-select');
    if (moodSelect && data.mood) {
        moodSelect.value = data.mood;
    }
  } catch (e) {}
}

async function updateBotMood() {
  const moodSelect = document.getElementById('bot-mood-select');
  if (!moodSelect) return;
  const mood = moodSelect.value;
  alertBox("Updating bot mood...", "info");
  
  try {
    const res = await authFetch('/api/mood', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood })
    });
    const data = await res.json();
    if (data.success) {
      alertBox("Bot mood updated successfully!", "success");
    } else {
      alertBox("Mood update failed: " + data.error, "danger");
    }
  } catch (e) {
    alertBox("Network error during mood update", "danger");
  }
}

async function updateAssets() {
  const welcome_img = els.welcomeImgInput.value;
  const fallback_img = els.fallbackImgInput.value;
  
  const trackUserInp = document.getElementById('tracked-user-input');
  const fwdGroupInp = document.getElementById('forward-group-input');
  const tracked_user_id = trackUserInp ? trackUserInp.value : '';
  const forward_group_id = fwdGroupInp ? fwdGroupInp.value : '';
  const couple_bg = els.coupleBgInput ? els.coupleBgInput.value : '';
  
  alertBox("Syncing configuration...", "info");
  try {
    const res = await authFetch('/api/config-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ welcome_img, fallback_img, tracked_user_id, forward_group_id, couple_bg })
    });
    const data = await res.json();
    if (data.success) {
      alertBox("Neural assets updated!", "success");
      refreshData();
    } else {
      alertBox("Sync failed: " + data.error, "danger");
    }
  } catch (e) {
    alertBox("Network error during sync", "danger");
  }
}

function renderRecentTables(users, groups) {
  const uBody = document.getElementById('users-body');
  const gBody = document.getElementById('groups-body');
  
  if (uBody) {
    uBody.innerHTML = users.slice(0, 5).map(u => `
      <tr>
        <td><code>${u.id}</code></td>
        <td>${u.full_name || u.name || 'Unknown'}</td>
        <td>${u.username ? '@' + u.username : '-'}</td>
        <td>${u.joined_at || '-'}</td>
      </tr>
    `).join('') || '<tr><td colspan="4">No users.</td></tr>';
  }
  
  if (gBody) {
    gBody.innerHTML = groups.slice(0, 5).map(g => `
      <tr>
        <td><code>${g.id}</code></td>
        <td>${g.title || 'Unknown'}</td>
        <td><span class="v-tag" style="background: var(--secondary); box-shadow:none;">${g.type || 'group'}</span></td>
        <td>${g.added_at || '-'}</td>
      </tr>
    `).join('') || '<tr><td colspan="4">No groups.</td></tr>';
  }
}

function renderMasterTable(users) {
  if (els.masterUsersBody) {
    els.masterUsersBody.innerHTML = users.map(u => `
      <tr>
        <td><code>${u.id}</code></td>
        <td>${u.full_name || u.name || 'Unknown'}</td>
        <td>${u.username ? '@' + u.username : '-'}</td>
        <td>${u.joined_at || '-'}</td>
      </tr>
    `).join('') || '<tr><td colspan="4">No records.</td></tr>';
  }
}

function renderMasterGroups(groups) {
  const gBody = document.getElementById('master-groups-body');
  if (gBody) {
    gBody.innerHTML = groups.map(g => `
      <tr>
        <td><code>${g.id}</code></td>
        <td>${g.title || 'Unknown'}</td>
        <td><span class="v-tag" style="background: var(--secondary); box-shadow:none;">${g.type || 'group'}</span></td>
        <td>${g.added_at || '-'}</td>
      </tr>
    `).join('') || '<tr><td colspan="4">No records.</td></tr>';
  }
}

function renderBroadcastHistory(broadcasts) {
  if (els.broadcastsBody) {
    els.broadcastsBody.innerHTML = broadcasts.map(b => `
      <tr>
        <td><code>#${b.id}</code></td>
        <td>${b.text.substring(0, 40)}${b.text.length > 40 ? '...' : ''}</td>
        <td><span class="v-tag">${b.target}</span></td>
        <td><span style="color:var(--success)">${b.sent_count} ✅</span> / <span style="color:var(--danger)">${b.failed_count} ❌</span></td>
        <td>${b.timestamp}</td>
        <td>
          <button class="btn btn-danger" style="padding: 5px 12px; font-size: 0.75rem;" onclick="deleteBroadcast(${b.id})">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6">No history.</td></tr>';
  }
}

// Actions
async function controlBot(action) {
  if (!confirm(`Confirm system action: ${action}?`)) return;
  alertBox(`Executing ${action}...`, 'info');
  
  try {
    const res = await authFetch('/api/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (data.success) {
      alertBox(`Action ${action} successful!`, 'success');
      if (action === 'restart') setTimeout(() => location.reload(), 3000);
      refreshData();
    } else {
       alertBox(`Error: ${data.error}`, 'danger');
    }
  } catch (e) {
    alertBox(`Network failed`, 'danger');
  }
}

async function executeMessageAction(action) {
  const urlParams = document.getElementById('admin-msg-url').value.trim();
  if (!urlParams) return alertBox("Please enter a valid message URL", "danger");

  if (!confirm(`Are you sure you want to ${action} this message?`)) return;
  alertBox(`Requesting ${action}...`, 'info');
  
  const endpoint = `/api/${action}_msg`;
  try {
    const res = await authFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlParams })
    });
    const data = await res.json();
    if (data.success) {
      alertBox(`Message ${action} successful!`, 'success');
      if (action === 'delete') document.getElementById('admin-msg-url').value = '';
    } else {
       alertBox(`Error: ${data.error}`, 'danger');
    }
  } catch (e) {
    alertBox(`Network failed`, 'danger');
  }
}

async function executeAdmin(action) {
  const uid = document.getElementById('admin-user-id').value.trim();
  const gid = document.getElementById('admin-group-id').value.trim();
  
  if (!uid && action !== 'unban') return alertBox("User ID required", "danger");

  alertBox(`Executing ${action}...`, "info");
  
  try {
    const res = await authFetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: action, user_id: uid, chat_id: gid })
    });
    const data = await res.json();
    if (data.success) {
      alertBox(`Success: ${data.message || 'Action executed'}`, "success");
    } else {
      alertBox(`Failed: ${data.error}`, "danger");
    }
  } catch(e) {
    alertBox("Admin Action Failed", "danger");
  }
}

async function updateBotToken() {
  const token = els.tokenInput.value;
  if (!token) return alert("Please enter a new token!");
  
  if (!confirm("Update Bot Token? This will require a manual restart.")) return;
  
  try {
    const res = await authFetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();
    if (data.success) {
      alertBox("Token updated! Click RESTART to apply.", "success");
      els.tokenInput.value = '';
      refreshConfig();
    } else {
      alertBox("Failed: " + data.error, "danger");
    }
  } catch (e) {
    alertBox("Update failed", "danger");
  }
}

async function sendBroadcast(target) {
    const msgInput = document.getElementById('broadcast-msg');
    const targetInput = document.getElementById('broadcast-target-id');
    const message = msgInput.value;
    
    if (!message) return alert("Message is empty!");
    if (target === 'specific') {
        target = targetInput.value.trim();
        if (!target) return alert("Please enter a Specific Target ID!");
    }
    
    alertBox(`Broadcasting to ${target}...`, 'info');
    try {
        const res = await authFetch('/api/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target, message })
        });
        const data = await res.json();
        if (data.status === 'success') {
            alertBox(`Broadcast sent to ${data.sent} users!`, 'success');
            msgInput.value = '';
            refreshData();
        } else {
            alertBox("Failed to broadcast.", "danger");
        }
    } catch (e) {
        alertBox("Broadcast error", "danger");
    }
}

async function deleteBroadcast(id) {
  if (!confirm(`Delete broadcast #${id}?`)) return;
  try {
    await authFetch(`/api/broadcasts/${id}`, { method: 'DELETE' });
    refreshData();
  } catch(e) {}
}

async function trackUsers() {
  if (!confirm("Track all users metadata? This may take time.")) return;
  await controlBot('track_users');
}

function filterUsers() {
  const query = document.getElementById('user-search').value.toLowerCase();
  const rows = document.querySelectorAll('#master-users-table tbody tr');
  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(query) ? '' : 'none';
  });
}

function filterGroups() {
  const query = document.getElementById('group-search').value.toLowerCase();
  const rows = document.querySelectorAll('#master-groups-table tbody tr');
  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(query) ? '' : 'none';
  });
}

function alertBox(text, type) {
  // Create a toast notification instead of basic alert
  const toast = document.createElement('div');
  toast.className = `alert-toast alert-${type}`;
  toast.innerText = text;
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.right = '20px';
  toast.style.padding = '15px 25px';
  toast.style.borderRadius = '8px';
  toast.style.color = '#fff';
  toast.style.fontWeight = 'bold';
  toast.style.zIndex = '9999';
  toast.style.transition = 'opacity 0.3s ease';
  
  // Set color based on type
  if (type === 'success') toast.style.backgroundColor = '#28a745';
  else if (type === 'danger') toast.style.backgroundColor = '#dc3545';
  else if (type === 'info') toast.style.backgroundColor = '#17a2b8';
  else toast.style.backgroundColor = '#333';
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    init();
    
    // Enter key for login
    const loginPass = document.getElementById('login-password');
    if (loginPass) {
        loginPass.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') attemptLogin();
        });
    }
});

