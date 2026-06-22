export type PasswordStrength = "fraca" | "media" | "forte";

export interface PasswordCheck {
  length: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
}

export function checkPassword(pwd: string): PasswordCheck {
  return {
    length: pwd.length >= 10,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    number: /[0-9]/.test(pwd),
  };
}

export function isPasswordValid(pwd: string): boolean {
  const c = checkPassword(pwd);
  return c.length && c.upper && c.lower && c.number;
}

export function passwordStrength(pwd: string): PasswordStrength {
  const c = checkPassword(pwd);
  const score = Number(c.length) + Number(c.upper) + Number(c.lower) + Number(c.number)
    + Number(/[^A-Za-z0-9]/.test(pwd)) + Number(pwd.length >= 14);
  if (score <= 2) return "fraca";
  if (score <= 4) return "media";
  return "forte";
}

export const PASSWORD_REQUIREMENTS_MSG =
  "A senha deve ter ao menos 10 caracteres, com letra maiúscula, minúscula e número.";
