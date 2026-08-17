const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
}

export interface ExtractedField {
  id: string;
  field_key: string;
  extracted_value: string | null;
  critic_score: number;
  auditor_score: number;
  consensus_value: string | null;
  confidence_score: number;
  is_modified: boolean;
  validation_status: "VALID" | "FLAGGED" | "MANUAL_CORRECTION";
  validation_notes: string | null;
}

export interface DocumentResponse {
  id: string;
  filename: string;
  file_type: string;
  category: "INVOICE" | "RFQ" | "PURCHASE_ORDER" | "CONTRACT" | "COMPLIANCE" | "UNKNOWN";
  status: "INGESTED" | "PROCESSING" | "FAILED" | "AWAITING_REVIEW" | "PROCESSED";
  ocr_text: string | null;
  consensus_score: number | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  fields: ExtractedField[];
}

export interface DocumentSimpleResponse {
  id: string;
  filename: string;
  file_type: string;
  category: string;
  status: string;
  consensus_score: number | null;
  created_at: string;
  uploader_name: string;
}

export interface KPIMetrics {
  total_documents: number;
  processed_documents: number;
  pending_review: number;
  failed_documents: number;
  average_accuracy: number;
  human_review_rate: number;
  average_processing_time_seconds: number;
}

export interface ChartData {
  category_distribution: { category: string; count: number }[];
  status_distribution: { status: string; count: number }[];
  daily_trends: { date: string; count: number }[];
}

export interface AuditLogResponse {
  id: string;
  document_id: string | null;
  filename: string;
  operator: string;
  action: string;
  details: Record<string, unknown> | null;
  timestamp: string;
}

export interface CrawledPage {
  id: string;
  url: string;
  title: string | null;
  pagerank: number;
  last_crawled_at: string;
  page_content?: string;
}

export interface HealthStatus {
  status: string;
  checks: Record<string, { status: string; type?: string; error?: string; latency?: string }>;
}

export interface SemanticSearchResult {
  id: string;
  filename: string;
  category: string | null;
  confidence_score: number;
  excerpt: string;
}

export interface SearchResultItem {
  id: string;
  filename: string;
  type: "file" | "web";
  category: string;
  url?: string;
  consensus_score: number | null;
  created_at: string;
  snippet?: string;
  excerpt?: string;
  score?: number | null;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export interface BookmarkResponse {
  id: string;
  user_id: string;
  name: string;
  title?: string;
  query_text: string;
  query?: string;
  filters: Record<string, any> | null;
  tags?: string[];
  created_at: string;
}

export interface ExpandQueryResponse {
  original_query: string;
  expanded_queries: string[];
  expansions?: string[];
}

export interface ApiKeyCreateResponse extends ApiKeyResponse {
  api_key: string;
}

export interface CommentResponse {
  id: string;
  document_id: string;
  field_key: string | null;
  user_id: string | null;
  content: string;
  created_at: string;
  user_name: string;
}

export function clearLegacyTokens(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("doc_intel_token");
    localStorage.removeItem("doc_intel_refresh_token");
  }
}

// Request wrapper helper
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("doc_intel_token");
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include", // Enforce credentials inclusion for HttpOnly cookie handling
  });

  if (response.status === 401) {
    // Prevent infinite loop if the refresh endpoint itself returns 401
    if (path !== "/api/auth/refresh" && path !== "/api/auth/login") {
      try {
        const storedRefreshToken = typeof window !== "undefined" ? localStorage.getItem("doc_intel_refresh_token") : null;
        const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(storedRefreshToken ? { Authorization: `Bearer ${storedRefreshToken}` } : {}),
          },
          body: storedRefreshToken ? JSON.stringify({ refresh_token: storedRefreshToken }) : undefined,
          credentials: "include",
        });
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          if (typeof window !== "undefined" && refreshData?.access_token) {
            localStorage.setItem("doc_intel_token", refreshData.access_token);
            if (refreshData.refresh_token) {
              localStorage.setItem("doc_intel_refresh_token", refreshData.refresh_token);
            }
          }
          const retryHeaders = new Headers(options.headers || {});
          if (refreshData?.access_token) {
            retryHeaders.set("Authorization", `Bearer ${refreshData.access_token}`);
          }
          const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers: retryHeaders,
            credentials: "include",
          });
          if (retryResponse.ok) {
            if (retryResponse.status === 204) return null as unknown as T;
            return retryResponse.json() as Promise<T>;
          }
        }
      } catch (err) {
        console.error("Token refresh failed:", err);
      }
    }
    
    clearLegacyTokens();
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `HTTP error! status: ${response.status}`);
  }

  if (response.status === 244 || response.status === 204) {
    return null as unknown as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Authentication
  login: async (email: string, password: string): Promise<{ access_token: string; refresh_token: string; token_type: string }> => {
    const data = await request<{ access_token: string; refresh_token: string; token_type: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (typeof window !== "undefined" && data?.access_token) {
      localStorage.setItem("doc_intel_token", data.access_token);
      if (data.refresh_token) {
        localStorage.setItem("doc_intel_refresh_token", data.refresh_token);
      }
    }
    return data;
  },

  logout: async (): Promise<void> => {
    clearLegacyTokens();
    return request("/api/auth/logout", {
      method: "POST",
    });
  },

  register: async (email: string, password: string, fullName: string, role: string): Promise<UserResponse> => {
    return request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name: fullName, role }),
    });
  },

  getMe: async (): Promise<UserResponse> => {
    return request("/api/auth/me");
  },

  updateProfile: async (data: { full_name?: string; email?: string }): Promise<UserResponse> => {
    return request("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    return request("/api/auth/me/password", {
      method: "POST",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  },

  // Team Management (Admin only)
  listUsers: async (): Promise<UserResponse[]> => {
    return request("/api/auth/users");
  },

  updateUserRole: async (userId: string, role: string): Promise<UserResponse> => {
    return request(`/api/auth/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },

  deleteUser: async (userId: string): Promise<void> => {
    return request(`/api/auth/users/${userId}`, { method: "DELETE" });
  },

  refreshToken: async (refreshToken?: string): Promise<{ access_token: string; refresh_token: string; token_type: string }> => {
    return request("/api/auth/refresh", {
      method: "POST",
      body: refreshToken ? JSON.stringify({ refresh_token: refreshToken }) : undefined,
    });
  },

  // Documents
  uploadDocument: async (file: File): Promise<DocumentResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    return request("/api/documents/upload", {
      method: "POST",
      body: formData,
    });
  },

  listDocuments: async (category?: string, status?: string): Promise<DocumentSimpleResponse[]> => {
    let url = "/api/documents";
    const params = new URLSearchParams();
    if (category) params.append("category", category);
    if (status) params.append("status", status);
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    return request(url);
  },

  getDocument: async (id: string): Promise<DocumentResponse> => {
    return request(`/api/documents/${id}`);
  },

  reprocessDocument: async (id: string): Promise<DocumentResponse> => {
    return request(`/api/documents/${id}/reprocess`, {
      method: "POST",
    });
  },

  deleteDocument: async (id: string): Promise<void> => {
    return request(`/api/documents/${id}`, {
      method: "DELETE",
    });
  },

  // Review
  getReviewQueue: async (): Promise<DocumentSimpleResponse[]> => {
    return request("/api/review/queue");
  },

  lockDocument: async (id: string): Promise<{ message: string; locked_by: string }> => {
    return request(`/api/review/${id}/lock`, {
      method: "POST",
    });
  },

  unlockDocument: async (id: string): Promise<{ message: string }> => {
    return request(`/api/review/${id}/unlock`, {
      method: "POST",
    });
  },

  submitReview: async (id: string, updates: { field_key: string; consensus_value: string }[], lockToken?: string): Promise<DocumentResponse> => {
    const queryStr = lockToken ? `?lock_token=${lockToken}` : "";
    return request(`/api/review/${id}/submit${queryStr}`, {
      method: "POST",
      body: JSON.stringify({ updates }),
    });
  },

  // Search
  searchMetadata: async (query?: string, category?: string, status?: string, minScore?: number, expand?: boolean): Promise<SearchResultItem[]> => {
    let url = "/api/search";
    const params = new URLSearchParams();
    if (query) params.append("query", query);
    if (category) params.append("category", category);
    if (status) params.append("status", status);
    if (minScore !== undefined) params.append("min_score", minScore.toString());
    if (expand !== undefined) params.append("expand", expand.toString());
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    return request(url);
  },

  searchSemantic: async (query: string, category?: string, nResults: number = 5): Promise<SearchResultItem[]> => {
    interface BackendSemanticResult {
      id: string;
      document_id: string;
      filename: string;
      category: string;
      text: string;
      distance: number;
    }
    const raw = await request<BackendSemanticResult[]>("/api/search/semantic", {
      method: "POST",
      body: JSON.stringify({ query, category, n_results: nResults }),
    });
    return raw.map((item) => {
      const score = 1.0 - (item.distance / 2.0);
      return {
        id: item.document_id,
        filename: item.filename,
        type: "file",
        category: item.category,
        consensus_score: score,
        created_at: new Date().toISOString(),
        excerpt: item.text,
        snippet: item.text,
        score: score,
      };
    });
  },

  askRagChat: async (documentIds: string[], question: string): Promise<{ answer: string }> => {
    return request("/api/search/rag", {
      method: "POST",
      body: JSON.stringify({ document_ids: documentIds, question }),
    });
  },

  expandQuery: async (query: string): Promise<ExpandQueryResponse> => {
    return request("/api/search/expand", {
      method: "POST",
      body: JSON.stringify({ query }),
    });
  },

  listBookmarks: async (): Promise<BookmarkResponse[]> => {
    return request("/api/bookmarks");
  },

  createBookmark: async (name: string, queryText: string, filters?: Record<string, any>): Promise<BookmarkResponse> => {
    return request("/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({ name, query_text: queryText, filters }),
    });
  },

  deleteBookmark: async (bookmarkId: string): Promise<void> => {
    return request(`/api/bookmarks/${bookmarkId}`, {
      method: "DELETE",
    });
  },

  exportSearchResults: async (query: string, format: "csv" | "pdf", category?: string, status?: string, minScore?: number): Promise<Blob> => {
    const params = new URLSearchParams({ format });
    if (query) params.append("query", query);
    if (category) params.append("category", category);
    if (status) params.append("status", status);
    if (minScore !== undefined) params.append("min_score", minScore.toString());

    let token: string | null = null;
    const cookieMatch = document.cookie && document.cookie.match(/(?:^|; )access_token=([^;]*)/);
    if (cookieMatch) {
      token = decodeURIComponent(cookieMatch[1]);
    }
    const legacyToken = typeof window !== "undefined" ? localStorage.getItem("doc_intel_token") : null;
    if (legacyToken) {
      token = legacyToken;
    }

    const response = await fetch(`${API_BASE_URL}/api/search/export?${params.toString()}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
    });
    if (!response.ok) throw new Error("Export failed");
    return response.blob();
  },

  // Analytics
  getKpis: async (): Promise<KPIMetrics> => {
    return request("/api/analytics/kpis");
  },

  getCharts: async (): Promise<ChartData> => {
    return request("/api/analytics/charts");
  },

  getAuditLogs: async (limit: number = 50): Promise<AuditLogResponse[]> => {
    return request(`/api/analytics/audit-logs?limit=${limit}`);
  },

  getAgentStats: async () => {
    return request<{
      avg_critic_score: number; avg_auditor_score: number; avg_confidence: number;
      flagged_fields_count: number; total_fields: number; flag_rate_pct: number;
      documents_processed: number; documents_failed: number;
      agent_latency: { name: string; latency: number }[];
    }>("/api/analytics/agent-stats");
  },

  getSearchStats: async () => {
    return request<{
      top_queries: { text: string; count: number }[];
      zero_result_queries: { query: string; timestamp: string; count: number }[];
      avg_latency_ms: number;
      daily_volume: { date: string; count: number }[];
    }>("/api/analytics/search-stats");
  },

  getCrawlStats: async () => {
    return request<{
      total_pages: number; avg_pagerank: number;
      top_pages: { name: string; rank: number; url: string }[];
      pagerank_distribution: { bucket: string; count: number }[];
    }>("/api/analytics/crawl-stats");
  },

  // Health
  getHealth: async (): Promise<HealthStatus> => {
    return request("/health");
  },

  // Crawl & Auto-Suggest
  searchSuggest: async (q: string): Promise<string[]> => {
    return request(`/api/search/suggest?q=${encodeURIComponent(q)}`);
  },

  startCrawl: async (url: string, maxDepth: number = 2): Promise<{ message: string }> => {
    return request("/api/crawl", {
      method: "POST",
      body: JSON.stringify({ url, max_depth: maxDepth }),
    });
  },

  getCrawledPages: async (): Promise<CrawledPage[]> => {
    return request("/api/crawl/pages");
  },

  recalculatePageRank: async (): Promise<{ message: string }> => {
    return request("/api/crawl/pagerank", {
      method: "POST",
    });
  },

  // API Keys (Settings)
  generateApiKey: async (name: string, expiresInDays?: number): Promise<ApiKeyCreateResponse> => {
    return request("/api/auth/apikeys", {
      method: "POST",
      body: JSON.stringify({ name, expires_in_days: expiresInDays }),
    });
  },

  listApiKeys: async (): Promise<ApiKeyResponse[]> => {
    return request("/api/auth/apikeys");
  },

  revokeApiKey: async (id: string): Promise<void> => {
    return request(`/api/auth/apikeys/${id}`, {
      method: "DELETE",
    });
  },

  // Comments (Review Workspace)
  getComments: async (documentId: string): Promise<CommentResponse[]> => {
    return request(`/api/documents/${documentId}/comments`);
  },

  createComment: async (documentId: string, content: string, fieldKey: string | null = null): Promise<CommentResponse> => {
    return request(`/api/documents/${documentId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content, field_key: fieldKey }),
    });
  },

  deleteComment: async (commentId: string): Promise<void> => {
    return request(`/api/documents/comments/${commentId}`, {
      method: "DELETE",
    });
  },

  // ── RAG Chat with Citations (Roadmap 1.6) ──────────────────────────────────

  askRag: async (
    documentIds: string[],
    question: string,
    sessionId?: string,
    history?: { role: string; content: string }[]
  ): Promise<{
    session_id: string;
    answer: string;
    citations: { document_id: string; filename: string; field_key?: string; quote: string }[];
    latency_ms: number;
  }> => {
    return request("/api/rag/ask", {
      method: "POST",
      body: JSON.stringify({
        document_ids: documentIds,
        question,
        session_id: sessionId,
        history: history ?? [],
      }),
    });
  },

  askRagStream: (
    documentIds: string[],
    question: string,
    sessionId?: string,
    history?: { role: string; content: string }[]
  ): EventSource => {
    // Note: EventSource doesn't support POST with body natively.
    // We use a workaround with fetch + ReadableStream on the caller side.
    // This function returns the fetch promise instead.
    throw new Error("Use fetchRagStream for streaming — EventSource doesn't support POST.");
  },

  fetchRagStream: async (
    documentIds: string[],
    question: string,
    sessionId?: string,
    history?: { role: string; content: string }[]
  ): Promise<Response> => {
    return fetch(`${API_BASE_URL}/api/rag/ask/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        document_ids: documentIds,
        question,
        session_id: sessionId,
        history: history ?? [],
      }),
    });
  },

  getRagSession: async (sessionId: string): Promise<{
    session_id: string;
    messages: { role: string; content: string }[];
    turn_count: number;
  }> => {
    return request(`/api/rag/session/${sessionId}`);
  },

  clearRagSession: async (sessionId: string): Promise<void> => {
    return request(`/api/rag/session/${sessionId}`, { method: "DELETE" });
  },

  getRagHistory: async (limit = 20): Promise<{
    id: string;
    session_id: string;
    question: string;
    answer_preview: string;
    doc_count: number;
    citations_count: number;
    timestamp: string;
  }[]> => {
    return request(`/api/rag/history?limit=${limit}`);
  },

  // ── 2FA / TOTP (Roadmap 1.2) ───────────────────────────────────────────────

  setup2FA: async (): Promise<{
    secret: string;
    qr_code_uri: string;
    qr_code_image: string;
    message: string;
  }> => {
    return request("/api/auth/2fa/setup", { method: "POST" });
  },

  verify2FA: async (totpCode: string): Promise<{ message: string; totp_enabled: boolean }> => {
    return request(`/api/auth/2fa/verify?totp_code=${totpCode}`, { method: "POST" });
  },

  disable2FA: async (totpCode: string): Promise<{ message: string; totp_enabled: boolean }> => {
    return request(`/api/auth/2fa/disable?totp_code=${totpCode}`, { method: "POST" });
  },

  validate2FA: async (totpCode: string): Promise<{ valid: boolean; message: string }> => {
    return request(`/api/auth/2fa/validate?totp_code=${totpCode}`, { method: "POST" });
  },

  // ── Synonyms, Classification Probabilities & Line-Item Audits ────────────────

  getSynonyms: async (): Promise<Record<string, string[]>> => {
    return request("/api/documents/settings/synonyms");
  },

  updateSynonyms: async (data: Record<string, string[]>): Promise<any> => {
    return request("/api/documents/settings/synonyms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  getDocumentProbabilities: async (documentId: string): Promise<Record<string, number>> => {
    return request(`/api/documents/${documentId}/probabilities`);
  },

  getDocumentAuditLineItems: async (documentId: string): Promise<{
    line_items: any[];
    audit_results: any[];
  }> => {
    return request(`/api/documents/${documentId}/audit-line-items`);
  },

  // ── Generic HTTP Helpers ───────────────────────────────────────────────────

  get: async <T>(path: string): Promise<T> => {
    return request<T>(path, { method: "GET" });
  },

  post: async <T>(path: string, body?: unknown): Promise<T> => {
    return request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put: async <T>(path: string, body?: unknown): Promise<T> => {
    return request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete: async <T = void>(path: string): Promise<T> => {
    return request<T>(path, { method: "DELETE" });
  },
};
