const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const AUTOMOTIVE_XML = `<?xml version="1.0" encoding="utf-8"?>
<automotiveApp>
  <uses name="media" />
</automotiveApp>`;

const withAndroidAutoMedia = (config) => {
  // Create the automotive_app_desc.xml file
  config = withDangerousMod(config, ['android', (cfg) => {
    const xmlDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
    fs.mkdirSync(xmlDir, { recursive: true });
    fs.writeFileSync(path.join(xmlDir, 'automotive_app_desc.xml'), AUTOMOTIVE_XML);
    return cfg;
  }]);

  // Add the metadata to AndroidManifest.xml
  config = withAndroidManifest(config, (c) => {
    const manifest = c.modResults;
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      manifest,
      'com.google.android.gms.car.application',
      '@xml/automotive_app_desc',
      'resource'
    );
    return c;
  });

  return config;
};

module.exports = withAndroidAutoMedia;