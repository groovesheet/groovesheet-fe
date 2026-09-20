"use client";

/* The app shell: top bar, sidebar and the content well.

   Client, because it owns three pieces of interaction state the server cannot:
   the user menu, the collapse toggle (persisted) and the mobile drawer. The
   drawer is shared between the hamburger in the top bar and the sidebar
   itself, which is why both live in one component rather than two.

   Everything it renders comes from props resolved on the server, so adding a
   module still means one entry in _lib/nav.ts and nothing here. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, PAGE_META, SETTINGS_ITEM, activeHref, type Badges, type NavItem } from "../_lib/nav";
import { editorName } from "../_lib/editors";

const COLLAPSE_KEY = "groovesheet.internal.collapsed";

export default function Chrome({
  user,
  badges,
  children,
}: {
  user: string;
  badges: Badges;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = activeHref(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
    } catch {
      /* Private mode, or site data blocked. The rail just starts expanded. */
    }
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* Not worth failing the click over. */
      }
      return next;
    });
  }, []);

  // Close the drawer and the user menu on navigation.
  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen && !menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setDrawerOpen(false);
      setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, menuOpen]);

  /* The breadcrumb names the module, not the record. On a draft's own page the
     post title is already the h1 directly below, and repeating it here read as
     a stutter. */
  const moduleTitle = PAGE_META[active]?.title ?? "Internal";
  const displayName = editorName(user);
  /* Initials from the display name: "Edward Zhang" gives EZ, rather than the
     first two letters of the username. */
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <>
      <div className="int-topbar">
        <button
          type="button"
          className="int-burger"
          aria-label={drawerOpen ? "Close menu" : "Open menu"}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen((o) => !o)}
        >
          {drawerOpen ? "✕" : "☰"}
        </button>
        <div className="int-brand">
          <Link href="/internal" aria-label="GrooveSheet internal">
            {/* The white logotype is the dark-theme asset. In light mode the
                filter inverts it, which is cheaper than shipping both files
                into an app that has no other images. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/Logo_White.png"
              width={112}
              height={20}
              alt="GrooveSheet"
              className="int-logo"
            />
          </Link>
          <span className="int-divider" />
          <nav className="int-crumbs" aria-label="Breadcrumb">
            <Link href="/internal" className="int-crumb">
              Internal
            </Link>
            <span className="int-crumb-sep">/</span>
            <span className="int-crumb-current">{moduleTitle}</span>
          </nav>
        </div>
        <div className="int-spacer" />
        <div className="int-user">
          <button
            type="button"
            className="int-user-button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="int-user-name">{displayName}</span>
            <span className="gs-avatar int-avatar">{initials}</span>
          </button>
          {menuOpen ? (
            <div className="int-menu" role="menu">
              <div className="int-menu-label">{displayName}</div>
              <div className="int-menu-rule" />
              <form action="/api/internal/logout" method="post">
                <button type="submit" className="int-menu-item" role="menuitem">
                  Sign out
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>

      <div className="int-frame">
        {drawerOpen ? (
          <button
            type="button"
            className="int-drawer-scrim"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          />
        ) : null}

        <div
          className={[
            "int-sidebar",
            collapsed ? "is-collapsed" : "",
            drawerOpen ? "is-open" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="int-nav-groups">
            {NAV.map((group) => (
              <div key={group.label} className="int-nav-group">
                <div className="int-nav-group-label">{group.label}</div>
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} active={active} badges={badges} />
                ))}
              </div>
            ))}
          </div>
          <div className="int-sidebar-foot">
            {/* Volumet had a Settings module here. Nothing in this portal is
                configurable from the browser: the pipeline reads
                pipeline.config.json and the environment. */}
            {SETTINGS_ITEM ? (
              <NavLink item={SETTINGS_ITEM} active={active} badges={badges} />
            ) : null}
            <button type="button" className="int-collapse" onClick={toggleCollapse}>
              <span className="int-nav-glyph">{collapsed ? "»" : "«"}</span>
              <span className="int-nav-label">Collapse</span>
            </button>
          </div>
        </div>

        <div className="int-content">
          <div className="int-content-inner">{children}</div>
        </div>
      </div>
    </>
  );
}

function NavLink({
  item,
  active,
  badges,
}: {
  item: NavItem;
  active: string;
  badges: Badges;
}) {
  const isActive = active === item.href;
  const badge = item.badge ? badges[item.badge] : undefined;
  return (
    <Link
      href={item.href}
      className={`int-nav-item${isActive ? " is-active" : ""}`}
      title={item.label}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="int-nav-glyph">{item.glyph}</span>
      <span className="int-nav-label">{item.label}</span>
      {badge ? <span className="int-nav-badge">{badge}</span> : null}
    </Link>
  );
}
