"use client";

import { useEffect, useState, type FormEvent } from "react";
import { medir } from "@/lib/medir";

interface EstadoDaConta {
  disponivel: boolean;
  consentimento?: string;
  conta: { telefone: string } | null;
}

function destinoSeguro(voltar: string | null): string {
  return voltar && /^\/[A-Za-z0-9/_-]*$/.test(voltar) && !voltar.startsWith("//") ? voltar : "/conta";
}

async function detalheDoErro(r: Response): Promise<string> {
  const corpo = (await r.json().catch(() => null)) as { detail?: string } | null;
  return corpo?.detail ?? "Algo deu errado. Tente de novo.";
}

export function Entrar() {
  const [estado, setEstado] = useState<EstadoDaConta | null>(null);
  const [etapa, setEtapa] = useState<"celular" | "codigo">("celular");
  const [telefone, setTelefone] = useState("");
  const [aceite, setAceite] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch("/api/conta", { cache: "no-store" })
      .then((r) => r.json() as Promise<EstadoDaConta>)
      .then((e) => {
        if (e.conta) window.location.replace(destinoSeguro(new URLSearchParams(location.search).get("voltar")));
        else setEstado(e);
      })
      .catch(() => setEstado({ disponivel: false, conta: null }));
  }, []);

  async function pedirCodigo(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    if (!aceite) return setErro("Para criar a conta, marque que concorda com o uso dos dados.");
    setEnviando(true);
    const r = await fetch("/api/conta/codigo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefone, aceite: true }),
    }).catch(() => null);
    setEnviando(false);
    if (!r) return setErro("Sem conexão. Confira a internet e tente de novo.");
    if (!r.ok) return setErro(await detalheDoErro(r));
    setEtapa("codigo");
  }

  async function confirmar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await fetch("/api/conta/entrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefone, codigo: codigo.replace(/\D/g, "") }),
    }).catch(() => null);
    setEnviando(false);
    if (!r) return setErro("Sem conexão. Confira a internet e tente de novo.");
    if (!r.ok) return setErro(await detalheDoErro(r));
    const { nova } = ((await r.json().catch(() => ({}))) as { nova?: boolean });
    if (nova) medir("conta_criada", { canal: "site" });
    window.location.assign(destinoSeguro(new URLSearchParams(location.search).get("voltar")));
  }

  if (!estado) return <p className="carregando">Carregando…</p>;
  if (!estado.disponivel) {
    return (
      <div className="guia">
        <h1>Entrar</h1>
        <p className="resumo">A conta ainda não está disponível. Enquanto isso, tudo funciona sem conta, guardado no seu aparelho.</p>
      </div>
    );
  }

  return (
    <div className="guia">
      <h1>Entrar com o celular</h1>
      <p className="resumo">
        Sem senha. Mandamos um código de 6 números pelo WhatsApp. Com a conta, o seu caderno de vendas e as suas
        notas de compra ficam guardados e aparecem em qualquer aparelho.
      </p>

      {etapa === "celular" ? (
        <form className="pergunta" onSubmit={pedirCodigo} noValidate>
          <label className="campo-contato">
            <span>Seu celular com DDD</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="14 99999 9999"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              required
            />
          </label>
          <label className="aceite">
            <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
            <span>{estado.consentimento}</span>
          </label>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button type="submit" className="principal" disabled={enviando}>{enviando ? "Enviando…" : "Receber o código no WhatsApp"}</button>
        </form>
      ) : (
        <form className="pergunta" onSubmit={confirmar} noValidate>
          <p>Mandamos o código para o WhatsApp do número {telefone}. Ele vale por 10 minutos.</p>
          <label className="campo-contato">
            <span>Código de 6 números</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              required
              autoFocus
            />
          </label>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <div className="acoes">
            <button type="submit" className="principal" disabled={enviando}>{enviando ? "Conferindo…" : "Entrar"}</button>
            <button type="button" className="secundario" onClick={() => { setEtapa("celular"); setCodigo(""); setErro(null); }}>
              Trocar o número
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
