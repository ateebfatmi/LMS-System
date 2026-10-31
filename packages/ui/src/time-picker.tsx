"use client";

import {
  type CSSProperties,
  type FC,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

export interface TimePickerProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  stepMinutes?: number;
}

function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

interface ParsedTime {
  hours24: number;
  minutes: number;
  hours12: number;
  ampm: "AM" | "PM";
}

function parseTimeString(raw?: string): ParsedTime | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();

  // Match 24h format "09:00" or "14:30" or ISO time
  const match24 = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed);
  if (match24) {
    const h = parseInt(match24[1], 10);
    const m = parseInt(match24[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return { hours24: h, minutes: m, hours12: h12, ampm };
    }
  }

  // Match 12h format "09:00 AM" or "9:00pm"
  const match12 = /^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/i.exec(trimmed);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const ampm = match12[3].toUpperCase() as "AM" | "PM";
    if (h >= 1 && h <= 12 && m >= 0 && m <= 59) {
      let h24 = h;
      if (ampm === "PM" && h !== 12) h24 = h + 12;
      if (ampm === "AM" && h === 12) h24 = 0;
      return { hours24: h24, minutes: m, hours12: h, ampm };
    }
  }

  return null;
}

function formatTo24(hours24: number, minutes: number): string {
  return `${padZero(hours24)}:${padZero(minutes)}`;
}

function formatTo12(hours12: number, minutes: number, ampm: "AM" | "PM"): string {
  return `${padZero(hours12)}:${padZero(minutes)} ${ampm}`;
}

const HOURS_LIST = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export const TimePicker: FC<TimePickerProps> = ({
  id,
  name,
  value: controlledValue,
  defaultValue = "09:00",
  onChange,
  placeholder = "--:-- --",
  required = false,
  disabled = false,
  className = "",
  style,
  stepMinutes = 5,
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState<string>(controlledValue ?? defaultValue ?? "09:00");
  const effectiveValue = isControlled ? (controlledValue ?? "") : internalValue;

  const parsed = parseTimeString(effectiveValue) ?? {
    hours24: 9,
    minutes: 0,
    hours12: 9,
    ampm: "AM",
  };

  const [selectedH12, setSelectedH12] = useState<number>(parsed.hours12);
  const [selectedM, setSelectedM] = useState<number>(parsed.minutes);
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">(parsed.ampm);
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Sync internal state when effectiveValue changes externally
  useEffect(() => {
    const p = parseTimeString(effectiveValue);
    if (p) {
      setSelectedH12(p.hours12);
      setSelectedM(p.minutes);
      setSelectedPeriod(p.ampm);
    }
  }, [effectiveValue]);

  // Handle outside click
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  const commitTime = (h12: number, m: number, period: "AM" | "PM") => {
    let h24 = h12;
    if (period === "PM" && h12 !== 12) h24 = h12 + 12;
    if (period === "AM" && h12 === 12) h24 = 0;

    const val24 = formatTo24(h24, m);
    if (!isControlled) {
      setInternalValue(val24);
    }
    onChange?.(val24);
  };

  const handleHourSelect = (h: number) => {
    setSelectedH12(h);
    commitTime(h, selectedM, selectedPeriod);
  };

  const handleMinuteSelect = (m: number) => {
    setSelectedM(m);
    commitTime(selectedH12, m, selectedPeriod);
  };

  const handlePeriodSelect = (period: "AM" | "PM") => {
    setSelectedPeriod(period);
    commitTime(selectedH12, selectedM, period);
  };

  const handleNow = () => {
    const now = new Date();
    const h = now.getHours();
    const m = Math.floor(now.getMinutes() / stepMinutes) * stepMinutes;
    const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;

    setSelectedH12(h12);
    setSelectedM(m);
    setSelectedPeriod(period);
    commitTime(h12, m, period);
  };

  const displayString = effectiveValue
    ? formatTo12(selectedH12, selectedM, selectedPeriod)
    : placeholder;

  // Minutes options based on stepMinutes
  const minutesList: number[] = [];
  for (let i = 0; i < 60; i += stepMinutes) {
    minutesList.push(i);
  }

  return (
    <div
      ref={containerRef}
      className={`pz-timepicker-container ${className}`.trim()}
      style={{
        position: "relative",
        width: "100%",
        userSelect: "none",
        ...style,
      }}
    >
      {/* Hidden input for HTML form submission */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={effectiveValue}
          required={required}
        />
      )}

      {/* Time Picker Trigger */}
      <button
        ref={triggerRef}
        id={inputId}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`pz-timepicker-trigger ${isOpen ? "is-open" : ""}`}
        style={{
          width: "100%",
          minHeight: "48px",
          padding: "0 14px",
          border: isOpen ? "1px solid #9d831b" : "1px solid #dce2de",
          borderRadius: "12px",
          outline: "none",
          backgroundColor: "#ffffff",
          color: effectiveValue ? "#181e1b" : "#94a3b8",
          fontSize: "14px",
          fontFamily: "inherit",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          boxShadow: isOpen
            ? "0 0 0 4px rgba(250, 204, 21, 0.22)"
            : "0 1px 2px rgba(0, 0, 0, 0.02)",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          letterSpacing: "0.02em",
        }}
      >
        <span>{displayString}</span>

        {/* Crisp Clock Icon */}
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isOpen ? "#9d831b" : "#64748b"}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, transition: "stroke 0.15s" }}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>

      {/* Popover Time Selector */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="pz-timepicker-popover"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 1000,
            minWidth: "250px",
            backgroundColor: "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: "1px solid #e2e8f0",
            borderRadius: "16px",
            padding: "14px",
            boxShadow:
              "0 20px 42px -12px rgba(15, 23, 42, 0.18), 0 8px 16px -6px rgba(15, 23, 42, 0.08)",
            animation: "pzScaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Header Preview & Quick Presets */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
              paddingBottom: "10px",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 800,
                  color: "#0f172a",
                  fontFamily: "var(--font-mono, monospace)",
                  letterSpacing: "0.04em",
                }}
              >
                {formatTo12(selectedH12, selectedM, selectedPeriod)}
              </span>
            </div>

            <button
              type="button"
              onClick={handleNow}
              style={{
                background: "#fef9c3",
                border: "1px solid #fef08a",
                fontSize: "11px",
                fontWeight: 700,
                color: "#854d0e",
                cursor: "pointer",
                padding: "3px 8px",
                borderRadius: "6px",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fde047")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fef9c3")}
            >
              Current time
            </button>
          </div>

          {/* 3 Columns: Hour, Minute, Period */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "8px",
            }}
          >
            {/* Hour Column */}
            <div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: "#94a3b8",
                  letterSpacing: "0.1em",
                  textAlign: "center",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                }}
              >
                Hour
              </div>
              <div
                className="pz-time-scroll"
                style={{
                  maxHeight: "180px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                  paddingRight: "2px",
                }}
              >
                {HOURS_LIST.map((h) => {
                  const isSelected = selectedH12 === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleHourSelect(h)}
                      style={{
                        padding: "7px 0",
                        borderRadius: "8px",
                        border: isSelected ? "1px solid #fde047" : "1px solid transparent",
                        backgroundColor: isSelected ? "#fef9c3" : "transparent",
                        color: isSelected ? "#713f12" : "#334155",
                        fontWeight: isSelected ? 800 : 500,
                        fontSize: "13px",
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all 0.1s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = "#fffbeb";
                          e.currentTarget.style.color = "#854d0e";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = "transparent";
                          e.currentTarget.style.color = "#334155";
                        }
                      }}
                    >
                      {padZero(h)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Minute Column */}
            <div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: "#94a3b8",
                  letterSpacing: "0.1em",
                  textAlign: "center",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                }}
              >
                Minute
              </div>
              <div
                className="pz-time-scroll"
                style={{
                  maxHeight: "180px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                  paddingRight: "2px",
                }}
              >
                {minutesList.map((m) => {
                  const isSelected = selectedM === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMinuteSelect(m)}
                      style={{
                        padding: "7px 0",
                        borderRadius: "8px",
                        border: isSelected ? "1px solid #fde047" : "1px solid transparent",
                        backgroundColor: isSelected ? "#fef9c3" : "transparent",
                        color: isSelected ? "#713f12" : "#334155",
                        fontWeight: isSelected ? 800 : 500,
                        fontSize: "13px",
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all 0.1s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = "#fffbeb";
                          e.currentTarget.style.color = "#854d0e";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = "transparent";
                          e.currentTarget.style.color = "#334155";
                        }
                      }}
                    >
                      {padZero(m)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Period Column */}
            <div>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: "#94a3b8",
                  letterSpacing: "0.1em",
                  textAlign: "center",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                }}
              >
                Period
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                {(["AM", "PM"] as const).map((period) => {
                  const isSelected = selectedPeriod === period;
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => handlePeriodSelect(period)}
                      style={{
                        padding: "10px 0",
                        borderRadius: "9px",
                        border: isSelected ? "1px solid #0B1528" : "1px solid #e2e8f0",
                        backgroundColor: isSelected ? "#0B1528" : "#f8fafc",
                        color: isSelected ? "#FACC15" : "#475569",
                        fontWeight: 800,
                        fontSize: "13px",
                        cursor: "pointer",
                        textAlign: "center",
                        boxShadow: isSelected ? "0 2px 8px rgba(11, 21, 40, 0.15)" : "none",
                        transition: "all 0.12s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = "#f1f5f9";
                          e.currentTarget.style.color = "#0f172a";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = "#f8fafc";
                          e.currentTarget.style.color = "#475569";
                        }
                      }}
                    >
                      {period}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Done Button */}
          <div
            style={{
              marginTop: "12px",
              paddingTop: "10px",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: "#0B1528",
                border: "none",
                fontSize: "12px",
                fontWeight: 700,
                color: "#FACC15",
                cursor: "pointer",
                padding: "6px 16px",
                borderRadius: "8px",
                transition: "opacity 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
