import type { Metadata } from "next";
import { baseDeRegras } from "@cnpjtec/regras";
import { Fontes } from "@/components/Fontes";
import { SaidaDoMei } from "@/components/SaidaDoMei";
import { citar } from "@/lib/regras-tela";

export const metadata: Metadata = {
  title: "Quanto custa deixar de ser MEI | ProContador",
  description: "Compare a guia do MEI com a guia de ME no Simples Nacional em 2027, com a parte de IBS e CBS.",
};

export default function PaginaSaidaDoMei() {
  return (
    <article className="guia">
      <div className="placa">
        <p>Passou do limite?</p>
        <h1>Quanto custa deixar de ser MEI</h1>
      </div>
      <p className="resumo">
        Quem passa do limite do MEI vira microempresa (ME) no Simples Nacional. Digite quanto você vende por mês e
        veja a guia nova, comparada com a do MEI, e quanto de IBS e CBS vai na nota.
      </p>
      <SaidaDoMei />
      <Fontes regras={citar(["R14", "R35", "R37", "R38", "R40", "R41", "R42"])} versao={baseDeRegras.versao} />
    </article>
  );
}
