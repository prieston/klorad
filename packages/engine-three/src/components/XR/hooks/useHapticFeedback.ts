import { useRef } from "react";

// Minimal structural type to match useXRInputSourceState return type
type XRInputSourceStateLike = {
  inputSource?: XRInputSource;
} | null;

interface HapticFeedbackOptions {
  intensity?: number;
  duration?: number;
}

/**
 * Hook for managing haptic feedback on XR controllers
 */
export function useHapticFeedback() {
  const lastHapticTime = useRef<{ [key: string]: number }>({});

  const triggerHaptic = (
    controller: XRInputSourceStateLike,
    type: "hover" | "select" | "teleport" = "hover",
    options: HapticFeedbackOptions = {}
  ) => {
    if (!controller?.inputSource) {
      return;
    }

    // Prevent too frequent haptic feedback
    const controllerId = controller.inputSource.handedness || "unknown";
    const now = Date.now();
    const lastTime = lastHapticTime.current[controllerId] || 0;
    const minInterval = type === "hover" ? 100 : 50; // Hover feedback less frequent

    if (now - lastTime < minInterval) {
      return;
    }

    lastHapticTime.current[controllerId] = now;

    // Different intensities for different feedback types
    const intensities: Record<string, number> = {
      hover: 0.3,
      select: 0.6,
      teleport: 0.4,
    };

    const durations: Record<string, number> = {
      hover: 50,
      select: 100,
      teleport: 80,
    };

    // Validate and clamp intensity (0-1 range)
    let intensity = options.intensity ?? intensities[type] ?? 0.5;
    intensity = Math.max(0, Math.min(1, intensity));

    // Validate duration (must be positive)
    let duration = options.duration ?? durations[type] ?? 50;
    duration = Math.max(0, duration);

    try {
      const gamepad = controller.inputSource.gamepad;
      if (!gamepad) {
        return;
      }

      // Check for WebXR hapticActuators
      if (gamepad.hapticActuators && gamepad.hapticActuators.length > 0) {
        const actuator = gamepad.hapticActuators[0];

        // Prioritize WebXR pulse() method (standard for Quest 3)
        if (typeof actuator.pulse === "function") {
          try {
            actuator.pulse(intensity, duration);
            return;
          } catch (pulseError) {
            // If pulse fails, fall through to playEffect
            if (process.env.NODE_ENV === "development") {
              console.warn("Haptic pulse() failed, trying fallback:", pulseError);
            }
          }
        }

        // Fallback to Gamepad API playEffect
        if (typeof actuator.playEffect === "function") {
          try {
            actuator.playEffect("dual-rumble", {
              startDelay: 0,
              duration,
              weakMagnitude: intensity,
              strongMagnitude: intensity,
            });
            return;
          } catch (effectError) {
            if (process.env.NODE_ENV === "development") {
              console.warn("Haptic playEffect() failed:", effectError);
            }
          }
        }
      }
    } catch (error) {
      // Haptic feedback not supported or failed
      if (process.env.NODE_ENV === "development") {
        console.warn("Haptic feedback failed:", error);
      }
    }
  };

  return { triggerHaptic };
}
