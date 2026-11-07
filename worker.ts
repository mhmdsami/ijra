import generated from "./.open-next/worker.js";
import { auditCutoff, PURGE_AUDIT_SQL } from "./src/lib/audit-retention";

type Env = {
  DB: D1Database;
};

export default {
  fetch: generated.fetch,
  async scheduled(_controller: ScheduledController, env: Env) {
    const result = await env.DB.prepare(PURGE_AUDIT_SQL).bind(auditCutoff()).run();
    console.log(`audit purge: ${result.meta.changes} events deleted`);
  },
} satisfies ExportedHandler<Env>;
