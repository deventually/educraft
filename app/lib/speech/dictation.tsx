import { createContext, useContext } from "react";

/**
 * Whether this LimeOnIt has a speech server for dictation (`speechToText` in
 * `config/models.json`). The root loader decides; components only read it.
 */
const DictationContext = createContext(false);

export function DictationProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return <DictationContext.Provider value={enabled}>{children}</DictationContext.Provider>;
}

export function useDictationEnabled(): boolean {
  return useContext(DictationContext);
}

/** Dictated text after what a field already holds: one space between, none after a newline. */
export function appendDictation(current: string, text: string): string {
  if (!current) return text;
  return /\s$/.test(current) ? `${current}${text}` : `${current} ${text}`;
}
