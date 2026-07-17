"use client";

import { InstallPrompt as DSInstallPrompt } from "@klorad/design-system";

/** Campus-scoped localStorage key so a Mobility dismiss doesn't hide
 *  the Campus prompt and vice versa. Value = ISO timestamp of the
 *  last dismiss; DS default TTL is 14 days. */
const DISMISS_KEY = "klorad-campus-install-dismissed-at";

/**
 * Campus wrapper around the DS `InstallPrompt`. Fixed Campus copy
 * ("Install this campus") + Campus dismiss key. Behaviour is
 * identical to the pre-extraction component — the DS primitive owns
 * the `beforeinstallprompt` handling + suppression window.
 */
export function InstallPrompt() {
  return (
    <DSInstallPrompt
      storageKey={DISMISS_KEY}
      title="Install this campus"
      subtitle="Add to your home screen — opens like a native app."
    />
  );
}
