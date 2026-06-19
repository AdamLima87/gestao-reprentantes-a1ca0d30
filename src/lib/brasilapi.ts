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
