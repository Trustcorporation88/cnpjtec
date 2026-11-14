"use client";

import { useEffect, useState, type FormEvent } from "react";

const TRILHAS = new Set(["A_NANO", "B_PF_CONTRIBUINTE", "C_MEI_SERVICO", "D_MEI_REVENDA", "E_ME_EPP", "FORA_DO_ALCANCE"]);

export function Ajuda() {
  const [conta, setConta] = useState<{ telefone: string } | null>(null);
  const [disponivel, setDisponivel] = useState(true);
  const [pergunta, setPergunta] = useState("");
  const [telefone, setTelefone] = useState("");
  const [aceite, setAceite] = useState(false);
  const [trilhas, setTrilhas] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const t = (new URLSearchParams(location.search).get("trilhas") ?? "").split(",").filter((x) => TRILHAS.has(x));
    setTrilhas(t);
    fetch("/api/conta", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ disponivel: boolean; conta: { telefone: string } | null }>)
      .then((e) => {
        setDisponivel(e.disponivel);
        setConta(e.conta);
      })
      .catch(() => null);
  }, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (pergunta.trim().length < 5) return setErro("Escreva a sua dúvida.");
    if (!aceite) return setErro("Marque que concorda, para a gente poder responder.");
    setEnviando(true);
    const r = await fetch("/api/ajuda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pergunta, trilhas, aceite: true, ...(conta ? {} : { telefone }) }),
    }).catch(() => null);
    setEnviando(false);
    if (!r) return setErro("Sem conexão. Tente de novo.");
    if (!r.ok) {
      const c = (await r.json().catch(() => null)) as { detail?: string } | null;
      return setErro(c?.detail ?? "Não deu certo. Tente de novo.");
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="guia">
        <h1>Recebemos a sua dúvida</h1>
        <p className="resumo">Um contador vai ler e responder pelo WhatsApp. Normalmente em até dois dias úteis.</p>
      </div>
    );
  }

  return (
    <div className="guia">
      <h1>Pergunte a um contador</h1>
      <p className="resumo">
        Quando a regra não está clara ou o seu caso é diferente, uma pessoa de verdade olha e responde pelo WhatsApp.
      </p>
      {!disponivel ? (
        <p>O pedido de ajuda ainda não está disponível. Tente mais tarde.</p>
      ) : (
        <form className="pergunta" onSubmit={enviar} noValidate>
          <label className="campo-contato">
            <span>Sua dúvida</span>
            <textarea value={pergunta} onChange={(e) => setPergunta(e.target.value)} maxLength={2000} required />
          </label>
          {conta ? (
            <p>Vamos responder no WhatsApp da sua conta, final {conta.telefone.slice(-4)}.</p>
          ) : (
            <label className="campo-contato">
              <span>Seu WhatsApp com DDD</span>
              <input type="tel" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="14 99999 9999" />
            </label>
          )}
          <label className="aceite">
            <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
            <span>
              Concordo que o ProContador guarde a minha dúvida e o meu WhatsApp para responder. Não escreva senhas nem
              número de documento.
            </span>
          </label>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <div className="acoes">
            <button type="submit" className="principal" disabled={enviando}>{enviando ? "Enviando…" : "Enviar a dúvida"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
