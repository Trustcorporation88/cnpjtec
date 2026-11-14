import type { Metadata } from "next";
import { MinhaConta } from "@/components/MinhaConta";

export const metadata: Metadata = { title: "Minha conta | ProContador" };

export default function PaginaConta() {
  return <MinhaConta />;
}
