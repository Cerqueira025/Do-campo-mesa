import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import InternalLink from "../../navigation/InternalLink";
import "./IconButton.scss";

type IconButtonVariant = "primary" | "secondary" | "cream" | "dark" | "plain";

interface IconButtonBaseProps {
  icon: ReactNode;
  variant?: IconButtonVariant;
  "aria-label": string;
}

type IconButtonProps = IconButtonBaseProps &
  (
    | (Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
        href?: never;
      })
    | (Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "aria-label"> & {
        href: string;
      })
  );

function IconButton({
  "aria-label": ariaLabel,
  className = "",
  icon,
  variant = "primary",
  ...elementProps
}: IconButtonProps) {
  const classes = ["icon-button", `icon-button--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  if (elementProps.href !== undefined)
    return (
      <InternalLink
        {...elementProps}
        className={classes}
        aria-label={ariaLabel}
      >
        {icon}
      </InternalLink>
    );

  return (
    <button
      type="button"
      {...elementProps}
      className={classes}
      aria-label={ariaLabel}
    >
      {icon}
    </button>
  );
}

export default IconButton;
