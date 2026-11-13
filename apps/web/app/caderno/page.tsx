import type { Metadata } from "next";
import { Caderno } from "@/components/Caderno";

export const metadata: Metadata = {
  title: "Caderno de vendas | MEiSHOP",
  description: "Anote suas vendas e tenha pronto o resumo da declaração anual do MEI. Fica só no seu aparelho.",
};

export default function PaginaDoCaderno() {
  return <Caderno />;
}
