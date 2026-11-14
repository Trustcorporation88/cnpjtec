import type { Metadata } from "next";
import { Dossie } from "@/components/Dossie";

export const metadata: Metadata = { title: "Dossiê de notas de compra | ProContador" };

export default function PaginaDoDossie() {
  return <Dossie />;
}
