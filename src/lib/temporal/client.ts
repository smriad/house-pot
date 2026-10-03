import { Connection, Client, WorkflowIdConflictPolicy } from "@temporalio/client";
import { hasTemporal } from "@/lib/env";

const TASK_QUEUE = "house-pot";

function temporalAddress(): string {
  return process.env.TEMPORAL_ADDRESS?.trim() || "localhost:7233";
}

function temporalNamespace(): string {
  return process.env.TEMPORAL_NAMESPACE?.trim() || "default";
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const connection = await Connection.connect({ address: temporalAddress() });
  try {
    const client = new Client({
      connection,
      namespace: temporalNamespace(),
    });
    return await fn(client);
  } finally {
    await connection.close();
  }
}

export async function probeTemporal(): Promise<boolean> {
  if (!hasTemporal()) return false;
  try {
    const connection = await Connection.connect({
      address: temporalAddress(),
      connectTimeout: 3000,
    });
    await connection.close();
    return true;
  } catch {
    return false;
  }
}

/** Durable narration: worker must be running (`npm run temporal:worker`). */
export async function executeNarrationWorkflow(runId: string): Promise<void> {
  await withClient((client) =>
    client.workflow.execute("narrateApprovedRecipeWorkflow", {
      taskQueue: TASK_QUEUE,
      workflowId: `narrate-${runId}`,
      args: [runId],
      workflowIdConflictPolicy: WorkflowIdConflictPolicy.TERMINATE_EXISTING,
    }),
  );
}
