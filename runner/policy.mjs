export const protectedPath = /(^|\/)(package(-lock)?\.json|bun\.lockb?|pnpm-lock\.yaml|yarn\.lock|\.github\/|migrations?\/|src\/lib\/|src\/app\/api\/|auth)/i;

export const TYPE_BRANCH = { feat: "ft", fix: "fx", chore: "ch", refactor: "rf", docs: "ch" };

export function firstLine(s) {
  return s.trim().split("\n")[0];
}

export function slug(s) {
  return firstLine(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "request";
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
