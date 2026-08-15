/**
 * Utility to clear legacy tokens from localStorage after migrating to HttpOnly cookies.
 */
export function clearLegacyTokens(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem("doc_intel_token");
    localStorage.removeItem("doc_intel_refresh_token");
  }
}
