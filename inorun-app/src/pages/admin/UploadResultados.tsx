// src/pages/admin/UploadResultados.tsx — tela de upload de resultados de corrida pelo organizador

import { useState } from 'react';
import { importarResultados, limparResultados } from '../../services/resultadosService';

interface UploadResultadosProps {
  onSucesso?: () => void;
}

export default function UploadResultados({ onSucesso }: UploadResultadosProps) {
  const [dadosPreview, setDadosPreview] = useState<any[]>([]);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Regra de teste prático: Gerador de dados fictícios para testar a importação de forma fácil
  const gerarDadosTeste = () => {
    const mockAtletas = [
      // ── Corrida 5 km (novas faixas v2) ──
      { tipo: 'corrida', colocacao_geral: 1, bib_number: 101, nome: 'Carlos Eduardo Santos',   sexo: 'M', distancia_km: 5, categoria: 'M 20-29', colocacao_categoria: 1, colocacao_sexo: 1, tempo_bruto: '00:16:45', tempo_liquido: '00:16:44', pace: '03:20' },
      { tipo: 'corrida', colocacao_geral: 2, bib_number: 120, nome: 'Juliana Maria de Souza',   sexo: 'F', distancia_km: 5, categoria: 'F 30-39', colocacao_categoria: 1, colocacao_sexo: 1, tempo_bruto: '00:18:12', tempo_liquido: '00:18:10', pace: '03:38' },
      { tipo: 'corrida', colocacao_geral: 3, bib_number: 105, nome: 'Marcos Paulo Costa',       sexo: 'M', distancia_km: 5, categoria: 'M 40-49', colocacao_categoria: 1, colocacao_sexo: 2, tempo_bruto: '00:19:30', tempo_liquido: '00:19:25', pace: '03:53' },
      { tipo: 'corrida', colocacao_geral: 4, bib_number: 118, nome: 'Ana Paula Ferreira',       sexo: 'F', distancia_km: 5, categoria: 'F Sub-20', colocacao_categoria: 1, colocacao_sexo: 2, tempo_bruto: '00:22:15', tempo_liquido: '00:22:10', pace: '04:26' },
      { tipo: 'corrida', colocacao_geral: 5, bib_number: 132, nome: 'José Roberto Alves',       sexo: 'M', distancia_km: 5, categoria: 'M 50+',   colocacao_categoria: 1, colocacao_sexo: 3, tempo_bruto: '00:25:10', tempo_liquido: '00:25:05', pace: '05:01' },
      // ── Corrida 10 km ──
      { tipo: 'corrida', colocacao_geral: 1, bib_number: 502, nome: 'Rodrigo Alencar Lima',     sexo: 'M', distancia_km: 10, categoria: 'M 30-39', colocacao_categoria: 1, colocacao_sexo: 1, tempo_bruto: '00:34:55', tempo_liquido: '00:34:52', pace: '03:29' },
      { tipo: 'corrida', colocacao_geral: 2, bib_number: 540, nome: 'Fernanda Cristina Ramos',  sexo: 'F', distancia_km: 10, categoria: 'F 40-49', colocacao_categoria: 1, colocacao_sexo: 1, tempo_bruto: '00:38:20', tempo_liquido: '00:38:18', pace: '03:49' },
      // ── Kids Geral ──
      { tipo: 'kids',    colocacao_geral: 1, bib_number: 201, nome: 'Miguell Souza Junior',     sexo: 'M', distancia_km: 5, categoria: 'Kids Geral', colocacao_categoria: 1, colocacao_sexo: 1, tempo_bruto: '00:32:10', tempo_liquido: '00:32:10', pace: '06:26' },
      { tipo: 'kids',    colocacao_geral: 2, bib_number: 205, nome: 'Sophia Lima Castro',        sexo: 'F', distancia_km: 5, categoria: 'Kids Geral', colocacao_categoria: 2, colocacao_sexo: 1, tempo_bruto: '00:34:50', tempo_liquido: '00:34:50', pace: '06:58' },
      // ── Caminhada ──
      { tipo: 'caminhada', colocacao_geral: 1, bib_number: 301, nome: 'Maria das Graças Oliveira', sexo: 'F', distancia_km: 5, categoria: 'Caminhada', colocacao_categoria: 1, colocacao_sexo: 1, tempo_bruto: '01:05:00', tempo_liquido: '01:05:00', pace: '13:00' },
    ];
    setDadosPreview(mockAtletas);
    setNomeArquivo('dados_teste_ficticios.csv (Gerado Automaticamente)');
    setMensagem({ tipo: 'sucesso', texto: 'Dados de teste gerados (categorias v2: Sub-20, 20-29, 30-39, 40-49, 50+, Kids Geral, Caminhada). Clique em "Salvar Resultados no Banco" para testar.' });
  };

  // Processa o arquivo CSV carregado
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNomeArquivo(file.name);
    setMensagem(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split('\n').map(row => row.trim()).filter(Boolean);
        
        if (rows.length < 2) {
          throw new Error('O arquivo CSV deve conter um cabeçalho e pelo menos uma linha de dados.');
        }

        // Detecta separador (vírgula ou ponto e vírgula)
        const headerLine = rows[0];
        const separator = headerLine.includes(';') ? ';' : ',';
        const headers = headerLine.split(separator).map(h => h.trim().toLowerCase().replace(/"/g, ''));

        const mapeamentoCampos: Record<string, string> = {
          'colocacao_geral': 'colocacao_geral',
          'classificacao_geral': 'colocacao_geral',
          'ranking_geral': 'colocacao_geral',
          'colocacao geral': 'colocacao_geral',
          'posicao': 'colocacao_geral',
          'bib_number': 'bib_number',
          'dorsal': 'bib_number',
          'numero': 'bib_number',
          'bib': 'bib_number',
          'nome': 'nome',
          'nome_atleta': 'nome',
          'atleta': 'nome',
          'sexo': 'sexo',
          'genero': 'sexo',
          'distancia_km': 'distancia_km',
          'distancia': 'distancia_km',
          'km': 'distancia_km',
          'categoria': 'categoria',
          'faixa': 'categoria',
          'colocacao_categoria': 'colocacao_categoria',
          'classificacao_categoria': 'colocacao_categoria',
          'colocacao_sexo': 'colocacao_sexo',
          'classificacao_sexo': 'colocacao_sexo',
          'tempo_bruto': 'tempo_bruto',
          'tempo bruto': 'tempo_bruto',
          'bruto': 'tempo_bruto',
          'tempo_liquido': 'tempo_liquido',
          'tempo liquido': 'tempo_liquido',
          'liquido': 'tempo_liquido',
          'tempo': 'tempo_liquido',
          'pace': 'pace',
          'ritmo': 'pace',
        };

        const parsedData: any[] = [];

        for (let i = 1; i < rows.length; i++) {
          const cells = rows[i].split(separator).map(c => c.trim().replace(/"/g, ''));
          if (cells.length < headers.length) continue;

          const rowObj: any = {};
          headers.forEach((header, index) => {
            const field = mapeamentoCampos[header];
            if (field) {
              const val = cells[index];
              if (field === 'bib_number' || field === 'colocacao_geral' || field === 'colocacao_sexo' || field === 'colocacao_categoria') {
                rowObj[field] = parseInt(val, 10) || 0;
              } else if (field === 'distancia_km') {
                rowObj[field] = parseFloat(val.replace(',', '.')) || 0;
              } else if (field === 'sexo') {
                rowObj[field] = val.toUpperCase().substring(0, 1);
              } else {
                rowObj[field] = val;
              }
            }
          });

          // Validação básica de campos obrigatórios
          if (rowObj.bib_number && rowObj.nome && rowObj.tempo_liquido) {
            parsedData.push(rowObj);
          }
        }

        if (parsedData.length === 0) {
          throw new Error('Nenhuma linha de resultado válida encontrada. Verifique se o cabeçalho corresponde ao modelo esperado.');
        }

        setDadosPreview(parsedData);
        setMensagem({ tipo: 'sucesso', texto: `${parsedData.length} resultados lidos do CSV com sucesso! Verifique a tabela abaixo e confirme.` });
      } catch (err: any) {
        setMensagem({ tipo: 'erro', texto: `Erro ao processar CSV: ${err.message}` });
        setDadosPreview([]);
      }
    };

    reader.readAsText(file, 'UTF-8');
  };

  // Envia os resultados processados para o banco de dados
  const salvarResultados = async () => {
    if (dadosPreview.length === 0) return;

    setCarregando(true);
    setMensagem(null);

    const payload = dadosPreview.map(d => ({
      bib_number:          d.bib_number,
      nome:                d.nome,
      // Kids e Caminhada podem ter sexo null (não é campo competitivo)
      sexo:                d.sexo || null,
      distancia_km:        d.distancia_km || 5,
      categoria:           d.categoria || 'Geral',
      // tipo v2: corrida | kids | caminhada
      tipo:                d.tipo || 'corrida',
      tempo_bruto:         d.tempo_bruto || d.tempo_liquido,
      tempo_liquido:       d.tempo_liquido,
      pace:                d.pace || '',
      // Kids e Caminhada não têm colocação geral competitiva
      colocacao_geral:     d.tipo === 'kids' || d.tipo === 'caminhada' ? null : (d.colocacao_geral || 0),
      colocacao_sexo:      d.tipo === 'kids' || d.tipo === 'caminhada' ? null : (d.colocacao_sexo || 0),
      colocacao_categoria: d.colocacao_categoria || 0,
    }));

    const result = await importarResultados(payload);
    setCarregando(false);

    if (result.ok) {
      setMensagem({ tipo: 'sucesso', texto: `Sucesso! ${result.importados} resultados foram salvos no banco de dados e já estão disponíveis no site.` });
      setDadosPreview([]);
      setNomeArquivo('');
      if (onSucesso) onSucesso();
    } else {
      setMensagem({ tipo: 'erro', texto: `Erro ao salvar resultados: ${result.erro}` });
    }
  };

  // Limpa todos os resultados atuais do banco
  const handleLimparBanco = async () => {
    if (!window.confirm('ATENÇÃO: Isso irá apagar TODOS os resultados cadastrados no banco de dados. Tem certeza de que deseja continuar?')) {
      return;
    }

    setCarregando(true);
    const res = await limparResultados();
    setCarregando(false);

    if (res.ok) {
      setMensagem({ tipo: 'sucesso', texto: 'Todos os resultados foram removidos do banco de dados com sucesso.' });
      setDadosPreview([]);
      setNomeArquivo('');
      if (onSucesso) onSucesso();
    } else {
      setMensagem({ tipo: 'erro', texto: `Erro ao limpar banco de dados: ${res.erro}` });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* ── Regra de Tela: Bloco informativo de Objetivos e Instruções ── */}
      <div className="bg-white border border-brand-lilac-mid rounded-2xl p-5 shadow-sm">
        <h2 className="font-display font-extrabold italic uppercase text-[18px] text-brand-purple-dark mb-2">
          🎯 Objetivo e Instruções da Tela de Resultados
        </h2>
        <div className="text-[14px] text-brand-muted space-y-2 leading-relaxed">
          <p>
            <strong>Objetivo:</strong> Esta funcionalidade permite ao organizador importar e gerenciar a planilha oficial de classificação dos atletas da <strong>INO RUN 2026</strong>. Uma vez salvos, os dados ficam instantaneamente disponíveis na busca e classificação do site público.
          </p>
          <p>
            <strong>Instruções de Importação:</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>O arquivo de importação deve estar no formato <strong>CSV</strong> (separado por vírgula ou ponto-e-vírgula).</li>
            <li>O cabeçalho do arquivo deve conter as colunas equivalentes aos dados da corrida:
              <code className="bg-brand-bg px-1.5 py-0.5 rounded text-brand-purple text-xs ml-1 font-mono font-bold">
                tipo, bib, nome, sexo, distancia, categoria, tempo_bruto, tempo_liquido, pace, colocacao_geral, colocacao_sexo, colocacao_categoria
              </code>
            </li>
            <li>Coluna <strong>tipo</strong>: use <code className="font-mono text-xs">corrida</code>, <code className="font-mono text-xs">kids</code> ou <code className="font-mono text-xs">caminhada</code>.</li>
            <li><strong>Categorias v2:</strong> Sub-20 (13-19), 20-29, 30-39, 40-49, 50+ · Especiais: <em>Kids Geral</em> e <em>Caminhada</em>.</li>
            <li>Kids e Caminhada <strong>não entram no ranking geral</strong> de corrida (colocacao_geral fica nula).</li>
            <li>Colunas essenciais: <strong>tipo</strong>, <strong>dorsal/bib</strong>, <strong>nome</strong> e <strong>tempo_liquido</strong>.</li>
            <li>Para substituir resultados anteriores por planilha corrigida, use o botão <strong>"Limpar Banco de Dados"</strong> antes de enviar.</li>
          </ul>
        </div>
      </div>

      {/* ── Painel de Upload e Ações ── */}
      <div className="card p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display font-extrabold italic uppercase text-[20px] text-brand-ink">
              Importar Resultados da Prova
            </h3>
            <p className="text-sm text-brand-muted mt-1">Carregue a planilha CSV gerada pela equipe de cronometragem</p>
          </div>
          
          {/* Ação de Teste Rápido (Regra de Teste Prático) */}
          <button 
            type="button" 
            onClick={gerarDadosTeste}
            className="btn-ghost text-xs text-brand-purple border border-brand-purple hover:bg-brand-lilac"
          >
            🧪 Gerar Dados Fictícios de Teste
          </button>
        </div>

        {/* Input de Arquivo */}
        <div className="border-2 border-dashed border-brand-lilac-mid hover:border-brand-purple rounded-2xl p-8 text-center transition-colors">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            id="csv-file-picker"
            className="hidden"
          />
          <label htmlFor="csv-file-picker" className="cursor-pointer space-y-2 block">
            <span className="text-4xl block">📊</span>
            <span className="block font-semibold text-brand-ink hover:text-brand-purple">
              {nomeArquivo ? 'Substituir arquivo selecionado' : 'Clique para selecionar arquivo CSV'}
            </span>
            <span className="block text-xs text-brand-muted">
              {nomeArquivo ? `Arquivo atual: ${nomeArquivo}` : 'Formatos aceitos: .csv (separado por vírgula ou ponto-e-vírgula)'}
            </span>
          </label>
        </div>

        {/* Mensagens de Feedback */}
        {mensagem && (
          <div className={`p-4 rounded-xl text-sm ${mensagem.tipo === 'sucesso' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {mensagem.texto}
          </div>
        )}

        {/* Botões de Confirmação e Limpeza */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={salvarResultados}
            disabled={dadosPreview.length === 0 || carregando}
            className={`btn-primary px-6 py-3 text-sm ${dadosPreview.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {carregando ? 'Processando...' : 'Salvar Resultados no Banco'}
          </button>

          <button
            type="button"
            onClick={handleLimparBanco}
            disabled={carregando}
            className="text-sm font-semibold text-red-600 hover:text-red-800 transition-colors border border-red-200 rounded-xl px-4 py-2.5 hover:bg-red-50"
          >
            🗑️ Limpar Banco de Dados
          </button>
        </div>
      </div>

      {/* ── Pré-visualização dos Dados antes de Salvar ── */}
      {dadosPreview.length > 0 && (
        <div className="card p-6 overflow-hidden space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-display font-extrabold italic uppercase text-[16px] text-brand-ink">
              Visualização dos Dados ({dadosPreview.length} linhas)
            </h4>
            <span className="text-xs text-brand-muted">Os dados abaixo ainda NÃO estão salvos no banco. Confirme acima para salvar.</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-brand-lilac-mid">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-brand-lilac text-brand-purple font-display font-bold uppercase border-b border-brand-lilac-mid">
                  <th className="p-3">Geral</th>
                  <th className="p-3">Bib</th>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Sexo</th>
                  <th className="p-3">Prova</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Pos Cat</th>
                  <th className="p-3">Bruto</th>
                  <th className="p-3">Líquido</th>
                  <th className="p-3">Pace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-lilac-mid bg-white">
                {dadosPreview.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="hover:bg-brand-bg transition-colors">
                    <td className="p-3 font-semibold text-brand-ink">{row.colocacao_geral || '-'}</td>
                    <td className="p-3">{row.bib_number || '-'}</td>
                    <td className="p-3 font-medium text-brand-ink">{row.nome || '-'}</td>
                    <td className="p-3">{row.sexo || '-'}</td>
                    <td className="p-3 font-semibold text-brand-purple">{row.distancia_km ? `${row.distancia_km}K` : '-'}</td>
                    <td className="p-3">{row.categoria || '-'}</td>
                    <td className="p-3">{row.colocacao_categoria || '-'}</td>
                    <td className="p-3">{row.tempo_bruto || '-'}</td>
                    <td className="p-3 font-semibold text-brand-purple">{row.tempo_liquido || '-'}</td>
                    <td className="p-3">{row.pace || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {dadosPreview.length > 10 && (
            <p className="text-xs text-brand-muted text-right italic">Mostrando as primeiras 10 linhas das {dadosPreview.length} lidas...</p>
          )}
        </div>
      )}
    </div>
  );
}
