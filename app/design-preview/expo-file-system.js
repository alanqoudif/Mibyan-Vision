// Design-preview stub for web only (VISION_DESIGN_PREVIEW=1). Native builds never load this.
const mem = new Map();
// Seed settings from the URL so each screenshot can pick its state: ?lang=ar|en&welcome=1
if (typeof window !== 'undefined') {
  const q = new URLSearchParams(window.location.search);
  const lang = q.get('lang');
  mem.set('mem://doc/settings.json', JSON.stringify({
    ...(lang ? { languageMode: 'manual', lang } : {}),
    onboarded: q.get('welcome') !== '1',
    name: q.get('name') || '',
  }));
}
class File {
  constructor(...parts) { this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri || '')).join('/'); }
  get exists() { return mem.has(this.uri); }
  textSync() { return mem.get(this.uri) ?? ''; }
  async text() { return this.textSync(); }
  async base64() { return ''; }
  base64Sync() { return ''; }
  create() { mem.set(this.uri, ''); }
  write(v) { mem.set(this.uri, String(v)); }
  delete() { mem.delete(this.uri); }
  copy() {}
  move() {}
  get size() { return (mem.get(this.uri) || '').length; }
}
class Directory {
  constructor(...parts) { this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri || '')).join('/'); }
  get exists() { return true; }
  create() {}
  list() { return []; }
  delete() {}
}
const Paths = { document: { uri: 'mem://doc' }, cache: { uri: 'mem://cache' } };
module.exports = { File, Directory, Paths };
