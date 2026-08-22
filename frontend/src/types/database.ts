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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          employee_id: string
          id: string
          status: string
          work_date: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          employee_id: string
          id?: string
          status?: string
          work_date: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          status?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          login_prefix: string
          logo_url: string | null
          name: string
          time_off_types: string[]
          workday_end: string
          workday_start: string
          working_days: number[]
        }
        Insert: {
          created_at?: string
          id?: string
          login_prefix?: string
          logo_url?: string | null
          name: string
          time_off_types?: string[]
          workday_end?: string
          workday_start?: string
          working_days?: number[]
        }
        Update: {
          created_at?: string
          id?: string
          login_prefix?: string
          logo_url?: string | null
          name?: string
          time_off_types?: string[]
          workday_end?: string
          workday_start?: string
          working_days?: number[]
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          leave_request_id: string | null
          message: string
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          leave_request_id?: string | null
          message: string
          read_at?: string | null
          title: string
          type: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          leave_request_id?: string | null
          message?: string
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          about: string | null
          address: string | null
          avatar_url: string | null
          bank_account_number: string | null
          company_id: string
          created_at: string
          date_of_birth: string | null
          date_of_joining: string | null
          department: string | null
          first_name: string
          id: string
          ifsc_code: string | null
          is_active: boolean
          job_position: string | null
          last_name: string
          login_id: string
          location: string | null
          manager_id: string | null
          mobile: string | null
          monthly_wage: number | null
          must_change_password: boolean
          paid_leave_balance: number
          pan_no: string | null
          role: string
          sick_leave_balance: number
          skills: string[] | null
          uan_no: string | null
          work_email: string
        }
        Insert: {
          about?: string | null
          address?: string | null
          avatar_url?: string | null
          bank_account_number?: string | null
          company_id: string
          created_at?: string
          date_of_birth?: string | null
          date_of_joining?: string | null
          department?: string | null
          first_name: string
          id: string
          ifsc_code?: string | null
          is_active?: boolean
          job_position?: string | null
          last_name: string
          login_id: string
          location?: string | null
          manager_id?: string | null
          mobile?: string | null
          monthly_wage?: number | null
          must_change_password?: boolean
          paid_leave_balance?: number
          pan_no?: string | null
          role: string
          sick_leave_balance?: number
          skills?: string[] | null
          uan_no?: string | null
          work_email: string
        }
        Update: {
          about?: string | null
          address?: string | null
          avatar_url?: string | null
          bank_account_number?: string | null
          company_id?: string
          created_at?: string
          date_of_birth?: string | null
          date_of_joining?: string | null
          department?: string | null
          first_name?: string
          id?: string
          ifsc_code?: string | null
          is_active?: boolean
          job_position?: string | null
          last_name?: string
          login_id?: string
          location?: string | null
          manager_id?: string | null
          mobile?: string | null
          monthly_wage?: number | null
          must_change_password?: boolean
          paid_leave_balance?: number
          pan_no?: string | null
          role?: string
          sick_leave_balance?: number
          skills?: string[] | null
          uan_no?: string | null
          work_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          attachment_url: string | null
          created_at: string
          days: number
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          remarks: string | null
          review_comment: string | null
          reviewed_by: string | null
          start_date: string
          status: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          days: number
          employee_id: string
          end_date: string
          id?: string
          leave_type: string
          remarks?: string | null
          review_comment?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          days?: number
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          remarks?: string | null
          review_comment?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_in: {
        Args: never
        Returns: {
          check_in: string | null
          check_out: string | null
          created_at: string
          employee_id: string
          id: string
          status: string
          work_date: string
        }
        SetofOptions: {
          from: "*"
          to: "attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_out: {
        Args: never
        Returns: {
          check_in: string | null
          check_out: string | null
          created_at: string
          employee_id: string
          id: string
          status: string
          work_date: string
        }
        SetofOptions: {
          from: "*"
          to: "attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_leave_request: {
        Args: {
          p_attachment_url?: string
          p_end_date: string
          p_leave_type: string
          p_remarks?: string
          p_start_date: string
        }
        Returns: {
          attachment_url: string | null
          created_at: string
          days: number
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          remarks: string | null
          review_comment: string | null
          reviewed_by: string | null
          start_date: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "leave_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      deactivate_employee: {
        Args: { p_employee_id: string }
        Returns: undefined
      }
      get_dashboard_summary: { Args: never; Returns: Json }
      list_company_attendance: {
        Args: { p_search?: string; p_work_date?: string }
        Returns: {
          avatar_url: string
          check_in: string
          check_out: string
          employee_id: string
          employee_name: string
          status: string
          work_date: string
          work_hours: number
        }[]
      }
      list_employee_directory: {
        Args: never
        Returns: {
          about: string
          avatar_url: string
          department: string
          first_name: string
          id: string
          job_position: string
          last_name: string
          location: string
          manager_id: string
          presence: string
          skills: string[]
          work_email: string
        }[]
      }
      review_leave_request: {
        Args: { p_comment?: string; p_request_id: string; p_status: string }
        Returns: {
          attachment_url: string | null
          created_at: string
          days: number
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          remarks: string | null
          review_comment: string | null
          reviewed_by: string | null
          start_date: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "leave_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
