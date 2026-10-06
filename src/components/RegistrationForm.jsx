import { getStateOptions, getDistrictOptions } from '../data/indiaLocations.js';
import { t } from '../data/translations.js';

export default function RegistrationForm({
  lang,
  values,
  errors,
  onChange,
  onSubmit,
  submitting,
}) {
  const tr = (key) => t(lang, key);

  const stateOptions = getStateOptions(lang);

  const districtOptions = values.state
    ? getDistrictOptions(values.state, lang)
    : [];

  const set = (field, value) => {
    onChange({
      ...values,
      [field]: value,
    });
  };

  return (
    <form
      className="registration-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      noValidate
    >
      {/* NAME */}

      <div className="field">
        <label htmlFor="name">
          {tr('formName')}
        </label>

        <input
          id="name"
          type="text"
          autoComplete="name"
          value={values.name}
          onChange={(e) =>
            set('name', e.target.value)
          }
          placeholder={tr('formNamePh')}
          aria-invalid={!!errors.name}
        />

        {errors.name && (
          <span className="field-error">
            {errors.name}
          </span>
        )}
      </div>

      {/* MOBILE */}

      <div className="field">
        <label htmlFor="mobile">
          {tr('formMobile')}
        </label>

        <div className="mobile-row">
          <span className="mobile-prefix">
            +91
          </span>

          <input
            id="mobile"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            value={values.mobile}
            onChange={(e) =>
              set(
                'mobile',
                e.target.value
                  .replace(/\D/g, '')
                  .slice(0, 10)
              )
            }
            placeholder={tr('formMobilePh')}
            aria-invalid={!!errors.mobile}
          />
        </div>

        {errors.mobile && (
          <span className="field-error">
            {errors.mobile}
          </span>
        )}
      </div>

      {/* STATE + DISTRICT */}

      <div className="field-row">
        <div className="field">
          <label htmlFor="state">
            {tr('formState')}
          </label>

          <select
            id="state"
            value={values.state}
            onChange={(e) =>
              onChange({
                ...values,
                state: e.target.value,
                district: '',
              })
            }
            aria-invalid={!!errors.state}
          >
            <option value="">
              {tr('formStatePh')}
            </option>

            {stateOptions.map((state) => (
              <option
                key={state.code}
                value={state.code}
              >
                {state.label}
              </option>
            ))}
          </select>

          {errors.state && (
            <span className="field-error">
              {errors.state}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="district">
            {tr('formDistrict')}
          </label>

          <select
            id="district"
            value={values.district}
            onChange={(e) =>
              set(
                'district',
                e.target.value
              )
            }
            disabled={!values.state}
            aria-invalid={!!errors.district}
          >
            <option value="">
              {tr('formDistrictPh') ||
                'Select district'}
            </option>

            {districtOptions.map((district) => (
              <option
                key={district.code}
                value={district.label}
              >
                {district.label}
              </option>
            ))}
          </select>

          {errors.district && (
            <span className="field-error">
              {errors.district}
            </span>
          )}
        </div>
      </div>

      {/* USED BEFORE */}

      <div className="field">
        <label>
          {tr('usedBefore')}
        </label>

        <div className="toggle-row">
          <button
            type="button"
            className={`toggle-btn ${
              values.usedBefore === 'yes'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              set(
                'usedBefore',
                'yes'
              )
            }
          >
            {tr('yes')}
          </button>

          <button
            type="button"
            className={`toggle-btn ${
              values.usedBefore === 'no'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              set(
                'usedBefore',
                'no'
              )
            }
          >
            {tr('no')}
          </button>
        </div>

        {errors.usedBefore && (
          <span className="field-error">
            {errors.usedBefore}
          </span>
        )}
      </div>

      {/* CONSENT */}

      <label className="consent-row">
        <input
          type="checkbox"
          checked={values.consent}
          onChange={(e) =>
            set(
              'consent',
              e.target.checked
            )
          }
        />

        <span>
          {tr('consent')}{' '}

          <a
            href="#terms"
            onClick={(e) =>
              e.preventDefault()
            }
          >
            {tr('terms')}
          </a>

          {' · '}

          <a
            href="#privacy"
            onClick={(e) =>
              e.preventDefault()
            }
          >
            {tr('privacy')}
          </a>
        </span>
      </label>

      {errors.consent && (
        <span className="field-error">
          {errors.consent}
        </span>
      )}

      {/* SUBMIT */}

      <button
        type="submit"
        className="primary-btn"
        disabled={submitting}
      >
        {submitting
          ? tr('submitting')
          : tr('submit')}
      </button>

      <p className="privacy-note">
        🔒 {tr('privacyNote')}
      </p>
    </form>
  );
}