// Cardápio do mês: distribui o estoque comprado pelos dias do ciclo para que dure,
// usando as refeições que cada pessoa faz em casa e um fator de porção por pessoa.
import { PAPEIS } from './catalogo.js';

export const REFEICOES = [
  ['cafe', 'Café da manhã'], ['almoco', 'Almoço'], ['lanche', 'Lanche'], ['jantar', 'Jantar']
];
export const ATIVIDADE = [
  [1.2, 'Sedentária'], [1.375, 'Leve (1–3x/semana)'], [1.55, 'Moderada (3–5x/semana)'], [1.725, 'Intensa / trabalho braçal']
];

// Gasto energético estimado (kcal/dia). Adultos com peso e altura: Mifflin-St Jeor.
// Menores de 18 ou sem altura: equações de Schofield (só peso). Sem peso: valor de referência por idade e sexo.
export function energia(p) {
  const idade = +p.idade, peso = +p.peso, altura = +p.altura, af = +p.atividade || 1.375;
  const m = p.sexo === 'M';
  let tmb = null, metodo = '';
  if (peso && idade >= 18 && altura) {
    tmb = 10 * peso + 6.25 * altura - 5 * idade + (m ? 5 : -161); metodo = 'Mifflin-St Jeor';
  } else if (peso && idade) {
    if (idade < 18) tmb = m ? 17.686 * peso + 658.2 : 13.384 * peso + 692.6;
    else if (idade < 30) tmb = m ? 15.057 * peso + 692.2 : 14.818 * peso + 486.6;
    else if (idade < 60) tmb = m ? 11.472 * peso + 873.1 : 8.126 * peso + 845.6;
    else tmb = m ? 11.711 * peso + 587.7 : 9.082 * peso + 658.5;
    metodo = 'Schofield';
  }
  let kcal;
  if (tmb) kcal = tmb * af;
  else {
    metodo = 'referência por idade e sexo (preencha peso para melhorar)';
    if (idade && idade < 10) kcal = 1600;
    else if (idade && idade < 14) kcal = m ? 2200 : 2000;
    else if (idade && idade < 18) kcal = m ? 2700 : 2200;
    else kcal = m ? 2500 : 2000;
  }
  const fator = Math.min(1.6, Math.max(0.6, kcal / 2200));
  return { kcal: Math.round(kcal / 10) * 10, fator: Math.round(fator * 100) / 100, metodo };
}

const ehFds = d => d.getDay() === 0 || d.getDay() === 6;
const fmt = d => d.toISOString().slice(0, 10);

// Estoque do ciclo: última compra de mercado + itens lançados à mão de 7 dias antes em diante.
export function estoqueDoCiclo(produtos, notas) {
  const mercado = notas.filter(n => (n.tipo || 'mercado') === 'mercado').sort((a, b) => b.data.localeCompare(a.data));
  if (!mercado.length) return { inicio: null, estoque: {}, origem: [] };
  const inicio = mercado[0].data.slice(0, 10);
  const limite = new Date(inicio); limite.setDate(limite.getDate() - 7);
  const usadas = notas.filter(n => n.id === mercado[0].id || (n.tipo === 'avulso' && n.data.slice(0, 10) >= fmt(limite)));
  const estoque = {};
  for (const p of Object.values(produtos)) {
    if (!p.papel) continue;
    for (const c of p.compras) {
      if (!usadas.some(n => n.id === c.nota)) continue;
      estoque[p.papel] = (estoque[p.papel] || 0) + c.qtd * (p.conteudo || 0);
    }
  }
  return { inicio, estoque, origem: usadas.map(n => n.id) };
}

// Escolhe em quais refeições um alimento entra para que o estoque se espalhe pelo ciclo
// (em vez de acabar na primeira metade). Retorna os índices escolhidos e o que faltou.
function espalhar(lista, demanda, cap, tetoFracao = 1) {
  const total = lista.reduce((s, x) => s + demanda(x), 0);
  if (!total) return { escolhidos: new Set(), usado: 0, falta: 0 };
  const capUtil = Math.min(cap, total * tetoFracao);
  const razao = Math.min(1, capUtil / total);
  let acum = 0, usado = 0;
  const escolhidos = new Set();
  lista.forEach((x, i) => {
    const d = demanda(x);
    acum += d;
    if (d > 0 && usado + d <= razao * acum + d * 0.99 && usado + d <= capUtil + 1e-9) { escolhidos.add(i); usado += d; }
  });
  const falta = tetoFracao >= 1 ? Math.max(0, total - usado) : 0;
  return { escolhidos, usado, falta };
}

export function gerarCardapio({ estoque, inicio, dias = 30, pessoas, porcoes = {} }) {
  const porc = k => (porcoes[k] ?? PAPEIS[k].porcao);
  const perfis = pessoas.map(p => ({ ...p, ...energia(p) }));
  const resto = { ...estoque };
  const usado = {};
  const faltas = {};
  const gasta = (papel, q) => { usado[papel] = (usado[papel] || 0) + q; resto[papel] = (resto[papel] || 0) - q; };

  // monta as refeições do ciclo
  const ref = [];
  const d0 = new Date(inicio + 'T12:00:00');
  const listaDias = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date(d0); d.setDate(d.getDate() + i);
    const tipo = ehFds(d) ? 'fds' : 'semana';
    const dia = { data: fmt(d), fds: tipo === 'fds', refeicoes: {} };
    listaDias.push(dia);
    for (const [slot] of REFEICOES) {
      const quem = perfis.filter(p => p.refeicoes?.[tipo]?.[slot]);
      if (!quem.length) continue;
      const r = { dia, slot, quem, itens: [], partes: [] };
      dia.refeicoes[slot] = r;
      ref.push(r);
    }
  }
  const fatorPara = (r, papel) => r.quem.filter(p => !(p.naoCome || []).includes(papel)).reduce((s, p) => s + p.fator, 0);
  const qtdPara = (r, papel) => PAPEIS[papel].porCasa ? porc(papel) : porc(papel) * fatorPara(r, papel);
  const poe = (r, papel, q) => {
    if (!(q > 0)) return;
    const base = PAPEIS[papel].base;
    q = base === 'un' ? Math.ceil(q) : PAPEIS[papel].porCasa ? Math.round(q) : Math.round(q / 10) * 10;
    r.itens.push({ papel, qtd: q, base });
    gasta(papel, q);
  };
  const tem = p => (estoque[p] || 0) > 0;

  // ---------- almoço e jantar ----------
  const principais = ref.filter(r => r.slot === 'almoco' || r.slot === 'jantar');
  const idx = (lista, set) => lista.filter((_, i) => set.has(i));

  // carboidrato: macarrão em até ~1 de cada 3 refeições, o resto arroz
  const mac = tem('macarrao') ? espalhar(principais, r => qtdPara(r, 'macarrao'), estoque.macarrao, 0.34) : { escolhidos: new Set() };
  principais.forEach((r, i) => { r.carbo = mac.escolhidos.has(i) ? 'macarrao' : 'arroz'; });
  const comArroz = principais.filter(r => r.carbo === 'arroz');
  const arr = espalhar(comArroz, r => qtdPara(r, 'arroz'), estoque.arroz || 0);
  comArroz.forEach((r, i) => { if (!arr.escolhidos.has(i)) r.carbo = 'arroz_falta'; });
  if (arr.falta) faltas.arroz = arr.falta;

  // feijão acompanha o arroz
  const fej = espalhar(comArroz, r => qtdPara(r, 'feijao'), estoque.feijao || 0);
  comArroz.forEach((r, i) => { r.feijao = fej.escolhidos.has(i) ? 'sim' : 'falta'; });
  if (fej.falta) faltas.feijao = fej.falta;

  // proteína: capacidade somada em "porções de referência", depois escolhe a proteína de cada refeição
  const prots = ['frango', 'carne', 'peixe', 'embutido', 'ovo'].filter(tem);
  const capRef = Object.fromEntries(prots.map(p => [p, estoque[p] / porc(p)]));
  const capTotal = prots.reduce((s, p) => s + capRef[p], 0);
  const pro = espalhar(principais, r => fatorPara(r, '_'), capTotal);
  const restoRef = { ...capRef };
  let anterior = null;
  principais.forEach((r, i) => {
    if (!pro.escolhidos.has(i)) { r.proteina = 'falta'; return; }
    const f = fatorPara(r, '_');
    let opcoes = prots.filter(p => restoRef[p] >= f * 0.999);
    if (!opcoes.length) opcoes = prots.filter(p => restoRef[p] > 0);
    if (opcoes.length > 1) opcoes = opcoes.filter(p => p !== anterior);
    opcoes.sort((a, b) => restoRef[b] / capRef[b] - restoRef[a] / capRef[a]);
    const escolha = opcoes[0];
    if (!escolha) { r.proteina = 'falta'; return; }
    r.proteina = escolha; restoRef[escolha] -= f; anterior = escolha;
  });
  if (pro.falta && prots.length) {
    const principal = prots.slice().sort((a, b) => estoque[b] - estoque[a])[0];
    faltas[principal] = (faltas[principal] || 0) + pro.falta * porc(principal);
  } else if (!prots.length && principais.length) {
    faltas.frango = principais.reduce((s, r) => s + fatorPara(r, 'frango'), 0) * porc('frango');
  }

  // legumes se houver
  const leg = tem('legume') ? espalhar(principais, r => qtdPara(r, 'legume'), estoque.legume) : { escolhidos: new Set() };

  // refresco: um por dia no almoço (ou no jantar quando ninguém almoça)
  const refrescoRef = listaDias.map(d => d.refeicoes.almoco || d.refeicoes.jantar).filter(Boolean);
  const rfr = tem('refresco') ? espalhar(refrescoRef, () => 1, estoque.refresco) : { escolhidos: new Set() };
  // sobremesa no almoço do fim de semana
  const sobRef = listaDias.filter(d => d.fds).map(d => d.refeicoes.almoco || d.refeicoes.jantar).filter(Boolean);
  const sob = tem('sobremesa') ? espalhar(sobRef, () => 1, estoque.sobremesa) : { escolhidos: new Set() };

  principais.forEach((r, i) => {
    if (r.carbo === 'macarrao') { poe(r, 'macarrao', qtdPara(r, 'macarrao')); if (tem('extrato')) poe(r, 'extrato', Math.min(porc('extrato'), Math.max(0, resto.extrato))); }
    else if (r.carbo === 'arroz') poe(r, 'arroz', qtdPara(r, 'arroz'));
    if (r.feijao === 'sim') poe(r, 'feijao', qtdPara(r, 'feijao'));
    if (r.proteina && r.proteina !== 'falta') poe(r, r.proteina, qtdPara(r, r.proteina));
    if (leg.escolhidos.has(i)) poe(r, 'legume', qtdPara(r, 'legume'));
    if (tem('oleo') && resto.oleo > 0) poe(r, 'oleo', Math.min(porc('oleo'), resto.oleo));
    const nomeProt = { frango: 'frango', carne: 'carne', peixe: 'peixe', embutido: 'calabresa', ovo: 'ovos', falta: 'proteína a comprar' }[r.proteina];
    if (r.carbo === 'macarrao') r.partes.push(`Macarrão ao molho com ${nomeProt}`);
    else {
      const c = r.carbo === 'arroz' ? 'Arroz' : 'Arroz (a comprar)';
      const f = r.feijao === 'sim' ? ', feijão' : r.feijao === 'falta' ? ', feijão (a comprar)' : '';
      r.partes.push(`${c}${f} e ${nomeProt}`);
    }
    if (leg.escolhidos.has(i)) r.partes.push('salada/legumes');
  });
  refrescoRef.forEach((r, i) => { if (rfr.escolhidos.has(i)) { poe(r, 'refresco', 1); r.partes.push('refresco'); } });
  sobRef.forEach((r, i) => { if (sob.escolhidos.has(i)) { poe(r, 'sobremesa', 1); r.partes.push('sobremesa'); } });

  // ---------- café da manhã ----------
  const cafes = ref.filter(r => r.slot === 'cafe');
  const flo = tem('flocao') ? espalhar(cafes, r => qtdPara(r, 'flocao'), estoque.flocao) : { escolhidos: new Set() };
  const semFlocao = cafes.filter((_, i) => !flo.escolhidos.has(i));
  const pao = tem('pao') ? espalhar(semFlocao, r => qtdPara(r, 'pao'), estoque.pao) : { escolhidos: new Set() };
  const semPao = semFlocao.filter((_, i) => !pao.escolhidos.has(i));
  // biscoito do café usa no máximo metade do estoque; a outra metade fica para o lanche
  const temLanche = ref.some(r => r.slot === 'lanche');
  const bisC = tem('biscoito') ? espalhar(semPao, r => qtdPara(r, 'biscoito'), estoque.biscoito * (temLanche ? 0.5 : 1)) : { escolhidos: new Set() };
  const leite = tem('leite') ? 'leite' : tem('leite_po') ? 'leite_po' : null;
  const lei = leite ? espalhar(cafes, r => qtdPara(r, leite), estoque[leite]) : { escolhidos: new Set(), falta: 0 };
  const ach = tem('achocolatado') ? espalhar(cafes, r => qtdPara(r, 'achocolatado'), estoque.achocolatado) : { escolhidos: new Set() };
  const caf = tem('cafe') ? espalhar(cafes, r => qtdPara(r, 'cafe'), estoque.cafe) : { escolhidos: new Set() };
  const mar = tem('margarina') ? espalhar(cafes, r => qtdPara(r, 'margarina'), estoque.margarina) : { escolhidos: new Set() };
  if (leite && lei.falta) faltas[leite] = lei.falta;
  cafes.forEach((r, i) => {
    const comida = [];
    if (flo.escolhidos.has(i)) { poe(r, 'flocao', qtdPara(r, 'flocao')); comida.push('cuscuz'); }
    else {
      const j = semFlocao.indexOf(r);
      if (pao.escolhidos.has(j)) { poe(r, 'pao', qtdPara(r, 'pao')); comida.push('pão'); }
      else {
        const k = semPao.indexOf(r);
        if (bisC.escolhidos.has(k)) { poe(r, 'biscoito', qtdPara(r, 'biscoito')); comida.push('biscoito'); }
        else comida.push('pão/cuscuz (a comprar)');
      }
    }
    if (mar.escolhidos.has(i)) { poe(r, 'margarina', qtdPara(r, 'margarina')); comida[0] += ' com margarina'; }
    const bebida = [];
    if (lei.escolhidos.has(i)) { poe(r, leite, qtdPara(r, leite)); bebida.push('leite'); }
    if (ach.escolhidos.has(i)) { poe(r, 'achocolatado', qtdPara(r, 'achocolatado')); bebida.push('achocolatado'); }
    if (caf.escolhidos.has(i)) { poe(r, 'cafe', qtdPara(r, 'cafe')); bebida.push('café'); }
    r.partes.push(comida.join(', ') + (bebida.length ? ' · ' + bebida.join(' com ') : ''));
  });

  // ---------- lanche ----------
  const lanches = ref.filter(r => r.slot === 'lanche');
  const bol = tem('mistura_bolo') ? espalhar(lanches, () => porc('mistura_bolo'), estoque.mistura_bolo) : { escolhidos: new Set() };
  const semBolo = lanches.filter((_, i) => !bol.escolhidos.has(i));
  const bisL = tem('biscoito') ? espalhar(semBolo, r => qtdPara(r, 'biscoito'), Math.max(0, resto.biscoito)) : { escolhidos: new Set() };
  const semBis = semBolo.filter((_, i) => !bisL.escolhidos.has(i));
  const fru = tem('fruta') ? espalhar(semBis, r => qtdPara(r, 'fruta'), estoque.fruta) : { escolhidos: new Set() };
  lanches.forEach((r, i) => {
    if (bol.escolhidos.has(i)) { poe(r, 'mistura_bolo', porc('mistura_bolo')); r.partes.push('bolo'); return; }
    const j = semBolo.indexOf(r);
    if (bisL.escolhidos.has(j)) { poe(r, 'biscoito', qtdPara(r, 'biscoito')); r.partes.push('biscoito'); return; }
    const k = semBis.indexOf(r);
    if (fru.escolhidos.has(k)) { poe(r, 'fruta', qtdPara(r, 'fruta')); r.partes.push('fruta'); return; }
    r.partes.push('lanche livre (sem item no estoque)');
  });

  // ---------- resumo ----------
  const fimCiclo = listaDias.length ? listaDias[listaDias.length - 1].data : inicio;
  const resumo = {};
  for (const papel of new Set([...Object.keys(estoque), ...Object.keys(faltas)])) {
    const est = estoque[papel] || 0, us = usado[papel] || 0;
    resumo[papel] = { estoque: Math.round(est), usado: Math.round(us), sobra: Math.round(Math.max(0, est - us)), falta: Math.round(faltas[papel] || 0) };
  }
  // óleo, extrato e afins: se acabar antes do fim, registra a falta proporcional
  for (const papel of ['oleo', 'extrato']) {
    if (!resumo[papel]) continue;
    const consumoDia = (principais.length ? (principais.filter(r => papel === 'oleo' || r.carbo === 'macarrao').length * porc(papel)) : 0);
    if (consumoDia > (estoque[papel] || 0)) { resumo[papel].falta = Math.round(consumoDia - estoque[papel]); faltas[papel] = resumo[papel].falta; }
  }

  return {
    inicio, fim: fimCiclo, dias,
    geradoEm: new Date().toISOString(),
    pessoas: perfis.map(p => ({ id: p.id, nome: p.nome, kcal: p.kcal, fator: p.fator, metodo: p.metodo })),
    dias_: listaDias.map(d => ({
      data: d.data, fds: d.fds,
      refeicoes: Object.fromEntries(Object.entries(d.refeicoes).map(([slot, r]) => [slot, {
        texto: r.partes.join(' + '), quem: r.quem.map(p => p.nome), itens: r.itens
      }]))
    })),
    resumo, faltas: Object.fromEntries(Object.entries(faltas).map(([k, v]) => [k, Math.round(v)]))
  };
}
