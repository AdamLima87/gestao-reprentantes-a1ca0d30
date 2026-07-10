import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDown, Loader2 } from "lucide-react";

const cache = new Map<string, string[]>();

async function fetchMunicipios(uf: string): Promise<string[]> {
  if (cache.has(uf)) return cache.get(uf)!;
  const res = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
  );
  if (!res.ok) throw new Error("Falha ao buscar municípios");
  const data = (await res.json()) as Array<{ nome: string }>;
  const nomes = data.map((m) => m.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
  cache.set(uf, nomes);
  return nomes;
}

export function CidadesMultiselect({
  uf,
  selecionadas,
  onChange,
}: {
  uf: string;
  selecionadas: string[];
  onChange: (cidades: string[]) => void;
}) {
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setErro(null);
    setLoading(true);
    fetchMunicipios(uf)
      .then((m) => {
        if (!cancelado) setMunicipios(m);
      })
      .catch((e) => {
        if (!cancelado) setErro(e?.message ?? "Erro ao carregar cidades");
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [uf]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return municipios;
    return municipios.filter((m) => m.toLowerCase().includes(q));
  }, [municipios, busca]);

  const toggle = (nome: string) => {
    if (selecionadas.includes(nome)) {
      onChange(selecionadas.filter((c) => c !== nome));
    } else {
      onChange([...selecionadas, nome]);
    }
  };

  return (
    <div className="mt-1.5 ml-4 space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full justify-between text-xs font-normal"
          >
            <span className="truncate text-muted-foreground">
              {selecionadas.length === 0
                ? "Todas as cidades (padrão)"
                : `${selecionadas.length} cidade(s) selecionada(s)`}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <Input
            placeholder="Buscar cidade…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-8 text-xs mb-2"
          />
          <div className="max-h-64 overflow-y-auto">
            {loading && (
              <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Carregando cidades…
              </div>
            )}
            {erro && <div className="p-2 text-xs text-destructive">{erro}</div>}
            {!loading && !erro && filtrados.length === 0 && (
              <div className="p-2 text-xs text-muted-foreground">Nenhuma cidade encontrada.</div>
            )}
            {!loading &&
              !erro &&
              filtrados.map((m) => {
                const checked = selecionadas.includes(m);
                return (
                  <label
                    key={m}
                    className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(m)}
                      className="h-3.5 w-3.5"
                    />
                    <span>{m}</span>
                  </label>
                );
              })}
          </div>
        </PopoverContent>
      </Popover>
      {selecionadas.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selecionadas.map((c) => (
            <Badge key={c} variant="outline" className="gap-1 pr-1 text-[10px] font-normal">
              {c}
              <button
                type="button"
                onClick={() => onChange(selecionadas.filter((x) => x !== c))}
                className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm hover:bg-muted-foreground/20"
                aria-label={`Remover ${c}`}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
