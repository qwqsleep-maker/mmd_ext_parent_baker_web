export interface BoneInfo {
  bone_name: string;
  bone_name_j: string;
  bone_id: number;
}

export interface ModelInfo {
  root_object_name: string;
  armature_object_name: string;
  active_action_name: string | null;
  bones: BoneInfo[];
}

export interface SceneSummary {
  frame_start: number;
  frame_end: number;
  fps: number;
  models: ModelInfo[];
}

export interface ExternalParentEvent {
  frame: number;
  enabled: boolean;
  target_root_object_name: string | null;
  target_bone_name_j: string | null;
}

export interface ExternalParentTrack {
  source_bone_name_j: string;
  events: ExternalParentEvent[];
}

export interface ExternalParentBakeRequest {
  root_object_name: string;
  armature_object_name: string;
  source_action_name: string;
  frame_start: number;
  frame_end: number;
  output_action_name: string;
  tracks: ExternalParentTrack[];
}

export interface BakeResponse {
  root_object_name: string;
  armature_object_name: string;
  output_armature_object_name: string;
  output_mode: string;
  source_action_name: string;
  output_action_name: string;
  frame_start: number;
  frame_end: number;
  frame_count: number;
  baked_bone_count: number;
  track_count: number;
}
