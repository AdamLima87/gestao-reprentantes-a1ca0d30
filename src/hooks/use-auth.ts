import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "admin" | "vendedor_interno" | "representante" | "financeiro";

export interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  representanteId: string | null;
  nome: string;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [representanteId, setRepresentanteId] = useState<string | null>(null);
  const [nome, setNome] = useState("");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) {
      setRoles([]);
      setRepresentanteId(null);
      setNome("");
      return;
    }
    (async () => {
      const [{ data: rolesData }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("profiles").select("nome, representante_id").eq("id", uid).maybeSingle(),
      ]);
      setRoles((rolesData ?? []).map((r) => r.role as AppRole));
      setRepresentanteId(profile?.representante_id ?? null);
      setNome(profile?.nome ?? "");
    })();
  }, [session?.user.id]);

  return {
    loading,
    session,
    user: session?.user ?? null,
    roles,
    representanteId,
    nome,
  };
}

export const hasAnyRole = (roles: AppRole[], wanted: AppRole[]) =>
  roles.some((r) => wanted.includes(r));
