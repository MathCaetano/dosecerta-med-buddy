import * as React from "react";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
  disabled?: boolean;
  className?: string;
}

const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, "0"));

export function TimePicker({ value, onChange, disabled, className }: TimePickerProps) {
  const [hour, minute] = value ? value.split(":") : ["08", "00"];
  const hourRef = React.useRef<HTMLDivElement>(null);
  const minuteRef = React.useRef<HTMLDivElement>(null);

  const scrollToSelected = React.useCallback(() => {
    if (hourRef.current) {
      const hourIndex = hours.indexOf(hour);
      if (hourIndex >= 0) {
        const itemHeight = 48;
        hourRef.current.scrollTop = hourIndex * itemHeight;
      }
    }
    if (minuteRef.current) {
      const minuteIndex = minutes.indexOf(minute);
      if (minuteIndex >= 0) {
        const itemHeight = 48;
        minuteRef.current.scrollTop = minuteIndex * itemHeight;
      }
    }
  }, [hour, minute]);

  React.useEffect(() => {
    scrollToSelected();
  }, [scrollToSelected]);

  const handleHourSelect = (h: string) => {
    if (!disabled) {
      onChange(`${h}:${minute}`);
    }
  };

  const handleMinuteSelect = (m: string) => {
    if (!disabled) {
      onChange(`${hour}:${m}`);
    }
  };

  return (
    <div className={cn("flex items-center justify-center gap-2 p-4", className)}>
      {/* Hour Wheel */}
      <div className="relative">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-primary/10 rounded-lg pointer-events-none z-0" />
        <div
          ref={hourRef}
          className={cn(
            "relative z-10 h-[144px] overflow-y-auto scroll-smooth snap-y snap-mandatory hide-scrollbar",
            disabled && "opacity-50 pointer-events-none"
          )}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <div className="h-12" /> {/* Spacer top */}
          {hours.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => handleHourSelect(h)}
              className={cn(
                "w-16 h-12 flex items-center justify-center text-2xl font-semibold snap-center transition-all",
                h === hour
                  ? "text-primary scale-110"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {h}
            </button>
          ))}
          <div className="h-12" /> {/* Spacer bottom */}
        </div>
      </div>

      <span className="text-3xl font-bold text-foreground">:</span>

      {/* Minute Wheel */}
      <div className="relative">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-primary/10 rounded-lg pointer-events-none z-0" />
        <div
          ref={minuteRef}
          className={cn(
            "relative z-10 h-[144px] overflow-y-auto scroll-smooth snap-y snap-mandatory hide-scrollbar",
            disabled && "opacity-50 pointer-events-none"
          )}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <div className="h-12" /> {/* Spacer top */}
          {minutes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleMinuteSelect(m)}
              className={cn(
                "w-16 h-12 flex items-center justify-center text-2xl font-semibold snap-center transition-all",
                m === minute
                  ? "text-primary scale-110"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m}
            </button>
          ))}
          <div className="h-12" /> {/* Spacer bottom */}
        </div>
      </div>
    </div>
  );
}

// Helper to detect period from time
export function detectPeriodFromTime(time: string): string {
  if (!time) return "manha";
  
  const [hourStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  
  if (hour >= 5 && hour < 12) {
    return "manha";
  } else if (hour >= 12 && hour < 18) {
    return "tarde";
  } else {
    return "noite"; // 18-04:59
  }
}

export function getPeriodLabel(period: string): string {
  const labels: Record<string, string> = {
    manha: "Manhã",
    tarde: "Tarde",
    noite: "Noite",
  };
  return labels[period] || period;
}
