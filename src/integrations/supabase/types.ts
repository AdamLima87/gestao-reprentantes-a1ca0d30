export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          ativo: boolean
          cnpj: string | null
          criado_em: string
          id: string
          nome: string
          regiao: string | null
          representante_id: string | null
          ultima_compra_at: string | null
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          criado_em?: string
          id?: string
          nome: string
          regiao?: string | null
          representante_id?: string | null
          ultima_compra_at?: string | null
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          criado_em?: string
          id?: string
          nome?: string
          regiao?: string | null
          representante_id?: string | null
          ultima_compra_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "representantes"
            referencedColumns: ["id"]
          },
        ]
      }
      comissao_config: {
        Row: {
          cliente_id: string
          criado_em: string
          id: string
          percentual: number
          representante_id: string
        }
        Insert: {
          cliente_id: string
          criado_em?: string
          id?: string
          percentual: number
          representante_id: string
        }
        Update: {
          cliente_id?: string
          criado_em?: string
          id?: string
          percentual?: number
          representante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissao_config_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_config_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "representantes"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes: {
        Row: {
          ano_ref: number
          base_calculo: number
          criado_em: string
          id: string
          mes_ref: number
          nfe_id: string
          pedido_id: string
          percentual_aplicado: number
          representante_id: string | null
          tipo: Database["public"]["Enums"]["comissao_tipo"]
          valor_comissao: number
        }
        Insert: {
          ano_ref: number
          base_calculo: number
          criado_em?: string
          id?: string
          mes_ref: number
          nfe_id: string
          pedido_id: string
          percentual_aplicado: number
          representante_id?: string | null
          tipo: Database["public"]["Enums"]["comissao_tipo"]
          valor_comissao: number
        }
        Update: {
          ano_ref?: number
          base_calculo?: number
          criado_em?: string
          id?: string
          mes_ref?: number
          nfe_id?: string
          pedido_id?: string
          percentual_aplicado?: number
          representante_id?: string | null
          tipo?: Database["public"]["Enums"]["comissao_tipo"]
          valor_comissao?: number
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_nfe_id_fkey"
            columns: ["nfe_id"]
            isOneToOne: false
            referencedRelation: "nfe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "representantes"
            referencedColumns: ["id"]
          },
        ]
      }
      metas: {
        Row: {
          ano: number
          criado_em: string
          id: string
          mes: number
          representante_id: string | null
          valor: number
        }
        Insert: {
          ano: number
          criado_em?: string
          id?: string
          mes: number
          representante_id?: string | null
          valor: number
        }
        Update: {
          ano?: number
          criado_em?: string
          id?: string
          mes?: number
          representante_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "metas_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "representantes"
            referencedColumns: ["id"]
          },
        ]
      }
      nfe: {
        Row: {
          ano_ref: number
          criado_em: string
          data_entrega: string | null
          data_nfe: string
          id: string
          mes_ref: number
          numero_nfe: string
          pedido_id: string
          valor_nfe: number
        }
        Insert: {
          ano_ref: number
          criado_em?: string
          data_entrega?: string | null
          data_nfe: string
          id?: string
          mes_ref: number
          numero_nfe: string
          pedido_id: string
          valor_nfe: number
        }
        Update: {
          ano_ref?: number
          criado_em?: string
          data_entrega?: string | null
          data_nfe?: string
          id?: string
          mes_ref?: number
          numero_nfe?: string
          pedido_id?: string
          valor_nfe?: number
        }
        Relationships: [
          {
            foreignKeyName: "nfe_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          ano_ref: number
          cliente_id: string
          criado_em: string
          data_pedido: string
          id: string
          jefferson_participou: boolean
          mes_ref: number
          numero_pedido: string
          numero_pedido_cliente: string | null
          prazo_entrega: string | null
          representante_id: string | null
          status: Database["public"]["Enums"]["pedido_status"]
          valor_produtos: number
        }
        Insert: {
          ano_ref?: number
          cliente_id: string
          criado_em?: string
          data_pedido?: string
          id?: string
          jefferson_participou?: boolean
          mes_ref?: number
          numero_pedido: string
          numero_pedido_cliente?: string | null
          prazo_entrega?: string | null
          representante_id?: string | null
          status?: Database["public"]["Enums"]["pedido_status"]
          valor_produtos?: number
        }
        Update: {
          ano_ref?: number
          cliente_id?: string
          criado_em?: string
          data_pedido?: string
          id?: string
          jefferson_participou?: boolean
          mes_ref?: number
          numero_pedido?: string
          numero_pedido_cliente?: string | null
          prazo_entrega?: string | null
          representante_id?: string | null
          status?: Database["public"]["Enums"]["pedido_status"]
          valor_produtos?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "representantes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          criado_em: string
          id: string
          nome: string
          representante_id: string | null
        }
        Insert: {
          criado_em?: string
          id: string
          nome?: string
          representante_id?: string | null
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string
          representante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "representantes"
            referencedColumns: ["id"]
          },
        ]
      }
      representantes: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          nome: string
          percentual_padrao: number
          regiao: string | null
          tipo: Database["public"]["Enums"]["rep_tipo"]
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome: string
          percentual_padrao?: number
          regiao?: string | null
          tipo?: Database["public"]["Enums"]["rep_tipo"]
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome?: string
          percentual_padrao?: number
          regiao?: string | null
          tipo?: Database["public"]["Enums"]["rep_tipo"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          criado_em: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_representante_id: { Args: never; Returns: string }
      ensure_vendedor_interno_representante: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_representante_interno: { Args: { _user: string }; Returns: boolean }
      recalcular_comissoes_sem_auth: { Args: never; Returns: Json }
      reprocessar_comissoes: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "vendedor_interno" | "representante" | "financeiro"
      comissao_tipo:
        | "externo"
        | "interno_novo"
        | "interno_reativacao"
        | "interno_recorrente"
        | "interno_sobre_rep"
      pedido_status:
        | "pedido"
        | "producao"
        | "faturado"
        | "entregue"
        | "cancelado"
      rep_tipo: "externo" | "interno"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "vendedor_interno", "representante", "financeiro"],
      comissao_tipo: [
        "externo",
        "interno_novo",
        "interno_reativacao",
        "interno_recorrente",
        "interno_sobre_rep",
      ],
      pedido_status: [
        "pedido",
        "producao",
        "faturado",
        "entregue",
        "cancelado",
      ],
      rep_tipo: ["externo", "interno"],
    },
  },
} as const
