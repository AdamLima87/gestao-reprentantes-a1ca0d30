import { checkPassword, passwordStrength, type PasswordCheck } from "@/lib/password";
import { Check, X } from "lucide-react";

export function PasswordStrengthMeter({ value }: { value: string }) {
  const c = checkPassword(value);
  const strength = value ? passwordStrength(value) : null;
  const pct = !value ? 0 : strength === "fraca" ? 33 : strength === "media" ? 66 : 100;
  const color =
    strength === "forte" ? "bg-green-500"
    : strength === "media" ? "bg-yellow-500"
    : "bg-red-500";
  const label =
    strength === "forte" ? "Forte"
    : strength === "media" ? "Média"
    : strength === "fraca" ? "Fraca"
    : "—";

  return (
    <div className="mt-2 space-y-2">
      <div className="h-1.5 w-full rounded bg-muted overflow-hidden">
        <div className={`h-full transition-all ${value ? color : ""}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-muted-foreground">Força: <span className="font-medium">{label}</span></div>
      <ul className="text-xs space-y-0.5">
        <Req ok={c.length} text="Mínimo 10 caracteres" />
        <Req ok={c.upper} text="1 letra maiúscula" />
        <Req ok={c.lower} text="1 letra minúscula" />
        <Req ok={c.number} text="1 número" />
      </ul>
    </div>
  );
}

function Req({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className={`flex items-center gap-1.5 ${ok ? "text-green-600" : "text-muted-foreground"}`}>
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {text}
    </li>
  );
}

export function isPasswordOk(value: string): boolean {
  const c: PasswordCheck = checkPassword(value);
  return c.length && c.upper && c.lower && c.number;
}
