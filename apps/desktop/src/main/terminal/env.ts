import { ENV_DENYLIST_PATTERNS } from '../constants';

export function filterEnv(input: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v == null) continue;
    if (ENV_DENYLIST_PATTERNS.some((re) => re.test(k))) continue;
    out[k] = v;
  }
  return out;
}
