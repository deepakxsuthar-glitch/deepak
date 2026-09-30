(() => {
  const state = { csrf: '', data: null, realtime: false };
  const API_BASE = (window.DEEPAK_API_BASE || '').replace(/\/+$/, '');
  const apiUrl = (url) => `${API_BASE}${url}`;
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const formatDate = (value) => new Date(`${value}Z`).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const request = async (url, options = {}) => {
    const response = await fetch(apiUrl(url), { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(state.csrf ? { 'X-CSRF-Token': state.csrf } : {}), ...(options.headers || {}) } });
    let data;
    try { data = await response.json(); } catch {
      throw new Error('Admin API unavailable. Check that the backend is deployed and its URL is set in js/api-config.js.');
    }
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  };
  function showLogin(message = '') { $('#login-view').hidden = false; $('#dashboard-view').hidden = true; $('#login-error').textContent = message; }
  function render() {
    const { counts, events, content, messages, visitors, analytics, session } = state.data;
    $('#login-view').hidden = true; $('#dashboard-view').hidden = false; $('#environment').textContent = state.data.health.environment.toUpperCase(); $('#today').textContent = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });
    $('#active-visitors').textContent = visitors.length; $('#unread-messages').textContent = counts.unreadMessages; $('#published-sections').textContent = counts.publishedSections; $('#page-views').textContent = analytics.totals.pageViews; $('#message-badge').textContent = counts.unreadMessages; $('#health-label').textContent = 'Website'; $('#health-status').textContent = state.data.health.status.toUpperCase(); $('#connection').innerHTML = '<i></i> API connected'; $('#realtime-status').innerHTML = `<i${state.realtime ? '' : ' style="background:var(--orange)"'}></i> ${state.realtime ? 'SSE connected' : 'Reconnecting'}`;
    $('#analytics-source').textContent = analytics.source;
    const renderBars = (items, labelKey, valueKey) => { const max = Math.max(...items.map((item) => item[valueKey]), 1); return items.length ? items.map((item) => `<div class="bar-row"><span>${escapeHtml(item[labelKey])}</span><div><i style="width:${Math.round(item[valueKey] / max * 100)}%"></i></div><strong>${item[valueKey]}</strong></div>`).join('') : '<p class="empty">No page views recorded yet.</p>'; };
    $('#top-pages').innerHTML = renderBars(analytics.topPages, 'page', 'views'); $('#devices').innerHTML = renderBars(analytics.devices, 'device', 'views'); $('#browsers').innerHTML = renderBars(analytics.browsers, 'browser', 'views');
    const maxDaily = Math.max(...analytics.daily.map((item) => item.views), 1); $('#daily-views').innerHTML = analytics.daily.length ? analytics.daily.map((item) => `<div class="day-bar" title="${item.day}: ${item.views} views" style="height:${Math.max(8, Math.round(item.views / maxDaily * 100))}%"><span>${item.views}</span></div>`).join('') : '<p class="empty">No daily traffic recorded yet.</p>';
    const health = state.data.health;
    $('#health-list').innerHTML = [['Website', health.status === 'online' ? 'Online' : 'Unavailable', health.status === 'online' ? 'ok' : 'unavailable'], ['API', 'Connected', 'ok'], ['Database', health.database === 'connected' ? 'SQLite connected' : 'Unavailable', health.database === 'connected' ? 'ok' : 'unavailable'], ['Realtime', state.realtime ? 'Connected' : 'Reconnecting', state.realtime ? 'ok' : 'unavailable'], ['External analytics', 'Not configured', 'unavailable'], ['Last deployment', 'Not configured', 'unavailable'], ['Server uptime', `${health.uptimeSeconds}s`, 'ok']].map(([name, value, tone]) => `<div class="health-item"><span>${name}</span><strong class="${tone}">${value}</strong></div>`).join('');
    $('#activity-list').innerHTML = events.length ? events.map((item) => `<div class="activity-item"><i></i><div><strong>${escapeHtml(item.type)}</strong><small>${escapeHtml(item.detail)} · ${escapeHtml(item.category)}</small></div><time>${formatDate(item.created_at)}</time></div>`).join('') : '<p class="empty">No events recorded yet.</p>';
    $('#content-list').innerHTML = content.map((item) => `<div class="content-item" data-section="${escapeHtml(item.section)}"><label>${escapeHtml(item.section)}</label><div class="content-fields"><input class="content-title" aria-label="${escapeHtml(item.section)} title" value="${escapeHtml(item.title)}"><textarea class="content-body" aria-label="${escapeHtml(item.section)} body">${escapeHtml(item.body)}</textarea><div class="content-flags"><label><input class="content-enabled" type="checkbox" ${item.enabled ? 'checked' : ''}> Enabled</label><label><input class="content-published" type="checkbox" ${item.published ? 'checked' : ''}> Published</label></div></div><button class="save-content">Save</button></div>`).join('');
    $('#message-list').innerHTML = messages.length ? messages.map((item) => `<div class="message-item"><div><strong>${escapeHtml(item.subject)}</strong><small>${escapeHtml(item.name)} · ${escapeHtml(item.email)} · ${formatDate(item.created_at)}</small><p>${escapeHtml(item.message)}</p></div><select class="message-status" data-id="${item.id}"><option ${item.status === 'new' ? 'selected' : ''}>new</option><option ${item.status === 'read' ? 'selected' : ''}>read</option><option ${item.status === 'replied' ? 'selected' : ''}>replied</option><option ${item.status === 'archived' ? 'selected' : ''}>archived</option></select></div>`).join('') : '<p class="empty">No messages stored yet.</p>';
    $('#content-list').querySelectorAll('.save-content').forEach((button) => button.addEventListener('click', async () => { const row = button.closest('.content-item'); button.disabled = true; button.textContent = 'Saving'; try { await request(`/api/admin/content/${row.dataset.section}`, { method: 'PUT', body: JSON.stringify({ title: row.querySelector('.content-title').value, body: row.querySelector('.content-body').value, enabled: row.querySelector('.content-enabled').checked, published: row.querySelector('.content-published').checked }) }); button.textContent = 'Saved'; await load(); setTimeout(() => { if (button.isConnected) { button.disabled = false; button.textContent = 'Save'; } }, 1200); } catch (error) { button.disabled = false; button.textContent = error.message; } }));
    $('#message-list').querySelectorAll('.message-status').forEach((select) => select.addEventListener('change', async () => { select.disabled = true; try { await request(`/api/admin/messages/${select.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); await load(); } catch (error) { select.disabled = false; select.title = error.message; } }));
  }
  async function load({ preserveDrafts = false } = {}) {
    const drafts = preserveDrafts ? [...document.querySelectorAll('.content-item')].map((row) => ({ section: row.dataset.section, title: row.querySelector('.content-title').value, body: row.querySelector('.content-body').value, enabled: row.querySelector('.content-enabled').checked, published: row.querySelector('.content-published').checked })) : [];
    state.data = await request('/api/admin/bootstrap'); state.data.health = await request('/api/health'); state.csrf = state.data.session.csrfToken; render();
    drafts.forEach((draft) => {
      const row = [...document.querySelectorAll('.content-item')].find((item) => item.dataset.section === draft.section);
      if (!row) return;
      row.querySelector('.content-title').value = draft.title; row.querySelector('.content-body').value = draft.body; row.querySelector('.content-enabled').checked = draft.enabled; row.querySelector('.content-published').checked = draft.published;
    });
  }
  $('#login-form').addEventListener('submit', async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const button = event.currentTarget.querySelector('button'); button.disabled = true; button.textContent = 'Checking'; try { const result = await request('/api/admin/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) }); state.csrf = result.csrfToken; await load(); } catch (error) { showLogin(error.message); } finally { button.disabled = false; button.textContent = 'Sign in'; } });
  $('#logout').addEventListener('click', async () => { await request('/api/admin/logout', { method: 'POST' }); showLogin(); });
  load().catch((error) => showLogin(error.message));
  const stream = new EventSource(apiUrl('/api/admin/stream'), { withCredentials: true });
  stream.onopen = () => { state.realtime = true; if (state.data) render(); $('#connection').innerHTML = '<i></i> Connected'; };
  stream.onmessage = () => load({ preserveDrafts: true }).catch(() => {});
  stream.onerror = () => { state.realtime = false; $('#connection').innerHTML = '<i style="background:var(--orange)"></i> Reconnecting'; if (state.data) render(); };
})();
