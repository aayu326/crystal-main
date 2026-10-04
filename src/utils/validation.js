export const MOBILE_REGEX = /^[6-9]\d{9}$/;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * Validates the registration form. Returns an object keyed by field name
 * containing translated error strings; a field is valid when absent.
 */
export function validateForm(values, tr) {
  const errors = {};

  if (!values.name || !values.name.trim()) {
    errors.name = tr('errName');
  } else if (values.name.trim().length < 2) {
    errors.name = tr('errNameShort');
  }

  if (!MOBILE_REGEX.test(values.mobile || '')) {
    errors.mobile = tr('errMobile');
  }

  if (!values.state) {
    errors.state = tr('errState');
  }

  if (!values.district) {
    errors.district = tr('errDistrict');
  }

  if (values.usedBefore !== 'yes' && values.usedBefore !== 'no') {
    errors.usedBefore = tr('errUsed');
  }

  if (!values.consent) {
    errors.consent = tr('errConsent');
  }

  return errors;
}

export function validatePhotoFile(file, tr) {
  if (!file) return tr('errPhoto');
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) return tr('errPhotoType');
  if (file.size > MAX_PHOTO_BYTES) return tr('errPhotoSize');
  return null;
}

export function isFormValid(values) {
  return (
    values.name?.trim().length >= 2 &&
    MOBILE_REGEX.test(values.mobile || '') &&
    !!values.state &&
    !!values.district &&
    (values.usedBefore === 'yes' || values.usedBefore === 'no') &&
    !!values.consent
  );
}
