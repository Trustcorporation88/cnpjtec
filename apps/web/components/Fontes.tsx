import type { RegraNaTela } from "@/lib/regras-tela";

/** Lista das regras que sustentam o que a página afirma. */
export function Fontes({ regras, versao }: { regras: RegraNaTela[]; versao?: string }) {
  return (
    <details className="fontes">
      <summary>De onde tiramos isso</summary>
      <ul>
        {regras.map((r) => (
          <li key={r.id} id={`regra-${r.id}`}>
            <p>
              <strong>Regra {r.id}.</strong> {r.regra}
            </p>
            <p className="fonte">
              Fonte: {r.fonte}. {r.rotuloDoStatus}.{r.emRevisao ? " Em conferência pelo contador." : ""}
            </p>
          </li>
        ))}
      </ul>
      {versao && <p className="fonte">Versão das regras: {versao}.</p>}
    </details>
  );
}
