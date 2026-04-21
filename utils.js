// utils.js — Sistema Bússola — utilitários globais

// ── Contexto do usuário logado (populado no init do app.js) ──
window.CTX = {
  session:    null,
  perfil:     null,
  clube:      null,
  clubeId:    null,
  papel:      null,
};

/** Redireciona para login se não houver sessão */
async function requireAuth() {
  const { data } = await db.auth.getSession();
  if (!data.session) { window.location.href = 'index.html'; return null; }
  return data.session;
}

/** Carrega o perfil do usuário logado e popula CTX. */
async function carregarPerfil(userId) {
  const { data } = await db
    .from('perfil_usuario')
    .select('*, clube:clube_id(id, nome, cidade, associacao_id)')
    .eq('auth_user_id', userId)
    .single();
  if (!data) return null;
  CTX.perfil  = data;
  CTX.clube   = data.clube;
  CTX.clubeId = data.clube_id;
  CTX.papel   = data.papel;
  return data;
}

/** Verifica se o papel atual tem permissão */
function pode(papeis) { return papeis.includes(CTX.papel); }

const PAPEL_FINANCEIRO = ['diretor','diretor_associado','tesoureiro','admin_sistema'];
const PAPEL_CADASTRO   = ['diretor','diretor_associado','secretario','admin_sistema'];
const PAPEL_DIRETOR    = ['diretor','admin_sistema'];

/** Flash message */
function flash(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `flash flash-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function brl(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}/${y}`;
}

const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const PAPEL_LABEL = {
  admin_sistema:'Admin do Sistema', regional:'Regional', pastor:'Pastor',
  diretor:'Diretor', diretor_associado:'Diretor Associado',
  secretario:'Secretário', tesoureiro:'Tesoureiro',
};
