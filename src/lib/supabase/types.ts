// Database types for the `public` schema, written to match
//   supabase gen types typescript --local --schema public
// Regenerate with `npm run db:types` (writes database.types.ts) after changing a migration.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type ProjectColor = "violet" | "emerald" | "sky" | "amber" | "rose" | "slate";

export type Organization = {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Membership = {
  org_id: string;
  user_id: string;
  role: string;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  color: ProjectColor;
  archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  org_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  due_date: string | null;
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type TaskComment = {
  id: string;
  org_id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export type TaskAttachment = {
  id: string;
  org_id: string;
  task_id: string;
  storage_path: string;
  file_name: string;
  content_type: string | null;
  size_bytes: number | null;
  uploaded_by: string;
  created_at: string;
};

export type ActivityLog = {
  id: number;
  org_id: string;
  actor_id: string | null;
  entity: string;
  entity_id: string | null;
  action: string;
  summary: string;
  created_at: string;
};

export type DigestRow = {
  id: string;
  org_id: string;
  period_start: string;
  period_end: string;
  stats: Json;
  summary: string;
  created_at: string;
};

type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "13" };
  public: {
    Tables: {
      organizations: Table<Organization, "id" | "name">;
      profiles: Table<Profile, "id">;
      memberships: Table<Membership, "org_id" | "user_id">;
      projects: Table<Project, "name">;
      tasks: Table<Task, "project_id" | "title">;
      task_comments: Table<TaskComment, "task_id" | "body">;
      task_attachments: Table<TaskAttachment, "task_id" | "storage_path" | "file_name">;
      activity_log: Table<ActivityLog, "org_id" | "entity" | "action" | "summary">;
      digests: Table<DigestRow, "org_id" | "period_start" | "period_end" | "stats" | "summary">;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { task_status: TaskStatus; task_priority: TaskPriority };
    CompositeTypes: { [_ in never]: never };
  };
};
