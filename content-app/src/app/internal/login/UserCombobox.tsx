"use client";

/* Username field with suggestions: click to see the names, type to narrow.

   The list is EDITORS, the bylines from pipeline.config.json, NOT the keys of
   INTERNAL_USERS. Those keys are the real account names, and this page is the
   one route that serves without a session, so publishing them would hand an
   attacker half of every credential. _lib/auth.ts goes to the trouble of
   running the KDF for unknown users so a failed sign in cannot be timed to
   tell real names from invented ones; listing them here would undo that.

   So the field stays a free text input: the suggestions are a convenience,
   and a username that is not a byline is typed in full and works. */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Editor } from "../_lib/editors";

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: Editor[];
};

export default function UserCombobox({ value, onChange, options }: Props) {
  const [open, setOpen] = useState(false);
  /* -1 means "nothing highlighted": Enter then submits the form with whatever
     has been typed, rather than silently choosing the first suggestion. */
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);
  const listId = useId();

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.id.toLowerCase().includes(q) || o.name.toLowerCase().includes(q)
    );
  }, [options, value]);

  /* Pointerdown rather than click: a click that lands outside closes the list
     before the button under it fires, which is the behaviour people expect. */
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function choose(option: Editor) {
    onChange(option.id);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(e.key === "ArrowDown" ? 0 : matches.length - 1);
        return;
      }
      if (!matches.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + matches.length) % matches.length);
      return;
    }
    if (e.key === "Enter" && open && active >= 0 && matches[active]) {
      // Take the highlighted suggestion instead of submitting the form.
      e.preventDefault();
      choose(matches[active]);
      return;
    }
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
      return;
    }
    if (e.key === "Tab") setOpen(false);
  }

  const activeId = active >= 0 && matches[active] ? `${listId}-${matches[active].id}` : undefined;

  return (
    <div className="int-combo" ref={wrap}>
      <input
        className="gs-input int-combo-input"
        name="user"
        autoComplete="username"
        placeholder="Username"
        value={value}
        required
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="int-combo-toggle"
        tabIndex={-1}
        aria-label={open ? "Hide names" : "Show names"}
        onClick={() => setOpen((v) => !v)}
      />
      {open && matches.length > 0 ? (
        <ul className="int-combo-list" id={listId} role="listbox">
          {matches.map((o, i) => (
            <li
              key={o.id}
              id={`${listId}-${o.id}`}
              role="option"
              aria-selected={o.id === value}
              className={`int-combo-option${i === active ? " is-active" : ""}`}
              /* Mousedown, not click: the input's blur would otherwise close
                 the list before the click landed. */
              onPointerDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
              onPointerEnter={() => setActive(i)}
            >
              <span className="int-combo-name">{o.name}</span>
              <span className="int-combo-id">{o.id}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
