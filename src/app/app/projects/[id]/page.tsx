import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createUserSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { getMembers } from "@/lib/queries";
import { Board } from "@/components/app/board";
import { ProjectMenu } from "@/components/app/project-menu";
import { PROJECT_COLORS } from "@/components/app/project-colors";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getWorkspaceContext();
  const supabase = await createUserSupabase();
  if (!ctx || !supabase) return null;

  // RLS returns nothing for projects of other orgs, so this is also the
  // authorization check: a foreign project id is simply "not found".
  const [{ data: project }, { data: tasks }, members] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    supabase.from("tasks").select("*").eq("project_id", id),
    getMembers(supabase),
  ]);
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/app" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" /> Projects
          </Link>
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
            <span className={`size-3 rounded-full ${PROJECT_COLORS[project.color].dot}`} />
            {project.name}
          </h1>
          {project.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{project.description}</p>}
        </div>
        {ctx.isAdmin && <ProjectMenu projectId={project.id} />}
      </div>
      <Board
        project={project}
        initialTasks={tasks ?? []}
        members={members}
        currentUserId={ctx.userId}
        orgId={ctx.orgId}
        isAdmin={ctx.isAdmin}
      />
    </div>
  );
}
