import { startApprovalGate } from "../src/lib/mastra/approval-gate";
import { existsSync } from "fs";

const r = await startApprovalGate({
  cookName: "Test",
  allergies: ["peanuts"],
  pantryText: "rice onion",
  diners: 2,
});
console.log(r);
console.log("mastra.db", existsSync(".data/mastra.db"));
