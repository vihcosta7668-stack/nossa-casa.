// Rotina da casa: tarefas recorrentes com rodízio, água e registro do dia.

// Data local (fuso do aparelho) em AAAA-MM-DD.
export const diaLocal = (d = new Date()) => {
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};
export const somaDias = (dia, n) => { const d = new Date(dia + 'T12:00:00'); d.setDate(d.getDate() + n); return diaLocal(d); };
const entre = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);

export const FREQ = [['diaria', 'Todo dia'], ['semanal', 'Dias da semana'], ['intervalo', 'A cada N dias']];
export const MODOS = [['rodizio', 'Rodízio entre as pessoas'], ['fixo', 'Sempre a primeira pessoa'], ['qualquer', 'Qualquer uma das pessoas']];
export const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function ocorre(t, dia) {
  if (t.pausada) return false;
  if (t.inicio && dia < t.inicio) return false;
  const wd = new Date(dia + 'T12:00:00').getDay();
  if (t.freq === 'diaria') return true;
  if (t.freq === 'semanal') return (t.dias || []).includes(wd);
  if (t.freq === 'intervalo') return entre(t.inicio || dia, dia) % Math.max(1, +t.intervalo || 1) === 0;
  return false;
}

// Quantas vezes a tarefa já ocorreu antes deste dia (define de quem é a vez no rodízio).
function indiceOcorrencia(t, dia) {
  const ini = t.inicio || dia;
  const n = entre(ini, dia);
  if (t.freq === 'diaria') return n;
  if (t.freq === 'intervalo') return Math.floor(n / Math.max(1, +t.intervalo || 1));
  let c = 0;
  for (let i = 0; i < n; i++) if (ocorre(t, somaDias(ini, i))) c++;
  return c;
}

export function responsaveis(t, dia) {
  const ps = t.pessoas || [];
  if (!ps.length) return [];
  if (t.modo === 'rodizio') return [ps[indiceOcorrencia(t, dia) % ps.length]];
  if (t.modo === 'fixo') return [ps[0]];
  return [...ps];
}

const minutos = hhmm => { const [h, m] = (hhmm || '23:59').split(':').map(Number); return h * 60 + (m || 0); };

// Ocorrências de tarefas de hoje e pendências dos últimos dias.
export function agendaTarefas(tarefas, eventos, hoje = diaLocal(), agora = new Date(), diasAtras = 7) {
  const feitas = new Map();
  for (const e of eventos) if (e.tipo === 'tarefa') feitas.set(e.tarefaId + '|' + e.dia, e);
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  const lista = [];
  for (let k = diasAtras; k >= 0; k--) {
    const dia = somaDias(hoje, -k);
    for (const t of tarefas) {
      if (!ocorre(t, dia)) continue;
      const feito = feitas.get(t.id + '|' + dia) || null;
      if (k > 0 && feito) continue;                 // dias anteriores: só mostra o que ficou pendente
      const atrasada = !feito && (k > 0 || agoraMin > minutos(t.prazo));
      lista.push({ tarefa: t, dia, feito, atrasada, quem: responsaveis(t, dia), hoje: k === 0 });
    }
  }
  return lista;
}

// Meta de água (ml/dia): 35 ml por kg quando há peso; senão 2.000 ml. Pode ser definida na pessoa.
export function metaAgua(p) {
  if (+p.metaAgua > 0) return +p.metaAgua;
  if (+p.peso > 0) return Math.round((35 * +p.peso) / 50) * 50;
  return 2000;
}

export function aguaHoje(eventos, pessoaId, hoje = diaLocal()) {
  return eventos.filter(e => e.tipo === 'agua' && e.por === pessoaId && e.dia === hoje).reduce((s, e) => s + (+e.ml || 0), 0);
}

export function ultimoEvento(eventos, pessoaId, tipo) {
  return eventos.filter(e => e.por === pessoaId && (!tipo || e.tipo === tipo)).sort((a, b) => b.em.localeCompare(a.em))[0] || null;
}

// Tarefas iniciais da casa (editáveis no app).
export function tarefasIniciais(pessoas, hoje = diaLocal()) {
  const id = nome => pessoas.find(p => p.nome === nome)?.id;
  const sabado = (() => { let d = hoje; while (new Date(d + 'T12:00:00').getDay() !== 6) d = somaDias(d, 1); return d; })();
  return [
    { id: 't-banheiro1', nome: 'Lavar o banheiro 1', local: 'Banheiro de Vitoria e da mãe', freq: 'semanal', dias: [6], prazo: '18:00',
      modo: 'rodizio', pessoas: [id('Vitoria'), id('Mãe')].filter(Boolean), inicio: sabado },
    { id: 't-banheiro2', nome: 'Lavar o banheiro 2', local: 'Banheiro dos irmãos', freq: 'semanal', dias: [6], prazo: '18:00',
      modo: 'rodizio', pessoas: [id('Irmão do meio'), id('Irmão mais novo')].filter(Boolean), inicio: sabado },
    { id: 't-lixo', nome: 'Tirar o lixo', local: '', freq: 'diaria', dias: [], prazo: '20:00',
      modo: 'rodizio', pessoas: pessoas.map(p => p.id), inicio: hoje }
  ];
}
