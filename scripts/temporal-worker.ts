import path from "path";
import { fileURLToPath } from "url";
import { config as loadEnv } from "dotenv";
import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "../src/temporal/activities";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, "../.env.local") });

async function main() {
  const address = process.env.TEMPORAL_ADDRESS?.trim() || "localhost:7233";
  const connection = await NativeConnection.connect({ address });
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
