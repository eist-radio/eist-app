const { withDangerousMod } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');
const fs = require('fs');
const path = require('path');

// React Native 0.79 bundles fmt 11.0.2, whose consteval format-string checking
// fails to compile under the Clang shipped with Xcode 26 (the iOS 26 SDK image
// the store profiles build against):
//
//   call to consteval function 'fmt::basic_format_string<...>' is not a
//   constant expression
//
// fmt's include/fmt/base.h selects consteval based on the compiler and, on
// Xcode 26's Clang (__cpp_consteval defined, Apple clang >= 14), forces
// FMT_USE_CONSTEVAL to 1. Crucially that block has NO `#ifndef FMT_USE_CONSTEVAL`
// guard, so a `-DFMT_USE_CONSTEVAL=0` preprocessor define is simply redefined
// away by the header itself -- which is why setting GCC_PREPROCESSOR_DEFINITIONS
// had no effect. The only reliable fix is to edit the header: append an
// `#undef`/`#define FMT_USE_CONSTEVAL 0` immediately before the `#if
// FMT_USE_CONSTEVAL` gate so FMT_CONSTEVAL expands to nothing and fmt falls back
// to runtime format-string checks.
//
// This runs in the Podfile post_install (not the Expo dangerous-mod) because the
// fmt pod sources are only downloaded into Pods/ during `pod install`, after
// prebuild has finished. The patch is idempotent via the marker comment.
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

/**
 * Expo config plugin: patch the iOS Podfile post_install to disable fmt's
 * consteval format-string checking (Xcode 26 / fmt 11.0.2 incompatibility).
 */
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
