import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { createUser } from "@/lib/admin-users.functions";
import { fetchCnpj } from "@/lib/brasilapi";
import { gerarContratoPDF } from "@/lib/contrato-pdf";
import { FileText, Pencil, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cadastros")({
  component: CadastrosPage,
});

function CadastrosPage() {
  const { roles } = useAuth();
  if (!roles.includes("admin")) {
    return <p className="text-muted-foreground">Apenas administradores podem acessar os cadastros.</p>;
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Cadastros</h1>
      <Tabs defaultValue="clientes">
        <TabsList>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="reps">Representantes</TabsTrigger>
          <TabsTrigger value="cconfig">% por cliente</TabsTrigger>
          <TabsTrigger value="metas">Metas</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="importar">Importar</TabsTrigger>
        </TabsList>
        <TabsContent value="clientes"><ClientesTab /></TabsContent>
        <TabsContent value="reps"><RepsTab /></TabsContent>
        <TabsContent value="cconfig"><CConfigTab /></TabsContent>
        <TabsContent value="metas"><MetasTab /></TabsContent>
        <TabsContent value="usuarios"><UsuariosTab /></TabsContent>
        <TabsContent value="empresa"><EmpresaTab /></TabsContent>
        <TabsContent value="importar"><ImportarTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============== CLIENTES ==============
function ClientesTab() {
  const qc = useQueryClient();
  const { data: clientes } = useQuery({ queryKey: ["clientes-adm"], queryFn: async () => (await supabase.from("clientes").select("*, representantes(nome)").order("nome")).data ?? [] });
  const { data: reps } = useQuery({ queryKey: ["reps"], queryFn: async () => (await supabase.from("representantes").select("*").order("nome")).data ?? [] });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", cnpj: "", regiao: "", representante_id: "", ativo: true });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("clientes").insert({
      nome: form.nome, cnpj: form.cnpj || null, regiao: form.regiao || null,
      representante_id: form.representante_id || null, ativo: form.ativo,
    });
    if (error) return toast.error(error.message);
    toast.success("Cliente criado!");
    setOpen(false); setForm({ nome: "", cnpj: "", regiao: "", representante_id: "", ativo: true });
    qc.invalidateQueries({ queryKey: ["clientes-adm"] });
  };

  const toggleAtivo = async (id: string, v: boolean) => {
    await supabase.from("clientes").update({ ativo: v }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["clientes-adm"] });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Clientes</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>+ Novo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
                <div><Label>Região</Label><Input value={form.regiao} onChange={(e) => setForm({ ...form, regiao: e.target.value })} /></div>
              </div>
              <div><Label>Representante</Label>
                <Select value={form.representante_id} onValueChange={(v) => setForm({ ...form, representante_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{(reps ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>CNPJ</TableHead><TableHead>Região</TableHead><TableHead>Rep</TableHead><TableHead>Última compra</TableHead><TableHead>Ativo</TableHead></TableRow></TableHeader>
          <TableBody>
            {(clientes ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.nome}</TableCell>
                <TableCell>{c.cnpj ?? "—"}</TableCell>
                <TableCell>{c.regiao ?? "—"}</TableCell>
                <TableCell>{c.representantes?.nome ?? "—"}</TableCell>
                <TableCell>{c.ultima_compra_at ? new Date(c.ultima_compra_at).toLocaleDateString("pt-BR") : "—"}</TableCell>
                <TableCell><Switch checked={c.ativo} onCheckedChange={(v) => toggleAtivo(c.id, v)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============== REPS ==============
function RepsTab() {
  const qc = useQueryClient();
  const { data: reps } = useQuery({ queryKey: ["reps-adm"], queryFn: async () => (await supabase.from("representantes").select("*").order("nome")).data ?? [] });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", regiao: "", tipo: "externo" as "externo" | "interno", percentual_padrao: "5.0", ativo: true });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("representantes").insert({
      nome: form.nome, regiao: form.regiao || null, tipo: form.tipo,
      percentual_padrao: Number(form.percentual_padrao), ativo: form.ativo,
    });
    if (error) return toast.error(error.message);
    toast.success("Representante criado!");
    setOpen(false); setForm({ nome: "", regiao: "", tipo: "externo", percentual_padrao: "5.0", ativo: true });
    qc.invalidateQueries({ queryKey: ["reps-adm"] });
  };

  const toggleAtivo = async (id: string, v: boolean) => {
    await supabase.from("representantes").update({ ativo: v }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["reps-adm"] });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Representantes</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>+ Novo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo representante</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Região</Label><Input value={form.regiao} onChange={(e) => setForm({ ...form, regiao: e.target.value })} /></div>
                <div><Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as "externo" | "interno" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="externo">Externo</SelectItem>
                      <SelectItem value="interno">Interno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>% padrão</Label><Input type="number" step="0.01" value={form.percentual_padrao} onChange={(e) => setForm({ ...form, percentual_padrao: e.target.value })} /></div>
              <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Região</TableHead><TableHead>Tipo</TableHead><TableHead>% padrão</TableHead><TableHead>Ativo</TableHead></TableRow></TableHeader>
          <TableBody>
            {(reps ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.nome}</TableCell>
                <TableCell>{r.regiao ?? "—"}</TableCell>
                <TableCell>{r.tipo}</TableCell>
                <TableCell>{Number(r.percentual_padrao).toFixed(2)}%</TableCell>
                <TableCell><Switch checked={r.ativo} onCheckedChange={(v) => toggleAtivo(r.id, v)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============== COMISSAO CONFIG ==============
function CConfigTab() {
  const qc = useQueryClient();
  const { data: clientes } = useQuery({ queryKey: ["clientes"], queryFn: async () => (await supabase.from("clientes").select("id, nome").order("nome")).data ?? [] });
  const { data: reps } = useQuery({ queryKey: ["reps"], queryFn: async () => (await supabase.from("representantes").select("id, nome").order("nome")).data ?? [] });
  const { data: configs } = useQuery({ queryKey: ["cconfig"], queryFn: async () => (await supabase.from("comissao_config").select("*, clientes(nome), representantes(nome)").order("criado_em", { ascending: false })).data ?? [] });
  const [form, setForm] = useState({ cliente_id: "", representante_id: "", percentual: "" });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("comissao_config").upsert({
      cliente_id: form.cliente_id, representante_id: form.representante_id, percentual: Number(form.percentual),
    }, { onConflict: "cliente_id,representante_id" });
    if (error) return toast.error(error.message);
    toast.success("Configuração salva!");
    setForm({ cliente_id: "", representante_id: "", percentual: "" });
    qc.invalidateQueries({ queryKey: ["cconfig"] });
  };

  const del = async (id: string) => {
    await supabase.from("comissao_config").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["cconfig"] });
  };

  return (
    <Card>
      <CardHeader><CardTitle>% de comissão por cliente</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div><Label>Cliente</Label>
            <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{(clientes ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Representante</Label>
            <Select value={form.representante_id} onValueChange={(v) => setForm({ ...form, representante_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{(reps ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>%</Label><Input type="number" step="0.01" value={form.percentual} onChange={(e) => setForm({ ...form, percentual: e.target.value })} required /></div>
          <Button type="submit">Salvar</Button>
        </form>

        <Table>
          <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Rep</TableHead><TableHead>%</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {(configs ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.clientes?.nome}</TableCell>
                <TableCell>{c.representantes?.nome}</TableCell>
                <TableCell>{Number(c.percentual).toFixed(2)}%</TableCell>
                <TableCell><Button size="sm" variant="destructive" onClick={() => del(c.id)}>Remover</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============== METAS ==============
function MetasTab() {
  const qc = useQueryClient();
  const now = new Date();
  const { data: reps } = useQuery({ queryKey: ["reps"], queryFn: async () => (await supabase.from("representantes").select("id, nome").order("nome")).data ?? [] });
  const { data: metas } = useQuery({ queryKey: ["metas-adm"], queryFn: async () => (await supabase.from("metas").select("*, representantes(nome)").order("ano", { ascending: false }).order("mes", { ascending: false })).data ?? [] });
  const [form, setForm] = useState({ mes: String(now.getMonth() + 1), ano: String(now.getFullYear()), representante_id: "empresa", valor: "" });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("metas").upsert({
      mes: Number(form.mes), ano: Number(form.ano),
      representante_id: form.representante_id === "empresa" ? null : form.representante_id,
      valor: Number(form.valor),
    }, { onConflict: "mes,ano,representante_id" });
    if (error) return toast.error(error.message);
    toast.success("Meta salva!");
    qc.invalidateQueries({ queryKey: ["metas-adm"] });
  };

  return (
    <Card>
      <CardHeader><CardTitle>Metas mensais</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div><Label>Mês</Label>
            <Select value={form.mes} onValueChange={(v) => setForm({ ...form, mes: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Ano</Label><Input type="number" value={form.ano} onChange={(e) => setForm({ ...form, ano: e.target.value })} /></div>
          <div><Label>Alvo</Label>
            <Select value={form.representante_id} onValueChange={(v) => setForm({ ...form, representante_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="empresa">Empresa (global)</SelectItem>
                {(reps ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required /></div>
          <Button type="submit">Salvar</Button>
        </form>

        <Table>
          <TableHeader><TableRow><TableHead>Mês/Ano</TableHead><TableHead>Alvo</TableHead><TableHead>Valor</TableHead></TableRow></TableHeader>
          <TableBody>
            {(metas ?? []).map((m) => (
              <TableRow key={m.id}>
                <TableCell>{String(m.mes).padStart(2, "0")}/{m.ano}</TableCell>
                <TableCell>{m.representantes?.nome ?? "Empresa"}</TableCell>
                <TableCell>{Number(m.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============== USUÁRIOS ==============
function UsuariosTab() {
  const qc = useQueryClient();
  const { data: profiles } = useQuery({
    queryKey: ["profiles-adm"],
    queryFn: async () => (await supabase.from("profiles").select("*, representantes(nome)").order("criado_em", { ascending: false })).data ?? [],
  });
  const { data: roles } = useQuery({
    queryKey: ["roles-adm"],
    queryFn: async () => (await supabase.from("user_roles").select("user_id, role")).data ?? [],
  });
  const { data: reps } = useQuery({ queryKey: ["reps"], queryFn: async () => (await supabase.from("representantes").select("id, nome").order("nome")).data ?? [] });

  const rolesByUser = new Map<string, string[]>();
  (roles ?? []).forEach((r) => {
    const arr = rolesByUser.get(r.user_id) ?? [];
    arr.push(r.role);
    rolesByUser.set(r.user_id, arr);
  });

  const updateRole = async (userId: string, currentRoles: string[], newRole: string) => {
    if (currentRoles.includes(newRole)) return;
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert({ user_id: userId, role: newRole as "admin" });
    qc.invalidateQueries({ queryKey: ["roles-adm"] });
    toast.success("Perfil atualizado.");
  };

  const updateRep = async (userId: string, repId: string) => {
    await supabase.from("profiles").update({ representante_id: repId === "none" ? null : repId }).eq("id", userId);
    qc.invalidateQueries({ queryKey: ["profiles-adm"] });
    toast.success("Representante vinculado.");
  };

  const callCreate = useServerFn(createUser);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "",
    role: "representante" as "admin" | "vendedor_interno" | "representante" | "financeiro",
    representante_id: "none",
  });

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await callCreate({
        data: {
          nome: form.nome,
          email: form.email,
          senha: form.senha,
          role: form.role,
          representante_id: form.representante_id === "none" ? null : form.representante_id,
        },
      });
      toast.success("Usuário criado!");
      setOpen(false);
      setForm({ nome: "", email: "", senha: "", role: "representante", representante_id: "none" });
      qc.invalidateQueries({ queryKey: ["profiles-adm"] });
      qc.invalidateQueries({ queryKey: ["roles-adm"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar usuário.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Usuários do sistema</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>+ Novo usuário</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
            <form onSubmit={submitNew} className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
              <div><Label>E-mail *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
              <div><Label>Senha provisória *</Label><Input type="text" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required minLength={6} /></div>
              <div><Label>Perfil *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as typeof form.role })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="vendedor_interno">Vendedor interno</SelectItem>
                    <SelectItem value="representante">Representante</SelectItem>
                    <SelectItem value="financeiro">Financeiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Representante vinculado</Label>
                <Select value={form.representante_id} onValueChange={(v) => setForm({ ...form, representante_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhum —</SelectItem>
                    {(reps ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Criando…" : "Criar usuário"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Perfil</TableHead><TableHead>Vinculado a representante</TableHead></TableRow></TableHeader>
          <TableBody>
            {(profiles ?? []).map((p) => {
              const userRoles = rolesByUser.get(p.id) ?? [];
              return (
                <TableRow key={p.id}>
                  <TableCell>{p.nome || "—"}</TableCell>
                  <TableCell>
                    <Select value={userRoles[0] ?? ""} onValueChange={(v) => updateRole(p.id, userRoles, v)}>
                      <SelectTrigger className="w-48"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="vendedor_interno">Vendedor interno</SelectItem>
                        <SelectItem value="representante">Representante</SelectItem>
                        <SelectItem value="financeiro">Financeiro</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={p.representante_id ?? "none"} onValueChange={(v) => updateRep(p.id, v)}>
                      <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Nenhum —</SelectItem>
                        {(reps ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============== IMPORTAR ==============
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let val = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { val += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { val += ch; }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',' || ch === ';') { cur.push(val); val = ""; }
      else if (ch === '\n') { cur.push(val); rows.push(cur); cur = []; val = ""; }
      else if (ch === '\r') { /* skip */ }
      else val += ch;
    }
  }
  if (val.length > 0 || cur.length > 0) { cur.push(val); rows.push(cur); }
  return rows.filter((r) => r.length > 1 || (r[0] && r[0].trim() !== ""));
}

function downloadCSV(filename: string, headers: string[], sample: string[]) {
  const csv = `${headers.join(";")}\n${sample.join(";")}\n`;
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ImportarTab() {
  return (
    <div className="space-y-6">
      <ImportClientesSection />
      <ImportPedidosSection />
    </div>
  );
}

// ---------- Importar Clientes ----------
type ClienteRow = { nome: string; cnpj: string; regiao: string; nome_representante: string; ativo: string };
const CLIENTE_HEADERS: (keyof ClienteRow)[] = ["nome", "cnpj", "regiao", "nome_representante", "ativo"];

function ImportClientesSection() {
  const qc = useQueryClient();
  const [rows, setRows] = useState<ClienteRow[]>([]);
  const [filename, setFilename] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; warnings: string[]; errors: { line: number; reason: string }[] } | null>(null);

  const handleFile = async (file: File) => {
    setResult(null); setFilename(file.name);
    const parsed = parseCSV(await file.text());
    if (parsed.length < 2) { toast.error("CSV vazio."); setRows([]); return; }
    const header = parsed[0].map((h) => h.trim().toLowerCase());
    const idx: Record<string, number> = {};
    CLIENTE_HEADERS.forEach((h) => { idx[h] = header.indexOf(h); });
    const missing = CLIENTE_HEADERS.filter((h) => idx[h] === -1);
    if (missing.length) { toast.error(`Cabeçalhos ausentes: ${missing.join(", ")}`); setRows([]); return; }
    setRows(parsed.slice(1).map((r) => ({
      nome: (r[idx.nome] ?? "").trim(),
      cnpj: (r[idx.cnpj] ?? "").trim(),
      regiao: (r[idx.regiao] ?? "").trim(),
      nome_representante: (r[idx.nome_representante] ?? "").trim(),
      ativo: (r[idx.ativo] ?? "").trim(),
    })));
  };

  const confirmar = async () => {
    if (!rows.length) return;
    setImporting(true);
    const errors: { line: number; reason: string }[] = [];
    const warnings: string[] = [];
    let ok = 0;
    const { data: reps } = await supabase.from("representantes").select("id, nome");
    const repByName = new Map((reps ?? []).map((r) => [r.nome.trim().toLowerCase(), r.id]));

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]; const line = i + 2;
      if (!r.nome) { errors.push({ line, reason: "nome vazio" }); continue; }
      let representante_id: string | null = null;
      if (r.nome_representante) {
        const rid = repByName.get(r.nome_representante.toLowerCase());
        if (rid) representante_id = rid;
        else warnings.push(`Linha ${line}: representante "${r.nome_representante}" não encontrado — cliente importado sem representante.`);
      }
      const ativo = !["nao", "não", "false", "0", "n"].includes(r.ativo.toLowerCase());
      const { error } = await supabase.from("clientes").insert({
        nome: r.nome, cnpj: r.cnpj || null, regiao: r.regiao || null,
        representante_id, ativo,
      });
      if (error) { errors.push({ line, reason: error.message }); continue; }
      ok++;
    }
    setResult({ ok, warnings, errors });
    setImporting(false);
    if (ok > 0) { toast.success(`${ok} cliente(s) importado(s).`); qc.invalidateQueries({ queryKey: ["clientes-adm"] }); }
    if (errors.length) toast.error(`${errors.length} erro(s).`);
  };

  return (
    <Card>
      <CardHeader><CardTitle>Importar Clientes</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>Instruções:</strong> baixe o modelo, preencha e faça upload. Separador <code>;</code>. O campo <code>nome_representante</code> deve bater exatamente com um representante cadastrado (caso contrário, o cliente é criado sem representante).</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline"
            onClick={() => downloadCSV("modelo-clientes.csv", CLIENTE_HEADERS as string[], ["ACME LTDA", "00.000.000/0001-00", "Sul", "João Silva", "sim"])}>
            Baixar modelo CSV
          </Button>
          <Input type="file" accept=".csv,text/csv" className="max-w-sm"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>

        {rows.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm">Prévia: <strong>{rows.length}</strong> linha(s) de <code>{filename}</code></p>
              <Button onClick={confirmar} disabled={importing}>{importing ? "Importando…" : "Confirmar importação"}</Button>
            </div>
            <div className="max-h-72 overflow-auto border rounded">
              <Table>
                <TableHeader><TableRow>{CLIENTE_HEADERS.map((h) => <TableHead key={h} className="text-xs">{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {rows.slice(0, 50).map((r, i) => (
                    <TableRow key={i}>{CLIENTE_HEADERS.map((h) => <TableCell key={h} className="text-xs font-mono">{r[h]}</TableCell>)}</TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 50 && <p className="text-xs text-muted-foreground p-2">Exibindo primeiras 50 linhas…</p>}
            </div>
          </>
        )}

        {result && (
          <div className="border rounded p-4 space-y-2">
            <p className="text-sm">✅ Importados: <strong>{result.ok}</strong> &nbsp;|&nbsp; ⚠️ Avisos: <strong>{result.warnings.length}</strong> &nbsp;|&nbsp; ❌ Erros: <strong>{result.errors.length}</strong></p>
            {result.warnings.length > 0 && (
              <ul className="text-xs text-amber-600 list-disc pl-5 max-h-40 overflow-auto">
                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
            {result.errors.length > 0 && (
              <ul className="text-xs text-destructive list-disc pl-5 max-h-40 overflow-auto">
                {result.errors.map((e, i) => <li key={i}>Linha {e.line}: {e.reason}</li>)}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Importar Pedidos (+ NF-e opcional) ----------
type PedidoRow = {
  numero_pedido: string; numero_pedido_cliente: string; nome_cliente: string; nome_representante: string;
  data_pedido: string; prazo_entrega: string; valor_produtos: string; mes_ref: string; ano_ref: string;
  status: string; vendedor_interno_participou: string;
  nfe_emitida: string; numero_nfe: string; valor_nfe: string; data_nfe: string; data_entrega_nfe: string;
};
const PEDIDO_HEADERS: (keyof PedidoRow)[] = [
  "numero_pedido", "numero_pedido_cliente", "nome_cliente", "nome_representante",
  "data_pedido", "prazo_entrega", "valor_produtos", "mes_ref", "ano_ref",
  "status", "vendedor_interno_participou",
  "nfe_emitida", "numero_nfe", "valor_nfe", "data_nfe", "data_entrega_nfe",
];

const isSim = (v: string) => ["sim", "s", "true", "1", "yes", "y"].includes(v.trim().toLowerCase());

function ImportPedidosSection() {
  const qc = useQueryClient();
  const [rows, setRows] = useState<PedidoRow[]>([]);
  const [filename, setFilename] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ pedidos: number; nfes: number; comissoes: number; errors: { line: number; reason: string }[] } | null>(null);

  const handleFile = async (file: File) => {
    setResult(null); setFilename(file.name);
    const parsed = parseCSV(await file.text());
    if (parsed.length < 2) { toast.error("CSV vazio."); setRows([]); return; }
    const header = parsed[0].map((h) => h.trim().toLowerCase());
    const idx: Record<string, number> = {};
    PEDIDO_HEADERS.forEach((h) => { idx[h] = header.indexOf(h); });
    const required: (keyof PedidoRow)[] = ["numero_pedido", "nome_cliente", "nome_representante", "data_pedido", "valor_produtos"];
    const missing = required.filter((h) => idx[h] === -1);
    if (missing.length) { toast.error(`Cabeçalhos obrigatórios ausentes: ${missing.join(", ")}`); setRows([]); return; }
    setRows(parsed.slice(1).map((r) => {
      const row = {} as PedidoRow;
      PEDIDO_HEADERS.forEach((h) => { row[h] = idx[h] >= 0 ? (r[idx[h]] ?? "").trim() : ""; });
      return row;
    }));
  };

  const confirmar = async () => {
    if (!rows.length) return;
    setImporting(true);
    const errors: { line: number; reason: string }[] = [];
    let pedidosOk = 0, nfesOk = 0, comissoesOk = 0;

    const { data: clientes } = await supabase.from("clientes").select("id, nome");
    const { data: reps } = await supabase.from("representantes").select("id, nome");
    const clienteByName = new Map((clientes ?? []).map((c) => [c.nome.trim().toLowerCase(), c.id]));
    const repByName = new Map((reps ?? []).map((r) => [r.nome.trim().toLowerCase(), r.id]));

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]; const line = i + 2;
      if (!r.numero_pedido || !r.nome_cliente) { errors.push({ line, reason: "numero_pedido ou nome_cliente vazios" }); continue; }
      const cliente_id = clienteByName.get(r.nome_cliente.toLowerCase());
      if (!cliente_id) { errors.push({ line, reason: `Cliente não encontrado: "${r.nome_cliente}"` }); continue; }
      let representante_id: string | null = null;
      if (r.nome_representante) {
        const rid = repByName.get(r.nome_representante.toLowerCase());
        if (!rid) { errors.push({ line, reason: `Representante não encontrado: "${r.nome_representante}"` }); continue; }
        representante_id = rid;
      }
      const data_pedido = r.data_pedido || new Date().toISOString().slice(0, 10);
      const d = new Date(data_pedido);
      const mes_ref = r.mes_ref ? Number(r.mes_ref) : d.getMonth() + 1;
      const ano_ref = r.ano_ref ? Number(r.ano_ref) : d.getFullYear();
      const status = (r.status || "pedido") as "pedido" | "producao" | "faturado" | "entregue" | "cancelado";

      const { data: pedidoIns, error: pedErr } = await supabase.from("pedidos").insert({
        numero_pedido: r.numero_pedido,
        numero_pedido_cliente: r.numero_pedido_cliente || null,
        cliente_id, representante_id,
        data_pedido, prazo_entrega: r.prazo_entrega || null,
        valor_produtos: Number(r.valor_produtos || 0),
        mes_ref, ano_ref, status,
        jefferson_participou: isSim(r.vendedor_interno_participou),
      }).select("id").single();
      if (pedErr || !pedidoIns) { errors.push({ line, reason: pedErr?.message ?? "falha ao inserir pedido" }); continue; }
      pedidosOk++;

      if (isSim(r.nfe_emitida)) {
        const data_nfe = r.data_nfe || data_pedido;
        const dn = new Date(data_nfe);
        const { error: nfeErr } = await supabase.from("nfe").insert({
          pedido_id: pedidoIns.id,
          numero_nfe: r.numero_nfe || r.numero_pedido,
          valor_nfe: Number(r.valor_nfe || r.valor_produtos || 0),
          data_nfe,
          data_entrega: r.data_entrega_nfe || null,
          mes_ref: dn.getMonth() + 1,
          ano_ref: dn.getFullYear(),
        });
        if (nfeErr) { errors.push({ line, reason: `NF-e: ${nfeErr.message}` }); continue; }
        nfesOk++;
        const { count } = await supabase.from("comissoes").select("id", { count: "exact", head: true }).eq("pedido_id", pedidoIns.id);
        comissoesOk += count ?? 0;
      }
    }

    setResult({ pedidos: pedidosOk, nfes: nfesOk, comissoes: comissoesOk, errors });
    setImporting(false);
    if (pedidosOk > 0) {
      toast.success(`${pedidosOk} pedido(s) importado(s).`);
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      qc.invalidateQueries({ queryKey: ["nfes"] });
      qc.invalidateQueries({ queryKey: ["comissoes"] });
    }
    if (errors.length) toast.error(`${errors.length} erro(s).`);
  };

  return (
    <Card>
      <CardHeader><CardTitle>Importar Pedidos</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>Instruções:</strong> baixe o modelo, preencha e faça upload. Separador <code>;</code>, datas no formato AAAA-MM-DD.</p>
          <p>Quando <code>nfe_emitida = sim</code>, o sistema cria também a NF-e vinculada usando <code>numero_nfe</code>, <code>valor_nfe</code>, <code>data_nfe</code> e <code>data_entrega_nfe</code>, e dispara o cálculo de comissões automaticamente.</p>
          <p>Status válidos: <code>pedido</code>, <code>producao</code>, <code>faturado</code>, <code>entregue</code>, <code>cancelado</code>.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline"
            onClick={() => downloadCSV("modelo-pedidos.csv", PEDIDO_HEADERS as string[],
              ["PED-001", "CLI-100", "ACME LTDA", "João Silva", "2026-06-01", "2026-06-15", "1500.00", "6", "2026", "faturado", "nao", "sim", "NFE-123", "1500.00", "2026-06-02", "2026-06-10"])}>
            Baixar modelo CSV
          </Button>
          <Input type="file" accept=".csv,text/csv" className="max-w-sm"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>

        {rows.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm">Prévia: <strong>{rows.length}</strong> linha(s) de <code>{filename}</code></p>
              <Button onClick={confirmar} disabled={importing}>{importing ? "Importando…" : "Confirmar importação"}</Button>
            </div>
            <div className="max-h-96 overflow-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Tipo</TableHead>
                    {PEDIDO_HEADERS.map((h) => <TableHead key={h} className="text-xs">{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 50).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {isSim(r.nfe_emitida)
                          ? <span className="text-emerald-600 font-medium">📄 Pedido + NF-e</span>
                          : <span className="text-muted-foreground">📋 Só pedido</span>}
                      </TableCell>
                      {PEDIDO_HEADERS.map((h) => <TableCell key={h} className="text-xs font-mono">{r[h]}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 50 && <p className="text-xs text-muted-foreground p-2">Exibindo primeiras 50 linhas…</p>}
            </div>
          </>
        )}

        {result && (
          <div className="border rounded p-4 space-y-2">
            <p className="text-sm">
              ✅ Pedidos importados: <strong>{result.pedidos}</strong> &nbsp;|&nbsp;
              📄 NF-es geradas: <strong>{result.nfes}</strong> &nbsp;|&nbsp;
              💰 Comissões calculadas: <strong>{result.comissoes}</strong> &nbsp;|&nbsp;
              ❌ Erros: <strong>{result.errors.length}</strong>
            </p>
            {result.errors.length > 0 && (
              <div className="max-h-72 overflow-auto border rounded">
                <Table>
                  <TableHeader><TableRow><TableHead>Linha</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {result.errors.map((e, i) => (
                      <TableRow key={i}><TableCell>{e.line}</TableCell><TableCell className="text-xs">{e.reason}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
