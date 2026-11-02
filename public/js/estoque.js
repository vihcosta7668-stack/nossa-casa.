// Estoque real: o que entrou pelas notas (a partir da data de início do controle)
// menos o que foi registrado como usado. Saldo em unidades do produto (pacote, kg, un).

export function saldos(produtos, movimentos, desde) {
  const s = {};
  for (const p of Object.values(produtos)) {
    let q = 0;
    for (const c of p.compras) if (!desde || c.data.slice(0, 10) >= desde) q += c.qtd;
    s[p.id] = q;
  }
  for (const m of movimentos) s[m.produtoId] = (s[m.produtoId] || 0) + (+m.delta || 0);
  for (const k in s) s[k] = Math.round(s[k] * 1000) / 1000;
  return s;
}

// Quantidade na base do cardápio (g, ml, un) disponível por tipo de alimento.
export function estoquePorPapel(produtos, sal) {
  const e = {};
  for (const p of Object.values(produtos)) {
    if (!p.papel) continue;
    const q = Math.max(0, sal[p.id] || 0) * (p.conteudo || 0);
    if (q > 0) e[p.papel] = (e[p.papel] || 0) + q;
  }
  return e;
}

// Converte um uso em gramas/ml/un de um tipo de alimento em baixas nos produtos.
// Começa pelo produto com menor saldo positivo (o pacote aberto termina primeiro).
export function baixarPapel(produtos, sal, papel, qtdBase) {
  const cands = Object.values(produtos).filter(p => p.papel === papel && (sal[p.id] || 0) > 0 && p.conteudo > 0)
    .sort((a, b) => sal[a.id] - sal[b.id]);
  const movs = [];
  let resta = qtdBase;
  for (const p of cands) {
    if (resta <= 0) break;
    const disp = sal[p.id] * p.conteudo;
    const usa = Math.min(disp, resta);
    movs.push({ produtoId: p.id, delta: -Math.round((usa / p.conteudo) * 1000) / 1000 });
    resta -= usa;
  }
  return { movs, faltou: Math.max(0, resta) };
}

// "Acabou um pacote": o saldo cai para o número inteiro de pacotes fechados que restam.
export function deltaAcabou(saldo) {
  if (saldo <= 0) return 0;
  const fechados = Math.max(0, Math.ceil(saldo - 1e-6) - 1);
  return Math.round((fechados - saldo) * 1000) / 1000;
}

export function nivel(p, saldo) {
  const ultima = p.compras[p.compras.length - 1]?.qtd || 1;
  if (saldo <= 0.001) return 'acabou';
  if (saldo / ultima <= 0.25) return 'acabando';
  return 'ok';
}
