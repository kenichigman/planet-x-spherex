// Locked-slate field data. Wavelengths were computed from each original
// frame's wavelength table (WCS-WAVE) at the target's pixel during field
// preparation and are stored with the field; nothing is read live.
export const HERO = {
  id: 'atlas-dec-pair',
  title: '3I/ATLAS: One Night in December',
  object: 'Comet 3I/ATLAS',
  epochs: [
    {
      label: 'Epoch A - 2025 Dec 14, 11:06 UTC',
      short: 'Epoch A',
      url: '/data/atlas_20251213_epochA_0741_4D6_cut.fits',
      lambdaUm: 4.533,
      snr: 14.5,
    },
    {
      label: 'Epoch B - 2025 Dec 14, 12:40 UTC',
      short: 'Epoch B',
      url: '/data/atlas_20251213_epochB_0755_2D6_cut.fits',
      lambdaUm: 4.602,
      snr: 21.2,
    },
  ],
  baseline: '94 minutes apart',
  deltaLambdaPct: 1.51,
  shiftPx: 42.27,
  // Shared linear display window for the hero tracked cutouts.
  scale: { scalemin: 0.06, scalemax: 0.58 },
}
