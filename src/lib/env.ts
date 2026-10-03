export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function hasMongo(): boolean {
  return Boolean(process.env.MONGODB_URI?.trim());
}

export function hasGemma(): boolean {
  return Boolean(process.env.GEMMA_BASE_URL?.trim());
}

export function hasElevenLabs(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

export function hasSerpApi(): boolean {
  return Boolean(process.env.SERPAPI_API_KEY?.trim());
}

export function hasTemporal(): boolean {
  return Boolean(process.env.TEMPORAL_ADDRESS?.trim());
}

export function temporalNarrationEnabled(): boolean {
  if (process.env.TEMPORAL_NARRATE?.trim() === "false") return false;
  return hasTemporal();
}

export function hasBackboard(): boolean {
  return Boolean(
    process.env.BACKBOARD_API_KEY?.trim() &&
      process.env.BACKBOARD_ASSISTANT_ID?.trim(),
  );
}

export function hasTiger(): boolean {
  return Boolean(process.env.TIGER_DATABASE_URL?.trim());
}
