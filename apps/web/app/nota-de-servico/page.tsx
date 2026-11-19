import type { Metadata } from "next";
import { baseDeRegras } from "@cnpjtec/regras";
import { CodigosDaNota } from "@/components/CodigosDaNota";
import { Fontes } from "@/components/Fontes";
import { citar } from "@/lib/regras-tela";

export const metadata: Metadata = {
  title: "Códigos da nota de serviço em 2027 | ProContador",
  description:
    "Ache o código de tributação nacional, a NBS, o indicador de operação e a classificação do IBS e da CBS do seu serviço, na tabela oficial da Receita.",
};

export default function PaginaDaNotaDeServico() {
  return (
    <article className="guia">
      <div className="placa">
        <p>NFS-e e Reforma Tributária</p>
        <h1>Códigos da sua nota de serviço</h1>
      </div>
      <p className="resumo">
        A partir de 2027 a nota de serviço ganha campos novos do IBS e da CBS. Digite o que você faz e veja os
        códigos que a tabela oficial da Receita liga ao seu serviço, prontos para copiar no emissor.
      </p>
      <CodigosDaNota />
      <section aria-labelledby="t-antes">
        <h2 id="t-antes">Antes de usar</h2>
        <ul className="lista">
          <li>
            Os códigos vêm da calculadora oficial da Receita Federal. O ProContador não muda nem completa nada.
          </li>
          <li>
            Se você é MEI, o IBS e a CBS seguem dentro do valor fixo do DAS. Quando o MEI passa a preencher esses
            campos na nota ainda não está definido para todos os casos.{" "}
            <a className="ref" href="#regra-R12">(regra R12)</a>
          </li>
          <li>Na dúvida entre duas opções, fale com um contador antes de emitir.</li>
        </ul>
      </section>
      <Fontes regras={citar(["R12"])} versao={baseDeRegras.versao} />
    </article>
  );
}
