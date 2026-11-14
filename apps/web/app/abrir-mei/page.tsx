import type { Metadata } from "next";
import Link from "next/link";
import { buscarRegra } from "@cnpjtec/regras";

export const metadata: Metadata = {
  title: "Como abrir um MEI | ProContador",
  description: "Passo a passo para abrir o MEI de graça no Portal do Empreendedor, sem intermediário.",
};

const PORTAL = "https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/quero-ser-mei";
const PERGUNTAS = "https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/perguntas-frequentes";
const SERVICO = "https://www.gov.br/pt-br/servicos/realizar-registro-como-microempreendedor-individual-mei";

export default function PaginaAbrirMei() {
  const limite = buscarRegra("R14");
  return (
    <div className="guia">
      <h1>Como abrir um MEI</h1>
      <p className="resumo">
        Abrir o MEI é de graça e leva poucos minutos no Portal do Empreendedor, do governo federal. Ninguém precisa
        cobrar por isso.
      </p>

      <section aria-labelledby="t-pode">
        <h2 id="t-pode">1. Confira se você pode ser MEI</h2>
        <ul className="lista">
          <li>A sua atividade precisa estar na lista de ocupações permitidas ao MEI. Ela aparece no próprio portal, na hora de escolher.</li>
          <li>O que você ganha no ano precisa caber no limite: R$ 81 mil em 2026 e R$ 110 mil a partir de 2027, proporcional aos meses se abrir no meio do ano (<a href="#regra-R14">regra R14</a>).</li>
          <li>Você não pode ser sócio, dono ou administrador de outra empresa.</li>
          <li>Servidor público federal em atividade não pode ser MEI. Servidor estadual ou municipal precisa ver o estatuto do cargo.</li>
          <li>Precisa ter 18 anos, ou 16 e 17 anos com emancipação.</li>
          <li>Ter carteira assinada não impede. Ter dívida ou nome negativado também não impede.</li>
          <li>Se você recebe benefício do INSS, como auxílio por doença, ligue antes para o 135 do INSS e pergunte se abrir o MEI afeta o benefício.</li>
        </ul>
        <p>
          Ainda não sabe se vale a pena? <Link href="/simulador">Compare continuar sem MEI e virar MEI</Link>.
        </p>
      </section>

      <section aria-labelledby="t-govbr">
        <h2 id="t-govbr">2. Deixe a conta gov.br no nível prata ou ouro</h2>
        <p>
          Para brasileiros, o portal só aceita conta gov.br prata ou ouro. Dá para subir de nível pelo aplicativo
          gov.br, com reconhecimento facial ou pelo banco. Nunca passe a senha do gov.br para ninguém, nem para nós.
        </p>
      </section>

      <section aria-labelledby="t-separar">
        <h2 id="t-separar">3. Separe os dados</h2>
        <ul className="lista">
          <li>Número do RG e órgão que emitiu.</li>
          <li>Telefone, e-mail e endereço de casa.</li>
          <li>A atividade principal (e outras, se tiver).</li>
          <li>Como você trabalha: em casa, na rua, pela internet, porta a porta ou em local próprio.</li>
          <li>O endereço onde o negócio funciona, se for diferente da sua casa.</li>
        </ul>
      </section>

      <section aria-labelledby="t-portal">
        <h2 id="t-portal">4. Faça a inscrição no portal oficial</h2>
        <ol className="passos">
          <li>Entre no Portal do Empreendedor e escolha &quot;Quero ser MEI&quot; e depois &quot;Formalize-se&quot;.</li>
          <li>Entre com a sua conta gov.br.</li>
          <li>Preencha o formulário, confira os dados e marque as declarações.</li>
          <li>No fim, o CNPJ sai na hora, junto com o certificado do MEI (CCMEI). Baixe e guarde esse certificado.</li>
        </ol>
        <p>
          <a className="botao" href={PORTAL} target="_blank" rel="noopener noreferrer">Abrir o Portal do Empreendedor</a>
        </p>
      </section>

      <section aria-labelledby="t-depois">
        <h2 id="t-depois">5. Depois de abrir</h2>
        <ul className="lista-links">
          <li><Link href="/das">Pague a guia mensal do MEI (DAS)</Link> todo mês, mesmo se não vender nada.</li>
          <li>Se você compra produtos para revender em São Paulo (Natura, Avon, bebidas), <Link href="/cadesp">veja a inscrição estadual (CADESP)</Link>.</li>
          <li><Link href="/caderno">Anote as vendas no caderno</Link> e <Link href="/cofre">guarde as notas de compra no cofre</Link>.</li>
          <li>Se presta serviço, pergunte na prefeitura sobre a nota fiscal de serviço.</li>
        </ul>
      </section>

      <details className="fontes">
        <summary>De onde tiramos isso</summary>
        <ul>
          <li id="regra-R14">
            <p><strong>Regra R14.</strong> {limite.regra}</p>
            <p className="fonte">Fonte: {limite.fonte}. Em conferência pelo contador.</p>
          </li>
          <li>
            <p>Requisitos, documentos e gratuidade: <a href={SERVICO} target="_blank" rel="noopener noreferrer">Cadastrar Microempreendedor Individual (gov.br)</a> e <a href={PERGUNTAS} target="_blank" rel="noopener noreferrer">Perguntas frequentes do Portal do Empreendedor</a>. Consultados em 14/11/2026.</p>
          </li>
        </ul>
      </details>
    </div>
  );
}
