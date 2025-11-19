import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { toast } from "sonner";
import { triggerHaptic } from "@/utils/haptic";
import { playSound } from "@/utils/sounds";

interface FeedbackContextType {
  success: (message: string, options?: FeedbackOptions) => void;
  error: (message: string, options?: FeedbackOptions) => void;
  info: (message: string, options?: FeedbackOptions) => void;
  warning: (message: string, options?: FeedbackOptions) => void;
  loading: (message: string) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  hapticEnabled: boolean;
  setHapticEnabled: (enabled: boolean) => void;
}

interface FeedbackOptions {
  haptic?: boolean;
  sound?: boolean;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export const FeedbackProvider = ({ children }: { children: ReactNode }) => {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem("feedback_sound_enabled");
    return saved ? JSON.parse(saved) : true;
  });

  const [hapticEnabled, setHapticEnabled] = useState(() => {
    const saved = localStorage.getItem("feedback_haptic_enabled");
    return saved ? JSON.parse(saved) : true;
  });

  const updateSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabled(enabled);
    localStorage.setItem("feedback_sound_enabled", JSON.stringify(enabled));
  }, []);

  const updateHapticEnabled = useCallback((enabled: boolean) => {
    setHapticEnabled(enabled);
    localStorage.setItem("feedback_haptic_enabled", JSON.stringify(enabled));
  }, []);

  const success = useCallback(
    (message: string, options: FeedbackOptions = {}) => {
      const { haptic = true, sound = true, duration = 3000, action } = options;

      if (haptic && hapticEnabled) {
        triggerHaptic("success");
      }
      if (sound && soundEnabled) {
        playSound("success");
      }

      toast.success(message, {
        duration,
        action: action
          ? {
              label: action.label,
              onClick: action.onClick,
            }
          : undefined,
      });
    },
    [soundEnabled, hapticEnabled]
  );

  const error = useCallback(
    (message: string, options: FeedbackOptions = {}) => {
      const { haptic = true, sound = true, duration = 4000, action } = options;

      if (haptic && hapticEnabled) {
        triggerHaptic("error");
      }
      if (sound && soundEnabled) {
        playSound("error");
      }

      toast.error(message, {
        duration,
        action: action
          ? {
              label: action.label,
              onClick: action.onClick,
            }
          : undefined,
      });
    },
    [soundEnabled, hapticEnabled]
  );

  const info = useCallback(
    (message: string, options: FeedbackOptions = {}) => {
      const { haptic = true, sound = true, duration = 3000, action } = options;

      if (haptic && hapticEnabled) {
        triggerHaptic("light");
      }
      if (sound && soundEnabled) {
        playSound("info");
      }

      toast.info(message, {
        duration,
        action: action
          ? {
              label: action.label,
              onClick: action.onClick,
            }
          : undefined,
      });
    },
    [soundEnabled, hapticEnabled]
  );

  const warning = useCallback(
    (message: string, options: FeedbackOptions = {}) => {
      const { haptic = true, sound = true, duration = 4000, action } = options;

      if (haptic && hapticEnabled) {
        triggerHaptic("warning");
      }
      if (sound && soundEnabled) {
        playSound("warning");
      }

      toast.warning(message, {
        duration,
        action: action
          ? {
              label: action.label,
              onClick: action.onClick,
            }
          : undefined,
      });
    },
    [soundEnabled, hapticEnabled]
  );

  const loading = useCallback((message: string) => {
    toast.loading(message);
  }, []);

  return (
    <FeedbackContext.Provider
      value={{
        success,
        error,
        info,
        warning,
        loading,
        soundEnabled,
        setSoundEnabled: updateSoundEnabled,
        hapticEnabled,
        setHapticEnabled: updateHapticEnabled,
      }}
    >
      {children}
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (context === undefined) {
    throw new Error("useFeedback must be used within a FeedbackProvider");
  }
  return context;
};
