// Catálogo de produtos derivado das notas: classificação, conteúdo por unidade,
// histórico de preço e previsão da próxima compra.

// Papéis que o cardápio usa. Porção = quantidade crua para um adulto de referência (fator 1,0),
// ou para a casa inteira quando porCasa = true. São estimativas editáveis em Ajustes.
export const PAPEIS = {
  arroz:      { nome: 'Arroz',               base: 'g',  porcao: 70,  refeicao: 'principal' },
  feijao:     { nome: 'Feijão',              base: 'g',  porcao: 50,  refeicao: 'principal' },
  macarrao:   { nome: 'Macarrão',            base: 'g',  porcao: 80,  refeicao: 'principal' },
  frango:     { nome: 'Frango',              base: 'g',  porcao: 180, refeicao: 'proteina' },
  carne:      { nome: 'Carne',               base: 'g',  porcao: 130, refeicao: 'proteina' },
  embutido:   { nome: 'Calabresa/linguiça',  base: 'g',  porcao: 70,  refeicao: 'proteina' },
  ovo:        { nome: 'Ovo',                 base: 'un', porcao: 2,   refeicao: 'proteina' },
  peixe:      { nome: 'Peixe',               base: 'g',  porcao: 150, refeicao: 'proteina' },
  flocao:     { nome: 'Flocão (cuscuz)',     base: 'g',  porcao: 60,  refeicao: 'cafe' },
  pao:        { nome: 'Pão',                 base: 'g',  porcao: 50,  refeicao: 'cafe' },
  biscoito:   { nome: 'Biscoito/rosquinha',  base: 'g',  porcao: 35,  refeicao: 'cafe' },
  leite_po:   { nome: 'Leite em pó',         base: 'g',  porcao: 26,  refeicao: 'bebida' },
  leite:      { nome: 'Leite líquido',       base: 'ml', porcao: 200, refeicao: 'bebida' },
  achocolatado:{nome: 'Achocolatado',        base: 'g',  porcao: 15,  refeicao: 'bebida' },
  cafe:       { nome: 'Café',                base: 'g',  porcao: 10,  refeicao: 'bebida' },
  margarina:  { nome: 'Margarina/manteiga',  base: 'g',  porcao: 10,  refeicao: 'cafe' },
  mistura_bolo:{nome: 'Mistura para bolo',   base: 'g',  porcao: 225, refeicao: 'lanche', porCasa: true },
  refresco:   { nome: 'Refresco em pó',      base: 'un', porcao: 1,   refeicao: 'bebida_casa', porCasa: true },
  extrato:    { nome: 'Extrato/molho de tomate', base: 'g', porcao: 100, refeicao: 'tempero', porCasa: true },
  oleo:       { nome: 'Óleo',                base: 'ml', porcao: 20,  refeicao: 'tempero', porCasa: true },
  sobremesa:  { nome: 'Sobremesa (condensado, creme de leite, bombom)', base: 'un', porcao: 1, refeicao: 'sobremesa', porCasa: true },
  acucar:     { nome: 'Açúcar',              base: 'g',  porcao: 15,  refeicao: 'tempero' },
  fruta:      { nome: 'Fruta',               base: 'g',  porcao: 150, refeicao: 'lanche' },
  legume:     { nome: 'Legumes/verduras',    base: 'g',  porcao: 80,  refeicao: 'acompanhamento' }
};

export const CATEGORIAS = ['Alimento', 'Bebida', 'Limpeza', 'Higiene', 'Outros'];
export const PRIORIDADES = ['essencial', 'normal', 'dispensável'];

// Regras por abreviação da nota. A primeira que casa vence.
const REGRAS = [
  [/^CR LE\b|CREME DE LEITE/, 'Creme de leite', 'Alimento', 'sobremesa', 'normal'],
  [/^M LAC\b|CONDENS/, 'Leite condensado/mistura láctea', 'Alimento', 'sobremesa', 'dispensável'],
  [/BOMBOM|CHOCOLATE\b|^CHOC\b/, 'Bombom/chocolate', 'Alimento', 'sobremesa', 'dispensável'],
  [/^ARR\b|ARROZ/, 'Arroz', 'Alimento', 'arroz', 'essencial'],
  [/^FEIJ/, 'Feijão', 'Alimento', 'feijao', 'essencial'],
  [/^MAC\b|MACARR|ESPAG/, 'Macarrão', 'Alimento', 'macarrao', 'essencial'],
  [/FLOCAO|CUSCUZ|FLOCOS? DE MILHO/, 'Flocão de milho', 'Alimento', 'flocao', 'essencial'],
  [/^FGO\b|FRANGO|SOBRECOXA|COXA|PEITO FGO/, 'Frango', 'Alimento', 'frango', 'essencial'],
  [/^LING\b|CALAB|SALSICHA|LINGUI/, 'Calabresa/linguiça', 'Alimento', 'embutido', 'normal'],
  [/CARNE|PATINHO|ACEM|MUSCULO|COSTELA|MOIDA|ALCATRA|CHA DE DENTRO/, 'Carne', 'Alimento', 'carne', 'essencial'],
  [/PEIXE|TILAPIA|SARDINHA|ATUM/, 'Peixe', 'Alimento', 'peixe', 'normal'],
  [/^OVO/, 'Ovos', 'Alimento', 'ovo', 'essencial'],
  [/^LTE PO|LEITE EM PO|LEITE PO/, 'Leite em pó', 'Alimento', 'leite_po', 'essencial'],
  [/^LTE\b|^LEITE/, 'Leite', 'Alimento', 'leite', 'essencial'],
  [/^ACHOC/, 'Achocolatado', 'Alimento', 'achocolatado', 'normal'],
  [/^CAFE\b|^CAFÉ/, 'Café', 'Alimento', 'cafe', 'essencial'],
  [/^ACUC|ACUCAR/, 'Açúcar', 'Alimento', 'acucar', 'essencial'],
  [/^MARG\b|MARGARINA|MANTEIGA|^MANT\b/, 'Margarina', 'Alimento', 'margarina', 'normal'],
  [/CRACKER|BISC|ROSQ|BOLACHA|WAFER/, 'Biscoito', 'Alimento', 'biscoito', 'normal'],
  [/^PAO\b|^PÃO/, 'Pão', 'Alimento', 'pao', 'essencial'],
  [/^MB\b|MIST.*BOLO/, 'Mistura para bolo', 'Alimento', 'mistura_bolo', 'dispensável'],
  [/^EXT\b|EXTRATO|MOLHO|POLPA TOM/, 'Extrato de tomate', 'Alimento', 'extrato', 'normal'],
  [/^OL\b|OLEO/, 'Óleo', 'Alimento', 'oleo', 'essencial'],
  [/^REFR?\b|TANG|SUCO/, 'Refresco em pó', 'Bebida', 'refresco', 'dispensável'],
  [/^AGUA SANIT|SANITARIA/, 'Água sanitária', 'Limpeza', null, 'essencial'],
  [/^AM\b|AMAC/, 'Amaciante', 'Limpeza', null, 'normal'],
  [/^D ZUPP|DESINF|^D\b/, 'Desinfetante', 'Limpeza', null, 'normal'],
  [/^BRILH|SABAO EM PO|LAVA ROUPA|^LAV\b/, 'Sabão em pó', 'Limpeza', null, 'essencial'],
  [/^SB\b|SABAO/, 'Sabão em barra', 'Limpeza', null, 'essencial'],
  [/^DET\b|DETERG|LAVA LOUCA/, 'Detergente', 'Limpeza', null, 'essencial'],
  [/^ESP\b.*(SCT|BRT|ESPONJA)|^ESP SCT/, 'Esponja de louça', 'Limpeza', null, 'normal'],
  [/BOMBRIL|LA DE ACO/, 'Esponja de aço', 'Limpeza', null, 'normal'],
  [/^SC\b|SACO LIXO|SACOS? P/, 'Saco de lixo', 'Limpeza', null, 'essencial'],
  [/^SBT\b|SABONETE/, 'Sabonete', 'Higiene', null, 'essencial'],
  [/^CR\b.*(COLG|DENT|SORRISO|CLOSE)|CREME DENTAL/, 'Creme dental', 'Higiene', null, 'essencial'],
  [/^ESC\b|ESCOVA/, 'Escova de dente', 'Higiene', null, 'normal'],
  [/^P HIG|PAPEL HIG/, 'Papel higiênico', 'Higiene', null, 'essencial'],
  [/^DESOD/, 'Desodorante', 'Higiene', null, 'essencial'],
  [/^SH\b|SHAMPOO/, 'Shampoo', 'Higiene', null, 'normal'],
  [/^COND\b|CONDICIONADOR/, 'Condicionador', 'Higiene', null, 'normal'],
  [/ABSORV/, 'Absorvente', 'Higiene', null, 'essencial'],
  [/FRUTA|BANANA|MACA\b|LARANJA|MAMAO|MELANCIA/, 'Fruta', 'Alimento', 'fruta', 'normal'],
  [/TOMATE|CEBOLA|BATATA|CENOURA|ALFACE|LEGUME|VERDURA|ALHO/, 'Legumes/verduras', 'Alimento', 'legume', 'normal']
];

export function classificar(descricao) {
  const d = descricao.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [re, nome, categoria, papel, prioridade] of REGRAS) {
    if (re.test(d)) return { nome, categoria, papel, prioridade };
  }
  return { nome: descricao, categoria: 'Outros', papel: null, prioridade: 'normal' };
}

// Conteúdo de uma unidade comprada, na base do papel (g, ml ou un).
export function conteudoPorUnidade(descricao, un, papel) {
  const base = papel ? PAPEIS[papel].base : null;
  const U = (un || '').toUpperCase();
  if (U === 'KG') return { valor: 1000, base: 'g' };
  if (U === 'L' && base === 'ml') return { valor: 1000, base: 'ml' };
  const d = descricao.toUpperCase();
  if (base === 'un') {
    const m = d.match(/(\d+)\s*UN\b/) || d.match(/(\d+)\s*X\s*\d/);
    return { valor: m ? +m[1] : 1, base: 'un' };
  }
  const multi = d.match(/(\d+)\s*X\s*(\d+(?:[.,]\d+)?)\s*(KG|G|ML|LT?)\b/);
  const simples = d.match(/(\d+(?:[.,]\d+)?)\s*(KG|G|ML|LT|L)\b/);
  const conv = (v, u) => {
    v = parseFloat(String(v).replace(',', '.'));
    if (u === 'KG' || u === 'L' || u === 'LT') return v * 1000;
    return v;
  };
  if (multi) return { valor: +multi[1] * conv(multi[2], multi[3]), base: /ML|L/.test(multi[3]) ? 'ml' : 'g' };
  if (simples) return { valor: conv(simples[1], simples[2]), base: /ML|L/.test(simples[2]) ? 'ml' : 'g' };
  return { valor: base === 'un' ? 1 : 0, base: base || 'un' };
}

const raizCnpj = cnpj => (cnpj || '').replace(/\D/g, '').slice(0, 8) || 'loja';

export function idProduto(nota, item) {
  if (nota.tipo === 'avulso') return 'avulso_' + item.descricao.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-');
  return raizCnpj(nota.cnpj) + '_' + item.codigo;
}

// Monta os produtos a partir de todas as notas + ajustes salvos (nome, categoria, papel, etc.).
export function montarProdutos(notas, ajustes = {}) {
  const prods = {};
  const ordenadas = [...notas].sort((a, b) => a.data.localeCompare(b.data));
  for (const nota of ordenadas) {
    for (const it of nota.itens) {
      const id = idProduto(nota, it);
      if (!prods[id]) {
        const auto = nota.tipo === 'avulso'
          ? { nome: it.descricao, categoria: it.papel ? 'Alimento' : 'Outros', papel: it.papel || null, prioridade: 'essencial' }
          : classificar(it.descricao);
        prods[id] = { id, descricao: it.descricao, un: it.un, ...auto, compras: [], avulso: nota.tipo === 'avulso' };
        if (it.conteudo) prods[id].conteudo = it.conteudo;
      }
      const p = prods[id];
      const ultima = p.compras[p.compras.length - 1];
      if (ultima && ultima.nota === nota.id) {           // mesma nota com o item repetido em linhas
        ultima.qtd = +(ultima.qtd + it.qtd).toFixed(3);
        ultima.total = +(ultima.total + it.total).toFixed(2);
      } else {
        p.compras.push({ nota: nota.id, data: nota.data, qtd: it.qtd, unit: it.unit, total: it.total, tipo: nota.tipo || 'mercado' });
      }
    }
  }
  for (const p of Object.values(prods)) {
    Object.assign(p, ajustes[p.id] || {});
    if (p.conteudo == null) {
      const avulsoConteudo = p.avulso ? null : conteudoPorUnidade(p.descricao, p.un, p.papel);
      p.conteudo = avulsoConteudo ? avulsoConteudo.valor : (p.papel ? (PAPEIS[p.papel].base === 'un' ? 1 : 1000) : 1);
      if (p.papel && !p.conteudo) { p.conteudo = 500; p.conteudoEstimado = true; } // tamanho não veio na descrição
    }
    const c = p.compras;
    p.precoAtual = c[c.length - 1].unit;
    p.precoPrimeiro = c[0].unit;
    p.variacao = p.precoPrimeiro ? (p.precoAtual - p.precoPrimeiro) / p.precoPrimeiro : 0;
  }
  return prods;
}

// Previsão da próxima compra no mercado.
// Quantidade = média do que foi comprado por compra de mercado (quantas compras existirem),
// mais o que o cardápio indicou que vai faltar.
export function preverLista(produtos, notas, faltas = {}) {
  const compras = notas.filter(n => (n.tipo || 'mercado') === 'mercado');
  const nCompras = Math.max(compras.length, 1);
  const linhas = [];
  for (const p of Object.values(produtos)) {
    if (p.avulso || p.foraDaLista) continue;
    const doMercado = p.compras.filter(c => c.tipo === 'mercado');
    if (!doMercado.length) continue;
    const totalQtd = doMercado.reduce((s, c) => s + c.qtd, 0);
    let qtd = totalQtd / nCompras;
    qtd = p.un === 'KG' ? Math.round(qtd * 10) / 10 : Math.max(1, Math.round(qtd));
    linhas.push({ id: p.id, nome: p.nome, descricao: p.descricao, categoria: p.categoria, prioridade: p.prioridade,
      papel: p.papel, un: p.un, qtd, extra: 0, preco: p.precoAtual, motivo: '' });
  }
  // faltas do cardápio: converte a quantidade em unidades do produto mais recente daquele papel
  for (const [papel, falta] of Object.entries(faltas)) {
    if (!(falta > 0)) continue;
    const candidatos = linhas.filter(l => l.papel === papel);
    if (!candidatos.length) continue;
    const l = candidatos.sort((a, b) => b.preco - a.preco)[0];
    const prod = produtos[l.id];
    const porUn = prod.conteudo || 1;
    l.extra = prod.un === 'KG' ? Math.round((falta / porUn) * 10) / 10 : Math.ceil(falta / porUn);
    l.motivo = 'faltou no cardápio';
  }
  for (const l of linhas) { l.qtdFinal = +(l.qtd + l.extra).toFixed(3); l.valor = +(l.qtdFinal * l.preco).toFixed(2); }
  return linhas;
}

// Aplica o orçamento: corta primeiro os dispensáveis, depois os normais, dos mais caros para os mais baratos.
export function aplicarOrcamento(linhas, orcamento) {
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  linhas.forEach(l => { l.cortado = false; });
  if (!(orcamento > 0) || total <= orcamento) return { total, cabe: total, cortados: [] };
  let atual = total;
  const ordem = { 'dispensável': 0, 'normal': 1, 'essencial': 2 };
  const fila = [...linhas].filter(l => l.prioridade !== 'essencial')
    .sort((a, b) => ordem[a.prioridade] - ordem[b.prioridade] || b.valor - a.valor);
  const cortados = [];
  for (const l of fila) {
    if (atual <= orcamento) break;
    l.cortado = true; atual -= l.valor; cortados.push(l);
  }
  return { total, cabe: atual, cortados };
}

// Índice de preço da casa: a cesta da primeira compra de mercado a preços de hoje.
export function indicePrecos(produtos, notas) {
  const mercado = notas.filter(n => (n.tipo || 'mercado') === 'mercado').sort((a, b) => a.data.localeCompare(b.data));
  if (mercado.length < 2) return null;
  const primeira = mercado[0];
  let antes = 0, hoje = 0;
  for (const it of primeira.itens) {
    const p = produtos[idProduto(primeira, it)];
    if (!p) continue;
    antes += it.qtd * it.unit;
    hoje += it.qtd * p.precoAtual;
  }
  return { antes, hoje, variacao: antes ? (hoje - antes) / antes : 0, desde: primeira.data };
}
