import { describe, expect, it, vi } from "vitest";

import { ApiError, fetchSceneSummary } from "./client";

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
