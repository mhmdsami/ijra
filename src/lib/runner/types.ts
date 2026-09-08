export interface RunInput {
  session: string;
  project: string;
  request: string;
  model: string;
}

export type RunState =
  | { status: "dispatching" | "running" }
  | { status: "done" | "awaiting_review"; prUrl: string | null; safeZone: boolean | null }
  | { status: "merged"; prUrl: string }
  | { status: "cancelled" | "failed"; runUrl: string | null };
