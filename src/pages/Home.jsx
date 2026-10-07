import { useEffect, useRef, useState } from 'react';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import RegistrationForm from '../components/RegistrationForm.jsx';
import PhotoUploader from '../components/PhotoUploader.jsx';
import PhotoEditor, { DEFAULT_TRANSFORM } from '../components/PhotoEditor.jsx';
import PortraitTemplate from '../components/PortraitTemplate.jsx';
import LiveCounter from '../components/LiveCounter.jsx';
import ResultModal from '../components/ResultModal.jsx';
import { t } from '../data/translations.js';
import { getStateLabel } from '../data/indiaLocations.js';
import { validateForm, isFormValid } from '../utils/validation.js';

import {
  loadImage,
  fileToDataUrl,
  compressImage,
} from '../utils/imageUtils.js';

import { generatePortraitBlob } from '../services/portraitGenerator.js';
import { generateReferenceNumber } from '../services/referenceNumber.js';

import {
  saveSubmission,
  uploadGeneratedPoster,
} from '../services/supabase.js';

const INITIAL_FORM = {
  name: '',
  mobile: '',
  state: '',
  district: '',
  usedBefore: '',
  consent: false,
};

export default function Home() {
  const [lang, setLang] = useState('en');

  // 1 = Photo, 2 = Details
  const [currentStep, setCurrentStep] = useState(1);

  const [values, setValues] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});

  const [photoImg, setPhotoImg] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const photoUploaderRef = useRef(null);

  const [transform, setTransform] = useState({
    ...DEFAULT_TRANSFORM,
  });

  const [photoError, setPhotoError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [result, setResult] = useState(null);

  const tr = (key) => t(lang, key);

  const districtState =
    values.district && values.state
      ? `${values.district}, ${getStateLabel(values.state, lang)}`
      : '';

  /*
   * ---------------------------------------------------------
   * PHOTO SELECT
   * ---------------------------------------------------------
   */
  const handlePhotoSelected = async (file) => {
    setPhotoError('');
    setSubmitError('');

    try {
      console.log(
        'RAW IMAGE SIZE:',
        (file.size / 1024 / 1024).toFixed(2),
        'MB'
      );

      const compressedFile = await compressImage(file, {
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.82,
        type: 'image/jpeg',
      });

      console.log(
        'COMPRESSED IMAGE SIZE:',
        (compressedFile.size / 1024 / 1024).toFixed(2),
        'MB'
      );

      const dataUrl = await fileToDataUrl(compressedFile);
      const img = await loadImage(dataUrl);

      setPhotoFile(compressedFile);
      setPhotoImg(img);
      setTransform({ ...DEFAULT_TRANSFORM });
      setCurrentStep(1);
    } catch (error) {
      console.error('Compression failed:', error);
      setPhotoError(tr('errGenerate'));
    }
  };

  /*
   * ---------------------------------------------------------
   * RETAKE / REMOVE PHOTO
   * ---------------------------------------------------------
   */
  const handleRetake = () => {
    setPhotoImg(null);
    setPhotoFile(null);
    setTransform({ ...DEFAULT_TRANSFORM });
    setPhotoError('');
  };

  /*
   * ---------------------------------------------------------
   * STEP 1 -> STEP 2
   * ---------------------------------------------------------
   */
  const handleContinueToDetails = () => {
    if (!photoImg) {
      setPhotoError(tr('errPhoto'));
      return;
    }

    setPhotoError('');
    setSubmitError('');
    setCurrentStep(2);
  };

  /*
   * ---------------------------------------------------------
   * STEP 2 -> STEP 1
   * ---------------------------------------------------------
   */
  const handleBackToPhoto = () => {
    setErrors({});
    setSubmitError('');
    setCurrentStep(1);
  };

  /*
   * ---------------------------------------------------------
   * FINAL SUBMIT / GENERATE POSTER
   * ---------------------------------------------------------
   */
  const handleSubmit = async () => {
    const formErrors = validateForm(values, tr);

    setErrors(formErrors);
    setSubmitError('');

    if (
      Object.keys(formErrors).length > 0 ||
      !photoImg ||
      !isFormValid(values)
    ) {
      return;
    }

    setSubmitting(true);

    let imageUrl = null;

    try {
      const refNo = await generateReferenceNumber();

      const { blob: portraitBlob } = await generatePortraitBlob({
        img: photoImg,
        transform,
        name: values.name.trim(),
        districtState,
        lang,
      });

      imageUrl = URL.createObjectURL(portraitBlob);

      /*
       * -----------------------------------------------------
       * SUPABASE PERSISTENCE
       * -----------------------------------------------------
       */
      try {
        const posterPath = `${refNo}.jpg`;

        const posterUrl = await uploadGeneratedPoster(
          portraitBlob,
          posterPath
        );

await saveSubmission({
  name: values.name.trim(),
  phone: values.mobile,
  email: null,

  state: values.state,
  district: values.district,

  // Keep city for backward compatibility
  city: values.district,

  language: lang,
  template_id: 'diwali-jivora-2026',

  generated_poster_path: posterPath,
  poster_url: posterUrl,

  status: 'completed',
});
      } catch (error) {
        console.error('Supabase save failed:', error);
        setSubmitError(tr('errNetwork'));
      }

      /*
       * -----------------------------------------------------
       * SHOW RESULT
       * -----------------------------------------------------
       */
      setResult({
        refNo,
        imageUrl,
        name: values.name.trim(),
      });

      /*
       * -----------------------------------------------------
       * IMPORTANT:
       * RESET FORM + PHOTO AFTER GENERATION
       *
       * We keep imageUrl because ResultModal still needs
       * to display the generated poster.
       * -----------------------------------------------------
       */
      setValues({ ...INITIAL_FORM });
      setErrors({});
      setPhotoImg(null);
      setPhotoFile(null);
      setTransform({ ...DEFAULT_TRANSFORM });
      setPhotoError('');

      /*
       * New portrait starts from Step 1 once result modal
       * is closed / Create Another is clicked.
       */
      setCurrentStep(1);
    } catch (error) {
      console.error('Poster generation failed:', error);

      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }

      setSubmitError(tr('errGenerate'));
    } finally {
      setSubmitting(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * CLOSE RESULT
   * ---------------------------------------------------------
   */
  const handleCloseResult = () => {
    if (result?.imageUrl) {
      URL.revokeObjectURL(result.imageUrl);
    }

    setResult(null);
    setCurrentStep(1);
    setSubmitError('');
  };

  /*
   * ---------------------------------------------------------
   * CREATE ANOTHER PORTRAIT
   * ---------------------------------------------------------
   */
  const handleMakeAnother = () => {
    if (result?.imageUrl) {
      URL.revokeObjectURL(result.imageUrl);
    }

    setResult(null);

    setValues({ ...INITIAL_FORM });
    setErrors({});

    setPhotoImg(null);
    setPhotoFile(null);
    setTransform({ ...DEFAULT_TRANSFORM });

    setPhotoError('');
    setSubmitError('');
    setSubmitting(false);

    setCurrentStep(1);
  };

  /*
   * Cleanup generated object URL if component unmounts.
   */
  useEffect(() => {
    return () => {
      if (result?.imageUrl) {
        URL.revokeObjectURL(result.imageUrl);
      }
    };
  }, [result?.imageUrl]);
  const [introText, stepsBlock = ''] = tr('subheadline').split('\n\n');
const stepLines = stepsBlock.split('\n');
const stepsTitle = stepLines[0];
const stepItems = stepLines
  .slice(1)
  .map((l) => l.replace(/^\d+\.\s*/, ''));
const stepIcons = ['📸', '⬇️', '📲'];

  return (
    <div className="page">
      <Header
        lang={lang}
        onLangChange={setLang}
      />

      <main className="hero campaign-flow">
        <section className="hero-copy">
          <p className="eyebrow">
            {tr('campaignTag')}
          </p>

          <p className="from-line">
            {tr('fromCrystal')}
          </p>

          <h1>
            {tr('headline')}
          </h1>

<p className="subhead">{introText}</p>

{stepItems.length > 0 && (
  <div className="how-steps">
    <p className="how-title">{stepsTitle}</p>
    <ul className="how-list">
      {stepItems.map((text, i) => (
        <li key={i} className="how-item">
          <span className="how-icon">{stepIcons[i]}</span>
          <span className="how-num">{i + 1}</span>
          <span className="how-text">{text}</span>
        </li>
      ))}
    </ul>
  </div>
)}

          <LiveCounter lang={lang} />

          {/* =================================================
              STEP 1 — PHOTO
              ================================================= */}
          {currentStep === 1 && (
            <div className="portrait-card step-card">
              <div className="step-progress">
                <span className="step-progress-active">
                  1
                </span>

                <span className="step-progress-line" />

                <span className="step-progress-inactive">
                  2
                </span>
              </div>

              <p className="step-label">
                STEP 1 OF 2
              </p>

              <h2 className="portrait-card-title">
                {tr('yourPortrait')}
              </h2>

              {!photoImg ? (
<div className="portrait-empty-wrap">
  <button
    type="button"
    className="portrait-camera-trigger"
    onClick={() => photoUploaderRef.current?.openCamera()}
    aria-label="Open camera"
  >
  <PortraitTemplate
  img={null}
  transform={transform}
  lang={lang}
  displayWidth={280}
/>

    <div className="upload-overlay">
      <p>{tr('addPhoto')}</p>

      <p className="upload-hint">
        {tr('tapToAdd')}
      </p>
    </div>
  </button>

  <PhotoUploader
    ref={photoUploaderRef}
    lang={lang}
    onFileSelected={handlePhotoSelected}
    onError={setPhotoError}
  />
</div>
              ) : (
                <div className="portrait-editor-wrap">
                  <PhotoEditor
                    img={photoImg}
                    transform={transform}
                    onTransformChange={setTransform}
                    name=""
                    districtState=""
                    lang={lang}
                    onRetake={handleRetake}
                    displayWidth={300}
                  />
                </div>
              )}

              {photoError && (
                <p className="field-error center">
                  {photoError}
                </p>
              )}

              {photoImg && (
                <button
                  type="button"
                  className="primary-btn step-next-btn"
                  onClick={handleContinueToDetails}
                >
                  Continue →
                </button>
              )}
            </div>
          )}

          {/* =================================================
              STEP 2 — DETAILS
              ================================================= */}
          {currentStep === 2 && (
            <div className="form-card step-form-card">
              <div className="step-progress">
                <span className="step-progress-complete">
                  ✓
                </span>

                <span className="step-progress-line complete" />

                <span className="step-progress-active">
                  2
                </span>
              </div>

              <p className="step-label">
                STEP 2 OF 2
              </p>

              <h2 className="details-title">
                Tell us about yourself
              </h2>

              <RegistrationForm
                lang={lang}
                values={values}
                errors={errors}
                onChange={setValues}
                onSubmit={handleSubmit}
                submitting={submitting}
                onBack={handleBackToPhoto}
              />

              {submitError && (
                <p className="field-error center">
                  {submitError}
                </p>
              )}
            </div>
          )}
        </section>
      </main>

      <Footer lang={lang} />

      {/* =====================================================
          RESULT
          ===================================================== */}
      {result && (
        <ResultModal
          lang={lang}
          name={result.name}
          refNo={result.refNo}
          imageUrl={result.imageUrl}
          onClose={handleCloseResult}
          onMakeAnother={handleMakeAnother}
        />
      )}
    </div>
  );
}