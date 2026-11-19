"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

interface Mensagem {
  role: "user" | "assistant";
  content: string;
}

const CHAVE = "procontador.assistente.v1";

/** Transforma caminhos como /das em links, sem interpretar HTML vindo da resposta. */
function ComLinks({ texto }: { texto: string }) {
  const partes = texto.split(/(\s\/[a-z-]+(?:\/[a-z-]+)?\b)/g);
  return (
    <>
      {partes.map((p, i) => {
        const m = p.match(/^(\s)(\/[a-z-]+(?:\/[a-z-]+)?)$/);
        return m ? <span key={i}>{m[1]}<Link href={m[2]!}>{m[2]}</Link></span> : <span key={i}>{p}</span>;
      })}
    </>
  );
}

export function Assistente() {
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/assistente").then((r) => r.json() as Promise<{ ativo: boolean }>).then((e) => setAtivo(e.ativo)).catch(() => setAtivo(false));
    try {
      const salvo = sessionStorage.getItem(CHAVE);
      if (salvo) setMensagens(JSON.parse(salvo) as Mensagem[]);
    } catch {
      /* navegador sem armazenamento: a conversa só não sobrevive ao recarregar */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAVE, JSON.stringify(mensagens.slice(-30)));
    } catch {
      /* idem */
    }
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const pergunta = texto.trim();
    if (!pergunta || pensando) return;
    setErro(null);
    const novas: Mensagem[] = [...mensagens, { role: "user", content: pergunta }];
    setMensagens(novas);
    setTexto("");
    setPensando(true);
    const r = await fetch("/api/assistente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagens: novas.slice(-30) }),
    }).catch(() => null);
    setPensando(false);
    if (!r || !r.ok) {
      const c = r ? ((await r.json().catch(() => null)) as { detail?: string } | null) : null;
      return setErro(c?.detail ?? "Sem conexão. Tente de novo.");
    }
    const { resposta } = (await r.json()) as { resposta: string };
    setMensagens([...novas, { role: "assistant", content: resposta }]);
  }

  if (ativo === null) return <p className="carregando">Carregando…</p>;
  if (!ativo) {
    return (
      <div className="guia">
        <h1>Pergunte do seu jeito</h1>
        <p className="resumo">A conversa livre ainda não está ligada. Enquanto isso, <Link href="/minha-situacao">veja a sua situação</Link> ou <Link href="/ajuda">pergunte a um contador</Link>.</p>
      </div>
    );
  }

  return (
    <div className="guia conversa">
      <h1>Pergunte do seu jeito</h1>
      <p className="resumo">
        Conte o que você faz e quanto ganha, ou pergunte o que quiser sobre MEI, CNPJ técnico e nota fiscal. As respostas
        vêm das regras conferidas do ProContador. Não mande senha, CPF nem número de cartão.
      </p>
      <div className="mensagens" aria-live="polite">
        {mensagens.map((m, i) => (
          <div key={i} className={`balao ${m.role === "user" ? "seu" : "nosso"}`}>
            <p className="visualmente-oculto">{m.role === "user" ? "Você:" : "ProContador:"}</p>
            {m.content.split("\n").map((linha, k) => (
              <p key={k}><ComLinks texto={` ${linha}`} /></p>
            ))}
          </div>
        ))}
        {pensando && <p className="carregando">Consultando as regras…</p>}
        <div ref={fim} />
      </div>
      <form onSubmit={enviar} className="pergunta">
        <label className="campo-contato">
          <span className="visualmente-oculto">Sua pergunta</span>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={2000}
            placeholder="Ex.: sou manicure, ganho uns 2 mil por mês. Preciso de CNPJ?"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement).requestSubmit();
              }
            }}
          />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="acoes">
          <button type="submit" className="principal" disabled={pensando || !texto.trim()}>Enviar</button>
          {mensagens.length > 0 && (
            <button type="button" className="secundario" onClick={() => setMensagens([])}>Começar de novo</button>
          )}
        </div>
      </form>
      <p className="fonte">
        A assistente usa inteligência artificial da Anthropic. Ela recebe só o texto da conversa, sem o seu telefone. Para
        decisões importantes, <Link href="/ajuda">confirme com um contador</Link>.
      </p>
    </div>
  );
}
