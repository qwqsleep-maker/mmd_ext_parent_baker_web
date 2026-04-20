// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResultCard } from "./ResultCard";

describe("ResultCard", () => {
  it("shows original armature output metadata when provided", () => {
    render(
      <ResultCard
        result={{
          root_object_name: "MikuRoot",
          armature_object_name: "MikuArmature",
          output_armature_object_name: "MikuArmature",
          output_mode: "original_armature_visual",
          source_action_name: "walk_bone",
          output_action_name: "walk_bone__extparent_baked",
          frame_start: 1,
          frame_end: 180,
          frame_count: 180,
          baked_bone_count: 2,
          track_count: 1,
        }}
      />,
    );

    expect(screen.getByText("Output Armature")).not.toBeNull();
    expect(screen.getAllByText("MikuArmature").length).toBe(2);
    expect(screen.getByText("Output Mode")).not.toBeNull();
    expect(screen.getByText("original_armature_visual")).not.toBeNull();
  });
});
