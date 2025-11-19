type HapticType = "light" | "medium" | "heavy" | "success" | "error" | "warning";

export const triggerHaptic = (type: HapticType = "light") => {
  // Check if the device supports haptic feedback
  if (!navigator.vibrate) {
    return;
  }

  // Different vibration patterns for different feedback types
  const patterns: Record<HapticType, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 30,
    success: [10, 50, 10],
    error: [20, 50, 20, 50, 20],
    warning: [15, 30, 15],
  };

  try {
    navigator.vibrate(patterns[type]);
  } catch (error) {
    // Silently fail if vibration is not supported
    console.debug("Haptic feedback not supported:", error);
  }
};

export const isHapticSupported = (): boolean => {
  return "vibrate" in navigator;
};
