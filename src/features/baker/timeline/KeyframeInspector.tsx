import type { SceneSummary } from "../../../api/types";
import { SectionCard } from "../../../components/SectionCard";
import type { BakerEventDraft, BakerTrackDraft, DraftReferenceIssues } from "../state";

interface KeyframeInspectorProps {
  scene: SceneSummary | null;
  track: BakerTrackDraft | null;
  event: BakerEventDraft | null;
  referenceIssues: DraftReferenceIssues | null;
  onEventChange: (trackId: string, eventId: string, patch: Partial<BakerEventDraft>) => void;
  onRemoveEvent: (trackId: string, eventId: string) => void;
}

export function KeyframeInspector({
  scene,
  track,
  event,
  referenceIssues,
  onEventChange,
  onRemoveEvent,
}: KeyframeInspectorProps) {
  if (!track || !event) {
    return (
      <SectionCard className="section-card--compact" label="Keyframe Inspector" subtitle="No selection" title="Inspector">
        <p className="empty-copy">Select a keyframe on the timeline to edit its frame, target, and enabled state.</p>
      </SectionCard>
    );
  }

  const targetModel = scene?.models.find((model) => model.root_object_name === event.target_root_object_name) ?? null;
  const targetBones = targetModel?.bones ?? [];
  const invalidTargetRoot = referenceIssues?.invalid_target_root_event_ids.includes(event.id) ?? false;
  const invalidTargetBone = referenceIssues?.invalid_target_bone_event_ids.includes(event.id) ?? false;

  return (
    <SectionCard
      className="section-card--compact"
      label="Keyframe Inspector"
      subtitle={`${track.source_bone_name_j || "Unassigned bone"} @ ${event.frame}`}
      title="Inspector"
    >
      <label className="field">
        <span>Frame</span>
        <input
          aria-label="Frame"
          type="number"
          value={event.frame}
          onChange={(nextEvent) =>
            onEventChange(track.id, event.id, {
              frame: Number.parseInt(nextEvent.target.value || "0", 10),
            })
          }
        />
      </label>

      <label className="checkbox checkbox--wide">
        <input
          aria-label="Enabled"
          checked={event.enabled}
          type="checkbox"
          onChange={(nextEvent) =>
            onEventChange(track.id, event.id, {
              enabled: nextEvent.target.checked,
              target_root_object_name: nextEvent.target.checked ? event.target_root_object_name : null,
              target_bone_name_j: nextEvent.target.checked ? event.target_bone_name_j : null,
            })
          }
        />
        <span>{event.enabled ? "Enabled" : "Disabled"}</span>
      </label>

      {event.enabled ? (
        <>
          <label className="field">
            <span>Target Root</span>
            <select
              aria-invalid={invalidTargetRoot}
              value={event.target_root_object_name ?? ""}
              onChange={(nextEvent) => {
                const nextModel = scene?.models.find((model) => model.root_object_name === nextEvent.target.value) ?? null;
                onEventChange(track.id, event.id, {
                  target_root_object_name: nextEvent.target.value || null,
                  target_bone_name_j: nextModel?.bones[0]?.bone_name_j ?? null,
                });
              }}
            >
              <option value="">Select target model</option>
              {(scene?.models ?? []).map((model) => (
                <option key={model.root_object_name} value={model.root_object_name}>
                  {model.root_object_name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Target Bone</span>
            <select
              aria-invalid={invalidTargetBone}
              value={event.target_bone_name_j ?? ""}
              onChange={(nextEvent) =>
                onEventChange(track.id, event.id, {
                  target_bone_name_j: nextEvent.target.value || null,
                })
              }
            >
              <option value="">Select target bone</option>
              {targetBones.map((bone) => (
                <option key={bone.bone_name_j} value={bone.bone_name_j}>
                  {bone.bone_name_j} ({bone.bone_name})
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <p className="empty-copy">Disabled keyframes do not require a target root or target bone.</p>
      )}

      <button className="button button--ghost" onClick={() => onRemoveEvent(track.id, event.id)} type="button">
        Remove Keyframe
      </button>
    </SectionCard>
  );
}
