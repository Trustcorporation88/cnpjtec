import type { Metadata } from "next";
import { Simulador } from "@/components/Simulador";

export const metadata: Metadata = {
  title: "Nano, MEI ou CNPJ técnico? | MEiSHOP",
  description: "Compare, com os seus números, o que cada caminho pede e quanto custa.",
};

export default function PaginaDoSimulador() {
  return <Simulador />;
}
