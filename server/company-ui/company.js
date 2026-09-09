'use strict';
const $ = s => document.querySelector(s)
let token = '', me = null, selectedPanel = 'users', pending = false
const labels = { 'users.manage':'إدارة المستخدمين والصلاحيات','projects.manage':'إدارة جميع المشروعات','progress.view':'متابعة تقدم المشروعات','dry.view':'مشاهدة التكلفة المباشرة','dry.edit':'تعديل التكلفة المباشرة','commercial.view':'مشاهدة المصاريف والربح','commercial.edit':'تعديل المصاريف والربح','approval.manage':'اعتماد التسعير','reports.export':'تصدير التقارير' }
const errors = { AUTHENTICATION_FAILED:'بيانات الدخول أو رمز التحقق غير صحيح.', SESSION_EXPIRED:'انتهت الجلسة أو تغيرت صلاحياتك؛ سجّل الدخول مجددًا.', PERMISSION_DENIED:'لا تملك صلاحية هذا الإجراء.', REAUTHENTICATION_REQUIRED:'أكد هويتك من قسم تأكيد الهوية ثم أعد المحاولة.', LAST_ADMINISTRATOR:'لا يمكن تعطيل آخر مسؤول مفعّل أو سحب صلاحية إدارة المستخدمين منه.', TOO_MANY_ATTEMPTS:'محاولات كثيرة؛ حاول بعد 15 دقيقة.', INVALID_OTP:'رمز التحقق غير صحيح أو استُخدم بالفعل. انتظر الرمز التالي.', SETUP_CLOSED:'تم إعداد الشركة بالفعل.', SETUP_DENIED:'رمز الإعداد غير صحيح أو انتهت صلاحيته.', SETUP_ON_SERVER_ONLY:'نفّذ الإعداد الأول من جهاز السيرفر.', RECOVERY_DENIED:'بيانات الاسترداد غير صحيحة.', USERNAME_EXISTS:'اسم المستخدم مستخدم بالفعل.', MFA_ENROLLMENT_REQUIRED:'يجب ربط تطبيق التحقق أولًا.' }
function say(text) { $('#message').textContent = text }
function element(tag, text) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; return e }
async function api(route, method = 'GET', data) {
  const r = await fetch(route, { method, headers: { 'Content-Type':'application/json', ...(token ? { Authorization:'Bearer ' + token } : {}) }, ...(data !== undefined ? { body:JSON.stringify(data) } : {}) })
  const b = await r.json()
  if (!r.ok) { if (b.reason === 'SESSION_EXPIRED') reset(); throw new Error(errors[b.reason] || b.reason || 'تعذر تنفيذ الطلب') }
  return b
}
function reset() { token = ''; me = null; for (const id of ['workspace','mfa','recovery-codes','logout']) $('#' + id).hidden = true; $('#login').hidden = false; $('#mfa-secret').textContent = ''; $('#codes').textContent = ''; $('#permissions-dialog').close(); $('#users').replaceChildren(); $('#progress').replaceChildren(); $('#audit').replaceChildren() }
function bindForm(id, action) { $(id).addEventListener('submit', async e => { e.preventDefault(); if (pending) return; pending = true; say(''); const f = e.currentTarget; try { await action(Object.fromEntries(new FormData(f)), f) } catch (err) { say(err.message) } finally { pending = false } }) }
function click(id, action) { $(id).addEventListener('click', async () => { try { say(''); await action() } catch (e) { say(e.message) } }) }
function table(container, headers, rows) { const t = element('table'), head = element('tr'); headers.forEach(h => head.append(element('th', h))); t.append(head); rows.forEach(row => { const tr = element('tr'); row.forEach(v => { const td = element('td'); v instanceof Node ? td.append(v) : td.textContent = String(v ?? ''); tr.append(td) }); t.append(tr) }); container.replaceChildren(t) }
async function enter() {
  const data = await api('/company/me'); me = data.user
  $('#login').hidden = true; $('#workspace').hidden = false; $('#logout').hidden = false
  $('#welcome').textContent = 'مرحبًا، ' + me.name
  $('#show-users').hidden = !me.permissions.includes('users.manage'); $('#show-audit').hidden = !me.permissions.includes('users.manage'); $('#show-progress').hidden = !me.permissions.includes('progress.view'); $('#project-form').hidden = !me.permissions.includes('projects.manage')
  selectedPanel = me.permissions.includes('users.manage') ? 'users' : 'progress'
  if (selectedPanel === 'progress' && !me.permissions.includes('progress.view')) { say('حسابك جاهز. الربط بمساحة عمل Windows قيد التطوير.'); return }
  await panel(selectedPanel)
}
async function editUser(u) {
  const projects = await api('/company/projects')
  $('#editing-user').textContent = 'صلاحيات ' + u.name; const f = $('#permissions-form')
  f.elements.id.value = u.id; f.elements.role.value = u.role; f.elements.active.checked = u.active
  $('#project-grants').replaceChildren(...projects.projects.map(p => { const o = element('option', p.name); o.value = p.id; o.selected = u.projects.includes(p.id); return o }))
  $('#permission-fields').replaceChildren(...Object.entries(labels).map(([key, title]) => {
    const row = element('div'); row.className = 'permission'; row.append(element('span', title))
    const s = element('select'); s.name = key; s.setAttribute('aria-label', title)
    for (const [v, text] of [['inherit','حسب الدور'],['allow','سماح'],['deny','منع']]) { const o = element('option', text); o.value = v; s.append(o) }
    const current = u.overrides[key]; s.value = current ? current.allow ? 'allow' : 'deny' : 'inherit'
    const date = element('input'); date.type = 'datetime-local'; date.name = key + ':expiry'; date.setAttribute('aria-label', 'انتهاء استثناء ' + title)
    if (current?.expiresAt) date.value = new Date(current.expiresAt - new Date(current.expiresAt).getTimezoneOffset() * 60000).toISOString().slice(0,16)
    row.append(s,date); return row
  }))
  $('#permissions-dialog').showModal()
}
async function panel(name) {
  selectedPanel = name; for (const p of ['users','progress','audit']) $('#' + p + '-panel').hidden = p !== name
  if (name === 'users') {
    const data = await api('/company/users')
    table($('#users'), ['المستخدم','الدور','التحقق الثنائي','الحالة','الصلاحيات'], data.users.map(u => { const button = element('button','تعديل'); button.onclick = () => editUser(u).catch(e => say(e.message)); return [u.name,u.role,u.mfaEnabled ? 'مفعّل' : 'غير مفعّل',u.active ? 'فعّال' : 'معطّل',button] }))
  } else if (name === 'progress') {
    const data = await api('/company/progress'); $('#last-update').textContent = 'آخر اتصال ناجح: ' + new Date(data.serverTime).toLocaleString('ar-EG')
    table($('#progress'), ['المشروع','بنود مسعّرة / الإجمالي','التقدم','Dry Cost','الاعتماد','آخر تعديل'], data.projects.map(p => [p.name,`${p.pricedItems} / ${p.totalItems}`,p.progressPercent + '%',p.dryCost.toLocaleString('en-US'),p.approved ? 'معتمد' : 'غير معتمد',new Date(p.updatedAt).toLocaleString('ar-EG')]))
  } else { const data = await api('/company/audit'); table($('#audit'), ['الوقت','المستخدم','الإجراء','العنصر'], data.entries.map(a => [new Date(a.at).toLocaleString('ar-EG'),a.actor,a.action,a.target])) }
}
bindForm('#setup-form', async (b,f) => { await api('/company/setup','POST',b); f.reset(); $('#setup').hidden = true; $('#login').hidden = false; say('تم إنشاء الحساب. ادخل لربط Authenticator.') })
bindForm('#login-form', async (b,f) => { const a = await api('/company/login','POST',b); token = a.token; f.reset(); if (a.enrollmentRequired) { $('#login').hidden = true; $('#mfa').hidden = false; $('#logout').hidden = false } else await enter() })
click('#begin-mfa', async () => { const b = await api('/company/mfa/start','POST',{}); $('#mfa-secret').textContent = b.secret })
bindForm('#mfa-form', async (b,f) => { const a = await api('/company/mfa/confirm','POST',b); token = ''; f.reset(); $('#mfa-secret').textContent = ''; $('#mfa').hidden = true; $('#recovery-codes').hidden = false; $('#codes').textContent = a.recoveryCodes.join('\n') })
click('#saved-codes', () => { reset(); say('انتظر رمز Authenticator التالي ثم ادخل.') })
bindForm('#reauth-form', async (b,f) => { await api('/company/reauth','POST',b); f.reset(); say('تم تأكيد الهوية لمدة 5 دقائق.') })
bindForm('#recover-form', async (b,f) => { await api('/company/recover','POST',b); f.reset(); reset(); say('ادخل بكلمة المرور الجديدة ثم اربط Authenticator من جديد.') })
bindForm('#create-user-form', async (b,f) => { await api('/company/users','POST',b); f.reset(); await panel('users'); say('تم إنشاء المستخدم. حدّد مشروعاته من تعديل الصلاحيات.') })
bindForm('#project-form', async (b,f) => { await api('/company/projects','POST',b); f.reset(); await panel('progress') })
bindForm('#permissions-form', async (b,f) => {
  const overrides = {}; for (const key of Object.keys(labels)) if (b[key] !== 'inherit') { overrides[key] = { allow:b[key] === 'allow' }; if (b[key + ':expiry']) overrides[key].expiresAt = new Date(b[key + ':expiry']).getTime() }
  await api('/company/users/' + encodeURIComponent(b.id),'PUT',{ role:b.role, active:f.elements.active.checked, projects:[...$('#project-grants').selectedOptions].map(o => o.value), overrides })
  $('#permissions-dialog').close(); if (b.id === me.id) { reset(); say('تم تحديث صلاحياتك. سجّل الدخول مجددًا.') } else { await panel('users'); say('حُفظت الصلاحيات وأُلغيت جلسات المستخدم السابقة.') }
})
click('#cancel-permissions', () => $('#permissions-dialog').close())
click('#logout', async () => { try { await api('/company/logout','POST',{}) } finally { reset() } })
for (const p of ['users','progress','audit']) click('#show-' + p, () => panel(p))
click('#refresh', () => panel(selectedPanel))
setInterval(() => { if (token && me && selectedPanel === 'progress' && !document.hidden && me.permissions.includes('progress.view')) panel('progress').catch(e => { say('فشل التحديث: ' + e.message) }) },30000)
api('/health').then(h => { $('#setup').hidden = h.initialized; $('#login').hidden = !h.initialized }).catch(e => say('تعذر الاتصال بالسيرفر: ' + e.message))
