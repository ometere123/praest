export interface AssertionInput {
  statusCode: number;
  totalMs: number;
  body: string;
  headers: Record<string, string | string[] | undefined>;
}

function getPath(obj: any, path: string) {
  return path.split(".").filter(Boolean).reduce((a: any, x) => a?.[x], obj);
}

/**
 * Same assertion evaluation the native prober has always used, extracted so
 * every probe provider (native, Globalping, any future one) normalizes into
 * identical pass/fail semantics regardless of where the raw response came
 * from.
 */
export function evaluateAssertions(a: any, r: AssertionInput): { ok: boolean } {
  let ok = r.statusCode >= 200 && r.statusCode < 400;
  const expected = a?.expectedStatus;
  if (expected !== undefined) ok = Array.isArray(expected) ? expected.includes(r.statusCode) : Number(expected) === r.statusCode;
  if (a?.maxLatencyMs) ok = ok && r.totalMs <= Number(a.maxLatencyMs);
  if (a?.contentIncludes) ok = ok && r.body.includes(String(a.contentIncludes));
  for (const [k, v] of Object.entries(a?.headerEquals || {})) {
    const actual = r.headers[String(k).toLowerCase()];
    ok = ok && String(Array.isArray(actual) ? actual.join(",") : actual || "") === String(v);
  }
  let json: any;
  try {
    json = JSON.parse(r.body);
  } catch {}
  for (const [k, v] of Object.entries(a?.jsonPath || {})) {
    const actual = getPath(json, k);
    if (JSON.stringify(actual) !== JSON.stringify(v)) ok = false;
  }
  return { ok };
}
