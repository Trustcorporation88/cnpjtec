import type { Metadata } from "next";
import { baseDeRegras } from "@cnpjtec/regras";
import { Declaracao } from "@/components/Declaracao";
import { Fontes } from "@/components/Fontes";
import { citar } from "@/lib/regras-tela";

export const metadata: Metadata = {
  title: "Declaração anual do MEI | ProContador",
  description: "Os valores da declaração anual do MEI (DASN-SIMEI) tirados do seu caderno de vendas, prontos para copiar.",
};

export default function PaginaDaDeclaracao() {
  return (
    <article className="guia">
      <div className="placa">
        <p>DASN-SIMEI</p>
        <h1>Declaração anual do MEI</h1>
      </div>
      <p className="resumo">
        Todo MEI declara uma vez por ano quanto vendeu no ano anterior. Aqui estão os valores tirados do seu
        caderno de vendas, prontos para copiar. A entrega é você quem faz, de graça, no site da Receita.
      </p>
      <Declaracao />
      <Fontes regras={citar(["R14", "R33", "R38", "R39"])} versao={baseDeRegras.versao} />
    </article>
  );
}
