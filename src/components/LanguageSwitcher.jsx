import { useEffect, useRef, useState } from 'react';
import { LANGUAGES } from '../data/translations.js';

export default function LanguageSwitcher({ lang, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  function select(code) {
    onChange(code);
    setOpen(false);
  }

  return (
    <div className="language-switcher" ref={rootRef}>
      <button
        type="button"
        className="lang-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{current.label}</span>
        <svg
          className={`lang-dropdown-chevron ${open ? 'open' : ''}`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <ul className="lang-dropdown-menu" role="listbox" aria-label="Language">
          {LANGUAGES.map((l) => (
            <li key={l.code} role="option" aria-selected={lang === l.code}>
              <button
                type="button"
                className={`lang-dropdown-item ${lang === l.code ? 'active' : ''}`}
                onClick={() => select(l.code)}
              >
                {l.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}