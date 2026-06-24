import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MotionTableRow, rowMotionProps } from "@/components/MotionTableRow";
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
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { createUser, listUsers, updateUser, deleteUser, listAllPermissions } from "@/lib/admin-users.functions";
import { fetchCnpj, fetchCpf } from "@/lib/brasilapi";
import { gerarContratoPDF } from "@/lib/contrato-pdf";
import { FileText, Pencil, Search, Download, Save, Edit3, Upload, ListChecks, AlertTriangle, Trash2, Loader2, X, Landmark } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PasswordStrengthMeter, isPasswordOk } from "@/components/password-strength-meter";
import { usePermissions, PERMISSION_KEYS, PERMISSION_LABELS, ROLE_DEFAULTS, type PermissionKey } from "@/hooks/use-permissions";
import { BR_STATES, NOME_TO_UF, regiaoDoEstado } from "@/lib/estados-brasil";
import { maskCNPJ } from "@/lib/masks";

export const Route = createFileRoute("/_authenticated/cadastros")({
  component: CadastrosPage,
});

function CadastrosPage() {
  const { roles } = useAuth();
  const { can } = usePermissions();
  const isAdmin = roles.includes("admin");

  const podeClientes = isAdmin || can("cadastrar_clientes");
  const podeReps = isAdmin || can("cadastrar_representantes");
  const podeImportar = isAdmin || can("importar_planilhas");
  const podeUsuarios = isAdmin;
  const podeEmpresa = isAdmin;

  if (!podeClientes && !podeReps && !podeImportar && !podeUsuarios && !podeEmpresa) {
    return <p className="text-muted-foreground">Você não tem permissão para acessar os cadastros.</p>;
  }

  const defaultTab = podeClientes
    ? "clientes"
    : podeReps
    ? "reps"
    : podeUsuarios
    ? "usuarios"
    : podeEmpresa
    ? "empresa"
    : "importar";

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="space-y-4">
      <h1 className="text-2xl font-bold">Cadastros</h1>
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {podeClientes && <TabsTrigger value="clientes">Clientes</TabsTrigger>}
          {podeReps && <TabsTrigger value="reps">Representantes</TabsTrigger>}
          {isAdmin && <TabsTrigger value="cconfig">% por cliente</TabsTrigger>}
          {isAdmin && <TabsTrigger value="metas">Metas</TabsTrigger>}
          {podeUsuarios && <TabsTrigger value="usuarios">Usuários</TabsTrigger>}
          {podeEmpresa && <TabsTrigger value="empresa">Empresa</TabsTrigger>}
          {podeImportar && <TabsTrigger value="importar">Importar</TabsTrigger>}
        </TabsList>
        {podeClientes && <TabsContent value="clientes"><ClientesTab /></TabsContent>}
        {podeReps && <TabsContent value="reps"><RepsTab /></TabsContent>}
        {isAdmin && <TabsContent value="cconfig"><CConfigTab /></TabsContent>}
        {isAdmin && <TabsContent value="metas"><MetasTab /></TabsContent>}
        {podeUsuarios && <TabsContent value="usuarios"><UsuariosTab /></TabsContent>}
        {podeEmpresa && <TabsContent value="empresa"><EmpresaTab /></TabsContent>}
        {podeImportar && <TabsContent value="importar"><ImportarTab /></TabsContent>}
      </Tabs>
    </motion.div>
  );
}


// ============== CLIENTES ==============
function ClientesTab() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const { data: clientes } = useQuery({ queryKey: ["clientes-adm"], queryFn: async () => (await supabase.from("clientes").select("*, representantes(nome)").order("nome")).data ?? [] });
  const { data: reps } = useQuery({ queryKey: ["reps"], queryFn: async () => (await supabase.from("representantes").select("*").order("nome")).data ?? [] });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "com_rep" | "interno" | "sem_vinculo">("todos");
  const [busca, setBusca] = useState("");
  const emptyForm = { nome: "", cnpj: "", estado: "", regiao: "", representante_id: "", atendimento_interno: false, ativo: true };
  const [form, setForm] = useState(emptyForm);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);

  const buscarCnpj = async () => {
    if (!form.cnpj.trim()) return toast.error("Informe o CNPJ.");
    setBuscandoCnpj(true);
    try {
      const d = await fetchCnpj(form.cnpj);
      setForm((f) => ({
        ...f,
        nome: d.razao_social || f.nome,
        estado: d.uf || f.estado,
        regiao: d.uf ? (regiaoDoEstado(d.uf) ?? f.regiao) : f.regiao,
      }));
      toast.success("Razão social preenchida pela BrasilAPI.");
    } catch (e: any) {
      toast.error(e?.message ?? "CNPJ não encontrado.");
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      nome: c.nome ?? "",
      cnpj: c.cnpj ? maskCNPJ(c.cnpj) : "",
      estado: c.estado ?? "",
      regiao: c.regiao ?? (c.estado ? regiaoDoEstado(c.estado) ?? "" : ""),
      representante_id: c.representante_id ?? "",
      atendimento_interno: !!c.atendimento_interno,
      ativo: !!c.ativo,
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      nome: form.nome,
      cnpj: form.cnpj || null,
      estado: form.estado || null,
      regiao: form.regiao || null,
      representante_id: form.representante_id || null,
      atendimento_interno: form.atendimento_interno,
      ativo: form.ativo,
    };
    const { error } = editing
      ? await supabase.from("clientes").update(payload).eq("id", editing.id)
      : await supabase.from("clientes").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Cliente atualizado!" : "Cliente criado!");
    setOpen(false); setEditing(null); setForm(emptyForm);
    qc.invalidateQueries({ queryKey: ["clientes-adm"] });
    qc.invalidateQueries({ queryKey: ["clientes"] });
  };

  const toggleAtivo = async (id: string, v: boolean) => {
    await supabase.from("clientes").update({ ativo: v }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["clientes-adm"] });
  };

  const abreviar = (nome: string) => {
    const parts = nome.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  };

  const normalize = (s: string) => (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const onlyDigits = (s: string) => (s ?? "").toString().replace(/\D/g, "");
  const buscaNorm = normalize(busca.trim());
  const buscaDigits = onlyDigits(busca);

  const filtrados = (clientes ?? []).filter((c: any) => {
    if (filtro === "com_rep" && !c.representante_id) return false;
    if (filtro === "interno" && !c.atendimento_interno) return false;
    if (filtro === "sem_vinculo" && (c.representante_id || c.atendimento_interno)) return false;
    if (!buscaNorm) return true;
    const nomeMatch = normalize(c.nome).includes(buscaNorm);
    const repMatch = normalize(c.representantes?.nome ?? "").includes(buscaNorm);
    const cnpjMatch = buscaDigits.length > 0 && onlyDigits(c.cnpj ?? "").includes(buscaDigits);
    return nomeMatch || repMatch || cnpjMatch;
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Clientes</CardTitle>
        <div className="flex items-center gap-3">
          <div className="relative" style={{ width: 320 }}>
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar por nome, CNPJ ou representante..."
              className="pl-8 pr-8"
            />
            {busca && (
              <button
                type="button"
                aria-label="Limpar pesquisa"
                onClick={() => setBusca("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            {can("cadastrar_clientes") && <DialogTrigger asChild><Button onClick={openNew}>+ Novo</Button></DialogTrigger>}
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
              <div>
                <Label>CNPJ</Label>
                <div className="flex gap-2">
                  <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })} placeholder="00.000.000/0000-00" inputMode="numeric" maxLength={18} />
                  <Button type="button" variant="outline" onClick={buscarCnpj} disabled={buscandoCnpj}>
                    {buscandoCnpj ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
                    {buscandoCnpj ? "Buscando…" : "Buscar"}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Estado</Label>
                  <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v, regiao: regiaoDoEstado(v) ?? "" })}>
                    <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>{BR_STATES.map((s) => <SelectItem key={s.sigla} value={s.sigla}>{s.sigla} — {s.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Região</Label><Input value={form.regiao} readOnly placeholder="—" /></div>
              </div>
              <div><Label>Representante</Label>
                <Select
                  value={form.representante_id}
                  onValueChange={(v) => setForm({ ...form, representante_id: v, atendimento_interno: v ? false : form.atendimento_interno })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{(reps ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.atendimento_interno}
                  disabled={!!form.representante_id}
                  onCheckedChange={(v) => setForm({ ...form, atendimento_interno: v, representante_id: v ? "" : form.representante_id })}
                />
                <Label className="!mt-0">Atendimento interno</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                <Label className="!mt-0">Ativo</Label>
              </div>
              <DialogFooter><Button type="submit">{editing ? "Salvar alterações" : "Salvar"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-2">
          {([
            ["todos", "Todos"],
            ["com_rep", "Com representante"],
            ["interno", "Atendimento interno"],
            ["sem_vinculo", "Sem vínculo"],
          ] as const).map(([k, label]) => (
            <Button key={k} size="sm" variant={filtro === k ? "default" : "outline"} onClick={() => setFiltro(k)}>{label}</Button>
          ))}
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>CNPJ</TableHead><TableHead>Região</TableHead><TableHead>Representante</TableHead><TableHead>Atendimento</TableHead><TableHead>Última compra</TableHead><TableHead>Ativo</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtrados.map((c: any, index: number) => (
              <MotionTableRow key={c.id} {...rowMotionProps(index)}>
                <TableCell>{c.nome}</TableCell>
                <TableCell>{c.cnpj ? maskCNPJ(c.cnpj) : "—"}</TableCell>
                <TableCell>{c.regiao ?? "—"}</TableCell>
                <TableCell>{c.representantes?.nome ?? "—"}</TableCell>
                <TableCell>
                  {c.atendimento_interno ? (
                    <Badge className="bg-blue-600 hover:bg-blue-600 text-white">Interno</Badge>
                  ) : c.representantes?.nome ? (
                    <Badge variant="secondary">{abreviar(c.representantes.nome)}</Badge>
                  ) : "—"}
                </TableCell>
                <TableCell>{c.ultima_compra_at ? new Date(c.ultima_compra_at).toLocaleDateString("pt-BR") : "—"}</TableCell>
                <TableCell><Switch checked={c.ativo} onCheckedChange={(v) => toggleAtivo(c.id, v)} /></TableCell>
                <TableCell><Button size="sm" variant="outline" onClick={() => openEdit(c)}>Editar</Button></TableCell>
              </MotionTableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}


// ============== REPS ==============
type RepFormState = {
  nome: string; regiao: string; estados: string[]; tipo: "externo" | "interno"; percentual_padrao: string; ativo: boolean;
  tipo_pessoa: "juridica" | "fisica";
  cnpj: string; razao_social: string; endereco: string; numero: string; bairro: string; cidade: string; estado: string; cep: string; nome_socio: string;
  cpf: string; nome_completo: string; rg: string; data_nascimento: string;
  banco: string; tipo_conta: string; agencia: string; conta_digito: string; chave_pix: string; titular_conta: string; cpf_cnpj_titular: string;
};
const emptyRepForm: RepFormState = {
  nome: "", regiao: "", estados: [], tipo: "externo", percentual_padrao: "5.0", ativo: true,
  tipo_pessoa: "juridica",
  cnpj: "", razao_social: "", endereco: "", numero: "", bairro: "", cidade: "", estado: "", cep: "", nome_socio: "",
  cpf: "", nome_completo: "", rg: "", data_nascimento: "",
  banco: "", tipo_conta: "", agencia: "", conta_digito: "", chave_pix: "", titular_conta: "", cpf_cnpj_titular: "",
};


const emptyEnderecoFields = {
  cnpj: "", razao_social: "", endereco: "", numero: "", bairro: "", cidade: "", estado: "", cep: "", nome_socio: "",
  cpf: "", nome_completo: "", rg: "", data_nascimento: "",
};

function RepFormFields({ form, setForm }: { form: RepFormState; setForm: (f: RepFormState) => void }) {
  const [buscando, setBuscando] = useState(false);
  const [buscandoCpf, setBuscandoCpf] = useState(false);
  const buscarCnpj = async () => {
    if (!form.cnpj.trim()) return toast.error("Informe o CNPJ.");
    setBuscando(true);
    try {
      const d = await fetchCnpj(form.cnpj);
      setForm({
        ...form,
        razao_social: d.razao_social,
        endereco: d.logradouro, numero: d.numero, bairro: d.bairro,
        cidade: d.municipio, estado: d.uf, cep: d.cep,
      });
      toast.success("Dados preenchidos pela BrasilAPI.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao consultar CNPJ.");
    } finally { setBuscando(false); }
  };
  const buscarCpf = async () => {
    if (!form.cpf.trim()) return toast.error("Informe o CPF.");
    setBuscandoCpf(true);
    try {
      const d = await fetchCpf(form.cpf);
      if (d.nome) {
        setForm({ ...form, nome_completo: d.nome });
        toast.success("Nome preenchido pela BrasilAPI.");
      } else {
        toast.message("CPF válido, mas nome não disponível na API.");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao consultar CPF.");
    } finally { setBuscandoCpf(false); }
  };
  const onTipoPessoaChange = (v: "juridica" | "fisica") => {
    setForm({ ...form, ...emptyEnderecoFields, tipo_pessoa: v });
  };
  return (
    <>
      <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Estados de cobertura</Label>
          <Select
            value=""
            onValueChange={(v) => {
              if (!v) return;
              if (form.estados.includes(v)) return;
              setForm({ ...form, estados: [...form.estados, v] });
            }}
          >
            <SelectTrigger><SelectValue placeholder="Adicionar estado…" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {BR_STATES.filter((s) => !form.estados.includes(s.sigla)).map((s) => (
                <SelectItem key={s.sigla} value={s.sigla}>{s.sigla} — {s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.estados.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {form.estados.map((uf) => (
                <Badge key={uf} variant="secondary" className="gap-1 pr-1">
                  {uf}
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, estados: form.estados.filter((x) => x !== uf) })}
                    className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-sm hover:bg-muted-foreground/20"
                    aria-label={`Remover ${uf}`}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
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

      {form.tipo === "externo" && (
        <div>
          <Label>Tipo de pessoa</Label>
          <Select value={form.tipo_pessoa} onValueChange={(v) => onTipoPessoaChange(v as "juridica" | "fisica")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
              <SelectItem value="fisica">Pessoa Física</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3">
        <Label>% comissão padrão *</Label>
        <Input type="number" step="0.01" className="text-lg font-semibold" value={form.percentual_padrao} onChange={(e) => setForm({ ...form, percentual_padrao: e.target.value })} required />
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">⚠️ Este percentual será utilizado no contrato. Confirme antes de salvar.</p>
      </div>
      {form.tipo === "externo" && form.tipo_pessoa === "juridica" && (
        <div className="space-y-3 rounded border p-3 bg-muted/30">
          <div>
            <Label>CNPJ</Label>
            <div className="flex gap-2">
              <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })} placeholder="00.000.000/0000-00" inputMode="numeric" maxLength={18} />
              <Button type="button" variant="outline" onClick={buscarCnpj} disabled={buscando}>
                <Search className="h-4 w-4 mr-1" />{buscando ? "Buscando…" : "Buscar"}
              </Button>
            </div>
          </div>
          <div><Label>Razão Social</Label><Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Label>Endereço</Label><Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></div>
            <div><Label>Número</Label><Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Bairro</Label><Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} /></div>
            <div><Label>CEP</Label><Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
            <div><Label>Estado</Label><Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} maxLength={2} /></div>
          </div>
          <div><Label>Nome do sócio responsável</Label><Input value={form.nome_socio} onChange={(e) => setForm({ ...form, nome_socio: e.target.value })} /></div>
        </div>
      )}
      {form.tipo === "externo" && form.tipo_pessoa === "fisica" && (
        <div className="space-y-3 rounded border p-3 bg-muted/30">
          <div>
            <Label>CPF</Label>
            <div className="flex gap-2">
              <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
              <Button type="button" variant="outline" onClick={buscarCpf} disabled={buscandoCpf}>
                <Search className="h-4 w-4 mr-1" />{buscandoCpf ? "Buscando…" : "Buscar"}
              </Button>
            </div>
          </div>
          <div><Label>Nome completo</Label><Input value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>RG</Label><Input value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} /></div>
            <div><Label>Data de nascimento</Label><Input type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Label>Endereço</Label><Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></div>
            <div><Label>Número</Label><Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Bairro</Label><Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} /></div>
            <div><Label>CEP</Label><Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
            <div><Label>Estado</Label><Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} maxLength={2} /></div>
          </div>
        </div>
      )}

      <Separator className="my-2" />
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold">Dados Bancários</h4>
          <p className="text-xs text-muted-foreground">Opcional — usado no extrato de pagamento de comissões.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Banco</Label><Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} placeholder="Ex: Bradesco, Itaú, Nubank" /></div>
          <div>
            <Label>Tipo de conta</Label>
            <Select value={form.tipo_conta} onValueChange={(v) => setForm({ ...form, tipo_conta: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="corrente">Conta Corrente</SelectItem>
                <SelectItem value="poupanca">Conta Poupança</SelectItem>
                <SelectItem value="pagamento">Conta de Pagamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Agência</Label><Input value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} placeholder="0000" /></div>
          <div><Label>Conta com dígito</Label><Input value={form.conta_digito} onChange={(e) => setForm({ ...form, conta_digito: e.target.value })} placeholder="00000-0" /></div>
        </div>
        <div><Label>Chave PIX</Label><Input value={form.chave_pix} onChange={(e) => setForm({ ...form, chave_pix: e.target.value })} placeholder="CPF/CNPJ, e-mail, telefone ou chave aleatória" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Titular da conta</Label><Input value={form.titular_conta} onChange={(e) => setForm({ ...form, titular_conta: e.target.value })} placeholder="Nome do titular" /></div>
          <div><Label>CPF/CNPJ do titular</Label><Input value={form.cpf_cnpj_titular} onChange={(e) => setForm({ ...form, cpf_cnpj_titular: e.target.value })} /></div>
        </div>
      </div>
    </>
  );
}

function RepsTab() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const { data: reps } = useQuery({ queryKey: ["reps-adm"], queryFn: async () => (await supabase.from("representantes").select("*").order("nome")).data ?? [] });
  const { data: empresa } = useQuery({ queryKey: ["empresa-cfg"], queryFn: async () => (await supabase.from("configuracoes_empresa").select("*").limit(1).maybeSingle()).data });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RepFormState>(emptyRepForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const payload = (f: RepFormState) => {
    const isExt = f.tipo === "externo";
    const isPJ = isExt && f.tipo_pessoa === "juridica";
    const isPF = isExt && f.tipo_pessoa === "fisica";
    const regiaoPrincipal = f.estados[0] ? (regiaoDoEstado(f.estados[0]) ?? f.estados[0]) : null;
    return {
      nome: f.nome, regiao: regiaoPrincipal, estados: f.estados, tipo: f.tipo,
      percentual_padrao: Number(f.percentual_padrao), ativo: f.ativo,
      tipo_pessoa: isExt ? f.tipo_pessoa : "juridica",
      cnpj: isPJ ? (f.cnpj || null) : null,
      razao_social: isPJ ? (f.razao_social || null) : null,
      nome_socio: isPJ ? (f.nome_socio || null) : null,
      cpf: isPF ? (f.cpf || null) : null,
      nome_completo: isPF ? (f.nome_completo || null) : null,
      rg: isPF ? (f.rg || null) : null,
      data_nascimento: isPF ? (f.data_nascimento || null) : null,
      endereco: isExt ? (f.endereco || null) : null,
      numero: isExt ? (f.numero || null) : null,
      bairro: isExt ? (f.bairro || null) : null,
      cidade: isExt ? (f.cidade || null) : null,
      estado: isExt ? (f.estado || null) : null,
      cep: isExt ? (f.cep || null) : null,
      banco: f.banco || null,
      tipo_conta: f.tipo_conta || null,
      agencia: f.agencia || null,
      conta_digito: f.conta_digito || null,
      chave_pix: f.chave_pix || null,
      titular_conta: f.titular_conta || null,
      cpf_cnpj_titular: f.cpf_cnpj_titular || null,
    };
  };


  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = payload(form);
    const { error } = editingId
      ? await supabase.from("representantes").update(data).eq("id", editingId)
      : await supabase.from("representantes").insert(data);
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Representante atualizado!" : "Representante criado!");
    setOpen(false); setEditingId(null); setForm(emptyRepForm);
    qc.invalidateQueries({ queryKey: ["reps-adm"] });
  };

  const openNovo = () => { setEditingId(null); setForm(emptyRepForm); setOpen(true); };
  const openEdit = (r: any) => {
    setEditingId(r.id);
    const regiaoLegacy = ((): string => { const raw = String(r.regiao ?? "").trim(); if (!raw) return ""; if (raw.length === 2) return raw.toUpperCase(); return NOME_TO_UF[raw.toLowerCase()] ?? ""; })();
    const estadosArr: string[] = Array.isArray(r.estados) && r.estados.length > 0
      ? (r.estados as string[]).map((s) => String(s).toUpperCase())
      : (regiaoLegacy ? [regiaoLegacy] : []);
    setForm({
      nome: r.nome ?? "", regiao: regiaoLegacy, estados: estadosArr, tipo: (r.tipo ?? "externo") as "externo" | "interno",
      percentual_padrao: String(r.percentual_padrao ?? "5.0"), ativo: r.ativo ?? true,
      tipo_pessoa: (r.tipo_pessoa ?? "juridica") as "juridica" | "fisica",
      cnpj: r.cnpj ?? "", razao_social: r.razao_social ?? "",
      endereco: r.endereco ?? "", numero: r.numero ?? "", bairro: r.bairro ?? "",
      cidade: r.cidade ?? "", estado: r.estado ?? "", cep: r.cep ?? "", nome_socio: r.nome_socio ?? "",
      cpf: r.cpf ?? "", nome_completo: r.nome_completo ?? "", rg: r.rg ?? "", data_nascimento: r.data_nascimento ?? "",
      banco: r.banco ?? "", tipo_conta: r.tipo_conta ?? "", agencia: r.agencia ?? "",
      conta_digito: r.conta_digito ?? "", chave_pix: r.chave_pix ?? "",
      titular_conta: r.titular_conta ?? "", cpf_cnpj_titular: r.cpf_cnpj_titular ?? "",
    });
    setOpen(true);
  };


  const toggleAtivo = async (id: string, v: boolean) => {
    await supabase.from("representantes").update({ ativo: v }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["reps-adm"] });
  };

  const gerarContrato = async (r: any) => {
    const { data: empresaDb, error } = await supabase
      .from("configuracoes_empresa")
      .select("*")
      .limit(1)
      .maybeSingle();
    
    if (error || !empresaDb) {
      toast.error("Configure os dados da empresa primeiro (aba Empresa).");
      return;
    }
    gerarContratoPDF(empresaDb, { ...r, percentual_padrao: Number(r.percentual_padrao ?? 0) });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Representantes</CardTitle>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm(emptyRepForm); } }}>
          {can("cadastrar_representantes") && <DialogTrigger asChild><Button onClick={openNovo}>+ Novo</Button></DialogTrigger>}
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Editar representante" : "Novo representante"}</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <RepFormFields form={form} setForm={setForm} />
              <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Estados</TableHead><TableHead>Tipo</TableHead><TableHead>% padrão</TableHead><TableHead>Ativo</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {(reps ?? []).map((r) => {
              const estadosArr: string[] = Array.isArray((r as any).estados) && (r as any).estados.length > 0
                ? ((r as any).estados as string[])
                : (r.regiao ? [String(r.regiao).length === 2 ? String(r.regiao).toUpperCase() : (NOME_TO_UF[String(r.regiao).toLowerCase()] ?? String(r.regiao).toUpperCase())] : []);
              const visiveis = estadosArr.slice(0, 3);
              const extras = estadosArr.length - visiveis.length;
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{r.nome}</span>
                      {(() => {
                        const ra: any = r;
                        const temBanco = !!(ra.banco || ra.agencia || ra.conta_digito || ra.chave_pix || ra.titular_conta);
                        if (!temBanco) return null;
                        return (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex text-emerald-600"><Landmark className="h-4 w-4" /></span>
                              </TooltipTrigger>
                              <TooltipContent>Dados bancários cadastrados</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })()}
                    </div>
                  </TableCell>
                  <TableCell>
                    {estadosArr.length === 0 ? "—" : (
                      <div className="flex flex-wrap gap-1">
                        {visiveis.map((uf) => (
                          <Badge key={uf} variant="secondary">{uf}</Badge>
                        ))}
                        {extras > 0 && <Badge variant="outline" className="bg-muted text-muted-foreground">+{extras}</Badge>}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{r.tipo}</TableCell>
                  <TableCell>{Number(r.percentual_padrao).toFixed(2)}%</TableCell>
                  <TableCell><Switch checked={r.ativo} onCheckedChange={(v) => toggleAtivo(r.id, v)} /></TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5 mr-1" />Editar</Button>
                      {r.tipo === "externo" && can("gerar_contrato_pdf") && (
                        <Button size="sm" variant="outline" onClick={() => gerarContrato(r)}><FileText className="h-3.5 w-3.5 mr-1" />Gerar Contrato</Button>
                      )}
                    </div>
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

// ============== EMPRESA ==============
function EmpresaTab() {
  const qc = useQueryClient();
  const { data: empresa, isLoading } = useQuery({
    queryKey: ["empresa-cfg"],
    queryFn: async () => (await supabase.from("configuracoes_empresa").select("*").limit(1).maybeSingle()).data,
  });
  const [form, setForm] = useState({
    cnpj: "", razao_social: "", endereco: "", numero: "", bairro: "", cidade: "", estado: "", cep: "",
    nome_socio: "", email: "", telefone: "", logo_base64: "" as string,
  });
  const [loaded, setLoaded] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  if (empresa && !loaded) {
    setForm({
      cnpj: empresa.cnpj ?? "", razao_social: empresa.razao_social ?? "",
      endereco: empresa.endereco ?? "", numero: empresa.numero ?? "",
      bairro: empresa.bairro ?? "", cidade: empresa.cidade ?? "",
      estado: empresa.estado ?? "", cep: empresa.cep ?? "",
      nome_socio: empresa.nome_socio ?? "", email: empresa.email ?? "", telefone: empresa.telefone ?? "",
      logo_base64: (empresa as any).logo_base64 ?? "",
    });
    setLoaded(true);
  }

  const onLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/i.test(file.type)) return toast.error("Envie um arquivo PNG ou JPG.");
    if (file.size > 2 * 1024 * 1024) return toast.error("Logo deve ter no máximo 2MB.");
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, logo_base64: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };

  const buscar = async () => {
    if (!form.cnpj.trim()) return toast.error("Informe o CNPJ.");
    setBuscando(true);
    try {
      const d = await fetchCnpj(form.cnpj);
      setForm({
        ...form,
        razao_social: d.razao_social,
        endereco: d.logradouro,
        numero: d.numero,
        bairro: d.bairro,
        cidade: d.municipio,
        estado: d.uf,
        cep: d.cep,
      });
      toast.success("Dados preenchidos pela BrasilAPI.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao consultar CNPJ.");
    } finally { setBuscando(false); }
  };

  const EMPRESA_ID = "00000000-0000-0000-0000-000000000001";
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    const payload = { id: empresa?.id ?? EMPRESA_ID, ...form };
    const res = await supabase
      .from("configuracoes_empresa")
      .upsert(payload, { onConflict: "id" });
    setSalvando(false);
    if (res.error) return toast.error(res.error.message);
    toast.success("Dados da empresa salvos!");
    qc.invalidateQueries({ queryKey: ["empresa-cfg"] });
  };

  return (
    <Card>
      <CardHeader><CardTitle>Dados da empresa (REPRESENTADA)</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
          <form onSubmit={salvar} className="space-y-4 max-w-3xl">
            <div>
              <Label>CNPJ</Label>
              <div className="flex gap-2">
                <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })} placeholder="00.000.000/0000-00" inputMode="numeric" maxLength={18} />
                <Button type="button" variant="outline" onClick={buscar} disabled={buscando}>
                  <Search className="h-4 w-4 mr-1" />{buscando ? "Buscando…" : "Buscar"}
                </Button>
              </div>
            </div>
            <div><Label>Razão Social</Label><Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><Label>Endereço</Label><Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></div>
              <div><Label>Número</Label><Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Bairro</Label><Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} /></div>
              <div><Label>CEP</Label><Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
              <div><Label>Estado</Label><Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} maxLength={2} /></div>
            </div>
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium">Dados preenchidos manualmente</p>
              <div><Label>Nome do sócio administrador *</Label><Input value={form.nome_socio} onChange={(e) => setForm({ ...form, nome_socio: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
              </div>
            </div>
            <div className="border-t pt-4 space-y-2">
              <Label>Logo da empresa (PNG ou JPG)</Label>
              <Input type="file" accept="image/png,image/jpeg" onChange={onLogoUpload} />
              {form.logo_base64 && (
                <div className="flex items-center gap-3">
                  <img src={form.logo_base64} alt="Logo" className="h-20 max-w-[200px] object-contain border rounded" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, logo_base64: "" })}>Remover</Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Será exibido no topo do contrato em PDF (largura máxima 60mm).</p>
            </div>
            <Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

// ============== COMISSAO CONFIG ==============
function CConfigTab() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canEditPct = can("editar_percentual_cliente");
  const { data: clientes } = useQuery({ queryKey: ["clientes"], queryFn: async () => (await supabase.from("clientes").select("id, nome").order("nome")).data ?? [] });
  const { data: reps } = useQuery({ queryKey: ["reps"], queryFn: async () => (await supabase.from("representantes").select("id, nome").order("nome")).data ?? [] });
  const { data: configs } = useQuery({ queryKey: ["cconfig"], queryFn: async () => (await supabase.from("comissao_config").select("*, clientes(nome), representantes(nome)").order("criado_em", { ascending: false })).data ?? [] });
  const [form, setForm] = useState({ cliente_id: "", representante_id: "", percentual: "" });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditPct) return;
    const { error } = await supabase.from("comissao_config").upsert({
      cliente_id: form.cliente_id, representante_id: form.representante_id, percentual: Number(form.percentual),
    }, { onConflict: "cliente_id,representante_id" });
    if (error) return toast.error(error.message);
    toast.success("Configuração salva!");
    setForm({ cliente_id: "", representante_id: "", percentual: "" });
    qc.invalidateQueries({ queryKey: ["cconfig"] });
  };

  const del = async (id: string) => {
    if (!canEditPct) return;
    await supabase.from("comissao_config").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["cconfig"] });
  };

  return (
    <Card>
      <CardHeader><CardTitle>% de comissão por cliente</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        {canEditPct ? (
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
        ) : (
          <p className="text-sm text-muted-foreground">Você não tem permissão para editar os percentuais por cliente.</p>
        )}

        <Table>
          <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Rep</TableHead><TableHead>%</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {(configs ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.clientes?.nome}</TableCell>
                <TableCell>{c.representantes?.nome}</TableCell>
                <TableCell>{Number(c.percentual).toFixed(2)}%</TableCell>
                <TableCell>{canEditPct && <Button size="sm" variant="destructive" onClick={() => del(c.id)}>Remover</Button>}</TableCell>
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
  const { can } = usePermissions();
  const callList = useServerFn(listUsers);
  const callUpdate = useServerFn(updateUser);
  const callDelete = useServerFn(deleteUser);

  const { data: users } = useQuery({
    queryKey: ["users-adm"],
    queryFn: async () => await callList(),
  });
  const { data: reps } = useQuery({ queryKey: ["reps"], queryFn: async () => (await supabase.from("representantes").select("id, nome").order("nome")).data ?? [] });
  const callListPerms = useServerFn(listAllPermissions);
  const { data: allUserPerms } = useQuery({
    queryKey: ["user-permissions-all"],
    queryFn: async () => await callListPerms(),
  });

  const callCreate = useServerFn(createUser);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "",
    role: "representante" as "admin" | "vendedor_interno" | "representante" | "financeiro" | "gestor",
    representante_id: "none",
  });

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.senha || form.senha.length < 6) {
      toast.error("A senha provisória deve ter ao menos 6 caracteres.");
      return;
    }
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
      qc.invalidateQueries({ queryKey: ["users-adm"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar usuário.");
    } finally {
      setSaving(false);
    }
  };

  type PermTri = "default" | "granted" | "blocked";
  const emptyPerms = (): Record<PermissionKey, PermTri> =>
    Object.fromEntries(PERMISSION_KEYS.map((k) => [k, "default"])) as Record<PermissionKey, PermTri>;

  const [editing, setEditing] = useState<null | {
    userId: string;
    nome: string;
    email: string;
    senha: string;
    role: "admin" | "vendedor_interno" | "representante" | "financeiro" | "gestor";
    representante_id: string;
    perms: Record<PermissionKey, PermTri>;
  }>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const openEdit = (u: any) => {
    const perms = emptyPerms();
    for (const row of (allUserPerms ?? []) as unknown as Array<{ user_id: string; permissao: string; concedida: boolean }>) {
      if (row.user_id === u.id && (PERMISSION_KEYS as readonly string[]).includes(row.permissao)) {
        perms[row.permissao as PermissionKey] = row.concedida ? "granted" : "blocked";
      }
    }
    setEditing({
      userId: u.id,
      nome: u.nome ?? "",
      email: u.email ?? "",
      senha: "",
      role: (u.roles?.[0] ?? "representante") as any,
      representante_id: u.representante_id ?? "none",
      perms,
    });
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (editing.senha && editing.senha.length < 6) {
      toast.error("Nova senha provisória deve ter ao menos 6 caracteres.");
      return;
    }
    setSavingEdit(true);
    try {
      await callUpdate({
        data: {
          userId: editing.userId,
          nome: editing.nome,
          email: editing.email,
          senha: editing.senha || null,
          role: editing.role,
          representante_id: editing.representante_id === "none" ? null : editing.representante_id,
        },
      });

      // Persiste permissões personalizadas
      const toUpsert: Array<{ user_id: string; permissao: string; concedida: boolean }> = [];
      const toDelete: string[] = [];
      for (const k of PERMISSION_KEYS) {
        const v = editing.perms[k];
        if (v === "default") toDelete.push(k);
        else toUpsert.push({ user_id: editing.userId, permissao: k, concedida: v === "granted" });
      }
      if (toDelete.length) {
        await supabase
          .from("user_permissions" as any)
          .delete()
          .eq("user_id", editing.userId)
          .in("permissao", toDelete);
      }
      if (toUpsert.length) {
        await supabase
          .from("user_permissions" as any)
          .upsert(toUpsert, { onConflict: "user_id,permissao" });
      }
      qc.invalidateQueries({ queryKey: ["user-permissions-all"] });
      qc.invalidateQueries({ queryKey: ["user-permissions", editing.userId] });
      qc.invalidateQueries({ queryKey: ["users-adm"] });
      toast.success("Usuário atualizado!");
      setEditing(null);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao atualizar usuário.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (u: any) => {
    if (!confirm(`Excluir o usuário ${u.nome || u.email}? Esta ação não pode ser desfeita.`)) return;
    try {
      await callDelete({ data: { userId: u.id } });
      toast.success("Usuário excluído.");
      qc.invalidateQueries({ queryKey: ["users-adm"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao excluir usuário.");
    }
  };

  const { roles: currentRoles } = useAuth();
  const isAdmin = currentRoles.includes("admin");

  const roleLabel: Record<string, string> = {
    admin: "Admin",
    gestor: "Gestor",
    vendedor_interno: "Vendedor interno",
    representante: "Representante",
    financeiro: "Financeiro",
  };

  return (
    <div className="space-y-4">
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Usuários do sistema</CardTitle>
        {can("criar_usuarios") && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>+ Novo usuário</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
            <form onSubmit={submitNew} className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
              <div><Label>E-mail *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
              <div>
                <Label>Senha provisória *</Label>
                <Input type="text" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required minLength={6} />
                <p className="text-xs text-muted-foreground mt-1">
                  Pode ser qualquer senha com 6+ caracteres. O usuário será obrigado a trocá-la no primeiro acesso, atendendo aos requisitos de segurança.
                </p>
              </div>
              <div><Label>Perfil *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as typeof form.role })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
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
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Perfil</TableHead>
            <TableHead>Representante vinculado</TableHead>
            <TableHead className="w-32 text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(users ?? []).map((u: any) => {
              const userPerms = (allUserPerms ?? []) as unknown as Array<{ user_id: string; permissao: string; concedida: boolean }>;
              const role = (u.roles?.[0] ?? null) as keyof typeof ROLE_DEFAULTS | null;
              const defaults = role ? ROLE_DEFAULTS[role] : new Set<string>();
              const personalizado = userPerms.some((p) => {
                if (p.user_id !== u.id) return false;
                if (!(PERMISSION_KEYS as readonly string[]).includes(p.permissao)) return false;
                return p.concedida !== defaults.has(p.permissao as any);
              });
              return (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{u.nome || "—"}</span>
                    {personalizado && <Badge variant="outline" className="text-xs">Personalizado</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.email || "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{roleLabel[u.roles?.[0]] ?? "—"}</Badge>
                </TableCell>
                <TableCell>{u.representante_nome ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(u)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(u)} title="Excluir">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar usuário</DialogTitle></DialogHeader>
        {editing && (
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Dados do usuário</h3>
              <div><Label>Nome *</Label><Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} required /></div>
              <div><Label>E-mail *</Label><Input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} required /></div>
              <div>
                <Label>Nova senha provisória (opcional)</Label>
                <Input type="text" value={editing.senha} onChange={(e) => setEditing({ ...editing, senha: e.target.value })} placeholder="Deixe em branco para manter" />
                {editing.senha && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ao salvar, o usuário será obrigado a definir uma nova senha forte no próximo login.
                  </p>
                )}
              </div>
              <div><Label>Perfil *</Label>
                <Select value={editing.role} onValueChange={(v) => setEditing({ ...editing, role: v as typeof editing.role })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="vendedor_interno">Vendedor interno</SelectItem>
                    <SelectItem value="representante">Representante</SelectItem>
                    <SelectItem value="financeiro">Financeiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Representante vinculado</Label>
                <Select value={editing.representante_id} onValueChange={(v) => setEditing({ ...editing, representante_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhum —</SelectItem>
                    {(reps ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <h3 className="text-sm font-semibold">Permissões personalizadas</h3>
              <p className="text-xs text-muted-foreground">
                Padrão do perfil aplica as permissões base do perfil selecionado. Concedida ou Bloqueada sobrescreve esse padrão para este usuário.
              </p>
              <div className="space-y-2">
                {PERMISSION_KEYS.map((k) => {
                  const v = editing.perms[k];
                  const defaultOn = ROLE_DEFAULTS[editing.role]?.has(k) ?? false;
                  const setV = (nv: "default" | "granted" | "blocked") =>
                    setEditing({ ...editing, perms: { ...editing.perms, [k]: nv } });
                  return (
                    <div key={k} className="flex items-start justify-between gap-3 rounded-md border p-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{PERMISSION_LABELS[k].titulo}</div>
                        <div className="text-xs text-muted-foreground">{PERMISSION_LABELS[k].descricao}</div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={v === "default" ? "secondary" : "outline"}
                          onClick={() => setV("default")}
                          title={`Padrão do perfil (${defaultOn ? "permite" : "bloqueia"})`}
                        >
                          Padrão
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={v === "granted" ? "bg-green-600 text-white hover:bg-green-600" : ""}
                          onClick={() => setV("granted")}
                        >
                          Concedida
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={v === "blocked" ? "bg-red-600 text-white hover:bg-red-600" : ""}
                          onClick={() => setV("blocked")}
                        >
                          Bloqueada
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter><Button type="submit" disabled={savingEdit}>{savingEdit ? "Salvando…" : "Salvar alterações"}</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>

    {isAdmin && <AuditoriaAcessos />}
    </div>
  );
}


function AuditoriaAcessos() {
  const { data: tentativas } = useQuery({
    queryKey: ["login-attempts"],
    queryFn: async () => (await supabase
      .from("login_attempts")
      .select("id, email, sucesso, criado_em, ip")
      .order("criado_em", { ascending: false })
      .limit(50)).data ?? [],
    refetchInterval: 30000,
  });

  // Conta falhas consecutivas por email nas últimas 24h (sobre os 50 registros carregados)
  const limite24h = Date.now() - 24 * 60 * 60 * 1000;
  const falhasConsecutivas = new Map<string, number>();
  const ordenadoAsc = [...(tentativas ?? [])].reverse();
  for (const t of ordenadoAsc) {
    if (new Date(t.criado_em).getTime() < limite24h) continue;
    if (t.sucesso) {
      falhasConsecutivas.set(t.email, 0);
    } else {
      falhasConsecutivas.set(t.email, (falhasConsecutivas.get(t.email) ?? 0) + 1);
    }
  }
  const emailsSuspeitos = new Set(
    Array.from(falhasConsecutivas.entries()).filter(([, n]) => n > 3).map(([e]) => e),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auditoria de acessos</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Resultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(tentativas ?? []).map((t) => {
              const suspeito = !t.sucesso && emailsSuspeitos.has(t.email);
              return (
                <TableRow key={t.id} className={suspeito ? "bg-red-50 dark:bg-red-950/30" : ""}>
                  <TableCell>{new Date(t.criado_em).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="flex items-center gap-2">
                    {suspeito && <AlertTriangle className="h-4 w-4 text-red-600" />}
                    {t.email}
                  </TableCell>
                  <TableCell>{t.ip ?? "—"}</TableCell>
                  <TableCell>
                    {t.sucesso ? (
                      <Badge className="bg-green-600 hover:bg-green-600 text-white">Sucesso</Badge>
                    ) : (
                      <Badge variant="destructive">Falha</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {(tentativas ?? []).length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhuma tentativa registrada.</TableCell></TableRow>
            )}
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

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV(filename: string, headers: string[], sample: string[]) {
  downloadCSVRows(filename, headers, [sample]);
}

function downloadCSVRows(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const lines = [headers.map(csvEscape).join(";")];
  for (const r of rows) lines.push(r.map(csvEscape).join(";"));
  const csv = lines.join("\n") + "\n";
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Step UI helpers ----------
function StepCard({ n, icon, title, children }: { n: number; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="border-l-4 border-l-primary/60">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
            {n}
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-primary">{icon}</span>
              <h3 className="font-semibold">{title}</h3>
            </div>
            <div className="text-sm space-y-3">{children}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FileDropInput({ onFile, filename }: { onFile: (f: File) => void; filename?: string }) {
  return (
    <div className="space-y-2">
      <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-muted-foreground/30 rounded-md p-6 cursor-pointer hover:border-primary transition-colors bg-muted/30">
        <Upload className="h-6 w-6 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{filename ? `Selecionado: ${filename}` : "Arraste o arquivo aqui ou clique para selecionar"}</span>
        <span className="text-xs text-muted-foreground">Apenas arquivos .CSV</span>
        <Input type="file" accept=".csv,text/csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        <Button type="button" variant="default" className="mt-2" asChild>
          <span>Buscar planilha no meu computador</span>
        </Button>
      </label>
    </div>
  );
}

function ImportarTab() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="imp-cli">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="imp-cli">Importar Clientes</TabsTrigger>
          <TabsTrigger value="imp-ped">Importar Pedidos</TabsTrigger>
          <TabsTrigger value="edit-cli">Editar Clientes</TabsTrigger>
          <TabsTrigger value="edit-ped">Editar Pedidos</TabsTrigger>
        </TabsList>
        <TabsContent value="imp-cli" className="mt-4"><ImportClientesSection /></TabsContent>
        <TabsContent value="imp-ped" className="mt-4"><ImportPedidosSection /></TabsContent>
        <TabsContent value="edit-cli" className="mt-4"><EditClientesSection /></TabsContent>
        <TabsContent value="edit-ped" className="mt-4"><EditPedidosSection /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Importar Clientes ----------
type ClienteRow = { nome: string; cnpj: string; estado: string; nome_representante: string; ativo: string };
const CLIENTE_HEADERS: (keyof ClienteRow)[] = ["nome", "cnpj", "estado", "nome_representante", "ativo"];

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
      estado: (r[idx.estado] ?? "").trim().toUpperCase(),
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
      const estado = r.estado ? r.estado.toUpperCase() : null;
      const regiao = regiaoDoEstado(estado);
      if (estado && !regiao) warnings.push(`Linha ${line}: estado "${r.estado}" não reconhecido — região não preenchida.`);
      const { error } = await supabase.from("clientes").insert({
        nome: r.nome, cnpj: r.cnpj || null, estado, regiao,
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
    <div className="space-y-4">
      <StepCard n={1} icon={<Download className="h-5 w-5" />} title="Baixar planilha modelo">
        <p className="text-muted-foreground">Modelo com o cabeçalho correto e uma linha de exemplo. Separador <code>;</code>.</p>
        <Button className="bg-primary hover:bg-primary/90"
          onClick={() => downloadCSV("modelo-clientes.csv", CLIENTE_HEADERS as string[], ["ACME LTDA", "00.000.000/0001-00", "SP", "João Silva", "sim"])}>
          <Download className="h-4 w-4 mr-2" /> Baixar Planilha Modelo
        </Button>
      </StepCard>

      <StepCard n={2} icon={<Save className="h-5 w-5" />} title="Salvar planilha no computador">
        <p className="text-muted-foreground">Salve a planilha em local de fácil acesso. Ex.: Área de trabalho ou pasta Documentos.</p>
      </StepCard>

      <StepCard n={3} icon={<Edit3 className="h-5 w-5" />} title="Preencher as informações">
        <p className="text-muted-foreground">Abra a planilha e insira as informações nas colunas corretas sem modificar o cabeçalho. Não salve em uma nova planilha pois isso pode causar erros na importação.</p>
        <p className="text-xs text-muted-foreground">O campo <code>nome_representante</code> deve bater exatamente com um representante cadastrado.</p>
      </StepCard>

      <StepCard n={4} icon={<Upload className="h-5 w-5" />} title="Enviar planilha preenchida">
        <FileDropInput onFile={handleFile} filename={filename} />
      </StepCard>

      <StepCard n={5} icon={<ListChecks className="h-5 w-5" />} title="Conferir e confirmar importação">
        {rows.length === 0 && !result && <p className="text-muted-foreground">Aguardando upload da planilha…</p>}
        {rows.length > 0 && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm">Prévia: <strong>{rows.length}</strong> linha(s) de <code>{filename}</code></p>
              <Button onClick={confirmar} disabled={importing} className="bg-primary hover:bg-primary/90">
                {importing ? "Importando…" : "Confirmar importação"}
              </Button>
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
          <div className="border rounded p-4 space-y-2 bg-muted/30">
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
      </StepCard>
    </div>
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
    <div className="space-y-4">
      <StepCard n={1} icon={<Download className="h-5 w-5" />} title="Baixar planilha modelo">
        <p className="text-muted-foreground">Datas no formato AAAA-MM-DD. Quando <code>nfe_emitida = sim</code>, a NF-e é criada junto.</p>
        <Button className="bg-primary hover:bg-primary/90"
          onClick={() => downloadCSV("modelo-pedidos.csv", PEDIDO_HEADERS as string[],
            ["PED-001", "CLI-100", "ACME LTDA", "João Silva", "2026-06-01", "2026-06-15", "1500.00", "6", "2026", "faturado", "nao", "sim", "NFE-123", "1500.00", "2026-06-02", "2026-06-10"])}>
          <Download className="h-4 w-4 mr-2" /> Baixar Planilha Modelo
        </Button>
      </StepCard>

      <StepCard n={2} icon={<Save className="h-5 w-5" />} title="Salvar planilha no computador">
        <p className="text-muted-foreground">Salve a planilha em local de fácil acesso. Ex.: Área de trabalho ou pasta Documentos.</p>
      </StepCard>

      <StepCard n={3} icon={<Edit3 className="h-5 w-5" />} title="Preencher as informações">
        <p className="text-muted-foreground">Abra a planilha e insira as informações nas colunas corretas sem modificar o cabeçalho. Não salve em uma nova planilha pois isso pode causar erros na importação.</p>
        <p className="text-xs text-muted-foreground">Status válidos: <code>pedido</code>, <code>producao</code>, <code>faturado</code>, <code>entregue</code>, <code>cancelado</code>.</p>
      </StepCard>

      <StepCard n={4} icon={<Upload className="h-5 w-5" />} title="Enviar planilha preenchida">
        <FileDropInput onFile={handleFile} filename={filename} />
      </StepCard>

      <StepCard n={5} icon={<ListChecks className="h-5 w-5" />} title="Conferir e confirmar importação">
        {rows.length === 0 && !result && <p className="text-muted-foreground">Aguardando upload da planilha…</p>}
        {rows.length > 0 && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm">Prévia: <strong>{rows.length}</strong> linha(s) de <code>{filename}</code></p>
              <Button onClick={confirmar} disabled={importing} className="bg-primary hover:bg-primary/90">
                {importing ? "Importando…" : "Confirmar importação"}
              </Button>
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
          <div className="border rounded p-4 space-y-2 bg-muted/30">
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
      </StepCard>
    </div>
  );
}

// ---------- Editar Clientes ----------
const EDIT_CLIENTE_HEADERS = ["id", "nome", "cnpj", "estado", "nome_representante", "ativo"] as const;
type EditClienteCol = (typeof EDIT_CLIENTE_HEADERS)[number];

function EditClientesSection() {
  const qc = useQueryClient();
  const [filtroEstado, setFiltroEstado] = useState<string>("all");
  const [filtroRep, setFiltroRep] = useState<string>("all");
  const [filename, setFilename] = useState("");
  const [current, setCurrent] = useState<Record<string, Record<string, string>>>({});
  const [newRows, setNewRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ updated: number; errors: { id: string; reason: string }[] } | null>(null);

  const { data: reps } = useQuery({
    queryKey: ["reps-edit"],
    queryFn: async () => (await supabase.from("representantes").select("id, nome").order("nome")).data ?? [],
  });

  const baixar = async () => {
    let q = supabase.from("clientes").select("id, nome, cnpj, estado, ativo, representante_id, representantes(nome)").order("nome");
    if (filtroEstado !== "all") q = q.eq("estado", filtroEstado);
    if (filtroRep !== "all") q = q.eq("representante_id", filtroRep);
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    const rows = (data ?? []).map((c: any) => [
      c.id, c.nome ?? "", c.cnpj ?? "", c.estado ?? "",
      c.representantes?.nome ?? "", c.ativo ? "sim" : "nao",
    ]);
    downloadCSVRows("clientes-atuais.csv", EDIT_CLIENTE_HEADERS as unknown as string[], rows);
    toast.success(`${rows.length} cliente(s) exportado(s).`);
  };

  const handleFile = async (file: File) => {
    setResult(null); setFilename(file.name);
    const parsed = parseCSV(await file.text());
    if (parsed.length < 2) { toast.error("CSV vazio."); setNewRows([]); return; }
    const header = parsed[0].map((h) => h.trim().toLowerCase());
    const missing = EDIT_CLIENTE_HEADERS.filter((h) => header.indexOf(h) === -1);
    if (missing.length) { toast.error(`Cabeçalhos ausentes: ${missing.join(", ")}`); setNewRows([]); return; }
    const idx: Record<string, number> = {};
    EDIT_CLIENTE_HEADERS.forEach((h) => { idx[h] = header.indexOf(h); });
    const parsedRows = parsed.slice(1).map((r) => {
      const o: Record<string, string> = {};
      EDIT_CLIENTE_HEADERS.forEach((h) => { o[h] = (r[idx[h]] ?? "").trim(); });
      return o;
    }).filter((r) => r.id);
    setNewRows(parsedRows);

    const ids = parsedRows.map((r) => r.id);
    const { data } = await supabase.from("clientes").select("id, nome, cnpj, estado, ativo, representante_id, representantes(nome)").in("id", ids);
    const map: Record<string, Record<string, string>> = {};
    (data ?? []).forEach((c: any) => {
      map[c.id] = {
        id: c.id, nome: c.nome ?? "", cnpj: c.cnpj ?? "", estado: c.estado ?? "",
        nome_representante: c.representantes?.nome ?? "", ativo: c.ativo ? "sim" : "nao",
      };
    });
    setCurrent(map);
  };

  const confirmar = async () => {
    if (!newRows.length) return;
    setImporting(true);
    const errors: { id: string; reason: string }[] = [];
    let updated = 0;
    const { data: repsAll } = await supabase.from("representantes").select("id, nome");
    const repByName = new Map((repsAll ?? []).map((r) => [r.nome.trim().toLowerCase(), r.id]));

    for (const r of newRows) {
      const cur = current[r.id];
      if (!cur) { errors.push({ id: r.id, reason: "registro original não encontrado" }); continue; }
      const changed = EDIT_CLIENTE_HEADERS.some((h) => h !== "id" && (cur[h] ?? "") !== (r[h] ?? ""));
      if (!changed) continue;
      const estado = r.estado ? r.estado.toUpperCase() : null;
      const regiao = regiaoDoEstado(estado);
      const ativo = !["nao", "não", "false", "0", "n"].includes((r.ativo ?? "").toLowerCase());
      let representante_id: string | null = null;
      if (r.nome_representante) {
        representante_id = repByName.get(r.nome_representante.toLowerCase()) ?? null;
        if (!representante_id) { errors.push({ id: r.id, reason: `Representante não encontrado: "${r.nome_representante}"` }); continue; }
      }
      const { error } = await supabase.from("clientes").update({
        nome: r.nome, cnpj: r.cnpj || null, estado, regiao, representante_id, ativo,
      }).eq("id", r.id);
      if (error) { errors.push({ id: r.id, reason: error.message }); continue; }
      updated++;
    }
    setResult({ updated, errors });
    setImporting(false);
    if (updated > 0) { toast.success(`${updated} cliente(s) atualizado(s).`); qc.invalidateQueries({ queryKey: ["clientes-adm"] }); }
    if (errors.length) toast.error(`${errors.length} erro(s).`);
  };

  const diffRows = newRows.map((r) => {
    const cur = current[r.id];
    const changes: Record<string, { from: string; to: string }> = {};
    if (cur) {
      EDIT_CLIENTE_HEADERS.forEach((h) => {
        if (h !== "id" && (cur[h] ?? "") !== (r[h] ?? "")) changes[h] = { from: cur[h] ?? "", to: r[h] ?? "" };
      });
    }
    return { id: r.id, row: r, cur, changes };
  });
  const changedRows = diffRows.filter((d) => Object.keys(d.changes).length > 0);

  return (
    <div className="space-y-4">
      <StepCard n={1} icon={<Download className="h-5 w-5" />} title="Baixar dados atuais">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Filtrar por estado</Label>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {BR_STATES.map((s) => <SelectItem key={s.sigla} value={s.sigla}>{s.sigla} — {s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Filtrar por representante</Label>
            <Select value={filtroRep} onValueChange={setFiltroRep}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(reps ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={baixar} className="bg-primary hover:bg-primary/90">
          <Download className="h-4 w-4 mr-2" /> Baixar Planilha com os Dados Atuais
        </Button>
      </StepCard>

      <StepCard n={2} icon={<Save className="h-5 w-5" />} title="Salvar planilha no computador">
        <p className="text-muted-foreground">Salve a planilha em local de fácil acesso.</p>
      </StepCard>

      <StepCard n={3} icon={<Edit3 className="h-5 w-5" />} title="Editar as informações">
        <p className="text-muted-foreground">Abra a planilha e edite as informações necessárias sem modificar o cabeçalho e sem alterar a coluna <code>id</code>. Não salve em uma nova planilha.</p>
      </StepCard>

      <StepCard n={4} icon={<Upload className="h-5 w-5" />} title="Enviar planilha editada">
        <FileDropInput onFile={handleFile} filename={filename} />
      </StepCard>

      <StepCard n={5} icon={<ListChecks className="h-5 w-5" />} title="Conferir alterações e confirmar">
        {newRows.length === 0 && !result && <p className="text-muted-foreground">Aguardando upload da planilha…</p>}
        {newRows.length > 0 && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm">
                <strong>{changedRows.length}</strong> linha(s) com alterações · <strong>{newRows.length - changedRows.length}</strong> sem mudança
              </p>
              <Button onClick={confirmar} disabled={importing || changedRows.length === 0} className="bg-primary hover:bg-primary/90">
                {importing ? "Atualizando…" : "Confirmar edições"}
              </Button>
            </div>
            <div className="max-h-96 overflow-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">id</TableHead>
                    {EDIT_CLIENTE_HEADERS.filter((h) => h !== "id").map((h) => <TableHead key={h} className="text-xs">{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changedRows.slice(0, 100).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs font-mono">{d.id.slice(0, 8)}…</TableCell>
                      {EDIT_CLIENTE_HEADERS.filter((h) => h !== "id").map((h) => {
                        const isDiff = !!d.changes[h];
                        return (
                          <TableCell key={h} className={`text-xs ${isDiff ? "bg-yellow-100 dark:bg-yellow-900/40" : ""}`}>
                            {isDiff ? (
                              <div className="space-y-0.5">
                                <div className="text-muted-foreground line-through">{d.changes[h].from || "—"}</div>
                                <div className="font-medium">{d.changes[h].to || "—"}</div>
                              </div>
                            ) : (d.row[h] || "—")}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  {changedRows.length === 0 && (
                    <TableRow><TableCell colSpan={EDIT_CLIENTE_HEADERS.length} className="text-center text-muted-foreground text-xs py-4">Nenhuma alteração detectada.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              {changedRows.length > 100 && <p className="text-xs text-muted-foreground p-2">Exibindo primeiras 100 linhas alteradas…</p>}
            </div>
          </>
        )}
        {result && (
          <div className="border rounded p-4 space-y-2 bg-muted/30">
            <p className="text-sm">✅ Atualizados: <strong>{result.updated}</strong> &nbsp;|&nbsp; ❌ Erros: <strong>{result.errors.length}</strong></p>
            {result.errors.length > 0 && (
              <ul className="text-xs text-destructive list-disc pl-5 max-h-40 overflow-auto">
                {result.errors.map((e, i) => <li key={i}>{e.id}: {e.reason}</li>)}
              </ul>
            )}
          </div>
        )}
      </StepCard>
    </div>
  );
}

// ---------- Editar Pedidos ----------
const EDIT_PEDIDO_HEADERS = [
  "id", "numero_pedido", "numero_pedido_cliente", "nome_cliente", "nome_representante",
  "data_pedido", "prazo_entrega", "valor_produtos", "mes_ref", "ano_ref",
  "status", "vendedor_interno_participou",
] as const;

function EditPedidosSection() {
  const qc = useQueryClient();
  const [fMes, setFMes] = useState<string>("all");
  const [fAno, setFAno] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fRep, setFRep] = useState<string>("all");
  const [filename, setFilename] = useState("");
  const [current, setCurrent] = useState<Record<string, Record<string, string>>>({});
  const [newRows, setNewRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ updated: number; errors: { id: string; reason: string }[] } | null>(null);

  const { data: reps } = useQuery({
    queryKey: ["reps-edit"],
    queryFn: async () => (await supabase.from("representantes").select("id, nome").order("nome")).data ?? [],
  });

  const baixar = async () => {
    let q = supabase.from("pedidos").select("id, numero_pedido, numero_pedido_cliente, data_pedido, prazo_entrega, valor_produtos, mes_ref, ano_ref, status, jefferson_participou, cliente_id, representante_id, clientes(nome), representantes(nome)").order("data_pedido", { ascending: false });
    if (fMes !== "all") q = q.eq("mes_ref", Number(fMes));
    if (fAno !== "all") q = q.eq("ano_ref", Number(fAno));
    if (fStatus !== "all") q = q.eq("status", fStatus as any);
    if (fRep !== "all") q = q.eq("representante_id", fRep);
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    const rows = (data ?? []).map((p: any) => [
      p.id, p.numero_pedido ?? "", p.numero_pedido_cliente ?? "",
      p.clientes?.nome ?? "", p.representantes?.nome ?? "",
      p.data_pedido ?? "", p.prazo_entrega ?? "",
      p.valor_produtos ?? "", p.mes_ref ?? "", p.ano_ref ?? "",
      p.status ?? "", p.jefferson_participou ? "sim" : "nao",
    ]);
    downloadCSVRows("pedidos-atuais.csv", EDIT_PEDIDO_HEADERS as unknown as string[], rows);
    toast.success(`${rows.length} pedido(s) exportado(s).`);
  };

  const handleFile = async (file: File) => {
    setResult(null); setFilename(file.name);
    const parsed = parseCSV(await file.text());
    if (parsed.length < 2) { toast.error("CSV vazio."); setNewRows([]); return; }
    const header = parsed[0].map((h) => h.trim().toLowerCase());
    const missing = EDIT_PEDIDO_HEADERS.filter((h) => header.indexOf(h) === -1);
    if (missing.length) { toast.error(`Cabeçalhos ausentes: ${missing.join(", ")}`); setNewRows([]); return; }
    const idx: Record<string, number> = {};
    EDIT_PEDIDO_HEADERS.forEach((h) => { idx[h] = header.indexOf(h); });
    const parsedRows = parsed.slice(1).map((r) => {
      const o: Record<string, string> = {};
      EDIT_PEDIDO_HEADERS.forEach((h) => { o[h] = (r[idx[h]] ?? "").trim(); });
      return o;
    }).filter((r) => r.id);
    setNewRows(parsedRows);

    const ids = parsedRows.map((r) => r.id);
    const { data } = await supabase.from("pedidos").select("id, numero_pedido, numero_pedido_cliente, data_pedido, prazo_entrega, valor_produtos, mes_ref, ano_ref, status, jefferson_participou, clientes(nome), representantes(nome)").in("id", ids);
    const map: Record<string, Record<string, string>> = {};
    (data ?? []).forEach((p: any) => {
      map[p.id] = {
        id: p.id,
        numero_pedido: p.numero_pedido ?? "",
        numero_pedido_cliente: p.numero_pedido_cliente ?? "",
        nome_cliente: p.clientes?.nome ?? "",
        nome_representante: p.representantes?.nome ?? "",
        data_pedido: p.data_pedido ?? "",
        prazo_entrega: p.prazo_entrega ?? "",
        valor_produtos: String(p.valor_produtos ?? ""),
        mes_ref: String(p.mes_ref ?? ""),
        ano_ref: String(p.ano_ref ?? ""),
        status: p.status ?? "",
        vendedor_interno_participou: p.jefferson_participou ? "sim" : "nao",
      };
    });
    setCurrent(map);
  };

  const confirmar = async () => {
    if (!newRows.length) return;
    setImporting(true);
    const errors: { id: string; reason: string }[] = [];
    let updated = 0;
    const { data: clientesAll } = await supabase.from("clientes").select("id, nome");
    const { data: repsAll } = await supabase.from("representantes").select("id, nome");
    const clienteByName = new Map((clientesAll ?? []).map((c) => [c.nome.trim().toLowerCase(), c.id]));
    const repByName = new Map((repsAll ?? []).map((r) => [r.nome.trim().toLowerCase(), r.id]));

    for (const r of newRows) {
      const cur = current[r.id];
      if (!cur) { errors.push({ id: r.id, reason: "registro original não encontrado" }); continue; }
      const changed = EDIT_PEDIDO_HEADERS.some((h) => h !== "id" && (cur[h] ?? "") !== (r[h] ?? ""));
      if (!changed) continue;

      const cliente_id = clienteByName.get((r.nome_cliente ?? "").toLowerCase());
      if (!cliente_id) { errors.push({ id: r.id, reason: `Cliente não encontrado: "${r.nome_cliente}"` }); continue; }
      let representante_id: string | null = null;
      if (r.nome_representante) {
        representante_id = repByName.get(r.nome_representante.toLowerCase()) ?? null;
        if (!representante_id) { errors.push({ id: r.id, reason: `Representante não encontrado: "${r.nome_representante}"` }); continue; }
      }
      const { error } = await supabase.from("pedidos").update({
        numero_pedido: r.numero_pedido,
        numero_pedido_cliente: r.numero_pedido_cliente || null,
        cliente_id, representante_id,
        data_pedido: r.data_pedido,
        prazo_entrega: r.prazo_entrega || null,
        valor_produtos: Number(r.valor_produtos || 0),
        mes_ref: Number(r.mes_ref),
        ano_ref: Number(r.ano_ref),
        status: r.status as any,
        jefferson_participou: isSim(r.vendedor_interno_participou),
      }).eq("id", r.id);
      if (error) { errors.push({ id: r.id, reason: error.message }); continue; }
      updated++;
    }
    setResult({ updated, errors });
    setImporting(false);
    if (updated > 0) {
      toast.success(`${updated} pedido(s) atualizado(s).`);
      qc.invalidateQueries({ queryKey: ["pedidos"] });
    }
    if (errors.length) toast.error(`${errors.length} erro(s).`);
  };

  const diffRows = newRows.map((r) => {
    const cur = current[r.id];
    const changes: Record<string, { from: string; to: string }> = {};
    if (cur) {
      EDIT_PEDIDO_HEADERS.forEach((h) => {
        if (h !== "id" && (cur[h] ?? "") !== (r[h] ?? "")) changes[h] = { from: cur[h] ?? "", to: r[h] ?? "" };
      });
    }
    return { id: r.id, row: r, cur, changes };
  });
  const changedRows = diffRows.filter((d) => Object.keys(d.changes).length > 0);

  const anoAtual = new Date().getFullYear();
  const anos = [anoAtual - 2, anoAtual - 1, anoAtual, anoAtual + 1];

  return (
    <div className="space-y-4">
      <StepCard n={1} icon={<Download className="h-5 w-5" />} title="Baixar dados atuais">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Mês</Label>
            <Select value={fMes} onValueChange={setFMes}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Array.from({ length: 12 }).map((_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Ano</Label>
            <Select value={fAno} onValueChange={setFAno}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pedido">Pedido</SelectItem>
                <SelectItem value="producao">Produção</SelectItem>
                <SelectItem value="faturado">Faturado</SelectItem>
                <SelectItem value="entregue">Entregue</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Representante</Label>
            <Select value={fRep} onValueChange={setFRep}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(reps ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={baixar} className="bg-primary hover:bg-primary/90">
          <Download className="h-4 w-4 mr-2" /> Baixar Planilha com os Dados Atuais
        </Button>
      </StepCard>

      <StepCard n={2} icon={<Save className="h-5 w-5" />} title="Salvar planilha no computador">
        <p className="text-muted-foreground">Salve a planilha em local de fácil acesso.</p>
      </StepCard>

      <StepCard n={3} icon={<Edit3 className="h-5 w-5" />} title="Editar as informações">
        <p className="text-muted-foreground">Abra a planilha e edite as informações necessárias sem modificar o cabeçalho e sem alterar a coluna <code>id</code>. Não salve em uma nova planilha.</p>
      </StepCard>

      <StepCard n={4} icon={<Upload className="h-5 w-5" />} title="Enviar planilha editada">
        <FileDropInput onFile={handleFile} filename={filename} />
      </StepCard>

      <StepCard n={5} icon={<ListChecks className="h-5 w-5" />} title="Conferir alterações e confirmar">
        {newRows.length === 0 && !result && <p className="text-muted-foreground">Aguardando upload da planilha…</p>}
        {newRows.length > 0 && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm">
                <strong>{changedRows.length}</strong> linha(s) com alterações · <strong>{newRows.length - changedRows.length}</strong> sem mudança
              </p>
              <Button onClick={confirmar} disabled={importing || changedRows.length === 0} className="bg-primary hover:bg-primary/90">
                {importing ? "Atualizando…" : "Confirmar edições"}
              </Button>
            </div>
            <div className="max-h-96 overflow-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">id</TableHead>
                    {EDIT_PEDIDO_HEADERS.filter((h) => h !== "id").map((h) => <TableHead key={h} className="text-xs">{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changedRows.slice(0, 100).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs font-mono">{d.id.slice(0, 8)}…</TableCell>
                      {EDIT_PEDIDO_HEADERS.filter((h) => h !== "id").map((h) => {
                        const isDiff = !!d.changes[h];
                        return (
                          <TableCell key={h} className={`text-xs ${isDiff ? "bg-yellow-100 dark:bg-yellow-900/40" : ""}`}>
                            {isDiff ? (
                              <div className="space-y-0.5">
                                <div className="text-muted-foreground line-through">{d.changes[h].from || "—"}</div>
                                <div className="font-medium">{d.changes[h].to || "—"}</div>
                              </div>
                            ) : (d.row[h] || "—")}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  {changedRows.length === 0 && (
                    <TableRow><TableCell colSpan={EDIT_PEDIDO_HEADERS.length} className="text-center text-muted-foreground text-xs py-4">Nenhuma alteração detectada.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              {changedRows.length > 100 && <p className="text-xs text-muted-foreground p-2">Exibindo primeiras 100 linhas alteradas…</p>}
            </div>
          </>
        )}
        {result && (
          <div className="border rounded p-4 space-y-2 bg-muted/30">
            <p className="text-sm">✅ Atualizados: <strong>{result.updated}</strong> &nbsp;|&nbsp; ❌ Erros: <strong>{result.errors.length}</strong></p>
            {result.errors.length > 0 && (
              <ul className="text-xs text-destructive list-disc pl-5 max-h-40 overflow-auto">
                {result.errors.map((e, i) => <li key={i}>{e.id}: {e.reason}</li>)}
              </ul>
            )}
          </div>
        )}
      </StepCard>
    </div>
  );
}
