import type { Metadata } from "next";
import { Assistente } from "@/components/Assistente";

export const metadata: Metadata = { title: "Pergunte do seu jeito | ProContador" };

export default function PaginaAssistente() {
  return <Assistente />;
}
