import { useEffect, useMemo, useState } from "react";

import { bakeExternalParent, fetchSceneSummary, resolveApiBaseUrlFromSearch } from "../../api/client";
import type { BakeResponse, SceneSummary } from "../../api/types";
import { ResultCard } from "../../components/ResultCard";
import { SectionCard } from "../../components/SectionCard";
import { StatusBanner } from "../../components/StatusBanner";
import {
  addEventToTrack,
  addTrackToDraft,
  applyModelSelection,
  buildBakeRequest,
  centerViewportOnFrame,
  createDraftFromScene,
  createEmptySelection,
  createTimelineViewport,
  findModelByRoot,
  getAvailableSourceBones,
  inspectDraftReferences,
  reconcileDraftWithScene,
  removeEventFromTrack,
  removeTrackFromDraft,
  resizeTimelineViewport,
  toBlenderFrame,
  toBlenderViewport,
  toDisplayDraft,
  toDisplayViewport,
  updateEventInTrack,
  updateTrackInDraft,
  validateDraft,
  type BakerDraft,
  type BakerEventDraft,
  type FrameMode,
  type TimelineViewportState,
} from "./state";
import { KeyframeInspector } from "./timeline/KeyframeInspector";
import { TrackInspector } from "./timeline/TrackInspector";
import { TimelineEditor } from "./timeline/TimelineEditor";

const DEFAULT_BASE_URL = "http://127.0.0.1:37601";
const EMPTY_SCENE: SceneSummary = {
  frame_start: 1,
  frame_end: 250,
  fps: 30,
  models: [],
};

export function BakerPage() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [scene, setScene] = useState<SceneSummary | null>(null);
  const [draft, setDraft] = useState<BakerDraft>(() => createDraftFromScene(EMPTY_SCENE));
  const [viewport, setViewport] = useState<TimelineViewportState>(() => createTimelineViewport(EMPTY_SCENE));
  const [selection, setSelection] = useState(createEmptySelection());
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [result, setResult] = useState<BakeResponse | null>(null);
  const [loadingScene, setLoadingScene] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const displayDraft = useMemo(() => toDisplayDraft(draft), [draft]);
  const displayViewport = useMemo(() => toDisplayViewport(draft, viewport), [draft, viewport]);
  const selectedModel = scene ? findModelByRoot(scene, draft.root_object_name) ?? null : null;
  const referenceIssues = useMemo(() => (scene ? inspectDraftReferences(scene, draft) : null), [draft, scene]);
  const canAddTrack =
    selectedModel !== null &&
    getAvailableSourceBones(scene, draft).length > 0 &&
    draft.source_action_name.trim().length > 0;
  const realSelectedTrack = draft.tracks.find((track) => track.id === selection.track_id) ?? null;
  const selectedTrack = displayDraft.tracks.find((track) => track.id === selection.track_id) ?? null;
  const selectedEvent = selectedTrack?.events.find((event) => event.id === selection.event_id) ?? null;
  const selectedTrackBoneOptions = useMemo(
    () => (realSelectedTrack ? getAvailableSourceBones(scene, draft, realSelectedTrack.source_bone_name_j) : []),
    [draft, realSelectedTrack, scene],
  );

  useEffect(() => {
    let cancelled = false;

    async function initializeScene() {
      const resolvedBaseUrl = resolveApiBaseUrlFromSearch(window.location.search);
      if (cancelled) {
        return;
      }

      if (resolvedBaseUrl) {
        setBaseUrl(resolvedBaseUrl);
        await refreshScene(resolvedBaseUrl);
        return;
      }

      if (import.meta.env.MODE === "development") {
        setBaseUrl(DEFAULT_BASE_URL);
        await refreshScene(DEFAULT_BASE_URL);
        return;
      }

      const hasApiBaseUrl = new URLSearchParams(window.location.search).has("apiBaseUrl");
      setBaseUrl("");
      setSceneError(
        hasApiBaseUrl
          ? "Invalid apiBaseUrl query parameter. Open this page from Blender or use a full launch URL."
          : "Missing apiBaseUrl query parameter. Open this page from Blender or use a full launch URL.",
      );
    }

    void initializeScene();
    // Intentional one-shot load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setViewport((current) => ({
      ...current,
      cursor_frame: clampFrame(current.cursor_frame, draft.frame_start, draft.frame_end),
    }));
  }, [draft.frame_end, draft.frame_start]);

  useEffect(() => {
    setViewport((current) => resizeTimelineViewport(current, draft.frame_start, draft.frame_end));
  }, [draft.frame_end, draft.frame_start]);

  useEffect(() => {
    if (!selection.track_id) {
      return;
    }

    const track = draft.tracks.find((item) => item.id === selection.track_id);
    if (!track) {
      setSelection(createEmptySelection());
      return;
    }
    if (selection.event_id && !track.events.some((event) => event.id === selection.event_id)) {
      setSelection({
        track_id: track.id,
        event_id: null,
      });
    }
  }, [draft.tracks, selection]);

  function resetFeedback() {
    setValidationErrors([]);
    setSubmitError(null);
    setResult(null);
  }

  async function refreshScene(explicitBaseUrl?: string) {
    const activeBaseUrl = explicitBaseUrl ?? baseUrl;
    setLoadingScene(true);
    setSceneError(null);

    try {
      const summary = await fetchSceneSummary(activeBaseUrl);
      setScene(summary);
      setDraft((current) =>
        current.root_object_name ? reconcileDraftWithScene(summary, current) : createDraftFromScene(summary),
      );
      setViewport((current) =>
        resizeTimelineViewport(
          current.cursor_frame
            ? { ...current, cursor_frame: clampFrame(current.cursor_frame, summary.frame_start, summary.frame_end) }
            : createTimelineViewport(summary),
          summary.frame_start,
          summary.frame_end,
        ),
      );
    } catch (error) {
      setSceneError(error instanceof Error ? error.message : "Failed to fetch scene");
      setScene(null);
    } finally {
      setLoadingScene(false);
    }
  }

  function handleSourceModelChange(rootObjectName: string) {
    if (!scene) {
      return;
    }

    resetFeedback();
    setDraft((current) => applyModelSelection(scene, current, rootObjectName));
    setSelection(createEmptySelection());
    setViewport(() => resizeTimelineViewport(createTimelineViewport(scene), scene.frame_start, scene.frame_end));
  }

  function handleTrackSourceBoneChange(trackId: string, sourceBoneNameJ: string) {
    resetFeedback();
    setDraft((current) => updateTrackInDraft(current, trackId, { source_bone_name_j: sourceBoneNameJ }));
  }

  function handleAddTrack() {
    if (!canAddTrack) {
      return;
    }

    resetFeedback();
    const firstAvailableBone = getAvailableSourceBones(scene, draft)[0];
    const result = addTrackToDraft(draft, firstAvailableBone?.bone_name_j ?? "");
    setDraft(result.draft);
    setSelection({
      track_id: result.track_id,
      event_id: null,
    });
  }

  function handleRemoveTrack(trackId: string) {
    resetFeedback();
    const result = removeTrackFromDraft(draft, selection, trackId);
    setDraft(result.draft);
    setSelection(result.selection);
  }

  function handleAddKeyframe(trackId: string) {
    resetFeedback();
    const result = addEventToTrack(draft, trackId, viewport.cursor_frame);
    setDraft(result.draft);
    const track = result.draft.tracks.find((item) => item.id === trackId);
    const nextEvent = track?.events.find((event) => event.id === result.event_id) ?? null;
    if (nextEvent) {
      setViewport((current) => centerViewportOnFrame(current, draft.frame_start, draft.frame_end, nextEvent.frame));
    }
    setSelection({
      track_id: trackId,
      event_id: result.event_id,
    });
  }

  function handleEventChange(trackId: string, eventId: string, patch: Partial<BakerEventDraft>) {
    resetFeedback();
    const blenderPatch =
      patch.frame !== undefined
        ? {
            ...patch,
            frame: toBlenderFrame(draft, patch.frame),
          }
        : patch;
    const result = updateEventInTrack(draft, trackId, eventId, blenderPatch);
    setDraft(result.draft);
    setSelection({
      track_id: trackId,
      event_id: result.selected_event_id,
    });
    if (patch.frame !== undefined) {
      const selectedTrack = result.draft.tracks.find((track) => track.id === trackId);
      const selectedEvent = selectedTrack?.events.find((event) => event.id === result.selected_event_id) ?? null;
      if (selectedEvent) {
        setViewport((current) =>
          centerViewportOnFrame(current, draft.frame_start, draft.frame_end, selectedEvent.frame),
        );
      }
    }
  }

  function handleMoveKeyframe(trackId: string, eventId: string, frame: number) {
    resetFeedback();
    const result = updateEventInTrack(draft, trackId, eventId, { frame: toBlenderFrame(draft, frame) });
    setDraft(result.draft);
    setSelection({
      track_id: trackId,
      event_id: result.selected_event_id,
    });
  }

  function handleRemoveEvent(trackId: string, eventId: string) {
    resetFeedback();
    const result = removeEventFromTrack(draft, selection, trackId, eventId);
    setDraft(result.draft);
    setSelection(result.selection);
  }

  async function submitBake() {
    const errors = validateDraft(draft, scene ?? undefined);
    setValidationErrors(errors);
    setSubmitError(null);
    setResult(null);
    if (errors.length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      const bakeResult = await bakeExternalParent(baseUrl, buildBakeRequest(draft));
      setResult(bakeResult);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Bake request failed");
    } finally {
      setSubmitting(false);
    }
  }

  const connectionState = loadingScene ? "loading" : sceneError ? "error" : scene ? "live" : "idle";
  const connectionLabel =
    connectionState === "loading"
      ? "Refreshing"
      : connectionState === "error"
        ? "Disconnected"
        : connectionState === "live"
          ? "Connected"
          : "Waiting";
  const connectionMeta =
    scene && !sceneError
      ? `${scene.models.length} model${scene.models.length === 1 ? "" : "s"} · ${scene.frame_start}-${scene.frame_end}`
      : "Local Blender service";

  return (
    <main className="page-shell page-shell--nle">
      <header className="app-topbar">
        <div className="app-topbar__brand">
          <p className="app-topbar__eyebrow">MMD Ext Parent Baker</p>
          <strong className="app-topbar__title">External Parent Dope Sheet</strong>
        </div>
        <div className={`status-pill status-pill--${connectionState}`}>
          <span className="status-pill__dot" />
          <div>
            <strong>{connectionLabel}</strong>
            <span>{connectionMeta}</span>
          </div>
        </div>
        <div className="app-topbar__actions">
          <button className="button button--ghost" disabled={loadingScene} onClick={() => void refreshScene()} type="button">
            {loadingScene ? "Refreshing..." : "Refresh Scene"}
          </button>
        </div>
      </header>

      <div className="page-shell__grid page-shell__grid--timeline">
        <aside className="page-shell__column page-shell__column--sidebar">
          <SectionCard className="section-card--compact" subtitle="Local service" title="Connection">
            <label className="field">
              <span>Base URL</span>
              <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
            </label>
            {sceneError ? <StatusBanner messages={[sceneError]} title="Connection error" tone="error" /> : null}
            {!sceneError ? (
              <StatusBanner
                messages={["Enable the Blender add-on service inside Blender before refreshing this page."]}
                title="Service"
                tone="info"
              />
            ) : null}
          </SectionCard>

          <SectionCard className="section-card--compact section-card--scene" subtitle="Discovered models" title="Scene">
            <dl className="scene-metrics">
              <div>
                <dt>FPS</dt>
                <dd>{scene?.fps ?? "--"}</dd>
              </div>
              <div>
                <dt>Frame Range</dt>
                <dd>
                  {scene?.frame_start ?? "--"} - {scene?.frame_end ?? "--"}
                </dd>
              </div>
              <div>
                <dt>Models</dt>
                <dd>{scene?.models.length ?? 0}</dd>
              </div>
            </dl>

            <div className="model-list model-list--scroll">
              {(scene?.models ?? []).map((model) => (
                <article className="model-row" key={model.root_object_name}>
                  <strong>{model.root_object_name}</strong>
                  <span>{model.armature_object_name}</span>
                  <span>{model.active_action_name ?? "No active action"}</span>
                  <span>{model.bones.length} bones</span>
                </article>
              ))}
              {scene && scene.models.length === 0 ? <p className="empty-copy">No MMD root objects in this scene.</p> : null}
            </div>
          </SectionCard>
        </aside>

        <section className="page-shell__column page-shell__column--wide">
          <SectionCard
            className="section-card--timeline"
            label="Timeline"
            subtitle="External parent dope sheet"
            title="Timeline"
          >
            <div className="editor-config">
              <label className="field">
                <span>Source Model</span>
                <select
                  aria-label="Source Model"
                  value={draft.root_object_name}
                  onChange={(event) => handleSourceModelChange(event.target.value)}
                  disabled={!scene || scene.models.length === 0}
                >
                  <option value="">Select a model</option>
                  {(scene?.models ?? []).map((model) => (
                    <option key={model.root_object_name} value={model.root_object_name}>
                      {model.root_object_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Source Action</span>
                <input
                  aria-label="Source Action"
                  value={draft.source_action_name}
                  onChange={(event) => {
                    resetFeedback();
                    setDraft((current) => ({ ...current, source_action_name: event.target.value }));
                  }}
                />
              </label>

              <label className="field">
                <span>Frame Mode</span>
                <select
                  aria-label="Frame Mode"
                  value={draft.frame_mode}
                  onChange={(event) => {
                    resetFeedback();
                    setDraft((current) => ({
                      ...current,
                      frame_mode: event.target.value as FrameMode,
                    }));
                  }}
                >
                  <option value="blender">Blender Frames</option>
                  <option value="mmd">MMD Frames</option>
                </select>
              </label>

              {draft.frame_mode === "mmd" ? (
                <div className="field-grid editor-config__mmd-offset">
                  <label className="field">
                    <span>Import Timeline Frame</span>
                    <input
                      aria-label="Import Timeline Frame"
                      type="number"
                      value={draft.mmd_import_frame}
                      onChange={(event) => {
                        resetFeedback();
                        setDraft((current) => ({
                          ...current,
                          mmd_import_frame: parseIntegerInput(event.target.value),
                        }));
                      }}
                    />
                  </label>
                  <label className="field">
                    <span>Margin</span>
                    <input
                      aria-label="Margin"
                      type="number"
                      value={draft.mmd_margin}
                      onChange={(event) => {
                        resetFeedback();
                        setDraft((current) => ({
                          ...current,
                          mmd_margin: parseIntegerInput(event.target.value),
                        }));
                      }}
                    />
                  </label>
                </div>
              ) : null}

              <div className="field-grid editor-config__range">
                <label className="field">
                  <span>Frame Start</span>
                  <input
                    aria-label="Frame Start"
                    type="number"
                    value={displayDraft.frame_start}
                    onChange={(event) => {
                      resetFeedback();
                      setDraft((current) => ({
                        ...current,
                        frame_start: toBlenderFrame(current, parseIntegerInput(event.target.value)),
                      }));
                    }}
                  />
                </label>
                <label className="field">
                  <span>Frame End</span>
                  <input
                    aria-label="Frame End"
                    type="number"
                    value={displayDraft.frame_end}
                    onChange={(event) => {
                      resetFeedback();
                      setDraft((current) => ({
                        ...current,
                        frame_end: toBlenderFrame(current, parseIntegerInput(event.target.value)),
                      }));
                    }}
                  />
                </label>
              </div>

              <label className="field">
                <span>Output Action</span>
                <input
                  aria-label="Output Action"
                  value={draft.output_action_name}
                  onChange={(event) => {
                    resetFeedback();
                    setDraft((current) => ({ ...current, output_action_name: event.target.value }));
                  }}
                />
              </label>

              <div className="editor-config__actions">
                <div className="editor-config__meta">
                  <span>{draft.armature_object_name || "No armature selected"}</span>
                </div>
                <button className="button button--primary" disabled={submitting} onClick={() => void submitBake()} type="button">
                  {submitting ? "Submitting..." : "Bake External Parent"}
                </button>
              </div>
            </div>

            <TimelineEditor
              canAddTrack={canAddTrack}
              draft={displayDraft}
              onAddTrack={handleAddTrack}
              onMoveKeyframe={handleMoveKeyframe}
              onSelectionChange={setSelection}
              onViewportChange={(nextViewport) => setViewport(toBlenderViewport(draft, nextViewport))}
              referenceIssues={referenceIssues}
              scene={scene}
              selectedModel={selectedModel}
              selection={selection}
              viewport={displayViewport}
            />
          </SectionCard>
        </section>

        <aside className="page-shell__column page-shell__column--inspector">
          {selectedEvent ? (
            <KeyframeInspector
              event={selectedEvent}
              onEventChange={handleEventChange}
              onRemoveEvent={handleRemoveEvent}
              referenceIssues={referenceIssues}
              scene={scene}
              track={selectedTrack}
            />
          ) : (
            <TrackInspector
              boneOptions={selectedTrackBoneOptions}
              onAddKeyframe={handleAddKeyframe}
              onRemoveTrack={handleRemoveTrack}
              onTrackSourceBoneChange={handleTrackSourceBoneChange}
              track={selectedTrack}
            />
          )}

          {validationErrors.length > 0 ? (
            <StatusBanner messages={validationErrors} title="Validation issues" tone="error" />
          ) : null}
          {submitError ? <StatusBanner messages={[submitError]} title="Bake failed" tone="error" /> : null}
          {result ? <StatusBanner messages={["Action was created successfully."]} title="Bake completed" tone="success" /> : null}

          <SectionCard className="section-card--compact" subtitle="Latest bake response" title="Result">
            <ResultCard result={result} />
          </SectionCard>
        </aside>
      </div>
    </main>
  );
}

function clampFrame(frame: number, frameStart: number, frameEnd: number) {
  return Math.max(frameStart, Math.min(frameEnd, frame));
}

function parseIntegerInput(value: string) {
  const parsed = Number.parseInt(value || "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
