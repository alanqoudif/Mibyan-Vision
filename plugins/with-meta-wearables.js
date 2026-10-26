// Native setup for the Meta Wearables Device Access Toolkit (modules/mubayan-glasses).
// Info.plist keys follow Meta's getting-started guide; the embed phase is needed because the
// SDK ships as SPM binary frameworks pulled in through a pod. Don't turn on CocoaPods'
// deterministic UUIDs: same-named files (each library's codegen Props.cpp) get one UUID and
// only one is compiled, which fails the link.
const {
  withInfoPlist,
  withXcodeProject,
} = require('expo/config-plugins');

const FRAMEWORKS = ['MWDATCore', 'MWDATCamera'];
const EMBED_PHASE = 'Embed MWDAT Frameworks';

function addUnique(plist, key, ...values) {
  const list = plist[key] ?? [];
  for (const v of values) if (!list.includes(v)) list.push(v);
  plist[key] = list;
}

/** @type {import('expo/config-plugins').ConfigPlugin<{ urlScheme: string, metaAppId?: string, clientToken?: string }>} */
module.exports = function withMetaWearables(config, { urlScheme, metaAppId = '0', clientToken }) {
  config = withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;

    const types = plist.CFBundleURLTypes ?? [];
    if (!types.some((t) => t.CFBundleURLSchemes?.includes(urlScheme))) {
      types.push({ CFBundleURLSchemes: [urlScheme] });
    }
    plist.CFBundleURLTypes = types;

    // MetaAppID "0" = Developer Mode (no attestation). Set the real ID + client token from
    // the Wearables Developer Center before shipping to testers outside Developer Mode.
    plist.MWDAT = {
      AppLinkURLScheme: `${urlScheme}://`,
      MetaAppID: metaAppId,
      ...(clientToken ? { ClientToken: clientToken } : {}),
      TeamID: '$(DEVELOPMENT_TEAM)',
      Analytics: { OptOut: true },
    };

    addUnique(plist, 'LSApplicationQueriesSchemes', 'fb-viewapp');
    addUnique(plist, 'UIBackgroundModes', 'bluetooth-central', 'bluetooth-peripheral', 'external-accessory');
    addUnique(plist, 'UISupportedExternalAccessoryProtocols', 'com.meta.ar.wearable');
    addUnique(plist, 'NSBonjourServices', '_bonjour._tcp');
    plist.NSLocalNetworkUsageDescription ??= 'مبيان فيجن يتصل بالنظارة عبر الواي فاي عشان تنتقل الصور بسرعة.';
    plist.NSBluetoothAlwaysUsageDescription ??= 'مبيان فيجن يتصل بالنظارة عبر البلوتوث.';
    return cfg;
  });

  // CocoaPods links the SPM frameworks but doesn't embed them in the app bundle.
  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const phases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
    const exists = Object.values(phases).some(
      (p) => typeof p === 'object' && String(p.name ?? '').replace(/"/g, '') === EMBED_PHASE
    );
    if (exists) return cfg;

    const script = [
      `for fw in ${FRAMEWORKS.join(' ')}; do`,
      '  SRC="${BUILT_PRODUCTS_DIR}/${fw}.framework"',
      '  DST="${BUILT_PRODUCTS_DIR}/${FRAMEWORKS_FOLDER_PATH}/${fw}.framework"',
      '  if [ -d "$SRC" ]; then',
      '    mkdir -p "$(dirname "$DST")"',
      '    rm -rf "$DST" && cp -R "$SRC" "$DST"',
      '    if [ -n "${EXPANDED_CODE_SIGN_IDENTITY}" ]; then',
      '      codesign --force --sign "${EXPANDED_CODE_SIGN_IDENTITY}" --preserve-metadata=identifier,entitlements "$DST"',
      '    fi',
      '  fi',
      'done',
    ].join('\\n'); // pbxproj string escape, not a literal newline

    project.addBuildPhase([], 'PBXShellScriptBuildPhase', EMBED_PHASE, project.getFirstTarget().uuid, {
      shellPath: '/bin/sh',
      shellScript: script,
      inputPaths: FRAMEWORKS.map((fw) => `"\${BUILT_PRODUCTS_DIR}/${fw}.framework"`),
      outputPaths: FRAMEWORKS.map((fw) => `"\${BUILT_PRODUCTS_DIR}/\${FRAMEWORKS_FOLDER_PATH}/${fw}.framework"`),
    });
    return cfg;
  });

  return config;
};
