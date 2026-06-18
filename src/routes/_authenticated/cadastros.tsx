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
        </TabsList>
        <TabsContent value="clientes"><ClientesTab /></TabsContent>
        <TabsContent value="reps"><RepsTab /></TabsContent>
        <TabsContent value="cconfig"><CConfigTab /></TabsContent>
        <TabsContent value="metas"><MetasTab /></TabsContent>
        <TabsContent value="usuarios"><UsuariosTab /></TabsContent>
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
