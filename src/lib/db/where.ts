/** Tiny helper to build parameterised WHERE clauses: add("x = ?", v) → "x = $1". Never interpolates values. */
export function whereBuilder() {
  const params: unknown[] = [];
  const parts: string[] = [];
  return {
    params,
    add(sql: string, ...values: unknown[]) {
      let s = sql;
      for (const v of values) {
        params.push(v);
        s = s.replace("?", `$${params.length}`);
      }
      parts.push(s);
    },
    /** Pushes a parameter and returns its placeholder, for LIMIT/OFFSET etc. */
    param(v: unknown) {
      params.push(v);
      return `$${params.length}`;
    },
    get sql() {
      return parts.length ? `where ${parts.join(" and ")}` : "";
    },
  };
}
