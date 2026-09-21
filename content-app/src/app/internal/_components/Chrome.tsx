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
import { Menu, PanelLeftClose, PanelLeftOpen, PenLine, Share2, X, type LucideIcon } from "lucide-react";
import { NAV, PAGE_META, SETTINGS_ITEM, activeHref, type Badges, type NavItem } from "../_lib/nav";
import { editorName } from "../_lib/editors";

const COLLAPSE_KEY = "groovesheet.internal.collapsed";

/* nav.ts keeps a text glyph so it stays plain serialisable data. The design
   system draws icons as SVG, never as Unicode, so the shell swaps the glyph for
   a Lucide icon by route and only falls back to the glyph for a new module. */
const NAV_ICONS: Record<string, LucideIcon> = {
  "/internal/blog": PenLine,
  "/internal/social": Share2,
};

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
          {drawerOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </button>
        <div className="int-brand">
          <Link href="/internal" aria-label="GrooveSheet internal" className="int-brand-link">
            {/* Both wordmarks ship and internal.css shows the one that reads
                on the current theme: the white one on dark surfaces, the dark
                one on light. Inverting the white file with a filter also
                inverted the blue mark, which must stay blue. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/Logo_White.png"
              width={118}
              height={20}
              alt="GrooveSheet"
              className="int-logo int-logo--on-dark"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/Logo_Dark.png"
              width={118}
              height={20}
              alt=""
              aria-hidden="true"
              className="int-logo int-logo--on-light"
            />
          </Link>
          <span className="int-divider" />
          <nav className="int-crumbs" aria-label="Breadcrumb">
            {active === "/internal" ? (
              <span className="int-crumb-current">Internal</span>
            ) : (
              <>
                <Link href="/internal" className="int-crumb">
                  Internal
                </Link>
                <span className="int-crumb-sep">/</span>
                <span className="int-crumb-current">{moduleTitle}</span>
              </>
            )}
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
                  Sign Out
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
              <span className="int-nav-glyph">
                {collapsed ? (
                  <PanelLeftOpen size={16} aria-hidden="true" />
                ) : (
                  <PanelLeftClose size={16} aria-hidden="true" />
                )}
              </span>
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
  const Icon = NAV_ICONS[item.href];
  return (
    <Link
      href={item.href}
      className={`int-nav-item${isActive ? " is-active" : ""}`}
      title={item.label}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="int-nav-glyph">
        {Icon ? <Icon size={16} aria-hidden="true" /> : item.glyph}
      </span>
      <span className="int-nav-label">{item.label}</span>
      {badge ? <span className="int-nav-badge">{badge}</span> : null}
    </Link>
  );
}
