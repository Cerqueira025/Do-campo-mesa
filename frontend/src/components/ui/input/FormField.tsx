import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { faEye, faEyeSlash, faLock } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import IconButton from "../IconButton";
import Input from "./Input";
import "./FormField.scss";

type FormFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "children"
> & {
  id: string;
  label: string;
  icon?: IconDefinition;
  unframed?: boolean;
  labelPosition?: "above" | "beside";
  hint?: string;
  children?: ReactNode;
};

export default function FormField({
  id,
  label,
  icon,
  unframed = false,
  labelPosition = "above",
  hint,
  children,
  type,
  ...props
}: FormFieldProps) {
  const [visible, setVisible] = useState(false);
  const password = type === "password" && !children;
  const describedBy =
    [props["aria-describedby"], hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div
      className={`form-field${unframed ? " form-field--unframed" : ""}${labelPosition === "beside" ? " form-field--beside" : ""}`}
    >
      <label className="form-field__label" htmlFor={id}>
        {label}
      </label>
      <div className={unframed ? undefined : "form-field__control"}>
        {(icon || password) && (
          <FontAwesomeIcon
            className="form-field__icon"
            icon={icon ?? faLock}
            aria-hidden="true"
          />
        )}
        {children ?? (
          <Input
            {...props}
            id={id}
            type={password && visible ? "text" : type}
            aria-describedby={describedBy}
          />
        )}
        {password && (
          <IconButton
            variant="plain"
            aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.toLowerCase()}`}
            aria-pressed={visible}
            disabled={props.disabled}
            onClick={() => setVisible((value) => !value)}
            icon={
              <FontAwesomeIcon
                icon={visible ? faEyeSlash : faEye}
                aria-hidden="true"
              />
            }
          />
        )}
      </div>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
