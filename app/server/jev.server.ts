/**
 * STAND-IN until the PR with the one Jev switch is merged (thread "Eén schakelaar voor Jev in
 * beheer"); that PR's file replaces this one. Same shape: Jev's endpoint and key, or null.
 */
import { DECISIONS } from "~/lib/ai/models";
import { providerSetting } from "./env.server";

interface JevAccess {
  url: string;
  model: string;
  provider: string;
  apiKey: string;
}

export async function jevAccess(): Promise<JevAccess | null> {
  const apiKey = DECISIONS ? providerSetting(DECISIONS.keyEnv) : undefined;
  if (!DECISIONS || !apiKey) return null;
  const { url, model, provider } = DECISIONS;
  return { url, model, provider, apiKey };
}
