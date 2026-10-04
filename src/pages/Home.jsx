import { useState } from 'react';
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
import { saveRegistration, savePortrait, uploadOriginalPhoto, uploadGeneratedPortrait } from '../services/supabase.js';

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

  const [values, setValues] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [photoImg, setPhotoImg] = useState(null); // HTMLImageElement
  const [photoFile, setPhotoFile] = useState(null); // original File (for upload)
  const [transform, setTransform] = useState({ ...DEFAULT_TRANSFORM });
  const [photoError, setPhotoError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState(null); // { refNo, imageUrl, name }

  const tr = (key) => t(lang, key);
  const districtState = values.district && values.state ? `${values.district}, ${getStateLabel(values.state, lang)}` : '';

const handlePhotoSelected = async (file) => {
  setPhotoError('');

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
  } catch (error) {
    console.error('Compression failed:', error);
    setPhotoError(tr('errGenerate'));
  }
};

  const handleRetake = () => {
    setPhotoImg(null);
    setPhotoFile(null);
    setTransform({ ...DEFAULT_TRANSFORM });
  };

  const handleSubmit = async () => {
    const formErrors = validateForm(values, tr);
    setErrors(formErrors);

    if (!photoImg) {
      setPhotoError(tr('errPhoto'));
    } else {
      setPhotoError('');
    }

    if (Object.keys(formErrors).length > 0 || !photoImg || !isFormValid(values)) {
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const refNo = await generateReferenceNumber();

      const { blob: portraitBlob } = await generatePortraitBlob({
        img: photoImg,
        transform,
        name: values.name.trim(),
        districtState,
        lang,
      });

      const imageUrl = URL.createObjectURL(portraitBlob);

      // Best-effort persistence — the user still gets their portrait even if
      // the network/database step fails (see errNetwork messaging).
      let registrationId = null;
      try {
        const originalPhotoUrl = photoFile
          ? await uploadOriginalPhoto(photoFile, `${refNo}/original-${Date.now()}.jpg`)
          : null;
const { id } = await saveRegistration({
  name: values.name.trim(),
  mobile: values.mobile,
  state: values.state,
  district: values.district,
  used_crystal_products: values.usedBefore === 'yes',
  consent: values.consent,
  language: lang,
  created_at: new Date().toISOString(),
});
        registrationId = id;

const generatedImageUrl = await uploadGeneratedPortrait(
  portraitBlob,
  `${refNo}.jpg`
);

        await savePortrait({
          registration_id: registrationId,
          ref_no: refNo,
          original_photo_url: originalPhotoUrl,
          generated_image_url: generatedImageUrl,
          template_id: 'diwali-jivora-2026',
          created_at: new Date().toISOString(),
        });
      } catch {
        setSubmitError(tr('errNetwork'));
      }

      setResult({ refNo, imageUrl, name: values.name.trim() });
    } catch {
      setSubmitError(tr('errGenerate'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleMakeAnother = () => {
    setResult(null);
    setValues(INITIAL_FORM);
    setErrors({});
    handleRetake();
    setSubmitError('');
  };

  return (
    <div className="page">
      <Header lang={lang} onLangChange={setLang} />

      <main className="hero">
        <section className="hero-copy">
          <p className="eyebrow">{tr('campaignTag')}</p>
          <p className="from-line">{tr('fromCrystal')}</p>
          <h1>{tr('headline')}</h1>
          <p className="subhead">{tr('subheadline')}</p>
          <LiveCounter lang={lang} />

          <div className="portrait-card">
            <p className="step-label">{tr('stepLabel')}</p>
            <h2 className="portrait-card-title">{tr('yourPortrait')}</h2>

            {!photoImg ? (
              <div className="portrait-empty-wrap">
                <PortraitTemplate img={null} transform={transform} lang={lang} displayWidth={320} />
                <div className="upload-overlay">
                  <p>{tr('addPhoto')}</p>
                  <p className="upload-hint">{tr('tapToAdd')}</p>
                  <PhotoUploader lang={lang} onFileSelected={handlePhotoSelected} onError={setPhotoError} />
                </div>
              </div>
            ) : (
              <div className="portrait-editor-wrap">
                <PhotoEditor
                  img={photoImg}
                  transform={transform}
                  onTransformChange={setTransform}
                  name={values.name.trim()}
                  districtState={districtState}
                  lang={lang}
                  onRetake={handleRetake}
                  displayWidth={320}
                />
              </div>
            )}
            {photoError && <p className="field-error center">{photoError}</p>}
          </div>
        </section>

        <section className="form-card">
          <RegistrationForm
            lang={lang}
            values={values}
            errors={errors}
            onChange={setValues}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
          {submitError && <p className="field-error center">{submitError}</p>}
        </section>
      </main>

      <Footer lang={lang} />

      {result && (
        <ResultModal
          lang={lang}
          name={result.name}
          refNo={result.refNo}
          imageUrl={result.imageUrl}
          onClose={() => setResult(null)}
          onMakeAnother={handleMakeAnother}
        />
      )}
    </div>
  );
}
