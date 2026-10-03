import { probeGemma } from "@/lib/gemma";
import { embedText } from "@/lib/embeddings";
import {
  hasBackboard,
  hasElevenLabs,
  hasMongo,
  hasSerpApi,
  hasTemporal,
  hasTiger,
} from "@/lib/env";
import { probeTemporal } from "@/lib/temporal/client";
import { probeMongo } from "@/lib/db/mongo-probe";
import { probeBackboard } from "@/lib/backboard";
import { probeWhisper } from "@/lib/whisper/probe";
import { probeElevenLabs } from "@/lib/elevenlabs-probe";
import { probeSerpApi } from "@/lib/serp-probe";
import { probeTabpfn } from "@/lib/tabpfn/predict";
import { probeFreeFood } from "@/lib/kitchen/free-food";
import { probeTiger } from "@/lib/tiger/memory";
import {
  getPartnerDeployStatus,
  probeMastraStorage,
} from "@/lib/integrations/partners";

export type IntegrationStatus = {
  gemma: { configured: boolean; live: boolean };
  mongodb: { configured: boolean; reachable: boolean; vectorIndex: boolean };
  elevenlabs: { configured: boolean; live: boolean; tts: boolean; stt: boolean };
  serpapi: { configured: boolean; live: boolean };
  whisper: { live: boolean; note: string };
  mastra: { enabled: boolean; storageLive: boolean };
  sentry: { configured: boolean };
  temporal: { configured: boolean; reachable: boolean };
  embeddings: { live: boolean };
  freeFood: { meals: boolean; facts: boolean };
  backboard: { configured: boolean; reachable: boolean };
  tabpfn: { live: boolean; note: string };
  tiger: { configured: boolean; reachable: boolean };
  deploy: {
    render: boolean;
    digitalOcean: boolean;
    githubActions: boolean;
    entireExport: boolean;
  };
  storage: "mongodb" | "local-json";
};

export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  const [
    gemmaLive,
    mongoReachable,
    temporalReachable,
    embeddingsLive,
    backboardReachable,
    whisperLive,
    elevenLive,
    serpLive,
    tabpfnLive,
    freeFood,
    tigerReachable,
    mastraStorage,
    deploy,
  ] = await Promise.all([
    probeGemma(),
    probeMongo(),
    probeTemporal(),
    embedText("house pot pantry probe").then((v) => v !== null),
    probeBackboard(),
    probeWhisper(),
    probeElevenLabs(),
    probeSerpApi(),
    probeTabpfn(),
    probeFreeFood(),
    probeTiger(),
    probeMastraStorage(),
    getPartnerDeployStatus(),
  ]);

  return {
    gemma: {
      configured: Boolean(process.env.GEMMA_BASE_URL?.trim()),
      live: gemmaLive,
    },
    mongodb: {
      configured: hasMongo(),
      reachable: mongoReachable,
      vectorIndex: Boolean(process.env.MONGODB_VECTOR_INDEX?.trim()),
    },
    elevenlabs: {
      configured: hasElevenLabs(),
      live: elevenLive,
      tts: elevenLive,
      stt: elevenLive && hasElevenLabs(),
    },
    serpapi: { configured: hasSerpApi(), live: serpLive },
    whisper: {
      live: whisperLive,
      note: whisperLive
        ? "Local open-weight STT via Whisper"
        : "pip install -r requirements.txt",
    },
    mastra: { enabled: true, storageLive: mastraStorage },
    sentry: { configured: Boolean(process.env.SENTRY_DSN?.trim()) },
    temporal: {
      configured: hasTemporal(),
      reachable: temporalReachable,
    },
    embeddings: { live: embeddingsLive },
    freeFood,
    backboard: {
      configured: hasBackboard(),
      reachable: backboardReachable,
    },
    tabpfn: {
      live: tabpfnLive,
      note: tabpfnLive
        ? "Prior Labs TabPFN meal-fit classifier"
        : "pip install -r requirements-tabpfn.txt (fallback heuristic runs)",
    },
    tiger: {
      configured: hasTiger(),
      reachable: tigerReachable,
    },
    deploy,
    storage: hasMongo() && mongoReachable ? "mongodb" : "local-json",
  };
}
