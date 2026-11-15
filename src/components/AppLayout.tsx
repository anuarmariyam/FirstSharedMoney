import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router";
import { Brand, Badge, EmptyState, ButtonLink } from "./ui";
import { Icon } from "./Icon";

const links = [
  { path: "", label: "Our starting point", icon: "home", end: true },
  {
    path: "/questionnaire",
    label: "My questionnaire",
    icon: "document",
    end: false,
  },
  { path: "/differences", label: "Our perspectives", icon: "chat", end: false },
  {
    path: "/simulator",
    label: "Explore the numbers",
    icon: "sliders",
    end: false,
  },
  {
    path: "/agreement",
    label: "Our money agreement",
    icon: "heart",
    end: false,
  },
] as const;

export function AppLayout() {
  const { coupleId } = useParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const frame = requestAnimationFrame(() =>
      sidebar.current?.querySelector<HTMLElement>(".sidebar-link")?.focus(),
    );
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        requestAnimationFrame(() => menuButton.current?.focus());
      }
      if (event.key !== "Tab") return;
      const items = sidebar.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not(:disabled)",
      );
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    const desktop = matchMedia("(min-width: 761px)");
    function resized(event: MediaQueryListEvent) {
      if (event.matches) setMenuOpen(false);
    }
    desktop.addEventListener("change", resized);
    document.addEventListener("keydown", keydown);
    return () => {
      cancelAnimationFrame(frame);
      desktop.removeEventListener("change", resized);
      document.removeEventListener("keydown", keydown);
    };
  }, [menuOpen]);
  return (
    <div className="app-layout">
      <aside
        id="workspace-navigation"
        ref={sidebar}
        className={`sidebar ${menuOpen ? "is-open" : ""}`}
      >
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => {
              setMenuOpen(false);
              requestAnimationFrame(() => menuButton.current?.focus());
            }}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="workspace-label">
          <span className="eyebrow">A little more together</span>
          <Badge>Demo</Badge>
        </div>
        <nav aria-label="Your plan">
          {links.map((link) => (
            <NavLink
              key={link.path}
              to={`/sessions/${coupleId}${link.path}`}
              end={link.end}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
              onClick={() => setMenuOpen(false)}
            >
              <Icon name={link.icon} />
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="small-avatars">
            <span>A</span>
            <span>B</span>
          </div>
          <strong>
            Two perspectives.
            <br />A shared starting point.
          </strong>
          <p>Take it one conversation at a time.</p>
          <div className="connection-label">
            <span />
            Demo · not saved
          </div>
        </div>
      </aside>
      <div className="app-body" inert={menuOpen}>
        <header className="app-topbar">
          <button
            ref={menuButton}
            className="icon-button mobile-only"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            aria-controls="workspace-navigation"
          >
            <Icon name="menu" />
          </button>
          <span className="topbar-title">Your first shared plan</span>
          <div className="topbar-right">
            <Badge tone="neutral">Sample Data</Badge>
            <span className="avatar">
              A<span className="avatar-dot" />
            </span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="app-main">
          {coupleId === "demo" ? (
            <Outlet />
          ) : (
            <EmptyState title="Open a session in the connected app">
              This standalone demo cannot open real sessions. Use the connected app and your own invitation.
              <div className="mt-6">
                <ButtonLink to="/sessions/demo">Explore the demo</ButtonLink>
              </div>
            </EmptyState>
          )}
        </main>
        <footer className="app-footer">
          <span>FirstSharedMoney · A little clarity for life together.</span>
          <span>Personal planning, not financial or legal advice.</span>
        </footer>
      </div>
      {menuOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}
