// Leitura do comprovante NFC-e (PDF salvo da consulta da SEFA ou texto copiado da página).
// Recebe o texto em linhas e devolve a nota estruturada.

const num = s => {
  if (s == null) return NaN;
  s = String(s).trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(s);
};
const round2 = v => Math.round(v * 100) / 100;

export function parseNota(texto) {
  const linhas = texto.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const plano = linhas.join(' ');

  const itens = [];
  for (let i = 0; i < linhas.length; i++) {
    const m = linhas[i].match(/^(.*?)\s*\(C[óo]digo:\s*(\w+)\s*\)/i);
    if (!m) continue;
    // a quantidade, unidade e preços vêm nas linhas seguintes (ou na mesma, se o texto foi colado)
    const resto = [linhas[i].slice(m[0].length), linhas[i + 1], linhas[i + 2], linhas[i + 3]].join(' ');
    const q = resto.match(/Qtde\.?:\s*([\d.,]+)\s*UN:\s*(\S+)\s*Vl\.\s*Unit\.?:\s*([\d.,]+)/i);
    const t = resto.match(/Vl\.\s*Total\s*([\d.,]+)/i);
    if (!q || !t) continue;
    itens.push({
      descricao: m[1].trim(),
      codigo: m[2],
      qtd: num(q[1]),
      un: q[2].toUpperCase(),
      unit: num(q[3]),
      total: num(t[1])
    });
  }

  const cnpj = (plano.match(/CNPJ:\s*([\d./-]+)/i) || [])[1] || '';
  const iCnpj = linhas.findIndex(l => /CNPJ:/i.test(l));
  const loja = iCnpj > 0 ? linhas[iCnpj - 1] : '';
  const numero = (plano.match(/N[úu]mero:\s*(\d+)/i) || [])[1] || '';
  const emissao = plano.match(/Emiss[ãa]o:\s*(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}:\d{2}(?::\d{2})?)?/i);
  const data = emissao ? `${emissao[3]}-${emissao[2]}-${emissao[1]}T${emissao[4] || '12:00'}` : '';
  const chaveM = plano.match(/Chave de acesso:\s*((?:\d{4}\s?){11})/i) || plano.match(/((?:\d{4}\s){10}\d{4})/);
  const chave = chaveM ? chaveM[1].replace(/\s/g, '') : '';
  const pagamento = (plano.match(/(Cart[ãa]o de D[ée]bito|Cart[ãa]o de Cr[ée]dito|Dinheiro|PIX|Pix|Vale Alimenta[çc][ãa]o)/) || [])[1] || '';

  const somaItens = round2(itens.reduce((s, it) => s + it.total, 0));

  // Rodapé: a SEFA imprime os valores fora da ordem dos rótulos. Procura a sequência
  // [qtd de itens, valor total, desconto, valor a pagar] e confere com a soma dos itens.
  let desconto = 0, pago = somaItens, totalNota = somaItens, conferido = false;
  for (let i = 0; i < linhas.length - 3; i++) {
    if (!/^\d{1,4}$/.test(linhas[i])) continue;
    const [a, b, c] = [linhas[i + 1], linhas[i + 2], linhas[i + 3]].map(num);
    if (Math.abs(a - somaItens) < 0.02 && b >= 0 && Math.abs(a - b - c) < 0.02) {
      totalNota = a; desconto = b; pago = c; conferido = true; break;
    }
  }

  return {
    chave, numero, data, loja, cnpj, pagamento,
    itens, somaItens, totalNota, desconto: round2(desconto), pago: round2(pago),
    conferido
  };
}

// Extrai o texto do PDF no navegador com o pdf.js (window.pdfjsLib).
export async function textoDoPdf(arquivo) {
  const lib = window.pdfjsLib;
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const doc = await lib.getDocument({ data: dados }).promise;
  const partes = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pg = await doc.getPage(p);
    const tc = await pg.getTextContent();
    partes.push(tc.items.map(i => i.str + (i.hasEOL ? '\n' : ' ')).join(''));
  }
  return partes.join('\n');
}
