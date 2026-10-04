import { promises as fs } from "fs";
import path from "path";

export type PartnerDeployStatus = {
  render: boolean;
  githubActions: boolean;
  entireExport: boolean;
};

export async function getPartnerDeployStatus(): Promise<PartnerDeployStatus> {
  const root = process.cwd();
  const exists = async (filePath: string) => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  };
  return {
    render: await exists(path.join(root, "render.yaml")),
    githubActions: await exists(
      path.join(root, ".github", "workflows", "house-pot.yml"),
    ),
    entireExport: true,
  };
}

export async function probeMastraStorage(): Promise<boolean> {
  const dataDir = path.join(process.cwd(), ".data");
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.access(path.join(dataDir, "mastra.db"));
    return true;
  } catch {
    try {
      const probe = path.join(dataDir, ".mastra-write-probe");
      await fs.writeFile(probe, "ok");
      await fs.unlink(probe);
      return true;
    } catch {
      return false;
    }
  }
}
