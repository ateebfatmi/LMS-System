"use client";

import {
  type CSSProperties,
  type FC,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

export interface SelectOption {
  value: string | number;
  label: ReactNode;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  id?: string;
  name?: string;
  value?: string | number;
  defaultValue?: string | number;
  placeholder?: string;
  options?: SelectOption[];
  children?: ReactNode;
  onChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: CSSProperties;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
  dropdownClassName?: string;
  dropdownStyle?: CSSProperties;
  "aria-label"?: string;
}

function parseOptionChildren(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = [];

  function traverse(node: ReactNode) {
    if (!node) return;

    if (Array.isArray(node)) {
      node.forEach(traverse);
      return;
    }

    if (isValidElement(node)) {
      const typeName =
        typeof node.type === "string"
          ? node.type
          : (node.type as any)?.name || (node.type as any)?.displayName;

      if (typeName === "option" || node.type === "option") {
        const props = (node.props || {}) as {
          value?: any;
          children?: ReactNode;
          disabled?: boolean;
          description?: string;
          icon?: ReactNode;
        };
        const rawValue = props.value !== undefined ? props.value : props.children;
        const value = String(rawValue ?? "");

        let label: ReactNode = props.children;
        if (label === undefined || label === null) {
          label = value;
        } else if (
          Array.isArray(label) &&
          label.every((c) => typeof c === "string" || typeof c === "number")
        ) {
          label = label.join("");
        }

        options.push({
          value,
          label,
          disabled: props.disabled,
          description: props.description,
          icon: props.icon,
        });
        return;
      }

      if ((node.props as any)?.children) {
        traverse((node.props as any).children);
      }
    }
  }

  traverse(children);
  return options;
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
  size = "md",
  className = "",
  style,
  triggerClassName = "",
  triggerStyle,
  dropdownClassName = "",
  dropdownStyle,
  "aria-label": ariaLabel,
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const listboxId = `${inputId}-listbox`;

  // Parse options from direct options prop or recursive option children
  const parsedOptions: SelectOption[] = [];
  if (directOptions && directOptions.length > 0) {
    parsedOptions.push(...directOptions);
  } else if (children) {
    parsedOptions.push(...parseOptionChildren(children));
  }

  const isControlled = controlledValue !== undefined;
  const initialValue =
    controlledValue !== undefined
      ? String(controlledValue)
      : defaultValue !== undefined
        ? String(defaultValue)
        : "";

  const [internalValue, setInternalValue] = useState<string>(initialValue);
  const selectedValue = isControlled ? String(controlledValue ?? "") : internalValue;

  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  // Sync internal value if controlledValue or defaultValue changes
  useEffect(() => {
    if (isControlled) {
      setInternalValue(String(controlledValue ?? ""));
    }
  }, [controlledValue, isControlled]);

  useEffect(() => {
    if (!isControlled && defaultValue !== undefined && internalValue === "") {
      setInternalValue(String(defaultValue));
    }
  }, [defaultValue, isControlled, internalValue]);

  // If uncontrolled, no defaultValue, and internalValue is empty, select first non-empty option if no placeholder
  useEffect(() => {
    if (!isControlled && !defaultValue && internalValue === "" && !placeholder && parsedOptions.length > 0) {
      setInternalValue(String(parsedOptions[0].value));
    }
  }, [isControlled, defaultValue, internalValue, placeholder, parsedOptions]);

  const selectedOption = parsedOptions.find(
    (opt) => String(opt.value) === String(selectedValue)
  );

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
      const idx = parsedOptions.findIndex(
        (opt) => String(opt.value) === String(selectedValue)
      );
      setFocusedIndex(idx >= 0 ? idx : 0);
    } else {
      setFocusedIndex(-1);
    }
  }, [isOpen, selectedValue, parsedOptions]);

  const handleSelect = useCallback(
    (val: string | number) => {
      const strVal = String(val);
      if (!isControlled) {
        setInternalValue(strVal);
      }
      onChange?.(strVal);
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

  // Dimensions based on size
  const minHeight = size === "sm" ? "34px" : size === "lg" ? "48px" : "40px";
  const padding = size === "sm" ? "0 10px" : size === "lg" ? "0 14px" : "0 12px";
  const fontSize = size === "sm" ? "12.5px" : size === "lg" ? "14px" : "13.5px";
  const borderRadius = size === "sm" ? "8px" : size === "lg" ? "12px" : "10px";

  const displayLabelText =
    selectedOption &&
    (typeof selectedOption.label === "string" || typeof selectedOption.label === "number")
      ? String(selectedOption.label)
      : placeholder;

  const computedAriaLabel = ariaLabel
    ? `${ariaLabel}, ${displayLabelText}`
    : undefined;

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
        aria-controls={isOpen ? listboxId : undefined}
        aria-label={computedAriaLabel}
        className={`pz-select-trigger ${isOpen ? "is-open" : ""} ${triggerClassName}`.trim()}
        style={{
          width: "100%",
          minHeight,
          padding,
          border: isOpen ? "1px solid #ca8a04" : "1px solid #dce2de",
          borderRadius,
          outline: "none",
          backgroundColor: "#ffffff",
          color: selectedOption ? "#181e1b" : "#475569",
          fontSize,
          fontFamily: "inherit",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          boxShadow: isOpen
            ? "0 0 0 3.5px rgba(250, 204, 21, 0.22)"
            : "0 1px 2px rgba(0, 0, 0, 0.02)",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          textAlign: "left",
          ...triggerStyle,
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
            flex: 1,
          }}
        >
          {selectedOption?.icon}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>

        {/* Elegant Chevron Icon */}
        <svg
          width={size === "sm" ? "15" : "16"}
          height={size === "sm" ? "15" : "16"}
          viewBox="0 0 24 24"
          fill="none"
          stroke={isOpen ? "#ca8a04" : "#64748b"}
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
            top: "calc(100% + 5px)",
            left: 0,
            width: "100%",
            minWidth: "100%",
            zIndex: 9999,
            backgroundColor: "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "5px",
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
            const isSelected = String(option.value) === String(selectedValue);
            const isFocused = index === focusedIndex;

            return (
              <div
                key={`${option.value}-${index}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
                onClick={() => !option.disabled && handleSelect(option.value)}
                onMouseEnter={() => !option.disabled && setFocusedIndex(index)}
                style={{
                  padding: size === "sm" ? "6px 10px" : "8px 11px",
                  borderRadius: "8px",
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
                  fontSize: size === "sm" ? "12px" : "13px",
                  lineHeight: "1.4",
                  transition: "background-color 0.12s ease, color 0.12s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
                  {option.icon}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {option.label}
                    </div>
                    {option.description && (
                      <div
                        style={{
                          fontSize: "11px",
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
                    width="15"
                    height="15"
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
