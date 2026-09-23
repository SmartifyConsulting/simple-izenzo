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
      admin_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      ai_plus_invocations: {
        Row: {
          completed_at: string | null
          correlation_id: string
          created_at: string
          event_type: string
          id: string
          idempotency_key: string
          invocation_id: string
          org_id: string
          request_hash: string
          response_status: number | null
          stage: Database["public"]["Enums"]["spine_stage"]
          status: string
          step: string
          transaction_id: string
        }
        Insert: {
          completed_at?: string | null
          correlation_id: string
          created_at?: string
          event_type: string
          id?: string
          idempotency_key: string
          invocation_id: string
          org_id: string
          request_hash: string
          response_status?: number | null
          stage: Database["public"]["Enums"]["spine_stage"]
          status?: string
          step: string
          transaction_id: string
        }
        Update: {
          completed_at?: string | null
          correlation_id?: string
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          invocation_id?: string
          org_id?: string
          request_hash?: string
          response_status?: number | null
          stage?: Database["public"]["Enums"]["spine_stage"]
          status?: string
          step?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_plus_invocations_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_plus_invocations_transaction_fk"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_proposals: {
        Row: {
          adopted_at: string | null
          adopted_by: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: Database["public"]["Enums"]["ai_proposal_decision"] | null
          decision_pack_id: string | null
          id: string
          kind: string
          model: string | null
          output: string | null
          probability: number | null
          prompt: string | null
          proposal_type: Database["public"]["Enums"]["ai_proposal_type"] | null
          rationale: string | null
          related_counterparty: string | null
          source_references: Json
          stage_context: string | null
          superseded_by: string | null
          transaction_id: string
        }
        Insert: {
          adopted_at?: string | null
          adopted_by?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["ai_proposal_decision"] | null
          decision_pack_id?: string | null
          id?: string
          kind?: string
          model?: string | null
          output?: string | null
          probability?: number | null
          prompt?: string | null
          proposal_type?: Database["public"]["Enums"]["ai_proposal_type"] | null
          rationale?: string | null
          related_counterparty?: string | null
          source_references?: Json
          stage_context?: string | null
          superseded_by?: string | null
          transaction_id: string
        }
        Update: {
          adopted_at?: string | null
          adopted_by?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["ai_proposal_decision"] | null
          decision_pack_id?: string | null
          id?: string
          kind?: string
          model?: string | null
          output?: string | null
          probability?: number | null
          prompt?: string | null
          proposal_type?: Database["public"]["Enums"]["ai_proposal_type"] | null
          rationale?: string | null
          related_counterparty?: string | null
          source_references?: Json
          stage_context?: string | null
          superseded_by?: string | null
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
      ai_rate_limit_log: {
        Row: {
          first_seen_at: string
          hit_count: number
          last_seen_at: string
          model: string
          service: string
        }
        Insert: {
          first_seen_at?: string
          hit_count?: number
          last_seen_at?: string
          model: string
          service: string
        }
        Update: {
          first_seen_at?: string
          hit_count?: number
          last_seen_at?: string
          model?: string
          service?: string
        }
        Relationships: []
      }
      ai_suggestion_events: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          id: string
          new_status: Database["public"]["Enums"]["ai_suggestion_status"] | null
          note: string | null
          previous_status:
            | Database["public"]["Enums"]["ai_suggestion_status"]
            | null
          reason: string | null
          suggestion_id: string
        }
        Insert: {
          actor_id?: string
          created_at?: string
          event_type: string
          id?: string
          new_status?:
            | Database["public"]["Enums"]["ai_suggestion_status"]
            | null
          note?: string | null
          previous_status?:
            | Database["public"]["Enums"]["ai_suggestion_status"]
            | null
          reason?: string | null
          suggestion_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          id?: string
          new_status?:
            | Database["public"]["Enums"]["ai_suggestion_status"]
            | null
          note?: string | null
          previous_status?:
            | Database["public"]["Enums"]["ai_suggestion_status"]
            | null
          reason?: string | null
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestion_events_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "ai_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_suggestions: {
        Row: {
          assigned_reviewer_id: string | null
          confidence: Database["public"]["Enums"]["ai_suggestion_confidence"]
          created_at: string
          created_by: string
          id: string
          manual_creation_reason: string | null
          rejection_note: string | null
          rejection_reason:
            | Database["public"]["Enums"]["ai_suggestion_rejection_reason"]
            | null
          related_transaction_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_note: string | null
          source_references: string | null
          source_summary: string
          source_timestamp: string | null
          status: Database["public"]["Enums"]["ai_suggestion_status"]
          suggested_name: string
          suggestion_type: Database["public"]["Enums"]["ai_suggestion_type"]
          summary: string
          updated_at: string
        }
        Insert: {
          assigned_reviewer_id?: string | null
          confidence: Database["public"]["Enums"]["ai_suggestion_confidence"]
          created_at?: string
          created_by?: string
          id?: string
          manual_creation_reason?: string | null
          rejection_note?: string | null
          rejection_reason?:
            | Database["public"]["Enums"]["ai_suggestion_rejection_reason"]
            | null
          related_transaction_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          source_references?: string | null
          source_summary: string
          source_timestamp?: string | null
          status?: Database["public"]["Enums"]["ai_suggestion_status"]
          suggested_name: string
          suggestion_type: Database["public"]["Enums"]["ai_suggestion_type"]
          summary: string
          updated_at?: string
        }
        Update: {
          assigned_reviewer_id?: string | null
          confidence?: Database["public"]["Enums"]["ai_suggestion_confidence"]
          created_at?: string
          created_by?: string
          id?: string
          manual_creation_reason?: string | null
          rejection_note?: string | null
          rejection_reason?:
            | Database["public"]["Enums"]["ai_suggestion_rejection_reason"]
            | null
          related_transaction_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          source_references?: string | null
          source_summary?: string
          source_timestamp?: string | null
          status?: Database["public"]["Enums"]["ai_suggestion_status"]
          suggested_name?: string
          suggestion_type?: Database["public"]["Enums"]["ai_suggestion_type"]
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_related_transaction_id_fkey"
            columns: ["related_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          commercial_owner: string | null
          compliance_owner: string | null
          created_at: string
          created_by: string
          environment: Database["public"]["Enums"]["api_key_environment"]
          expires_at: string
          id: string
          ip_allowlist: string[]
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          monthly_allowance: number
          name: string
          org_id: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          scopes: string[]
          status: Database["public"]["Enums"]["api_key_status"]
        }
        Insert: {
          commercial_owner?: string | null
          compliance_owner?: string | null
          created_at?: string
          created_by?: string
          environment: Database["public"]["Enums"]["api_key_environment"]
          expires_at: string
          id?: string
          ip_allowlist?: string[]
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          monthly_allowance?: number
          name: string
          org_id: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          scopes?: string[]
          status?: Database["public"]["Enums"]["api_key_status"]
        }
        Update: {
          commercial_owner?: string | null
          compliance_owner?: string | null
          created_at?: string
          created_by?: string
          environment?: Database["public"]["Enums"]["api_key_environment"]
          expires_at?: string
          id?: string
          ip_allowlist?: string[]
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          monthly_allowance?: number
          name?: string
          org_id?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          scopes?: string[]
          status?: Database["public"]["Enums"]["api_key_status"]
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          billable: boolean
          correlation_id: string | null
          created_at: string
          endpoint: string
          environment: Database["public"]["Enums"]["api_key_environment"]
          error_code: string | null
          id: string
          latency_ms: number
          log_hash: string
          method: string
          org_id: string | null
          previous_log_hash: string | null
          rate_limit_decision: string
          request_id: string
          request_payload_hash: string | null
          response_status: number
          scopes_evaluated: string[]
          source_ip: string | null
          token_cost: number
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          billable?: boolean
          correlation_id?: string | null
          created_at?: string
          endpoint: string
          environment: Database["public"]["Enums"]["api_key_environment"]
          error_code?: string | null
          id?: string
          latency_ms: number
          log_hash: string
          method: string
          org_id?: string | null
          previous_log_hash?: string | null
          rate_limit_decision?: string
          request_id: string
          request_payload_hash?: string | null
          response_status: number
          scopes_evaluated?: string[]
          source_ip?: string | null
          token_cost?: number
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          billable?: boolean
          correlation_id?: string | null
          created_at?: string
          endpoint?: string
          environment?: Database["public"]["Enums"]["api_key_environment"]
          error_code?: string | null
          id?: string
          latency_ms?: number
          log_hash?: string
          method?: string
          org_id?: string | null
          previous_log_hash?: string | null
          rate_limit_decision?: string
          request_id?: string
          request_payload_hash?: string | null
          response_status?: number
          scopes_evaluated?: string[]
          source_ip?: string | null
          token_cost?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_webhook_deliveries: {
        Row: {
          attempt: number
          created_at: string
          endpoint_id: string
          event_type: string
          id: string
          payload: Json
          response_status: number | null
          signature: string
          status: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          endpoint_id: string
          event_type: string
          id?: string
          payload: Json
          response_status?: number | null
          signature: string
          status?: string
        }
        Update: {
          attempt?: number
          created_at?: string
          endpoint_id?: string
          event_type?: string
          id?: string
          payload?: Json
          response_status?: number | null
          signature?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "api_webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      api_webhook_endpoints: {
        Row: {
          active: boolean
          api_key_id: string
          created_at: string
          id: string
          secret: string
          url: string
        }
        Insert: {
          active?: boolean
          api_key_id: string
          created_at?: string
          id?: string
          secret: string
          url: string
        }
        Update: {
          active?: boolean
          api_key_id?: string
          created_at?: string
          id?: string
          secret?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_webhook_endpoints_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      archive_move_candidates: {
        Row: {
          dismiss_reason: string | null
          dismissed_at: string | null
          dismissed_by: string | null
          eligible_reason: string
          entity_id: string
          entity_type: string
          flagged_at: string
          flagged_by: string
          id: string
        }
        Insert: {
          dismiss_reason?: string | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          eligible_reason: string
          entity_id: string
          entity_type: string
          flagged_at?: string
          flagged_by?: string
          id?: string
        }
        Update: {
          dismiss_reason?: string | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          eligible_reason?: string
          entity_id?: string
          entity_type?: string
          flagged_at?: string
          flagged_by?: string
          id?: string
        }
        Relationships: []
      }
      archive_moves: {
        Row: {
          approved_at: string
          approved_by: string
          candidate_id: string | null
          entity_id: string
          entity_type: string
          id: string
          records_moved: number
          retention_basis: string
          retrieval_route: string
        }
        Insert: {
          approved_at?: string
          approved_by?: string
          candidate_id?: string | null
          entity_id: string
          entity_type: string
          id?: string
          records_moved?: number
          retention_basis: string
          retrieval_route: string
        }
        Update: {
          approved_at?: string
          approved_by?: string
          candidate_id?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          records_moved?: number
          retention_basis?: string
          retrieval_route?: string
        }
        Relationships: [
          {
            foreignKeyName: "archive_moves_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "archive_move_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      auditor_access_events: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          grant_id: string
          id: string
          note: string | null
        }
        Insert: {
          actor_id?: string
          created_at?: string
          event_type: string
          grant_id: string
          id?: string
          note?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          grant_id?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditor_access_events_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "auditor_access_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      auditor_access_grants: {
        Row: {
          auditor_id: string
          created_at: string
          expires_at: string | null
          granted_by: string
          id: string
          is_standing: boolean
          purpose: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          auditor_id: string
          created_at?: string
          expires_at?: string | null
          granted_by?: string
          id?: string
          is_standing?: boolean
          purpose: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          auditor_id?: string
          created_at?: string
          expires_at?: string | null
          granted_by?: string
          id?: string
          is_standing?: boolean
          purpose?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: []
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
      bug_reports: {
        Row: {
          attachment_paths: string[]
          created_at: string
          created_via: string
          description: string | null
          display_name: string | null
          id: string
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachment_paths?: string[]
          created_at?: string
          created_via?: string
          description?: string | null
          display_name?: string | null
          id?: string
          status?: string
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachment_paths?: string[]
          created_at?: string
          created_via?: string
          description?: string | null
          display_name?: string | null
          id?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      compliance_case_events: {
        Row: {
          actor_id: string
          case_id: string
          created_at: string
          event_type: string
          id: string
          new_status:
            | Database["public"]["Enums"]["compliance_case_status"]
            | null
          note: string | null
          previous_status:
            | Database["public"]["Enums"]["compliance_case_status"]
            | null
        }
        Insert: {
          actor_id?: string
          case_id: string
          created_at?: string
          event_type: string
          id?: string
          new_status?:
            | Database["public"]["Enums"]["compliance_case_status"]
            | null
          note?: string | null
          previous_status?:
            | Database["public"]["Enums"]["compliance_case_status"]
            | null
        }
        Update: {
          actor_id?: string
          case_id?: string
          created_at?: string
          event_type?: string
          id?: string
          new_status?:
            | Database["public"]["Enums"]["compliance_case_status"]
            | null
          note?: string | null
          previous_status?:
            | Database["public"]["Enums"]["compliance_case_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "compliance_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_cases: {
        Row: {
          assigned_analyst_id: string | null
          case_type: Database["public"]["Enums"]["compliance_case_type"]
          created_at: string
          created_by: string
          decided_at: string | null
          decided_by: string | null
          final_decision:
            | Database["public"]["Enums"]["compliance_case_decision"]
            | null
          final_decision_note: string | null
          id: string
          priority: Database["public"]["Enums"]["compliance_case_priority"]
          proposed_decision:
            | Database["public"]["Enums"]["compliance_case_decision"]
            | null
          proposed_decision_at: string | null
          proposed_decision_by: string | null
          proposed_decision_note: string | null
          status: Database["public"]["Enums"]["compliance_case_status"]
          subject_counterparty_id: string | null
          subject_org_id: string | null
          subject_transaction_id: string | null
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_analyst_id?: string | null
          case_type: Database["public"]["Enums"]["compliance_case_type"]
          created_at?: string
          created_by?: string
          decided_at?: string | null
          decided_by?: string | null
          final_decision?:
            | Database["public"]["Enums"]["compliance_case_decision"]
            | null
          final_decision_note?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["compliance_case_priority"]
          proposed_decision?:
            | Database["public"]["Enums"]["compliance_case_decision"]
            | null
          proposed_decision_at?: string | null
          proposed_decision_by?: string | null
          proposed_decision_note?: string | null
          status?: Database["public"]["Enums"]["compliance_case_status"]
          subject_counterparty_id?: string | null
          subject_org_id?: string | null
          subject_transaction_id?: string | null
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_analyst_id?: string | null
          case_type?: Database["public"]["Enums"]["compliance_case_type"]
          created_at?: string
          created_by?: string
          decided_at?: string | null
          decided_by?: string | null
          final_decision?:
            | Database["public"]["Enums"]["compliance_case_decision"]
            | null
          final_decision_note?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["compliance_case_priority"]
          proposed_decision?:
            | Database["public"]["Enums"]["compliance_case_decision"]
            | null
          proposed_decision_at?: string | null
          proposed_decision_by?: string | null
          proposed_decision_note?: string | null
          status?: Database["public"]["Enums"]["compliance_case_status"]
          subject_counterparty_id?: string | null
          subject_org_id?: string | null
          subject_transaction_id?: string | null
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_cases_subject_counterparty_id_fkey"
            columns: ["subject_counterparty_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_cases_subject_org_id_fkey"
            columns: ["subject_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_cases_subject_transaction_id_fkey"
            columns: ["subject_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      counter_offers: {
        Row: {
          counterparty_id: string
          created_at: string
          created_by: string | null
          currency: string | null
          direction: string
          id: string
          price: number | null
          quantity: number | null
          status: string
          terms: string
          transaction_id: string
          unit: string | null
        }
        Insert: {
          counterparty_id: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          direction?: string
          id?: string
          price?: number | null
          quantity?: number | null
          status?: string
          terms: string
          transaction_id: string
          unit?: string | null
        }
        Update: {
          counterparty_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          direction?: string
          id?: string
          price?: number | null
          quantity?: number | null
          status?: string
          terms?: string
          transaction_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "counter_offers_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counter_offers_transaction_id_fkey"
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
          contact_email: string | null
          counterparty_responded_at: string | null
          counterparty_response: string | null
          created_at: string
          id: string
          invited_at: string | null
          jurisdiction: string | null
          media_flags: Json
          name: string
          phone: string | null
          rating_band:
            | Database["public"]["Enums"]["counterparty_rating_band"]
            | null
          rating_computed_at: string | null
          rating_override:
            | Database["public"]["Enums"]["counterparty_rating_band"]
            | null
          rating_override_at: string | null
          rating_override_by: string | null
          rating_override_expiry: string | null
          rating_override_reason: string | null
          rating_version: string
          rationale: string | null
          score: number | null
          sector: string | null
          shortlisted: boolean
          source: string | null
          status: string
          transaction_id: string
          website: string | null
        }
        Insert: {
          chosen_at?: string | null
          contact_email?: string | null
          counterparty_responded_at?: string | null
          counterparty_response?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          jurisdiction?: string | null
          media_flags?: Json
          name: string
          phone?: string | null
          rating_band?:
            | Database["public"]["Enums"]["counterparty_rating_band"]
            | null
          rating_computed_at?: string | null
          rating_override?:
            | Database["public"]["Enums"]["counterparty_rating_band"]
            | null
          rating_override_at?: string | null
          rating_override_by?: string | null
          rating_override_expiry?: string | null
          rating_override_reason?: string | null
          rating_version?: string
          rationale?: string | null
          score?: number | null
          sector?: string | null
          shortlisted?: boolean
          source?: string | null
          status?: string
          transaction_id: string
          website?: string | null
        }
        Update: {
          chosen_at?: string | null
          contact_email?: string | null
          counterparty_responded_at?: string | null
          counterparty_response?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          jurisdiction?: string | null
          media_flags?: Json
          name?: string
          phone?: string | null
          rating_band?:
            | Database["public"]["Enums"]["counterparty_rating_band"]
            | null
          rating_computed_at?: string | null
          rating_override?:
            | Database["public"]["Enums"]["counterparty_rating_band"]
            | null
          rating_override_at?: string | null
          rating_override_by?: string | null
          rating_override_expiry?: string | null
          rating_override_reason?: string | null
          rating_version?: string
          rationale?: string | null
          score?: number | null
          sector?: string | null
          shortlisted?: boolean
          source?: string | null
          status?: string
          transaction_id?: string
          website?: string | null
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
      deletion_forensic_findings: {
        Row: {
          created_at: string
          finding: string
          id: string
          raised_by: string
          record_id: string
        }
        Insert: {
          created_at?: string
          finding: string
          id?: string
          raised_by?: string
          record_id: string
        }
        Update: {
          created_at?: string
          finding?: string
          id?: string
          raised_by?: string
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deletion_forensic_findings_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "deletion_forensic_records"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_forensic_records: {
        Row: {
          completed_correctly: boolean
          created_at: string
          deleted_by: string | null
          deletion_method: string
          entity_id: string
          entity_type: string
          failure_detail: string | null
          id: string
          legal_hold_applied: boolean
          legal_hold_reference: string | null
          reason: string
          recorded_by: string
          redacted_fields: string[]
          redaction_justification: string | null
        }
        Insert: {
          completed_correctly?: boolean
          created_at?: string
          deleted_by?: string | null
          deletion_method?: string
          entity_id: string
          entity_type: string
          failure_detail?: string | null
          id?: string
          legal_hold_applied?: boolean
          legal_hold_reference?: string | null
          reason: string
          recorded_by?: string
          redacted_fields?: string[]
          redaction_justification?: string | null
        }
        Update: {
          completed_correctly?: boolean
          created_at?: string
          deleted_by?: string | null
          deletion_method?: string
          entity_id?: string
          entity_type?: string
          failure_detail?: string | null
          id?: string
          legal_hold_applied?: boolean
          legal_hold_reference?: string | null
          reason?: string
          recorded_by?: string
          redacted_fields?: string[]
          redaction_justification?: string | null
        }
        Relationships: []
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
      evidence_pack_events: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          id: string
          note: string | null
          pack_id: string
        }
        Insert: {
          actor_id?: string
          created_at?: string
          event_type: string
          id?: string
          note?: string | null
          pack_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          id?: string
          note?: string | null
          pack_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_pack_events_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "evidence_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_packs: {
        Row: {
          compliance_case_id: string | null
          funder_release_id: string | null
          id: string
          issued_at: string
          issued_by: string
          pack_version: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          sha256_hash: string
          source_type: Database["public"]["Enums"]["evidence_pack_source"]
          storage_path: string
          superseded_by_pack_id: string | null
        }
        Insert: {
          compliance_case_id?: string | null
          funder_release_id?: string | null
          id?: string
          issued_at?: string
          issued_by?: string
          pack_version?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          sha256_hash: string
          source_type: Database["public"]["Enums"]["evidence_pack_source"]
          storage_path: string
          superseded_by_pack_id?: string | null
        }
        Update: {
          compliance_case_id?: string | null
          funder_release_id?: string | null
          id?: string
          issued_at?: string
          issued_by?: string
          pack_version?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          sha256_hash?: string
          source_type?: Database["public"]["Enums"]["evidence_pack_source"]
          storage_path?: string
          superseded_by_pack_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_packs_compliance_case_id_fkey"
            columns: ["compliance_case_id"]
            isOneToOne: false
            referencedRelation: "compliance_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_packs_funder_release_id_fkey"
            columns: ["funder_release_id"]
            isOneToOne: false
            referencedRelation: "funder_releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_packs_superseded_by_pack_id_fkey"
            columns: ["superseded_by_pack_id"]
            isOneToOne: false
            referencedRelation: "evidence_packs"
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
      face_sign_in_attempts: {
        Row: {
          consumed_at: string | null
          created_at: string
          decision: string | null
          email: string
          expires_at: string
          id: string
          provider_session_id: string | null
          provider_url: string | null
          reason: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          decision?: string | null
          email: string
          expires_at?: string
          id?: string
          provider_session_id?: string | null
          provider_url?: string | null
          reason?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          decision?: string | null
          email?: string
          expires_at?: string
          id?: string
          provider_session_id?: string | null
          provider_url?: string | null
          reason?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
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
          final_outcome:
            | Database["public"]["Enums"]["facilitation_outcome"]
            | null
          id: string
          org_id: string | null
          owner_assigned_at: string | null
          owner_id: string | null
          product_service: string | null
          purpose: string | null
          requester_id: string
          sector: string | null
          source_evidence: string
          status: Database["public"]["Enums"]["facilitation_status"]
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
          final_outcome?:
            | Database["public"]["Enums"]["facilitation_outcome"]
            | null
          id?: string
          org_id?: string | null
          owner_assigned_at?: string | null
          owner_id?: string | null
          product_service?: string | null
          purpose?: string | null
          requester_id?: string
          sector?: string | null
          source_evidence: string
          status?: Database["public"]["Enums"]["facilitation_status"]
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
          final_outcome?:
            | Database["public"]["Enums"]["facilitation_outcome"]
            | null
          id?: string
          org_id?: string | null
          owner_assigned_at?: string | null
          owner_id?: string | null
          product_service?: string | null
          purpose?: string | null
          requester_id?: string
          sector?: string | null
          source_evidence?: string
          status?: Database["public"]["Enums"]["facilitation_status"]
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
      funder_decisions: {
        Row: {
          created_at: string
          decided_by: string
          decision: Database["public"]["Enums"]["funder_decision_type"]
          id: string
          note: string | null
          release_id: string
        }
        Insert: {
          created_at?: string
          decided_by?: string
          decision: Database["public"]["Enums"]["funder_decision_type"]
          id?: string
          note?: string | null
          release_id: string
        }
        Update: {
          created_at?: string
          decided_by?: string
          decision?: Database["public"]["Enums"]["funder_decision_type"]
          id?: string
          note?: string | null
          release_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funder_decisions_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "funder_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      funder_org_members: {
        Row: {
          created_at: string
          funder_org_id: string
          funder_role: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          funder_org_id: string
          funder_role?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          funder_org_id?: string
          funder_role?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funder_org_members_funder_org_id_fkey"
            columns: ["funder_org_id"]
            isOneToOne: false
            referencedRelation: "funder_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      funder_orgs: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      funder_release_events: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          id: string
          note: string | null
          release_id: string
        }
        Insert: {
          actor_id?: string
          created_at?: string
          event_type: string
          id?: string
          note?: string | null
          release_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          id?: string
          note?: string | null
          release_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funder_release_events_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "funder_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      funder_releases: {
        Row: {
          compliance_summary: Json
          consent_basis: string
          counterparty_id: string
          created_at: string
          expiry: string
          funder_org_id: string
          id: string
          pack_version: string
          permissions: Database["public"]["Enums"]["release_permission"]
          reason: string
          released_by: string
          released_document_ids: string[]
          released_fields: Json
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          transaction_id: string | null
        }
        Insert: {
          compliance_summary?: Json
          consent_basis: string
          counterparty_id: string
          created_at?: string
          expiry: string
          funder_org_id: string
          id?: string
          pack_version?: string
          permissions?: Database["public"]["Enums"]["release_permission"]
          reason: string
          released_by?: string
          released_document_ids?: string[]
          released_fields: Json
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          transaction_id?: string | null
        }
        Update: {
          compliance_summary?: Json
          consent_basis?: string
          counterparty_id?: string
          created_at?: string
          expiry?: string
          funder_org_id?: string
          id?: string
          pack_version?: string
          permissions?: Database["public"]["Enums"]["release_permission"]
          reason?: string
          released_by?: string
          released_document_ids?: string[]
          released_fields?: Json
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funder_releases_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funder_releases_funder_org_id_fkey"
            columns: ["funder_org_id"]
            isOneToOne: false
            referencedRelation: "funder_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funder_releases_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_verifications: {
        Row: {
          check_type: Database["public"]["Enums"]["identity_check_type"]
          completed_at: string | null
          created_at: string
          created_by: string | null
          decision: string | null
          id: string
          provider: string
          provider_session_id: string | null
          provider_url: string | null
          reason: string | null
          result: Json
          status: Database["public"]["Enums"]["identity_check_status"]
          subject_counterparty_id: string | null
          subject_label: string | null
          subject_org_id: string | null
          subject_user_id: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          check_type: Database["public"]["Enums"]["identity_check_type"]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          decision?: string | null
          id?: string
          provider?: string
          provider_session_id?: string | null
          provider_url?: string | null
          reason?: string | null
          result?: Json
          status?: Database["public"]["Enums"]["identity_check_status"]
          subject_counterparty_id?: string | null
          subject_label?: string | null
          subject_org_id?: string | null
          subject_user_id?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          check_type?: Database["public"]["Enums"]["identity_check_type"]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          decision?: string | null
          id?: string
          provider?: string
          provider_session_id?: string | null
          provider_url?: string | null
          reason?: string | null
          result?: Json
          status?: Database["public"]["Enums"]["identity_check_status"]
          subject_counterparty_id?: string | null
          subject_label?: string | null
          subject_org_id?: string | null
          subject_user_id?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_verifications_subject_counterparty_id_fkey"
            columns: ["subject_counterparty_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_verifications_subject_org_id_fkey"
            columns: ["subject_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_verifications_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          environment: string
          id: string
          last_test_message: string | null
          last_test_ok: boolean | null
          last_tested_at: string | null
          provider: string
          secret_field_names: string[]
          secrets_encrypted: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          environment?: string
          id?: string
          last_test_message?: string | null
          last_test_ok?: boolean | null
          last_tested_at?: string | null
          provider: string
          secret_field_names?: string[]
          secrets_encrypted?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          environment?: string
          id?: string
          last_test_message?: string | null
          last_test_ok?: boolean | null
          last_tested_at?: string | null
          provider?: string
          secret_field_names?: string[]
          secrets_encrypted?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      intent_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string
          transaction_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id: string
          transaction_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intent_messages_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      match_challenges: {
        Row: {
          counterparty_id: string | null
          created_at: string
          id: string
          raised_at: string
          raised_by: string
          resolution_note: string | null
          resolved_at: string | null
          status: string
          subject: string
          summary: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          counterparty_id?: string | null
          created_at?: string
          id?: string
          raised_at?: string
          raised_by: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          summary: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          counterparty_id?: string | null
          created_at?: string
          id?: string
          raised_at?: string
          raised_by?: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          summary?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_challenges_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_challenges_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_skip_events: {
        Row: {
          channel: string
          created_at: string
          event_type: string
          fallback_channel: string
          id: string
          reason: string
          related_ticket_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          event_type: string
          fallback_channel?: string
          id?: string
          reason?: string
          related_ticket_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          event_type?: string
          fallback_channel?: string
          id?: string
          reason?: string
          related_ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_skip_events_related_ticket_id_fkey"
            columns: ["related_ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
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
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          org_id?: string | null
          read?: boolean
          title: string
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          org_id?: string | null
          read?: boolean
          title?: string
          transaction_id?: string | null
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
          {
            foreignKeyName: "notifications_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_alerts: {
        Row: {
          last_sent_at: string
          service: string
        }
        Insert: {
          last_sent_at?: string
          service: string
        }
        Update: {
          last_sent_at?: string
          service?: string
        }
        Relationships: []
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
          ai_brief: string | null
          ai_brief_generated_at: string | null
          avatar_url: string | null
          country: string | null
          created_at: string
          created_by: string | null
          credits: number
          id: string
          industry: string | null
          invite_code: string
          name: string
          offerings: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          registration_no: string | null
          sector: string | null
          terms_of_trade: string | null
          updated_at: string
          website: string | null
          years_in_business: number | null
        }
        Insert: {
          address?: string | null
          ai_brief?: string | null
          ai_brief_generated_at?: string | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          credits?: number
          id?: string
          industry?: string | null
          invite_code?: string
          name: string
          offerings?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          registration_no?: string | null
          sector?: string | null
          terms_of_trade?: string | null
          updated_at?: string
          website?: string | null
          years_in_business?: number | null
        }
        Update: {
          address?: string | null
          ai_brief?: string | null
          ai_brief_generated_at?: string | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          credits?: number
          id?: string
          industry?: string | null
          invite_code?: string
          name?: string
          offerings?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          registration_no?: string | null
          sector?: string | null
          terms_of_trade?: string | null
          updated_at?: string
          website?: string | null
          years_in_business?: number | null
        }
        Relationships: []
      }
      pending_user_links: {
        Row: {
          applied_at: string | null
          created_at: string
          email: string
          full_name: string | null
          memberships: Json
          org_id: string | null
          roles: string[]
          seat: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          memberships?: Json
          org_id?: string | null
          roles?: string[]
          seat?: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          memberships?: Json
          org_id?: string | null
          roles?: string[]
          seat?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_user_links_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          authority_to_act_name: string | null
          authority_to_act_path: string | null
          authority_to_act_uploaded_at: string | null
          avatar_url: string | null
          contact_number: string | null
          created_at: string
          email: string | null
          email_verified_at: string | null
          full_name: string | null
          id: string
          id_number: string | null
          id_number_type: string | null
          last_accessed_at: string | null
          last_name: string | null
          login_count: number
          notification_channel: string
          notification_subscriptions: Json
          org_id: string | null
          seat: string
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          authority_to_act_name?: string | null
          authority_to_act_path?: string | null
          authority_to_act_uploaded_at?: string | null
          avatar_url?: string | null
          contact_number?: string | null
          created_at?: string
          email?: string | null
          email_verified_at?: string | null
          full_name?: string | null
          id: string
          id_number?: string | null
          id_number_type?: string | null
          last_accessed_at?: string | null
          last_name?: string | null
          login_count?: number
          notification_channel?: string
          notification_subscriptions?: Json
          org_id?: string | null
          seat?: string
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          authority_to_act_name?: string | null
          authority_to_act_path?: string | null
          authority_to_act_uploaded_at?: string | null
          avatar_url?: string | null
          contact_number?: string | null
          created_at?: string
          email?: string | null
          email_verified_at?: string | null
          full_name?: string | null
          id?: string
          id_number?: string | null
          id_number_type?: string | null
          last_accessed_at?: string | null
          last_name?: string | null
          login_count?: number
          notification_channel?: string
          notification_subscriptions?: Json
          org_id?: string | null
          seat?: string
          terms_accepted_at?: string | null
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
      refund_events: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          id: string
          new_status: Database["public"]["Enums"]["refund_status"] | null
          note: string | null
          previous_status: Database["public"]["Enums"]["refund_status"] | null
          refund_id: string
        }
        Insert: {
          actor_id?: string
          created_at?: string
          event_type: string
          id?: string
          new_status?: Database["public"]["Enums"]["refund_status"] | null
          note?: string | null
          previous_status?: Database["public"]["Enums"]["refund_status"] | null
          refund_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          id?: string
          new_status?: Database["public"]["Enums"]["refund_status"] | null
          note?: string | null
          previous_status?: Database["public"]["Enums"]["refund_status"] | null
          refund_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_events_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "refund_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_requests: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          confirmation_method: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          currency: string
          id: string
          org_id: string
          payfast_reference: string | null
          reason: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          requested_by: string
          status: Database["public"]["Enums"]["refund_status"]
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          confirmation_method?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          org_id: string
          payfast_reference?: string | null
          reason: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_by?: string
          status?: Database["public"]["Enums"]["refund_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          confirmation_method?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          org_id?: string
          payfast_reference?: string | null
          reason?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_by?: string
          status?: Database["public"]["Enums"]["refund_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
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
          status: Database["public"]["Enums"]["registry_claim_status"]
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
          status?: Database["public"]["Enums"]["registry_claim_status"]
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
          status?: Database["public"]["Enums"]["registry_claim_status"]
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
          readiness_state: Database["public"]["Enums"]["registry_readiness_state"]
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
          readiness_state?: Database["public"]["Enums"]["registry_readiness_state"]
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
          readiness_state?: Database["public"]["Enums"]["registry_readiness_state"]
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
      responder_listings: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_example: boolean
          jurisdiction: string | null
          name: string
          org_id: string | null
          published: boolean
          sector: string | null
          source: string
          source_url: string | null
          summary: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_example?: boolean
          jurisdiction?: string | null
          name: string
          org_id?: string | null
          published?: boolean
          sector?: string | null
          source?: string
          source_url?: string | null
          summary?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_example?: boolean
          jurisdiction?: string | null
          name?: string
          org_id?: string | null
          published?: boolean
          sector?: string | null
          source?: string
          source_url?: string | null
          summary?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "responder_listings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_mismatches: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string
          evidence: string | null
          id: string
          izenzo_amount: number
          payfast_amount: number
          raised_by: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["settlement_mismatch_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description: string
          evidence?: string | null
          id?: string
          izenzo_amount: number
          payfast_amount: number
          raised_by?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["settlement_mismatch_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string
          evidence?: string | null
          id?: string
          izenzo_amount?: number
          payfast_amount?: number
          raised_by?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["settlement_mismatch_status"]
          updated_at?: string
        }
        Relationships: []
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
      support_ticket_events: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          id: string
          new_status:
            | Database["public"]["Enums"]["support_ticket_status"]
            | null
          note: string | null
          previous_status:
            | Database["public"]["Enums"]["support_ticket_status"]
            | null
          ticket_id: string
        }
        Insert: {
          actor_id?: string
          created_at?: string
          event_type: string
          id?: string
          new_status?:
            | Database["public"]["Enums"]["support_ticket_status"]
            | null
          note?: string | null
          previous_status?:
            | Database["public"]["Enums"]["support_ticket_status"]
            | null
          ticket_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          id?: string
          new_status?:
            | Database["public"]["Enums"]["support_ticket_status"]
            | null
          note?: string | null
          previous_status?:
            | Database["public"]["Enums"]["support_ticket_status"]
            | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          ticket_id: string
          visibility: string
        }
        Insert: {
          author_id?: string
          body: string
          created_at?: string
          id?: string
          ticket_id: string
          visibility?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_agent_id: string | null
          closed_at: string | null
          created_at: string
          id: string
          org_id: string
          priority: Database["public"]["Enums"]["support_ticket_priority"]
          related_release: string | null
          requester_id: string
          resolved_at: string | null
          sla_due_at: string
          status: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_agent_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          org_id: string
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          related_release?: string | null
          requester_id?: string
          resolved_at?: string | null
          sla_due_at: string
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_agent_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          org_id?: string
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          related_release?: string | null
          requester_id?: string
          resolved_at?: string | null
          sla_due_at?: string
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      token_purchases: {
        Row: {
          amount_usd: number
          amount_zar: number
          created_at: string
          created_by: string | null
          credited_at: string | null
          id: string
          m_payment_id: string
          org_id: string
          pf_payment_id: string | null
          status: string
          tokens: number
        }
        Insert: {
          amount_usd: number
          amount_zar: number
          created_at?: string
          created_by?: string | null
          credited_at?: string | null
          id?: string
          m_payment_id: string
          org_id: string
          pf_payment_id?: string | null
          status?: string
          tokens: number
        }
        Update: {
          amount_usd?: number
          amount_zar?: number
          created_at?: string
          created_by?: string | null
          credited_at?: string | null
          id?: string
          m_payment_id?: string
          org_id?: string
          pf_payment_id?: string | null
          status?: string
          tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "token_purchases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
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
          document_summary: string | null
          document_summary_error: string | null
          document_summary_generated_at: string | null
          finality_sealed_at: string | null
          id: string
          id_number_encrypted: string | null
          incoterms: string | null
          intent_confirmed_at: string | null
          jurisdiction: string | null
          org_id: string
          poi_hash: string | null
          poi_sealed_at: string | null
          price: number | null
          quantity: number | null
          reference: string | null
          search_prompt: string | null
          stage: Database["public"]["Enums"]["spine_stage"]
          status: string
          step: string
          structured_facts: Json | null
          structured_facts_generated_at: string | null
          title: string
          transaction_type: string | null
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
          document_summary?: string | null
          document_summary_error?: string | null
          document_summary_generated_at?: string | null
          finality_sealed_at?: string | null
          id?: string
          id_number_encrypted?: string | null
          incoterms?: string | null
          intent_confirmed_at?: string | null
          jurisdiction?: string | null
          org_id: string
          poi_hash?: string | null
          poi_sealed_at?: string | null
          price?: number | null
          quantity?: number | null
          reference?: string | null
          search_prompt?: string | null
          stage?: Database["public"]["Enums"]["spine_stage"]
          status?: string
          step?: string
          structured_facts?: Json | null
          structured_facts_generated_at?: string | null
          title: string
          transaction_type?: string | null
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
          document_summary?: string | null
          document_summary_error?: string | null
          document_summary_generated_at?: string | null
          finality_sealed_at?: string | null
          id?: string
          id_number_encrypted?: string | null
          incoterms?: string | null
          intent_confirmed_at?: string | null
          jurisdiction?: string | null
          org_id?: string
          poi_hash?: string | null
          poi_sealed_at?: string | null
          price?: number | null
          quantity?: number | null
          reference?: string | null
          search_prompt?: string | null
          stage?: Database["public"]["Enums"]["spine_stage"]
          status?: string
          step?: string
          structured_facts?: Json | null
          structured_facts_generated_at?: string | null
          title?: string
          transaction_type?: string | null
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
      user_activity_log: {
        Row: {
          created_at: string
          event_type: string
          id: string
          label: string | null
          path: string | null
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          label?: string | null
          path?: string | null
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          label?: string | null
          path?: string | null
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: []
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
      user_workspace_tabs: {
        Row: {
          position: number
          state: string
          transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          position?: number
          state?: string
          transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          position?: number
          state?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_workspace_tabs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
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
      admin_add_forensic_finding: {
        Args: { p_finding: string; p_record_id: string }
        Returns: string
      }
      admin_ai_suggestion_approve: {
        Args: { p_id: string }
        Returns: undefined
      }
      admin_ai_suggestion_create: {
        Args: {
          p_confidence: Database["public"]["Enums"]["ai_suggestion_confidence"]
          p_reason: string
          p_related_transaction_id: string
          p_source_references?: string
          p_source_summary: string
          p_source_timestamp?: string
          p_suggested_name: string
          p_suggestion_type: Database["public"]["Enums"]["ai_suggestion_type"]
          p_summary: string
        }
        Returns: string
      }
      admin_ai_suggestion_reject: {
        Args: {
          p_id: string
          p_note?: string
          p_reason: Database["public"]["Enums"]["ai_suggestion_rejection_reason"]
        }
        Returns: undefined
      }
      admin_ai_suggestion_set_status: {
        Args: {
          p_assigned_reviewer_id?: string
          p_id: string
          p_note?: string
          p_status: Database["public"]["Enums"]["ai_suggestion_status"]
        }
        Returns: undefined
      }
      admin_api_create_key: {
        Args: {
          p_commercial_owner?: string
          p_compliance_owner?: string
          p_environment: Database["public"]["Enums"]["api_key_environment"]
          p_name: string
          p_org_id: string
          p_scopes?: string[]
        }
        Returns: {
          id: string
          raw_key: string
        }[]
      }
      admin_api_reactivate_key: { Args: { p_id: string }; Returns: undefined }
      admin_api_revoke_key: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      admin_api_rotate_key: {
        Args: { p_id: string }
        Returns: {
          id: string
          raw_key: string
        }[]
      }
      admin_api_suspend_key: { Args: { p_id: string }; Returns: undefined }
      admin_approve_archive_move: {
        Args: {
          p_candidate_id: string
          p_records_moved?: number
          p_retention_basis: string
          p_retrieval_route: string
        }
        Returns: string
      }
      admin_approve_refund_for_processing: {
        Args: { p_id: string; p_note?: string }
        Returns: undefined
      }
      admin_case_approve_decision: {
        Args: { p_id: string; p_note?: string }
        Returns: undefined
      }
      admin_case_assign: {
        Args: { p_analyst_id: string; p_id: string }
        Returns: undefined
      }
      admin_case_create: {
        Args: {
          p_case_type: Database["public"]["Enums"]["compliance_case_type"]
          p_priority?: Database["public"]["Enums"]["compliance_case_priority"]
          p_subject_counterparty_id?: string
          p_subject_org_id?: string
          p_subject_transaction_id?: string
          p_summary: string
          p_title: string
        }
        Returns: string
      }
      admin_case_propose_decision: {
        Args: {
          p_decision: Database["public"]["Enums"]["compliance_case_decision"]
          p_id: string
          p_note: string
        }
        Returns: undefined
      }
      admin_case_reject_proposal: {
        Args: { p_id: string; p_note: string }
        Returns: undefined
      }
      admin_confirm_refund_complete: {
        Args: {
          p_confirmation_method: string
          p_id: string
          p_payfast_reference?: string
        }
        Returns: undefined
      }
      admin_decide_registry_claim: {
        Args: {
          p_claim_id: string
          p_decision: Database["public"]["Enums"]["registry_claim_status"]
          p_reason?: string
        }
        Returns: undefined
      }
      admin_dismiss_archive_candidate: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      admin_facilitation_assign: {
        Args: { p_case_id: string; p_owner_id: string }
        Returns: undefined
      }
      admin_facilitation_close: {
        Args: {
          p_case_id: string
          p_outcome: Database["public"]["Enums"]["facilitation_outcome"]
          p_reason: string
        }
        Returns: undefined
      }
      admin_facilitation_set_compliance_hold: {
        Args: { p_case_id: string; p_hold: boolean; p_reason?: string }
        Returns: undefined
      }
      admin_facilitation_set_status: {
        Args: {
          p_case_id: string
          p_note?: string
          p_status: Database["public"]["Enums"]["facilitation_status"]
        }
        Returns: undefined
      }
      admin_flag_archive_candidate: {
        Args: {
          p_eligible_reason: string
          p_entity_id: string
          p_entity_type: string
        }
        Returns: string
      }
      admin_funder_add_member: {
        Args: {
          p_funder_org_id: string
          p_funder_role?: string
          p_user_id: string
        }
        Returns: undefined
      }
      admin_funder_create_org: { Args: { p_name: string }; Returns: string }
      admin_funder_create_release: {
        Args: {
          p_compliance_summary?: Json
          p_consent_basis: string
          p_counterparty_id: string
          p_expiry: string
          p_funder_org_id: string
          p_permissions?: Database["public"]["Enums"]["release_permission"]
          p_reason: string
          p_released_fields: Json
          p_transaction_id?: string
        }
        Returns: string
      }
      admin_funder_revoke_release: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      admin_grant_auditor_access: {
        Args: {
          p_auditor_id: string
          p_expires_at?: string
          p_is_standing?: boolean
          p_purpose: string
        }
        Returns: string
      }
      admin_issue_evidence_pack: {
        Args: {
          p_compliance_case_id?: string
          p_funder_release_id?: string
          p_pack_version?: string
          p_sha256_hash: string
          p_source_type: Database["public"]["Enums"]["evidence_pack_source"]
          p_storage_path: string
          p_supersedes_pack_id?: string
        }
        Returns: string
      }
      admin_log_deletion_forensic_event: {
        Args: {
          p_completed_correctly?: boolean
          p_deletion_method?: string
          p_entity_id: string
          p_entity_type: string
          p_failure_detail?: string
          p_legal_hold_applied?: boolean
          p_legal_hold_reference?: string
          p_reason: string
          p_redacted_fields?: string[]
          p_redaction_justification?: string
        }
        Returns: string
      }
      admin_override_counterparty_rating: {
        Args: {
          p_counterparty_id: string
          p_expiry?: string
          p_override: Database["public"]["Enums"]["counterparty_rating_band"]
          p_reason: string
        }
        Returns: undefined
      }
      admin_registry_create_company: {
        Args: {
          p_country: string
          p_legal_name: string
          p_readiness_state?: Database["public"]["Enums"]["registry_readiness_state"]
          p_registration_no?: string
          p_sector?: string
          p_source_name?: string
        }
        Returns: string
      }
      admin_registry_set_readiness: {
        Args: {
          p_company_id: string
          p_state: Database["public"]["Enums"]["registry_readiness_state"]
        }
        Returns: undefined
      }
      admin_reject_refund: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      admin_report_settlement_mismatch: {
        Args: {
          p_description: string
          p_evidence?: string
          p_izenzo_amount: number
          p_payfast_amount: number
        }
        Returns: string
      }
      admin_resolve_settlement_mismatch: {
        Args: { p_id: string; p_resolution_note: string }
        Returns: undefined
      }
      admin_revoke_auditor_access: {
        Args: { p_grant_id: string; p_reason: string }
        Returns: undefined
      }
      admin_revoke_evidence_pack: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      admin_set_mismatch_under_review: {
        Args: { p_id: string }
        Returns: undefined
      }
      admin_set_setting: {
        Args: { p_key: string; p_value: Json }
        Returns: undefined
      }
      atomic_token_adjust: {
        Args: {
          p_delta: number
          p_org_id: string
          p_reason: string
          p_transaction_id?: string
        }
        Returns: number
      }
      bump_login_count: { Args: never; Returns: number }
      can_access_tx: { Args: { _tx: string }; Returns: boolean }
      current_funder_org_id: { Args: never; Returns: string }
      current_org_id: { Args: never; Returns: string }
      deal_fallback_reference: {
        Args: { _direction: string; _id: string }
        Returns: string
      }
      export_full_database: { Args: never; Returns: Json }
      funder_record_decision: {
        Args: {
          p_decision: Database["public"]["Enums"]["funder_decision_type"]
          p_note?: string
          p_release_id: string
        }
        Returns: undefined
      }
      funder_record_view: { Args: { p_release_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_billing_available: { Args: never; Returns: boolean }
      is_platform_superuser: { Args: never; Returns: boolean }
      is_test_mode_bypass_enabled: { Args: never; Returns: boolean }
      log_auditor_access_use: {
        Args: { p_event_type: string; p_grant_id: string }
        Returns: undefined
      }
      log_evidence_pack_download: { Args: { p_id: string }; Returns: undefined }
      mark_email_verified: { Args: never; Returns: undefined }
      mark_email_verified_if_oauth: { Args: never; Returns: undefined }
      request_refund: {
        Args: {
          p_amount: number
          p_currency?: string
          p_org_id: string
          p_reason: string
          p_transaction_id?: string
        }
        Returns: string
      }
      support_agent_reply: {
        Args: { p_body: string; p_ticket_id: string; p_visibility: string }
        Returns: undefined
      }
      support_assign: {
        Args: { p_agent_id: string; p_ticket_id: string }
        Returns: undefined
      }
      support_create_ticket: {
        Args: {
          p_description: string
          p_priority?: Database["public"]["Enums"]["support_ticket_priority"]
          p_subject: string
        }
        Returns: string
      }
      support_customer_reply: {
        Args: { p_body: string; p_ticket_id: string }
        Returns: undefined
      }
      support_escalate: {
        Args: {
          p_reason: string
          p_related_release?: string
          p_ticket_id: string
        }
        Returns: undefined
      }
      support_set_status: {
        Args: {
          p_status: Database["public"]["Enums"]["support_ticket_status"]
          p_ticket_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      ai_proposal_decision: "accepted" | "rejected"
      ai_proposal_type:
        | "counterparty"
        | "pricing"
        | "risk"
        | "structure"
        | "timing"
        | "substitution"
        | "bundle"
      ai_suggestion_confidence: "low" | "medium" | "high"
      ai_suggestion_rejection_reason:
        | "duplicate"
        | "weak_source"
        | "wrong_jurisdiction"
        | "poor_counterparty_fit"
        | "compliance_concern"
        | "insufficient_evidence"
        | "already_known"
        | "not_commercially_useful"
        | "other"
      ai_suggestion_status:
        | "new"
        | "under_review"
        | "needs_more_research"
        | "approved"
        | "rejected"
        | "archived"
      ai_suggestion_type:
        | "suggested_buyer"
        | "suggested_supplier"
        | "public_source_research_note"
      api_key_environment: "sandbox" | "production"
      api_key_status: "active" | "suspended" | "revoked"
      app_role:
        | "party"
        | "counterparty"
        | "admin"
        | "funder"
        | "support_agent"
        | "support_lead"
        | "engineer_on_call"
        | "auditor"
      compliance_case_decision: "approve" | "reject" | "no_action"
      compliance_case_priority: "low" | "medium" | "high" | "urgent"
      compliance_case_status:
        | "open"
        | "under_review"
        | "decision_proposed"
        | "closed_approved"
        | "closed_rejected"
        | "closed_no_action"
      compliance_case_type:
        | "kyc_review"
        | "aml_alert"
        | "counterparty_dispute"
        | "transaction_review"
        | "other"
      counterparty_rating_band: "trusted" | "neutral" | "flagged"
      evidence_pack_source: "compliance_case" | "funder_release"
      facilitation_outcome:
        | "converted_to_known_counterparty"
        | "ready_for_next_step"
        | "ready_for_poi_review"
        | "counterparty_declined"
        | "no_response"
        | "invalid_details"
        | "duplicate_merged"
        | "blocked_by_compliance"
        | "cancelled_by_requester"
        | "closed_by_admin"
        | "unable_to_contact"
      facilitation_status:
        | "new_unassigned"
        | "triage_in_progress"
        | "more_information_needed"
        | "compliance_review_required"
        | "outreach_approved"
        | "contact_attempted"
        | "counterparty_responded"
        | "profile_verification_in_progress"
        | "ready_for_poi"
        | "closed"
      funder_decision_type: "recommend_fund" | "decline" | "request_more_info"
      identity_check_status:
        | "pending"
        | "in_progress"
        | "passed"
        | "review"
        | "failed"
        | "expired"
      identity_check_type: "id_document" | "kyb" | "aml"
      refund_status:
        | "requested"
        | "approved_for_processing"
        | "confirmed_complete"
        | "rejected"
      registry_claim_status:
        | "submitted"
        | "more_information_required"
        | "approved"
        | "rejected"
      registry_readiness_state:
        | "seed_only"
        | "sample_only"
        | "demo_only"
        | "licence_pending"
        | "provider_pending"
        | "quarantined"
        | "duplicate_unresolved"
        | "disputed"
        | "privacy_hold"
        | "public_search_ready"
        | "demo_ready"
      release_permission: "view" | "view_and_download"
      settlement_mismatch_status: "detected" | "under_review" | "resolved"
      spine_stage:
        | "trading"
        | "compliance"
        | "execution"
        | "finality"
        | "memory"
      support_ticket_priority: "low" | "medium" | "high" | "urgent"
      support_ticket_status:
        | "open"
        | "in_progress"
        | "waiting_on_customer"
        | "escalated"
        | "resolved"
        | "closed"
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
      ai_proposal_decision: ["accepted", "rejected"],
      ai_proposal_type: [
        "counterparty",
        "pricing",
        "risk",
        "structure",
        "timing",
        "substitution",
        "bundle",
      ],
      ai_suggestion_confidence: ["low", "medium", "high"],
      ai_suggestion_rejection_reason: [
        "duplicate",
        "weak_source",
        "wrong_jurisdiction",
        "poor_counterparty_fit",
        "compliance_concern",
        "insufficient_evidence",
        "already_known",
        "not_commercially_useful",
        "other",
      ],
      ai_suggestion_status: [
        "new",
        "under_review",
        "needs_more_research",
        "approved",
        "rejected",
        "archived",
      ],
      ai_suggestion_type: [
        "suggested_buyer",
        "suggested_supplier",
        "public_source_research_note",
      ],
      api_key_environment: ["sandbox", "production"],
      api_key_status: ["active", "suspended", "revoked"],
      app_role: [
        "party",
        "counterparty",
        "admin",
        "funder",
        "support_agent",
        "support_lead",
        "engineer_on_call",
        "auditor",
      ],
      compliance_case_decision: ["approve", "reject", "no_action"],
      compliance_case_priority: ["low", "medium", "high", "urgent"],
      compliance_case_status: [
        "open",
        "under_review",
        "decision_proposed",
        "closed_approved",
        "closed_rejected",
        "closed_no_action",
      ],
      compliance_case_type: [
        "kyc_review",
        "aml_alert",
        "counterparty_dispute",
        "transaction_review",
        "other",
      ],
      counterparty_rating_band: ["trusted", "neutral", "flagged"],
      evidence_pack_source: ["compliance_case", "funder_release"],
      facilitation_outcome: [
        "converted_to_known_counterparty",
        "ready_for_next_step",
        "ready_for_poi_review",
        "counterparty_declined",
        "no_response",
        "invalid_details",
        "duplicate_merged",
        "blocked_by_compliance",
        "cancelled_by_requester",
        "closed_by_admin",
        "unable_to_contact",
      ],
      facilitation_status: [
        "new_unassigned",
        "triage_in_progress",
        "more_information_needed",
        "compliance_review_required",
        "outreach_approved",
        "contact_attempted",
        "counterparty_responded",
        "profile_verification_in_progress",
        "ready_for_poi",
        "closed",
      ],
      funder_decision_type: ["recommend_fund", "decline", "request_more_info"],
      identity_check_status: [
        "pending",
        "in_progress",
        "passed",
        "review",
        "failed",
        "expired",
      ],
      identity_check_type: ["id_document", "kyb", "aml"],
      refund_status: [
        "requested",
        "approved_for_processing",
        "confirmed_complete",
        "rejected",
      ],
      registry_claim_status: [
        "submitted",
        "more_information_required",
        "approved",
        "rejected",
      ],
      registry_readiness_state: [
        "seed_only",
        "sample_only",
        "demo_only",
        "licence_pending",
        "provider_pending",
        "quarantined",
        "duplicate_unresolved",
        "disputed",
        "privacy_hold",
        "public_search_ready",
        "demo_ready",
      ],
      release_permission: ["view", "view_and_download"],
      settlement_mismatch_status: ["detected", "under_review", "resolved"],
      spine_stage: ["trading", "compliance", "execution", "finality", "memory"],
      support_ticket_priority: ["low", "medium", "high", "urgent"],
      support_ticket_status: [
        "open",
        "in_progress",
        "waiting_on_customer",
        "escalated",
        "resolved",
        "closed",
      ],
    },
  },
} as const
