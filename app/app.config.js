// app.json stays the source of truth. Design preview only (VISION_DESIGN_PREVIEW=1): render the
// web build client-side, because server rendering touches native-only storage. Unset, this is a no-op.
module.exports = ({ config }) =>
  process.env.VISION_DESIGN_PREVIEW === '1' ? { ...config, web: { ...config.web, output: 'single' } } : config;
