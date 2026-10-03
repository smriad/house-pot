import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { kitchenApprovalWorkflow } from "@/lib/mastra/kitchen-workflow";

const globalKey = "__house_pot_mastra__";

function createMastra(): Mastra {
  return new Mastra({
    workflows: {
      kitchenApproval: kitchenApprovalWorkflow,
    },
    storage: new LibSQLStore({
      id: "house-pot-mastra",
      url: "file:./.data/mastra.db",
    }),
  });
}

export function getMastra(): Mastra {
  const g = globalThis as typeof globalThis & { [globalKey]?: Mastra };
  if (!g[globalKey]) {
    g[globalKey] = createMastra();
  }
  return g[globalKey];
}
