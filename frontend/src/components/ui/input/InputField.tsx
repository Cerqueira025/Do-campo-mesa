import type { InputHTMLAttributes, ReactNode } from "react";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import FormField, { type FormFieldProps } from "./FormField";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> &
  Pick<FormFieldProps, "id" | "label" | "hint"> & {
    icon?: IconDefinition;
    action?: ReactNode;
  };

export default function InputField({
  id,
  label,
  icon,
  hint,
  action,
  ...props
}: Props) {
  const describedBy =
    [props["aria-describedby"], hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <FormField id={id} label={label} icon={icon} hint={hint}>
      <input {...props} id={id} aria-describedby={describedBy} />
      {action}
    </FormField>
  );
}
