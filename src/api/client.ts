import type { BakeResponse, ExternalParentBakeRequest, SceneSummary } from "./types";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
}>;

export interface RuntimeConfig {
  apiBaseUrl: string;
  uiBaseUrl?: string;
}

export async function loadRuntimeConfig(fetchImpl: FetchLike = fetch): Promise<RuntimeConfig | null> {
  let response;
  try {
    response = await fetchImpl("/__mmd_ext_parent_config.json", { method: "GET" });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  try {
    const payload = await response.json();
    if (!payload || typeof payload !== "object" || !("apiBaseUrl" in payload) || typeof payload.apiBaseUrl !== "string") {
      return null;
    }
    const apiBaseUrl = payload.apiBaseUrl.trim();
    if (!apiBaseUrl) {
      return null;
    }
    const config: RuntimeConfig = { apiBaseUrl };
    if ("uiBaseUrl" in payload && typeof payload.uiBaseUrl === "string" && payload.uiBaseUrl.trim()) {
      config.uiBaseUrl = payload.uiBaseUrl.trim();
    }
    return config;
  } catch {
    return null;
  }
}

export function resolveApiBaseUrlFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const candidate = params.get("apiBaseUrl")?.trim();
  if (!candidate) {
    return null;
  }

  try {
    const parsedUrl = new URL(candidate);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }
    return normalizeBaseUrl(parsedUrl.toString());
  } catch {
    return null;
  }
}

export async function fetchSceneSummary(
  baseUrl: string,
  fetchImpl: FetchLike = fetch,
): Promise<SceneSummary> {
  return requestJson<SceneSummary>(baseUrl, "/scene", { method: "GET" }, fetchImpl);
}

export async function bakeExternalParent(
  baseUrl: string,
  payload: ExternalParentBakeRequest,
  fetchImpl: FetchLike = fetch,
): Promise<BakeResponse> {
  return requestJson<BakeResponse>(
    baseUrl,
    "/bake/external-parent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    fetchImpl,
  );
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  init: RequestInit,
  fetchImpl: FetchLike,
): Promise<T> {
  const url = `${normalizeBaseUrl(baseUrl)}${path}`;
  let response;
  try {
    response = await fetchImpl(url, init);
  } catch {
    throw new ApiError("Connection failed. Ensure the Blender service is running.", 0);
  }

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status ?? 0);
  }

  return (await response.json()) as T;
}

async function readErrorMessage(response: { status?: number; json: () => Promise<unknown> }) {
  try {
    const payload = await response.json();
    if (
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string" &&
      payload.error.trim()
    ) {
      return payload.error;
    }
  } catch {
    // Ignore invalid JSON and fall back to the HTTP status.
  }
  return `Request failed with status ${response.status ?? 0}`;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "");
}
