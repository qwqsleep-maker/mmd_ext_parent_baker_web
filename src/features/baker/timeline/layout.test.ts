import { describe, expect, it } from "vitest";

import {
  buildTimelineTicks,
  calculateFitPixelsPerFrame,
  frameToOffset,
  frameToOverviewOffset,
  getDetailPixelsPerFrame,
  getOverviewWindowPercentages,
  getScrollLeftForFrame,
  offsetToFrame,
  overviewOffsetToFrame,
} from "./layout";

describe("timeline layout helpers", () => {
  it("maps frames to pixel offsets from the scene start", () => {
    expect(frameToOffset(1, 1, 16)).toBe(0);
    expect(frameToOffset(12, 1, 16)).toBe(176);
  });

  it("derives detail pixels per frame from the current visible range and available width", () => {
    expect(getDetailPixelsPerFrame(24, 960)).toBe(40);
    expect(getDetailPixelsPerFrame(120, 960)).toBe(8);
    expect(getDetailPixelsPerFrame(250, 960)).toBeCloseTo(3.84, 2);
  });

  it("maps overview frames using the same interval-based coordinate system as the detail ruler", () => {
    expect(frameToOverviewOffset(1, 1, 250, 100)).toBe(0);
    expect(frameToOverviewOffset(250, 1, 250, 100)).toBe(100);
    expect(frameToOverviewOffset(125, 1, 250, 100)).toBeCloseTo(49.8, 1);
  });

  it("maps overview offsets back to the same discrete frame positions", () => {
    expect(overviewOffsetToFrame(0, 1, 250, 100)).toBe(1);
    expect(overviewOffsetToFrame(100, 1, 250, 100)).toBe(250);
    expect(overviewOffsetToFrame(49.8, 1, 250, 100)).toBe(125);
  });

  it("derives overview window edges directly from the visible frame bounds", () => {
    const firstWindow = getOverviewWindowPercentages(1, 73, 1, 250);
    const shiftedWindow = getOverviewWindowPercentages(35, 107, 1, 250);

    expect(firstWindow.left).toBe(0);
    expect(firstWindow.width).toBeCloseTo(28.9156626506, 6);
    expect(shiftedWindow.left).toBeCloseTo(13.6546184738, 6);
    expect(shiftedWindow.width).toBeCloseTo(28.9156626506, 6);
  });

  it("rounds pointer offsets back to scene frames and clamps to range", () => {
    expect(offsetToFrame(0, 1, 180, 16)).toBe(1);
    expect(offsetToFrame(183, 1, 180, 16)).toBe(12);
    expect(offsetToFrame(-40, 1, 180, 16)).toBe(1);
    expect(offsetToFrame(99999, 1, 180, 16)).toBe(180);
  });

  it("builds layered major and minor ticks for small visible ranges", () => {
    const ticks = buildTimelineTicks(1, 24, 10);

    expect(ticks.some((tick) => tick.kind === "major" && tick.frame === 1 && tick.label === "1")).toBe(true);
    expect(ticks.some((tick) => tick.kind === "major" && tick.frame === 11 && tick.label === "11")).toBe(true);
    expect(ticks.some((tick) => tick.kind === "minor" && tick.frame === 3 && tick.label === null)).toBe(true);
  });

  it("uses nice-number major steps and suppresses dense minor ticks for huge spans", () => {
    const ticks = buildTimelineTicks(1, 4351, 0.055);
    const majorFrames = ticks.filter((tick) => tick.kind === "major").map((tick) => tick.frame);
    const minorTicks = ticks.filter((tick) => tick.kind === "minor");

    expect(majorFrames).toEqual([1, 2001, 4001, 4351]);
    expect(minorTicks.every((tick) => tick.label === null)).toBe(true);
    expect(minorTicks.length).toBeGreaterThan(0);
  });

  it("drops minor ticks when there is no meaningful subdivision left", () => {
    const ticks = buildTimelineTicks(1, 24, 120);

    expect(ticks.some((tick) => tick.kind === "major")).toBe(true);
    expect(ticks.some((tick) => tick.kind === "minor")).toBe(false);
  });

  it("calculates fit zoom based on available width and clamps to the supported range", () => {
    expect(calculateFitPixelsPerFrame(1, 180, 900)).toBe(5);
    expect(calculateFitPixelsPerFrame(1, 180, 120)).toBe(2);
    expect(calculateFitPixelsPerFrame(1, 10, 800)).toBe(32);
  });

  it("keeps the focused frame within the visible horizontal range", () => {
    expect(getScrollLeftForFrame(0, 320, 1200)).toBe(0);
    expect(getScrollLeftForFrame(640, 320, 1200)).toBe(480);
    expect(getScrollLeftForFrame(1180, 320, 1200)).toBe(880);
  });
});
