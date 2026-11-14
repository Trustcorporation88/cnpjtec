import type { Metadata } from "next";
import { Ajuda } from "@/components/Ajuda";

export const metadata: Metadata = { title: "Pergunte a um contador | ProContador" };

export default function PaginaAjuda() {
  return <Ajuda />;
}
