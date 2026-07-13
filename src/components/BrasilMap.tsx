import { useState } from "react";
import { BR_STATES, BR_VIEWBOX, UF_TO_NOME } from "@/lib/estados-brasil";
import { X } from "lucide-react";

type Rep = { id: string; nome: string };
type Props = {
  counts: Record<string, number>;
  repsByUf?: Record<string, Rep[]>;
};

const colorFor = (n: number) => {
  if (!n) return "#e5e7eb";
  if (n === 1) return "#86efac";
  if (n === 2) return "#22c55e";
  return "#15803d";
};

export function BrasilMap({ counts, repsByUf }: Props) {
  const [hover, setHover] = useState<{ uf: string; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const selectedReps = selected ? repsByUf?.[selected] ?? [] : [];

  return (
    <div className="relative w-full">
      <svg
        viewBox={BR_VIEWBOX}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto"
        onMouseLeave={() => setHover(null)}
      >
        {BR_STATES.map((s) => {
          const n = counts[s.sigla] ?? 0;
          const isSelected = selected === s.sigla;
          return (
            <path
              key={s.sigla}
              data-uf={s.sigla}
              d={s.d}
              fill={colorFor(n)}
              stroke={isSelected ? "#0f172a" : "#ffffff"}
              strokeWidth={isSelected ? 1.6 : 0.8}
              className="transition-opacity hover:opacity-80 cursor-pointer"
              onMouseMove={(e) => {
                const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setHover({ uf: s.sigla, x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
              onClick={() => setSelected((cur) => (cur === s.sigla ? null : s.sigla))}
            />
          );
        })}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-md bg-popover text-popover-foreground border px-2 py-1 text-xs shadow-md"
          style={{ left: hover.x + 10, top: hover.y + 10 }}
        >
          <div className="font-medium">{UF_TO_NOME[hover.uf]}</div>
          <div className="text-muted-foreground">
            {counts[hover.uf] ?? 0} representante{(counts[hover.uf] ?? 0) === 1 ? "" : "s"}
          </div>
        </div>
      )}

      {selected && (
        <div className="mt-4 rounded-md border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-semibold">{UF_TO_NOME[selected]} ({selected})</div>
              <div className="text-xs text-muted-foreground">
                {selectedReps.length} representante{selectedReps.length === 1 ? "" : "s"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="p-1 rounded hover:bg-accent text-muted-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {selectedReps.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">Nenhum representante ativo neste estado.</div>
          ) : (
            <ul className="max-h-48 overflow-y-auto space-y-1 text-sm">
              {selectedReps.map((r) => (
                <li key={r.id} className="px-2 py-1 rounded hover:bg-accent/50 truncate">
                  {r.nome}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        {[
          { c: "#e5e7eb", l: "Sem representantes" },
          { c: "#86efac", l: "1 representante" },
          { c: "#22c55e", l: "2 representantes" },
          { c: "#15803d", l: "3 ou mais" },
        ].map((it) => (
          <div key={it.l} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm border" style={{ background: it.c }} />
            <span className="text-muted-foreground">{it.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
