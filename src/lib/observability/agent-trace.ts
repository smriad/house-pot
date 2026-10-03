import * as Sentry from "@sentry/nextjs";

export async function withAgentSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T>,
): Promise<T> {
  return Sentry.startSpan(
    {
      name,
      op: "housepot.agent",
      attributes,
    },
    async () => fn(),
  );
}
