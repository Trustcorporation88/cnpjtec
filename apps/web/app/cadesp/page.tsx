import type { Metadata } from "next";
import Link from "next/link";
import { baseDeRegras } from "@cnpjtec/regras";
import { Fontes } from "@/components/Fontes";
import { citar, dataDaRegra } from "@/lib/regras-tela";

export const metadata: Metadata = {
  title: "Inscrição estadual (CADESP) para quem revende | MEiSHOP",
  description:
    "Quem compra produtos para revender em São Paulo precisa de inscrição estadual. Veja como consultar, pedir e regularizar.",
};

const CONSULTA =
  "https://www.cadesp.fazenda.sp.gov.br/Pages/Cadastro/Consultas/ConsultaPublica/ConsultaPublica.aspx";
const SEFAZ = "https://portal.fazenda.sp.gov.br/servicos/cadesp/Paginas/Abertura-de-Empresas.aspx";
const PORTAL_EMPREENDEDOR = "https://www.gov.br/empresas-e-negocios/pt-br/empreendedor";

export default function PaginaDoCadesp() {
  const vedacao = dataDaRegra("R24", "inicio");
  return (
    <article className="guia">
      <div className="placa">
        <p>Passo a passo, São Paulo</p>
        <h1>Inscrição estadual para quem revende</h1>
      </div>

      <p className="resumo">
        Quem compra produtos para revender, como Natura, Avon ou bebidas, precisa de um cadastro no
        estado. Em São Paulo ele se chama CADESP. Ele é diferente do CNPJ e do MEI.
      </p>

      <section className="indefinido" aria-labelledby="t-mudou">
        <h2 id="t-mudou">O que mudou</h2>
        <p>
          Desde {vedacao}, a marca não pode mandar produto para revenda porta a porta a quem não tem
          inscrição estadual em São Paulo.{" "}
          <a className="ref" href="#regra-R24">(regra R24)</a> Comprar com CPF não tira essa
          obrigação de quem revende.{" "}
          <a className="ref" href="#regra-R23">(regra R23)</a>
        </p>
      </section>

      <ol className="passos">
        <li className="passo">
          <h2>Veja se você já tem</h2>
          <p>
            A consulta é pública e gratuita, no site da Secretaria da Fazenda de São Paulo. Digite o
            CNPJ do seu MEI.
          </p>
          <p>
            <a className="botao" href={CONSULTA} target="_blank" rel="noopener noreferrer">
              Consultar no site da Fazenda de SP
            </a>
          </p>
          <p className="observacao">
            Se aparecer &quot;ativa&quot;, está tudo certo. Se aparecer &quot;suspensa&quot; ou não
            aparecer nada, siga para o próximo passo.
          </p>
        </li>

        <li className="passo">
          <h2>Se não tem, peça pelo Portal do Empreendedor</h2>
          <p>
            Para quem é MEI, o pedido de inscrição estadual é feito no próprio Portal do
            Empreendedor, sem taxa. <a className="ref" href="#regra-R25">(regra R25)</a>
          </p>
          <p>
            <a className="botao" href={PORTAL_EMPREENDEDOR} target="_blank" rel="noopener noreferrer">
              Abrir o Portal do Empreendedor
            </a>
          </p>
          <p className="observacao">
            Ainda não tem MEI? Faça o <Link href="/">Raio-X</Link> para ver se o MEI é o melhor
            caminho para você.
          </p>
        </li>

        <li className="passo">
          <h2>Se está suspensa, descubra o motivo</h2>
          <p>
            Mudança de endereço, falta de movimento ou alguma obrigação atrasada podem suspender a
            inscrição, e cada motivo tem um jeito de resolver. A Fazenda de SP explica o caminho de
            cada caso.
          </p>
          <p>
            <a className="botao" href={SEFAZ} target="_blank" rel="noopener noreferrer">
              Ver as orientações da Fazenda de SP
            </a>
          </p>
        </li>

        <li className="passo">
          <h2>Guarde as notas de compra</h2>
          <p>
            Guarde por cinco anos as notas das compras feitas da marca, com o arquivo XML quando
            tiver. Elas provam de onde veio o produto.{" "}
            <a className="ref" href="#regra-R22">(regra R22)</a>
          </p>
          <p>
            Anote também as suas vendas no <Link href="/caderno">caderno de vendas</Link>.
          </p>
        </li>
      </ol>

      <section aria-labelledby="t-por-que">
        <h2 id="t-por-que">Por que vale resolver</h2>
        <p>
          Revender sem inscrição pode dar multa do estado por mês de atividade.{" "}
          <a className="ref" href="#regra-R26">(regra R26)</a> E, sem inscrição, a marca pode parar
          de mandar os seus pedidos.
        </p>
      </section>

      <section aria-labelledby="t-cuidado">
        <h2 id="t-cuidado">Cuidado</h2>
        <ul className="lista alerta">
          <li>Consultar e pedir a inscrição do MEI não tem custo no canal oficial.</li>
          <li>Esta página vale para São Paulo. Em outro estado, o cadastro e o caminho são outros.</li>
          <li>Quem só vende por comissão, sem comprar o produto, pode ter outro tratamento. Confira o seu contrato.</li>
        </ul>
      </section>

      <Fontes regras={citar(["R22", "R23", "R24", "R25", "R26"])} versao={baseDeRegras.versao} />
    </article>
  );
}
