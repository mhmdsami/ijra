export type ModelCatalogResponse = {
  "opencode-go"?: {
    models?: Record<string, {
      name?: string;
      status?: string;
      modalities?: { input?: string[] };
    }>;
  };
};

export type CatalogModel = {
  id: string;
  name: string;
  vision: boolean;
  deprecated: boolean;
};

export type SessionImage = {
  id: string;
  session_id: string;
  run_id: string | null;
  mime: string;
  width: number | null;
  height: number | null;
  created_at: number;
};

export type ProgressKind = "stage" | "text" | "tool";

export type ProgressEvent = {
  seq: number;
  kind: ProgressKind;
  text: string;
};

export type ProgressRow = ProgressEvent & {
  id: number;
  run_id: string;
  created_at: number;
};

export type StreamEvent =
  | { type: "stage" | "text" | "tool"; text: string }
  | { type: "done" | "reconnect" };
