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
  enableTime?: boolean;
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

interface ParsedDateTime {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
}

function parseDateTimeString(raw?: string): ParsedDateTime | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  // Match YYYY-MM-DD or YYYY-MM-DDTHH:mm or ISO format
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/.exec(trimmed);
  if (!dateMatch) return null;

  const year = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10) - 1; // 0-indexed
  const day = parseInt(dateMatch[3], 10);
  const hours = dateMatch[4] !== undefined ? parseInt(dateMatch[4], 10) : 9; // Default 09:00
  const minutes = dateMatch[5] !== undefined ? parseInt(dateMatch[5], 10) : 0;

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return { year, month, day, hours, minutes };
}

function formatToOutput(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  enableTime: boolean
): string {
  const datePart = `${year}-${padZero(month + 1)}-${padZero(day)}`;
  if (!enableTime) return datePart;
  return `${datePart}T${padZero(hours)}:${padZero(minutes)}`;
}

function formatDisplayString(
  raw: string,
  format: "dd/mm/yyyy" | "yyyy-mm-dd" | "friendly",
  enableTime: boolean
): string {
  const parsed = parseDateTimeString(raw);
  if (!parsed) return "";
  const { year, month, day, hours, minutes } = parsed;

  let dateStr = "";
  if (format === "yyyy-mm-dd") {
    dateStr = `${year}-${padZero(month + 1)}-${padZero(day)}`;
  } else if (format === "friendly") {
    const monthShort = MONTH_NAMES[month].slice(0, 3);
    dateStr = `${day} ${monthShort} ${year}`;
  } else {
    // dd/mm/yyyy
    dateStr = `${padZero(day)}/${padZero(month + 1)}/${year}`;
  }

  if (!enableTime) return dateStr;

  // 12-hour display with AM/PM
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${dateStr}, ${padZero(displayHours)}:${padZero(minutes)} ${ampm}`;
}

export const DatePicker: FC<DatePickerProps> = ({
  id,
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  min,
  max,
  className = "",
  style,
  displayFormat = "dd/mm/yyyy",
  enableTime = false,
}) => {
  const defaultPlaceholder = enableTime ? "dd/mm/yyyy, --:-- --" : "dd/mm/yyyy";
  const effectivePlaceholder = placeholder ?? defaultPlaceholder;

  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState<string>(
    controlledValue ?? defaultValue ?? ""
  );

  const selectedRaw = isControlled ? controlledValue ?? "" : internalValue;
  const parsedSelected = parseDateTimeString(selectedRaw);

  // Today reference
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDay = now.getDate();
  const todayHours = now.getHours();
  const todayMinutes = Math.floor(now.getMinutes() / 5) * 5; // rounded to 5 mins

  // View state (which month/year is currently visible in calendar)
  const [viewYear, setViewYear] = useState<number>(
    parsedSelected ? parsedSelected.year : todayYear
  );
  const [viewMonth, setViewMonth] = useState<number>(
    parsedSelected ? parsedSelected.month : todayMonth
  );

  // Time state
  const [selectedHours, setSelectedHours] = useState<number>(
    parsedSelected ? parsedSelected.hours : 9
  );
  const [selectedMinutes, setSelectedMinutes] = useState<number>(
    parsedSelected ? parsedSelected.minutes : 0
  );

  const [isOpen, setIsOpen] = useState(false);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal state if controlled value changes
  useEffect(() => {
    if (isControlled && controlledValue !== undefined) {
      setInternalValue(controlledValue);
      const parsed = parseDateTimeString(controlledValue);
      if (parsed) {
        setViewYear(parsed.year);
        setViewMonth(parsed.month);
        setSelectedHours(parsed.hours);
        setSelectedMinutes(parsed.minutes);
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

  const updateValue = (
    year: number,
    month: number,
    day: number,
    hours: number,
    minutes: number
  ) => {
    const formatted = formatToOutput(year, month, day, hours, minutes, enableTime);
    if (!isControlled) {
      setInternalValue(formatted);
    }
    onChange?.(formatted);
  };

  const handleSelectDate = (year: number, month: number, day: number) => {
    updateValue(year, month, day, selectedHours, selectedMinutes);
    if (!enableTime) {
      setIsOpen(false);
      setIsYearDropdownOpen(false);
    }
  };

  const handleTimeChange = (newHours: number, newMinutes: number) => {
    setSelectedHours(newHours);
    setSelectedMinutes(newMinutes);
    if (parsedSelected) {
      updateValue(
        parsedSelected.year,
        parsedSelected.month,
        parsedSelected.day,
        newHours,
        newMinutes
      );
    } else {
      // If no date selected yet, pick today's date with the time
      updateValue(todayYear, todayMonth, todayDay, newHours, newMinutes);
    }
  };

  const handleClear = (e?: ReactMouseEvent) => {
    e?.stopPropagation();
    if (!isControlled) {
      setInternalValue("");
    }
    onChange?.("");
    setIsOpen(false);
  };

  const handleNow = () => {
    setSelectedHours(todayHours);
    setSelectedMinutes(todayMinutes);
    updateValue(todayYear, todayMonth, todayDay, todayHours, todayMinutes);
    if (!enableTime) {
      setIsOpen(false);
    }
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
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // Year choices
  const yearOptions: number[] = [];
  const startYear = Math.min(todayYear - 4, viewYear - 2);
  const endYear = Math.max(todayYear + 6, viewYear + 3);
  for (let y = startYear; y <= endYear; y++) {
    yearOptions.push(y);
  }

  const displayText = selectedRaw
    ? formatDisplayString(selectedRaw, displayFormat, enableTime)
    : "";

  // Time conversion for UI (12-hour format)
  const isPM = selectedHours >= 12;
  const current12Hour = selectedHours % 12 === 0 ? 12 : selectedHours % 12;

  return (
    <div
      ref={containerRef}
      className={`pz-datepicker-wrapper ${className}`}
      style={{
        position: "relative",
        display: "inline-block",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        fontFamily: "var(--font-prepzii-body, var(--font-body, system-ui, sans-serif))",
        ...style,
      }}
    >
      {/* Hidden input for HTML form submissions */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={selectedRaw}
          required={required && !selectedRaw}
          id={id ? `${id}-hidden` : undefined}
        />
      )}

      {/* Trigger Button */}
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
              setSelectedHours(parsedSelected.hours);
              setSelectedMinutes(parsedSelected.minutes);
            }
          }
        }}
        className="pz-datepicker-trigger"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        style={{
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          minHeight: "40px",
          padding: "8px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
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
          overflow: "hidden",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
          }}
        >
          {displayText || effectivePlaceholder}
        </span>

        <span style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          {selectedRaw && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              title="Clear"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                color: "#94a3b8",
                fontSize: "11px",
                cursor: "pointer",
                lineHeight: 1,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
            >
              ✕
            </span>
          )}

          {/* Calendar & Clock Icon */}
          <svg
            width="15"
            height="15"
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
            {enableTime && <circle cx="12" cy="15" r="2" fill={isOpen ? "#d97706" : "#64748b"} />}
          </svg>
        </span>
      </button>

      {/* Popover Calendar */}
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
            width: enableTime ? "310px" : "288px",
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

              {/* Year Dropdown */}
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

            {/* Navigation Chevrons */}
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
            {/* Prev month padding */}
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

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateOnlyISO = `${viewYear}-${padZero(viewMonth + 1)}-${padZero(dayNum)}`;
              const selectedDateOnly = parsedSelected
                ? `${parsedSelected.year}-${padZero(parsedSelected.month + 1)}-${padZero(parsedSelected.day)}`
                : "";

              const isSelected = selectedDateOnly === dateOnlyISO;
              const isToday =
                todayYear === viewYear && todayMonth === viewMonth && todayDay === dayNum;

              const isBeforeMin = min ? dateOnlyISO < min.split("T")[0] : false;
              const isAfterMax = max ? dateOnlyISO > max.split("T")[0] : false;
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
                    background: isSelected ? "#0B1528" : "transparent",
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
                    boxShadow: isSelected ? "0 2px 8px rgba(11, 21, 40, 0.25)" : "none",
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

          {/* Time Picker Controls (if enableTime is true) */}
          {enableTime && (
            <div
              style={{
                marginTop: "14px",
                paddingTop: "12px",
                borderTop: "1px solid #f1f5f9",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#64748b" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>Select Time</span>
                </div>

                {/* AM/PM Toggle */}
                <div
                  style={{
                    display: "inline-flex",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (isPM) handleTimeChange(selectedHours - 12, selectedMinutes);
                    }}
                    style={{
                      padding: "2px 8px",
                      fontSize: "11px",
                      fontWeight: !isPM ? 800 : 500,
                      border: "none",
                      background: !isPM ? "#0B1528" : "#ffffff",
                      color: !isPM ? "#FACC15" : "#64748b",
                      cursor: "pointer",
                    }}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isPM) handleTimeChange(selectedHours + 12, selectedMinutes);
                    }}
                    style={{
                      padding: "2px 8px",
                      fontSize: "11px",
                      fontWeight: isPM ? 800 : 500,
                      border: "none",
                      background: isPM ? "#0B1528" : "#ffffff",
                      color: isPM ? "#FACC15" : "#64748b",
                      cursor: "pointer",
                    }}
                  >
                    PM
                  </button>
                </div>
              </div>

              {/* Hour & Minute Pickers */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "8px" }}>
                <select
                  value={current12Hour}
                  onChange={(e) => {
                    const h12 = parseInt(e.target.value, 10);
                    const new24 = isPM ? (h12 === 12 ? 12 : h12 + 12) : (h12 === 12 ? 0 : h12);
                    handleTimeChange(new24, selectedMinutes);
                  }}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    color: "#0f172a",
                    fontSize: "13px",
                    fontWeight: 700,
                    outline: "none",
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h}>
                      {padZero(h)} hr
                    </option>
                  ))}
                </select>

                <span style={{ fontSize: "14px", fontWeight: 800, color: "#94a3b8" }}>:</span>

                <select
                  value={selectedMinutes}
                  onChange={(e) => {
                    handleTimeChange(selectedHours, parseInt(e.target.value, 10));
                  }}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    color: "#0f172a",
                    fontSize: "13px",
                    fontWeight: 700,
                    outline: "none",
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                >
                  {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                    <option key={m} value={m}>
                      {padZero(m)} min
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Calendar Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "12px",
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

            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={handleNow}
                style={{
                  background: "#fef9c3",
                  border: "1px solid #fef08a",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#854d0e",
                  cursor: "pointer",
                  padding: "4px 10px",
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
                {enableTime ? "Now" : "Today"}
              </button>

              {enableTime && (
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
                    padding: "4px 12px",
                    borderRadius: "6px",
                  }}
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const DateTimePicker: FC<Omit<DatePickerProps, "enableTime">> = (props) => {
  return <DatePicker {...props} enableTime={true} />;
};
