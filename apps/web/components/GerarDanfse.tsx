"use client";

import { useState } from "react";

/** Envia o XML da NFS-e e baixa o PDF oficial. O arquivo não fica guardado. */
export function GerarDanfse() {
  const [estado, setEstado] = useState<"livre" | "gerando" | "pronto">("livre");
  const [erro, setErro] = useState<string | null>(null);

  async function gerar(arquivo: File) {
    setErro(null);
    if (arquivo.size > 1_048_576) return setErro("Mande um XML de até 1 MB.");
    setEstado("gerando");
    try {
      const r = await fetch("/api/danfse", { method: "POST", headers: { "Content-Type": "application/xml" }, body: await arquivo.text() });
      if (!r.ok) {
        const corpo = (await r.json().catch(() => null)) as { detail?: string } | null;
        setErro(corpo?.detail ?? "Não conseguimos gerar o PDF agora.");
        return setEstado("livre");
      }
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = arquivo.name.replace(/\.xml$/i, "") + ".pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setEstado("pronto");
    } catch {
      setErro("Não conseguimos gerar o PDF agora.");
      setEstado("livre");
    }
  }

  return (
    <section aria-labelledby="t-danfse">
      <h2 id="t-danfse">Já tem o XML da nota? Gere o PDF</h2>
      <p>
        Escolha o arquivo XML de uma nota de serviço do padrão nacional. O PDF (DANFSe) sai pelo programa oficial da
        Receita. O arquivo não fica guardado aqui.
      </p>
      <label className="campo-busca nao-imprimir">
        <span>Arquivo XML da nota de serviço</span>
        <input
          type="file"
          accept=".xml,application/xml,text/xml"
          disabled={estado === "gerando"}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void gerar(f);
            e.target.value = "";
          }}
        />
      </label>
      <div aria-live="polite">
        {estado === "gerando" && <p className="observacao">Gerando o PDF…</p>}
        {estado === "pronto" && <p className="observacao">PDF baixado.</p>}
        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}
      </div>
    </section>
  );
}
