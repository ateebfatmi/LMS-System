"use client";

import {
  type CSSProperties,
  type FC,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  options?: SelectOption[];
  children?: ReactNode;
  onChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  style?: CSSProperties;
  dropdownClassName?: string;
  dropdownStyle?: CSSProperties;
}

export const Select: FC<SelectProps> = ({
  id,
  name,
  value: controlledValue,
  defaultValue,
  placeholder = "Select an option",
  options: directOptions,
  children,
  onChange,
  disabled = false,
  required = false,
  className = "",
  style,
  dropdownClassName = "",
  dropdownStyle,
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const listboxId = `${inputId}-listbox`;

  // Parse options from either direct options prop or option children
  const parsedOptions: SelectOption[] = [];
  if (directOptions && directOptions.length > 0) {
    parsedOptions.push(...directOptions);
  } else if (children) {
    Children.forEach(children, (child) => {
      if (isValidElement(child) && child.type === "option") {
        const optionElement = child as ReactElement<{
          value?: string;
          children?: ReactNode;
          disabled?: boolean;
        }>;
        const val = optionElement.props.value ?? String(optionElement.props.children ?? "");
        const lbl = String(optionElement.props.children ?? val);
        parsedOptions.push({
          value: val,
          label: lbl,
          disabled: optionElement.props.disabled,
        });
      }
    });
  }

  const isControlled = controlledValue !== undefined;
  const initialValue = controlledValue ?? defaultValue ?? (parsedOptions[0]?.value ?? "");
  const [internalValue, setInternalValue] = useState<string>(initialValue);
  const selectedValue = isControlled ? (controlledValue ?? "") : internalValue;

  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  // Sync internal value if controlledValue changes
  useEffect(() => {
    if (isControlled) {
      setInternalValue(controlledValue ?? "");
    }
  }, [controlledValue, isControlled]);

  const selectedOption = parsedOptions.find((opt) => opt.value === selectedValue);

  // Close when clicked outside
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

  // Adjust focused index when opening
  useEffect(() => {
    if (isOpen) {
      const idx = parsedOptions.findIndex((opt) => opt.value === selectedValue);
      setFocusedIndex(idx >= 0 ? idx : 0);
    } else {
      setFocusedIndex(-1);
    }
  }, [isOpen, selectedValue, parsedOptions]);

  const handleSelect = useCallback(
    (val: string) => {
      if (!isControlled) {
        setInternalValue(val);
      }
      onChange?.(val);
      setIsOpen(false);
      triggerRef.current?.focus();
    },
    [isControlled, onChange]
  );

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (disabled) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else if (focusedIndex >= 0 && focusedIndex < parsedOptions.length) {
        const targetOpt = parsedOptions[focusedIndex];
        if (!targetOpt.disabled) {
          handleSelect(targetOpt.value);
        }
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setFocusedIndex((prev) => {
          let next = prev + 1;
          while (next < parsedOptions.length && parsedOptions[next]?.disabled) {
            next++;
          }
          return next < parsedOptions.length ? next : prev;
        });
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setFocusedIndex((prev) => {
          let next = prev - 1;
          while (next >= 0 && parsedOptions[next]?.disabled) {
            next--;
          }
          return next >= 0 ? next : prev;
        });
      }
    } else if (e.key === "Escape" || e.key === "Tab") {
      if (isOpen) {
        setIsOpen(false);
        if (e.key === "Escape") {
          e.preventDefault();
          triggerRef.current?.focus();
        }
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`pz-select-container ${className}`.trim()}
      style={{
        position: "relative",
        width: "100%",
        userSelect: "none",
        ...style,
      }}
    >
      {/* Hidden input for HTML form submission compatibility */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={selectedValue}
          required={required}
        />
      )}

      {/* Select Trigger */}
      <button
        ref={triggerRef}
        id={inputId}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        className={`pz-select-trigger ${isOpen ? "is-open" : ""}`}
        style={{
          width: "100%",
          minHeight: "48px",
          padding: "0 14px",
          border: isOpen ? "1px solid #9d831b" : "1px solid #dce2de",
          borderRadius: "12px",
          outline: "none",
          backgroundColor: "#ffffff",
          color: selectedOption ? "#181e1b" : "#94a3b8",
          fontSize: "14px",
          fontFamily: "inherit",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          boxShadow: isOpen
            ? "0 0 0 4px rgba(250, 204, 21, 0.22)"
            : "0 1px 2px rgba(0, 0, 0, 0.02)",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          textAlign: "left",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selectedOption?.icon}
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
        </span>

        {/* Elegant Chevron Icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isOpen ? "#9d831b" : "#64748b"}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            flexShrink: 0,
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.15s",
          }}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          className={`pz-select-dropdown ${dropdownClassName}`.trim()}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            width: "100%",
            minWidth: "100%",
            zIndex: 1000,
            backgroundColor: "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "6px",
            boxShadow:
              "0 20px 42px -12px rgba(15, 23, 42, 0.18), 0 8px 16px -6px rgba(15, 23, 42, 0.08)",
            animation: "pzScaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
            maxHeight: "260px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            ...dropdownStyle,
          }}
        >
          {parsedOptions.map((option, index) => {
            const isSelected = option.value === selectedValue;
            const isFocused = index === focusedIndex;

            return (
              <div
                key={option.value}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
                onClick={() => !option.disabled && handleSelect(option.value)}
                onMouseEnter={() => !option.disabled && setFocusedIndex(index)}
                style={{
                  padding: "9px 12px",
                  borderRadius: "9px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: option.disabled ? "not-allowed" : "pointer",
                  opacity: option.disabled ? 0.45 : 1,
                  backgroundColor: isSelected
                    ? "#fef9c3"
                    : isFocused
                      ? "#fffbeb"
                      : "transparent",
                  color: isSelected ? "#713f12" : isFocused ? "#854d0e" : "#1e293b",
                  fontWeight: isSelected ? 650 : 500,
                  fontSize: "13.5px",
                  lineHeight: "1.4",
                  transition: "background-color 0.12s ease, color 0.12s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                  {option.icon}
                  <div>
                    <div>{option.label}</div>
                    {option.description && (
                      <div
                        style={{
                          fontSize: "11.5px",
                          color: isSelected ? "#854d0e" : "#64748b",
                          fontWeight: 400,
                          marginTop: "1px",
                        }}
                      >
                        {option.description}
                      </div>
                    )}
                  </div>
                </div>

                {/* Golden Checkmark for selected item */}
                {isSelected && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ca8a04"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0, marginLeft: "8px" }}
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            );
          })}

          {parsedOptions.length === 0 && (
            <div
              style={{
                padding: "12px",
                textAlign: "center",
                color: "#94a3b8",
                fontSize: "13px",
              }}
            >
              No options available
            </div>
          )}
        </div>
      )}
    </div>
  );
};
