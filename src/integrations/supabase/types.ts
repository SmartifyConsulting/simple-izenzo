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
      ai_proposals: {
        Row: {
          adopted_at: string | null
          adopted_by: string | null
          created_at: string
          id: string
          kind: string
          model: string | null
          output: string | null
          prompt: string | null
          transaction_id: string
        }
        Insert: {
          adopted_at?: string | null
          adopted_by?: string | null
          created_at?: string
          id?: string
          kind?: string
          model?: string | null
          output?: string | null
          prompt?: string | null
          transaction_id: string
        }
        Update: {
          adopted_at?: string | null
          adopted_by?: string | null
          created_at?: string
          id?: string
          kind?: string
          model?: string | null
          output?: string | null
          prompt?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_proposals_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      facilitation_cases: {
        Row: {
          authority_confirmed: boolean
          closed_at: string | null
          closure_reason: string | null
          compliance_hold: boolean
          compliance_hold_reason: string | null
          contact_identifier: string
          counterparty_name: string
          counterparty_role: string | null
          country: string | null
          created_at: string
          final_outcome: string | null
          id: string
          org_id: string | null
          owner_assigned_at: string | null
          owner_id: string | null
          product_service: string | null
          purpose: string | null
          requester_id: string
          sector: string | null
          source_evidence: string
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          authority_confirmed?: boolean
          closed_at?: string | null
          closure_reason?: string | null
          compliance_hold?: boolean
          compliance_hold_reason?: string | null
          contact_identifier: string
          counterparty_name: string
          counterparty_role?: string | null
          country?: string | null
          created_at?: string
          final_outcome?: string | null
          id?: string
          org_id?: string | null
          owner_assigned_at?: string | null
          owner_id?: string | null
          product_service?: string | null
          purpose?: string | null
          requester_id?: string
          sector?: string | null
          source_evidence: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          authority_confirmed?: boolean
          closed_at?: string | null
          closure_reason?: string | null
          compliance_hold?: boolean
          compliance_hold_reason?: string | null
          contact_identifier?: string
          counterparty_name?: string
          counterparty_role?: string | null
          country?: string | null
          created_at?: string
          final_outcome?: string | null
          id?: string
          org_id?: string | null
          owner_assigned_at?: string | null
          owner_id?: string | null
          product_service?: string | null
          purpose?: string | null
          requester_id?: string
          sector?: string | null
          source_evidence?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facilitation_cases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilitation_cases_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      facilitation_case_events: {
        Row: {
          actor_id: string
          case_id: string
          created_at: string
          event_type: string
          id: string
          note: string | null
        }
        Insert: {
          actor_id?: string
          case_id: string
          created_at?: string
          event_type: string
          id?: string
          note?: string | null
        }
        Update: {
          actor_id?: string
          case_id?: string
          created_at?: string
          event_type?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facilitation_case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "facilitation_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_companies: {
        Row: {
          claimed_org_id: string | null
          country: string
          created_at: string
          created_by: string | null
          id: string
          import_batch_id: string | null
          legal_name: string
          licence_ref: string | null
          observed_date: string | null
          readiness_state: string
          registration_no: string | null
          sector: string | null
          source_name: string | null
          source_type: string
          trading_name: string | null
          updated_at: string
        }
        Insert: {
          claimed_org_id?: string | null
          country: string
          created_at?: string
          created_by?: string | null
          id?: string
          import_batch_id?: string | null
          legal_name: string
          licence_ref?: string | null
          observed_date?: string | null
          readiness_state?: string
          registration_no?: string | null
          sector?: string | null
          source_name?: string | null
          source_type?: string
          trading_name?: string | null
          updated_at?: string
        }
        Update: {
          claimed_org_id?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          id?: string
          import_batch_id?: string | null
          legal_name?: string
          licence_ref?: string | null
          observed_date?: string | null
          readiness_state?: string
          registration_no?: string | null
          sector?: string | null
          source_name?: string | null
          source_type?: string
          trading_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_companies_claimed_org_id_fkey"
            columns: ["claimed_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_claims: {
        Row: {
          claimant_id: string
          claimant_role: string
          company_id: string
          created_at: string
          decision_reason: string | null
          evidence_note: string | null
          evidence_url: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          claimant_id?: string
          claimant_role: string
          company_id: string
          created_at?: string
          decision_reason?: string | null
          evidence_note?: string | null
          evidence_url?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          claimant_id?: string
          claimant_role?: string
          company_id?: string
          created_at?: string
          decision_reason?: string | null
          evidence_note?: string | null
          evidence_url?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_claims_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "registry_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_offers: {
        Row: {
          created_at: string
          currency: string
          direction: string
          id: string
          price: number | null
          quantity: number | null
          status: string
          submitted_by: string
          terms: string | null
          transaction_id: string
          unit: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          direction?: string
          id?: string
          price?: number | null
          quantity?: number | null
          status?: string
          submitted_by?: string
          terms?: string | null
          transaction_id: string
          unit?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          direction?: string
          id?: string
          price?: number | null
          quantity?: number | null
          status?: string
          submitted_by?: string
          terms?: string | null
          transaction_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bid_offers_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      counterparties: {
        Row: {
          chosen_at: string | null
          created_at: string
          id: string
          jurisdiction: string | null
          media_flags: Json
          name: string
          rating_band: string | null
          rating_computed_at: string | null
          rating_override: string | null
          rating_override_at: string | null
          rating_override_by: string | null
          rating_override_expiry: string | null
          rating_override_reason: string | null
          rating_version: string
          rationale: string | null
          score: number | null
          sector: string | null
          source: string | null
          status: string
          transaction_id: string
        }
        Insert: {
          chosen_at?: string | null
          created_at?: string
          id?: string
          jurisdiction?: string | null
          media_flags?: Json
          name: string
          rating_band?: string | null
          rating_computed_at?: string | null
          rating_override?: string | null
          rating_override_at?: string | null
          rating_override_by?: string | null
          rating_override_expiry?: string | null
          rating_override_reason?: string | null
          rating_version?: string
          rationale?: string | null
          score?: number | null
          sector?: string | null
          source?: string | null
          status?: string
          transaction_id: string
        }
        Update: {
          chosen_at?: string | null
          created_at?: string
          id?: string
          jurisdiction?: string | null
          media_flags?: Json
          name?: string
          rating_band?: string | null
          rating_computed_at?: string | null
          rating_override?: string | null
          rating_override_at?: string | null
          rating_override_by?: string | null
          rating_override_expiry?: string | null
          rating_override_reason?: string | null
          rating_version?: string
          rationale?: string | null
          score?: number | null
          sector?: string | null
          source?: string | null
          status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "counterparties_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          created_at: string
          created_by: string | null
          delta: number
          id: string
          org_id: string
          reason: string
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          org_id: string
          reason: string
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          org_id?: string
          reason?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          doc_type: string
          id: string
          name: string
          notes: string | null
          sha256: string | null
          storage_path: string | null
          transaction_id: string
          uploaded_by: string
          version: number
        }
        Insert: {
          created_at?: string
          doc_type?: string
          id?: string
          name: string
          notes?: string | null
          sha256?: string | null
          storage_path?: string | null
          transaction_id: string
          uploaded_by?: string
          version?: number
        }
        Update: {
          created_at?: string
          doc_type?: string
          id?: string
          name?: string
          notes?: string | null
          sha256?: string | null
          storage_path?: string | null
          transaction_id?: string
          uploaded_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_records: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          phase: string
          prep_stage: string | null
          recorded_by: string
          status: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          phase: string
          prep_stage?: string | null
          recorded_by?: string
          status?: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          phase?: string
          prep_stage?: string | null
          recorded_by?: string
          status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_records_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      finality_records: {
        Row: {
          change_event: string | null
          created_at: string
          evidence: string | null
          finality_type: string | null
          hash: string | null
          id: string
          recorded_by: string
          sealed_at: string | null
          status: string
          transaction_id: string
          validation: string | null
        }
        Insert: {
          change_event?: string | null
          created_at?: string
          evidence?: string | null
          finality_type?: string | null
          hash?: string | null
          id?: string
          recorded_by?: string
          sealed_at?: string | null
          status?: string
          transaction_id: string
          validation?: string | null
        }
        Update: {
          change_event?: string | null
          created_at?: string
          evidence?: string | null
          finality_type?: string | null
          hash?: string | null
          id?: string
          recorded_by?: string
          sealed_at?: string | null
          status?: string
          transaction_id?: string
          validation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finality_records_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          org_id: string | null
          read: boolean
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          org_id?: string | null
          read?: boolean
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          org_id?: string | null
          read?: boolean
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_portfolio_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          org_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          org_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          org_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_portfolio_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          address: string | null
          avatar_url: string | null
          country: string | null
          created_at: string
          created_by: string | null
          credits: number
          id: string
          name: string
          offerings: string | null
          registration_no: string | null
          sector: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          credits?: number
          id?: string
          name: string
          offerings?: string | null
          registration_no?: string | null
          sector?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          credits?: number
          id?: string
          name?: string
          offerings?: string | null
          registration_no?: string | null
          sector?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          email_verified_at: string | null
          full_name: string | null
          id: string
          login_count: number
          org_id: string | null
          seat: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          email_verified_at?: string | null
          full_name?: string | null
          id: string
          login_count?: number
          org_id?: string | null
          seat?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          email_verified_at?: string | null
          full_name?: string | null
          id?: string
          login_count?: number
          org_id?: string | null
          seat?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholder_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          notes: string | null
          party_name: string
          recorded_by: string
          role: string | null
          transaction_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          notes?: string | null
          party_name: string
          recorded_by?: string
          role?: string | null
          transaction_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          notes?: string | null
          party_name?: string
          recorded_by?: string
          role?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stakeholder_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_events: {
        Row: {
          action: string
          actor_id: string
          actor_name: string | null
          created_at: string
          fingerprint: string | null
          id: string
          payload: Json
          stage: Database["public"]["Enums"]["spine_stage"]
          step: string
          summary: string | null
          transaction_id: string
        }
        Insert: {
          action: string
          actor_id?: string
          actor_name?: string | null
          created_at?: string
          fingerprint?: string | null
          id?: string
          payload?: Json
          stage: Database["public"]["Enums"]["spine_stage"]
          step: string
          summary?: string | null
          transaction_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          actor_name?: string | null
          created_at?: string
          fingerprint?: string | null
          id?: string
          payload?: Json
          stage?: Database["public"]["Enums"]["spine_stage"]
          step?: string
          summary?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          commodity: string | null
          counterparty_org_id: string | null
          created_at: string
          created_by: string
          currency: string
          finality_sealed_at: string | null
          id: string
          incoterms: string | null
          intent_confirmed_at: string | null
          jurisdiction: string | null
          org_id: string
          poi_hash: string | null
          poi_sealed_at: string | null
          price: number | null
          quantity: number | null
          stage: Database["public"]["Enums"]["spine_stage"]
          status: string
          step: string
          title: string
          unit: string | null
          updated_at: string
          wad_completed_at: string | null
        }
        Insert: {
          commodity?: string | null
          counterparty_org_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          finality_sealed_at?: string | null
          id?: string
          incoterms?: string | null
          intent_confirmed_at?: string | null
          jurisdiction?: string | null
          org_id: string
          poi_hash?: string | null
          poi_sealed_at?: string | null
          price?: number | null
          quantity?: number | null
          stage?: Database["public"]["Enums"]["spine_stage"]
          status?: string
          step?: string
          title: string
          unit?: string | null
          updated_at?: string
          wad_completed_at?: string | null
        }
        Update: {
          commodity?: string | null
          counterparty_org_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          finality_sealed_at?: string | null
          id?: string
          incoterms?: string | null
          intent_confirmed_at?: string | null
          jurisdiction?: string | null
          org_id?: string
          poi_hash?: string | null
          poi_sealed_at?: string | null
          price?: number | null
          quantity?: number | null
          stage?: Database["public"]["Enums"]["spine_stage"]
          status?: string
          step?: string
          title?: string
          unit?: string | null
          updated_at?: string
          wad_completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_counterparty_org_id_fkey"
            columns: ["counterparty_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wad_cases: {
        Row: {
          authority: Json
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          kyb: Json
          kyc: Json
          pep: Json
          sanctions: Json
          status: string
          transaction_id: string
          ubo: Json
        }
        Insert: {
          authority?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          kyb?: Json
          kyc?: Json
          pep?: Json
          sanctions?: Json
          status?: string
          transaction_id: string
          ubo?: Json
        }
        Update: {
          authority?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          kyb?: Json
          kyc?: Json
          pep?: Json
          sanctions?: Json
          status?: string
          transaction_id?: string
          ubo?: Json
        }
        Relationships: [
          {
            foreignKeyName: "wad_cases_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_override_counterparty_rating: {
        Args: {
          p_counterparty_id: string
          p_expiry?: string | null
          p_override: string
          p_reason: string
        }
        Returns: undefined
      }
      admin_facilitation_assign: {
        Args: { p_case_id: string; p_owner_id: string }
        Returns: undefined
      }
      admin_facilitation_close: {
        Args: { p_case_id: string; p_outcome: string; p_reason: string }
        Returns: undefined
      }
      admin_facilitation_set_compliance_hold: {
        Args: { p_case_id: string; p_hold: boolean; p_reason?: string | null }
        Returns: undefined
      }
      admin_facilitation_set_status: {
        Args: { p_case_id: string; p_note?: string | null; p_status: string }
        Returns: undefined
      }
      admin_decide_registry_claim: {
        Args: {
          p_claim_id: string
          p_decision: string
          p_reason?: string | null
        }
        Returns: undefined
      }
      admin_registry_create_company: {
        Args: {
          p_country: string
          p_legal_name: string
          p_readiness_state?: string
          p_registration_no?: string | null
          p_sector?: string | null
          p_source_name?: string | null
        }
        Returns: string
      }
      admin_registry_set_readiness: {
        Args: { p_company_id: string; p_state: string }
        Returns: undefined
      }
      atomic_token_adjust: {
        Args: {
          p_delta: number
          p_org_id: string
          p_reason: string
          p_transaction_id?: string | null
        }
        Returns: number
      }
      bump_login_count: { Args: never; Returns: number }
      can_access_tx: { Args: { _tx: string }; Returns: boolean }
      current_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_email_verified: { Args: never; Returns: undefined }
      mark_email_verified_if_oauth: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "party" | "counterparty" | "admin"
      spine_stage:
        | "trading"
        | "compliance"
        | "execution"
        | "finality"
        | "memory"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["party", "counterparty", "admin"],
      spine_stage: ["trading", "compliance", "execution", "finality", "memory"],
    },
  },
} as const
