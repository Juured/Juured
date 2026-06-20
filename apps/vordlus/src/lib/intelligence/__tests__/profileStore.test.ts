import { beforeEach, describe, expect, it } from "vitest";
import {
  loadUserProfile,
  saveUserProfile,
} from "@/lib/intelligence/profileStore";

describe("profile storage", () => {
  beforeEach(() => localStorage.clear());

  it("persists and loads a supported profile", () => {
    saveUserProfile("investor");
    expect(loadUserProfile()).toBe("investor");
  });

  it("ignores unsupported stored values", () => {
    localStorage.setItem("vordlus.profile.v1", "broker");
    expect(loadUserProfile()).toBeNull();
  });
});
