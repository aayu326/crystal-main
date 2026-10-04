import { t } from '../data/translations.js';

export default function Footer({ lang }) {
  return (
    <footer className="site-footer">
      <span>{t(lang, 'footerLine')}</span>
      <span className="footer-links">
        <a href="#terms" onClick={(e) => e.preventDefault()}>
          {t(lang, 'terms')}
        </a>{' '}
        ·{' '}
        <a href="#privacy" onClick={(e) => e.preventDefault()}>
          {t(lang, 'privacy')}
        </a>
      </span>
    </footer>
  );
}
