// utils.js — Sistema Bússola — utilitários globais

/** Redireciona para login se não houver sessão */
async function requireAuth() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) { window.location.href = 'index.html'; }
  return data.session;
}

/** Exibe flash message */
function flash(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `flash flash-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/** Formata valor em BRL */
function brl(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Formata data ISO para pt-BR */
function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}/${y}`;
}

/** Nomes dos meses */
const MESES = ['', 'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];