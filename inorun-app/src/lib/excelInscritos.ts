// src/lib/excelInscritos.ts
// Gera a planilha Excel (.xlsx) dos inscritos: aba Resumo, aba Todos e uma aba por prova.
// O exceljs é carregado sob demanda (import dinâmico) para não pesar no site público.

import type { Worksheet } from 'exceljs';
import type { InscritoRow } from '../services/adminService';
import { formataCPF } from './validaCPF';

const STATUS_LABEL: Record<string, string> = {
  confirmado: 'Confirmado', em_analise: 'Em análise', pendente: 'Pendente', cancelado: 'Cancelado',
};
const STATUS_ORDEM = ['confirmado', 'em_analise', 'pendente', 'cancelado'];
const STATUS_COR: Record<string, string> = {
  Confirmado: 'FFE6F4EA', 'Em análise': 'FFFFF4D6', Pendente: 'FFFDE7E7', Cancelado: 'FFE5E7EB',
};
const PAG_LABEL: Record<string, string> = { criado: 'Aguardando', pago: 'Pago', falhou: 'Falhou', estornado: 'Estornado' };
const ROXO = 'FF4B2A7B';
const FONTE = 'Arial';

// Excel guarda datas sem fuso: montamos a data com os componentes do horário de Brasília
function dataHoraBR(iso?: string | null): Date | null {
  if (!iso) return null;
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso));
  const n = (t: string) => Number(p.find(x => x.type === t)?.value ?? 0);
  return new Date(Date.UTC(n('year'), n('month') - 1, n('day'), n('hour') % 24, n('minute')));
}

function dataSimples(ymd?: string | null): Date | null {
  if (!ymd) return null;
  const [a, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return a && m && d ? new Date(Date.UTC(a, m - 1, d)) : null;
}

const reais = (centavos?: number | null) => (centavos == null ? null : centavos / 100);

interface Coluna { titulo: string; largura: number; fmt?: string; centro?: boolean; valor: (i: InscritoRow) => unknown; }

const COLUNAS: Coluna[] = [
  { titulo: 'Nº peito',   largura: 9,  centro: true, valor: i => i.bib_number ?? null },
  { titulo: 'Nome',       largura: 38, valor: i => i.nome },
  { titulo: 'CPF',        largura: 16, centro: true, valor: i => (i.cpf ? formataCPF(i.cpf) : '') },
  { titulo: 'Nascimento', largura: 12, centro: true, fmt: 'dd/mm/yyyy', valor: i => dataSimples(i.nascimento) },
  { titulo: 'Sexo',       largura: 7,  centro: true, valor: i => i.sexo ?? '' },
  { titulo: 'E-mail',     largura: 32, valor: i => i.email ?? '' },
  { titulo: 'Telefone',   largura: 16, valor: i => i.telefone ?? '' },
  { titulo: 'Contato de emergência', largura: 26, valor: i => i.contato_emergencia ?? '' },
  { titulo: 'Prova',      largura: 18, valor: i => i.prova },
  { titulo: 'Categoria',  largura: 12, centro: true, valor: i => i.categoria },
  { titulo: 'Modelo camiseta', largura: 15, centro: true, valor: i => (!i.camiseta ? '' : i.camiseta_modelo === 'babylook' ? 'Baby Look' : 'Unissex') },
  { titulo: 'Tamanho',    largura: 9,  centro: true, valor: i => i.camiseta || 'Sem camiseta' },
  { titulo: 'Status',     largura: 12, centro: true, valor: i => STATUS_LABEL[i.status] ?? i.status },
  { titulo: 'Lote',       largura: 16, valor: i => i.lote ?? '' },
  { titulo: 'Cupom',      largura: 13, centro: true, valor: i => i.cupom ?? '' },
  { titulo: 'Grupo',      largura: 20, valor: i => i.grupo ?? '' },
  { titulo: 'Inscrição (R$)', largura: 14, fmt: '#,##0.00', valor: i => reais(i.valor_pago ?? i.preco_centavos) },
  { titulo: 'Taxa (R$)',  largura: 11, fmt: '#,##0.00', valor: i => reais(i.taxa_paga) },
  { titulo: 'Total (R$)', largura: 12, fmt: '#,##0.00', valor: () => null }, // fórmula: Inscrição + Taxa
  { titulo: 'Pagamento',  largura: 12, centro: true, valor: i => (i.pag_status ? PAG_LABEL[i.pag_status] ?? i.pag_status : '') },
  { titulo: 'Pago em',    largura: 16, centro: true, fmt: 'dd/mm/yyyy hh:mm', valor: i => dataHoraBR(i.paid_at) },
  { titulo: 'Check-in',   largura: 16, centro: true, fmt: 'dd/mm/yyyy hh:mm', valor: i => dataHoraBR(i.checked_in_at) },
  { titulo: 'Inscrito em', largura: 16, centro: true, fmt: 'dd/mm/yyyy hh:mm', valor: i => dataHoraBR(i.created_at) },
  { titulo: 'Comprovante', largura: 14, centro: true, valor: i => (i.comprovante_url ? { text: 'Abrir', hyperlink: i.comprovante_url } : '') },
];
const IDX = (titulo: string) => COLUNAS.findIndex(c => c.titulo === titulo) + 1;
const letra = (n: number) => String.fromCharCode(64 + n); // até 26 colunas

function preencherAba(ws: Worksheet, linhas: InscritoRow[]) {
  ws.columns = COLUNAS.map(c => ({ width: c.largura }));
  const cab = ws.addRow(COLUNAS.map(c => c.titulo));
  cab.height = 22;
  cab.eachCell(cell => {
    cell.font = { name: FONTE, bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROXO } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  const cInsc = letra(IDX('Inscrição (R$)')), cTaxa = letra(IDX('Taxa (R$)')), iTotal = IDX('Total (R$)'), iStatus = IDX('Status');
  linhas.forEach(i => {
    const row = ws.addRow(COLUNAS.map(c => c.valor(i)));
    const n = row.number;
    const insc = reais(i.valor_pago ?? i.preco_centavos) ?? 0, taxa = reais(i.taxa_paga) ?? 0;
    row.getCell(iTotal).value = { formula: `${cInsc}${n}+${cTaxa}${n}`, result: insc + taxa };
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const def = COLUNAS[col - 1];
      cell.font = { name: FONTE, size: 10 };
      if (def?.fmt) cell.numFmt = def.fmt;
      if (def?.centro) cell.alignment = { horizontal: 'center' };
    });
    const st = row.getCell(iStatus);
    const cor = STATUS_COR[String(st.value)];
    if (cor) st.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cor } };
    const comp = row.getCell(IDX('Comprovante'));
    if (comp.value) comp.font = { name: FONTE, size: 10, color: { argb: 'FF1D4ED8' }, underline: true };
  });

  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, linhas.length + 1), column: COLUNAS.length } };
}

const porNome = (a: InscritoRow, b: InscritoRow) => a.nome.localeCompare(b.nome, 'pt-BR');
const porStatusEPeito = (a: InscritoRow, b: InscritoRow) =>
  STATUS_ORDEM.indexOf(a.status) - STATUS_ORDEM.indexOf(b.status) ||
  (a.bib_number ?? 1e9) - (b.bib_number ?? 1e9) || porNome(a, b);

// Nome de aba do Excel: até 31 caracteres, sem \ / ? * [ ] :
const nomeAba = (s: string) => s.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);

export async function gerarExcelInscritos(inscritos: InscritoRow[]): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'INO RUN 2026';
  wb.created = new Date();

  const provas = [...new Map(inscritos.map(i => [i.prova, i.distancia])).entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([p]) => p);

  // ── Resumo (contagens por fórmula sobre a aba Todos) ──
  const rs = wb.addWorksheet('Resumo');
  rs.columns = [{ width: 24 }, ...STATUS_ORDEM.map(() => ({ width: 13 })), { width: 11 }];
  rs.addRow(['INO RUN 2026 — Inscritos']).getCell(1).font = { name: FONTE, bold: true, size: 14 };
  const emitido = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  rs.addRow([`Emitido em ${emitido} · ${inscritos.length} inscrições nesta planilha`]).getCell(1).font = { name: FONTE, italic: true, size: 9, color: { argb: 'FF666666' } };
  rs.addRow([]);
  const cab = rs.addRow(['Prova', ...STATUS_ORDEM.map(s => STATUS_LABEL[s]), 'Total']);
  cab.eachCell(cell => {
    cell.font = { name: FONTE, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROXO } };
    cell.alignment = { horizontal: 'center' };
  });
  const colProva = letra(IDX('Prova')), colStatus = letra(IDX('Status'));
  const fim = inscritos.length + 1;
  const primeira = cab.number + 1;
  provas.forEach(p => {
    const n = rs.rowCount + 1;
    const contagens = STATUS_ORDEM.map((s, k) => ({
      formula: `COUNTIFS(Todos!$${colProva}$2:$${colProva}$${fim},$A${n},Todos!$${colStatus}$2:$${colStatus}$${fim},${letra(k + 2)}$${cab.number})`,
      result: inscritos.filter(i => i.prova === p && i.status === s).length,
    }));
    rs.addRow([p, ...contagens, {
      formula: `SUM(B${n}:${letra(STATUS_ORDEM.length + 1)}${n})`,
      result: inscritos.filter(i => i.prova === p).length,
    }]);
  });
  const ultima = rs.rowCount;
  if (provas.length > 0) {
    const tot = rs.addRow(['Total', ...[...STATUS_ORDEM, 'total'].map((s, k) => ({
      formula: `SUM(${letra(k + 2)}${primeira}:${letra(k + 2)}${ultima})`,
      result: s === 'total' ? inscritos.length : inscritos.filter(i => i.status === s).length,
    }))]);
    tot.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE7F6' } }; });
    for (let r = primeira; r <= rs.rowCount; r++) {
      rs.getRow(r).eachCell((cell, col) => {
        cell.font = { name: FONTE, bold: r === rs.rowCount || col === 1 || col === STATUS_ORDEM.length + 2 };
        if (col > 1) cell.alignment = { horizontal: 'center' };
      });
    }
  }
  rs.addRow([]);
  rs.addRow(['Valores em reais. "Inscrição" já considera o cupom; "Total" = inscrição + taxa. Horários de Brasília.'])
    .getCell(1).font = { name: FONTE, italic: true, size: 9, color: { argb: 'FF666666' } };

  // ── Todos (ordem alfabética) e uma aba por prova (confirmados primeiro, por nº de peito) ──
  preencherAba(wb.addWorksheet('Todos'), [...inscritos].sort(porNome));
  provas.forEach(p => {
    preencherAba(wb.addWorksheet(nomeAba(p)), inscritos.filter(i => i.prova === p).sort(porStatusEPeito));
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
