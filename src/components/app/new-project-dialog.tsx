"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createProject } from "@/app/actions/workspace";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PROJECT_COLORS } from "@/components/app/project-colors";
import { cn } from "@/lib/utils";
import type { ProjectColor } from "@/lib/supabase/types";

export function NewProjectDialog() {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState<ProjectColor>("violet");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(form: FormData) {
    form.set("color", color);
    startTransition(async () => {
      const result = await createProject(form);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Project created");
      setOpen(false);
      router.push(`/app/projects/${result.data!.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>Visible to everyone in this organization.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={120} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" maxLength={2000} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Colour</Label>
            <div className="flex gap-2">
              {(Object.keys(PROJECT_COLORS) as ProjectColor[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={PROJECT_COLORS[c].label}
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-7 rounded-full ring-offset-2 ring-offset-background transition",
                    PROJECT_COLORS[c].dot,
                    color === c ? "ring-2 ring-foreground" : "opacity-60 hover:opacity-100",
                  )}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
