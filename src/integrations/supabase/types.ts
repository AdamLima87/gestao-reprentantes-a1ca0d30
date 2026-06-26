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
          atendimento_interno: boolean
          ativo: boolean
          cnpj: string | null
          criado_em: string
          estado: string | null
          id: string
          nome: string
          regiao: string | null
          representante_id: string | null
          ultima_compra_at: string | null
        }
        Insert: {
          atendimento_interno?: boolean
          ativo?: boolean
          cnpj?: string | null
          criado_em?: string
          estado?: string | null
          id?: string
          nome: string
          regiao?: string | null
          representante_id?: string | null
          ultima_compra_at?: string | null
        }
        Update: {
          atendimento_interno?: boolean
          ativo?: boolean
          cnpj?: string | null
          criado_em?: string
          estado?: string | null
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
          comprovante_url: string | null
          criado_em: string
          gestor_user_id: string | null
          id: string
          mes_ref: number
          nfe_id: string
          observacao_pagamento: string | null
          pago_em: string | null
          pedido_id: string
          percentual_aplicado: number
          representante_id: string | null
          tipo: Database["public"]["Enums"]["comissao_tipo"]
          valor_comissao: number
        }
        Insert: {
          ano_ref: number
          base_calculo: number
          comprovante_url?: string | null
          criado_em?: string
          gestor_user_id?: string | null
          id?: string
          mes_ref: number
          nfe_id: string
          observacao_pagamento?: string | null
          pago_em?: string | null
          pedido_id: string
          percentual_aplicado: number
          representante_id?: string | null
          tipo: Database["public"]["Enums"]["comissao_tipo"]
          valor_comissao: number
        }
        Update: {
          ano_ref?: number
          base_calculo?: number
          comprovante_url?: string | null
          criado_em?: string
          gestor_user_id?: string | null
          id?: string
          mes_ref?: number
          nfe_id?: string
          observacao_pagamento?: string | null
          pago_em?: string | null
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
      configuracoes_empresa: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          logo_base64: string | null
          nome_socio: string | null
          numero: string | null
          razao_social: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          logo_base64?: string | null
          nome_socio?: string | null
          numero?: string | null
          razao_social?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          logo_base64?: string | null
          nome_socio?: string | null
          numero?: string | null
          razao_social?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contratos_assinatura: {
        Row: {
          assinado_at: string | null
          created_at: string
          d4sign_document_uuid: string | null
          enviado_at: string | null
          enviado_por: string | null
          id: string
          observacao: string | null
          representante_id: string
          status: string
          tipo: string
          updated_at: string
          url_download: string | null
        }
        Insert: {
          assinado_at?: string | null
          created_at?: string
          d4sign_document_uuid?: string | null
          enviado_at?: string | null
          enviado_por?: string | null
          id?: string
          observacao?: string | null
          representante_id: string
          status?: string
          tipo?: string
          updated_at?: string
          url_download?: string | null
        }
        Update: {
          assinado_at?: string | null
          created_at?: string
          d4sign_document_uuid?: string | null
          enviado_at?: string | null
          enviado_por?: string | null
          id?: string
          observacao?: string | null
          representante_id?: string
          status?: string
          tipo?: string
          updated_at?: string
          url_download?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_assinatura_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "representantes"
            referencedColumns: ["id"]
          },
        ]
      }
      extratos_enviados: {
        Row: {
          ano: number
          email_destino: string | null
          enviado_at: string
          enviado_por: string | null
          gestor_user_id: string | null
          id: string
          mes: number
          representante_id: string | null
        }
        Insert: {
          ano: number
          email_destino?: string | null
          enviado_at?: string
          enviado_por?: string | null
          gestor_user_id?: string | null
          id?: string
          mes: number
          representante_id?: string | null
        }
        Update: {
          ano?: number
          email_destino?: string | null
          enviado_at?: string
          enviado_por?: string | null
          gestor_user_id?: string | null
          id?: string
          mes?: number
          representante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extratos_enviados_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "representantes"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          criado_em: string
          email: string
          id: string
          ip: string | null
          sucesso: boolean
          user_agent: string | null
        }
        Insert: {
          criado_em?: string
          email: string
          id?: string
          ip?: string | null
          sucesso: boolean
          user_agent?: string | null
        }
        Update: {
          criado_em?: string
          email?: string
          id?: string
          ip?: string | null
          sucesso?: boolean
          user_agent?: string | null
        }
        Relationships: []
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
          observacao: string | null
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
          observacao?: string | null
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
          observacao?: string | null
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
          agencia: string | null
          banco: string | null
          conta: string | null
          criado_em: string
          id: string
          must_change_password: boolean
          nome: string
          percentual_comissao: number
          pix: string | null
          representante_id: string | null
        }
        Insert: {
          agencia?: string | null
          banco?: string | null
          conta?: string | null
          criado_em?: string
          id: string
          must_change_password?: boolean
          nome?: string
          percentual_comissao?: number
          pix?: string | null
          representante_id?: string | null
        }
        Update: {
          agencia?: string | null
          banco?: string | null
          conta?: string | null
          criado_em?: string
          id?: string
          must_change_password?: boolean
          nome?: string
          percentual_comissao?: number
          pix?: string | null
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
          agencia: string | null
          ativo: boolean
          bairro: string | null
          banco: string | null
          cep: string | null
          chave_pix: string | null
          cidade: string | null
          cnpj: string | null
          conta_digito: string | null
          cpf: string | null
          cpf_cnpj_titular: string | null
          criado_em: string
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          estados: string[]
          id: string
          nome: string
          nome_completo: string | null
          nome_socio: string | null
          numero: string | null
          percentual_padrao: number
          razao_social: string | null
          regiao: string | null
          rg: string | null
          tipo: Database["public"]["Enums"]["rep_tipo"]
          tipo_conta: string | null
          tipo_pessoa: string
          titular_conta: string | null
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          bairro?: string | null
          banco?: string | null
          cep?: string | null
          chave_pix?: string | null
          cidade?: string | null
          cnpj?: string | null
          conta_digito?: string | null
          cpf?: string | null
          cpf_cnpj_titular?: string | null
          criado_em?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          estados?: string[]
          id?: string
          nome: string
          nome_completo?: string | null
          nome_socio?: string | null
          numero?: string | null
          percentual_padrao?: number
          razao_social?: string | null
          regiao?: string | null
          rg?: string | null
          tipo?: Database["public"]["Enums"]["rep_tipo"]
          tipo_conta?: string | null
          tipo_pessoa?: string
          titular_conta?: string | null
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          bairro?: string | null
          banco?: string | null
          cep?: string | null
          chave_pix?: string | null
          cidade?: string | null
          cnpj?: string | null
          conta_digito?: string | null
          cpf?: string | null
          cpf_cnpj_titular?: string | null
          criado_em?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          estados?: string[]
          id?: string
          nome?: string
          nome_completo?: string | null
          nome_socio?: string | null
          numero?: string | null
          percentual_padrao?: number
          razao_social?: string | null
          regiao?: string | null
          rg?: string | null
          tipo?: Database["public"]["Enums"]["rep_tipo"]
          tipo_conta?: string | null
          tipo_pessoa?: string
          titular_conta?: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          concedida: boolean
          criado_em: string | null
          id: string
          permissao: string
          user_id: string
        }
        Insert: {
          concedida?: boolean
          criado_em?: string | null
          id?: string
          permissao: string
          user_id: string
        }
        Update: {
          concedida?: boolean
          criado_em?: string | null
          id?: string
          permissao?: string
          user_id?: string
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
      has_permission: { Args: { perm: string; uid: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_representante_interno: { Args: { _user: string }; Returns: boolean }
      recalcular_comissoes_gestor: {
        Args: { p_ano?: number; p_mes?: number }
        Returns: {
          gestor_nome: string
          nfe: string
          nfe_id: string
          percentual: number
          valor_base: number
          valor_comissao: number
        }[]
      }
      recalcular_comissoes_interno: {
        Args: { p_ano?: number; p_mes?: number }
        Returns: {
          cliente: string
          nfe: string
          nfe_id: string
          tipo_antigo: string
          tipo_novo: string
          valor_antigo: number
          valor_novo: number
        }[]
      }
      recalcular_comissoes_representantes: {
        Args: { p_ano?: number; p_mes?: number }
        Returns: {
          nfe: string
          nfe_id: string
          percentual: number
          representante: string
          valor_comissao: number
        }[]
      }
      recalcular_comissoes_sem_auth: { Args: never; Returns: Json }
      reprocessar_comissoes: { Args: never; Returns: Json }
    }
    Enums: {
      app_role:
        | "admin"
        | "vendedor_interno"
        | "representante"
        | "financeiro"
        | "gestor"
      comissao_tipo:
        | "externo"
        | "interno_novo"
        | "interno_reativacao"
        | "interno_recorrente"
        | "interno_sobre_rep"
        | "gestor"
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
      app_role: [
        "admin",
        "vendedor_interno",
        "representante",
        "financeiro",
        "gestor",
      ],
      comissao_tipo: [
        "externo",
        "interno_novo",
        "interno_reativacao",
        "interno_recorrente",
        "interno_sobre_rep",
        "gestor",
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
