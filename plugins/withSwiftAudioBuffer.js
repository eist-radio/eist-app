const { withDangerousMod } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');
const fs = require('fs');
const path = require('path');

// SwiftAudioEx 1.1.0 couples bufferDuration and automaticallyWaitsToMinimizeStalling, so you can't have both.
// This decouples them in AudioPlayer.swift during Podfile post_install (pods don't exist at prebuild).
const BUFFER_FIX = `
    # [withSwiftAudioBuffer] Let SwiftAudioEx keep a forward buffer with stall waiting on.
    sae_file = File.join(installer.sandbox.root.to_s, 'SwiftAudioEx', 'Sources', 'SwiftAudioEx', 'AudioPlayer.swift')
    sae_marker = '// [withSwiftAudioBuffer]'
    if File.exist?(sae_file)
      sae_contents = File.read(sae_file, encoding: 'UTF-8')
      unless sae_contents.include?(sae_marker)
        patched = sae_contents
          .sub(
            "wrapper.bufferDuration = newValue\\n            wrapper.automaticallyWaitsToMinimizeStalling = wrapper.bufferDuration == 0",
            "wrapper.bufferDuration = newValue #{sae_marker} stall waiting left as is"
          )
          .sub(
            "if (newValue) {\\n                wrapper.bufferDuration = 0\\n            }\\n            wrapper.automaticallyWaitsToMinimizeStalling = newValue",
            "wrapper.automaticallyWaitsToMinimizeStalling = newValue #{sae_marker} buffer left as is"
          )
        if patched.scan(sae_marker).length != 2
          Pod::UI.warn '[withSwiftAudioBuffer] AudioPlayer.swift did not match SwiftAudioEx 1.1.0; iOS forward buffer not applied'
        else
          File.chmod(0644, sae_file)
          File.write(sae_file, patched)
          Pod::UI.message '[withSwiftAudioBuffer] patched SwiftAudioEx AudioPlayer.swift'
        end
      end
    else
      Pod::UI.warn "[withSwiftAudioBuffer] #{sae_file} not found; iOS forward buffer not applied"
    end`;

/** Expo config plugin: decouple SwiftAudioEx's buffer and stall-waiting setters in Podfile post_install. */
function withSwiftAudioBuffer(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfilePath, 'utf8');

      const merged = mergeContents({
        tag: 'withSwiftAudioBuffer',
        src: contents,
        newSrc: BUFFER_FIX,
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

module.exports = withSwiftAudioBuffer;
