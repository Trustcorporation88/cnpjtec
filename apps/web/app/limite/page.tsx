import type { Metadata } from "next";
import { Medidor } from "@/components/Medidor";
import { anosDisponiveis } from "@/lib/medidor";

export const metadata: Metadata = {
  title: "Medidor de limite | ProContador",
  description: "Veja quanto você já usou do limite do ano e em que mês, no ritmo atual, passa dele.",
};

export default function PaginaDoMedidor() {
  return <Medidor anos={anosDisponiveis()} />;
}
