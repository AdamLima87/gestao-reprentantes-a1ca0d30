// Máscaras e validações de inputs do sistema.
// Toda entrada do usuário deve passar por sanitização (remoção de espaços
// extras e caracteres de controle) e, quando aplicável, validação de formato.

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Remove caracteres de controle, normaliza espaços e faz trim. */
export function sanitizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    // remove caracteres de controle (exceto \n e \t comuns)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sanitiza nomes próprios: letras, espaços, acentos, hífen e apóstrofo. */
export function sanitizeName(value: string | null | undefined): string {
  const s = sanitizeText(value);
  return s.replace(/[^\p{L}\p{M}\s'\-.]/gu, "");
}

// ===================== CNPJ =====================
export function maskCNPJ(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  let out = d;
  if (d.length > 2) out = d.slice(0, 2) + "." + d.slice(2);
  if (d.length > 5) out = d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5);
  if (d.length > 8) out = d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5, 8) + "/" + d.slice(8);
  if (d.length > 12) out = d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5, 8) + "/" + d.slice(8, 12) + "-" + d.slice(12);
  return out;
}

export function isValidCNPJ(value: string | null | undefined): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string, pesos: number[]) => {
    const sum = pesos.reduce((acc, p, i) => acc + Number(base[i]) * p, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, ...p1];
  const d1 = calc(cnpj.slice(0, 12), p1);
  const d2 = calc(cnpj.slice(0, 12) + d1, p2);
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

// ===================== CPF =====================
export function maskCPF(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  let out = d;
  if (d.length > 3) out = d.slice(0, 3) + "." + d.slice(3);
  if (d.length > 6) out = d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6);
  if (d.length > 9) out = d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6, 9) + "-" + d.slice(9);
  return out;
}

export function isValidCPF(value: string | null | undefined): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (base: string, len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(base[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(cpf, 9) === Number(cpf[9]) && calc(cpf, 10) === Number(cpf[10]);
}

// ===================== Telefone =====================
export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return "(" + d;
  if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2);
  if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
  return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
}

export function isValidPhone(value: string | null | undefined): boolean {
  const d = onlyDigits(value);
  return d.length === 10 || d.length === 11;
}

// ===================== CEP =====================
export function maskCEP(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 5) return d;
  return d.slice(0, 5) + "-" + d.slice(5);
}

export function isValidCEP(value: string | null | undefined): boolean {
  return onlyDigits(value).length === 8;
}

// ===================== E-mail =====================
const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
export function isValidEmail(value: string | null | undefined): boolean {
  const s = sanitizeText(value).toLowerCase();
  return s.length > 0 && s.length <= 255 && EMAIL_RE.test(s);
}

export function sanitizeEmail(value: string | null | undefined): string {
  return sanitizeText(value).toLowerCase();
}
