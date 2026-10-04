import { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { fetchAdminData, subscribeToRealtimeUpdates } from '../services/supabase.js';
import { getStateOptions, getStateLabel } from '../data/indiaLocations.js';
import { LANGUAGES, t } from '../data/translations.js';

const ADMIN_PASSCODE = import.meta.env.VITE_ADMIN_PASSCODE || 'crystal2026';
const SESSION_KEY = 'crystal_diwali_admin_unlocked';
const PAGE_SIZE = 15;

function toCsvValue(v) {
  const str = String(v ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function downloadCsv(rows) {
  const header = ['Ref No', 'Name', 'Mobile', 'State', 'District', 'Used Before', 'Language', 'Created At'];
  const lines = [header.join(',')];
  rows.forEach((r) => {
    lines.push(
      [
        r.ref_no || '',
        r.name,
        r.mobile,
        getStateLabel(r.state, 'en'),
        r.district,
        r.used_crystal_products ? 'Yes' : 'No',
        r.language,
        r.created_at,
      ]
        .map(toCsvValue)
        .join(',')
    );
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `crystal-diwali-registrations-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
async function downloadGeneratedImages(portraits, setProgress) {
  const images = portraits.filter((p) => p.generated_image_url);

  if (!images.length) {
    alert('No generated images available to export.');
    return;
  }

  const zip = new JSZip();
  const folder = zip.folder('generated');

  try {
    for (let i = 0; i < images.length; i++) {
      const portrait = images[i];

      setProgress(`Downloading ${i + 1} / ${images.length}`);

      const response = await fetch(portrait.generated_image_url);

      if (!response.ok) {
        throw new Error(`Failed to download image ${i + 1}`);
      }

      const blob = await response.blob();

      const refNo = portrait.ref_no || `portrait-${i + 1}`;
      folder.file(`${refNo}.jpg`, blob);
    }

    setProgress('Creating ZIP...');

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'STORE',
    });

    const url = URL.createObjectURL(zipBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `crystal-diwali-generated-images-${Date.now()}.zip`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    setProgress('');
  } catch (error) {
    console.error('Generated image export failed:', error);
    setProgress('');
    alert('Export failed. Please try again.');
  }
}
async function downloadPortrait(imageUrl, refNo, name) {
  if (!imageUrl) return;

  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error('Failed to fetch image');
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const safeName = (name || 'user')
      .replace(/[^a-z0-9]/gi, '-')
      .replace(/-+/g, '-')
      .toLowerCase();

    const fileName = `crystal-diwali-${refNo || safeName}.png`;

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download failed:', error);
    alert('Image download failed. Please try again.');
  }
}
function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export default function Admin() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');
  const [passcode, setPasscode] = useState('');
  const [passError, setPassError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [registrations, setRegistrations] = useState([]);
  const [portraits, setPortraits] = useState([]);
  const [isMock, setIsMock] = useState(false);
  const [exportingImages, setExportingImages] = useState(false);
const [exportProgress, setExportProgress] = useState('');

  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [langFilter, setLangFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [page, setPage] = useState(1);
  const lang = 'en';
  const tr = (key) => t(lang, key);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await fetchAdminData();
      setRegistrations(data.registrations);
      setPortraits(data.portraits);
      setIsMock(data.mock);
    } catch {
      setLoadError('Could not load dashboard data. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!unlocked) return;
    load();
    const unsubscribe = subscribeToRealtimeUpdates(load);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  const handleUnlock = (e) => {
    e.preventDefault();
    if (passcode === ADMIN_PASSCODE) {
      sessionStorage.setItem(SESSION_KEY, '1');
      setUnlocked(true);
      setPassError('');
    } else {
      setPassError(tr('adminWrongCode'));
    }
  };

  const handleLock = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setUnlocked(false);
  };

  const portraitsByReg = useMemo(() => {
    const map = new Map();
    portraits.forEach((p) => map.set(p.registration_id, p));
    return map;
  }, [portraits]);

  const filtered = useMemo(() => {
    return registrations.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        if (!r.name?.toLowerCase().includes(q) && !r.mobile?.includes(q)) return false;
      }
      if (stateFilter && r.state !== stateFilter) return false;
      if (districtFilter && r.district !== districtFilter) return false;
      if (langFilter && r.language !== langFilter) return false;
      if (productFilter === 'yes' && !r.used_crystal_products) return false;
      if (productFilter === 'no' && r.used_crystal_products) return false;
      return true;
    });
  }, [registrations, search, stateFilter, districtFilter, langFilter, productFilter]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const stats = useMemo(
    () => ({
      totalReg: registrations.length,
      totalPortraits: portraits.length,
      todayReg: registrations.filter((r) => isToday(r.created_at)).length,
      todayPortraits: portraits.filter((p) => isToday(p.created_at)).length,
    }),
    [registrations, portraits]
  );

  const stateBreakdown = useMemo(() => {
    const counts = {};
    registrations.forEach((r) => {
      counts[r.state] = (counts[r.state] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([code, count]) => ({ code, label: getStateLabel(code, 'en'), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [registrations]);

  if (!unlocked) {
    return (
      <div className="admin-lock-screen">
        <form className="admin-lock-card" onSubmit={handleUnlock}>
          <h1>{tr('adminTitle')}</h1>
          <p>{tr('adminLocked')}</p>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder={tr('adminPasscodePh')}
            autoFocus
          />
          {passError && <p className="field-error">{passError}</p>}
          <button type="submit" className="primary-btn">
            {tr('adminUnlock')}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>{tr('adminTitle')}</h1>
        <div className="admin-header-actions">
          {isMock && <span className="mock-badge">Local demo data (Supabase not connected)</span>}
          <button type="button" className="text-btn" onClick={handleLock}>
            {tr('logout')}
          </button>
        </div>
      </header>

      {loadError && <p className="field-error center">{loadError}</p>}

      <section className="stat-grid">
        <div className="stat-card">
          <span className="stat-value">{stats.totalReg}</span>
          <span className="stat-label">{tr('totalReg')}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.totalPortraits}</span>
          <span className="stat-label">{tr('totalPortraits')}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.todayReg}</span>
          <span className="stat-label">{tr('todayReg')}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.todayPortraits}</span>
          <span className="stat-label">{tr('todayPortraits')}</span>
        </div>
      </section>

      {stateBreakdown.length > 0 && (
        <section className="state-breakdown">
          {stateBreakdown.map((s) => (
            <div key={s.code} className="state-bar-row">
              <span className="state-bar-label">{s.label}</span>
              <div className="state-bar-track">
                <div
                  className="state-bar-fill"
                  style={{ width: `${(s.count / stateBreakdown[0].count) * 100}%` }}
                />
              </div>
              <span className="state-bar-count">{s.count}</span>
            </div>
          ))}
        </section>
      )}

      <section className="admin-toolbar">
        <input
          type="search"
          placeholder={tr('searchPh')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setDistrictFilter(''); setPage(1); }}>
          <option value="">{tr('allStates')}</option>
          {getStateOptions('en').map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>
        <select value={langFilter} onChange={(e) => { setLangFilter(e.target.value); setPage(1); }}>
          <option value="">{tr('allLanguages')}</option>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <select value={productFilter} onChange={(e) => { setProductFilter(e.target.value); setPage(1); }}>
          <option value="">{tr('allProducts')}</option>
          <option value="yes">{tr('yes')}</option>
          <option value="no">{tr('no')}</option>
        </select>
        <button type="button" className="secondary-btn" onClick={() => downloadCsv(filtered)}>
          {tr('exportCsv')}
        </button>
        <button
  type="button"
  className="secondary-btn"
  disabled={exportingImages}
  onClick={async () => {
    setExportingImages(true);

    try {
      await downloadGeneratedImages(
        portraits,
        setExportProgress
      );
    } finally {
      setExportingImages(false);
    }
  }}
>
  {exportingImages ? exportProgress || 'Exporting...' : 'Export Generated Images'}
</button>
      </section>

      <section className="admin-table-wrap">
        {loading ? (
          <p className="admin-loading">Loading…</p>
        ) : paged.length === 0 ? (
          <p className="admin-loading">{tr('noResults')}</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Portrait</th>
                <th>Name</th>
                <th>Mobile</th>
                <th>State / District</th>
                <th>Used before</th>
                <th>Lang</th>
                <th>Ref No</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => {
                const portrait = portraitsByReg.get(r.id);
                return (
<tr key={r.id}>
  <td>
    {portrait?.generated_image_url ? (
      <div className="portrait-cell">
        <img
          className="admin-thumb"
          src={portrait.generated_image_url}
          alt="Generated portrait"
        />

        <button
          type="button"
          className="download-btn"
          onClick={() =>
            downloadPortrait(
              portrait.generated_image_url,
              portrait.ref_no,
              r.name
            )
          }
        >
          Download
        </button>
      </div>
    ) : (
      <span className="admin-thumb placeholder" />
    )}
  </td>

  <td>{r.name}</td>

  <td>{r.mobile}</td>

  <td>
    {r.district}, {getStateLabel(r.state, 'en')}
  </td>

  <td>
    {r.used_crystal_products ? tr('yes') : tr('no')}
  </td>

  <td>{r.language}</td>

  <td>{portrait?.ref_no || '—'}</td>

  <td>
    {r.created_at
      ? new Date(r.created_at).toLocaleString()
      : '—'}
  </td>
</tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {totalPages > 1 && (
        <div className="pagination">
          <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            ‹ Prev
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
            Next ›
          </button>
        </div>
      )}
    </div>
  );
}
