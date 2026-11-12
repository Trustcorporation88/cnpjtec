"use client";

import { useState, type FormEvent } from "react";

export interface DadosDoRadar {
  consentimento: string;
}

export function Radar({
  dados,
  trilha,
  uf,
}: {
  dados: DadosDoRadar;
  trilha: string;
  uf: string;
}) {
  const [canal, setCanal] = useState<"whatsapp" | "email">("whatsapp");
  const [contato, setContato] = useState("");
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [anotado, setAnotado] = useState(false);

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    if (contato.trim() === "") return setErro("Digite o seu contato.");
    if (!aceite) return setErro("Marque a caixinha para aceitar o aviso.");
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canal, contato, trilha, uf, aceite: true }),
      });
      if (!r.ok) {
        const problema = (await r.json().catch(() => null)) as { detail?: string } | null;
        return setErro(problema?.detail ?? "Não conseguimos anotar o seu contato. Tente de novo.");
      }
      setAnotado(true);
    } catch {
      setErro("Sem conexão com a internet. Confira o sinal e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (anotado) {
    return (
      <section className="radar" aria-live="polite">
        <h2>Contato anotado</h2>
        <p>
          Quando a Receita abrir o canal do CNPJ técnico, a gente avisa você por{" "}
          {canal === "whatsapp" ? "WhatsApp" : "e-mail"}.
        </p>
      </section>
    );
  }

  return (
    <section className="radar" aria-labelledby="t-radar">
      <h2 id="t-radar">Quer ser avisado quando o CNPJ técnico sair?</h2>
      <p>
        A Receita ainda não publicou como ele chega. Deixe um contato e a gente avisa você no dia.
        É de graça.
      </p>
      <form onSubmit={aoEnviar} noValidate>
        <div className="opcoes lado-a-lado">
          {(["whatsapp", "email"] as const).map((c) => (
            <label key={c} className="opcao" data-marcado={canal === c}>
              <input
                type="radio"
                name="canal"
                checked={canal === c}
                onChange={() => {
                  setCanal(c);
                  setContato("");
                  setErro(null);
                }}
              />
              <span>
                <strong>{c === "whatsapp" ? "WhatsApp" : "E-mail"}</strong>
              </span>
            </label>
          ))}
        </div>
        <label className="campo-contato">
          <span>{canal === "whatsapp" ? "Seu celular com DDD" : "Seu e-mail"}</span>
          <input
            type={canal === "whatsapp" ? "tel" : "email"}
            inputMode={canal === "whatsapp" ? "tel" : "email"}
            autoComplete={canal === "whatsapp" ? "tel-national" : "email"}
            placeholder={canal === "whatsapp" ? "14 99999 9999" : "nome@email.com"}
            value={contato}
            onChange={(e) => setContato(e.target.value)}
          />
        </label>
        <label className="aceite">
          <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
          <span>{dados.consentimento}</span>
        </label>
        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}
        <div className="acoes">
          <button type="submit" className="principal" disabled={enviando}>
            {enviando ? "Anotando" : "Quero ser avisado"}
          </button>
        </div>
      </form>
    </section>
  );
}
