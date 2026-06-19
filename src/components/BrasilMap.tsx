import { useState } from "react";
import { BR_STATES, BR_VIEWBOX, UF_TO_NOME } from "@/lib/estados-brasil";

type Props = { counts: Record<string, number> };

const colorFor = (n: number) => {
  if (!n) return "#e5e7eb";
  if (n === 1) return "#86efac";
  if (n === 2) return "#22c55e";
  return "#15803d";
};

export function BrasilMap({ counts }: Props) {
  const [hover, setHover] = useState<{ uf: string; x: number; y: number } | null>(null);

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
          return (
            <path
              key={s.sigla}
              data-uf={s.sigla}
              d={s.d}
              fill={colorFor(n)}
              stroke="#ffffff"
              strokeWidth={0.8}
              className="transition-opacity hover:opacity-80 cursor-pointer"
              onMouseMove={(e) => {
                const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setHover({ uf: s.sigla, x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
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
