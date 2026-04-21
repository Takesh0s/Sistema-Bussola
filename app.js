/* ==========================================================
   app.js — Sistema Bússola SPA
   Router + todos os módulos em um arquivo JS separado
   ========================================================== */

// ── Router ─────────────────────────────────────────────────
const VIEWS = {};

function registerView(name, fn) { VIEWS[name] = fn; }

async function navigate(view) {
  const target = view || location.hash.slice(1) || 'dashboard';
  location.hash = target;

  // Marca nav ativo
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.classList.toggle('active', el.dataset.view === target);
  });

  // Fecha sidebar no mobile
  closeSidebar();

  // Título do browser
  const labels = {
    dashboard:'Painel', conselheiros:'Conselheiros', unidades:'Unidades',
    desbravadores:'Desbravadores', especialidades:'Especialidades',
    mensalidades:'Mensalidades', caixa:'Caixa',
    patrimonio:'Patrimônio', atas:'Atas e Atos', relatorios:'Relatórios'
  };
  document.title = `Sistema Bússola — ${labels[target] || target}`;

  const container = document.getElementById('viewContainer');
  container.innerHTML = '<div style="padding:60px;text-align:center"><span class="spinner" style="width:32px;height:32px"></span></div>';

  if (VIEWS[target]) {
    await VIEWS[target](container);
    container.classList.remove('fade-in');
    void container.offsetWidth;
    container.classList.add('fade-in');
  } else {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🧭</div><p>Página não encontrada.</p></div>';
  }
}

// ── Modal global ────────────────────────────────────────────
function openModal(title, bodyHTML) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHTML;
  document.getElementById('modalBackdrop').classList.add('open');
}
function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
}
document.getElementById('modalBackdrop').addEventListener('click', e => {
  if (e.target === document.getElementById('modalBackdrop')) closeModal();
});

// ── Sidebar mobile ──────────────────────────────────────────
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}
document.getElementById('sidebarToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
});
document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

// ── Nav item clicks ─────────────────────────────────────────
document.querySelectorAll('.nav-item[data-view]').forEach(el => {
  el.addEventListener('click', () => navigate(el.dataset.view));
});

// ── Hashchange ──────────────────────────────────────────────
window.addEventListener('hashchange', () => navigate());

// ── Init ────────────────────────────────────────────────────
(async () => {
  const session = await requireAuth();
  document.getElementById('sidebarEmail').textContent = session.user.email;

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await db.auth.signOut();
    location.href = 'index.html';
  });

  navigate();
})();

/* ==========================================================
   HELPERS compartilhados
   ========================================================== */
function pageHeader(icon, title, subtitle = '') {
  return `
    <div class="page-header">
      <div class="page-header-left">
        <span class="page-icon">${icon}</span>
        <div><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div>
      </div>
    </div>`;
}

function emptyRow(cols, icon, msg) {
  return `<tr><td colspan="${cols}"><div class="empty-state"><div class="empty-icon">${icon}</div><p>${msg}</p></div></td></tr>`;
}

/* ==========================================================
   VIEW — DASHBOARD
   ========================================================== */
registerView('dashboard', async (el) => {
  el.innerHTML = `
    ${pageHeader('📊', 'Painel de Controle', 'Visão geral do clube')}
    <div class="stats-bar">
      <div class="stat-item"><div class="stat-label">Unidades</div><div class="stat-value" id="stU">—</div></div>
      <div class="stat-item"><div class="stat-label">Desbravadores</div><div class="stat-value" id="stD">—</div></div>
      <div class="stat-item"><div class="stat-label">Em Aberto</div><div class="stat-value" id="stM" style="color:var(--c-amber)">—</div></div>
      <div class="stat-item"><div class="stat-label">Saldo do Caixa</div><div class="stat-value" id="stC" style="font-size:1.1rem">—</div></div>
    </div>
    <div class="dash-grid">
      ${[
        ['conselheiros','🎖️','Conselheiros','Cadastro de líderes'],
        ['unidades','🏕️','Unidades','Gerenciar unidades'],
        ['desbravadores','👤','Desbravadores','Membros e classes'],
        ['especialidades','⭐','Especialidades','Lista de especialidades'],
        ['mensalidades','💳','Mensalidades','Controle de pagamentos'],
        ['caixa','💰','Caixa','Entradas e saídas'],
        ['patrimonio','📦','Patrimônio','Inventário do clube'],
        ['atas','📋','Atas e Atos','Registros oficiais'],
        ['relatorios','📄','Relatórios','Gerar documentos PDF'],
      ].map(([v,i,l,d]) =>
        `<div class="dash-card" onclick="navigate('${v}')">
          <div class="dash-card-icon">${i}</div>
          <div class="dash-card-label">${l}</div>
          <div class="dash-card-desc">${d}</div>
        </div>`
      ).join('')}
    </div>`;

  const [u, d, m, c] = await Promise.all([
    db.from('unidade').select('id', { count:'exact', head:true }),
    db.from('desbravador').select('id', { count:'exact', head:true }),
    db.from('mensalidade').select('id', { count:'exact', head:true }).eq('pago', false),
    db.from('caixa').select('tipo, valor'),
  ]);

  document.getElementById('stU').textContent = u.count ?? 0;
  document.getElementById('stD').textContent = d.count ?? 0;
  document.getElementById('stM').textContent = m.count ?? 0;

  if (c.data) {
    const saldo = c.data.reduce((a, r) => r.tipo === 'entrada' ? a + +r.valor : a - +r.valor, 0);
    const el2 = document.getElementById('stC');
    el2.textContent = brl(saldo);
    el2.style.color = saldo >= 0 ? 'var(--c-green)' : 'var(--c-red)';
  }
});

/* ==========================================================
   VIEW — CONSELHEIROS
   ========================================================== */
registerView('conselheiros', async (el) => {
  el.innerHTML = `
    ${pageHeader('🎖️','Conselheiros','Líderes e conselheiros do clube')}
    <div class="two-col">
      <div class="card">
        <div class="card-header"><div class="icon">🎖️</div><div><h2 id="cFormTitle">Novo Conselheiro</h2></div></div>
        <input type="hidden" id="cEditId"/>
        <div class="form-group"><label>Nome Completo</label><input id="cNome" placeholder="Nome do conselheiro"/></div>
        <div class="form-group"><label>Telefone / WhatsApp</label><input id="cTel" placeholder="(00) 00000-0000"/></div>
        <div class="form-group"><label>E-mail</label><input type="email" id="cEmail" placeholder="email@exemplo.com"/></div>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn btn-primary btn-full" id="cBtnSalvar">Cadastrar</button>
          <button class="btn btn-secondary" id="cBtnCancel" style="display:none">Cancelar</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="icon">📋</div><div><h2>Cadastrados</h2></div></div>
        <div class="table-wrap">
          <table><thead><tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th></th></tr></thead>
          <tbody id="cTbody"></tbody></table>
        </div>
      </div>
    </div>`;

  async function listar() {
    const { data } = await db.from('conselheiro').select('*').order('nome');
    const tbody = document.getElementById('cTbody');
    if (!data?.length) { tbody.innerHTML = emptyRow(4,'🎖️','Nenhum conselheiro cadastrado.'); return; }
    tbody.innerHTML = data.map(c => `
      <tr>
        <td><strong>${c.nome}</strong></td>
        <td style="color:var(--c-muted)">${c.telefone||'—'}</td>
        <td style="color:var(--c-muted);font-size:.8rem">${c.email||'—'}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-icon" onclick="cEditar('${c.id}','${c.nome.replace(/'/g,"\\'")}','${(c.telefone||'').replace(/'/g,"\\'")}','${(c.email||'').replace(/'/g,"\\'")}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="cExcluir('${c.id}')">✕</button>
          </div>
        </td>
      </tr>`).join('');
  }

  window.cEditar = (id, nome, tel, email) => {
    document.getElementById('cEditId').value = id;
    document.getElementById('cNome').value = nome;
    document.getElementById('cTel').value = tel;
    document.getElementById('cEmail').value = email;
    document.getElementById('cFormTitle').textContent = 'Editar Conselheiro';
    document.getElementById('cBtnSalvar').textContent = 'Salvar';
    document.getElementById('cBtnCancel').style.display = '';
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  window.cExcluir = async (id) => {
    if (!confirm('Excluir este conselheiro?')) return;
    const { error } = await db.from('conselheiro').delete().eq('id', id);
    if (error) flash(error.message,'error'); else { flash('Conselheiro excluído.'); listar(); }
  };

  function cancelar() {
    document.getElementById('cEditId').value = '';
    document.getElementById('cNome').value = '';
    document.getElementById('cTel').value = '';
    document.getElementById('cEmail').value = '';
    document.getElementById('cFormTitle').textContent = 'Novo Conselheiro';
    document.getElementById('cBtnSalvar').textContent = 'Cadastrar';
    document.getElementById('cBtnCancel').style.display = 'none';
  }

  document.getElementById('cBtnSalvar').addEventListener('click', async () => {
    const id    = document.getElementById('cEditId').value;
    const nome  = document.getElementById('cNome').value.trim();
    const tel   = document.getElementById('cTel').value.trim();
    const email = document.getElementById('cEmail').value.trim();
    if (!nome) { flash('Informe o nome.','error'); return; }
    const payload = { nome, telefone: tel||null, email: email||null };
    const op = id ? db.from('conselheiro').update(payload).eq('id',id) : db.from('conselheiro').insert([payload]);
    const { error } = await op;
    if (error) { flash(error.message,'error'); return; }
    flash(id ? 'Conselheiro atualizado!' : 'Conselheiro cadastrado!');
    cancelar(); listar();
  });
  document.getElementById('cBtnCancel').addEventListener('click', cancelar);
  listar();
});

/* ==========================================================
   VIEW — UNIDADES
   ========================================================== */
registerView('unidades', async (el) => {
  el.innerHTML = `
    ${pageHeader('🏕️','Gestão de Unidades','Unidades do clube')}
    <div class="two-col">
      <div class="card">
        <div class="card-header"><div class="icon">🏕️</div><div><h2 id="uFormTitle">Nova Unidade</h2></div></div>
        <input type="hidden" id="uEditId"/>
        <div class="form-group"><label>Nome da Unidade</label><input id="uNome" placeholder="Ex: Unidade Águias"/></div>
        <div class="form-group"><label>Conselheiro Titular</label><select id="uCons"><option value="">Selecione...</option></select></div>
        <div class="form-group"><label>Associado 1 <span style="color:var(--c-muted);font-weight:400">(opcional)</span></label><select id="uA1"><option value="">Nenhum</option></select></div>
        <div class="form-group"><label>Associado 2 <span style="color:var(--c-muted);font-weight:400">(opcional)</span></label><select id="uA2"><option value="">Nenhum</option></select></div>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn btn-primary btn-full" id="uBtnSalvar">Cadastrar Unidade</button>
          <button class="btn btn-secondary" id="uBtnCancel" style="display:none">Cancelar</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="icon">📋</div><div><h2>Unidades Cadastradas</h2></div></div>
        <div class="table-wrap">
          <table><thead><tr><th>Unidade</th><th>Membros</th><th></th></tr></thead>
          <tbody id="uTbody"></tbody></table>
        </div>
      </div>
    </div>`;

  const { data: cons } = await db.from('conselheiro').select('*').order('nome');
  const opts = (cons||[]).map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
  document.getElementById('uCons').innerHTML = '<option value="">Selecione...</option>' + opts;
  document.getElementById('uA1').innerHTML   = '<option value="">Nenhum</option>' + opts;
  document.getElementById('uA2').innerHTML   = '<option value="">Nenhum</option>' + opts;

  async function listar() {
    const [{ data: unidades }, { data: membros }] = await Promise.all([
      db.from('unidade').select('*').order('nome'),
      db.from('unidade_membro').select('unidade_id, tipo, conselheiro:conselheiro_id(id,nome)'),
    ]);
    const tbody = document.getElementById('uTbody');
    if (!unidades?.length) { tbody.innerHTML = emptyRow(3,'🏕️','Nenhuma unidade cadastrada.'); return; }
    tbody.innerHTML = unidades.map(u => {
      const mems = (membros||[]).filter(m => m.unidade_id === u.id);
      const tit  = mems.find(m => m.tipo === 'conselheiro');
      const ascs = mems.filter(m => m.tipo === 'associado');
      const str  = [
        tit ? `<span class="badge badge-teal">${tit.conselheiro?.nome}</span>` : '',
        ...ascs.map(a => `<span class="chip">${a.conselheiro?.nome}</span>`)
      ].filter(Boolean).join(' ') || '—';
      return `
        <tr>
          <td><strong>${u.nome}</strong></td>
          <td style="font-size:.82rem">${str}</td>
          <td>
            <div style="display:flex;gap:4px">
              <button class="btn btn-icon" onclick="uEditar('${u.id}','${u.nome.replace(/'/g,"\\'")}')">✏️</button>
              <button class="btn btn-danger btn-sm" onclick="uExcluir('${u.id}')">✕</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  window.uEditar = async (id, nome) => {
    const { data: mems } = await db.from('unidade_membro').select('tipo, conselheiro_id').eq('unidade_id', id);
    const tit  = mems?.find(m => m.tipo === 'conselheiro');
    const ascs = mems?.filter(m => m.tipo === 'associado') || [];
    document.getElementById('uEditId').value = id;
    document.getElementById('uNome').value = nome;
    document.getElementById('uCons').value = tit?.conselheiro_id || '';
    document.getElementById('uA1').value = ascs[0]?.conselheiro_id || '';
    document.getElementById('uA2').value = ascs[1]?.conselheiro_id || '';
    document.getElementById('uFormTitle').textContent = 'Editar Unidade';
    document.getElementById('uBtnSalvar').textContent = 'Salvar Alterações';
    document.getElementById('uBtnCancel').style.display = '';
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  window.uExcluir = async (id) => {
    if (!confirm('Excluir esta unidade?')) return;
    await db.from('unidade_membro').delete().eq('unidade_id', id);
    const { error } = await db.from('unidade').delete().eq('id', id);
    if (error) flash(error.message,'error'); else { flash('Unidade excluída.'); listar(); }
  };

  function cancelar() {
    document.getElementById('uEditId').value = '';
    document.getElementById('uNome').value = '';
    document.getElementById('uCons').value = '';
    document.getElementById('uA1').value = '';
    document.getElementById('uA2').value = '';
    document.getElementById('uFormTitle').textContent = 'Nova Unidade';
    document.getElementById('uBtnSalvar').textContent = 'Cadastrar Unidade';
    document.getElementById('uBtnCancel').style.display = 'none';
  }

  document.getElementById('uBtnSalvar').addEventListener('click', async () => {
    const id   = document.getElementById('uEditId').value;
    const nome = document.getElementById('uNome').value.trim();
    const cId  = document.getElementById('uCons').value;
    const a1   = document.getElementById('uA1').value;
    const a2   = document.getElementById('uA2').value;
    if (!nome) { flash('Informe o nome.','error'); return; }
    if (!cId)  { flash('Selecione o conselheiro.','error'); return; }

    let uid = id;
    if (id) {
      const { error } = await db.from('unidade').update({ nome }).eq('id', id);
      if (error) { flash(error.message,'error'); return; }
      await db.from('unidade_membro').delete().eq('unidade_id', id);
    } else {
      const { data, error } = await db.from('unidade').insert([{ nome }]).select().single();
      if (error) { flash(error.message,'error'); return; }
      uid = data.id;
    }
    const rows = [{ unidade_id:uid, conselheiro_id:cId, tipo:'conselheiro' }];
    if (a1) rows.push({ unidade_id:uid, conselheiro_id:a1, tipo:'associado' });
    if (a2) rows.push({ unidade_id:uid, conselheiro_id:a2, tipo:'associado' });
    const { error: e2 } = await db.from('unidade_membro').insert(rows);
    if (e2) { flash('Unidade salva, mas erro ao vincular membros: '+e2.message,'error'); return; }
    flash(id ? 'Unidade atualizada!' : 'Unidade cadastrada!');
    cancelar(); listar();
  });
  document.getElementById('uBtnCancel').addEventListener('click', cancelar);
  listar();
});

/* ==========================================================
   VIEW — DESBRAVADORES
   ========================================================== */
registerView('desbravadores', async (el) => {
  el.innerHTML = `
    ${pageHeader('👤','Desbravadores','Membros, classes e especialidades')}
    <div class="two-col">
      <div class="card">
        <div class="card-header"><div class="icon">👤</div><div><h2 id="dFormTitle">Novo Desbravador</h2></div></div>
        <input type="hidden" id="dEditId"/>
        <div class="form-group"><label>Nome Completo</label><input id="dNome" placeholder="Nome do desbravador"/></div>
        <div class="form-group"><label>Data de Nascimento</label><input type="date" id="dNasc"/></div>
        <div class="form-group"><label>Contato / Responsável</label><input id="dContato" placeholder="(00) 00000-0000"/></div>
        <div class="form-group"><label>Unidade</label><select id="dUnidade"><option value="">Selecione...</option></select></div>
        <div class="form-group"><label>Classe</label><select id="dClasse"><option value="">Selecione...</option></select></div>
        <div class="form-group"><label>Especialidades Concluídas</label><div class="espec-box" id="dEspecBox"><p style="color:var(--c-muted);font-size:.8rem">Carregando...</p></div></div>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn btn-primary btn-full" id="dBtnSalvar">Cadastrar</button>
          <button class="btn btn-secondary" id="dBtnCancel" style="display:none">Cancelar</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="icon">📋</div><div><h2>Membros Cadastrados</h2></div></div>
        <input id="dBusca" placeholder="🔍  Buscar por nome..." style="margin-bottom:12px"/>
        <div class="table-wrap">
          <table><thead><tr><th>Nome</th><th>Unidade</th><th>Classe</th><th>Nasc.</th><th></th></tr></thead>
          <tbody id="dTbody"></tbody></table>
        </div>
      </div>
    </div>`;

  const [{ data:us }, { data:cs }, { data:es }] = await Promise.all([
    db.from('unidade').select('*').order('nome'),
    db.from('classe').select('*').order('nome'),
    db.from('especialidades').select('*').order('nome'),
  ]);

  document.getElementById('dUnidade').innerHTML = '<option value="">Selecione...</option>' + (us||[]).map(x=>`<option value="${x.id}">${x.nome}</option>`).join('');
  document.getElementById('dClasse').innerHTML  = '<option value="">Selecione...</option>' + (cs||[]).map(x=>`<option value="${x.id}">${x.nome}</option>`).join('');
  document.getElementById('dEspecBox').innerHTML = (es||[]).length
    ? (es||[]).map(x=>`<label class="check-label"><input type="checkbox" class="espec-chk" value="${x.id}"/> ${x.nome}</label>`).join('')
    : '<p style="color:var(--c-muted);font-size:.8rem">Nenhuma especialidade cadastrada.</p>';

  let todosDesb = [];

  async function listar() {
    const { data } = await db.from('desbravador').select('*, unidade(nome), classe(nome)').order('nome');
    todosDesb = data || [];
    renderList(todosDesb);
  }

  function renderList(list) {
    const tbody = document.getElementById('dTbody');
    if (!list.length) { tbody.innerHTML = emptyRow(5,'👤','Nenhum desbravador encontrado.'); return; }
    tbody.innerHTML = list.map(d=>`
      <tr>
        <td><strong>${d.nome}</strong></td>
        <td style="font-size:.82rem">${d.unidade?.nome||'—'}</td>
        <td><span class="badge badge-teal">${d.classe?.nome||'—'}</span></td>
        <td style="font-size:.78rem;color:var(--c-muted)">${fmtDate(d.data_nascimento)}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-secondary btn-sm" onclick="navigate('perfil#${d.id}')">Ver</button>
            <button class="btn btn-icon" onclick="dEditar('${d.id}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="dExcluir('${d.id}')">✕</button>
          </div>
        </td>
      </tr>`).join('');
  }

  document.getElementById('dBusca').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    renderList(todosDesb.filter(d => d.nome.toLowerCase().includes(q)));
  });

  window.dEditar = async (id) => {
    const [{ data:d }, { data:esD }] = await Promise.all([
      db.from('desbravador').select('*').eq('id', id).single(),
      db.from('desbravador_especialidade').select('especialidade_id').eq('desbravador_id', id),
    ]);
    document.getElementById('dEditId').value = id;
    document.getElementById('dNome').value = d.nome;
    document.getElementById('dNasc').value = d.data_nascimento || '';
    document.getElementById('dContato').value = d.contato || '';
    document.getElementById('dUnidade').value = d.unidade_id || '';
    document.getElementById('dClasse').value = d.classe_id || '';
    const ids = (esD||[]).map(e => e.especialidade_id);
    document.querySelectorAll('.espec-chk').forEach(c => { c.checked = ids.includes(c.value); });
    document.getElementById('dFormTitle').textContent = 'Editar Desbravador';
    document.getElementById('dBtnSalvar').textContent = 'Salvar';
    document.getElementById('dBtnCancel').style.display = '';
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  function cancelar() {
    document.getElementById('dEditId').value = '';
    document.getElementById('dNome').value = '';
    document.getElementById('dNasc').value = '';
    document.getElementById('dContato').value = '';
    document.getElementById('dUnidade').value = '';
    document.getElementById('dClasse').value = '';
    document.querySelectorAll('.espec-chk').forEach(c => { c.checked = false; });
    document.getElementById('dFormTitle').textContent = 'Novo Desbravador';
    document.getElementById('dBtnSalvar').textContent = 'Cadastrar';
    document.getElementById('dBtnCancel').style.display = 'none';
  }

  window.dExcluir = async (id) => {
    if (!confirm('Excluir este desbravador e todos os seus registros?')) return;
    await db.from('desbravador_especialidade').delete().eq('desbravador_id', id);
    await db.from('mensalidade').delete().eq('desbravador_id', id);
    const { error } = await db.from('desbravador').delete().eq('id', id);
    if (error) flash(error.message,'error'); else { flash('Desbravador excluído.'); listar(); }
  };

  document.getElementById('dBtnSalvar').addEventListener('click', async () => {
    const id       = document.getElementById('dEditId').value;
    const nome     = document.getElementById('dNome').value.trim();
    const nasc     = document.getElementById('dNasc').value || null;
    const contato  = document.getElementById('dContato').value.trim() || null;
    const uId      = document.getElementById('dUnidade').value;
    const cId      = document.getElementById('dClasse').value;
    const esIds    = [...document.querySelectorAll('.espec-chk:checked')].map(c => c.value);
    if (!nome) { flash('Informe o nome.','error'); return; }
    if (!uId)  { flash('Selecione a unidade.','error'); return; }
    if (!cId)  { flash('Selecione a classe.','error'); return; }
    const payload = { nome, data_nascimento:nasc, contato, unidade_id:uId, classe_id:cId };
    let dId = id;
    if (id) {
      const { error } = await db.from('desbravador').update(payload).eq('id', id);
      if (error) { flash(error.message,'error'); return; }
    } else {
      const { data, error } = await db.from('desbravador').insert([payload]).select().single();
      if (error) { flash(error.message,'error'); return; }
      dId = data.id;
    }
    await db.from('desbravador_especialidade').delete().eq('desbravador_id', dId);
    if (esIds.length) await db.from('desbravador_especialidade').insert(esIds.map(e=>({ desbravador_id:dId, especialidade_id:e, concluida:true })));
    flash(id ? 'Desbravador atualizado!' : 'Desbravador cadastrado!');
    cancelar(); listar();
  });
  document.getElementById('dBtnCancel').addEventListener('click', cancelar);
  listar();
});

/* ==========================================================
   VIEW — PERFIL DO DESBRAVADOR
   Acessada via navigate('perfil#UUID')
   ========================================================== */
registerView('perfil', async (el) => {
  const id = location.hash.split('#')[1];
  if (!id || id === 'perfil') { navigate('desbravadores'); return; }

  el.innerHTML = `
    ${pageHeader('👤','Perfil do Desbravador')}
    <div style="margin-bottom:12px">
      <button class="btn btn-secondary btn-sm" onclick="navigate('desbravadores')">← Voltar</button>
    </div>
    <div class="two-col">
      <div>
        <div class="profile-hero">
          <div class="profile-avatar">👤</div>
          <h1 id="pNome">—</h1>
          <span class="badge badge-teal" id="pClasse">—</span>
          <p id="pUnidade" style="margin-top:4px">—</p>
        </div>
        <div class="card">
          <div class="card-header"><div class="icon">📄</div><div><h2>Dados Pessoais</h2></div></div>
          <div style="display:grid;gap:12px">
            <div><div class="stat-label">Data de Nascimento</div><div id="pNasc" style="color:var(--c-text);margin-top:4px">—</div></div>
            <div><div class="stat-label">Contato</div><div id="pContato" style="color:var(--c-text);margin-top:4px">—</div></div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="icon">⭐</div><div><h2>Especialidades Concluídas</h2></div></div>
        <div id="pEspec"><div class="empty-state"><span class="spinner"></span></div></div>
        <div style="margin-top:24px">
          <div class="card-header" style="margin-bottom:12px"><div class="icon">💳</div><div><h2>Mensalidades</h2></div></div>
          <div class="table-wrap">
            <table><thead><tr><th>Mês/Ano</th><th>Valor</th><th>Status</th></tr></thead>
            <tbody id="pMens"></tbody></table>
          </div>
        </div>
      </div>
    </div>`;

  const [{ data:d }, { data:es }, { data:ms }] = await Promise.all([
    db.from('desbravador').select('*, unidade(nome), classe(nome)').eq('id', id).single(),
    db.from('desbravador_especialidade').select('*, especialidade:especialidade_id(nome)').eq('desbravador_id', id),
    db.from('mensalidade').select('*').eq('desbravador_id', id).order('ano',{ascending:false}).order('mes',{ascending:false}),
  ]);

  if (!d) { flash('Desbravador não encontrado.','error'); navigate('desbravadores'); return; }

  document.getElementById('pNome').textContent    = d.nome;
  document.getElementById('pClasse').textContent  = d.classe?.nome || '—';
  document.getElementById('pUnidade').textContent = d.unidade?.nome ? '🏕️ ' + d.unidade.nome : '—';
  document.getElementById('pNasc').textContent    = fmtDate(d.data_nascimento);
  document.getElementById('pContato').textContent = d.contato || '—';
  document.title = `Bússola — ${d.nome}`;

  document.getElementById('pEspec').innerHTML = es?.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:8px;padding:4px">${es.map(e=>`<span class="badge badge-teal">⭐ ${e.especialidade?.nome||'?'}</span>`).join('')}</div>`
    : '<div class="empty-state"><div class="empty-icon">⭐</div><p>Nenhuma especialidade.</p></div>';

  document.getElementById('pMens').innerHTML = ms?.length
    ? ms.map(m=>`<tr><td>${MESES[m.mes]} / ${m.ano}</td><td>${brl(m.valor)}</td><td><span class="badge ${m.pago?'badge-green':'badge-red'}">${m.pago?'✓ Pago':'✗ Em aberto'}</span></td></tr>`).join('')
    : `<tr><td colspan="3"><div class="empty-state" style="padding:16px"><p>Sem mensalidades.</p></div></td></tr>`;
});

/* ==========================================================
   VIEW — ESPECIALIDADES
   ========================================================== */
registerView('especialidades', async (el) => {
  const PADRAO = ['Astronomia','Aves','Bordado','Caminhada','Camping','Ciclismo','Costura','Culinária','Desenho','Ecologia','Educação para a Saúde','Esportes Aquáticos','Floricultura','Fotografia','Horticultura','Jardinagem','Leitura','Marcenaria','Modelismo','Música','Natação','Nutrição','Origami','Pintura','Primeiros Socorros','Reciclagem','Teatro','Tricô e Crochê','Xadrez','Zoologia'];

  el.innerHTML = `
    ${pageHeader('⭐','Especialidades','Especialidades disponíveis no clube')}
    <div class="two-col">
      <div class="card">
        <div class="card-header"><div class="icon">⭐</div><div><h2 id="eFormTitle">Nova Especialidade</h2></div></div>
        <input type="hidden" id="eEditId"/>
        <div class="form-group"><label>Nome</label><input id="eNome" placeholder="Ex: Culinária, Astronomia..."/></div>
        <div class="form-group"><label>Descrição <span style="color:var(--c-muted);font-weight:400">(opcional)</span></label><textarea id="eDesc" rows="3" placeholder="Breve descrição..."></textarea></div>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn btn-primary btn-full" id="eBtnSalvar">Cadastrar</button>
          <button class="btn btn-secondary" id="eBtnCancel" style="display:none">Cancelar</button>
        </div>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--c-border)">
          <h3 style="margin-bottom:10px">Importar Lista Padrão</h3>
          <p style="font-size:.8rem;margin-bottom:10px">30 especialidades oficiais da DSA.</p>
          <button class="btn btn-secondary btn-full" id="eBtnImport">⬇ Importar Especialidades Oficiais</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="icon">📋</div><div><h2>Especialidades Cadastradas</h2><p id="eCount" style="margin:0;font-size:.8rem"></p></div></div>
        <input id="eBusca" placeholder="🔍  Buscar..." style="margin-bottom:12px"/>
        <div class="table-wrap">
          <table><thead><tr><th>Nome</th><th>Descrição</th><th>Membros</th><th></th></tr></thead>
          <tbody id="eTbody"></tbody></table>
        </div>
      </div>
    </div>`;

  let todos = [];

  async function listar() {
    const { data } = await db.from('especialidades').select('*').order('nome');
    todos = data || [];
    document.getElementById('eCount').textContent = `${todos.length} cadastrada${todos.length!==1?'s':''}`;
    await render(todos);
  }

  async function render(lista) {
    const tbody = document.getElementById('eTbody');
    if (!lista.length) { tbody.innerHTML = emptyRow(4,'⭐','Nenhuma especialidade cadastrada.'); return; }
    const { data:counts } = await db.from('desbravador_especialidade').select('especialidade_id');
    const map = {};
    (counts||[]).forEach(c => { map[c.especialidade_id] = (map[c.especialidade_id]||0)+1; });
    tbody.innerHTML = lista.map(e=>`
      <tr>
        <td><strong>${e.nome}</strong></td>
        <td style="font-size:.8rem;color:var(--c-muted)">${e.descricao||'—'}</td>
        <td><span class="badge badge-teal">${map[e.id]||0}</span></td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-icon" onclick="eEditar('${e.id}','${e.nome.replace(/'/g,"\\'")}','${(e.descricao||'').replace(/'/g,"\\'")}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="eExcluir('${e.id}')">✕</button>
          </div>
        </td>
      </tr>`).join('');
  }

  document.getElementById('eBusca').addEventListener('input', e => {
    render(todos.filter(x => x.nome.toLowerCase().includes(e.target.value.toLowerCase())));
  });

  window.eEditar = (id, nome, desc) => {
    document.getElementById('eEditId').value = id;
    document.getElementById('eNome').value = nome;
    document.getElementById('eDesc').value = desc;
    document.getElementById('eFormTitle').textContent = 'Editar Especialidade';
    document.getElementById('eBtnSalvar').textContent = 'Salvar';
    document.getElementById('eBtnCancel').style.display = '';
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  function cancelar() {
    document.getElementById('eEditId').value = '';
    document.getElementById('eNome').value = '';
    document.getElementById('eDesc').value = '';
    document.getElementById('eFormTitle').textContent = 'Nova Especialidade';
    document.getElementById('eBtnSalvar').textContent = 'Cadastrar';
    document.getElementById('eBtnCancel').style.display = 'none';
  }

  window.eExcluir = async (id) => {
    if (!confirm('Excluir esta especialidade?')) return;
    await db.from('desbravador_especialidade').delete().eq('especialidade_id', id);
    const { error } = await db.from('especialidades').delete().eq('id', id);
    if (error) flash(error.message,'error'); else { flash('Especialidade excluída.'); listar(); }
  };

  document.getElementById('eBtnSalvar').addEventListener('click', async () => {
    const id   = document.getElementById('eEditId').value;
    const nome = document.getElementById('eNome').value.trim();
    const desc = document.getElementById('eDesc').value.trim();
    if (!nome) { flash('Informe o nome.','error'); return; }
    const payload = { nome, descricao: desc||null };
    const op = id ? db.from('especialidades').update(payload).eq('id',id) : db.from('especialidades').insert([payload]);
    const { error } = await op;
    if (error) { flash(error.message,'error'); return; }
    flash(id ? 'Atualizada!' : 'Cadastrada!');
    cancelar(); listar();
  });

  document.getElementById('eBtnCancel').addEventListener('click', cancelar);

  document.getElementById('eBtnImport').addEventListener('click', async () => {
    const btn = document.getElementById('eBtnImport');
    const existentes = todos.map(e => e.nome.toLowerCase());
    const novas = PADRAO.filter(n => !existentes.includes(n.toLowerCase()));
    if (!novas.length) { flash('Todas já estão cadastradas.'); return; }
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Importando...';
    const { error } = await db.from('especialidades').insert(novas.map(nome=>({nome})));
    btn.disabled = false; btn.innerHTML = '⬇ Importar Especialidades Oficiais';
    if (error) { flash(error.message,'error'); return; }
    flash(`${novas.length} especialidade(s) importada(s)!`);
    listar();
  });

  listar();
});

/* ==========================================================
   VIEW — MENSALIDADES
   ========================================================== */
registerView('mensalidades', async (el) => {
  el.innerHTML = `
    ${pageHeader('💳','Mensalidades','Registro e acompanhamento de pagamentos')}
    <div class="two-col">
      <div class="card">
        <div class="card-header"><div class="icon">💳</div><div><h2>Registrar Mensalidade</h2></div></div>
        <div class="form-group"><label>Desbravador</label><select id="mDesb"><option value="">Selecione...</option></select></div>
        <div class="form-group"><label>Mês</label>
          <select id="mMes">
            <option value="">Selecione...</option>
            ${MESES.slice(1).map((m,i)=>`<option value="${i+1}">${m}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Ano</label><input type="number" id="mAno" min="2020" max="2099"/></div>
        <div class="form-group"><label>Valor (R$)</label><input type="number" id="mValor" min="0" step="0.01" placeholder="0,00"/></div>
        <div style="margin-bottom:14px"><label class="check-label"><input type="checkbox" id="mPago"/> Mensalidade já paga</label></div>
        <button class="btn btn-primary btn-full" id="mBtnRegistrar">Registrar</button>
      </div>
      <div class="card">
        <div class="card-header"><div class="icon">📋</div><div><h2>Mensalidades Registradas</h2></div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <select id="mFiltroDesb" style="margin:0"><option value="">Todos os membros</option></select>
          <select id="mFiltroStatus" style="margin:0">
            <option value="">Todos os status</option>
            <option value="pago">Pago</option>
            <option value="aberto">Em aberto</option>
          </select>
        </div>
        <div class="table-wrap">
          <table><thead><tr><th>Desbravador</th><th>Competência</th><th>Valor</th><th>Status</th><th></th></tr></thead>
          <tbody id="mTbody"></tbody></table>
        </div>
      </div>
    </div>`;

  document.getElementById('mAno').value = new Date().getFullYear();

  const { data: desbs } = await db.from('desbravador').select('id, nome').order('nome');
  const opts = (desbs||[]).map(d=>`<option value="${d.id}">${d.nome}</option>`).join('');
  document.getElementById('mDesb').innerHTML    = '<option value="">Selecione...</option>' + opts;
  document.getElementById('mFiltroDesb').innerHTML = '<option value="">Todos os membros</option>' + opts;

  let todos = [];

  async function listar() {
    const { data } = await db.from('mensalidade').select('*, desbravador:desbravador_id(nome)').order('ano',{ascending:false}).order('mes',{ascending:false});
    todos = data || [];
    aplicar();
  }

  function aplicar() {
    const dId    = document.getElementById('mFiltroDesb').value;
    const status = document.getElementById('mFiltroStatus').value;
    let lista = todos;
    if (dId)               lista = lista.filter(m => m.desbravador_id === dId);
    if (status === 'pago') lista = lista.filter(m => m.pago);
    if (status === 'aberto') lista = lista.filter(m => !m.pago);
    const tbody = document.getElementById('mTbody');
    if (!lista.length) { tbody.innerHTML = emptyRow(5,'💳','Nenhuma mensalidade encontrada.'); return; }
    tbody.innerHTML = lista.map(m=>`
      <tr>
        <td><strong>${m.desbravador?.nome||'—'}</strong></td>
        <td style="font-size:.82rem">${MESES[m.mes]}/${m.ano}</td>
        <td style="font-family:var(--font-mono)">${brl(m.valor)}</td>
        <td><span class="badge ${m.pago?'badge-green':'badge-red'}">${m.pago?'✓ Pago':'✗ Em aberto'}</span></td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-icon" title="${m.pago?'Marcar em aberto':'Marcar pago'}" onclick="mToggle('${m.id}',${m.pago})">${m.pago?'↩':'✓'}</button>
            <button class="btn btn-danger btn-sm" onclick="mExcluir('${m.id}')">✕</button>
          </div>
        </td>
      </tr>`).join('');
  }

  window.mToggle = async (id, atual) => {
    const { error } = await db.from('mensalidade').update({ pago:!atual }).eq('id', id);
    if (error) flash(error.message,'error'); else { flash(atual?'Marcado em aberto.':'Marcado como pago!'); listar(); }
  };
  window.mExcluir = async (id) => {
    if (!confirm('Excluir este registro?')) return;
    const { error } = await db.from('mensalidade').delete().eq('id', id);
    if (error) flash(error.message,'error'); else { flash('Excluído.'); listar(); }
  };

  document.getElementById('mFiltroDesb').addEventListener('change', aplicar);
  document.getElementById('mFiltroStatus').addEventListener('change', aplicar);

  document.getElementById('mBtnRegistrar').addEventListener('click', async () => {
    const dId   = document.getElementById('mDesb').value;
    const mes   = parseInt(document.getElementById('mMes').value);
    const ano   = parseInt(document.getElementById('mAno').value);
    const valor = parseFloat(document.getElementById('mValor').value);
    const pago  = document.getElementById('mPago').checked;
    if (!dId)                    { flash('Selecione o desbravador.','error'); return; }
    if (!mes)                    { flash('Selecione o mês.','error'); return; }
    if (!ano || ano < 2020)      { flash('Informe o ano.','error'); return; }
    if (isNaN(valor) || valor<0) { flash('Informe o valor.','error'); return; }
    const { error } = await db.from('mensalidade').insert([{ desbravador_id:dId, mes, ano, valor, pago }]);
    if (error) { flash(error.message,'error'); return; }
    flash('Mensalidade registrada!');
    document.getElementById('mDesb').value = '';
    document.getElementById('mMes').value = '';
    document.getElementById('mValor').value = '';
    document.getElementById('mPago').checked = false;
    listar();
  });

  listar();
});

/* ==========================================================
   VIEW — CAIXA
   ========================================================== */
registerView('caixa', async (el) => {
  el.innerHTML = `
    ${pageHeader('💰','Controle de Caixa','Entradas e saídas financeiras')}
    <div class="saldo-bar">
      <div class="saldo-item green"><div class="s-label">Total Entradas</div><div class="s-val" id="cEntrada">—</div></div>
      <div class="saldo-item red"><div class="s-label">Total Saídas</div><div class="s-val" id="cSaida">—</div></div>
      <div class="saldo-item teal"><div class="s-label">Saldo Atual</div><div class="s-val" id="cSaldo">—</div></div>
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-header"><div class="icon">💰</div><div><h2>Nova Movimentação</h2></div></div>
        <div class="form-group"><label>Tipo</label>
          <select id="cTipo">
            <option value="">Selecione...</option>
            <option value="entrada">📈 Entrada</option>
            <option value="saida">📉 Saída</option>
          </select>
        </div>
        <div class="form-group"><label>Descrição</label><input id="cDesc" placeholder="Ex: Mensalidades de outubro"/></div>
        <div class="form-group"><label>Valor (R$)</label><input type="number" id="cValor" min="0" step="0.01" placeholder="0,00"/></div>
        <div class="form-group"><label>Data</label><input type="date" id="cData"/></div>
        <button class="btn btn-primary btn-full" id="cBtnRegistrar">Registrar Movimentação</button>
      </div>
      <div class="card">
        <div class="card-header"><div class="icon">📋</div><div><h2>Histórico</h2></div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <select id="cFiltroTipo" style="margin:0">
            <option value="">Todos os tipos</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
          </select>
          <input type="month" id="cFiltroMes" style="margin:0"/>
        </div>
        <div class="table-wrap">
          <table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th></th></tr></thead>
          <tbody id="cTbody"></tbody></table>
        </div>
      </div>
    </div>`;

  document.getElementById('cData').value = new Date().toISOString().split('T')[0];

  let todos = [];

  async function listar() {
    const { data } = await db.from('caixa').select('*').order('data',{ascending:false});
    todos = data || [];
    calcular(todos); aplicar();
  }

  function calcular(lista) {
    const ent  = lista.filter(c=>c.tipo==='entrada').reduce((s,c)=>s+ +c.valor,0);
    const said = lista.filter(c=>c.tipo==='saida').reduce((s,c)=>s+ +c.valor,0);
    const sal  = ent - said;
    document.getElementById('cEntrada').textContent = brl(ent);
    document.getElementById('cSaida').textContent   = brl(said);
    const el2 = document.getElementById('cSaldo');
    el2.textContent = brl(sal);
    el2.style.color = sal >= 0 ? 'var(--c-green)' : 'var(--c-red)';
  }

  function aplicar() {
    const tipo = document.getElementById('cFiltroTipo').value;
    const mes  = document.getElementById('cFiltroMes').value;
    let lista = todos;
    if (tipo) lista = lista.filter(c => c.tipo === tipo);
    if (mes)  lista = lista.filter(c => c.data?.startsWith(mes));
    const tbody = document.getElementById('cTbody');
    if (!lista.length) { tbody.innerHTML = emptyRow(5,'💰','Nenhuma movimentação.'); return; }
    tbody.innerHTML = lista.map(c=>`
      <tr>
        <td style="font-size:.8rem;color:var(--c-muted)">${fmtDate(c.data)}</td>
        <td><span class="badge ${c.tipo==='entrada'?'badge-green':'badge-red'}">${c.tipo==='entrada'?'📈 Entrada':'📉 Saída'}</span></td>
        <td>${c.descricao}</td>
        <td style="font-family:var(--font-mono);font-weight:600;color:${c.tipo==='entrada'?'var(--c-green)':'var(--c-red)'}">
          ${c.tipo==='entrada'?'+':'-'}${brl(c.valor)}
        </td>
        <td><button class="btn btn-danger btn-sm" onclick="cExcluir('${c.id}')">✕</button></td>
      </tr>`).join('');
  }

  window.cExcluir = async (id) => {
    if (!confirm('Excluir esta movimentação?')) return;
    const { error } = await db.from('caixa').delete().eq('id', id);
    if (error) flash(error.message,'error'); else { flash('Excluída.'); listar(); }
  };

  document.getElementById('cFiltroTipo').addEventListener('change', aplicar);
  document.getElementById('cFiltroMes').addEventListener('change', aplicar);

  document.getElementById('cBtnRegistrar').addEventListener('click', async () => {
    const tipo  = document.getElementById('cTipo').value;
    const desc  = document.getElementById('cDesc').value.trim();
    const valor = parseFloat(document.getElementById('cValor').value);
    const data  = document.getElementById('cData').value;
    if (!tipo)              { flash('Selecione o tipo.','error'); return; }
    if (!desc)              { flash('Informe a descrição.','error'); return; }
    if (isNaN(valor)||valor<=0) { flash('Informe um valor válido.','error'); return; }
    const { error } = await db.from('caixa').insert([{ tipo, descricao:desc, valor, data: data||new Date().toISOString().split('T')[0] }]);
    if (error) { flash(error.message,'error'); return; }
    flash('Movimentação registrada!');
    document.getElementById('cTipo').value = '';
    document.getElementById('cDesc').value = '';
    document.getElementById('cValor').value = '';
    document.getElementById('cData').value = new Date().toISOString().split('T')[0];
    listar();
  });

  listar();
});

/* ==========================================================
   VIEW — PATRIMÔNIO
   ========================================================== */
registerView('patrimonio', async (el) => {
  el.innerHTML = `
    ${pageHeader('📦','Patrimônio','Inventário de bens do clube')}
    <div class="two-col">
      <div class="card">
        <div class="card-header"><div class="icon">📦</div><div><h2 id="pFormTitle">Novo Item</h2></div></div>
        <input type="hidden" id="pEditId"/>
        <div class="form-group"><label>Nome do Item</label><input id="pItem" placeholder="Ex: Barraca de camping"/></div>
        <div class="form-group"><label>Quantidade</label><input type="number" id="pQtd" min="1" placeholder="1"/></div>
        <div class="form-group"><label>Estado</label>
          <select id="pEstado">
            <option value="">Selecione...</option>
            <option>Novo</option><option>Bom</option><option>Usado</option><option>Danificado</option><option>Descartado</option>
          </select>
        </div>
        <div class="form-group"><label>Unidade Responsável <span style="color:var(--c-muted);font-weight:400">(opcional)</span></label>
          <select id="pUnidade"><option value="">Patrimônio geral</option></select>
        </div>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn btn-primary btn-full" id="pBtnSalvar">Cadastrar Item</button>
          <button class="btn btn-secondary" id="pBtnCancel" style="display:none">Cancelar</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="icon">📋</div><div><h2>Inventário</h2></div></div>
        <input id="pBusca" placeholder="🔍  Buscar item..." style="margin-bottom:12px"/>
        <div class="table-wrap">
          <table><thead><tr><th>Item</th><th>Qtd</th><th>Estado</th><th>Unidade</th><th></th></tr></thead>
          <tbody id="pTbody"></tbody></table>
        </div>
      </div>
    </div>`;

  const { data: uns } = await db.from('unidade').select('id,nome').order('nome');
  document.getElementById('pUnidade').innerHTML = '<option value="">Patrimônio geral</option>' + (uns||[]).map(u=>`<option value="${u.id}">${u.nome}</option>`).join('');

  const EC = { 'Novo':'badge-teal','Bom':'badge-green','Usado':'badge-amber','Danificado':'badge-red','Descartado':'badge-red' };
  let todos = [];

  async function listar() {
    const { data } = await db.from('patrimonio').select('*, unidade:unidade_id(nome)').order('item');
    todos = data || [];
    render(todos);
  }

  function render(lista) {
    const tbody = document.getElementById('pTbody');
    if (!lista.length) { tbody.innerHTML = emptyRow(5,'📦','Inventário vazio.'); return; }
    tbody.innerHTML = lista.map(p=>`
      <tr>
        <td><strong>${p.item}</strong></td>
        <td style="font-family:var(--font-mono)">${p.quantidade}</td>
        <td><span class="badge ${EC[p.estado]||'badge-amber'}">${p.estado}</span></td>
        <td style="font-size:.8rem;color:var(--c-muted)">${p.unidade?.nome||'Geral'}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-icon" onclick="pEditar('${p.id}','${p.item.replace(/'/g,"\\'")}',${p.quantidade},'${p.estado}','${p.unidade_id||''}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="pExcluir('${p.id}')">✕</button>
          </div>
        </td>
      </tr>`).join('');
  }

  document.getElementById('pBusca').addEventListener('input', e => {
    render(todos.filter(p => p.item.toLowerCase().includes(e.target.value.toLowerCase())));
  });

  window.pEditar = (id, item, qty, estado, uId) => {
    document.getElementById('pEditId').value = id;
    document.getElementById('pItem').value = item;
    document.getElementById('pQtd').value = qty;
    document.getElementById('pEstado').value = estado;
    document.getElementById('pUnidade').value = uId;
    document.getElementById('pFormTitle').textContent = 'Editar Item';
    document.getElementById('pBtnSalvar').textContent = 'Salvar';
    document.getElementById('pBtnCancel').style.display = '';
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  function cancelar() {
    document.getElementById('pEditId').value = '';
    document.getElementById('pItem').value = '';
    document.getElementById('pQtd').value = '';
    document.getElementById('pEstado').value = '';
    document.getElementById('pUnidade').value = '';
    document.getElementById('pFormTitle').textContent = 'Novo Item';
    document.getElementById('pBtnSalvar').textContent = 'Cadastrar Item';
    document.getElementById('pBtnCancel').style.display = 'none';
  }

  window.pExcluir = async (id) => {
    if (!confirm('Excluir este item?')) return;
    const { error } = await db.from('patrimonio').delete().eq('id', id);
    if (error) flash(error.message,'error'); else { flash('Item excluído.'); listar(); }
  };

  document.getElementById('pBtnSalvar').addEventListener('click', async () => {
    const id    = document.getElementById('pEditId').value;
    const item  = document.getElementById('pItem').value.trim();
    const qty   = parseInt(document.getElementById('pQtd').value);
    const est   = document.getElementById('pEstado').value;
    const uId   = document.getElementById('pUnidade').value || null;
    if (!item)          { flash('Informe o nome.','error'); return; }
    if (!qty || qty<1)  { flash('Informe a quantidade.','error'); return; }
    if (!est)           { flash('Selecione o estado.','error'); return; }
    const payload = { item, quantidade:qty, estado:est, unidade_id:uId };
    const op = id ? db.from('patrimonio').update(payload).eq('id',id) : db.from('patrimonio').insert([payload]);
    const { error } = await op;
    if (error) { flash(error.message,'error'); return; }
    flash(id ? 'Item atualizado!' : 'Item cadastrado!');
    cancelar(); listar();
  });
  document.getElementById('pBtnCancel').addEventListener('click', cancelar);
  listar();
});

/* ==========================================================
   VIEW — ATAS E ATOS
   ========================================================== */
registerView('atas', async (el) => {
  el.innerHTML = `
    ${pageHeader('📋','Atas e Atos','Registros oficiais do clube')}
    <div class="two-col">
      <div class="card">
        <div class="card-header"><div class="icon">📋</div><div><h2 id="aFormTitle">Novo Registro</h2></div></div>
        <input type="hidden" id="aEditId"/>
        <input type="hidden" id="aEditTipo"/>
        <div class="form-group"><label>Tipo</label>
          <select id="aTipo">
            <option value="">Selecione...</option>
            <option value="ata">📄 Ata de Reunião</option>
            <option value="ato">📜 Ato Administrativo</option>
          </select>
        </div>
        <div class="form-group"><label>Título</label><input id="aTitulo" placeholder="Título do documento"/></div>
        <div class="form-group"><label>Conteúdo</label><textarea id="aConteudo" rows="6" placeholder="Escreva o conteúdo completo..."></textarea></div>
        <div class="form-group"><label>Data</label><input type="date" id="aData"/></div>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn btn-primary btn-full" id="aBtnSalvar">Registrar</button>
          <button class="btn btn-secondary" id="aBtnCancel" style="display:none">Cancelar</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="icon">📚</div><div><h2>Registros do Clube</h2></div></div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button class="btn btn-secondary btn-sm" style="flex:1" onclick="aFiltrar('')">Todos</button>
          <button class="btn btn-secondary btn-sm" style="flex:1" onclick="aFiltrar('ata')">Atas</button>
          <button class="btn btn-secondary btn-sm" style="flex:1" onclick="aFiltrar('ato')">Atos</button>
        </div>
        <div id="aLista"></div>
      </div>
    </div>

    <!-- Modal de visualização -->
    <div class="modal-backdrop" id="aModal">
      <div class="modal-box">
        <div class="modal-header">
          <div><span class="badge" id="aModalTipo"></span><h2 id="aModalTitulo" style="margin-top:6px"></h2><p id="aModalData" style="font-size:.78rem;margin-top:3px"></p></div>
          <button class="btn btn-icon" onclick="document.getElementById('aModal').classList.remove('open')" style="font-size:18px">✕</button>
        </div>
        <p id="aModalConteudo" style="white-space:pre-wrap;line-height:1.8;font-size:.875rem;color:var(--c-text)"></p>
      </div>
    </div>`;

  document.getElementById('aData').value = new Date().toISOString().split('T')[0];

  let todos = [];

  async function listar() {
    const [at, ao] = await Promise.all([
      db.from('atas').select('*').order('data',{ascending:false}),
      db.from('atos').select('*').order('data',{ascending:false}),
    ]);
    todos = [
      ...(at.data||[]).map(a=>({...a,tipo:'ata'})),
      ...(ao.data||[]).map(a=>({...a,tipo:'ato'})),
    ].sort((a,b) => (b.data||'').localeCompare(a.data||''));
    render(todos);
  }

  window.aFiltrar = (tipo) => {
    render(tipo ? todos.filter(r=>r.tipo===tipo) : todos);
  };

  function render(lista) {
    const el2 = document.getElementById('aLista');
    if (!lista.length) { el2.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>Nenhum registro.</p></div>'; return; }
    el2.innerHTML = lista.map(r=>`
      <div style="background:var(--c-surface2);border:1px solid var(--c-border);border-radius:var(--radius-md);padding:14px;margin-bottom:8px;cursor:pointer;transition:border-color .2s"
           onclick="aVer('${r.id}','${r.tipo}')"
           onmouseenter="this.style.borderColor='var(--c-teal)'"
           onmouseleave="this.style.borderColor='var(--c-border)'">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div>
            <span class="badge ${r.tipo==='ata'?'badge-teal':'badge-amber'}" style="margin-bottom:5px">
              ${r.tipo==='ata'?'📄 Ata':'📜 Ato'}
            </span>
            <div style="font-weight:600;color:var(--c-text);font-size:.9rem">${r.titulo}</div>
            <div style="font-size:.73rem;color:var(--c-muted);margin-top:3px">${fmtDate(r.data)}</div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0">
            <button class="btn btn-icon" onclick="event.stopPropagation();aEditar('${r.id}','${r.tipo}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();aExcluir('${r.id}','${r.tipo}')">✕</button>
          </div>
        </div>
        <p style="font-size:.78rem;color:var(--c-muted);margin-top:8px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${r.conteudo||''}</p>
      </div>`).join('');
  }

  window.aVer = async (id, tipo) => {
    const { data } = await db.from(tipo==='ata'?'atas':'atos').select('*').eq('id',id).single();
    if (!data) return;
    document.getElementById('aModalTipo').textContent = tipo==='ata'?'📄 Ata':'📜 Ato';
    document.getElementById('aModalTipo').className   = `badge ${tipo==='ata'?'badge-teal':'badge-amber'}`;
    document.getElementById('aModalTitulo').textContent  = data.titulo;
    document.getElementById('aModalData').textContent    = fmtDate(data.data);
    document.getElementById('aModalConteudo').textContent = data.conteudo||'';
    document.getElementById('aModal').classList.add('open');
  };

  document.getElementById('aModal').addEventListener('click', e => {
    if (e.target === document.getElementById('aModal')) document.getElementById('aModal').classList.remove('open');
  });

  window.aEditar = async (id, tipo) => {
    const { data } = await db.from(tipo==='ata'?'atas':'atos').select('*').eq('id',id).single();
    if (!data) return;
    document.getElementById('aEditId').value   = id;
    document.getElementById('aEditTipo').value = tipo;
    document.getElementById('aTipo').value     = tipo;
    document.getElementById('aTitulo').value   = data.titulo;
    document.getElementById('aConteudo').value = data.conteudo||'';
    document.getElementById('aData').value     = data.data||'';
    document.getElementById('aFormTitle').textContent = 'Editar Registro';
    document.getElementById('aBtnSalvar').textContent = 'Salvar';
    document.getElementById('aBtnCancel').style.display = '';
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  function cancelar() {
    document.getElementById('aEditId').value = '';
    document.getElementById('aEditTipo').value = '';
    document.getElementById('aTipo').value = '';
    document.getElementById('aTitulo').value = '';
    document.getElementById('aConteudo').value = '';
    document.getElementById('aData').value = new Date().toISOString().split('T')[0];
    document.getElementById('aFormTitle').textContent = 'Novo Registro';
    document.getElementById('aBtnSalvar').textContent = 'Registrar';
    document.getElementById('aBtnCancel').style.display = 'none';
  }

  window.aExcluir = async (id, tipo) => {
    if (!confirm('Excluir este registro?')) return;
    const { error } = await db.from(tipo==='ata'?'atas':'atos').delete().eq('id', id);
    if (error) flash(error.message,'error'); else { flash('Excluído.'); listar(); }
  };

  document.getElementById('aBtnSalvar').addEventListener('click', async () => {
    const id      = document.getElementById('aEditId').value;
    const tipoAnt = document.getElementById('aEditTipo').value;
    const tipo    = document.getElementById('aTipo').value;
    const titulo  = document.getElementById('aTitulo').value.trim();
    const cont    = document.getElementById('aConteudo').value.trim();
    const data    = document.getElementById('aData').value;
    if (!tipo)   { flash('Selecione o tipo.','error'); return; }
    if (!titulo) { flash('Informe o título.','error'); return; }
    if (!cont)   { flash('Informe o conteúdo.','error'); return; }
    const tabela  = tipo==='ata'?'atas':'atos';
    const payload = { titulo, conteudo:cont, data: data||new Date().toISOString().split('T')[0] };
    let error;
    if (id) {
      if (tipoAnt !== tipo) {
        await db.from(tipoAnt==='ata'?'atas':'atos').delete().eq('id', id);
        ({ error } = await db.from(tabela).insert([payload]));
      } else {
        ({ error } = await db.from(tabela).update(payload).eq('id', id));
      }
    } else {
      ({ error } = await db.from(tabela).insert([payload]));
    }
    if (error) { flash(error.message,'error'); return; }
    flash(id ? 'Atualizado!' : 'Registrado!');
    cancelar(); listar();
  });
  document.getElementById('aBtnCancel').addEventListener('click', cancelar);
  listar();
});

/* ==========================================================
   VIEW — RELATÓRIOS
   ========================================================== */
registerView('relatorios', async (el) => {
  el.innerHTML = `
    ${pageHeader('📄','Relatórios','Gere documentos PDF oficiais do clube')}

    <div class="card" style="max-width:480px;margin-bottom:24px">
      <div class="card-header"><div class="icon">🚌</div><div><h2>Autorização de Saída</h2><p style="margin:0">Selecione a unidade para gerar</p></div></div>
      <div class="form-group"><label>Unidade</label><select id="rSelUnidade"><option value="">Carregando...</option></select></div>
      <button class="btn btn-primary" onclick="rGerarSaida()">📄 Gerar PDF de Autorização</button>
    </div>

    <div class="report-grid">
      <div class="report-card" onclick="rGerarFluxo()">
        <div class="r-icon">💰</div><div class="r-name">Fluxo de Caixa</div>
        <div class="r-desc">Extrato com entradas, saídas e saldo</div>
      </div>
      <div class="report-card" onclick="rGerarPatrimonio()">
        <div class="r-icon">📦</div><div class="r-name">Patrimônio</div>
        <div class="r-desc">Inventário completo de bens</div>
      </div>
      <div class="report-card" onclick="rGerarAtasAtos()">
        <div class="r-icon">📚</div><div class="r-name">Livro de Atas e Atos</div>
        <div class="r-desc">Todos os registros oficiais</div>
      </div>
      <div class="report-card" onclick="rGerarMensalidades()">
        <div class="r-icon">💳</div><div class="r-name">Mensalidades</div>
        <div class="r-desc">Situação de pagamentos</div>
      </div>
      <div class="report-card" onclick="rGerarGeral()">
        <div class="r-icon">📊</div><div class="r-name">Relatório Geral</div>
        <div class="r-desc">Visão consolidada do clube</div>
      </div>
    </div>`;

  const { data: uns } = await db.from('unidade').select('id,nome').order('nome');
  document.getElementById('rSelUnidade').innerHTML = '<option value="">Selecione uma unidade...</option>' +
    (uns||[]).map(u=>`<option value="${u.id}">${u.nome}</option>`).join('');

  const { jsPDF } = window.jspdf;

  function cabecalho(doc, titulo) {
    doc.setFillColor(6,182,212); doc.rect(0,0,210,22,'F');
    doc.setTextColor(0,0,0); doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text('Sistema Bússola', 14, 10);
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text('Plataforma de Administração para Clubes de Desbravadores', 14, 16);
    doc.setTextColor(40,40,40); doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text(titulo, 14, 34);
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(100,100,100);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 40);
    return 48;
  }

  function rodape(doc) {
    const pages = doc.internal.getNumberOfPages();
    for (let i=1; i<=pages; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150,150,150);
      doc.text(`Sistema Bússola — Página ${i} de ${pages}`, 105, 290, { align:'center' });
    }
  }

  window.rGerarSaida = async () => {
    const uId = document.getElementById('rSelUnidade').value;
    if (!uId) { flash('Selecione a unidade.','error'); return; }
    const [{ data:unidade }, { data:membros }, { data:desb }] = await Promise.all([
      db.from('unidade').select('nome').eq('id',uId).single(),
      db.from('unidade_membro').select('tipo, conselheiro:conselheiro_id(nome)').eq('unidade_id',uId),
      db.from('desbravador').select('nome, data_nascimento, contato').eq('unidade_id',uId).order('nome'),
    ]);
    const tit = (membros||[]).find(m=>m.tipo==='conselheiro');
    const doc = new jsPDF();
    let y = cabecalho(doc,'Autorização de Saída');
    doc.setFontSize(11); doc.setTextColor(40,40,40); doc.setFont('helvetica','bold');
    doc.text(`Unidade: ${unidade.nome}`, 14, y+6);
    doc.setFont('helvetica','normal');
    doc.text(`Conselheiro: ${tit?.conselheiro?.nome||'—'}`, 14, y+14);
    y += 22;
    doc.autoTable({ startY:y, head:[['Nome','Nascimento','Contato','Assinatura do Responsável']], body:(desb||[]).map(d=>[d.nome,fmtDate(d.data_nascimento),d.contato||'—','']), styles:{fontSize:9,cellPadding:5}, headStyles:{fillColor:[6,182,212],textColor:0,fontStyle:'bold'}, alternateRowStyles:{fillColor:[240,253,255]}, columnStyles:{3:{cellWidth:50}} });
    const fy = doc.lastAutoTable.finalY+20;
    doc.line(14,fy+15,90,fy+15); doc.line(120,fy+15,196,fy+15);
    doc.setFontSize(10);
    doc.text('Assinatura do Diretor', 14, fy+20);
    doc.text('Assinatura do Conselheiro', 120, fy+20);
    rodape(doc); doc.save(`autorizacao_${unidade.nome.replace(/\s+/g,'_')}.pdf`);
    flash('PDF gerado!');
  };

  window.rGerarFluxo = async () => {
    const { data } = await db.from('caixa').select('*').order('data');
    const doc = new jsPDF(); let y = cabecalho(doc,'Relatório de Fluxo de Caixa');
    const tE = (data||[]).filter(c=>c.tipo==='entrada').reduce((s,c)=>s+ +c.valor,0);
    const tS = (data||[]).filter(c=>c.tipo==='saida').reduce((s,c)=>s+ +c.valor,0);
    const sl = tE - tS;
    doc.setFillColor(240,253,244); doc.roundedRect(14,y,55,18,3,3,'F');
    doc.setFillColor(255,241,242); doc.roundedRect(77,y,55,18,3,3,'F');
    doc.setFillColor(240,253,255); doc.roundedRect(140,y,55,18,3,3,'F');
    doc.setFontSize(7); doc.setTextColor(80,80,80);
    doc.text('TOTAL ENTRADAS',41,y+5,{align:'center'});
    doc.text('TOTAL SAÍDAS',104,y+5,{align:'center'});
    doc.text('SALDO FINAL',167,y+5,{align:'center'});
    doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.setTextColor(16,185,129); doc.text(brl(tE),41,y+14,{align:'center'});
    doc.setTextColor(244,63,94);  doc.text(brl(tS),104,y+14,{align:'center'});
    doc.setTextColor(sl>=0?16:244,sl>=0?185:63,sl>=0?129:94); doc.text(brl(sl),167,y+14,{align:'center'});
    y += 28;
    doc.autoTable({ startY:y, head:[['Data','Tipo','Descrição','Valor']], body:(data||[]).map(c=>[fmtDate(c.data),c.tipo==='entrada'?'Entrada':'Saída',c.descricao,(c.tipo==='entrada'?'+':'-')+brl(c.valor)]), styles:{fontSize:9,cellPadding:4}, headStyles:{fillColor:[6,182,212],textColor:0,fontStyle:'bold'}, alternateRowStyles:{fillColor:[248,250,252]}, columnStyles:{3:{halign:'right',fontStyle:'bold'}} });
    rodape(doc); doc.save('fluxo_caixa.pdf'); flash('PDF gerado!');
  };

  window.rGerarPatrimonio = async () => {
    const { data } = await db.from('patrimonio').select('*, unidade:unidade_id(nome)').order('item');
    const doc = new jsPDF(); let y = cabecalho(doc,'Relatório de Patrimônio');
    doc.autoTable({ startY:y, head:[['Item','Quantidade','Estado','Unidade']], body:(data||[]).map(p=>[p.item,p.quantidade,p.estado,p.unidade?.nome||'Geral']), styles:{fontSize:9,cellPadding:4}, headStyles:{fillColor:[6,182,212],textColor:0,fontStyle:'bold'}, alternateRowStyles:{fillColor:[248,250,252]} });
    const tot = (data||[]).reduce((s,p)=>s+p.quantidade,0);
    const fy = doc.lastAutoTable.finalY+8;
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(40,40,40);
    doc.text(`Total: ${data?.length||0} tipos | ${tot} unidades`, 14, fy);
    rodape(doc); doc.save('patrimonio.pdf'); flash('PDF gerado!');
  };

  window.rGerarAtasAtos = async () => {
    const [at, ao] = await Promise.all([
      db.from('atas').select('*').order('data'),
      db.from('atos').select('*').order('data'),
    ]);
    const doc = new jsPDF(); let y = cabecalho(doc,'Livro de Atas e Atos');
    const todos = [...(at.data||[]).map(a=>({...a,tipo:'Ata'})),...(ao.data||[]).map(a=>({...a,tipo:'Ato'}))].sort((a,b)=>(a.data||'').localeCompare(b.data||''));
    doc.autoTable({ startY:y, head:[['Tipo','Data','Título','Conteúdo (resumo)']], body:todos.map(r=>[r.tipo,fmtDate(r.data),r.titulo,r.conteudo?(r.conteudo.length>80?r.conteudo.substring(0,80)+'…':r.conteudo):'—']), styles:{fontSize:8,cellPadding:4}, headStyles:{fillColor:[6,182,212],textColor:0,fontStyle:'bold'}, alternateRowStyles:{fillColor:[248,250,252]}, columnStyles:{3:{cellWidth:80}} });
    todos.forEach(r => {
      doc.addPage(); let py=20;
      doc.setFillColor(6,182,212); doc.rect(0,0,210,14,'F');
      doc.setTextColor(0,0,0); doc.setFontSize(8); doc.setFont('helvetica','bold');
      doc.text(`${r.tipo}: ${r.titulo}`, 14, 9);
      doc.setTextColor(40,40,40); doc.setFont('helvetica','normal'); doc.setFontSize(14); doc.setFont('helvetica','bold');
      doc.text(r.titulo, 14, py+14); py+=24;
      doc.setFontSize(9); doc.setFont('helvetica','normal');
      doc.text(doc.splitTextToSize(r.conteudo||'',182), 14, py);
    });
    rodape(doc); doc.save('livro_atas_atos.pdf'); flash('PDF gerado!');
  };

  window.rGerarMensalidades = async () => {
    const { data } = await db.from('mensalidade').select('*, desbravador:desbravador_id(nome)').order('ano',{ascending:false}).order('mes',{ascending:false});
    const doc = new jsPDF(); let y = cabecalho(doc,'Relatório de Mensalidades');
    const pagos  = (data||[]).filter(m=>m.pago).length;
    const aberto = (data||[]).length - pagos;
    const totVal = (data||[]).filter(m=>m.pago).reduce((s,m)=>s+ +m.valor,0);
    doc.setFontSize(9); doc.setTextColor(80,80,80); doc.setFont('helvetica','normal');
    doc.text(`Total: ${data?.length||0}  |  Pagos: ${pagos}  |  Em aberto: ${aberto}  |  Arrecadado: ${brl(totVal)}`, 14, y);
    y += 10;
    doc.autoTable({ startY:y, head:[['Desbravador','Mês','Ano','Valor','Status']], body:(data||[]).map(m=>[m.desbravador?.nome||'—',MESES[m.mes],m.ano,brl(m.valor),m.pago?'Pago':'Em aberto']), styles:{fontSize:8.5,cellPadding:4}, headStyles:{fillColor:[6,182,212],textColor:0,fontStyle:'bold'}, alternateRowStyles:{fillColor:[248,250,252]},
      didParseCell:(d) => {
        if (d.column.index===4&&d.cell.raw==='Pago')       { d.cell.styles.textColor=[16,185,129]; d.cell.styles.fontStyle='bold'; }
        else if (d.column.index===4&&d.cell.raw==='Em aberto') { d.cell.styles.textColor=[244,63,94]; d.cell.styles.fontStyle='bold'; }
      }
    });
    rodape(doc); doc.save('mensalidades.pdf'); flash('PDF gerado!');
  };

  window.rGerarGeral = async () => {
    const [u, membros, cl, es, d] = await Promise.all([
      db.from('unidade').select('id,nome').order('nome'),
      db.from('unidade_membro').select('unidade_id, tipo, conselheiro:conselheiro_id(nome)'),
      db.from('classe').select('*').order('nome'),
      db.from('especialidades').select('*').order('nome'),
      db.from('desbravador').select('*, unidade(nome), classe(nome)').order('nome'),
    ]);
    const doc = new jsPDF(); let y = cabecalho(doc,'Relatório Geral do Clube');
    doc.setFontSize(9); doc.setTextColor(80,80,80);
    doc.text(`Unidades: ${u.data?.length||0}   Desbravadores: ${d.data?.length||0}   Classes: ${cl.data?.length||0}   Especialidades: ${es.data?.length||0}`, 14, y);
    y += 12;
    const tblOpts = { styles:{fontSize:8.5,cellPadding:3}, headStyles:{fillColor:[6,182,212],textColor:0}, alternateRowStyles:{fillColor:[248,250,252]}, margin:{left:14,right:14} };

    doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.setTextColor(6,182,212);
    doc.text('Unidades', 14, y); y += 6;
    doc.autoTable({ ...tblOpts, startY:y, head:[['Unidade','Conselheiro Titular']], body:(u.data||[]).map(x=>{ const tit=(membros.data||[]).find(m=>m.unidade_id===x.id&&m.tipo==='conselheiro'); return [x.nome,tit?.conselheiro?.nome||'—']; }) });
    y = doc.lastAutoTable.finalY+10;

    doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.setTextColor(6,182,212);
    doc.text('Classes', 14, y); y += 6;
    doc.autoTable({ ...tblOpts, startY:y, head:[['Classe','Faixa Etária']], body:(cl.data||[]).map(x=>[x.nome,x.descricao||'—']) });
    y = doc.lastAutoTable.finalY+10;

    if (y>220) { doc.addPage(); y=20; }
    doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.setTextColor(6,182,212);
    doc.text('Especialidades', 14, y); y += 6;
    doc.autoTable({ ...tblOpts, startY:y, head:[['Especialidade','Descrição']], body:(es.data||[]).map(x=>[x.nome,x.descricao||'—']), styles:{...tblOpts.styles,fontSize:8} });

    doc.addPage(); y=20;
    doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.setTextColor(6,182,212);
    doc.text('Desbravadores', 14, y); y += 6;
    doc.autoTable({ ...tblOpts, startY:y, head:[['Nome','Unidade','Classe','Nascimento','Contato']], body:(d.data||[]).map(x=>[x.nome,x.unidade?.nome||'—',x.classe?.nome||'—',fmtDate(x.data_nascimento),x.contato||'—']), styles:{...tblOpts.styles,fontSize:8} });

    rodape(doc); doc.save('relatorio_geral.pdf'); flash('PDF gerado!');
  };
});
