export const RETRYABLE_STATUSES = ["failed", "cancelled", "rejected", "blocked", "closed"] as const;

export const allowedRunTransitions: Record<string, readonly string[]> = {
  dispatching: ["running", "awaiting_review", "answered", "no_changes", "done", "failed", "cancelled"],
  running: ["awaiting_review", "answered", "no_changes", "done", "merged", "failed", "cancelled"],
  awaiting_review: ["merged", "rejected", "closed"],
  done: ["merged"],
  closed: ["awaiting_review"],
};

export function canTransition(from: string, to: string) {
  return allowedRunTransitions[from]?.includes(to) ?? false;
}

export function canRetry(status: string) {
  return (RETRYABLE_STATUSES as readonly string[]).includes(status);
}
