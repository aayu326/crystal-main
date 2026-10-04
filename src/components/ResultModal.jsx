import { t } from '../data/translations.js';

export default function ResultModal({ lang, name, refNo, imageUrl, onClose, onMakeAnother }) {
  const tr = (key) => t(lang, key);
  const fileName = `Crystal-Diwali-${refNo}.png`;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleShare = async () => {
    try {
      if (navigator.canShare && imageUrl.startsWith('blob:')) {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const file = new File([blob], fileName, { type: blob.type || 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Happy Diwali', text: tr('resultReady') });
          return;
        }
      }
    } catch {
      // fall through to WhatsApp link fallback
    }
    const waText = encodeURIComponent(`${tr('thankYou')}! ${tr('resultReady')}`);
    window.open(`https://wa.me/?text=${waText}`, '_blank', 'noopener');
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <button type="button" className="modal-close" onClick={onClose} aria-label={tr('close')}>
          ×
        </button>
        <div className="modal-check">✓</div>
        <h2>
          {tr('thankYou')}, {name}!
        </h2>
        <p className="modal-copy">{tr('resultReady')}</p>

        <div className="modal-image-frame">
          <img src={imageUrl} alt="Generated festive portrait" />
        </div>
        <p className="ref-no">
          {tr('refNo')} <strong>{refNo}</strong>
        </p>

        <div className="modal-actions">
          <button type="button" className="primary-btn success" onClick={handleDownload}>
            ⬇ {tr('download')}
          </button>
          <button type="button" className="primary-btn whatsapp" onClick={handleShare}>
            ↗ {tr('share')}
          </button>
        </div>

        <button type="button" className="text-btn" onClick={onMakeAnother}>
          {tr('makeAnother')}
        </button>
      </div>
    </div>
  );
}
