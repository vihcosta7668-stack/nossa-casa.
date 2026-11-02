import * as D from './dados.js';
import { parseNota, textoDoPdf } from './parser.js';
import { PAPEIS, CATEGORIAS, PRIORIDADES, montarProdutos, preverLista, aplicarOrcamento, indicePrecos } from './catalogo.js';
import { REFEICOES, ATIVIDADE, energia, gerarCardapio } from './cardapio.js';
import { diaLocal, somaDias, FREQ, MODOS, SEMANA, agendaTarefas, metaAgua, aguaHoje, ultimoEvento, tarefasIniciais, responsaveis, ocorre } from './rotina.js';
import { saldos, estoquePorPapel, baixarPapel, deltaAcabou, nivel } from './estoque.js';

if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

const PALETA = ['#e8590c', '#7048e8', '#0c8599', '#2f9e44', '#d6336c', '#1971c2', '#f08c00'];
const S = {
  usuario: null, admin: false, aba: 'hoje', sub: { tarefas: 'hoje', cozinha: 'estoque', compras: 'resumo' }, filtroEstoque: 'Alimento',
  notas: [], ajustes: {}, pessoas: [], geral: {}, membros: { emails: [] }, cardapio: null, porcoes: {},
  tarefas: [], movimentos: [], eventos: [], eu: null
};

// ---------- utilidades ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = v => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = v => (v >= 0 ? '+' : '') + (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
const dataBr = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
const hora = iso => { const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const n2 = v => (+v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const qt = (q, base) => {
  if (base === 'g') return q >= 1000 ? n2(q / 1000) + ' kg' : Math.round(q) + ' g';
  if (base === 'ml') return q >= 1000 ? n2(q / 1000) + ' L' : Math.round(q) + ' ml';
  return n2(q) + ' un';
};
const qtdItem = (q, un) => un === 'KG' ? q.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) + ' kg' : n2(q) + ' ' + (un || '').toLowerCase();
const novoId = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const hojeStr = () => diaLocal();
const nomeDia = dia => new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

const ICON = {
  check: 'M20 6 9 17l-5-5', agua: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  comida: 'M7 3v8a2 2 0 0 0 2 2v8M11 3v8M3 3v8a2 2 0 0 0 2 2M17 3c-2 0-3 3-3 6s1 4 3 4v8',
  caixa: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8', alerta: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  sino: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0', nota: 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6',
  tarefa: 'M10 6h10M10 12h10M10 18h10M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5',
  vazio: 'M4 7h16l-1.5 12a2 2 0 0 1-2 1.8h-9a2 2 0 0 1-2-1.8zM9 7V5a3 3 0 0 1 6 0v2M9 13h6',
  panela: 'M4 11h16v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM2 11h20M9 7.5c0-1.2.7-2 2-2.5M13 7.5c0-1.2.7-2 2-2.5',
  relogio: 'M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z'
};
const ic = n => `<svg viewBox="0 0 24 24"><path d="${ICON[n]}"/></svg>`;

function aviso(msg) { const a = $('#aviso'); a.textContent = msg; a.hidden = false; clearTimeout(aviso.t); aviso.t = setTimeout(() => a.hidden = true, 3800); }
function abrirFolha(html) { $('#folhaCorpo').innerHTML = html; $('#folha').hidden = false; }
function fecharFolha() { $('#folha').hidden = true; }
$('#folha').addEventListener('click', e => { if (e.target.id === 'folha' || e.target.closest('[data-fechar]')) fecharFolha(); });
async function tentar(fn, ok) {
  try { await fn(); if (ok) aviso(ok); return true; }
  catch (e) { console.error(e); aviso(e.code === 'permission-denied' ? 'Sem permissão para essa alteração.' : 'Não deu certo: ' + (e.message || e)); return false; }
}

// ---------- pessoas ----------
const pessoa = id => S.pessoas.find(p => p.id === id);
const eu = () => pessoa(S.eu);
const corDe = p => p?.cor || PALETA[Math.max(0, S.pessoas.indexOf(p)) % PALETA.length];
const iniciais = nome => (nome || '?').split(/\s+/).filter(w => w.length > 1 || /\d/.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const avatar = (p, s) => `<span class="av" style="--c:${corDe(p)};${s ? `--s:${s}px` : ''}" title="${esc(p?.nome)}">${esc(iniciais(p?.nome))}</span>`;
const primeiroNome = p => { const n = (p?.nome || '').split(' ')[0]; return S.pessoas.filter(x => (x.nome || '').split(' ')[0] === n).length > 1 ? p.nome : n; };

// ---------- dados derivados ----------
const produtos = () => montarProdutos(S.notas, S.ajustes);
const notasMercado = () => S.notas.filter(n => (n.tipo || 'mercado') === 'mercado').sort((a, b) => b.data.localeCompare(a.data));
const ultimaMercado = () => notasMercado()[0];
const saldoAtual = prods => saldos(prods || produtos(), S.movimentos, S.geral.estoqueDesde);

function lista() {
  const prods = produtos();
  const sal = saldoAtual(prods);
  const linhas = preverLista(prods, S.notas, S.cardapio?.faltas || {});
  const base = ultimaMercado()?.id;
  for (const l of linhas) {
    const aj = S.ajustes[l.id];
    if (aj?.qtdLista != null && aj.qtdListaBase === base) { l.qtdFinal = aj.qtdLista; l.manual = true; l.valor = +(l.qtdFinal * l.preco).toFixed(2); }
    l.nivel = nivel(prods[l.id], sal[l.id] || 0);
  }
  const r = aplicarOrcamento(linhas.filter(l => l.qtdFinal > 0), +S.geral.orcamento || 0);
  return { linhas, ...r, prods };
}

// ---------- carga ----------
async function carregar() {
  const [notas, ajustes, pessoas, config, cardapio, tarefas, movimentos] = await Promise.all(D.COLECOES.map(c => D.listar(c)));
  S.notas = notas;
  S.ajustes = Object.fromEntries(ajustes.map(a => [a.id, a]));
  S.pessoas = pessoas.sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99));
  S.geral = config.find(c => c.id === 'geral') || {};
  S.membros = config.find(c => c.id === 'membros') || { emails: [] };
  S.cardapio = cardapio.find(c => c.id === 'atual') || null;
  S.porcoes = (cardapio.find(c => c.id === 'porcoes') || {}).valores || {};
  S.tarefas = tarefas;
  S.movimentos = movimentos;
  S.eventos = await D.listarDesde('eventos', 'dia', somaDias(hojeStr(), -8));
  if (!S.pessoas.length && S.admin) await semearPessoas();
  if (!S.tarefas.length && S.admin && !S.geral.tarefasSemeadas && S.pessoas.length) await semearTarefas();
  if (!S.geral.estoqueDesde && ultimaMercado()) { S.geral.estoqueDesde = ultimaMercado().data.slice(0, 10); await D.salvar('config', 'geral', S.geral).catch(() => {}); }
  definirEu();
}

async function atualizarRotina() {
  try {
    const [tarefas, movimentos, eventos] = await Promise.all([D.listar('tarefas'), D.listar('movimentos'), D.listarDesde('eventos', 'dia', somaDias(hojeStr(), -8))]);
    S.tarefas = tarefas; S.movimentos = movimentos; S.eventos = eventos;
    const editando = !$('#folha').hidden || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if (!editando) render();
  } catch (e) { console.error(e); }
}

function definirEu() {
  if (D.modoAtual() === 'nuvem') {
    const p = S.pessoas.find(x => (x.email || '').toLowerCase() === S.usuario.email);
    S.eu = p?.id || null;
  } else {
    let id = null; try { id = localStorage.getItem('eu'); } catch {}
    S.eu = pessoa(id) ? id : null;
  }
}

async function semearPessoas() {
  const todas = { cafe: true, almoco: true, lanche: true, jantar: true };
  const base = [
    { nome: 'Vitoria', idade: 24, sexo: 'F', email: (S.usuario?.email || ''), refeicoes: { semana: { cafe: true, jantar: true }, fds: { ...todas } } },
    { nome: 'Mãe', idade: 47, sexo: 'F', refeicoes: { semana: { ...todas }, fds: { ...todas } } },
    { nome: 'Irmão do meio', idade: 19, sexo: 'M', refeicoes: { semana: { ...todas }, fds: { ...todas } } },
    { nome: 'Irmão mais novo', idade: 16, sexo: 'M', refeicoes: { semana: { ...todas }, fds: { ...todas } } }
  ];
  for (let i = 0; i < base.length; i++) {
    const p = { email: '', ...base[i], ordem: i, cor: PALETA[i], atividade: 1.375, peso: '', altura: '', naoCome: [], alergias: '', obs: '', lembreteAgua: 90 };
    const id = 'p' + (i + 1);
    await D.salvar('pessoas', id, p); S.pessoas.push({ ...p, id });
  }
}

async function semearTarefas() {
  for (const t of tarefasIniciais(S.pessoas)) { const { id, ...dados } = t; await D.salvar('tarefas', id, dados); S.tarefas.push(t); }
  S.geral.tarefasSemeadas = true; await D.salvar('config', 'geral', S.geral);
}

async function registrar(ev) {
  const e = { id: novoId('e'), por: S.eu, dia: hojeStr(), em: new Date().toISOString(), ...ev };
  await D.salvar('eventos', e.id, e);
  S.eventos.push(e);
  return e;
}
async function movimentar(movs, motivo) {
  for (const m of movs) {
    const reg = { id: novoId('m'), produtoId: m.produtoId, delta: m.delta, motivo, por: S.eu, em: new Date().toISOString(), dia: hojeStr() };
    await D.salvar('movimentos', reg.id, reg);
    S.movimentos.push(reg);
  }
}

// ---------- textos de eventos ----------
const NOME_REF = Object.fromEntries(REFEICOES.concat([['beliscou', 'Entre as refeições']]));
function textoEvento(e) {
  const quem = `<b>${esc(primeiroNome(pessoa(e.por)) || 'Alguém')}</b>`;
  if (e.tipo === 'agua') return `${quem} bebeu ${e.ml} ml de água`;
  if (e.tipo === 'comida') return `${quem} comeu (${esc((NOME_REF[e.refeicao] || '').toLowerCase())}): ${esc(e.texto)}`;
  if (e.tipo === 'tarefa') { const t = S.tarefas.find(x => x.id === e.tarefaId); const para = e.para && e.para !== e.por ? ` (vez de ${esc(primeiroNome(pessoa(e.para)))})` : ''; return `${quem} concluiu <b>${esc(t?.nome || 'tarefa')}</b>${para}`; }
  if (e.tipo === 'preparo') return `${quem} preparou ${esc((NOME_REF[e.slot] || '').toLowerCase())}: ${esc(e.texto)}`;
  if (e.tipo === 'estoque') return `${quem} ${esc(e.texto)}`;
  if (e.tipo === 'nota') return `${quem} ${esc(e.texto)}`;
  return `${quem} ${esc(e.texto || '')}`;
}

// ---------- telas ----------
const telas = {};
const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
const topo = titulo => `<div class="topo"><div><div class="data">${esc(nomeDia(hojeStr()))}</div><h1>${titulo}</h1></div>
  <button class="eu" data-acao="familia" aria-label="Família e ajustes">${eu() ? avatar(eu(), 42) : `<span class="av" style="--s:42px;--c:#a5a2ad">?</span>`}</button></div>`;
const seg = (grupo, opcoes) => `<div class="seg">${opcoes.map(([k, n]) => `<button data-seg="${grupo}:${k}" class="${S.sub[grupo] === k ? 'ativo' : ''}">${n}</button>`).join('')}</div>`;

function slotAgora() { const h = new Date().getHours(); return h < 10 ? 'cafe' : h < 15 ? 'almoco' : h < 18 ? 'lanche' : 'jantar'; }
function refeicaoDoCardapio(dia, slot) { return S.cardapio?.dias_?.find(d => d.data === dia)?.refeicoes?.[slot] || null; }
const preparado = (dia, slot) => S.eventos.find(e => e.tipo === 'preparo' && e.dia === dia && e.slot === slot);

function anelAgua(ml, meta) {
  const r = 38, c = 2 * Math.PI * r, f = Math.min(1, meta ? ml / meta : 0);
  return `<div class="anel"><svg viewBox="0 0 92 92"><circle class="fundo-anel" cx="46" cy="46" r="${r}"/><circle class="valor" cx="46" cy="46" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}" stroke-linecap="round"/></svg>
    <div class="centro"><div>${Math.round(f * 100)}%<small>${n2(ml / 1000)} L</small></div></div></div>`;
}

telas.hoje = () => {
  const me = eu();
  const hoje = hojeStr();
  const agenda = agendaTarefas(S.tarefas, S.eventos, hoje);
  const minhas = me ? agenda.filter(a => a.quem.includes(me.id)) : [];
  const atrasadasMinhas = minhas.filter(a => a.atrasada);
  const prods = produtos(); const sal = saldoAtual(prods);
  const acabou = Object.values(prods).filter(p => !p.avulso && nivel(p, sal[p.id] || 0) === 'acabou' && p.compras.some(c => c.data.slice(0, 10) >= (S.geral.estoqueDesde || '')));
  const slot = slotAgora(); const ref = refeicaoDoCardapio(hoje, slot);
  const doDia = S.eventos.filter(e => e.dia === hoje).sort((a, b) => b.em.localeCompare(a.em));
  const ml = me ? aguaHoje(S.eventos, me.id, hoje) : 0, meta = me ? metaAgua(me) : 2000;
  const ultAgua = me ? ultimoEvento(S.eventos, me.id, 'agua') : null;
  const prox = ultAgua ? new Date(new Date(ultAgua.em).getTime() + (+me.lembreteAgua || 90) * 60000) : null;

  return `${topo(`${saudacao()}${me ? ', ' + esc(primeiroNome(me)) : ''}`)}
  ${!me ? `<div class="alerta-card info">${ic('sino')}<div class="txt"><b>Quem está usando este aparelho?</b>Escolha seu nome para registrar água, refeições e tarefas.</div><button class="btn mini prim" data-acao="quemSou">Escolher</button></div>` : ''}
  ${atrasadasMinhas.map(a => `<div class="alerta-card">${ic('alerta')}<div class="txt"><b>${esc(a.tarefa.nome)} não foi feita</b>${a.hoje ? 'Prazo era ' + esc(a.tarefa.prazo) + ' de hoje' : 'Ficou pendente de ' + dataBr(a.dia).slice(0, 5)}</div>
    <button class="btn mini ok" data-acao="fazerTarefa" data-t="${esc(a.tarefa.id)}" data-dia="${a.dia}">Feito</button></div>`).join('')}
  ${acabou.length ? `<div class="alerta-card ambar">${ic('vazio')}<div class="txt"><b>Acabou em casa</b>${acabou.slice(0, 5).map(p => esc(p.nome)).join(', ')}${acabou.length > 5 ? ` e mais ${acabou.length - 5}` : ''}. Está marcado na lista de compras.</div></div>` : ''}

  ${me ? `<div class="cartao"><div class="agua">${anelAgua(ml, meta)}<div style="flex:1">
      <div class="rotulo">Água hoje</div><div style="font-weight:800;font-size:20px">${ml.toLocaleString('pt-BR')} <span class="suave" style="font-weight:600">de ${meta.toLocaleString('pt-BR')} ml</span></div>
      <div class="botoes"><button class="btn mini agua-btn" data-agua="200">+ copo 200</button><button class="btn mini agua-btn" data-agua="500">+ garrafa 500</button><button class="btn mini" data-acao="aguaOutro">outro</button></div>
      <div class="suave" style="margin-top:6px">${prox ? (prox > new Date() ? 'Próximo lembrete às ' + hora(prox.toISOString()) : 'Está na hora de beber água') : 'Ainda não registrou água hoje'}</div></div></div></div>` : ''}

  ${ref ? `<div class="cartao"><div class="refeicao"><div class="icone-redondo">${ic('comida')}</div><div style="flex:1;min-width:0">
      <div class="rotulo">${esc(NOME_REF[slot])} do cardápio</div><div style="font-weight:700">${esc(ref.texto)}</div></div></div>
      <div class="acoes">${me ? `<button class="btn mini" data-acao="comi" data-slot="${slot}">Comi</button>` : ''}
      ${preparado(hoje, slot) ? `<span class="tag ok">preparado por ${esc(primeiroNome(pessoa(preparado(hoje, slot).por)))}</span>` : `<button class="btn mini" data-acao="preparei" data-dia="${hoje}" data-slot="${slot}">Preparei (dar baixa no estoque)</button>`}</div></div>` : ''}

  ${me ? `<h2>Suas tarefas <button class="link" data-aba="tarefas">ver todas</button></h2>
    ${minhas.length ? `<div class="cartao">${minhas.map(linhaTarefa).join('')}</div>` : '<div class="vazio">Nenhuma tarefa sua hoje.</div>'}` : ''}

  <h2>Família hoje</h2>
  <div class="familia">${S.pessoas.map(p => {
    const mlp = aguaHoje(S.eventos, p.id, hoje), mt = metaAgua(p);
    const tp = agenda.filter(a => a.quem.includes(p.id) && a.hoje); const feitas = tp.filter(a => a.feito).length;
    const atr = agenda.filter(a => a.quem.includes(p.id) && a.atrasada).length;
    const ult = S.eventos.filter(e => e.por === p.id && e.dia === hoje).sort((a, b) => b.em.localeCompare(a.em))[0];
    return `<div class="membro"><div class="topo-m">${avatar(p, 30)}${esc(primeiroNome(p))}</div>
      <div class="mini-l"><span>Água</span><span>${Math.round(mlp / mt * 100)}%</span></div><div class="barra"><i style="width:${Math.min(100, mlp / mt * 100)}%"></i></div>
      <div class="mini-l"><span>Tarefas</span><span>${tp.length ? feitas + '/' + tp.length : '—'}${atr ? ` <b class="sobe">${atr} atrasada${atr > 1 ? 's' : ''}</b>` : ''}</span></div>
      <div class="ultimo">${ult ? hora(ult.em) + ' · ' + textoEvento(ult).replace(/<[^>]+>/g, '').replace(primeiroNome(p) + ' ', '') : 'Sem registros hoje'}</div></div>`;
  }).join('')}</div>

  <h2>Hoje na casa</h2>
  ${doDia.length ? `<div class="cartao tempo">${doDia.slice(0, 30).map(e => `<div class="ev">${avatar(pessoa(e.por), 28)}<div class="t">${textoEvento(e)}</div><div class="h">${hora(e.em)}</div></div>`).join('')}</div>`
    : '<div class="vazio">Nada registrado hoje ainda. Use o botão + para registrar.</div>'}`;
};

function linhaTarefa(a) {
  const t = a.tarefa;
  return `<div class="linha ${a.feito ? 'feita' : ''}">
    <button class="check ${a.feito ? 'feito' : a.atrasada ? 'atrasada' : ''}" data-acao="${a.feito ? 'desfazerTarefa' : 'fazerTarefa'}" data-t="${esc(t.id)}" data-dia="${a.dia}" aria-label="Concluir">${ic('check')}</button>
    <div class="meio"><div class="nome">${esc(t.nome)}</div>
      <div class="suave">${t.local ? esc(t.local) + ' · ' : ''}${a.hoje ? 'até ' + esc(t.prazo || '23:59') : 'de ' + dataBr(a.dia).slice(0, 5)}
      ${a.feito ? ` · feita por ${esc(primeiroNome(pessoa(a.feito.por)))} às ${hora(a.feito.em)}` : ''}${a.atrasada ? ' <span class="tag alerta">atrasada</span>' : ''}</div></div>
    <span class="pilha">${a.quem.map(id => avatar(pessoa(id), 28)).join('')}</span></div>`;
}

telas.tarefas = () => {
  const hoje = hojeStr();
  const agenda = agendaTarefas(S.tarefas, S.eventos, hoje);
  let corpo = '';
  if (S.sub.tarefas === 'hoje') {
    const atrasadas = agenda.filter(a => a.atrasada);
    const doDia = agenda.filter(a => a.hoje && !a.atrasada);
    corpo = `${atrasadas.length ? `<h2>Atrasadas</h2><div class="cartao">${atrasadas.map(linhaTarefa).join('')}</div>` : ''}
      <h2>Hoje</h2>${doDia.length ? `<div class="cartao">${doDia.map(linhaTarefa).join('')}</div>` : '<div class="vazio">Nenhuma tarefa para hoje.</div>'}
      <p class="suave">Qualquer pessoa pode marcar como feita; fica registrado quem marcou. Tarefa não concluída até o prazo vira aviso para o responsável sempre que ele abrir o app.</p>`;
  } else if (S.sub.tarefas === 'semana') {
    corpo = Array.from({ length: 7 }, (_, i) => somaDias(hoje, i)).map(dia => {
      const ts = S.tarefas.filter(t => ocorre(t, dia));
      return `<h2>${esc(nomeDia(dia))}</h2>${ts.length ? `<div class="cartao">${ts.map(t => `<div class="linha"><div class="meio"><div class="nome">${esc(t.nome)}</div><div class="suave">até ${esc(t.prazo || '23:59')}</div></div>
        <span class="pilha">${responsaveis(t, dia).map(id => avatar(pessoa(id), 28)).join('')}</span></div>`).join('')}</div>` : '<p class="suave">Sem tarefas.</p>'}`;
    }).join('');
  } else {
    corpo = `<div class="cartao">${S.tarefas.length ? S.tarefas.map(t => `<div class="linha"><div class="meio"><div class="nome">${esc(t.nome)}${t.pausada ? ' <span class="tag">pausada</span>' : ''}</div>
        <div class="suave">${esc(descreverFreq(t))} · até ${esc(t.prazo || '23:59')} · ${esc(MODOS.find(m => m[0] === t.modo)?.[1] || '')}</div></div>
        <span class="pilha">${(t.pessoas || []).map(id => avatar(pessoa(id), 26)).join('')}</span><button class="btn mini" data-acao="editarTarefa" data-t="${esc(t.id)}">Editar</button></div>`).join('') : '<p class="suave">Nenhuma tarefa.</p>'}</div>
      <div class="acoes"><button class="btn prim" data-acao="editarTarefa">Nova tarefa</button></div>`;
  }
  return topo('Tarefas da casa') + seg('tarefas', [['hoje', 'Hoje'], ['semana', 'Semana'], ['gerenciar', 'Gerenciar']]) + corpo;
};
const descreverFreq = t => t.freq === 'diaria' ? 'Todo dia' : t.freq === 'semanal' ? (t.dias || []).map(d => SEMANA[d]).join(', ') : `A cada ${t.intervalo} dias`;

telas.cozinha = () => topo('Cozinha') + seg('cozinha', [['estoque', 'Estoque'], ['cardapio', 'Cardápio']]) + (S.sub.cozinha === 'estoque' ? telaEstoque() : telaCardapio());

function telaEstoque() {
  const prods = produtos();
  if (!Object.keys(prods).length) return '<div class="vazio">O estoque nasce das notas. Envie o comprovante em Compras → Notas.</div>';
  const sal = saldoAtual(prods);
  const filtro = S.filtroEstoque;
  const lista = Object.values(prods).filter(p => filtro === 'Todos' || p.categoria === filtro || (filtro === 'Alimento' && p.categoria === 'Bebida'))
    .filter(p => p.compras.some(c => c.data.slice(0, 10) >= (S.geral.estoqueDesde || '')) || (sal[p.id] || 0) > 0)
    .sort((a, b) => ({ acabou: 0, acabando: 1, ok: 2 }[nivel(a, sal[a.id] || 0)] - { acabou: 0, acabando: 1, ok: 2 }[nivel(b, sal[b.id] || 0)]) || a.nome.localeCompare(b.nome));
  const usosHoje = S.movimentos.filter(m => m.dia === hojeStr() && m.delta < 0).length;
  return `<p class="suave">Controle desde ${dataBr(S.geral.estoqueDesde)}. Entra pelas notas; sai pelo que cada um registra como usado. ${usosHoje ? usosHoje + ' baixas hoje.' : ''}</p>
  <div class="chips">${['Alimento', 'Limpeza', 'Higiene', 'Outros', 'Todos'].map(c => `<button data-filtro="${c}" class="${filtro === c ? 'ativo' : ''}">${c === 'Alimento' ? 'Alimentos' : c}</button>`).join('')}</div>
  <div class="cartao">${lista.map(p => {
    const s = Math.max(0, sal[p.id] || 0), nv = nivel(p, s), ult = p.compras[p.compras.length - 1].qtd || 1;
    const base = p.papel ? PAPEIS[p.papel].base : null;
    const total = base && p.conteudo ? ' · ≈ ' + qt(s * p.conteudo, base) : '';
    return `<div class="linha"><div class="meio" data-acao="contar" data-id="${esc(p.id)}" style="cursor:pointer">
      <div class="nome">${esc(p.nome)}${nv === 'acabou' ? ' <span class="tag alerta">acabou</span>' : nv === 'acabando' ? ' <span class="tag ambar">acabando</span>' : ''}</div>
      <div class="suave">${qtdItem(s, p.un)}${total} · ${esc(p.descricao)}</div>
      <div class="barra estoque ${nv === 'acabando' ? 'acabando' : ''}"><i style="width:${Math.min(100, s / ult * 100)}%"></i></div></div>
      <div class="dir"><button class="btn mini" data-acao="usei" data-id="${esc(p.id)}" ${s <= 0 ? 'disabled' : ''}>Usei</button>
      <button class="btn mini perigo" data-acao="acabou" data-id="${esc(p.id)}" ${s <= 0 ? 'disabled' : ''}>Acabou 1</button></div></div>`;
  }).join('') || '<p class="suave">Nada nesta categoria.</p>'}</div>
  <p class="suave">"Acabou 1" fecha um pacote/unidade (ex.: acabou o pacote de 5 kg de arroz). Toque no nome para contar quanto tem de verdade.</p>`;
}

function telaCardapio() {
  const c = S.cardapio;
  const ult = ultimaMercado();
  const hoje = hojeStr();
  const fimSug = ult ? somaDias(ult.data.slice(0, 10), +(S.geral.dias || 30)) : somaDias(hoje, 30);
  const diasSug = Math.max(7, Math.round((new Date(fimSug + 'T12:00:00') - new Date(hoje + 'T12:00:00')) / 86400000));
  const cab = S.admin ? `<div class="cartao"><p>Usa o estoque de hoje, já descontado o que foi usado, até a próxima compra, conforme quem come em casa em cada refeição.</p>
      <label class="campo">Dias até a próxima compra<input type="number" id="diasCiclo" min="3" max="45" value="${diasSug}"></label>
      <div class="acoes"><button class="btn prim" data-acao="gerar" ${S.notas.length ? '' : 'disabled'}>${c ? 'Gerar de novo' : 'Gerar cardápio'}</button>
      <button class="btn" data-acao="porcoes">Porções</button>${c ? '<button class="btn" data-acao="imprimir">Imprimir</button>' : ''}</div>
      ${c?.editadas ? '<p class="suave">Gerar de novo apaga as edições feitas à mão.</p>' : ''}</div>`
    : `<p class="suave">Só a Vitoria gera e edita o cardápio. Todos podem marcar "preparei" e "comi".</p>`;
  if (!c) return cab + '<div class="vazio">Cardápio ainda não gerado.</div>';
  const faltas = Object.entries(c.faltas || {}).filter(([, v]) => v > 0);
  return cab + `
  <div class="cartao"><b>${dataBr(c.inicio)} a ${dataBr(c.fim)}</b> · ${c.dias} dias
    <p class="suave">Porções: ${c.pessoas.map(p => `${esc(primeiroNome(pessoa(p.id)) || p.nome)} ×${n2(p.fator)}`).join(' · ')} (1,0 = adulto de 2.200 kcal).</p>
    ${faltas.length ? `<p class="falta-txt">Para fechar o período faltam: ${faltas.map(([k, v]) => `${esc(PAPEIS[k]?.nome || k)} ${qt(v, PAPEIS[k]?.base)}`).join(', ')}. Já está na lista de compras.</p>` : '<p>O estoque cobre o período inteiro.</p>'}</div>
  ${c.dias_.filter(d => d.data >= hoje).map(d => { const dd = new Date(d.data + 'T12:00:00'); return `<details class="dia" ${d.data === hoje ? 'open' : ''}><summary><div class="data-dia"><span>${SEMANA[dd.getDay()]}</span><b>${dd.getDate()}</b></div><div class="suave" style="flex:1">${esc(d.refeicoes.almoco?.texto || d.refeicoes.jantar?.texto || '')}</div></summary>
    ${REFEICOES.filter(([s]) => d.refeicoes[s]).map(([s, nome]) => { const r = d.refeicoes[s]; const pr = preparado(d.data, s); return `<div class="ref">
      <div class="titulo"><span>${nome} · ${r.quem.length} ${r.quem.length > 1 ? 'pessoas' : 'pessoa'}</span>
        <span>${d.data === hoje ? (pr ? `<span class="tag ok">preparado</span>` : `<button class="editar" data-acao="preparei" data-dia="${d.data}" data-slot="${s}">preparei</button>`) : ''}
        ${S.admin ? ` <button class="editar" data-acao="editarRef" data-dia="${d.data}" data-slot="${s}">editar</button>` : ''}</span></div>
      <div class="prato">${esc(r.texto)}${r.editado ? ' <span class="tag prim">editado</span>' : ''}</div>
      ${r.itens.length ? `<div class="cozinhar">Separar: ${r.itens.map(i => `${esc(PAPEIS[i.papel]?.nome.split(' (')[0] || i.papel)} ${qt(i.qtd, i.base)}`).join(' · ')}</div>` : ''}
    </div>`; }).join('')}</details>`; }).join('')}
  <h2>Estoque do período</h2>
  <div class="cartao"><table class="tabela"><tr><th>Alimento</th><th class="num">Em casa</th><th class="num">Cardápio</th><th class="num">Falta</th></tr>
  ${Object.entries(c.resumo).map(([k, r]) => { const b = PAPEIS[k]?.base; return `<tr><td>${esc(PAPEIS[k]?.nome || k)}</td><td class="num">${qt(r.estoque, b)}</td><td class="num">${qt(r.usado, b)}</td><td class="num ${r.falta ? 'sobe' : ''}">${r.falta ? qt(r.falta, b) : '—'}</td></tr>`; }).join('')}</table></div>
  <p class="suave">Quantidades cruas. Porções e calorias são estimativas para planejar compra e preparo; não substituem orientação de nutricionista.</p>`;
}

telas.compras = () => topo('Compras') + seg('compras', [['resumo', 'Resumo'], ['lista', 'Lista'], ['notas', 'Notas']]) +
  ({ resumo: telaResumo, lista: telaLista, notas: telaNotas }[S.sub.compras])();

function telaResumo() {
  const ult = ultimaMercado();
  if (!S.notas.length) return `<div class="vazio">Nenhuma nota ainda. Envie o PDF do comprovante em Notas; produtos, preços e estoque saem dela.</div>`;
  const L = lista();
  const orc = +S.geral.orcamento || 0;
  const cobre = orc && L.total ? orc / L.total : null;
  const prods = Object.values(L.prods);
  const idx = indicePrecos(L.prods, S.notas);
  const mes = hojeStr().slice(0, 7);
  const gastoMes = S.notas.filter(n => n.data.slice(0, 7) === mes).reduce((s, n) => s + (n.pago ?? n.totalNota ?? 0), 0);
  const variaram = prods.filter(p => p.compras.length > 1 && Math.abs(p.variacao) > 0.001).sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao)).slice(0, 6);
  return `<div class="cartao">
    <div class="rotulo">Próxima compra prevista</div>
    <div class="destaque">${brl(L.total)}</div>
    ${orc ? `<p>Orçamento ${brl(orc)}: ${cobre >= 1 ? `cobre a lista e sobram <b class="desce">${brl(orc - L.total)}</b>.`
      : `cobre <b>${Math.round(cobre * 100)}%</b>. Faltam <b class="sobe">${brl(L.total - orc)}</b>; ${L.cortados.length} itens não essenciais saem da lista.`}</p>`
      : `<p class="suave">Defina o orçamento para saber quanto da lista cabe.</p>`}
    <div class="acoes"><button class="btn" data-acao="orcamento">${orc ? 'Mudar orçamento' : 'Definir orçamento'}</button></div></div>
  <div class="grade2">
    <div class="cartao"><div class="rotulo">Última compra</div><b>${brl(ult?.pago)}</b><p class="suave">${dataBr(ult?.data)} · ${ult?.itens.length} itens${ult?.desconto ? ' · desconto ' + brl(ult.desconto) : ''}</p></div>
    <div class="cartao"><div class="rotulo">Gasto neste mês</div><b>${brl(gastoMes)}</b><p class="suave">notas + itens lançados à mão</p></div></div>
  ${idx ? `<div class="cartao"><div class="rotulo">Preço da cesta da casa</div><p>A compra de ${dataBr(idx.desde)} custaria hoje <b>${brl(idx.hoje)}</b> (era ${brl(idx.antes)}), <b class="${idx.variacao > 0 ? 'sobe' : 'desce'}">${pct(idx.variacao)}</b>.</p></div>`
    : `<p class="suave">Com a segunda nota o app passa a comparar os preços.</p>`}
  ${variaram.length ? `<h2>Preços que mais mudaram</h2><div class="cartao"><table class="tabela"><tr><th>Produto</th><th class="num">Antes</th><th class="num">Agora</th><th class="num">Var.</th></tr>
    ${variaram.map(p => `<tr><td>${esc(p.nome)}<div class="suave">${esc(p.descricao)}</div></td><td class="num">${brl(p.precoPrimeiro)}</td><td class="num">${brl(p.precoAtual)}</td><td class="num ${p.variacao > 0 ? 'sobe' : 'desce'}">${pct(p.variacao)}</td></tr>`).join('')}</table></div>` : ''}`;
}

function telaLista() {
  if (!S.notas.length) return `<div class="vazio">A lista nasce da primeira nota.</div>`;
  const L = lista();
  const orc = +S.geral.orcamento || 0;
  const base = ultimaMercado()?.id || '';
  let pegos = {}; try { pegos = JSON.parse(localStorage.getItem('pegos:' + base) || '{}'); } catch {}
  const porCat = CATEGORIAS.map(c => [c, L.linhas.filter(l => l.categoria === c && l.qtdFinal > 0)]).filter(([, ls]) => ls.length);
  const zerados = L.linhas.filter(l => !(l.qtdFinal > 0));
  const noCarrinho = L.linhas.filter(l => pegos[l.id] && !l.cortado).reduce((s, l) => s + l.valor, 0);
  return `<div class="cartao"><div class="grade2">
      <div><div class="rotulo">Lista prevista</div><b>${brl(L.total)}</b></div><div><div class="rotulo">Orçamento</div><b>${orc ? brl(orc) : '—'}</b></div>
      <div><div class="rotulo">Cabe no orçamento</div><b>${brl(L.cabe)}</b></div><div><div class="rotulo">No carrinho</div><b>${brl(noCarrinho)}</b></div></div>
    <p class="suave">Quantidade = média das compras + o que o cardápio indicou que falta. Preço = último pago.</p>
    <div class="acoes"><button class="btn mini" data-acao="orcamento">Orçamento</button><button class="btn mini" data-acao="copiarLista">Copiar lista</button><button class="btn mini" data-acao="limparPegos">Desmarcar</button></div></div>
  ${porCat.map(([cat, ls]) => `<h2>${cat} <span class="suave">${brl(ls.filter(l => !l.cortado).reduce((s, l) => s + l.valor, 0))}</span></h2><div class="cartao">
    ${ls.map(l => `<div class="item ${l.cortado ? 'cortado' : ''} ${pegos[l.id] ? 'pego' : ''}">
      <input type="checkbox" data-pego="${esc(l.id)}" ${pegos[l.id] ? 'checked' : ''} aria-label="Peguei">
      <div class="meio"><div class="nome" data-acao="produto" data-id="${esc(l.id)}" style="cursor:pointer">${esc(l.nome)}
        ${l.nivel === 'acabou' ? '<span class="tag alerta">acabou em casa</span>' : l.nivel === 'acabando' ? '<span class="tag ambar">acabando</span>' : ''}
        ${l.prioridade === 'dispensável' ? '<span class="tag">dispensável</span>' : ''}
        ${l.extra ? `<span class="tag alerta">+${n2(l.extra)} p/ cardápio</span>` : ''}${l.manual ? '<span class="tag prim">ajustado</span>' : ''}${l.cortado ? '<span class="tag">fora do orçamento</span>' : ''}</div>
        <div class="suave">${esc(l.descricao)} · ${brl(l.preco)}/${(l.un || '').toLowerCase()}</div>
        <div class="qtd"><button data-qtd="-1" data-id="${esc(l.id)}">−</button><span>${qtdItem(l.qtdFinal, l.un)}</span><button data-qtd="1" data-id="${esc(l.id)}">+</button></div></div>
      <div class="dir">${brl(l.valor)}</div></div>`).join('')}</div>`).join('')}
  ${zerados.length ? `<h2>Zerados nesta lista</h2><div class="cartao">${zerados.map(l => `<div class="item"><div class="meio"><div class="nome">${esc(l.nome)}</div><div class="suave">${esc(l.descricao)}</div>
    <div class="qtd"><button data-qtd="1" data-id="${esc(l.id)}">+</button></div></div></div>`).join('')}</div>` : ''}`;
}

function telaNotas() {
  const notas = [...S.notas].sort((a, b) => b.data.localeCompare(a.data));
  return `<label class="envio"><strong>Enviar comprovante (PDF)</strong>PDF salvo da consulta da NFC-e na SEFA<input type="file" id="arqNota" accept="application/pdf,.pdf"></label>
  <div class="acoes"><button class="btn" data-acao="colar">Colar texto da nota</button><button class="btn" data-acao="avulso">Item fora da nota</button></div>
  <h2>Histórico</h2>
  ${notas.length ? `<div class="cartao">${notas.map(n => `<div class="linha"><div class="icone-redondo ${n.tipo === 'avulso' ? 'ambar' : ''}">${ic('nota')}</div><div class="meio">
      <div class="nome">${esc(n.tipo === 'avulso' ? (n.itens[0]?.descricao || 'Item avulso') : (n.loja || 'Mercado'))}</div>
      <div class="suave">${dataBr(n.data)}${n.tipo === 'avulso' ? (n.onde ? ' · ' + esc(n.onde) : ' · fora da nota') : ` · ${n.itens.length} itens`}</div></div>
      <div class="dir"><b>${brl(n.pago)}</b><br><button class="btn mini" data-acao="verNota" data-id="${esc(n.id)}">Ver</button></div></div>`).join('')}</div>` : '<div class="vazio">Nenhuma nota.</div>'}`;
}

telas.familia = () => `${topo('Família')}
  <div class="cartao">${S.pessoas.map(p => { const e = energia(p); const r = p.refeicoes || {}; const nomes = t => REFEICOES.filter(([s]) => r[t]?.[s]).map(([, n]) => n.split(' ')[0].toLowerCase()).join(', ') || 'nenhuma';
    return `<div class="linha">${avatar(p, 44)}<div class="meio"><div class="nome">${esc(p.nome)}${p.id === S.eu ? ' <span class="tag prim">você</span>' : ''} <span class="suave">${p.idade ? p.idade + ' anos' : ''}</span></div>
      <div class="suave">≈ ${e.kcal.toLocaleString('pt-BR')} kcal/dia${e.metodo.startsWith('referência') ? ' (estimado)' : ''} · água ${metaAgua(p).toLocaleString('pt-BR')} ml</div>
      <div class="suave">Em casa: semana ${nomes('semana')} · fim de semana ${nomes('fds')}</div>
      ${p.alergias ? `<div><span class="tag alerta">restrição</span> ${esc(p.alergias)}</div>` : ''}</div>
      <button class="btn mini" data-acao="pessoa" data-id="${esc(p.id)}">Editar</button></div>`; }).join('')}</div>
  <div class="acoes"><button class="btn" data-acao="pessoa">Adicionar pessoa</button><button class="btn" data-acao="quemSou">${S.eu ? 'Trocar quem usa este aparelho' : 'Quem usa este aparelho?'}</button></div>
  <p class="suave">"Estimado" = sem peso cadastrado. Peso, altura e atividade melhoram a porção do cardápio e a meta de água (35 ml por kg).</p>

  <h2>Avisos neste aparelho</h2>
  <div class="cartao"><p>Lembrete de água e tarefa atrasada aparecem enquanto o app estiver aberto (inclusive minimizado no computador).</p>
    <p class="suave">${!('Notification' in window) ? 'Este navegador não mostra notificações; os avisos aparecem só dentro do app.' : Notification.permission === 'granted' ? 'Notificações do sistema ativadas.' : Notification.permission === 'denied' ? 'Notificações bloqueadas nas configurações do navegador; os avisos aparecem só dentro do app.' : 'Ative para o aviso aparecer também como notificação do celular.'}</p>
    ${'Notification' in window && Notification.permission === 'default' ? '<div class="acoes"><button class="btn prim" data-acao="ativarAvisos">Ativar notificações</button></div>' : ''}
    <div class="linha-campos"><label class="campo">Lembrar água a partir de<input type="time" id="agIni" value="${esc(S.geral.aguaInicio || '07:00')}"></label><label class="campo">até<input type="time" id="agFim" value="${esc(S.geral.aguaFim || '22:00')}"></label></div>
    <div class="acoes"><button class="btn mini" data-acao="salvarHorarioAgua">Salvar horário</button></div></div>

  ${S.admin && D.modoAtual() === 'nuvem' ? `<h2>Quem tem acesso</h2>
    <div class="cartao"><p class="suave">Cada pessoa cria o próprio acesso na tela de entrada. Só os e-mails desta lista veem e gravam os dados da casa. Coloque o mesmo e-mail no cadastro da pessoa acima.</p>
    ${(S.membros.emails || []).map(e => `<div class="linha"><div class="meio">${esc(e)}</div><button class="btn mini perigo" data-acao="tirarMembro" data-email="${esc(e)}">Remover</button></div>`).join('') || '<p class="suave">Só você por enquanto.</p>'}
    <div class="acoes"><input id="novoEmail" type="email" placeholder="email@gmail.com" class="entrada" style="flex:1;margin:0"><button class="btn" data-acao="addMembro">Liberar</button></div></div>` : ''}
  ${D.modoAtual() === 'nuvem' ? `<h2>Conta</h2>
    <div class="cartao"><p>Entrou como <b>${esc(S.usuario.email)}</b>.</p>
    <div class="acoes"><button class="btn" data-acao="trocarSenha">Trocar minha senha</button></div></div>` : ''}
  <h2>Dados</h2>
  <p class="suave">${D.modoAtual() === 'local' ? 'Modo local: dados só neste navegador. Configure o Supabase para usar em todos os aparelhos.' : 'Dados no Supabase da casa.'}</p>
  <div class="acoes"><button class="btn" data-acao="backup">Baixar backup</button>
  ${S.admin ? '<label class="btn">Restaurar backup<input type="file" id="arqBackup" accept=".json" hidden></label>' : ''}
  ${D.modoAtual() === 'nuvem' ? '<button class="btn" data-acao="sair">Sair</button>' : ''}</div>`;

// ---------- folhas ----------
function folhaMais() {
  const b = (acao, icone, txt, extra = '') => `<button data-acao="${acao}" ${extra}><span class="icone-redondo ${icone[1] || ''}">${ic(icone[0])}</span>${txt}</button>`;
  return `<h2 class="topo-folha">Registrar</h2><div class="grade-acoes">
    ${b('aguaOutro', ['agua', 'agua'], 'Bebi água')}${b('comi', ['comida'], 'Comi algo')}${b('usei', ['caixa', 'ok'], 'Usei do estoque')}
    ${b('acabouEscolher', ['vazio', 'ambar'], 'Acabou um item')}${b('editarTarefa', ['tarefa'], 'Nova tarefa')}${b('irNotas', ['nota'], 'Enviar nota')}</div>`;
}

function folhaQuemSou() {
  return `<h2 class="topo-folha">Quem está usando este aparelho?</h2>
  <div class="cartao plano">${S.pessoas.map(p => `<div class="linha" data-acao="souEu" data-id="${esc(p.id)}" style="cursor:pointer">${avatar(p, 40)}<div class="meio"><div class="nome">${esc(p.nome)}</div>
    ${p.email ? `<div class="suave">${esc(p.email)}</div>` : ''}</div>${p.id === S.eu ? '<span class="tag prim">atual</span>' : ''}</div>`).join('')}</div>
  ${D.modoAtual() === 'nuvem' ? '<p class="suave">Seu e-mail fica gravado nessa pessoa, para o app reconhecer você nos outros aparelhos.</p>' : ''}`;
}

function folhaComi(slot) {
  slot = slot || slotAgora();
  const opcoes = REFEICOES.concat([['beliscou', 'Entre as refeições']]);
  const sugestao = refeicaoDoCardapio(hojeStr(), slot)?.texto || '';
  return `<h2 class="topo-folha">O que você comeu?</h2>
  <label class="campo">Refeição<select id="cmRef">${opcoes.map(([k, n]) => `<option value="${k}" ${k === slot ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
  <label class="campo">O quê<input id="cmTexto" value="${esc(sugestao)}" placeholder="Ex.: arroz, feijão e frango"></label>
  ${sugestao ? '<p class="suave">Preenchido com o cardápio; mude se comeu outra coisa.</p>' : ''}
  <div class="acoes"><button class="btn prim" data-acao="salvarComi">Registrar</button><button class="btn" data-fechar>Cancelar</button></div>`;
}

function folhaUsei(id) {
  const prods = produtos(); const sal = saldoAtual(prods);
  const disp = Object.values(prods).filter(p => (sal[p.id] || 0) > 0).sort((a, b) => a.nome.localeCompare(b.nome));
  const p = prods[id] || disp[0];
  if (!p) return `<h2 class="topo-folha">Usei do estoque</h2><div class="vazio">Nada no estoque.</div>`;
  const base = p.papel ? PAPEIS[p.papel].base : null;
  return `<h2 class="topo-folha">Usei do estoque</h2>
  <label class="campo">Produto<select id="usProd">${disp.map(x => `<option value="${esc(x.id)}" ${x.id === p.id ? 'selected' : ''}>${esc(x.nome)} — ${esc(x.descricao)} (tem ${qtdItem(sal[x.id], x.un)})</option>`).join('')}</select></label>
  <div class="linha-campos"><label class="campo">Quantidade<input id="usQtd" type="number" step="0.01" min="0" inputmode="decimal"></label>
  <label class="campo">Em<select id="usUn"><option value="un">${esc((p.un || 'un').toLowerCase())} (embalagem)</option>${base && p.conteudo && p.un !== 'KG' ? `<option value="base">${base}</option>` : ''}${p.un === 'KG' ? '<option value="g">g</option>' : ''}</select></label></div>
  <p class="suave">${base && p.conteudo ? `1 ${esc((p.un || '').toLowerCase())} = ${qt(p.conteudo, base)}.` : ''}</p>
  <div class="acoes"><button class="btn prim" data-acao="salvarUsei">Registrar uso</button><button class="btn" data-fechar>Cancelar</button></div>`;
}

function folhaAcabouEscolher() {
  const prods = produtos(); const sal = saldoAtual(prods);
  const disp = Object.values(prods).filter(p => (sal[p.id] || 0) > 0).sort((a, b) => a.nome.localeCompare(b.nome));
  return `<h2 class="topo-folha">O que acabou?</h2>${disp.length ? `<div class="cartao plano">${disp.map(p => `<div class="linha"><div class="meio"><div class="nome">${esc(p.nome)}</div><div class="suave">${esc(p.descricao)} · tem ${qtdItem(sal[p.id], p.un)}</div></div>
    <button class="btn mini perigo" data-acao="acabou" data-id="${esc(p.id)}">Acabou 1</button></div>`).join('')}</div>` : '<div class="vazio">Nada no estoque.</div>'}`;
}

function folhaContar(id) {
  const p = produtos()[id]; const s = saldoAtual()[id] || 0;
  return `<h2 class="topo-folha">${esc(p.nome)}</h2><p class="suave">${esc(p.descricao)}</p>
  <label class="campo">Quanto tem em casa agora (${esc((p.un || '').toLowerCase())})<input id="ctQtd" type="number" step="0.01" min="0" value="${Math.max(0, s)}"></label>
  <p class="suave">Use para corrigir o estoque depois de conferir o armário.</p>
  <div class="acoes"><button class="btn prim" data-acao="salvarContagem" data-id="${esc(id)}">Salvar contagem</button><button class="btn" data-acao="produto" data-id="${esc(id)}">Editar produto</button><button class="btn" data-fechar>Fechar</button></div>
  <h2>Movimentos</h2><div class="cartao plano tempo">${S.movimentos.filter(m => m.produtoId === id).sort((a, b) => b.em.localeCompare(a.em)).slice(0, 15).map(m => `<div class="ev">${avatar(pessoa(m.por), 26)}<div class="t">${m.delta > 0 ? '+' : ''}${qtdItem(m.delta, p.un)} · ${esc(m.motivo)}</div><div class="h">${dataBr(m.dia).slice(0, 5)} ${hora(m.em)}</div></div>`).join('') || '<p class="suave">Nenhum uso registrado.</p>'}</div>`;
}

function folhaTarefa(id) {
  const t = S.tarefas.find(x => x.id === id) || { nome: '', local: '', freq: 'semanal', dias: [6], intervalo: 2, prazo: '18:00', modo: 'rodizio', pessoas: [], inicio: hojeStr() };
  return `<h2 class="topo-folha">${id ? 'Editar tarefa' : 'Nova tarefa'}</h2>
  <label class="campo">Tarefa<input id="tfNome" value="${esc(t.nome)}" placeholder="Ex.: Lavar o banheiro 1"></label>
  <label class="campo">Onde / detalhe<input id="tfLocal" value="${esc(t.local)}" placeholder="Opcional"></label>
  <div class="linha-campos"><label class="campo">Repetição<select id="tfFreq">${FREQ.map(([k, n]) => `<option value="${k}" ${t.freq === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
  <label class="campo">Prazo do dia<input id="tfPrazo" type="time" value="${esc(t.prazo || '18:00')}"></label></div>
  <div class="rotulo-form">Dias da semana (para "Dias da semana")</div>
  <div class="checks">${SEMANA.map((d, i) => `<label><input type="checkbox" data-wd="${i}" ${(t.dias || []).includes(i) ? 'checked' : ''}> ${d}</label>`).join('')}</div>
  <div class="linha-campos"><label class="campo">A cada quantos dias<input id="tfInt" type="number" min="1" value="${esc(t.intervalo || 2)}"></label>
  <label class="campo">Começa em<input id="tfIni" type="date" value="${esc(t.inicio || hojeStr())}"></label></div>
  <div class="rotulo-form">Pessoas (na ordem do rodízio)</div>
  <div class="checks">${S.pessoas.map(p => `<label><input type="checkbox" data-tp="${esc(p.id)}" ${(t.pessoas || []).includes(p.id) ? 'checked' : ''}> ${esc(p.nome)}</label>`).join('')}</div>
  <label class="campo">Quem faz<select id="tfModo">${MODOS.map(([k, n]) => `<option value="${k}" ${t.modo === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
  <div class="checks"><label><input type="checkbox" id="tfPausa" ${t.pausada ? 'checked' : ''}> Pausar esta tarefa</label></div>
  <div class="acoes"><button class="btn prim" data-acao="salvarTarefa" data-t="${esc(id || '')}">Salvar</button>${id ? `<button class="btn perigo" data-acao="apagarTarefa" data-t="${esc(id)}">Apagar</button>` : ''}<button class="btn" data-fechar>Cancelar</button></div>`;
}

function folhaNota(n, nova) {
  const prods = montarProdutos([n]);
  return `<h2 class="topo-folha">${esc(n.loja || 'Nota')}</h2>
  <p class="suave">${dataBr(n.data)} · nº ${esc(n.numero)} · ${esc(n.pagamento)}</p>
  ${nova ? (n.conferido ? `<p><span class="tag ok">conferida</span> Soma dos itens bate com o total da nota.</p>`
    : `<p><span class="tag alerta">conferir</span> Não achei o total no rodapé; usei a soma dos itens.</p>`) : ''}
  <div class="grade2"><div class="cartao plano"><div class="rotulo">Total</div><b>${brl(n.totalNota)}</b></div><div class="cartao plano"><div class="rotulo">Pago</div><b>${brl(n.pago)}</b>${n.desconto ? `<div class="suave">desconto ${brl(n.desconto)}</div>` : ''}</div></div>
  ${nova && !n.conferido ? `<label class="campo">Valor pago<input id="pagoManual" type="number" step="0.01" value="${n.pago}"></label>` : ''}
  <table class="tabela"><tr><th>Item</th><th class="num">Qtd</th><th class="num">Total</th></tr>
  ${n.itens.map(it => `<tr><td>${esc(it.descricao)}${nova ? `<div class="suave">${esc(Object.values(prods).find(p => p.descricao === it.descricao)?.nome || '')}</div>` : ''}</td><td class="num">${qtdItem(it.qtd, it.un)}</td><td class="num">${brl(it.total)}</td></tr>`).join('')}
  </table>
  <div class="acoes">${nova ? `<button class="btn prim" data-acao="salvarNota">Salvar nota (${n.itens.length} itens)</button>` : `<button class="btn perigo" data-acao="apagarNota" data-id="${esc(n.id)}">Apagar nota</button>`}<button class="btn" data-fechar>Fechar</button></div>`;
}

function folhaAvulso() {
  return `<h2 class="topo-folha">Item fora da nota</h2>
  <label class="campo">O que foi comprado<input id="avDesc" placeholder="Ex.: Carne moída, acém, banana"></label>
  <label class="campo">Tipo no cardápio<select id="avPapel"><option value="">Não é para o cardápio</option>
    ${Object.entries(PAPEIS).map(([k, p]) => `<option value="${k}" ${k === 'carne' ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
  <div class="linha-campos"><label class="campo">Quantidade<input id="avQtd" type="number" step="0.001" min="0" inputmode="decimal"></label>
  <label class="campo">Unidade<select id="avUn"><option value="kg">kg</option><option value="g">g</option><option value="un">unidade</option><option value="L">litro</option></select></label></div>
  <div class="linha-campos"><label class="campo">Valor pago (total)<input id="avValor" type="number" step="0.01" min="0" inputmode="decimal"></label>
  <label class="campo">Data<input id="avData" type="date" value="${hojeStr()}"></label></div>
  <label class="campo">Onde / quem comprou<input id="avOnde" placeholder="Ex.: açougue"></label>
  <div class="acoes"><button class="btn prim" data-acao="salvarAvulso">Salvar</button><button class="btn" data-fechar>Cancelar</button></div>`;
}

function folhaProduto(id) {
  const p = produtos()[id];
  if (!p) return '';
  const base = p.papel ? PAPEIS[p.papel].base : 'g';
  return `<h2 class="topo-folha">${esc(p.nome)}</h2><p class="suave">${esc(p.descricao)}</p>
  <label class="campo">Nome na lista<input id="prNome" value="${esc(p.nome)}"></label>
  <div class="linha-campos"><label class="campo">Categoria<select id="prCat">${CATEGORIAS.map(c => `<option ${c === p.categoria ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
  <label class="campo">Prioridade<select id="prPri">${PRIORIDADES.map(c => `<option ${c === p.prioridade ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
  <label class="campo">Tipo no cardápio<select id="prPapel"><option value="">Não entra no cardápio</option>
    ${Object.entries(PAPEIS).map(([k, x]) => `<option value="${k}" ${k === p.papel ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>
  <label class="campo">Conteúdo de 1 ${esc((p.un || '').toLowerCase())} (em ${base})${p.conteudoEstimado ? ' <span class="tag alerta">estimado</span>' : ''}<input id="prCont" type="number" value="${p.conteudo}"></label>
  <div class="checks"><label><input type="checkbox" id="prFora" ${p.foraDaLista ? 'checked' : ''}> Não sugerir na lista</label></div>
  <h2>Preços pagos</h2>
  <table class="tabela"><tr><th>Data</th><th class="num">Qtd</th><th class="num">Unitário</th></tr>
  ${[...p.compras].reverse().map(c => `<tr><td>${dataBr(c.data)}</td><td class="num">${qtdItem(c.qtd, p.un)}</td><td class="num">${brl(c.unit)}</td></tr>`).join('')}</table>
  <div class="acoes"><button class="btn prim" data-acao="salvarProduto" data-id="${esc(id)}">Salvar</button><button class="btn" data-fechar>Cancelar</button></div>`;
}

function folhaPessoa(id) {
  const p = S.pessoas.find(x => x.id === id) || { nome: '', idade: '', sexo: 'F', peso: '', altura: '', atividade: 1.375, refeicoes: { semana: {}, fds: {} }, naoCome: [], alergias: '', obs: '', email: '', lembreteAgua: 90 };
  const r = p.refeicoes || { semana: {}, fds: {} };
  const papeisComida = Object.entries(PAPEIS).filter(([k]) => !['oleo', 'extrato', 'acucar'].includes(k));
  return `<h2 class="topo-folha">${id ? esc(p.nome) : 'Nova pessoa'}</h2>
  <label class="campo">Nome<input id="psNome" value="${esc(p.nome)}"></label>
  <label class="campo">E-mail Google (para entrar no app)<input id="psEmail" type="email" value="${esc(p.email)}"></label>
  <div class="rotulo-form">Cor</div><div class="checks">${PALETA.map(c => `<label><input type="radio" name="psCor" value="${c}" ${corDe(p) === c ? 'checked' : ''}><span class="av" style="--c:${c};--s:22px"></span></label>`).join('')}</div>
  <div class="linha-campos"><label class="campo">Idade<input id="psIdade" type="number" min="1" max="110" value="${esc(p.idade)}"></label>
  <label class="campo">Sexo<select id="psSexo"><option value="F" ${p.sexo === 'F' ? 'selected' : ''}>Feminino</option><option value="M" ${p.sexo === 'M' ? 'selected' : ''}>Masculino</option></select></label></div>
  <div class="linha-campos"><label class="campo">Peso (kg)<input id="psPeso" type="number" step="0.1" value="${esc(p.peso)}"></label>
  <label class="campo">Altura (cm)<input id="psAltura" type="number" value="${esc(p.altura)}"></label></div>
  <label class="campo">Atividade física / trabalho<select id="psAtiv">${ATIVIDADE.map(([v, n]) => `<option value="${v}" ${+p.atividade === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
  <div class="linha-campos"><label class="campo">Meta de água (ml/dia)<input id="psMeta" type="number" step="50" placeholder="${metaAgua({ ...p, metaAgua: 0 })}" value="${esc(p.metaAgua || '')}"></label>
  <label class="campo">Lembrar água a cada (min)<input id="psLembrete" type="number" min="15" step="15" value="${esc(p.lembreteAgua || 90)}"></label></div>
  <div class="rotulo-form">Refeições em casa — segunda a sexta</div>
  <div class="checks">${REFEICOES.map(([s, n]) => `<label><input type="checkbox" data-ref="semana:${s}" ${r.semana?.[s] ? 'checked' : ''}> ${n}</label>`).join('')}</div>
  <div class="rotulo-form">Refeições em casa — sábado e domingo</div>
  <div class="checks">${REFEICOES.map(([s, n]) => `<label><input type="checkbox" data-ref="fds:${s}" ${r.fds?.[s] ? 'checked' : ''}> ${n}</label>`).join('')}</div>
  <div class="rotulo-form">Não come</div>
  <div class="checks">${papeisComida.map(([k, x]) => `<label><input type="checkbox" data-nao="${k}" ${(p.naoCome || []).includes(k) ? 'checked' : ''}> ${esc(x.nome.split(' (')[0])}</label>`).join('')}</div>
  <label class="campo">Alergias ou restrições<input id="psAlerg" value="${esc(p.alergias)}" placeholder="Ex.: lactose, camarão"></label>
  <label class="campo">Observações<textarea id="psObs" rows="2">${esc(p.obs)}</textarea></label>
  <div class="acoes"><button class="btn prim" data-acao="salvarPessoa" data-id="${esc(id || '')}">Salvar</button>${id ? `<button class="btn perigo" data-acao="apagarPessoa" data-id="${esc(id)}">Remover</button>` : ''}<button class="btn" data-fechar>Cancelar</button></div>`;
}

function folhaPorcoes() {
  return `<h2 class="topo-folha">Porções de referência</h2>
  <p class="suave">Quantidade crua por refeição para um adulto de referência (fator 1,0). Itens "da casa" valem para a refeição inteira.</p>
  <table class="tabela"><tr><th>Alimento</th><th class="num">Porção</th></tr>
  ${Object.entries(PAPEIS).map(([k, p]) => `<tr><td>${esc(p.nome)}${p.porCasa ? ' <span class="tag">da casa</span>' : ''}</td>
    <td class="num"><input data-porcao="${k}" type="number" value="${S.porcoes[k] ?? p.porcao}" class="entrada" style="width:84px;display:inline-block;margin:0;padding:6px 8px;text-align:right"> ${p.base}</td></tr>`).join('')}</table>
  <div class="acoes"><button class="btn prim" data-acao="salvarPorcoes">Salvar</button><button class="btn" data-acao="porcoesPadrao">Voltar ao padrão</button><button class="btn" data-fechar>Fechar</button></div>`;
}

// ---------- ações ----------
let notaPendente = null;
const exigeEu = () => { if (!S.eu) { abrirFolha(folhaQuemSou()); return false; } return true; };

async function prepararNota(texto) {
  const n = parseNota(texto);
  if (!n.itens.length) return aviso('Não encontrei itens. Envie o PDF da consulta da NFC-e (página com a lista de produtos).');
  n.id = n.chave || ('nota-' + Date.now());
  n.tipo = 'mercado';
  if (S.notas.some(x => x.id === n.id)) return aviso('Essa nota já foi enviada (mesma chave de acesso).');
  notaPendente = n;
  abrirFolha(folhaNota(n, true));
}

async function baixarRefeicao(dia, slot) {
  const r = refeicaoDoCardapio(dia, slot); if (!r) return;
  const prods = produtos(); let sal = saldoAtual(prods);
  const todos = []; const faltou = [];
  for (const it of r.itens) {
    const { movs, faltou: f } = baixarPapel(prods, sal, it.papel, it.qtd);
    movs.forEach(m => { sal[m.produtoId] += m.delta; todos.push(m); });
    if (f > 0) faltou.push(PAPEIS[it.papel]?.nome.split(' (')[0]);
  }
  await movimentar(todos, `preparo (${NOME_REF[slot].toLowerCase()})`);
  await registrar({ tipo: 'preparo', slot, dia, texto: r.texto });
  return faltou;
}

const acoes = {
  mais() { abrirFolha(folhaMais()); },
  familia() { S.aba = 'familia'; render(); window.scrollTo(0, 0); },
  quemSou() { abrirFolha(folhaQuemSou()); },
  async souEu(el) {
    const id = el.dataset.id;
    if (D.modoAtual() === 'nuvem') {
      for (const p of S.pessoas.filter(x => (x.email || '').toLowerCase() === S.usuario.email && x.id !== id)) { p.email = ''; await D.salvar('pessoas', p.id, p); }
      const p = pessoa(id); p.email = S.usuario.email;
      if (!await tentar(() => D.salvar('pessoas', id, p))) return;
    } else { try { localStorage.setItem('eu', id); } catch {} }
    S.eu = id; fecharFolha(); render();
  },
  irNotas() { fecharFolha(); S.aba = 'compras'; S.sub.compras = 'notas'; render(); },
  async agua(ml) {
    if (!exigeEu()) return;
    await tentar(() => registrar({ tipo: 'agua', ml }), `+${ml} ml registrados.`);
    fecharFolha(); render();
  },
  aguaOutro() {
    if (!exigeEu()) return;
    abrirFolha(`<h2 class="topo-folha">Bebi água</h2><div class="acoes">${[150, 200, 300, 500, 1000].map(v => `<button class="btn agua-btn" data-agua="${v}">${v} ml</button>`).join('')}</div>
      <label class="campo">Outra quantidade (ml)<input id="aguaMl" type="number" min="10" step="10" inputmode="numeric"></label>
      <div class="acoes"><button class="btn prim" data-acao="aguaManual">Registrar</button><button class="btn" data-fechar>Cancelar</button></div>`);
  },
  async aguaManual() { const v = +$('#aguaMl').value; if (v > 0) await acoes.agua(v); },
  comi(el) { if (!exigeEu()) return; abrirFolha(folhaComi(el?.dataset?.slot)); },
  async salvarComi() {
    const texto = $('#cmTexto').value.trim(); if (!texto) return aviso('Escreva o que comeu.');
    await tentar(async () => { await registrar({ tipo: 'comida', refeicao: $('#cmRef').value, texto }); fecharFolha(); }, 'Refeição registrada.');
    render();
  },
  async preparei(el) {
    if (!exigeEu()) return;
    const { dia, slot } = el.dataset;
    if (preparado(dia, slot)) return aviso('Esta refeição já foi marcada como preparada.');
    let faltou = [];
    const ok = await tentar(async () => { faltou = await baixarRefeicao(dia, slot); });
    if (ok) aviso('Baixa feita no estoque.' + (faltou.length ? ' Não havia o suficiente de: ' + faltou.join(', ') + '.' : ''));
    render();
  },
  usei(el) { if (!exigeEu()) return; abrirFolha(folhaUsei(el?.dataset?.id)); },
  async salvarUsei() {
    const id = $('#usProd').value, q = parseFloat($('#usQtd').value), modo = $('#usUn').value;
    if (!(q > 0)) return aviso('Informe a quantidade.');
    const p = produtos()[id];
    let delta = modo === 'un' ? q : modo === 'g' ? q / 1000 : q / p.conteudo;
    const s = saldoAtual()[id] || 0; delta = Math.min(delta, Math.max(0, s));
    const texto = `usou ${modo === 'un' ? qtdItem(q, p.un) : modo === 'g' ? q + ' g' : qt(q, PAPEIS[p.papel].base)} de ${p.nome}`;
    await tentar(async () => { await movimentar([{ produtoId: id, delta: -Math.round(delta * 1000) / 1000 }], 'uso'); await registrar({ tipo: 'estoque', produtoId: id, texto }); fecharFolha(); }, 'Uso registrado.');
    render();
  },
  acabouEscolher() { if (!exigeEu()) return; abrirFolha(folhaAcabouEscolher()); },
  async acabou(el) {
    if (!exigeEu()) return;
    const id = el.dataset.id; const p = produtos()[id]; const s = saldoAtual()[id] || 0;
    const d = deltaAcabou(s); if (!d) return;
    const resta = Math.round((s + d) * 1000) / 1000;
    const texto = resta <= 0 ? `avisou que acabou ${p.nome}` : `avisou que acabou 1 ${(p.un || 'un').toLowerCase()} de ${p.nome} (restam ${qtdItem(resta, p.un)})`;
    await tentar(async () => { await movimentar([{ produtoId: id, delta: d }], 'acabou'); await registrar({ tipo: 'estoque', produtoId: id, texto }); },
      resta <= 0 ? `${p.nome} acabou — marcado na lista de compras.` : `Restam ${qtdItem(resta, p.un)} de ${p.nome}.`);
    fecharFolha(); render();
  },
  contar(el) { abrirFolha(folhaContar(el.dataset.id)); },
  async salvarContagem(el) {
    if (!exigeEu()) return;
    const id = el.dataset.id; const novo = parseFloat($('#ctQtd').value); if (!(novo >= 0)) return aviso('Quantidade inválida.');
    const s = saldoAtual()[id] || 0; const d = Math.round((novo - s) * 1000) / 1000; if (!d) return fecharFolha();
    const p = produtos()[id];
    await tentar(async () => { await movimentar([{ produtoId: id, delta: d }], 'contagem'); await registrar({ tipo: 'estoque', produtoId: id, texto: `contou ${qtdItem(novo, p.un)} de ${p.nome}` }); fecharFolha(); }, 'Estoque corrigido.');
    render();
  },
  async fazerTarefa(el) {
    if (!exigeEu()) return;
    const { t, dia } = el.dataset; const tarefa = S.tarefas.find(x => x.id === t);
    const para = responsaveis(tarefa, dia)[0] || S.eu;
    await tentar(() => registrar({ tipo: 'tarefa', tarefaId: t, dia, para }), 'Tarefa concluída.');
    render();
  },
  async desfazerTarefa(el) {
    const { t, dia } = el.dataset; const e = S.eventos.find(x => x.tipo === 'tarefa' && x.tarefaId === t && x.dia === dia); if (!e) return;
    if (!confirm('Desmarcar esta tarefa?')) return;
    await tentar(async () => { await D.apagar('eventos', e.id); S.eventos = S.eventos.filter(x => x.id !== e.id); });
    render();
  },
  editarTarefa(el) { abrirFolha(folhaTarefa(el?.dataset?.t)); },
  async salvarTarefa(el) {
    const id = el.dataset.t || novoId('t');
    const pessoasSel = [...document.querySelectorAll('[data-tp]:checked')].map(c => c.dataset.tp);
    const t = { nome: $('#tfNome').value.trim(), local: $('#tfLocal').value.trim(), freq: $('#tfFreq').value, prazo: $('#tfPrazo').value || '23:59',
      dias: [...document.querySelectorAll('[data-wd]:checked')].map(c => +c.dataset.wd), intervalo: +$('#tfInt').value || 1, inicio: $('#tfIni').value || hojeStr(),
      pessoas: pessoasSel, modo: $('#tfModo').value, pausada: $('#tfPausa').checked };
    if (!t.nome) return aviso('Dê um nome para a tarefa.');
    if (!t.pessoas.length) return aviso('Escolha pelo menos uma pessoa.');
    if (t.freq === 'semanal' && !t.dias.length) return aviso('Escolha os dias da semana.');
    await tentar(async () => { await D.salvar('tarefas', id, t); S.tarefas = S.tarefas.filter(x => x.id !== id).concat({ ...t, id }); fecharFolha(); }, 'Tarefa salva.');
    render();
  },
  async apagarTarefa(el) {
    if (!confirm('Apagar esta tarefa?')) return;
    await tentar(async () => { await D.apagar('tarefas', el.dataset.t); S.tarefas = S.tarefas.filter(x => x.id !== el.dataset.t); fecharFolha(); }, 'Tarefa apagada.');
    render();
  },
  async orcamento() {
    const v = prompt('Orçamento para a próxima compra de mercado (R$):', S.geral.orcamento || '');
    if (v == null) return;
    const num = parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
    if (!(num >= 0)) return aviso('Valor inválido.');
    S.geral.orcamento = num;
    await tentar(() => D.salvar('config', 'geral', S.geral), 'Orçamento salvo.');
    render();
  },
  colar() {
    abrirFolha(`<h2 class="topo-folha">Colar texto da nota</h2><p class="suave">Na página da consulta da NFC-e, selecione tudo, copie e cole aqui.</p>
      <textarea id="textoNota" rows="10" class="entrada"></textarea>
      <div class="acoes"><button class="btn prim" data-acao="lerTexto">Ler</button><button class="btn" data-fechar>Cancelar</button></div>`);
  },
  async lerTexto() { await prepararNota($('#textoNota').value); },
  async salvarNota() {
    const n = notaPendente; if (!n) return;
    const pm = $('#pagoManual'); if (pm) n.pago = +pm.value || n.pago;
    n.enviadaPor = S.usuario?.email || ''; n.enviadaEm = new Date().toISOString();
    const ok = await tentar(async () => { await D.salvar('notas', n.id, n); S.notas.push(n); notaPendente = null; fecharFolha(); }, 'Nota salva. Preços, estoque e lista recalculados.');
    if (ok) {
      if (!S.geral.estoqueDesde) { S.geral.estoqueDesde = n.data.slice(0, 10); await D.salvar('config', 'geral', S.geral).catch(() => {}); }
      if (S.eu) await registrar({ tipo: 'nota', texto: `enviou a nota do ${n.loja || 'mercado'} (${brl(n.pago)})` }).catch(() => {});
    }
    render();
  },
  verNota(el) { const n = S.notas.find(x => x.id === el.dataset.id); if (n) abrirFolha(folhaNota(n, false)); },
  async apagarNota(el) {
    if (!confirm('Apagar esta nota? Preços, estoque e lista serão recalculados sem ela.')) return;
    await tentar(async () => { await D.apagar('notas', el.dataset.id); S.notas = S.notas.filter(n => n.id !== el.dataset.id); fecharFolha(); }, 'Nota apagada.');
    render();
  },
  avulso() { abrirFolha(folhaAvulso()); },
  async salvarAvulso() {
    const desc = $('#avDesc').value.trim(), qtdIn = parseFloat($('#avQtd').value), valor = parseFloat($('#avValor').value) || 0;
    const unSel = $('#avUn').value, papel = $('#avPapel').value || null, data = $('#avData').value;
    if (!desc || !(qtdIn > 0)) return aviso('Preencha o item e a quantidade.');
    let qtd = qtdIn, un = 'UN', conteudo = 1;
    if (unSel === 'kg') { un = 'KG'; conteudo = 1000; }
    if (unSel === 'g') { un = 'KG'; qtd = qtdIn / 1000; conteudo = 1000; }
    if (unSel === 'L') { un = 'L'; conteudo = 1000; }
    if (unSel === 'un' && papel && PAPEIS[papel].base !== 'un') conteudo = 0;
    const n = { id: 'avulso-' + Date.now(), tipo: 'avulso', data: data + 'T12:00', loja: 'Fora da nota', onde: $('#avOnde').value.trim(),
      itens: [{ descricao: desc, codigo: '', qtd: +qtd.toFixed(3), un, unit: +(valor / qtd).toFixed(2), total: valor, papel, conteudo: conteudo || null }],
      totalNota: valor, pago: valor, desconto: 0, enviadaPor: S.usuario?.email || '' };
    await tentar(async () => { await D.salvar('notas', n.id, n); S.notas.push(n); fecharFolha(); }, 'Item lançado no estoque.');
    if (S.eu) await registrar({ tipo: 'nota', texto: `lançou ${qtdItem(qtd, un)} de ${desc}${n.onde ? ' (' + n.onde + ')' : ''}` }).catch(() => {});
    render();
  },
  produto(el) { abrirFolha(folhaProduto(el.dataset.id)); },
  async salvarProduto(el) {
    const id = el.dataset.id;
    const aj = { ...(S.ajustes[id] || {}), nome: $('#prNome').value.trim(), categoria: $('#prCat').value, prioridade: $('#prPri').value,
      papel: $('#prPapel').value || null, conteudo: +$('#prCont').value || null, conteudoEstimado: false, foraDaLista: $('#prFora').checked };
    await tentar(async () => { await D.salvar('ajustes', id, aj); S.ajustes[id] = aj; fecharFolha(); }, 'Produto atualizado.');
    render();
  },
  async qtd(el) {
    const id = el.dataset.id, passo = +el.dataset.qtd;
    const l = lista().linhas.find(x => x.id === id); if (!l) return;
    const inc = l.un === 'KG' ? 0.5 : 1;
    const nova = Math.max(0, +(l.qtdFinal + passo * inc).toFixed(3));
    const aj = { ...(S.ajustes[id] || {}), qtdLista: nova, qtdListaBase: ultimaMercado()?.id };
    S.ajustes[id] = aj; render();
    await tentar(() => D.salvar('ajustes', id, aj));
  },
  copiarLista() {
    const L = lista();
    const txt = CATEGORIAS.map(c => { const ls = L.linhas.filter(l => l.categoria === c && l.qtdFinal > 0 && !l.cortado); return ls.length ? `*${c}*\n` + ls.map(l => `- ${l.nome}: ${qtdItem(l.qtdFinal, l.un)}`).join('\n') : ''; })
      .filter(Boolean).join('\n\n') + `\n\nEstimado: ${brl(L.cabe)}`;
    navigator.clipboard?.writeText(txt).then(() => aviso('Lista copiada.'), () => abrirFolha(`<textarea rows="16" class="entrada">${esc(txt)}</textarea><div class="acoes"><button class="btn" data-fechar>Fechar</button></div>`));
  },
  limparPegos() { localStorage.removeItem('pegos:' + (ultimaMercado()?.id || '')); render(); },
  async gerar() {
    const dias = Math.min(45, Math.max(3, +$('#diasCiclo').value || 30));
    if (!S.pessoas.length) return aviso('Cadastre as pessoas da casa primeiro.');
    const prods = produtos();
    const estoque = estoquePorPapel(prods, saldoAtual(prods));
    const c = gerarCardapio({ estoque, inicio: hojeStr(), dias, pessoas: S.pessoas, porcoes: S.porcoes });
    await tentar(async () => { await D.salvar('cardapio', 'atual', c); S.cardapio = c; }, 'Cardápio gerado.');
    render();
  },
  async editarRef(el) {
    const c = S.cardapio; const d = c.dias_.find(x => x.data === el.dataset.dia); const r = d?.refeicoes[el.dataset.slot]; if (!r) return;
    const t = prompt('Prato desta refeição:', r.texto);
    if (t == null || !t.trim()) return;
    r.texto = t.trim(); r.editado = true; c.editadas = true;
    await tentar(() => D.salvar('cardapio', 'atual', c), 'Refeição atualizada.');
    render();
  },
  porcoes() { abrirFolha(folhaPorcoes()); },
  async salvarPorcoes() {
    const v = {}; document.querySelectorAll('[data-porcao]').forEach(i => { const k = i.dataset.porcao; const n = +i.value; if (n > 0 && n !== PAPEIS[k].porcao) v[k] = n; });
    await tentar(async () => { await D.salvar('cardapio', 'porcoes', { valores: v }); S.porcoes = v; fecharFolha(); }, 'Porções salvas. Gere o cardápio de novo para aplicar.');
  },
  async porcoesPadrao() { await tentar(async () => { await D.salvar('cardapio', 'porcoes', { valores: {} }); S.porcoes = {}; abrirFolha(folhaPorcoes()); }, 'Porções padrão.'); },
  imprimir() { document.querySelectorAll('details.dia').forEach(d => d.open = true); window.print(); },
  pessoa(el) { abrirFolha(folhaPessoa(el?.dataset?.id)); },
  async salvarPessoa(el) {
    const id = el.dataset.id || ('p' + Date.now());
    const refeicoes = { semana: {}, fds: {} };
    document.querySelectorAll('[data-ref]').forEach(c => { const [t, s] = c.dataset.ref.split(':'); if (c.checked) refeicoes[t][s] = true; });
    const antigo = pessoa(id);
    const p = { nome: $('#psNome').value.trim() || 'Sem nome', email: $('#psEmail').value.trim().toLowerCase(), cor: document.querySelector('[name=psCor]:checked')?.value || PALETA[0],
      idade: +$('#psIdade').value || '', sexo: $('#psSexo').value, peso: +$('#psPeso').value || '', altura: +$('#psAltura').value || '', atividade: +$('#psAtiv').value,
      metaAgua: +$('#psMeta').value || '', lembreteAgua: +$('#psLembrete').value || 90,
      refeicoes, naoCome: [...document.querySelectorAll('[data-nao]:checked')].map(c => c.dataset.nao), alergias: $('#psAlerg').value.trim(), obs: $('#psObs').value.trim(),
      ordem: antigo?.ordem ?? S.pessoas.length };
    await tentar(async () => { await D.salvar('pessoas', id, p); S.pessoas = S.pessoas.filter(x => x.id !== id).concat({ ...p, id }).sort((a, b) => a.ordem - b.ordem); fecharFolha(); },
      'Pessoa salva.' + (S.cardapio ? ' Gere o cardápio de novo para aplicar nas porções.' : ''));
    if (D.modoAtual() === 'nuvem') definirEu();
    render();
  },
  async apagarPessoa(el) {
    if (!confirm('Remover esta pessoa?')) return;
    await tentar(async () => { await D.apagar('pessoas', el.dataset.id); S.pessoas = S.pessoas.filter(x => x.id !== el.dataset.id); fecharFolha(); }, 'Removida.');
    render();
  },
  async ativarAvisos() { await Notification.requestPermission(); render(); },
  async salvarHorarioAgua() {
    S.geral.aguaInicio = $('#agIni').value || '07:00'; S.geral.aguaFim = $('#agFim').value || '22:00';
    await tentar(() => D.salvar('config', 'geral', S.geral), 'Horário salvo.');
  },
  async addMembro() {
    const e = $('#novoEmail').value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return aviso('E-mail inválido.');
    const emails = [...new Set([...(S.membros.emails || []), e])];
    await tentar(async () => { await D.salvar('config', 'membros', { emails }); S.membros.emails = emails; }, 'Acesso liberado.');
    render();
  },
  async tirarMembro(el) {
    if (!confirm('Remover o acesso de ' + el.dataset.email + '?')) return;
    const emails = (S.membros.emails || []).filter(x => x !== el.dataset.email);
    await tentar(async () => { await D.salvar('config', 'membros', { emails }); S.membros.emails = emails; }, 'Acesso removido.');
    render();
  },
  trocarSenha() {
    abrirFolha(`<h2 class="topo-folha">Trocar senha</h2>
      <label class="campo">Nova senha (mínimo 6 caracteres)<input id="novaSenha" type="password" autocomplete="new-password"></label>
      <label class="campo">Repita a nova senha<input id="novaSenha2" type="password" autocomplete="new-password"></label>
      <div class="acoes"><button class="btn prim" data-acao="salvarSenha">Salvar</button><button class="btn" data-fechar>Cancelar</button></div>`);
  },
  async salvarSenha() {
    const a = $('#novaSenha').value, b = $('#novaSenha2').value;
    if (a.length < 6) return aviso('A senha precisa ter pelo menos 6 caracteres.');
    if (a !== b) return aviso('As senhas não são iguais.');
    if (await tentar(() => D.trocarSenha(a), 'Senha trocada.')) fecharFolha();
  },
  backup() {
    const dados = { versao: 2, exportadoEm: new Date().toISOString(), notas: S.notas, ajustes: S.ajustes, pessoas: S.pessoas, geral: S.geral, cardapio: S.cardapio, porcoes: S.porcoes,
      tarefas: S.tarefas, movimentos: S.movimentos, eventos: S.eventos };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 1)], { type: 'application/json' }));
    a.download = 'nossa-casa-backup-' + hojeStr() + '.json'; a.click();
  },
  async sair() { await D.sair(); }
};

async function restaurar(arquivo) {
  const b = JSON.parse(await arquivo.text());
  if (!confirm(`Restaurar ${b.notas?.length || 0} notas, ${b.pessoas?.length || 0} pessoas e ${b.tarefas?.length || 0} tarefas? Registros com o mesmo identificador serão substituídos.`)) return;
  await tentar(async () => {
    for (const n of b.notas || []) await D.salvar('notas', n.id, n);
    for (const [id, a] of Object.entries(b.ajustes || {})) await D.salvar('ajustes', id, a);
    for (const p of b.pessoas || []) await D.salvar('pessoas', p.id, p);
    for (const t of b.tarefas || []) await D.salvar('tarefas', t.id, t);
    for (const m of b.movimentos || []) await D.salvar('movimentos', m.id, m);
    for (const e of b.eventos || []) await D.salvar('eventos', e.id, e);
    if (b.geral) await D.salvar('config', 'geral', b.geral);
    if (b.cardapio) await D.salvar('cardapio', 'atual', b.cardapio);
    if (b.porcoes) await D.salvar('cardapio', 'porcoes', { valores: b.porcoes });
    await carregar();
  }, 'Backup restaurado.');
  render();
}

// ---------- avisos com o app aberto ----------
function lerLS(k, padrao) { try { return JSON.parse(localStorage.getItem(k)) ?? padrao; } catch { return padrao; } }
function gravarLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
async function notificar(titulo, corpo, tag) {
  aviso(`${titulo} — ${corpo}`);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(titulo, { body: corpo, tag, icon: 'icon.svg', badge: 'icon.svg' });
    else new Notification(titulo, { body: corpo, tag });
  } catch (e) { console.warn(e); }
}
function verificarAvisos() {
  const me = eu(); if (!me) return;
  const agora = new Date(); const hoje = hojeStr();
  const hm = agora.toTimeString().slice(0, 5);
  // água
  if (hm >= (S.geral.aguaInicio || '07:00') && hm <= (S.geral.aguaFim || '22:00')) {
    const ml = aguaHoje(S.eventos, me.id, hoje), meta = metaAgua(me);
    if (ml < meta) {
      const ult = ultimoEvento(S.eventos.filter(e => e.dia === hoje), me.id, 'agua');
      const intervalo = (+me.lembreteAgua || 90) * 60000;
      const ultimoAviso = lerLS('avisoAgua:' + me.id, 0);
      const base = Math.max(ult ? new Date(ult.em).getTime() : 0, ultimoAviso);
      if (agora.getTime() - base >= intervalo) {
        gravarLS('avisoAgua:' + me.id, agora.getTime());
        notificar('Hora de beber água', `Você está em ${ml.toLocaleString('pt-BR')} de ${meta.toLocaleString('pt-BR')} ml hoje.`, 'agua');
      }
    }
  }
  // tarefas atrasadas
  const ja = lerLS('avisosTarefa', {});
  for (const a of agendaTarefas(S.tarefas, S.eventos, hoje, agora)) {
    if (!a.atrasada || !a.quem.includes(me.id)) continue;
    const k = a.tarefa.id + '|' + a.dia + '|' + hoje;
    if (ja[k]) continue;
    ja[k] = 1;
    notificar('Tarefa pendente', `${a.tarefa.nome} ainda não foi feita${a.hoje ? ' (prazo ' + a.tarefa.prazo + ')' : ''}.`, 'tarefa-' + a.tarefa.id);
  }
  for (const k of Object.keys(ja)) if (!k.endsWith(hoje)) delete ja[k];
  gravarLS('avisosTarefa', ja);
}

// ---------- eventos da interface ----------
document.addEventListener('click', e => {
  const aba = e.target.closest('[data-aba]');
  if (aba) { S.aba = aba.dataset.aba; fecharFolha(); render(); window.scrollTo(0, 0); return; }
  const sg = e.target.closest('[data-seg]'); if (sg) { const [g, k] = sg.dataset.seg.split(':'); S.sub[g] = k; render(); return; }
  const f = e.target.closest('[data-filtro]'); if (f) { S.filtroEstoque = f.dataset.filtro; render(); return; }
  const ag = e.target.closest('[data-agua]'); if (ag) return acoes.agua(+ag.dataset.agua);
  const q = e.target.closest('[data-qtd]'); if (q) return acoes.qtd(q);
  const a = e.target.closest('[data-acao]');
  if (a && acoes[a.dataset.acao]) acoes[a.dataset.acao](a);
});
document.addEventListener('change', async e => {
  if (e.target.id === 'arqNota' && e.target.files[0]) {
    aviso('Lendo o comprovante…');
    try { await prepararNota(await textoDoPdf(e.target.files[0])); }
    catch (err) { console.error(err); aviso('Não consegui ler esse PDF.'); }
    e.target.value = '';
  }
  if (e.target.id === 'arqBackup' && e.target.files[0]) { await restaurar(e.target.files[0]); e.target.value = ''; }
  if (e.target.id === 'usProd') abrirFolha(folhaUsei(e.target.value));
  if (e.target.dataset.pego) {
    const k = 'pegos:' + (ultimaMercado()?.id || '');
    const p = lerLS(k, {});
    if (e.target.checked) p[e.target.dataset.pego] = 1; else delete p[e.target.dataset.pego];
    gravarLS(k, p); render();
  }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.usuario) atualizarRotina().then(verificarAvisos); });

function render() {
  document.querySelectorAll('#abas button[data-aba]').forEach(b => b.classList.toggle('ativa', b.dataset.aba === S.aba));
  $('#tela').innerHTML = (telas[S.aba] || telas.hoje)();
}

function telaLogin(msg, criar = false) {
  $('#abas').hidden = true;
  $('#tela').innerHTML = `<div class="login"><h1>Nossa Casa</h1><p class="suave">${msg || (criar ? 'Crie seu acesso com seu e-mail e uma senha.' : 'Entre com seu e-mail e senha.')}</p>
    <form id="formLogin" class="cartao" style="text-align:left;max-width:380px;margin:20px auto">
      <label class="campo">E-mail<input id="lgEmail" type="email" autocomplete="username" required></label>
      <label class="campo">Senha${criar ? ' (mínimo 6 caracteres)' : ''}<input id="lgSenha" type="password" autocomplete="${criar ? 'new-password' : 'current-password'}" required minlength="6"></label>
      ${criar ? '<label class="campo">Repita a senha<input id="lgSenha2" type="password" autocomplete="new-password" required minlength="6"></label>' : ''}
      <div class="acoes"><button class="btn prim" type="submit" style="width:100%">${criar ? 'Criar acesso' : 'Entrar'}</button></div>
      <p class="suave" style="text-align:center"><button type="button" class="editar" id="lgTroca">${criar ? 'Já tenho acesso — entrar' : 'Primeira vez? Criar meu acesso'}</button></p></form></div>`;
  $('#lgTroca').onclick = () => telaLogin('', !criar);
  $('#formLogin').onsubmit = async ev => {
    ev.preventDefault();
    const btn = ev.target.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      if (criar) {
        if ($('#lgSenha').value !== $('#lgSenha2').value) throw new Error('As senhas não são iguais.');
        await D.criarConta($('#lgEmail').value, $('#lgSenha').value);
      } else await D.entrar($('#lgEmail').value, $('#lgSenha').value);
    } catch (e) { aviso(e.message); btn.disabled = false; }
  };
}

function telaSemAcesso(email) {
  $('#abas').hidden = true;
  $('#tela').innerHTML = `<div class="login"><h1>Nossa Casa</h1>
    <div class="cartao" style="max-width:380px;margin:20px auto"><p>Seu acesso foi criado com <b>${esc(email)}</b>.</p>
    <p class="suave">Falta a Vitoria liberar este e-mail em Família → Quem tem acesso. Depois toque em "Já liberaram".</p>
    <div class="acoes" style="justify-content:center"><button class="btn prim" id="btnRever">Já liberaram</button><button class="btn" id="btnSair">Sair</button></div></div></div>`;
  $('#btnSair').onclick = () => D.sair();
  $('#btnRever').onclick = async () => { const est = await D.verificarAcesso(); if (est.membro) aoEntrar(est); else aviso('Ainda não liberado.'); };
}

let relogios = false;
async function aoEntrar(est) {
  S.usuario = est.usuario; S.admin = !!est.admin;
  if (!est.usuario) return telaLogin();
  if (!est.membro) {
    telaLogin('Esta conta não tem acesso.'); return;
  }
  $('#tela').innerHTML = '<p class="carregando">Carregando…</p>';
  try { await carregar(); } catch (e) { console.error(e); $('#tela').innerHTML = `<div class="vazio">Erro ao carregar os dados: ${esc(e.message)}</div>`; return; }
  $('#abas').hidden = false;
  render();
  if (!S.eu && S.pessoas.length) abrirFolha(folhaQuemSou());
  if (!relogios) {
    relogios = true;
    setInterval(verificarAvisos, 30000);
    setInterval(() => { if (document.visibilityState === 'visible') atualizarRotina(); }, 90000);
    setTimeout(verificarAvisos, 3000);
  }
}
D.iniciar(aoEntrar).catch(e => { console.error(e); $('#tela').innerHTML = `<div class="vazio">Não foi possível iniciar: ${esc(e.message)}</div>`; });
