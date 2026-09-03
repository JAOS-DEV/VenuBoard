export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor_platform_role: string | null;
          actor_user_id: string | null;
          business_id: string | null;
          environment: string;
          id: string;
          metadata: Json;
          occurred_at: string;
          outcome: string;
          previous_state: Json | null;
          request_id: string | null;
          resulting_state: Json | null;
          scope_type: string;
          summary: string | null;
          support_session_id: string | null;
          target_id: string | null;
          target_table: string | null;
          venue_id: string | null;
        };
        Insert: {
          action: string;
          actor_platform_role?: string | null;
          actor_user_id?: string | null;
          business_id?: string | null;
          environment: string;
          id?: string;
          metadata?: Json;
          occurred_at?: string;
          outcome?: string;
          previous_state?: Json | null;
          request_id?: string | null;
          resulting_state?: Json | null;
          scope_type: string;
          summary?: string | null;
          support_session_id?: string | null;
          target_id?: string | null;
          target_table?: string | null;
          venue_id?: string | null;
        };
        Update: {
          action?: string;
          actor_platform_role?: string | null;
          actor_user_id?: string | null;
          business_id?: string | null;
          environment?: string;
          id?: string;
          metadata?: Json;
          occurred_at?: string;
          outcome?: string;
          previous_state?: Json | null;
          request_id?: string | null;
          resulting_state?: Json | null;
          scope_type?: string;
          summary?: string | null;
          support_session_id?: string | null;
          target_id?: string | null;
          target_table?: string | null;
          venue_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_log_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "business_subscription_overview";
            referencedColumns: ["business_id"];
          },
          {
            foreignKeyName: "audit_log_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_log_support_session_id_fkey";
            columns: ["support_session_id"];
            isOneToOne: false;
            referencedRelation: "support_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_log_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      branding_fonts: {
        Row: {
          key: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          key: string;
          name: string;
          sort_order: number;
        };
        Update: {
          key?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      branding_themes: {
        Row: {
          key: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          key: string;
          name: string;
          sort_order: number;
        };
        Update: {
          key?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      business_memberships: {
        Row: {
          accepted_at: string | null;
          business_id: string;
          created_at: string;
          deactivated_at: string | null;
          id: string;
          invited_by: string | null;
          role: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          business_id: string;
          created_at?: string;
          deactivated_at?: string | null;
          id?: string;
          invited_by?: string | null;
          role: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          accepted_at?: string | null;
          business_id?: string;
          created_at?: string;
          deactivated_at?: string | null;
          id?: string;
          invited_by?: string | null;
          role?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_memberships_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "business_subscription_overview";
            referencedColumns: ["business_id"];
          },
          {
            foreignKeyName: "business_memberships_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_memberships_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      businesses: {
        Row: {
          contact_email: string;
          country: string;
          created_at: string;
          deactivated_at: string | null;
          default_locale: string;
          id: string;
          legal_name: string;
          name: string;
          slug: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          contact_email: string;
          country: string;
          created_at?: string;
          deactivated_at?: string | null;
          default_locale?: string;
          id?: string;
          legal_name: string;
          name: string;
          slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          contact_email?: string;
          country?: string;
          created_at?: string;
          deactivated_at?: string | null;
          default_locale?: string;
          id?: string;
          legal_name?: string;
          name?: string;
          slug?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      current_staff_presence: {
        Row: {
          changed_at: string;
          changed_by: string | null;
          id: string;
          presence_expires_at: string | null;
          source: string;
          staff_public_profile_id: string;
          state: string;
          venue_id: string;
        };
        Insert: {
          changed_at?: string;
          changed_by?: string | null;
          id?: string;
          presence_expires_at?: string | null;
          source?: string;
          staff_public_profile_id: string;
          state?: string;
          venue_id: string;
        };
        Update: {
          changed_at?: string;
          changed_by?: string | null;
          id?: string;
          presence_expires_at?: string | null;
          source?: string;
          staff_public_profile_id?: string;
          state?: string;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "current_staff_presence_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "current_staff_presence_profile_venue_fkey";
            columns: ["staff_public_profile_id", "venue_id"];
            isOneToOne: false;
            referencedRelation: "staff_public_profiles";
            referencedColumns: ["id", "venue_id"];
          },
        ];
      };
      entitlement_sources: {
        Row: {
          key: string;
          name: string;
          precedence: number;
        };
        Insert: {
          key: string;
          name: string;
          precedence: number;
        };
        Update: {
          key?: string;
          name?: string;
          precedence?: number;
        };
        Relationships: [];
      };
      event_translations: {
        Row: {
          created_at: string;
          cta_label: string | null;
          description: string | null;
          event_id: string;
          id: string;
          locale: string;
          summary: string | null;
          title: string;
          updated_at: string;
          updated_by: string | null;
          venue_id: string;
        };
        Insert: {
          created_at?: string;
          cta_label?: string | null;
          description?: string | null;
          event_id: string;
          id?: string;
          locale: string;
          summary?: string | null;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          venue_id: string;
        };
        Update: {
          created_at?: string;
          cta_label?: string | null;
          description?: string | null;
          event_id?: string;
          id?: string;
          locale?: string;
          summary?: string | null;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_translations_parent_fkey";
            columns: ["event_id", "venue_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id", "venue_id"];
          },
          {
            foreignKeyName: "event_translations_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      event_workflow_events: {
        Row: {
          action: string;
          actor_user_id: string | null;
          created_at: string;
          event_id: string;
          from_approval: string | null;
          from_state: string | null;
          id: string;
          to_approval: string | null;
          to_state: string | null;
          venue_id: string;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          created_at?: string;
          event_id: string;
          from_approval?: string | null;
          from_state?: string | null;
          id?: string;
          to_approval?: string | null;
          to_state?: string | null;
          venue_id: string;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          created_at?: string;
          event_id?: string;
          from_approval?: string | null;
          from_state?: string | null;
          id?: string;
          to_approval?: string | null;
          to_state?: string | null;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_workflow_events_parent_fkey";
            columns: ["event_id", "venue_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id", "venue_id"];
          },
        ];
      };
      events: {
        Row: {
          approval_status: string;
          archived_at: string | null;
          business_id: string;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          created_at: string;
          created_by: string | null;
          ends_at: string;
          id: string;
          is_all_day: boolean;
          platform_quarantine_reason: string | null;
          platform_quarantined_at: string | null;
          platform_quarantined_by: string | null;
          poster_storage_path: string | null;
          publish_at: string | null;
          published_at: string | null;
          recurrence_rule: string | null;
          rejection_reason: string | null;
          source_event_id: string | null;
          source_venue_id: string | null;
          starts_at: string;
          state: string;
          timezone: string;
          updated_at: string;
          updated_by: string | null;
          venue_id: string;
        };
        Insert: {
          approval_status?: string;
          archived_at?: string | null;
          business_id: string;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          ends_at: string;
          id?: string;
          is_all_day?: boolean;
          platform_quarantine_reason?: string | null;
          platform_quarantined_at?: string | null;
          platform_quarantined_by?: string | null;
          poster_storage_path?: string | null;
          publish_at?: string | null;
          published_at?: string | null;
          recurrence_rule?: string | null;
          rejection_reason?: string | null;
          source_event_id?: string | null;
          source_venue_id?: string | null;
          starts_at: string;
          state?: string;
          timezone: string;
          updated_at?: string;
          updated_by?: string | null;
          venue_id: string;
        };
        Update: {
          approval_status?: string;
          archived_at?: string | null;
          business_id?: string;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string;
          id?: string;
          is_all_day?: boolean;
          platform_quarantine_reason?: string | null;
          platform_quarantined_at?: string | null;
          platform_quarantined_by?: string | null;
          poster_storage_path?: string | null;
          publish_at?: string | null;
          published_at?: string | null;
          recurrence_rule?: string | null;
          rejection_reason?: string | null;
          source_event_id?: string | null;
          source_venue_id?: string | null;
          starts_at?: string;
          state?: string;
          timezone?: string;
          updated_at?: string;
          updated_by?: string | null;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_platform_quarantined_by_fkey";
            columns: ["platform_quarantined_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_source_event_fkey";
            columns: ["source_event_id", "source_venue_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id", "venue_id"];
          },
          {
            foreignKeyName: "events_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_venue_business_fkey";
            columns: ["venue_id", "business_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id", "business_id"];
          },
          {
            foreignKeyName: "events_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      fixed_roles: {
        Row: {
          axis: string;
          key: string;
          sort_order: number;
        };
        Insert: {
          axis: string;
          key: string;
          sort_order: number;
        };
        Update: {
          axis?: string;
          key?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          business_id: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          revoked_at: string | null;
          role: string;
          scope_type: string;
          state: string;
          token_hash: string;
          updated_at: string;
          venue_id: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          business_id?: string | null;
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          invited_by: string;
          revoked_at?: string | null;
          role: string;
          scope_type: string;
          state?: string;
          token_hash: string;
          updated_at?: string;
          venue_id?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          business_id?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          revoked_at?: string | null;
          role?: string;
          scope_type?: string;
          state?: string;
          token_hash?: string;
          updated_at?: string;
          venue_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "business_subscription_overview";
            referencedColumns: ["business_id"];
          },
          {
            foreignKeyName: "invitations_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      moderation_actions: {
        Row: {
          action: string;
          audit_log_id: string | null;
          evidence_note: string | null;
          id: string;
          occurred_at: string;
          platform_user_id: string;
          previous_state: Json | null;
          reason: string;
          resulting_state: Json | null;
          target_id: string;
          target_table: string;
          venue_id: string;
        };
        Insert: {
          action: string;
          audit_log_id?: string | null;
          evidence_note?: string | null;
          id?: string;
          occurred_at?: string;
          platform_user_id: string;
          previous_state?: Json | null;
          reason: string;
          resulting_state?: Json | null;
          target_id: string;
          target_table: string;
          venue_id: string;
        };
        Update: {
          action?: string;
          audit_log_id?: string | null;
          evidence_note?: string | null;
          id?: string;
          occurred_at?: string;
          platform_user_id?: string;
          previous_state?: Json | null;
          reason?: string;
          resulting_state?: Json | null;
          target_id?: string;
          target_table?: string;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "moderation_actions_audit_log_id_fkey";
            columns: ["audit_log_id"];
            isOneToOne: false;
            referencedRelation: "audit_log";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "moderation_actions_platform_user_id_fkey";
            columns: ["platform_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "moderation_actions_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      modules: {
        Row: {
          description: string;
          is_available: boolean;
          is_core: boolean;
          key: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          description: string;
          is_available?: boolean;
          is_core?: boolean;
          key: string;
          name: string;
          sort_order: number;
        };
        Update: {
          description?: string;
          is_available?: boolean;
          is_core?: boolean;
          key?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      permission_actions: {
        Row: {
          default_scope: string;
          description: string;
          key: string;
        };
        Insert: {
          default_scope: string;
          description: string;
          key: string;
        };
        Update: {
          default_scope?: string;
          description?: string;
          key?: string;
        };
        Relationships: [];
      };
      plan_modules: {
        Row: {
          module_key: string;
          plan_id: string;
        };
        Insert: {
          module_key: string;
          plan_id: string;
        };
        Update: {
          module_key?: string;
          plan_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_modules_module_key_fkey";
            columns: ["module_key"];
            isOneToOne: false;
            referencedRelation: "modules";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "plan_modules_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          created_at: string;
          default_storage_quota_bytes: number;
          description: string;
          id: string;
          is_active: boolean;
          key: string;
          name: string;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          default_storage_quota_bytes: number;
          description: string;
          id?: string;
          is_active?: boolean;
          key: string;
          name: string;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          default_storage_quota_bytes?: number;
          description?: string;
          id?: string;
          is_active?: boolean;
          key?: string;
          name?: string;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_onboarding_runs: {
        Row: {
          actor_user_id: string;
          business_id: string;
          created_at: string;
          idempotency_key: string;
          invitation_id: string;
          payload_hash: string;
          result_summary: Json;
          venue_id: string;
        };
        Insert: {
          actor_user_id: string;
          business_id: string;
          created_at?: string;
          idempotency_key: string;
          invitation_id: string;
          payload_hash: string;
          result_summary: Json;
          venue_id: string;
        };
        Update: {
          actor_user_id?: string;
          business_id?: string;
          created_at?: string;
          idempotency_key?: string;
          invitation_id?: string;
          payload_hash?: string;
          result_summary?: Json;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_onboarding_runs_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_onboarding_runs_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "business_subscription_overview";
            referencedColumns: ["business_id"];
          },
          {
            foreignKeyName: "platform_onboarding_runs_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_onboarding_runs_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_onboarding_runs_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          id: string;
          revoked_at: string | null;
          role: string;
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          revoked_at?: string | null;
          role: string;
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          revoked_at?: string | null;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_roles_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      reserved_venue_slugs: {
        Row: {
          slug: string;
        };
        Insert: {
          slug: string;
        };
        Update: {
          slug?: string;
        };
        Relationships: [];
      };
      role_action_grants: {
        Row: {
          action_key: string;
          grant_kind: string;
          is_read_only: boolean;
          role_key: string;
        };
        Insert: {
          action_key: string;
          grant_kind: string;
          is_read_only?: boolean;
          role_key: string;
        };
        Update: {
          action_key?: string;
          grant_kind?: string;
          is_read_only?: boolean;
          role_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_action_grants_action_key_fkey";
            columns: ["action_key"];
            isOneToOne: false;
            referencedRelation: "permission_actions";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "role_action_grants_role_key_fkey";
            columns: ["role_key"];
            isOneToOne: false;
            referencedRelation: "fixed_roles";
            referencedColumns: ["key"];
          },
        ];
      };
      staff_consent_events: {
        Row: {
          consent_state: string;
          id: string;
          recorded_at: string;
          recorded_by: string | null;
          source: string;
          staff_public_profile_id: string;
          venue_id: string;
        };
        Insert: {
          consent_state: string;
          id?: string;
          recorded_at?: string;
          recorded_by?: string | null;
          source: string;
          staff_public_profile_id: string;
          venue_id: string;
        };
        Update: {
          consent_state?: string;
          id?: string;
          recorded_at?: string;
          recorded_by?: string | null;
          source?: string;
          staff_public_profile_id?: string;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_consent_events_profile_venue_fkey";
            columns: ["staff_public_profile_id", "venue_id"];
            isOneToOne: false;
            referencedRelation: "staff_public_profiles";
            referencedColumns: ["id", "venue_id"];
          },
          {
            foreignKeyName: "staff_consent_events_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_members: {
        Row: {
          business_id: string;
          created_at: string;
          created_by: string | null;
          deactivated_at: string | null;
          deactivated_by: string | null;
          id: string;
          internal_display_name: string;
          restored_at: string | null;
          restored_by: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
          user_id: string | null;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          created_by?: string | null;
          deactivated_at?: string | null;
          deactivated_by?: string | null;
          id?: string;
          internal_display_name: string;
          restored_at?: string | null;
          restored_by?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string | null;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          created_by?: string | null;
          deactivated_at?: string | null;
          deactivated_by?: string | null;
          id?: string;
          internal_display_name?: string;
          restored_at?: string | null;
          restored_by?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "staff_members_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "business_subscription_overview";
            referencedColumns: ["business_id"];
          },
          {
            foreignKeyName: "staff_members_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_members_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_members_deactivated_by_fkey";
            columns: ["deactivated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_members_restored_by_fkey";
            columns: ["restored_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_members_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_presence_events: {
        Row: {
          changed_at: string;
          changed_by: string | null;
          id: string;
          presence_expires_at: string | null;
          source: string;
          staff_public_profile_id: string;
          state: string;
          venue_id: string;
        };
        Insert: {
          changed_at?: string;
          changed_by?: string | null;
          id?: string;
          presence_expires_at?: string | null;
          source: string;
          staff_public_profile_id: string;
          state: string;
          venue_id: string;
        };
        Update: {
          changed_at?: string;
          changed_by?: string | null;
          id?: string;
          presence_expires_at?: string | null;
          source?: string;
          staff_public_profile_id?: string;
          state?: string;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_presence_events_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_presence_events_profile_venue_fkey";
            columns: ["staff_public_profile_id", "venue_id"];
            isOneToOne: false;
            referencedRelation: "staff_public_profiles";
            referencedColumns: ["id", "venue_id"];
          },
        ];
      };
      staff_public_profile_translations: {
        Row: {
          created_at: string;
          id: string;
          locale: string;
          public_bio: string | null;
          staff_public_profile_id: string;
          updated_at: string;
          updated_by: string | null;
          venue_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          locale: string;
          public_bio?: string | null;
          staff_public_profile_id: string;
          updated_at?: string;
          updated_by?: string | null;
          venue_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          locale?: string;
          public_bio?: string | null;
          staff_public_profile_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_public_profile_translations_parent_venue_fkey";
            columns: ["staff_public_profile_id", "venue_id"];
            isOneToOne: false;
            referencedRelation: "staff_public_profiles";
            referencedColumns: ["id", "venue_id"];
          },
          {
            foreignKeyName: "staff_public_profile_translations_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_public_profiles: {
        Row: {
          assignment_status: string;
          avatar_storage_path: string | null;
          business_id: string;
          consent_recorded_at: string | null;
          consent_recorded_by: string | null;
          consent_state: string;
          created_at: string;
          created_by: string | null;
          display_order: number;
          id: string;
          platform_quarantine_reason: string | null;
          platform_quarantined_at: string | null;
          platform_quarantined_by: string | null;
          public_display_name: string;
          public_title: string | null;
          publication_state: string;
          staff_member_id: string;
          updated_at: string;
          updated_by: string | null;
          venue_id: string;
        };
        Insert: {
          assignment_status?: string;
          avatar_storage_path?: string | null;
          business_id: string;
          consent_recorded_at?: string | null;
          consent_recorded_by?: string | null;
          consent_state?: string;
          created_at?: string;
          created_by?: string | null;
          display_order?: number;
          id?: string;
          platform_quarantine_reason?: string | null;
          platform_quarantined_at?: string | null;
          platform_quarantined_by?: string | null;
          public_display_name: string;
          public_title?: string | null;
          publication_state?: string;
          staff_member_id: string;
          updated_at?: string;
          updated_by?: string | null;
          venue_id: string;
        };
        Update: {
          assignment_status?: string;
          avatar_storage_path?: string | null;
          business_id?: string;
          consent_recorded_at?: string | null;
          consent_recorded_by?: string | null;
          consent_state?: string;
          created_at?: string;
          created_by?: string | null;
          display_order?: number;
          id?: string;
          platform_quarantine_reason?: string | null;
          platform_quarantined_at?: string | null;
          platform_quarantined_by?: string | null;
          public_display_name?: string;
          public_title?: string | null;
          publication_state?: string;
          staff_member_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_public_profiles_consent_recorded_by_fkey";
            columns: ["consent_recorded_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_public_profiles_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_public_profiles_platform_quarantined_by_fkey";
            columns: ["platform_quarantined_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_public_profiles_staff_business_fkey";
            columns: ["staff_member_id", "business_id"];
            isOneToOne: false;
            referencedRelation: "staff_members";
            referencedColumns: ["id", "business_id"];
          },
          {
            foreignKeyName: "staff_public_profiles_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_public_profiles_venue_business_fkey";
            columns: ["venue_id", "business_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id", "business_id"];
          },
          {
            foreignKeyName: "staff_public_profiles_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          cancelled_at: string | null;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          delete_after: string | null;
          external_billing_ref: string | null;
          id: string;
          managed_manually: boolean;
          notes: string | null;
          plan_id: string;
          restricted_at: string | null;
          state: string;
          suspended_at: string | null;
          trial_ends_at: string | null;
          trial_started_at: string | null;
          updated_at: string;
          venue_id: string;
        };
        Insert: {
          cancelled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          delete_after?: string | null;
          external_billing_ref?: string | null;
          id?: string;
          managed_manually?: boolean;
          notes?: string | null;
          plan_id: string;
          restricted_at?: string | null;
          state: string;
          suspended_at?: string | null;
          trial_ends_at?: string | null;
          trial_started_at?: string | null;
          updated_at?: string;
          venue_id: string;
        };
        Update: {
          cancelled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          delete_after?: string | null;
          external_billing_ref?: string | null;
          id?: string;
          managed_manually?: boolean;
          notes?: string | null;
          plan_id?: string;
          restricted_at?: string | null;
          state?: string;
          suspended_at?: string | null;
          trial_ends_at?: string | null;
          trial_started_at?: string | null;
          updated_at?: string;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: true;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      support_sessions: {
        Row: {
          end_reason: string | null;
          ended_at: string | null;
          expires_at: string;
          id: string;
          mode: string;
          operator_user_id: string;
          reason: string;
          started_at: string;
          target_business_id: string | null;
          target_venue_id: string | null;
          ticket_reference: string | null;
          write_expires_at: string | null;
          write_granted_at: string | null;
          write_granted_by: string | null;
        };
        Insert: {
          end_reason?: string | null;
          ended_at?: string | null;
          expires_at: string;
          id?: string;
          mode?: string;
          operator_user_id: string;
          reason: string;
          started_at?: string;
          target_business_id?: string | null;
          target_venue_id?: string | null;
          ticket_reference?: string | null;
          write_expires_at?: string | null;
          write_granted_at?: string | null;
          write_granted_by?: string | null;
        };
        Update: {
          end_reason?: string | null;
          ended_at?: string | null;
          expires_at?: string;
          id?: string;
          mode?: string;
          operator_user_id?: string;
          reason?: string;
          started_at?: string;
          target_business_id?: string | null;
          target_venue_id?: string | null;
          ticket_reference?: string | null;
          write_expires_at?: string | null;
          write_granted_at?: string | null;
          write_granted_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "support_sessions_operator_user_id_fkey";
            columns: ["operator_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_sessions_target_business_id_fkey";
            columns: ["target_business_id"];
            isOneToOne: false;
            referencedRelation: "business_subscription_overview";
            referencedColumns: ["business_id"];
          },
          {
            foreignKeyName: "support_sessions_target_business_id_fkey";
            columns: ["target_business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_sessions_target_venue_id_fkey";
            columns: ["target_venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_sessions_write_granted_by_fkey";
            columns: ["write_granted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      trial_extensions: {
        Row: {
          created_at: string;
          extended_by: string;
          id: string;
          new_trial_ends_at: string;
          previous_trial_ends_at: string;
          reason: string;
          subscription_id: string;
          venue_id: string;
        };
        Insert: {
          created_at?: string;
          extended_by: string;
          id?: string;
          new_trial_ends_at: string;
          previous_trial_ends_at: string;
          reason: string;
          subscription_id: string;
          venue_id: string;
        };
        Update: {
          created_at?: string;
          extended_by?: string;
          id?: string;
          new_trial_ends_at?: string;
          previous_trial_ends_at?: string;
          reason?: string;
          subscription_id?: string;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trial_extensions_extended_by_fkey";
            columns: ["extended_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trial_extensions_subscription_venue_fk";
            columns: ["subscription_id", "venue_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id", "venue_id"];
          },
        ];
      };
      users: {
        Row: {
          account_status: string;
          avatar_url: string | null;
          created_at: string;
          deactivated_at: string | null;
          display_name: string;
          email: string;
          id: string;
          last_seen_at: string | null;
          mfa_enrolled_at: string | null;
          preferred_locale: string;
          updated_at: string;
        };
        Insert: {
          account_status?: string;
          avatar_url?: string | null;
          created_at?: string;
          deactivated_at?: string | null;
          display_name: string;
          email: string;
          id: string;
          last_seen_at?: string | null;
          mfa_enrolled_at?: string | null;
          preferred_locale?: string;
          updated_at?: string;
        };
        Update: {
          account_status?: string;
          avatar_url?: string | null;
          created_at?: string;
          deactivated_at?: string | null;
          display_name?: string;
          email?: string;
          id?: string;
          last_seen_at?: string | null;
          mfa_enrolled_at?: string | null;
          preferred_locale?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      venue_billing_records: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          issued_at: string | null;
          notes: string | null;
          operator_reference: string | null;
          paid_at: string | null;
          period_end: string;
          period_start: string;
          state: string;
          subscription_id: string;
          updated_at: string;
          venue_id: string;
        };
        Insert: {
          created_at?: string;
          description: string;
          id?: string;
          issued_at?: string | null;
          notes?: string | null;
          operator_reference?: string | null;
          paid_at?: string | null;
          period_end: string;
          period_start: string;
          state: string;
          subscription_id: string;
          updated_at?: string;
          venue_id: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          issued_at?: string | null;
          notes?: string | null;
          operator_reference?: string | null;
          paid_at?: string | null;
          period_end?: string;
          period_start?: string;
          state?: string;
          subscription_id?: string;
          updated_at?: string;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "venue_billing_records_subscription_venue_fk";
            columns: ["subscription_id", "venue_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id", "venue_id"];
          },
        ];
      };
      venue_branding: {
        Row: {
          accent_color: string;
          background_color: string;
          background_media_id: string | null;
          created_at: string;
          font_key: string;
          logo_media_id: string | null;
          primary_color: string;
          secondary_color: string;
          text_color: string;
          theme_key: string;
          updated_at: string;
          updated_by: string | null;
          venue_id: string;
        };
        Insert: {
          accent_color: string;
          background_color: string;
          background_media_id?: string | null;
          created_at?: string;
          font_key: string;
          logo_media_id?: string | null;
          primary_color: string;
          secondary_color: string;
          text_color: string;
          theme_key: string;
          updated_at?: string;
          updated_by?: string | null;
          venue_id: string;
        };
        Update: {
          accent_color?: string;
          background_color?: string;
          background_media_id?: string | null;
          created_at?: string;
          font_key?: string;
          logo_media_id?: string | null;
          primary_color?: string;
          secondary_color?: string;
          text_color?: string;
          theme_key?: string;
          updated_at?: string;
          updated_by?: string | null;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "venue_branding_font_key_fkey";
            columns: ["font_key"];
            isOneToOne: false;
            referencedRelation: "branding_fonts";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "venue_branding_theme_key_fkey";
            columns: ["theme_key"];
            isOneToOne: false;
            referencedRelation: "branding_themes";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "venue_branding_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venue_branding_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: true;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      venue_memberships: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          deactivated_at: string | null;
          id: string;
          invited_by: string | null;
          role: string;
          status: string;
          updated_at: string;
          user_id: string;
          venue_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          deactivated_at?: string | null;
          id?: string;
          invited_by?: string | null;
          role: string;
          status?: string;
          updated_at?: string;
          user_id: string;
          venue_id: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          deactivated_at?: string | null;
          id?: string;
          invited_by?: string | null;
          role?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "venue_memberships_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venue_memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venue_memberships_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      venue_module_entitlements: {
        Row: {
          created_at: string;
          ends_at: string | null;
          grant_type: string;
          granted_by: string;
          id: string;
          module_key: string;
          reason: string | null;
          revoked_at: string | null;
          source_key: string;
          starts_at: string;
          venue_id: string;
        };
        Insert: {
          created_at?: string;
          ends_at?: string | null;
          grant_type: string;
          granted_by: string;
          id?: string;
          module_key: string;
          reason?: string | null;
          revoked_at?: string | null;
          source_key: string;
          starts_at: string;
          venue_id: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string | null;
          grant_type?: string;
          granted_by?: string;
          id?: string;
          module_key?: string;
          reason?: string | null;
          revoked_at?: string | null;
          source_key?: string;
          starts_at?: string;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "venue_module_entitlements_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venue_module_entitlements_module_key_fkey";
            columns: ["module_key"];
            isOneToOne: false;
            referencedRelation: "modules";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "venue_module_entitlements_source_key_fkey";
            columns: ["source_key"];
            isOneToOne: false;
            referencedRelation: "entitlement_sources";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "venue_module_entitlements_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      venue_module_setting_translations: {
        Row: {
          created_at: string;
          id: string;
          locale: string;
          public_heading: string | null;
          updated_at: string;
          updated_by: string | null;
          venue_id: string;
          venue_module_setting_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          locale: string;
          public_heading?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          venue_id: string;
          venue_module_setting_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          locale?: string;
          public_heading?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          venue_id?: string;
          venue_module_setting_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "venue_module_setting_translations_parent_venue_fk";
            columns: ["venue_module_setting_id", "venue_id"];
            isOneToOne: false;
            referencedRelation: "venue_module_settings";
            referencedColumns: ["id", "venue_id"];
          },
          {
            foreignKeyName: "venue_module_setting_translations_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      venue_module_settings: {
        Row: {
          created_at: string;
          display_order: number;
          id: string;
          is_enabled: boolean;
          is_publicly_visible: boolean;
          module_key: string;
          settings: Json;
          updated_at: string;
          updated_by: string | null;
          venue_id: string;
        };
        Insert: {
          created_at?: string;
          display_order?: number;
          id?: string;
          is_enabled?: boolean;
          is_publicly_visible?: boolean;
          module_key: string;
          settings?: Json;
          updated_at?: string;
          updated_by?: string | null;
          venue_id: string;
        };
        Update: {
          created_at?: string;
          display_order?: number;
          id?: string;
          is_enabled?: boolean;
          is_publicly_visible?: boolean;
          module_key?: string;
          settings?: Json;
          updated_at?: string;
          updated_by?: string | null;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "venue_module_settings_module_key_fkey";
            columns: ["module_key"];
            isOneToOne: false;
            referencedRelation: "modules";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "venue_module_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venue_module_settings_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      venue_storage_usage: {
        Row: {
          last_recalculated_at: string | null;
          quota_bytes: number;
          updated_at: string;
          used_bytes: number;
          venue_id: string;
          warn_threshold_percent: number;
        };
        Insert: {
          last_recalculated_at?: string | null;
          quota_bytes: number;
          updated_at?: string;
          used_bytes?: number;
          venue_id: string;
          warn_threshold_percent?: number;
        };
        Update: {
          last_recalculated_at?: string | null;
          quota_bytes?: number;
          updated_at?: string;
          used_bytes?: number;
          venue_id?: string;
          warn_threshold_percent?: number;
        };
        Relationships: [
          {
            foreignKeyName: "venue_storage_usage_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: true;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      venue_translations: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          locale: string;
          name: string | null;
          tagline: string | null;
          updated_at: string;
          updated_by: string | null;
          venue_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          locale: string;
          name?: string | null;
          tagline?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          venue_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          locale?: string;
          name?: string | null;
          tagline?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "venue_translations_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venue_translations_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      venues: {
        Row: {
          address_line1: string | null;
          address_line2: string | null;
          archived_at: string | null;
          business_id: string;
          city: string | null;
          classification_locked_by_platform: boolean;
          content_classification: string;
          country: string | null;
          created_at: string;
          default_locale: string;
          directions_url: string | null;
          id: string;
          latitude: number | null;
          longitude: number | null;
          name: string;
          platform_quarantine_reason: string | null;
          platform_quarantined_at: string | null;
          platform_quarantined_by: string | null;
          postal_code: string | null;
          province: string | null;
          publication_state: string;
          slug: string;
          status: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          address_line1?: string | null;
          address_line2?: string | null;
          archived_at?: string | null;
          business_id: string;
          city?: string | null;
          classification_locked_by_platform?: boolean;
          content_classification?: string;
          country?: string | null;
          created_at?: string;
          default_locale?: string;
          directions_url?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          platform_quarantine_reason?: string | null;
          platform_quarantined_at?: string | null;
          platform_quarantined_by?: string | null;
          postal_code?: string | null;
          province?: string | null;
          publication_state?: string;
          slug: string;
          status?: string;
          timezone: string;
          updated_at?: string;
        };
        Update: {
          address_line1?: string | null;
          address_line2?: string | null;
          archived_at?: string | null;
          business_id?: string;
          city?: string | null;
          classification_locked_by_platform?: boolean;
          content_classification?: string;
          country?: string | null;
          created_at?: string;
          default_locale?: string;
          directions_url?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          platform_quarantine_reason?: string | null;
          platform_quarantined_at?: string | null;
          platform_quarantined_by?: string | null;
          postal_code?: string | null;
          province?: string | null;
          publication_state?: string;
          slug?: string;
          status?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "venues_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "business_subscription_overview";
            referencedColumns: ["business_id"];
          },
          {
            foreignKeyName: "venues_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venues_platform_quarantined_by_fkey";
            columns: ["platform_quarantined_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      business_subscription_overview: {
        Row: {
          active_count: number | null;
          business_id: string | null;
          cancelled_count: number | null;
          deleted_count: number | null;
          earliest_trial_ends_at: string | null;
          past_due_count: number | null;
          quota_bytes_total: number | null;
          restricted_count: number | null;
          scheduled_for_deletion_count: number | null;
          suspended_count: number | null;
          trial_count: number | null;
          used_bytes_total: number | null;
          venue_count: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: Json };
      approve_event: { Args: { p_event_id: string }; Returns: Json };
      archive_event: { Args: { p_event_id: string }; Returns: Json };
      assign_staff_to_venue: {
        Args: {
          p_payload: Json;
          p_staff_member_id: string;
          p_venue_id: string;
        };
        Returns: Json;
      };
      bulk_mark_staff_not_present: {
        Args: { p_venue_id: string };
        Returns: Json;
      };
      cancel_event: {
        Args: { p_event_id: string; p_reason: string };
        Returns: Json;
      };
      copy_event_to_venue: {
        Args: { p_destination_venue_id: string; p_event_id: string };
        Returns: Json;
      };
      create_event: {
        Args: { p_payload: Json; p_venue_id: string };
        Returns: Json;
      };
      create_staff_member_with_profile: {
        Args: { p_payload: Json; p_venue_id: string };
        Returns: Json;
      };
      deactivate_staff_member: {
        Args: { p_staff_member_id: string };
        Returns: Json;
      };
      evaluate_permission: {
        Args: {
          p_action_key: string;
          p_business_id?: string;
          p_scope_type: string;
          p_target_user_id?: string;
          p_venue_id?: string;
        };
        Returns: boolean;
      };
      inspect_invitation: { Args: { p_token: string }; Returns: Json };
      list_public_staff_presence: {
        Args: {
          p_limit?: number;
          p_locale?: string;
          p_offset?: number;
          p_venue_slug: string;
        };
        Returns: Json;
      };
      list_public_venue_events: {
        Args: {
          p_limit?: number;
          p_locale?: string;
          p_month?: string;
          p_offset?: number;
          p_venue_slug: string;
          p_view?: string;
        };
        Returns: Json;
      };
      onboard_platform_venue: {
        Args: { p_idempotency_key: string; p_payload: Json };
        Returns: Json;
      };
      publish_event_now: { Args: { p_event_id: string }; Returns: Json };
      reject_event: {
        Args: { p_event_id: string; p_reason: string };
        Returns: Json;
      };
      restore_event_to_draft: { Args: { p_event_id: string }; Returns: Json };
      restore_staff_member: {
        Args: { p_staff_member_id: string };
        Returns: Json;
      };
      schedule_event_publication: {
        Args: { p_event_id: string; p_publish_at: string };
        Returns: Json;
      };
      set_staff_presence: {
        Args: { p_profile_id: string; p_state: string };
        Returns: Json;
      };
      set_staff_public_consent: {
        Args: { p_consent_state: string; p_profile_id: string };
        Returns: Json;
      };
      submit_event_for_approval: {
        Args: { p_event_id: string };
        Returns: Json;
      };
      update_event_draft: {
        Args: { p_event_id: string; p_payload: Json };
        Returns: Json;
      };
      update_events_module_settings: {
        Args: { p_payload: Json; p_venue_id: string };
        Returns: Json;
      };
      update_staff_public_profile: {
        Args: { p_payload: Json; p_profile_id: string };
        Returns: Json;
      };
      venue_slug_is_available: { Args: { p_slug: string }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
