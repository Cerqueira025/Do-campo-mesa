import {
  useLayoutEffect,
  useRef,
  useState,
  type AriaAttributes,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import "./Select.scss";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends AriaAttributes {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  variant?: "form" | "filter";
  name?: string;
  required?: boolean;
  disabled?: boolean;
}

const searchable = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-PT");

export default function Select({
  id,
  value,
  onValueChange,
  options,
  variant = "form",
  name,
  required = false,
  disabled = false,
  ...aria
}: SelectProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const native = useRef<HTMLSelectElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const selected = options.find((option) => option.value === value);
  const enabled = options.filter((option) => !option.disabled);
  const active =
    enabled.find((option) => option.value === activeValue) ??
    enabled.find((option) => option.value === value) ??
    enabled[0];
  const activeIndex = options.findIndex((option) => option === active);
  const expanded = open && !disabled && options.length > 0;
  const showError = invalid && required && !selected?.value;
  const listId = `${id}-options`;

  useLayoutEffect(() => {
    const button = trigger.current!;
    // The portal is outside fieldsets; their disabled state must still close the menu.
    const observer = new MutationObserver(() => {
      if (button.matches(":disabled")) setOpen(false);
    });
    observer.observe(button, {
      attributes: true,
      attributeFilter: ["disabled"],
    });
    for (
      let ancestor = button.parentElement;
      ancestor;
      ancestor = ancestor.parentElement
    ) {
      if (ancestor.tagName === "FIELDSET") {
        observer.observe(ancestor, {
          attributes: true,
          attributeFilter: ["disabled"],
        });
      }
    }
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!expanded) return;
    const button = trigger.current!;
    const popup = menu.current!;
    function position() {
      const rect = button.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      if (rect.bottom < top || rect.top > top + height) {
        setOpen(false);
        return;
      }
      const popupWidth = Math.min(rect.width, Math.max(0, width - 24));
      popup.style.width = `${popupWidth}px`;
      const below = Math.max(0, top + height - rect.bottom - 20);
      const above = Math.max(0, rect.top - top - 20);
      const upwards =
        below < Math.min(320, popup.scrollHeight) && above > below;
      const maxHeight = Math.min(320, upwards ? above : below);
      popup.style.maxHeight = `${maxHeight}px`;
      popup.style.left = `${Math.max(left + 12, Math.min(rect.left, left + width - popupWidth - 12))}px`;
      popup.style.top = `${upwards ? rect.top - 8 - popup.getBoundingClientRect().height : rect.bottom + 8}px`;
    }
    function outside(event: PointerEvent) {
      if (
        !button.contains(event.target as Node) &&
        !popup.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    const resize = new ResizeObserver(position);
    resize.observe(button);
    position();
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    return () => {
      resize.disconnect();
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
    };
  }, [expanded, options]);

  useLayoutEffect(() => {
    if (expanded && activeIndex >= 0) {
      const option = menu.current?.children[activeIndex] as
        HTMLElement | undefined;
      option?.scrollIntoView?.({ block: "nearest" });
    }
  }, [expanded, activeIndex]);

  function show(last = false) {
    if (trigger.current?.matches(":disabled") || !enabled.length) return;
    search.current = { text: "", time: 0 };
    setActiveValue(
      enabled.find((option) => option.value === value)?.value ??
        (last ? enabled.at(-1)!.value : enabled[0].value),
    );
    trigger.current?.focus();
    setOpen(true);
  }

  function choose(option: SelectOption) {
    if (trigger.current?.matches(":disabled") || option.disabled) return;
    setOpen(false);
    setInvalid(false);
    trigger.current?.focus();
    if (option.value !== value) onValueChange(option.value);
  }

  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key;
    if (key === "Tab") {
      setOpen(false);
      return;
    }
    if (key === "Escape") {
      if (expanded) event.preventDefault();
      setOpen(false);
      return;
    }
    if (
      key === "ArrowDown" ||
      key === "ArrowUp" ||
      key === "Home" ||
      key === "End"
    ) {
      event.preventDefault();
      if (!expanded) show(key === "ArrowUp" || key === "End");
      const index = enabled.findIndex((option) => option === active);
      if (key === "Home" || key === "End") {
        setActiveValue(
          (key === "Home" ? enabled[0] : enabled.at(-1))?.value ?? null,
        );
      } else if (expanded) {
        setActiveValue(
          enabled[
            Math.max(
              0,
              Math.min(
                enabled.length - 1,
                index + (key === "ArrowDown" ? 1 : -1),
              ),
            )
          ]?.value ?? null,
        );
      }
      return;
    }
    const typing = Date.now() - search.current.time < 700;
    if (key === "Enter" || (key === " " && !typing)) {
      event.preventDefault();
      if (expanded && active) choose(active);
      else show();
      return;
    }
    if (key.length !== 1 || !enabled.length) return;
    event.preventDefault();
    const text = searchable((typing ? search.current.text : "") + key);
    if (!expanded) show();
    search.current = { text, time: Date.now() };
    const repeated = [...text].every((letter) => letter === text[0]);
    const prefix = repeated ? text[0] : text;
    const start = enabled.findIndex((option) => option === active);
    const ordered = [
      ...enabled.slice(start + 1),
      ...enabled.slice(0, start + 1),
    ];
    const match =
      (!repeated && active && searchable(active.label).startsWith(prefix)
        ? active
        : undefined) ??
      ordered.find((option) => searchable(option.label).startsWith(prefix));
    if (match) setActiveValue(match.value);
  }

  return (
    <div className={`select select--${variant}`}>
      <button
        {...aria}
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        className="select__trigger"
        disabled={disabled}
        aria-expanded={expanded}
        aria-haspopup="listbox"
        aria-controls={expanded ? listId : undefined}
        aria-activedescendant={
          expanded && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
        }
        aria-required={required || undefined}
        aria-invalid={showError || aria["aria-invalid"]}
        aria-describedby={
          [aria["aria-describedby"], showError ? `${id}-error` : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        onClick={() => (expanded ? setOpen(false) : show())}
        onKeyDown={keyDown}
        onBlur={() => setOpen(false)}
      >
        <span className="select__value">
          {selected?.label ?? "Selecione uma opção"}
        </span>
        <FontAwesomeIcon
          className="select__arrow"
          icon={faChevronDown}
          aria-hidden="true"
        />
      </button>
      <select
        ref={native}
        className="select__native"
        name={name}
        value={selected?.value ?? ""}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          if (!event.currentTarget.matches(":disabled")) {
            setInvalid(false);
            onValueChange(event.currentTarget.value);
          }
        }}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          const first = Array.from(native.current?.form?.elements ?? []).find(
            (control) =>
              (control instanceof HTMLInputElement ||
                control instanceof HTMLSelectElement ||
                control instanceof HTMLTextAreaElement) &&
              control.willValidate &&
              !control.validity.valid,
          );
          if (!first || first === native.current) trigger.current?.focus();
        }}
      >
        {!options.some((option) => option.value === "") && (
          <option value="" hidden />
        )}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      {showError && (
        <small id={`${id}-error`} className="select__error" role="alert">
          Selecione uma opção.
        </small>
      )}
      {expanded &&
        createPortal(
          <div
            ref={menu}
            id={listId}
            role="listbox"
            aria-label={aria["aria-label"]}
            aria-labelledby={
              aria["aria-label"]
                ? undefined
                : (aria["aria-labelledby"] ?? `${id}-label`)
            }
            className={`select__menu select--${variant}`}
            onMouseDown={(event) => event.preventDefault()}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                data-active={option === active || undefined}
                className="select__option"
                onPointerMove={() =>
                  !option.disabled && setActiveValue(option.value)
                }
                onClick={() => choose(option)}
              >
                <span>{option.label}</span>
                {option.value === value && (
                  <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
                )}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
