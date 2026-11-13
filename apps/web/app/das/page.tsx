import type { Metadata } from "next";
import { baseDeRegras, buscarRegra } from "@cnpjtec/regras";
import { Fontes } from "@/components/Fontes";
import { citar } from "@/lib/regras-tela";

export const metadata: Metadata = {
  title: "A guia do MEI (DAS) | ProContador",
  description: "Como gerar a guia mensal do MEI pelo canal oficial da Receita Federal, sem pagar nada.",
};

/** Endereço oficial do PGMEI, versão aberta, divulgado pelo Serpro e pela Receita Federal. */
const PGMEI =
  "https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao";

export default function PaginaDoDas() {
  return (
    <article className="guia">
      <div className="placa">
        <p>Passo a passo</p>
        <h1>A guia do MEI</h1>
      </div>

      <p className="resumo">
        Quem é MEI paga um valor único todo mês. Essa guia se chama DAS. Gerar a guia é de graça e
        leva poucos minutos.
      </p>

      <ol className="passos">
        <li className="passo">
          <h2>Abra o programa da Receita</h2>
          <p>O programa oficial se chama PGMEI. Não precisa de senha.</p>
          <p>
            <a className="botao" href={PGMEI} target="_blank" rel="noopener noreferrer">
              Abrir o PGMEI no site da Receita
            </a>
          </p>
        </li>
        <li className="passo">
          <h2>Digite o CNPJ do seu MEI</h2>
          <p>São 14 números. Eles estão no certificado do MEI e em qualquer guia antiga.</p>
        </li>
        <li className="passo">
          <h2>Escolha o ano e o mês</h2>
          <p>Marque o mês que você quer pagar e gere a guia.</p>
        </li>
        <li className="passo">
          <h2>Pague no seu banco</h2>
          <p>Pague pelo aplicativo do seu banco, com os dados que aparecem na guia.</p>
        </li>
      </ol>

      <p>Também dá para gerar a guia pelo aplicativo oficial App MEI, no celular.</p>

      <section aria-labelledby="t-prazo">
        <h2 id="t-prazo">Prazo</h2>
        <p>
          {buscarRegra("R32").regra}{" "}
          <a className="ref" href="#regra-R32">
            (regra R32)
          </a>
        </p>
      </section>

      <section className="indefinido" aria-labelledby="t-divida">
        <h2 id="t-divida">Guias antigas em atraso</h2>
        <p>
          Uma lei de 2026 prevê o perdão de parte das dívidas antigas do MEI a partir de 2027, mas
          ainda falta a regulamentação. Se você tem guias antigas em atraso, fale com um contador
          antes de pagar: pode ser que parte delas entre nesse perdão.{" "}
          <a className="ref" href="#regra-R17">
            (regra R17)
          </a>
        </p>
      </section>

      <section aria-labelledby="t-cuidado">
        <h2 id="t-cuidado">Cuidado</h2>
        <ul className="lista alerta">
          <li>Gerar a guia é de graça. Desconfie de site que cobra por isso.</li>
          <li>Confira se o endereço do site termina em gov.br antes de digitar o seu CNPJ.</li>
          <li>O ProContador não cobra para mostrar este caminho.</li>
        </ul>
      </section>

      <Fontes regras={citar(["R17", "R32"])} versao={baseDeRegras.versao} />
    </article>
  );
}
