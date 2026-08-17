// src/components/MetaPixelInfoCard.tsx
// Componente de Objetivos, Instruções e Painel de Testes do Meta Pixel & Conversions API (CAPI)

import { useState } from 'react';
import { META_PIXEL_ID, META_CAPI_TOKEN, trackMetaEvent } from '../lib/metaPixel';

export default function MetaPixelInfoCard() {
  const [testLog, setTestLog] = useState<Array<{ id: number; text: string; status: 'pending' | 'success' | 'error' }>>([]);
  const [loadingEvent, setLoadingEvent] = useState<string | null>(null);

  const addLog = (text: string, status: 'pending' | 'success' | 'error') => {
    setTestLog(prev => [{ id: Date.now(), text, status }, ...prev.slice(0, 15)]);
  };

  const handleDispararTeste = async (eventName: string, sampleCustomData: any) => {
    setLoadingEvent(eventName);
    addLog(`Enviando evento de teste '${eventName}'...`, 'pending');

    try {
      const res = await trackMetaEvent(
        eventName,
        sampleCustomData,
        {
          em: 'teste.atleta@inorun.com.br',
          ph: '31999999999',
          fn: 'Atleta',
          ln: 'Teste',
        },
        `test_${eventName}_${Date.now()}`
      );

      if (res.success) {
        addLog(
          `✅ Evento '${eventName}' enviado! (ID: ${res.eventId}) | Pixel: Sim | CAPI: ${res.capiResponse ? 'OK (200)' : 'N/A'}`,
          'success'
        );
      } else {
        addLog(`⚠️ Evento '${eventName}' enviado para Pixel, mas CAPI deu erro: ${res.error}`, 'error');
      }
    } catch (err: any) {
      addLog(`❌ Erro ao enviar evento de teste: ${err?.message || err}`, 'error');
    } finally {
      setLoadingEvent(null);
    }
  };

  return (
    <div className="bg-white border border-brand-lilac-mid rounded-2xl p-6 shadow-sm mb-8 text-brand-ink">
      {/* Header do Card */}
      <div className="flex items-center justify-between border-b border-brand-lilac-mid pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold text-xl">
            📊
          </div>
          <div>
            <h3 className="font-display font-bold italic text-lg text-brand-purple">
              Meta Pixel & Conversions API (Meta Ads)
            </h3>
            <p className="text-xs text-brand-muted">
              Rastreamento de campanhas para agência de tráfego (Client-side & Server-side CAPI)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Ativo
          </span>
        </div>
      </div>

      {/* 🎯 Objetivos & Informações */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-brand-bg/60 p-4 rounded-xl border border-brand-lilac-mid">
          <h4 className="font-bold text-sm text-brand-purple-dark flex items-center gap-1.5 mb-2">
            🎯 Objetivos do Rastreamento
          </h4>
          <ul className="text-xs space-y-1.5 text-brand-muted">
            <li>• <strong>Mensurar conversões</strong> de anúncios no Meta Ads (Facebook e Instagram).</li>
            <li>• <strong>Rastrear o funil completo</strong>: PageView → ViewContent → InitiateCheckout → Lead → Purchase.</li>
            <li>• <strong>Deduplicação de eventos</strong> via <code className="bg-purple-100 text-purple-800 px-1 rounded text-[11px]">event_id</code> único entre Browser e CAPI.</li>
            <li>• <strong>Garantir 100% de rastreabilidade</strong> contornando bloqueadores (AdBlock) e restrições iOS 14.5+.</li>
          </ul>
        </div>

        <div className="bg-brand-bg/60 p-4 rounded-xl border border-brand-lilac-mid">
          <h4 className="font-bold text-sm text-brand-purple-dark flex items-center gap-1.5 mb-2">
            🔑 Credenciais & Parâmetros
          </h4>
          <div className="text-xs space-y-2 text-brand-muted">
            <div>
              <span className="font-semibold text-brand-ink">Pixel ID:</span>
              <code className="ml-2 font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-800 font-bold">
                {META_PIXEL_ID}
              </code>
            </div>
            <div>
              <span className="font-semibold text-brand-ink">Conversions API Token (CAPI):</span>
              <span className="ml-2 text-green-700 font-semibold font-mono text-[11px] truncate inline-block max-w-[200px] align-bottom">
                {META_CAPI_TOKEN ? `${META_CAPI_TOKEN.substring(0, 20)}...` : 'Não configurado'}
              </span>
            </div>
            <div>
              <span className="font-semibold text-brand-ink">Moeda Padrão:</span>
              <span className="ml-2 text-brand-ink font-medium">BRL (R$)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 📖 Instruções de Verificação */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 mb-6 text-xs text-blue-950">
        <h4 className="font-bold text-sm text-blue-900 mb-1 flex items-center gap-1.5">
          ℹ️ Instruções para a Agência de Tráfego
        </h4>
        <p className="mb-2">
          Para verificar a saúde do rastreamento e conferir os dados no <strong>Gerenciador de Eventos da Meta</strong>:
        </p>
        <ol className="list-decimal pl-4 space-y-1 text-blue-900/90">
          <li>Instale a extensão de navegador <strong>Meta Pixel Helper</strong> no Google Chrome para testar disparos no navegador.</li>
          <li>Acesse o <strong>Gerenciador de Eventos Meta</strong> → Selecione o Pixel <code className="font-mono bg-blue-100 text-blue-950 px-1 rounded">{META_PIXEL_ID}</code> → Aba <em>"Testar Eventos"</em>.</li>
          <li>Use os botões de teste prático abaixo para disparar qualquer evento do funil e verificar a recepção simultânea via Browser e CAPI com deduplicação.</li>
        </ol>
      </div>

      {/* 🧪 Ferramenta de Teste Prático */}
      <div className="bg-brand-lilac/30 border border-brand-lilac-mid rounded-xl p-4">
        <h4 className="font-bold text-sm text-brand-purple mb-3 flex items-center justify-between">
          <span>🧪 Testador Prático de Disparo de Eventos em Tempo Real</span>
          <span className="text-[11px] font-normal text-brand-muted">Clique nos botões para disparar</span>
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <button
            onClick={() => handleDispararTeste('PageView', { page: window.location.pathname })}
            disabled={!!loadingEvent}
            className="px-3 py-2 bg-white border border-brand-lilac-mid hover:border-brand-purple hover:bg-brand-lilac text-brand-purple font-semibold text-xs rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5"
          >
            {loadingEvent === 'PageView' ? '⏳ Enviando...' : '👁️ PageView'}
          </button>

          <button
            onClick={() => handleDispararTeste('ViewContent', { content_name: 'INO RUN 2026 5K/10K', value: 89, currency: 'BRL' })}
            disabled={!!loadingEvent}
            className="px-3 py-2 bg-white border border-brand-lilac-mid hover:border-brand-purple hover:bg-brand-lilac text-brand-purple font-semibold text-xs rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5"
          >
            {loadingEvent === 'ViewContent' ? '⏳ Enviando...' : '📄 ViewContent'}
          </button>

          <button
            onClick={() => handleDispararTeste('InitiateCheckout', { content_name: 'Inscrição 5 km', value: 89, currency: 'BRL' })}
            disabled={!!loadingEvent}
            className="px-3 py-2 bg-white border border-brand-lilac-mid hover:border-brand-purple hover:bg-brand-lilac text-brand-purple font-semibold text-xs rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5"
          >
            {loadingEvent === 'InitiateCheckout' ? '⏳ Enviando...' : '🛒 InitiateCheckout'}
          </button>

          <button
            onClick={() => handleDispararTeste('Purchase', { value: 89, currency: 'BRL', content_name: 'Inscrição Corrida 5K - INO RUN' })}
            disabled={!!loadingEvent}
            className="px-3 py-2 bg-green-600 text-white font-semibold text-xs rounded-lg hover:bg-green-700 transition-all shadow-sm flex items-center justify-center gap-1.5"
          >
            {loadingEvent === 'Purchase' ? '⏳ Enviando...' : '💰 Purchase (Pix)'}
          </button>
        </div>

        {/* Console / Log de Saída dos Testes */}
        {testLog.length > 0 && (
          <div className="mt-3 bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono max-h-40 overflow-y-auto space-y-1 border border-gray-800">
            <div className="text-[10px] text-gray-400 font-sans font-bold uppercase tracking-wider pb-1 border-b border-gray-800 flex justify-between">
              <span>Log de Execução em Tempo Real</span>
              <button onClick={() => setTestLog([])} className="hover:text-white underline">Limpar</button>
            </div>
            {testLog.map(item => (
              <div
                key={item.id}
                className={
                  item.status === 'success'
                    ? 'text-green-400'
                    : item.status === 'error'
                    ? 'text-red-400'
                    : 'text-yellow-300 animate-pulse'
                }
              >
                {item.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
