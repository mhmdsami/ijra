"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ComposerControls } from "@/components/composer-controls";
import { MODELS } from "@/lib/projects";

export function NewRequest({ projects }: { projects: string[] }) {
  const router = useRouter();
  const [project, setProject] = useState("");
  const [content, setContent] = useState("");
  const [model, setModel] = useState<string>(MODELS[0]);
  const [busy, setBusy] = useState(false);

  async function create() {
    const request = content.trim();
    if (!project || !request || busy) return;
    setBusy(true);
    const sessionResponse = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project }),
    });
    if (!sessionResponse.ok) {
      setBusy(false);
      return;
    }
    const { id } = (await sessionResponse.json()) as { id: string };
    const messageResponse = await fetch(`/api/sessions/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: request, model }),
    });
    router.push(`/s/${id}`);
    if (!messageResponse.ok) setBusy(false);
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-[0_20px_60px_-35px_rgb(0_0_0_/_0.9)]">
      <Textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); create(); }
        }}
        placeholder="Tell ijra what to fix"
        rows={3}
        className="min-h-20 resize-none border-0 bg-transparent px-0 py-0 text-sm leading-6 shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
        <label className="sr-only" htmlFor="project">Project</label>
        <select id="project" value={project} onChange={(event) => setProject(event.target.value)} className="max-w-[40%] appearance-none bg-transparent text-xs text-muted-foreground outline-none">
          <option value="" disabled>Choose a project</option>
          {projects.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <ComposerControls
          model={model}
          onModel={setModel}
          onSend={create}
          busy={busy}
          disabled={!project || !content.trim()}
        />
      </div>
    </div>
  );
}
