import { useEffect, useId, useState, type ReactNode } from "react";
import { faBars } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import InternalLink from "../../navigation/InternalLink";
import IconButton from "../ui/IconButton";
import AppHeader from "./AppHeader";
import "./ManagementLayout.scss";

interface ManagementLink {
  label: string;
  href: string;
  current?: boolean;
  ariaLabel?: string;
  description?: string;
}

export interface ManagementNavigationGroup {
  title?: string;
  links: ManagementLink[];
}

interface ManagementLayoutProps {
  areaId: string;
  areaName: string;
  description?: string;
  title: string;
  documentTitle: string;
  navigationLabel: string;
  navigation: ManagementNavigationGroup[];
  menuLabels: { open: string; close: string };
  children: ReactNode;
}

const menuPreferences = new Map<string, boolean>();

export default function ManagementLayout({
  areaId,
  areaName,
  description,
  title,
  documentTitle,
  navigationLabel,
  navigation,
  menuLabels,
  children,
}: ManagementLayoutProps) {
  const [desktopQuery] = useState(() =>
    window.matchMedia("(min-width: 1024px)"),
  );
  const [desktop, setDesktop] = useState(desktopQuery.matches);
  const [choice, setChoice] = useState<{ areaId: string; open: boolean }>();
  const preference =
    choice?.areaId === areaId ? choice.open : menuPreferences.get(areaId);
  const open = preference ?? desktop;
  const menuId = useId();

  useEffect(() => {
    const update = () => setDesktop(desktopQuery.matches);
    desktopQuery.addEventListener("change", update);
    return () => desktopQuery.removeEventListener("change", update);
  }, [desktopQuery]);

  useEffect(() => {
    const previous = document.title;
    document.title = documentTitle;
    return () => {
      document.title = previous;
    };
  }, [documentTitle]);

  return (
    <div className="management-layout">
      <AppHeader />
      <div className="management-layout__inner page-content">
        <div className="management-layout__heading">
          <IconButton
            aria-label={open ? menuLabels.close : menuLabels.open}
            aria-expanded={open}
            aria-controls={menuId}
            icon={<FontAwesomeIcon icon={faBars} aria-hidden="true" />}
            onClick={() => {
              menuPreferences.set(areaId, !open);
              setChoice({ areaId, open: !open });
            }}
          />
          <div>
            <p className="management-layout__area">{areaName}</p>
            {description && (
              <p className="management-layout__context">{description}</p>
            )}
          </div>
        </div>
        <div
          className={`management-layout__layout${open ? " management-layout__layout--open" : ""}`}
        >
          <nav
            id={menuId}
            hidden={!open}
            className="management-layout__menu"
            aria-label={navigationLabel}
          >
            {navigation.map((group, index) => (
              <div className="management-layout__menu-group" key={index}>
                {group.title && (
                  <p className="management-layout__menu-title">{group.title}</p>
                )}
                {group.links.map((link) => (
                  <InternalLink
                    className="management-layout__menu-link"
                    key={link.href}
                    href={link.href}
                    aria-label={link.ariaLabel}
                    aria-current={link.current ? "page" : undefined}
                  >
                    {link.description ? `${link.label} ` : link.label}
                    {link.description && (
                      <span className="management-layout__menu-description">
                        {link.description}
                      </span>
                    )}
                  </InternalLink>
                ))}
              </div>
            ))}
          </nav>
          <main
            className="management-layout__content"
            id="main-content"
            tabIndex={-1}
          >
            <h1 className="management-layout__title">{title}</h1>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
