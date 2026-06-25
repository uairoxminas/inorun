// src/components/PixPaymentScreen.tsx
// Tela de pagamento Pix — chave CNPJ, instrucoes, upload e verificacao Gemini
// Beneficiaria: ANA CRISTINA CORREA GOMES — CNPJ: 51.950.403/0001-32

import { useState, useRef } from "react";
import { verificarComprovantePix } from "../services/inscricaoService";
import type { ResultadoInscricao } from "../services/inscricaoService";

const PIX_KEY         = "51950403000132";
const PIX_KEY_DISPLAY = "51.950.403/0001-32";
const PIX_NOME        = "ANA CRISTINA CORREA GOMES";

interface Props {
  registration_id: string;
  valor_total: number;
  valor_inscricao: number;
  taxa: number;
  atleta_nome: string;
  atleta_email: string;
  prova_label: string;
  categoria: string;
  onConfirmado: (resultado: ResultadoInscricao) => void;
}

function fmt(c: number) {
  return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PixPaymentScreen({
  registration_id, valor_total, valor_inscricao, taxa,
  atleta_nome, atleta_email, prova_label, categoria, onConfirmado,
}: Props) {
  const [copiado, setCopiado]     = useState(false);
  const [arquivo, setArquivo]     = useState<File | null>(null);
  const [preview, setPreview]     = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [erro, setErro]           = useState("");
  const [rejeitado, setRejeitado] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const copiarChave = async () => {
    await navigator.clipboard.writeText(PIX_KEY);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  const handleArquivo = (file: File) => {
    if (file.size > 5 * 1024 * 1024) { setErro("Arquivo muito grande. Maximo 5 MB."); return; }
    if (!["image/jpeg","image/png","image/webp","application/pdf"].includes(file.type)) {
      setErro("Formato invalido. Use JPG, PNG, WEBP ou PDF."); return;
    }
    setErro(""); setRejeitado(""); setArquivo(file);
    if (file.type !== "application/pdf") {
      const reader = new FileReader();
      reader.onload = e => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else { setPreview("pdf"); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleArquivo(file);
  };

  const enviarComprovante = async () => {
    if (!arquivo) { setErro("Selecione o comprovante antes de enviar."); return; }
    setLoading(true); setErro(""); setRejeitado("");
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(arquivo);
      });
      const resultado = await verificarComprovantePix(
        registration_id, valor_total, atleta_email, atleta_nome,
        prova_label, categoria, base64, arquivo.type
      );
      if (resultado.aprovado && resultado.bib_number) {
        onConfirmado({
          registration_id, bib_number: resultado.bib_number, categoria,
          atleta_nome, prova_label, valor_centavos: valor_total, metodo: "pix", status: "confirmado",
        });
      } else {
        setRejeitado(resultado.motivo || "Comprovante nao aprovado. Verifique e tente novamente.");
      }
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro inesperado. Tente novamente.");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      {/* Valor destaque */}
      <div className="bg-gradient-to-br from-brand-purple to-brand-purple-dark rounded-2xl p-6 text-white text-center shadow-lg">
        <div className="text-[12px] font-bold uppercase tracking-widest opacity-75 mb-1">Total a pagar via Pix</div>
        <div className="font-display font-extrabold text-[44px] leading-none">{fmt(valor_total)}</div>
        <div className="text-[12px] opacity-65 mt-2">
          Inscricao {fmt(valor_inscricao)} + Taxa INO RUN {fmt(taxa)}
        </div>
      </div>

      {/* Chave Pix */}
      <div className="bg-brand-lilac border border-brand-lilac-mid rounded-2xl p-5">
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand-muted mb-3">Chave Pix (CNPJ)</div>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 bg-white border-2 border-brand-purple-mid rounded-xl px-4 py-3 font-mono text-[16px] font-bold text-brand-purple-dark tracking-wider select-all">
            {PIX_KEY_DISPLAY}
          </div>
          <button id="btn-copiar-pix" onClick={copiarChave}
            className={`px-4 py-3 rounded-xl font-bold text-[13px] transition-all duration-200 min-w-[90px]
              ${copiado ? "bg-green-500 text-white" : "bg-brand-purple text-white hover:bg-brand-purple-dark"}`}>
            {copiado ? "Copiado!" : "Copiar"}
          </button>
        </div>
        <div className="text-[12px] text-brand-muted">
          Beneficiaria: <strong className="text-brand-ink">{PIX_NOME}</strong>
        </div>
      </div>

      {/* Instrucoes */}
      <div className="bg-white border border-brand-lilac-mid rounded-2xl p-5">
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand-muted mb-4">Como pagar</div>
        <ol className="space-y-3">
          {[
            "Abra o app do seu banco e acesse a area Pix",
            `Cole a chave acima (CNPJ: ${PIX_KEY_DISPLAY}) no campo Chave Pix`,
            `Confirme: beneficiaria ${PIX_NOME} e valor ${fmt(valor_total)}`,
            "Finalize o pagamento e salve o comprovante (print ou PDF)",
            "Faca o upload do comprovante abaixo para confirmar sua inscricao",
          ].map((txt, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-brand-purple text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-[13px] text-brand-ink leading-relaxed">{txt}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Upload comprovante */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand-muted mb-3">Comprovante de pagamento</div>
        <div
          onDrop={handleDrop} onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-brand-lilac-mid rounded-2xl p-6 text-center cursor-pointer hover:border-brand-purple transition-colors group"
        >
          {preview && preview !== "pdf" ? (
            <img src={preview} alt="Comprovante" className="max-h-52 mx-auto rounded-xl object-contain" />
          ) : preview === "pdf" ? (
            <div className="text-5xl mb-2">📄</div>
          ) : (
            <div className="text-brand-muted group-hover:text-brand-purple transition-colors">
              <div className="text-4xl mb-2">📸</div>
              <div className="text-[14px] font-semibold">Arraste ou clique para selecionar</div>
              <div className="text-[12px] mt-1">JPG, PNG, WEBP ou PDF — max. 5 MB</div>
            </div>
          )}
          {arquivo && (
            <div className="mt-3 text-[12px] text-brand-muted">
              {arquivo.name} ({(arquivo.size / 1024).toFixed(0)} KB)
            </div>
          )}
        </div>
        <input ref={inputRef} type="file" className="hidden"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleArquivo(f); }} />
      </div>

      {/* Erro / Rejeicao */}
      {erro && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 text-[13px] text-red-600">
          Erro: {erro}
        </div>
      )}
      {rejeitado && (
        <div className="bg-orange-50 border border-orange-300 rounded-xl px-4 py-3 text-[13px] text-orange-700">
          <strong>Comprovante nao aprovado:</strong><br />{rejeitado}
          <div className="text-[12px] mt-1 text-orange-600">Verifique o valor e o beneficiario e tente novamente.</div>
        </div>
      )}

      {/* Botao enviar */}
      <button id="btn-enviar-comprovante" onClick={enviarComprovante}
        disabled={!arquivo || loading}
        className="w-full py-4 rounded-2xl font-display font-extrabold italic uppercase text-[17px]
          bg-brand-purple text-white hover:bg-brand-purple-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-md">
        {loading ? "Analisando comprovante..." : "Enviar comprovante e confirmar inscricao"}
      </button>
      {loading && (
        <p className="text-center text-[12px] text-brand-muted animate-pulse">
          Nossa IA esta verificando seu comprovante. Aguarde alguns segundos...
        </p>
      )}
    </div>
  );
}
