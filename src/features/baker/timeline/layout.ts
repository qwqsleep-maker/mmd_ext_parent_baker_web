export interface TimelineTick {
  frame: number;
  kind: "major" | "minor";
  label: string | null;
}

const MAJOR_TICK_TARGET_SPACING_PX = 96;
const MAJOR_TICK_MIN_SPACING_PX = 72;
const MINOR_TICK_MIN_SPACING_PX = 12;

export function frameToOffset(frame: number, frameStart: number, pixelsPerFrame: number) {
  return (frame - frameStart) * pixelsPerFrame;
}

export function getDetailPixelsPerFrame(visibleFrameCount: number, availableWidth: number) {
  const frameCount = Math.max(1, visibleFrameCount);
  const width = Math.max(1, Math.floor(availableWidth));
  return width / frameCount;
}

export function frameToOverviewOffset(frame: number, frameStart: number, frameEnd: number, overviewWidth: number) {
  const intervalCount = getFrameIntervalCount(frameStart, frameEnd);
  const frameIndex = Math.max(0, Math.min(intervalCount, frame - frameStart));
  const width = Math.max(0, overviewWidth);

  if (intervalCount === 0) {
    return 0;
  }

  return (frameIndex / intervalCount) * width;
}

export function overviewOffsetToFrame(offset: number, frameStart: number, frameEnd: number, overviewWidth: number) {
  const intervalCount = getFrameIntervalCount(frameStart, frameEnd);
  const width = Math.max(1, overviewWidth);
  const ratio = Math.max(0, Math.min(1, offset / width));

  if (intervalCount === 0) {
    return frameStart;
  }

  const frameIndex = Math.round(ratio * intervalCount);
  return Math.max(frameStart, Math.min(frameEnd, frameStart + frameIndex));
}

export function getOverviewPixelsPerFrame(frameStart: number, frameEnd: number, overviewWidth: number) {
  const intervalCount = getFrameIntervalCount(frameStart, frameEnd);
  const width = Math.max(1, overviewWidth);

  if (intervalCount === 0) {
    return width;
  }

  return width / intervalCount;
}

export function getOverviewWindowPercentages(
  visibleFrameStart: number,
  visibleFrameEnd: number,
  frameStart: number,
  frameEnd: number,
) {
  const intervalCount = getFrameIntervalCount(frameStart, frameEnd);

  if (intervalCount === 0) {
    return { left: 0, width: 100 };
  }

  const left = ((visibleFrameStart - frameStart) / intervalCount) * 100;
  const width = ((visibleFrameEnd - visibleFrameStart) / intervalCount) * 100;

  return {
    left: Math.max(0, Math.min(100, left)),
    width: Math.max(0, Math.min(100 - Math.max(0, Math.min(100, left)), width)),
  };
}

export function calculateFitPixelsPerFrame(frameStart: number, frameEnd: number, availableWidth: number) {
  const frameCount = Math.max(1, frameEnd - frameStart + 1);
  const usableWidth = Math.max(1, Math.floor(availableWidth));
  const nextPixels = Math.floor(usableWidth / frameCount);
  return Math.max(2, Math.min(32, nextPixels));
}

export function getScrollLeftForFrame(focusOffset: number, containerWidth: number, scrollWidth: number) {
  const nextScrollLeft = Math.round(focusOffset - containerWidth / 2);
  const maxScrollLeft = Math.max(0, scrollWidth - containerWidth);
  return Math.max(0, Math.min(maxScrollLeft, nextScrollLeft));
}

export function offsetToFrame(
  offset: number,
  frameStart: number,
  frameEnd: number,
  pixelsPerFrame: number,
) {
  const roundedFrame = frameStart + Math.round(offset / pixelsPerFrame);
  return Math.max(frameStart, Math.min(frameEnd, roundedFrame));
}

export function buildTimelineTicks(frameStart: number, frameEnd: number, pixelsPerFrame: number) {
  const majorStep = chooseMajorTickStep(pixelsPerFrame);
  const majorTicks = buildTickFrames(frameStart, frameEnd, majorStep);
  const minorStep = chooseMinorTickStep(majorStep, pixelsPerFrame);
  const majorFrameSet = new Set(majorTicks);
  const ticks: TimelineTick[] = majorTicks.map((frame) => ({
    frame,
    kind: "major",
    label: String(frame),
  }));

  if (minorStep) {
    for (const frame of buildTickFrames(frameStart, frameEnd, minorStep)) {
      if (majorFrameSet.has(frame)) {
        continue;
      }
      ticks.push({
        frame,
        kind: "minor",
        label: null,
      });
    }
  }

  return ticks.sort((left, right) => left.frame - right.frame || compareTickKind(left.kind, right.kind));
}

function chooseMajorTickStep(pixelsPerFrame: number) {
  const safePixelsPerFrame = Math.max(0.0001, pixelsPerFrame);
  const minimumFramesPerMajorTick = MAJOR_TICK_MIN_SPACING_PX / safePixelsPerFrame;
  const targetFramesPerMajorTick = MAJOR_TICK_TARGET_SPACING_PX / safePixelsPerFrame;
  const lowerCandidate = getNiceNumberAtMost(targetFramesPerMajorTick);
  const upperCandidate = getNiceNumberAtLeast(targetFramesPerMajorTick);
  const candidates = Array.from(
    new Set([lowerCandidate, upperCandidate].filter((candidate) => candidate >= 1)),
  );

  let bestStep = Math.max(1, upperCandidate);
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const spacing = candidate * safePixelsPerFrame;
    const spacingPenalty = spacing < MAJOR_TICK_MIN_SPACING_PX ? 10_000 : 0;
    const score = spacingPenalty + Math.abs(spacing - MAJOR_TICK_TARGET_SPACING_PX);

    if (score < bestScore) {
      bestStep = candidate;
      bestScore = score;
    }
  }

  if (bestStep * safePixelsPerFrame < MAJOR_TICK_MIN_SPACING_PX) {
    return getNiceNumberAtLeast(minimumFramesPerMajorTick);
  }

  return Math.max(1, bestStep);
}

function chooseMinorTickStep(majorStep: number, pixelsPerFrame: number) {
  if (majorStep <= 1) {
    return null;
  }

  const minorStep = Math.max(1, Math.round(majorStep / 5));
  const minorSpacing = minorStep * Math.max(0.0001, pixelsPerFrame);

  if (minorStep >= majorStep || minorSpacing < MINOR_TICK_MIN_SPACING_PX) {
    return null;
  }

  return minorStep;
}

function buildTickFrames(frameStart: number, frameEnd: number, step: number) {
  const frames: number[] = [];

  for (let frame = frameStart; frame <= frameEnd; frame += step) {
    frames.push(frame);
  }

  if (frames.length === 0 || frames[frames.length - 1] !== frameEnd) {
    frames.push(frameEnd);
  }

  return frames;
}

function compareTickKind(left: TimelineTick["kind"], right: TimelineTick["kind"]) {
  if (left === right) {
    return 0;
  }

  return left === "minor" ? -1 : 1;
}

function getNiceNumberAtMost(value: number) {
  return getNiceNumber(value, "floor");
}

function getNiceNumberAtLeast(value: number) {
  return getNiceNumber(value, "ceil");
}

function getNiceNumber(value: number, direction: "floor" | "ceil") {
  const safeValue = Math.max(1, value);
  const exponent = Math.floor(Math.log10(safeValue));
  const scale = 10 ** exponent;
  const normalized = safeValue / scale;
  const factors = [1, 2, 5, 10];

  if (direction === "ceil") {
    for (const factor of factors) {
      if (normalized <= factor) {
        return Math.max(1, Math.round(factor * scale));
      }
    }
    return Math.max(1, Math.round(10 * scale));
  }

  for (let index = factors.length - 1; index >= 0; index -= 1) {
    if (normalized >= factors[index]) {
      return Math.max(1, Math.round(factors[index] * scale));
    }
  }

  return Math.max(1, Math.round(scale / 10));
}

function getFrameIntervalCount(frameStart: number, frameEnd: number) {
  return Math.max(0, frameEnd - frameStart);
}
