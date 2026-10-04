import path from "path";
import { fileURLToPath } from "url";
import { config as loadEnv } from "dotenv";
import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "../src/temporal/activities";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, "../.env.local") });

async function main() {
  const address = process.env.TEMPORAL_ADDRESS?.trim() || "localhost:7233";
  let connection: NativeConnection;
  try {
    connection = await NativeConnection.connect({ address });
  } catch {
    console.error(
      `Cannot reach Temporal at ${address} (connection refused).\n` +
        "  Start server: npm run temporal:up\n" +
        "  Or stop this worker and unset TEMPORAL_ADDRESS in .env.local if you are not using Temporal.",
    );
    process.exit(1);
  }
  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE?.trim() || "default",
    taskQueue: "house-pot",
    workflowsPath: path.join(__dirname, "../src/temporal/workflows.ts"),
    activities,
  });
  console.log(`House Pot Temporal worker on ${address} (queue: house-pot)`);
  await worker.run();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
