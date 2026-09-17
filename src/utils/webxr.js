/**
 * WebXR Detection and Session Helper
 *
 * Provides safe, defensive feature detection and session initiation for WebXR.
 * When hardware is absent, gracefully reports desktop simulation status without crashing.
 */

/**
 * Checks if the WebXR Device API is present in the current browser context.
 * @returns {boolean}
 */
export function isWebXRAvailable() {
  return typeof navigator !== "undefined" && Boolean(navigator.xr);
}

/**
 * Checks if the browser and connected hardware support an 'immersive-vr' session.
 * @returns {Promise<{ supported: boolean, reason?: string }>}
 */
export async function checkImmersiveVRSupport() {
  if (!isWebXRAvailable()) {
    return {
      supported: false,
      reason: "WebXR API is not supported in this browser.",
    };
  }

  try {
    const isSupported = await navigator.xr.isSessionSupported("immersive-vr");
    if (!isSupported) {
      return {
        supported: false,
        reason:
          "WebXR is present, but no immersive VR hardware/runtime is detected.",
      };
    }
    return { supported: true };
  } catch (error) {
    return {
      supported: false,
      reason: error.message || "Failed to query WebXR session support.",
    };
  }
}

/**
 * Requests an immersive VR session from navigator.xr and binds it to the Three.js WebGLRenderer.
 *
 * @param {import('three').WebGLRenderer} gl
 * @returns {Promise<{ success: boolean, session?: XRSession, message: string }>}
 */
export async function requestImmersiveVRSession(gl) {
  const check = await checkImmersiveVRSupport();
  if (!check.supported) {
    return {
      success: false,
      message:
        "Immersive VR is unavailable on this device. Desktop VR Simulation is active.",
    };
  }

  try {
    const session = await navigator.xr.requestSession("immersive-vr", {
      optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"],
    });

    if (gl && gl.xr) {
      gl.xr.enabled = true;
      await gl.xr.setSession(session);
    }

    return {
      success: true,
      session,
      message: "Immersive VR session started.",
    };
  } catch (error) {
    console.error("WebXR session request failed:", error);
    return {
      success: false,
      message: `Failed to start WebXR session: ${error.message || "Unknown error"}. Desktop VR Simulation is active.`,
    };
  }
}
