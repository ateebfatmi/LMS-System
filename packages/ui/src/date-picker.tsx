"use client";

import {
  type CSSProperties,
  type FC,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";

export interface DatePickerProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  style?: CSSProperties;
  displayFormat?: "dd/mm/yyyy" | "yyyy-mm-dd" | "friendly";
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEK_DAYS = ["S", "M", "T", "W", "T", "F", "S"];

function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

function parseISODate(isoString?: string): { year: number; month: number; day: number } | null {
  if (!isoString || typeof isoString !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoString.trim());
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // 0-indexed
  const day = parseInt(match[3], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return { year, month, day };
}

function formatToISO(year: number, month: number, day: number): string {
  return `${year}-${padZero(month + 1)}-${padZero(day)}`;
}

function formatDisplayDate(
  isoString: string,
  format: "dd/mm/yyyy" | "yyyy-mm-dd" | "friendly"
): string {
  const parsed = parseISODate(isoString);
  if (!parsed) return "";
  const { year, month, day } = parsed;

  if (format === "yyyy-mm-dd") {
    return `${year}-${padZero(month + 1)}-${padZero(day)}`;
  }

  if (format === "friendly") {
    const monthShort = MONTH_NAMES[month].slice(0, 3);
    return `${day} ${monthShort} ${year}`;
  }

  // Default: dd/mm/yyyy
  return `${padZero(day)}/${padZero(month + 1)}/${year}`;
}

export const DatePicker: FC<DatePickerProps> = ({
  id,
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  placeholder = "dd/mm/yyyy",
  required = false,
  disabled = false,
  min,
  max,
  className = "",
  style,
  displayFormat = "dd/mm/yyyy",
}) => {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState<string>(
    controlledValue ?? defaultValue ?? ""
  );

  const selectedISO = isControlled ? controlledValue ?? "" : internalValue;
  const parsedSelected = parseISODate(selectedISO);

  // Today reference
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();
  const todayISO = formatToISO(todayYear, todayMonth, todayDay);

  // View state (which month/year is currently visible in calendar)
  const [viewYear, setViewYear] = useState<number>(
    parsedSelected ? parsedSelected.year : todayYear
  );
  const [viewMonth, setViewMonth] = useState<number>(
    parsedSelected ? parsedSelected.month : todayMonth
  );

  const [isOpen, setIsOpen] = useState(false);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal state if controlled value changes
  useEffect(() => {
    if (isControlled && controlledValue !== undefined) {
      setInternalValue(controlledValue);
      const parsed = parseISODate(controlledValue);
      if (parsed) {
        setViewYear(parsed.year);
        setViewMonth(parsed.month);
      }
    }
  }, [controlledValue, isControlled]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: globalThis.MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsYearDropdownOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        setIsYearDropdownOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectDate = (year: number, month: number, day: number) => {
    const iso = formatToISO(year, month, day);
    if (!isControlled) {
      setInternalValue(iso);
    }
    onChange?.(iso);
    setIsOpen(false);
    setIsYearDropdownOpen(false);
  };

  const handleClear = (e?: ReactMouseEvent) => {
    e?.stopPropagation();
    if (!isControlled) {
      setInternalValue("");
    }
    onChange?.("");
    setIsOpen(false);
  };

  const handleToday = () => {
    handleSelectDate(todayYear, todayMonth, todayDay);
  };

  const handlePrevMonth = (e: ReactMouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = (e: ReactMouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Calendar calculations
  // Days in current view month
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // First day of week for current month (0 = Sunday, 1 = Monday, ...)
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  // Days in previous month for padding
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // Generate Year choices: -5 years to +5 years around today
  const yearOptions: number[] = [];
  const startYear = Math.min(todayYear - 4, viewYear - 2);
  const endYear = Math.max(todayYear + 6, viewYear + 3);
  for (let y = startYear; y <= endYear; y++) {
    yearOptions.push(y);
  }

  const displayText = selectedISO ? formatDisplayDate(selectedISO, displayFormat) : "";

  return (
    <div
      ref={containerRef}
      className={`pz-datepicker-wrapper ${className}`}
      style={{
        position: "relative",
        display: "inline-block",
        width: "100%",
        fontFamily: "var(--font-prepzii-body, var(--font-body, system-ui, sans-serif))",
        ...style,
      }}
    >
      {/* Hidden input for HTML form submissions */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={selectedISO}
          required={required && !selectedISO}
          id={id ? `${id}-hidden` : undefined}
        />
      )}

      {/* Trigger Button / Input Display */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen && parsedSelected) {
              setViewYear(parsedSelected.year);
              setViewMonth(parsedSelected.month);
            }
          }
        }}
        className="pz-datepicker-trigger"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        style={{
          width: "100%",
          minHeight: "42px",
          padding: "9px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          borderRadius: "9px",
          border: isOpen
            ? "1px solid #9d831b"
            : "1px solid var(--line, #e2e8f0)",
          background: "var(--card, #ffffff)",
          color: displayText ? "var(--ink, #0f172a)" : "var(--muted, #94a3b8)",
          fontSize: "13px",
          fontWeight: 500,
          textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer",
          outline: "none",
          boxShadow: isOpen ? "0 0 0 4px rgb(250 204 21 / 16%)" : "none",
          transition: "all 0.15s ease",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden", textOverflow: "ellipsis" }}>
          {displayText || placeholder}
        </span>

        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {selectedISO && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              title="Clear date"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                color: "#94a3b8",
                fontSize: "11px",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
            >
              ✕
            </span>
          )}

          {/* PrepZii Themed Calendar Icon */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isOpen ? "#d97706" : "#64748b"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, transition: "stroke 0.15s" }}
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </span>
      </button>

      {/* Custom PrepZii Popover Calendar */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="pz-datepicker-popover"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 1000,
            width: "288px",
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid rgba(226, 232, 240, 0.9)",
            boxShadow:
              "0 14px 38px -6px rgba(15, 23, 42, 0.16), 0 4px 14px -2px rgba(15, 23, 42, 0.08)",
            padding: "16px",
            userSelect: "none",
            animation: "pzScaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Calendar Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "14px",
            }}
          >
            {/* Month & Year Title / Selector */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: "4px 8px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 800,
                  color: "#0f172a",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  letterSpacing: "-0.01em",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <span>
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: isYearDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Quick Month & Year Picker Dropdown */}
              {isYearDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    zIndex: 1010,
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    boxShadow: "0 10px 25px -4px rgba(15, 23, 42, 0.18)",
                    padding: "10px",
                    width: "240px",
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "4px",
                    maxHeight: "220px",
                    overflowY: "auto",
                  }}
                >
                  {/* Month Buttons */}
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "2px 4px 6px",
                      borderBottom: "1px solid #f1f5f9",
                      marginBottom: "6px",
                    }}
                  >
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>
                      Month
                    </span>
                    <select
                      value={viewYear}
                      onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                      style={{
                        padding: "2px 6px",
                        borderRadius: "6px",
                        border: "1px solid #e2e8f0",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#0f172a",
                        outline: "none",
                      }}
                    >
                      {yearOptions.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>

                  {MONTH_NAMES.map((mName, idx) => {
                    const isCurrent = idx === viewMonth;
                    return (
                      <button
                        key={mName}
                        type="button"
                        onClick={() => {
                          setViewMonth(idx);
                          setIsYearDropdownOpen(false);
                        }}
                        style={{
                          padding: "6px 2px",
                          borderRadius: "6px",
                          border: "none",
                          background: isCurrent ? "#0B1528" : "transparent",
                          color: isCurrent ? "#FACC15" : "#334155",
                          fontSize: "11px",
                          fontWeight: isCurrent ? 800 : 600,
                          cursor: "pointer",
                          textAlign: "center",
                        }}
                        onMouseEnter={(e) => {
                          if (!isCurrent) e.currentTarget.style.backgroundColor = "#f1f5f9";
                        }}
                        onMouseLeave={(e) => {
                          if (!isCurrent) e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        {mName.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Previous and Next Month Chevrons */}
            <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Previous month"
                aria-label="Previous month"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  border: "none",
                  background: "transparent",
                  color: "#64748b",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f1f5f9";
                  e.currentTarget.style.color = "#0f172a";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#64748b";
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <button
                type="button"
                onClick={handleNextMonth}
                title="Next month"
                aria-label="Next month"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  border: "none",
                  background: "transparent",
                  color: "#64748b",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f1f5f9";
                  e.currentTarget.style.color = "#0f172a";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#64748b";
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>

          {/* Weekday Row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              textAlign: "center",
              marginBottom: "8px",
            }}
          >
            {WEEK_DAYS.map((dayLabel, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#94a3b8",
                  padding: "2px 0",
                }}
              >
                {dayLabel}
              </span>
            ))}
          </div>

          {/* Day Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "3px",
            }}
          >
            {/* Previous Month Padding */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => {
              const dayNum = daysInPrevMonth - firstDayOfWeek + idx + 1;
              return (
                <div
                  key={`prev-${idx}`}
                  style={{
                    height: "32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    color: "#cbd5e1",
                    borderRadius: "8px",
                  }}
                >
                  {dayNum}
                </div>
              );
            })}

            {/* Current Month Days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateISO = formatToISO(viewYear, viewMonth, dayNum);
              const isSelected = selectedISO === dateISO;
              const isToday = todayISO === dateISO;

              const isBeforeMin = min ? dateISO < min : false;
              const isAfterMax = max ? dateISO > max : false;
              const isDisabled = isBeforeMin || isAfterMax;

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelectDate(viewYear, viewMonth, dayNum)}
                  style={{
                    height: "32px",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: isSelected ? 800 : isToday ? 700 : 500,
                    borderRadius: "8px",
                    border: isToday && !isSelected ? "1px solid #FACC15" : "none",
                    background: isSelected
                      ? "#0B1528"
                      : "transparent",
                    color: isSelected
                      ? "#FACC15"
                      : isDisabled
                      ? "#cbd5e1"
                      : isToday
                      ? "#0f172a"
                      : "#334155",
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    position: "relative",
                    transition: "all 0.12s ease",
                    boxShadow: isSelected
                      ? "0 2px 8px rgba(11, 21, 40, 0.25)"
                      : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && !isDisabled) {
                      e.currentTarget.style.backgroundColor = "#fef9c3";
                      e.currentTarget.style.color = "#854d0e";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !isDisabled) {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = isToday ? "#0f172a" : "#334155";
                    }
                  }}
                >
                  {dayNum}
                  {/* Gold active pip for today when selected */}
                  {isToday && isSelected && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: "3px",
                        width: "3px",
                        height: "3px",
                        borderRadius: "50%",
                        backgroundColor: "#FACC15",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Calendar Footer: Clear & Today Actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "14px",
              paddingTop: "10px",
              borderTop: "1px solid #f1f5f9",
            }}
          >
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "12px",
                fontWeight: 600,
                color: "#64748b",
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: "6px",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#ef4444";
                e.currentTarget.style.backgroundColor = "#fef2f2";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#64748b";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              Clear
            </button>

            <button
              type="button"
              onClick={handleToday}
              style={{
                background: "#fef9c3",
                border: "1px solid #fef08a",
                fontSize: "12px",
                fontWeight: 700,
                color: "#854d0e",
                cursor: "pointer",
                padding: "4px 12px",
                borderRadius: "6px",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#fde047";
                e.currentTarget.style.color = "#713f12";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#fef9c3";
                e.currentTarget.style.color = "#854d0e";
              }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
