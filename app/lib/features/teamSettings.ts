import { z } from "zod";

const choice = z.enum(["on", "off"]);

/**
 * A team's choices (P28.3), stored as JSON on `teams.settings_json`: per feature and per
 * tool "on" or "off" (absent = no choice), and an own model set (null = follows the
 * instance). Parsing never throws: anything unreadable counts as "no choice".
 */
export const TeamSettingsSchema = z
  .object({
    features: z.record(z.string(), choice).catch({}).default({}),
    tools: z.record(z.string(), choice).catch({}).default({}),
    models: z.array(z.string()).nullable().catch(null).default(null),
  })
  .catch({ features: {}, tools: {}, models: null });

export type TeamSettings = z.infer<typeof TeamSettingsSchema>;

const NO_TEAM_SETTINGS: TeamSettings = { features: {}, tools: {}, models: null };

export function parseTeamSettings(json: string | null | undefined): TeamSettings {
  try {
    return TeamSettingsSchema.parse(JSON.parse(json ?? "{}"));
  } catch {
    return NO_TEAM_SETTINGS;
  }
}
