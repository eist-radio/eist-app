// app.config.ts
import { ExpoConfig, ConfigContext } from '@expo/config';
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  extra: {
    apiKey: process.env.API_KEY,
    "eas": {
      "projectId": "4f034ae2-70e3-4215-8782-3aec98781aa6"
    }
  },
});
