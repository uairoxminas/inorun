// Service de Integração Meta Pixel & Conversions API (CAPI) - INO RUN 2026

export const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || '383670455492739';
export const META_CAPI_TOKEN = import.meta.env.VITE_META_CONVERSIONS_API_TOKEN || 'EAAZATJ2u4T0ABSBCtGn1iXObStNBJ1cHpZCuSBvrw5chiXbD7V3b8WbvIYVnOpaYsSM0x5cwzqUlZAYznALgrtqgErRsqsqZBi7MQA223drHtYMdQDqe9brjt9zeZCyu0SyHQDkpaprZCS57JBqyTWeJ7Lr1Y0Rq4K9DOXGFXVRyfK3iCd1ILLurfQJw7IdQZDZD';

declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
  }
}

/**
 * Inicializa o script do Meta Pixel dinamicamente no navegador
 */
export function initMetaPixel(): void {
  if (typeof window === 'undefined') return;

  if (!window.fbq) {
    const fbq: any = function () {
      if (fbq.callMethod) {
        fbq.callMethod.apply(fbq, arguments);
      } else {
        fbq.queue.push(arguments);
      }
    };
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = fbq;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }

  try {
    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');
  } catch (err) {
    console.warn('[MetaPixel] Erro ao inicializar fbq:', err);
  }
}

export interface MetaEventUserData {
  em?: string; // Email
  ph?: string; // Telefone
  fn?: string; // Primeironome
  ln?: string; // Sobrenome
  external_id?: string; // CPF ou User ID
}

export interface MetaEventCustomData {
  currency?: string;
  value?: number;
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  contents?: Array<{ id: string; quantity: number }>;
  num_items?: number;
  [key: string]: any;
}

/**
 * Dispara evento tanto no Meta Pixel (Browser) quanto na Meta Conversions API (CAPI)
 * gerando um event_id único para deduplicação dos eventos no Gerenciador de Eventos Meta.
 */
export async function trackMetaEvent(
  eventName: string,
  customData: MetaEventCustomData = {},
  userData: MetaEventUserData = {},
  customEventId?: string
): Promise<{ success: boolean; eventId: string; capiResponse?: any; error?: string }> {
  const eventId = customEventId || `inorun_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const eventTime = Math.floor(Date.now() / 1000);

  // 1. Disparo Client-side (Meta Pixel via Window.fbq)
  if (typeof window !== 'undefined' && window.fbq) {
    try {
      window.fbq('track', eventName, customData, { eventID: eventId });
      console.log(`[MetaPixel] Evento '${eventName}' disparado no browser (eventID: ${eventId})`, customData);
    } catch (err) {
      console.warn(`[MetaPixel] Erro no disparo browser do evento '${eventName}':`, err);
    }
  }

  // 2. Disparo Server-side Híbrido / Direct CAPI (Conversions API)
  let capiResult: any = null;
  let success = true;
  let errorMessage: string | undefined;

  if (META_CAPI_TOKEN) {
    try {
      const payload = {
        data: [
          {
            event_name: eventName,
            event_time: eventTime,
            event_id: eventId,
            event_source_url: typeof window !== 'undefined' ? window.location.href : 'https://inorun.com.br',
            action_source: 'website',
            user_data: {
              client_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
              ...(userData.em ? { em: [await hashData(userData.em)] } : {}),
              ...(userData.ph ? { ph: [await hashData(userData.ph.replace(/\D/g, ''))] } : {}),
              ...(userData.fn ? { fn: [await hashData(userData.fn.toLowerCase())] } : {}),
              ...(userData.ln ? { ln: [await hashData(userData.ln.toLowerCase())] } : {}),
              ...(userData.external_id ? { external_id: [await hashData(userData.external_id)] } : {}),
            },
            custom_data: {
              currency: customData.currency || 'BRL',
              ...customData,
            },
          },
        ],
      };

      const endpoint = `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${META_CAPI_TOKEN}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      capiResult = await response.json();
      if (!response.ok) {
        console.warn('[MetaCAPI] Resposta com erro da Graph API Meta:', capiResult);
        errorMessage = capiResult?.error?.message || 'Erro ao enviar para CAPI';
      } else {
        console.log(`[MetaCAPI] Evento '${eventName}' enviado com sucesso via Conversions API!`, capiResult);
      }
    } catch (err: any) {
      console.warn('[MetaCAPI] Exceção no envio CAPI:', err);
      errorMessage = err?.message || 'Falha na requisição CAPI';
      success = false;
    }
  }

  return {
    success,
    eventId,
    capiResponse: capiResult,
    error: errorMessage,
  };
}

/**
 * Função utilitária SHA-256 para hashing de dados sensíveis exigidos pelo Meta CAPI
 */
async function hashData(value: string): Promise<string> {
  const cleanValue = value.trim().toLowerCase();
  if (!cleanValue) return '';
  
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(cleanValue);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return cleanValue;
}
