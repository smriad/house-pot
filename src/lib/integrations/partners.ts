import { promises as fs } from "fs";
import path from "path";

export type PartnerDeployStatus = {
  render: boolean;
  digitalOcean: boolean;
  githubActions: boolean;
  entireExport: boolean;
};

export async function getPartnerDeployStatus(): Promise<PartnerDeployStatus> {
  const root = process.cwd();
  const exists = async (rel: string) => {
    try {
      await fs.access(path.join(root, rel));
      return true;
    } catch {
      return false;
    }
  };
  return {
    render: await exists("render.yaml"),
    digitalOcean: await exists(".do/app.yaml"),
    githubActions: await exists(".github/workflows/house-pot.yml"),
    entireExport: true,
  };
}

export async function probeMastraStorage(): Promise<boolean> {
  try {
    await fs.access(path.join(process.cwd(), ".data", "mastra.db"));
    return true;
  } catch {
    return false;
  }
}
