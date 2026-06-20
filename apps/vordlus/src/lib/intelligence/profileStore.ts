import { SUPPORTED_PROFILES, type UserProfile } from "./profiles";

const PROFILE_STORAGE_KEY = "vordlus.profile.v1";

export function loadUserProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
  return SUPPORTED_PROFILES.includes(stored as UserProfile) ? (stored as UserProfile) : null;
}

export function saveUserProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROFILE_STORAGE_KEY, profile);
}
