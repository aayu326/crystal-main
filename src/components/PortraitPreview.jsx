import PortraitTemplate from './PortraitTemplate.jsx';

/** Static (non-interactive) render of the festive portrait template. */
export default function PortraitPreview({ img, transform, name, districtState, lang, displayWidth = 280 }) {
  return (
    <PortraitTemplate
      img={img}
      transform={transform}
      name={name}
      districtState={districtState}
      lang={lang}
      displayWidth={displayWidth}
    />
  );
}
