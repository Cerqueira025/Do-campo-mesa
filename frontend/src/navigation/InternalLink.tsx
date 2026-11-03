import type { AnchorHTMLAttributes } from "react";
import { navigate, shouldNavigate } from "./navigation";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export default function InternalLink({
  href,
  onClick,
  target,
  download,
  ...props
}: Props) {
  return (
    <a
      {...props}
      href={href}
      target={target}
      download={download}
      data-navigation-id={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          !shouldNavigate(event, target, download) ||
          new URL(href, window.location.href).origin !== window.location.origin
        )
          return;
        event.preventDefault();
        navigate(href);
      }}
    />
  );
}
