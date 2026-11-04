// Edge Function "enviar-convite": cria o convite e manda o e-mail com o nome e o
// brasão do clube, pelo Gmail do sistema (SMTP na porta 465).
//
// Segurança:
// - Roda com o login de quem chamou (o JWT vem do app). O convite é criado com
//   esse login, então o banco (RLS + pode_conceder) decide se a pessoa pode
//   convidar para aquele cargo. A função não usa a service role.
// - O link do e-mail só aponta para endereços da lista SITE_URLS, para ninguém
//   usar o Gmail do sistema para mandar link de outro site.
// - No máximo 30 convites por pessoa a cada hora.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   SMTP_USER  e-mail do Gmail do sistema (ex.: sistema.bussola@gmail.com)
//   SMTP_PASS  senha de app do Google (16 letras, não é a senha da conta)
//   SITE_URLS  endereços aceitos para o link, separados por vírgula; o primeiro é
//              o padrão (ex.: https://sistema-bussola.vercel.app,http://localhost:8081)
import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.16';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CARGO: Record<string, string> = {
  diretor_associado: 'Diretor(a) associado(a)', secretario: 'Secretário(a)', tesoureiro: 'Tesoureiro(a)',
  conselheiro: 'Conselheiro(a)', conselheiro_associado: 'Conselheiro(a) associado(a)', capelao: 'Capelão', instrutor: 'Instrutor(a)',
};

const LIMITE_POR_HORA = 30;

function resposta(status: number, corpo: Record<string, unknown>) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function dataBR(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resposta(405, { erro: 'Método não permitido.' });

  const auth = req.headers.get('Authorization');
  const chave = req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!auth) return resposta(401, { erro: 'Faça login de novo.' });

  let corpo: { email?: string; papel?: string; unidade_id?: string | null; site?: string };
  try {
    corpo = await req.json();
  } catch {
    return resposta(400, { erro: 'Pedido inválido.' });
  }
  const email = (corpo.email ?? '').trim().toLowerCase();
  const papel = corpo.papel ?? '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return resposta(400, { erro: 'Esse e-mail não parece válido.' });
  if (!CARGO[papel]) return resposta(400, { erro: 'Cargo inválido.' });

  const sites = (Deno.env.get('SITE_URLS') ?? '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
  if (!sites.length) return resposta(500, { erro: 'SITE_URLS não configurado na função.' });
  const site = sites.includes((corpo.site ?? '').replace(/\/+$/, '')) ? corpo.site!.replace(/\/+$/, '') : sites[0];

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, chave, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: usuario } = await sb.auth.getUser();
  if (!usuario.user) return resposta(401, { erro: 'Faça login de novo.' });

  const { data: perfil } = await sb.from('perfil_usuario').select('id, nome_completo, clube_id').eq('auth_user_id', usuario.user.id).maybeSingle();
  if (!perfil?.clube_id) return resposta(403, { erro: 'Sua conta não está ligada a um clube.' });

  const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await sb.from('convite').select('id', { count: 'exact', head: true }).eq('criado_por', perfil.id).gte('created_at', desde);
  if ((count ?? 0) >= LIMITE_POR_HORA) return resposta(429, { erro: 'Muitos convites em pouco tempo. Tente de novo daqui a uma hora.' });

  const { data: clube } = await sb.from('clube').select('nome, cidade, brasao_url').eq('id', perfil.clube_id).single();
  if (!clube) return resposta(403, { erro: 'Clube não encontrado.' });

  // O banco confere se quem chamou pode convidar para esse cargo (pode_conceder)
  const { data: convite, error } = await sb.from('convite')
    .insert({ clube_id: perfil.clube_id, papel, unidade_id: corpo.unidade_id ?? null, email })
    .select('id, token, expira_em, unidade:unidade_id(nome)')
    .single();
  if (error || !convite) {
    const msg = error?.code === '42501' ? 'Você não pode convidar para esse cargo.' : (error?.hint ?? error?.message ?? 'Não foi possível criar o convite.');
    return resposta(403, { erro: msg });
  }

  const link = `${site}/convite/${convite.token}`;
  const unidade = (convite.unidade as { nome?: string } | null)?.nome;
  const cargo = CARGO[papel] + (unidade ? ` da unidade ${unidade}` : '');
  const quem = perfil.nome_completo.split(' ')[0];
  const brasao = clube.brasao_url
    ? `<img src="${esc(clube.brasao_url)}" width="88" height="88" alt="Brasão do ${esc(clube.nome)}" style="display:block;margin:0 auto 16px;border-radius:16px;object-fit:contain">`
    : '';

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#EEF3F5;font-family:Arial,Helvetica,sans-serif;color:#10242E">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:20px;padding:32px 28px;text-align:center">
<tr><td>
${brasao}
<p style="margin:0 0 6px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#4A6470">Convite</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3">${esc(clube.nome)} está te convidando</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.5">${esc(quem)} convidou você para ser <strong>${esc(cargo)}</strong> no ${esc(clube.nome)}${clube.cidade ? `, em ${esc(clube.cidade)}` : ''}.</p>
<a href="${esc(link)}" style="display:inline-block;background:#144E66;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 28px;border-radius:12px">Aceitar convite</a>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#4A6470">O convite vale até ${dataBR(convite.expira_em)}. Se o botão não funcionar, copie este endereço no navegador:<br><span style="word-break:break-all">${esc(link)}</span></p>
<p style="margin:20px 0 0;font-size:12px;color:#7A8E97">Se você não esperava este convite, pode ignorar este e-mail.</p>
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#7A8E97">Enviado pelo Sistema Bússola</p>
</td></tr></table></body></html>`;

  const texto = `${clube.nome} está te convidando\n\n${quem} convidou você para ser ${cargo} no ${clube.nome}.\n\nAceitar convite: ${link}\n\nO convite vale até ${dataBR(convite.expira_em)}. Se você não esperava este convite, ignore este e-mail.`;

  try {
    const smtp = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: Deno.env.get('SMTP_USER'), pass: Deno.env.get('SMTP_PASS') },
    });
    await smtp.sendMail({
      from: { name: clube.nome, address: Deno.env.get('SMTP_USER')! },
      to: email,
      replyTo: usuario.user.email ?? undefined,
      subject: `Convite: ${cargo} no ${clube.nome}`,
      text: texto,
      html,
    });
  } catch (e) {
    console.error('[enviar-convite] falha no SMTP', e);
    // O convite já existe: o app mostra o link para copiar e mandar de outro jeito
    return resposta(502, { erro: 'O convite foi criado, mas o e-mail não saiu. Copie o link e envie por mensagem.', token: convite.token });
  }

  return resposta(200, { ok: true, token: convite.token });
});
