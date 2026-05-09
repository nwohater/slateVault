"use client";

const SKIP_ONBOARDING_KEY = "sv-skip-onboarding";

export function shouldSkipOnboarding(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(SKIP_ONBOARDING_KEY) === "true";
}

export function setSkipOnboarding(skip: boolean) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SKIP_ONBOARDING_KEY, skip ? "true" : "false");
}
