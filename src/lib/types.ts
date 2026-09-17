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
