import { describe, expect, it } from "vitest";
import { PerfilInvalido, resumirVendas, type Venda } from "./index";

const v = (data: string, valor: string, tipo: Venda["tipo"], compradorTemCnpj = false): Venda => ({
  data,
  valor,
  tipo,
  compradorTemCnpj,
});

describe("resumo de vendas", () => {
  it("separa mercadoria e serviço por mês e no ano", () => {
    const r = resumirVendas(
      [
        v("2026-01-05", "80.00", "mercadoria"),
        v("2026-01-20", "120.50", "mercadoria", true),
        v("2026-03-02", "200", "servico"),
        v("2025-12-31", "999", "mercadoria"),
      ],
      2026,
    );
    expect(r.meses).toHaveLength(12);
    expect(r.meses[0]).toMatchObject({ mercadoria: "200.50", servico: "0.00", total: "200.50", quantidade: 2, vendasParaEmpresa: 1 });
    expect(r.meses[2]).toMatchObject({ servico: "200.00", total: "200.00" });
    expect(r.totalDoAno).toMatchObject({ mercadoria: "200.50", servico: "200.00", total: "400.50", quantidade: 3, vendasParaEmpresa: 1 });
  });

  it("soma sem erro de arredondamento", () => {
    const vendas = Array.from({ length: 10 }, () => v("2026-02-01", "0.10", "mercadoria"));
    expect(resumirVendas(vendas, 2026).totalDoAno.total).toBe("1.00");
  });

  it("ano sem vendas dá zero", () => {
    expect(resumirVendas([], 2027).totalDoAno).toMatchObject({ total: "0.00", quantidade: 0 });
  });

  it.each(["2026-02-30", "2026-13-01", "01/02/2026", ""])("recusa data %s", (data) => {
    expect(() => resumirVendas([v(data, "1", "servico")], 2026)).toThrow(PerfilInvalido);
  });

  it.each(["-1", "abc", "1.234"])("recusa valor %s", (valor) => {
    expect(() => resumirVendas([v("2026-01-01", valor, "servico")], 2026)).toThrow(PerfilInvalido);
  });
});
