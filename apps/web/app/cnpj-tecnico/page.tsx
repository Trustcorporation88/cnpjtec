import type { Metadata } from "next";
import Link from "next/link";
import { baseDeRegras } from "@cnpjtec/regras";
import { Fontes } from "@/components/Fontes";
import { Radar } from "@/components/Radar";
import { configuracaoDoRadar, textoDoConsentimento } from "@/lib/radar";
import { citar, dataDaRegra } from "@/lib/regras-tela";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "O caminho do CNPJ técnico | ProContador",
  description:
    "O que é o CNPJ técnico, quem precisa, o que já dá para fazer hoje e o que ainda depende da Receita Federal.",
};

export default function PaginaDoCnpjTecnico() {
  const config = configuracaoDoRadar();
  const radar = config ? { consentimento: textoDoConsentimento(config.controlador) } : null;
  const inicio = dataDaRegra("R11", "inicio");
  const fimDaDispensa = dataDaRegra("R07", "fim");

  return (
    <article className="guia">
      <div className="placa">
        <p>Passo a passo</p>
        <h1>O caminho do CNPJ técnico</h1>
      </div>

      <p className="resumo">
        CNPJ técnico é o nome que as pessoas deram ao CNPJ ligado ao CPF de quem trabalha por conta
        própria e entra nos impostos novos. Ele não é uma empresa e não é MEI. Quem dá esse número é
        a Receita Federal, de graça.
      </p>

      <ol className="passos">
        <li className="passo">
          <p className="situacao">Dá para fazer hoje</p>
          <h2>Veja se é com você</h2>
          <p>
            Nem todo mundo precisa. Quem ganha pouco (o nanoempreendedor) está dispensado até{" "}
            {fimDaDispensa}, e quem é MEI já tem CNPJ. Responda às perguntas do Raio-X para saber o
            seu caso.
          </p>
          <p>
            <Link className="botao" href="/">
              Fazer o Raio-X
            </Link>
          </p>
        </li>

        <li className="passo">
          <p className="situacao">Dá para fazer hoje</p>
          <h2>Deixe tudo pronto</h2>
          <ul className="lista fazer">
            <li>Confira se o seu CPF está regular na Receita.</li>
            <li>Veja se você consegue entrar na sua conta gov.br.</li>
            <li>Atualize o seu celular e o seu e-mail na conta gov.br.</li>
          </ul>
          <p className="observacao">
            Isso ainda não é exigência oficial. É só para você não ser pego de surpresa.
          </p>
        </li>

        <li className="passo aguardando">
          <p className="situacao">Aguardando a Receita</p>
          <h2>Receba o número</h2>
          <p>
            A obrigação começa em {inicio}. A Receita ainda não publicou como o número chega, quando
            e por onde. Assim que publicar, o passo a passo aparece aqui.
          </p>
          <p>
            Enquanto isso, não abra empresa, não abra MEI e não faça pedido em outro sistema só para
            ter esse número.
          </p>
        </li>

        <li className="passo aguardando">
          <p className="situacao">Aguardando a Receita</p>
          <h2>Emita a sua primeira nota</h2>
          <p>
            Com o número, você passa a emitir nota fiscal eletrônica do seu trabalho. O governo
            anunciou que parte das exigências de nota pode ficar para março de 2027, mas não disse
            para quem.
          </p>
          <p>
            A nota de serviço também depende da prefeitura. Pergunte na sua cidade se o seu serviço
            precisa de cadastro.
          </p>
        </li>
      </ol>

      {radar && <Radar dados={radar} trilha="B_PF_CONTRIBUINTE" />}

      <section aria-labelledby="t-cuidado">
        <h2 id="t-cuidado">Cuidado</h2>
        <ul className="lista alerta">
          <li>Não pague ninguém para tirar o CNPJ técnico. Ele é gratuito e sai pela Receita.</li>
          <li>Não passe a senha da sua conta gov.br para outra pessoa nem para outro site.</li>
          <li>O ProContador não emite esse número. A gente explica, avisa e acompanha você.</li>
        </ul>
      </section>

      <Fontes regras={citar(["R07", "R11", "R12", "R13", "R30"])} versao={baseDeRegras.versao} />
    </article>
  );
}
