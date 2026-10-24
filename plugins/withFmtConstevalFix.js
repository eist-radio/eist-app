const { withDangerousMod } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');
const fs = require('fs');
const path = require('path');

// RN 0.79's fmt 11.0.2 consteval checks fail under Xcode 26's Clang, and a -D define can't override them.
// Patch the fmt header in Podfile post_install (pods aren't downloaded at prebuild). Idempotent via a marker.
const FMT_FIX = `
    # [withFmtConstevalFix] Force fmt 11.0.2 to use runtime (not consteval)
    # format-string checks so it compiles under Xcode 26's Clang. base.h has no
    # #ifndef guard around FMT_USE_CONSTEVAL, so a -D define is ignored -- patch
    # the header to undef/redefine it to 0 right before the #if FMT_USE_CONSTEVAL.
    fmt_base = File.join(installer.sandbox.root.to_s, 'fmt', 'include', 'fmt', 'base.h')
    fmt_marker = '// [withFmtConstevalFix]'
    if File.exist?(fmt_base)
      fmt_contents = File.read(fmt_base)
      unless fmt_contents.include?(fmt_marker)
        patched = fmt_contents.sub(
          /^#if FMT_USE_CONSTEVAL\\n#  define FMT_CONSTEVAL consteval/,
          "#{fmt_marker} force runtime format-string checks (fmt 11.0.2 + Xcode 26 clang)\\n" \\
          "#undef FMT_USE_CONSTEVAL\\n#define FMT_USE_CONSTEVAL 0\\n" \\
          "#if FMT_USE_CONSTEVAL\\n#  define FMT_CONSTEVAL consteval"
        )
        if patched == fmt_contents
          Pod::UI.warn '[withFmtConstevalFix] could not locate FMT_USE_CONSTEVAL gate in fmt base.h; fmt may fail to compile under Xcode 26'
        else
          File.write(fmt_base, patched)
          Pod::UI.message '[withFmtConstevalFix] patched fmt base.h to disable consteval'
        end
      end
    else
      Pod::UI.warn "[withFmtConstevalFix] fmt base.h not found at #{fmt_base}; skipping consteval patch"
    end`;

/** Expo config plugin: disable fmt's consteval checks in Podfile post_install (Xcode 26 fix). */
function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );
      const contents = fs.readFileSync(podfilePath, 'utf8');

      const merged = mergeContents({
        tag: 'withFmtConstevalFix',
        src: contents,
        newSrc: FMT_FIX,
        anchor: /post_install do \|installer\|/,
        offset: 1,
        comment: '#',
      });

      if (merged.didMerge) {
        fs.writeFileSync(podfilePath, merged.contents);
      }

      return config;
    },
  ]);
}

module.exports = withFmtConstevalFix;
