"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Conta {
  telefone: string;
  criadaEm: string;
}

function mostrarTelefone(t: string): string {
  const n = t.replace(/^\+55/, "");
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

export function MinhaConta() {
  const [conta, setConta] = useState<Conta | null | undefined>(undefined);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/conta", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ conta: Conta | null }>)
      .then((e) => {
        if (!e.conta) window.location.replace("/entrar?voltar=/conta");
        else setConta(e.conta);
      })
      .catch(() => setConta(null));
  }, []);

  async function sair() {
    await fetch("/api/conta/sair", { method: "POST" }).catch(() => null);
    window.location.assign("/");
  }

  async function apagar() {
    setErro(null);
    const r = await fetch("/api/conta", { method: "DELETE" }).catch(() => null);
    if (!r || !r.ok) return setErro("Não conseguimos apagar agora. Tente de novo em instantes.");
    window.location.assign("/?conta=apagada");
  }

  if (conta === undefined) return <p className="carregando">Carregando…</p>;
  if (conta === null) return <p className="erro" role="alert">Não conseguimos abrir a sua conta. Recarregue a página.</p>;

  return (
    <div className="guia">
      <h1>Minha conta</h1>
      <p className="resumo">
        Celular {mostrarTelefone(conta.telefone)}, conta criada em{" "}
        {new Date(conta.criadaEm).toLocaleDateString("pt-BR")}.
      </p>

      <section aria-labelledby="t-servicos">
        <h2 id="t-servicos">O que fica guardado</h2>
        <ul className="lista-links">
          <li><Link href="/caderno">Caderno de vendas</Link>: as vendas que você anota, para o limite e a declaração anual.</li>
          <li><Link href="/cofre">Cofre de notas</Link>: as notas das compras que você fez da marca, para provar de onde veio a mercadoria.</li>
        </ul>
      </section>

      <section aria-labelledby="t-dados">
        <h2 id="t-dados">Seus dados</h2>
        <p>Você pode baixar tudo o que guardamos ou apagar a conta quando quiser. Não pedimos senha do gov.br.</p>
        <div className="acoes">
          <a className="botao secundario" href="/api/conta/dados">Baixar meus dados</a>
          <button type="button" className="secundario" onClick={sair}>Sair deste aparelho</button>
        </div>
        {!confirmando ? (
          <button type="button" className="secundario perigo" onClick={() => setConfirmando(true)}>Apagar a conta</button>
        ) : (
          <div className="confirmar" role="alertdialog" aria-labelledby="t-apagar">
            <p id="t-apagar">
              Isso apaga para sempre o caderno, as notas e a conta. As vendas que estão neste aparelho continuam nele.
              Quer mesmo apagar?
            </p>
            <div className="acoes">
              <button type="button" className="secundario perigo" onClick={apagar}>Sim, apagar tudo</button>
              <button type="button" className="secundario" onClick={() => setConfirmando(false)}>Não, manter</button>
            </div>
          </div>
        )}
        {erro && <p className="erro" role="alert">{erro}</p>}
      </section>
    </div>
  );
}
