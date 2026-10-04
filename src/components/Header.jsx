import LanguageSwitcher from './LanguageSwitcher.jsx';
import { t } from '../data/translations.js';

export default function Header({ lang, onLangChange }) {
  return (
    <header className="site-header">
      <span className="studio-label">{t(lang, 'studioLabel')}</span>
      <LanguageSwitcher lang={lang} onChange={onLangChange} />
    </header>
  );
}
