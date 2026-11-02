// Camada de dados. Com SUPABASE_URL e SUPABASE_ANON_KEY preenchidos usa o Supabase
// (login por e-mail e senha + tabela "registros"). Sem eles, roda em modo local.
import { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL } from '../supabase-config.js';

let sb = null;
let modo = 'local';
const TABELA = 'registros';

const chaveLocal = col => 'compras_casa:' + col;
const lerLocal = col => { try { return JSON.parse(localStorage.getItem(chaveLocal(col)) || '{}'); } catch { return {}; } };
const gravarLocal = (col, obj) => localStorage.setItem(chaveLocal(col), JSON.stringify(obj));

export function modoAtual() { return modo; }

async function estadoDe(sessao) {
  const u = sessao?.user;
  if (!u) return { usuario: null };
  const email = (u.email || '').toLowerCase();
  const admin = email === ADMIN_EMAIL.toLowerCase();
  let membro = admin;
  if (!admin) {
    // as regras só deixam ler a lista quem está nela: vazio = ainda não liberado
    const { data } = await sb.from('membros').select('email').eq('email', email);
    membro = !!data?.length;
  }
  return { usuario: { nome: email, email }, admin, membro };
}

export async function iniciar(aoMudar) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    modo = 'local';
    aoMudar({ usuario: { nome: 'Modo local', email: '' }, admin: true, membro: true });
    return;
  }
  modo = 'nuvem';
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  const { data } = await sb.auth.getSession();
  let atual = data.session?.user?.id || null;
  aoMudar(await estadoDe(data.session));
  sb.auth.onAuthStateChange((evento, sessao) => {
    const novo = sessao?.user?.id || null;
    if (novo !== atual) { atual = novo; estadoDe(sessao).then(aoMudar); }
  });
}

const MENSAGENS = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Conta ainda não confirmada. Peça para a Vitoria marcar a conta como confirmada no Supabase.',
  'Password should be at least 6 characters.': 'A senha precisa ter pelo menos 6 caracteres.',
  'User already registered': 'Já existe conta com este e-mail. Use "Entrar".',
  'Signups not allowed for this instance': 'O cadastro está desligado no Supabase.'
};
const traduzir = e => new Error(MENSAGENS[e.message] || (/fetch|network/i.test(e.message) ? 'Sem conexão com o servidor. Confira a internet e tente de novo.' : e.message));

export async function entrar(email, senha) {
  const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
  if (error) throw traduzir(error);
}
export async function criarConta(email, senha) {
  const { data, error } = await sb.auth.signUp({ email: email.trim().toLowerCase(), password: senha });
  if (error) throw traduzir(error);
  if (!data.session) throw new Error('Conta criada, mas o Supabase está pedindo confirmação por e-mail. Desligue "Confirm email" em Authentication e tente entrar.');
}
export async function verificarAcesso() {
  const { data } = await sb.auth.getSession();
  return estadoDe(data.session);
}
export async function trocarSenha(senha) {
  const { error } = await sb.auth.updateUser({ password: senha });
  if (error) throw traduzir(error);
}
export async function sair() { if (sb) await sb.auth.signOut(); }

async function paginado(montar) {
  const tam = 1000; let ini = 0; const todos = [];
  for (;;) {
    const { data, error } = await montar().range(ini, ini + tam - 1);
    if (error) throw error;
    todos.push(...data);
    if (data.length < tam) return todos;
    ini += tam;
  }
}

export async function listar(col) {
  if (modo === 'local') return Object.entries(lerLocal(col)).map(([id, v]) => ({ ...v, id }));
  const linhas = await paginado(() => sb.from(TABELA).select('id,dados').eq('colecao', col).order('id'));
  const docs = linhas.map(l => ({ ...l.dados, id: l.id }));
  if (col === 'config') {
    const { data, error } = await sb.from('membros').select('email').order('email');
    if (error) throw error;
    docs.push({ id: 'membros', emails: data.map(m => m.email) });
  }
  return docs;
}

// Só os documentos com campo >= valor (usado para os eventos dos últimos dias).
export async function listarDesde(col, campo, valor) {
  if (modo === 'local') return Object.entries(lerLocal(col)).map(([id, v]) => ({ ...v, id })).filter(d => (d[campo] || '') >= valor);
  const linhas = await paginado(() => sb.from(TABELA).select('id,dados').eq('colecao', col).gte(`dados->>${campo}`, valor).order('id'));
  return linhas.map(l => ({ ...l.dados, id: l.id }));
}

const limpar = o => JSON.parse(JSON.stringify(o)); // remove undefined e funções

export async function salvar(col, id, obj) {
  const dados = limpar({ ...obj }); delete dados.id;
  if (modo === 'local') { const t = lerLocal(col); t[id] = dados; gravarLocal(col, t); return; }
  if (col === 'config' && id === 'membros') return salvarMembros(dados.emails || []);
  const { error } = await sb.from(TABELA).upsert({ colecao: col, id, dados, atualizado_em: new Date().toISOString() });
  if (error) throw erroBanco(error);
}

export async function apagar(col, id) {
  if (modo === 'local') { const t = lerLocal(col); delete t[id]; gravarLocal(col, t); return; }
  const { error } = await sb.from(TABELA).delete().eq('colecao', col).eq('id', id);
  if (error) throw erroBanco(error);
}

async function salvarMembros(emails) {
  emails = [...new Set(emails.map(e => e.trim().toLowerCase()).filter(Boolean))];
  const { data, error } = await sb.from('membros').select('email');
  if (error) throw erroBanco(error);
  const sair = data.map(m => m.email).filter(e => !emails.includes(e));
  if (sair.length) { const r = await sb.from('membros').delete().in('email', sair); if (r.error) throw erroBanco(r.error); }
  if (emails.length) { const r = await sb.from('membros').upsert(emails.map(email => ({ email }))); if (r.error) throw erroBanco(r.error); }
}

function erroBanco(e) {
  const err = new Error(e.message);
  if (e.code === '42501' || /row-level security/i.test(e.message)) err.code = 'permission-denied';
  return err;
}

export const COLECOES = ['notas', 'ajustes', 'pessoas', 'config', 'cardapio', 'tarefas', 'movimentos'];
// 'eventos' (água, refeições, tarefas feitas) é lido por período com listarDesde.
