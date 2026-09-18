"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ComposerControls } from "@/components/composer-controls";

export function NewRequest({ projects, models, defaultModel }: { projects: string[]; models: { id: string; label: string }[]; defaultModel: string }) {
  const router = useRouter();
  const [project, setProject] = useState("");
  const [content, setContent] = useState("");
  const [model, setModel] = useState<string>(defaultModel);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const request = content.trim();
    if (!project || !request || busy) return;
    setBusy(true);
    setError(null);
    try {
      const sessionResponse = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project }),
      });
      if (!sessionResponse.ok) {
        const body = (await sessionResponse.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not start a session.");
        return;
      }
      const { id } = (await sessionResponse.json()) as { id: string };
      const messageResponse = await fetch(`/api/sessions/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: request, model }),
      });
      if (!messageResponse.ok) {
        const body = (await messageResponse.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not send the request.");
        return;
      }
      router.push(`/s/${id}`);
    } catch {
      setError("Could not send the request. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-[0_20px_60px_-35px_rgb(0_0_0_/_0.9)]">
      {error && <p role="alert" className="mb-3 rounded-lg border border-destructive/40 px-3 py-2 text-xs text-destructive">{error}</p>}
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
          models={models}
          onModel={setModel}
          onSend={create}
          busy={busy}
          disabled={!project || !content.trim()}
        />
      </div>
    </div>
  );
}
