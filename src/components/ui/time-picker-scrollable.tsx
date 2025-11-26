import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface TimePickerScrollableProps {
  value: string; // formato "HH:mm" ou "HH:mm:ss"
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export const TimePickerScrollable = ({ value, onChange, disabled, className }: TimePickerScrollableProps) => {
  const [hour, setHour] = useState<number>(0);
  const [minute, setMinute] = useState<number>(0);
  const [isValid, setIsValid] = useState(false);
  
  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  // Parse initial value
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        setHour(h);
        setMinute(m);
        setIsValid(true);
      }
    }
  }, [value]);

  // Update parent when hour or minute changes
  useEffect(() => {
    const formattedTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
    if (formattedTime !== value) {
      onChange(formattedTime);
      setIsValid(true);
    }
  }, [hour, minute]);

  const scrollToSelected = (ref: HTMLDivElement, index: number) => {
    const itemHeight = 48; // h-12 = 48px
    ref.scrollTop = index * itemHeight - itemHeight * 2; // Center the selected item
  };

  const handleHourClick = (h: number) => {
    setHour(h);
    if (hourRef.current) {
      scrollToSelected(hourRef.current, h);
    }
  };

  const handleMinuteClick = (m: number) => {
    setMinute(m);
    if (minuteRef.current) {
      scrollToSelected(minuteRef.current, m);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-2 gap-4">
        {/* Hour Selector */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground text-center">Horas</div>
          <div
            ref={hourRef}
            className="relative h-48 overflow-y-auto border border-input rounded-md bg-background scrollbar-thin scrollbar-thumb-primary scrollbar-track-muted"
          >
            <div className="py-2">
              {hours.map((h) => (
                <button
                  key={h}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleHourClick(h)}
                  className={cn(
                    "w-full h-12 flex items-center justify-center text-base transition-all duration-300",
                    "hover:bg-accent hover:text-accent-foreground",
                    hour === h
                      ? "bg-primary text-primary-foreground font-semibold scale-105"
                      : "text-foreground",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {String(h).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Minute Selector */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground text-center">Minutos</div>
          <div
            ref={minuteRef}
            className="relative h-48 overflow-y-auto border border-input rounded-md bg-background scrollbar-thin scrollbar-thumb-primary scrollbar-track-muted"
          >
            <div className="py-2">
              {minutes.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleMinuteClick(m)}
                  className={cn(
                    "w-full h-12 flex items-center justify-center text-base transition-all duration-300",
                    "hover:bg-accent hover:text-accent-foreground",
                    minute === m
                      ? "bg-primary text-primary-foreground font-semibold scale-105"
                      : "text-foreground",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {String(m).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Visual */}
      {isValid && (
        <div className="flex items-center gap-2 text-sm text-success animate-fade-in">
          <Check className="h-4 w-4" />
          <span className="font-medium">
            Horário selecionado: {String(hour).padStart(2, "0")}:{String(minute).padStart(2, "0")}
          </span>
        </div>
      )}
    </div>
  );
};
