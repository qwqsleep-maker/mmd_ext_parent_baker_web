import { describe, expect, it, vi } from "vitest";

import { ApiError, fetchSceneSummary, loadRuntimeConfig, resolveApiBaseUrlFromSearch } from "./client";

describe("fetchSceneSummary", () => {
  it("returns parsed scene data on success", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        frame_start: 1,
        frame_end: 120,
        fps: 30,
        models: [],
      }),
    });

    const scene = await fetchSceneSummary("http://127.0.0.1:37601", mockFetch);

    expect(scene.frame_start).toBe(1);
    expect(scene.frame_end).toBe(120);
    expect(scene.models).toEqual([]);
  });

  it("throws ApiError with server message on failure", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: "bad request",
      }),
    });

    await expect(fetchSceneSummary("http://127.0.0.1:37601", mockFetch)).rejects.toEqual(
      new ApiError("bad request", 400),
    );
  });
});

describe("loadRuntimeConfig", () => {
  it("returns runtime config when the bundled endpoint is available", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        apiBaseUrl: "http://127.0.0.1:37601",
        uiBaseUrl: "http://127.0.0.1:41000",
      }),
    });

    const config = await loadRuntimeConfig(mockFetch);

    expect(config).toEqual({
      apiBaseUrl: "http://127.0.0.1:37601",
      uiBaseUrl: "http://127.0.0.1:41000",
    });
  });

  it("falls back to null when the bundled endpoint is unavailable", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("network"));

    await expect(loadRuntimeConfig(mockFetch)).resolves.toBeNull();
  });
});

describe("resolveApiBaseUrlFromSearch", () => {
  it("returns the encoded apiBaseUrl query parameter when valid", () => {
    expect(
      resolveApiBaseUrlFromSearch(
        "?apiBaseUrl=http%3A%2F%2F127.0.0.1%3A47001",
      ),
    ).toBe("http://127.0.0.1:47001");
  });

  it("returns null when the query parameter is missing or invalid", () => {
    expect(resolveApiBaseUrlFromSearch("")).toBeNull();
    expect(resolveApiBaseUrlFromSearch("?apiBaseUrl=javascript%3Aalert(1)")).toBeNull();
  });
});
