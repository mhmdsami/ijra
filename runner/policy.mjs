export const protectedPath = /(^|\/)(package(-lock)?\.json|bun\.lockb?|pnpm-lock\.yaml|yarn\.lock|\.github\/|migrations?\/|src\/lib\/|src\/app\/api\/|auth)/i;

export const TYPE_BRANCH = { feat: "ft", fix: "fx", chore: "ch", refactor: "rf", docs: "ch" };

export function firstLine(s) {
  return s.trim().split("\n")[0];
}

export function slug(s) {
  const words = firstLine(s).trim().split(/\s+/).filter(Boolean).slice(0, 4);
  return words.join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "request";
}

export function glob(pattern) {
  const esc = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\0")
    .replace(/\*/g, "[^/]*")
    .replace(/\0/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${esc}$`);
}

export function changedLineCount(shortstat) {
  const added = Number(shortstat.match(/(\d+) insertion/)?.[1] ?? 0);
  const deleted = Number(shortstat.match(/(\d+) deletion/)?.[1] ?? 0);
  return added + deleted;
}

export function classifyChanges({ changed, affected, changedLines, safePaths = [] }) {
  const protectedHits = affected.filter((file) => protectedPath.test(file));
  const outsideZone = affected.filter(
    (file) => !protectedPath.test(file) && !safePaths.some((pattern) => glob(pattern).test(file))
  );
  const reasons = [];
  if (changed.length > 12) reasons.push(`changed ${changed.length} files; limit is 12`);
  if (changedLines > 400) reasons.push(`changed ${changedLines} lines; limit is 400`);
  if (protectedHits.length) reasons.push(`protected path, needs a manual change: ${protectedHits.join(", ")}`);
  if (outsideZone.length) reasons.push(`outside the safe zone: ${outsideZone.join(", ")}`);
  return { reasons, protectedHits, outsideZone };
}

export function branchFromTitle(rawTitle, session) {
  const conv = rawTitle.match(/^(\w+):\s*(.+)$/);
  const type = conv && TYPE_BRANCH[conv[1].toLowerCase()] ? conv[1].toLowerCase() : "chore";
  const subject = (conv ? conv[2] : rawTitle).trim().replace(/[.!]+$/, "").slice(0, 50);
  return {
    type,
    subject,
    title: `${type}: ${subject}`,
    branch: `${TYPE_BRANCH[type]}-${session.slice(0, 8)}-${slug(subject)}`,
  };
}

export function emptyUsage() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, costUsd: 0, modelCalls: 0 };
}

export function addUsage(total, usage) {
  if (!usage || typeof usage !== "object") return total;
  const num = (value) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);
  total.input += num(usage.input);
  total.output += num(usage.output);
  total.cacheRead += num(usage.cacheRead);
  total.cacheWrite += num(usage.cacheWrite);
  total.totalTokens += num(usage.totalTokens);
  total.costUsd += num(usage.costUsd ?? usage.cost?.total);
  return total;
}

export function parseAgentReply(text) {
  const titleMatch = text.match(/^Title:\s*(.+)$/m);
  const replyMatch = text.match(/##\s+Chat reply\s*\n([\s\S]*?)(?=\n##\s+(?:PR description|Summary|Changes|Verification|Risks)\b|$)/i);
  const prIndex = text.search(/\n##\s+PR description\b/i);
  let description;
  if (prIndex >= 0) {
    description = text.slice(prIndex).replace(/^\s*##\s+PR description\s*/i, "").trim();
  } else if (titleMatch) {
    description =
      text
        .slice(text.indexOf(titleMatch[0]) + titleMatch[0].length)
        .replace(/^\s*##\s+PR description\s*/i, "")
        .trim() || text;
  } else {
    description = text;
  }
  if (prIndex < 0 && replyMatch) {
    description = description.replace(replyMatch[0], "").trim();
  }
  return { title: titleMatch?.[1]?.trim() ?? "", chatReply: replyMatch?.[1]?.trim() ?? "", description: description.trim() };
}

export function stripSessionFooter(body) {
  const stops = [body.indexOf("\n\n---\nSession:"), body.indexOf("\n| | |")].filter((index) => index !== -1);
  if (stops.length === 0) return body.trim();
  return body.slice(0, Math.min(...stops)).trim();
}
