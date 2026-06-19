// Helper para consulta de CNPJ na BrasilAPI
export type CnpjInfo = {
  razao_social: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
};

export async function fetchCnpj(cnpjRaw: string): Promise<CnpjInfo> {
  const cnpj = cnpjRaw.replace(/\D/g, "");
  if (cnpj.length !== 14) throw new Error("CNPJ deve conter 14 dígitos.");
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (!res.ok) throw new Error(`CNPJ não encontrado (${res.status}).`);
  const d = await res.json();
  return {
    razao_social: d.razao_social ?? "",
    logradouro: d.logradouro ?? "",
    numero: d.numero ?? "",
    bairro: d.bairro ?? "",
    municipio: d.municipio ?? "",
    uf: d.uf ?? "",
    cep: d.cep ?? "",
  };
}

export type CpfInfo = { nome: string };

export async function fetchCpf(cpfRaw: string): Promise<CpfInfo> {
  const cpf = cpfRaw.replace(/\D/g, "");
  if (cpf.length !== 11) throw new Error("CPF deve conter 11 dígitos.");
  const res = await fetch(`https://brasilapi.com.br/api/cpf/v1/${cpf}`);
  if (!res.ok) throw new Error(`CPF não encontrado (${res.status}).`);
  const d = await res.json();
  return { nome: d.nome ?? d.name ?? "" };
}
