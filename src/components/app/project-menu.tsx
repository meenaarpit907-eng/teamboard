"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { archiveProject } from "@/app/actions/workspace";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProjectMenu({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Project actions" disabled={pending}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() =>
            startTransition(async () => {
              const result = await archiveProject(projectId);
              if (!result.ok) return void toast.error(result.error);
              toast.success("Project archived");
              router.push("/app");
            })
          }
        >
          <Archive className="size-4" /> Archive project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
