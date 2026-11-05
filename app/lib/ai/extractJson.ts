/** The first JSON object in a model answer, fenced or not; `undefined` when there is none. */
export function extractJson(raw: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw)?.[1];
  const text = fenced ?? raw;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}
