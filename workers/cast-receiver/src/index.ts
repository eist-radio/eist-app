/**
 * éist Cast Receiver
 *
 * IMPORTANT: This receiver uses the <cast-media-player> element from the CAF SDK.
 * This is REQUIRED for media playback to work. Without it, you'll get error 905
 * (LOAD_FAILED) because there's no actual media player to handle the audio stream.
 *
 * A custom receiver with just JavaScript and DIVs won't work - you MUST include
 * either <cast-media-player> (styled receiver) or implement a full custom player
 * using the PlayerManager's media element.
 *
 * The <cast-media-player> element provides:
 * - Built-in media playback support for all formats (audio/video)
 * - Standard player UI with progress bar, metadata display
 * - Proper handling of LOAD requests from sender apps
 *
 * Styling is done via CSS custom properties on the cast-media-player element.
 * See: https://developers.google.com/cast/docs/styled_receiver
 */

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(RECEIVER_HTML, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store',
        },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};

// Styled media receiver with éist branding
const RECEIVER_HTML = `<!DOCTYPE html>
<html>
<head>
  <script src="https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js"></script>
  <style>
    html,
    body {
      width: 100%;
      height: 100%;
      margin: 0;
      background: #0D0D14;
    }

    body {
      font-family: 'Funnel Sans', sans-serif;
      color: #E6E3FF;
      overflow: hidden;
      position: relative;
    }

    @font-face {
      font-family: 'Funnel Sans';
      src: url('https://eist.radio/fonts/FunnelSans-VariableFont_wght.woff2') format('woff2');
      font-weight: 100 900;
      font-style: normal;
      font-display: swap;
    }

    cast-media-player {
      /* Dark background for ALL states */
      --background-color: #0D0D14;
      --background: #0D0D14;
      --splash-color: #0D0D14;
      --splash-background: #0D0D14;
      --splash-image: none;
      --logo-background: transparent;
      --watermark-color: transparent;
      --watermark-background: transparent;

      /* Branding */
      --playback-logo-image: url('https://eist.radio/eist-logo-small.png');
      --font-family: 'Funnel Sans', sans-serif;
      --theme-hue: 250;

      /* Accent colors - subtle on splash */
      --progress-color: #CFCBFF;
      --spinner-color: #CFCBFF;
      --splash-spinner-color: #CFCBFF;
      --logo-color: #0D0D14; /* This colour shows on loading */
      position: absolute !important;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
      z-index: 0 !important;
      opacity: 1;
      pointer-events: auto;
    }

    .metadata-version {
      position: absolute;
      right: 24px;
      bottom: 18px;
      font-size: 12px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      opacity: 0.35;
      color: #FFFFFF;
    }
  </style>
</head>
<body>
  <div class="metadata-version">v2026.01.30-7</div>
  <cast-media-player></cast-media-player>
  <script>
    const CUSTOM_NAMESPACE = 'urn:x-cast:com.eist.metadata';

    if (!window.cast || !cast.framework) {
      console.warn('Cast framework unavailable; metadata sync disabled.');
    } else {
      const ctx = cast.framework.CastReceiverContext.getInstance();
      const playerManager = ctx.getPlayerManager();

      function formatTitle(rawTitle) {
        if (!rawTitle) return 'éist';
        return String(rawTitle)
          .replace(/\(éist arís\)/gi, '↻')
          .replace(/\(eist aris\)/gi, '↻')
          .replace(/\(éíst arís\)/gi, '↻')
          .replace(/\(éist aris\)/gi, '↻')
          .replace(/\(eist arís\)/gi, '↻')
          .trim();
      }

      function applyMetadataToPlayer(payload) {
        if (!payload || typeof payload !== 'object') return;
        const mediaInfo = playerManager.getMediaInformation();
        if (!mediaInfo) return;

        const metadata = mediaInfo.metadata || { type: 'generic' };
        if (!metadata.type) {
          metadata.type = 'generic';
        }

        if (payload.title) {
          metadata.title = formatTitle(payload.title);
        }
        if (payload.djName) {
          metadata.artist = payload.djName;
        }
        const subtitleParts = [];
        if (payload.djName) subtitleParts.push(payload.djName);
        if (payload.showTime) subtitleParts.push(payload.showTime);
        if (subtitleParts.length > 0) {
          metadata.subtitle = subtitleParts.join(' · ');
        }
        if (payload.artworkUrl) {
          metadata.images = [{ url: payload.artworkUrl }];
        }

        mediaInfo.metadata = metadata;

        if (typeof playerManager.setMediaInformation === 'function') {
          playerManager.setMediaInformation(mediaInfo);
        } else if (typeof playerManager.setMediaMetadata === 'function') {
          playerManager.setMediaMetadata(metadata);
        } else if (typeof playerManager.broadcastStatus === 'function') {
          playerManager.broadcastStatus(true);
        }
      }

      function syncCustomDataToMetadata() {
        const mediaInfo = playerManager.getMediaInformation();
        if (!mediaInfo) return;

        const customData = mediaInfo.customData || {};
        applyMetadataToPlayer({
          title: mediaInfo.metadata?.title,
          showTime: customData.showTime,
          djName: customData.djName,
          artworkUrl: customData.artworkUrl,
        });
      }

      playerManager.addEventListener(
        cast.framework.events.EventType.PLAYER_LOAD_COMPLETE,
        syncCustomDataToMetadata
      );

      ctx.addCustomMessageListener(CUSTOM_NAMESPACE, (event) => {
        if (event?.data && typeof event.data === 'object') {
          applyMetadataToPlayer(event.data);
        }
      });

      const options = new cast.framework.CastReceiverOptions();
      options.customNamespaces = {
        [CUSTOM_NAMESPACE]: cast.framework.system.MessageType.JSON
      };

      ctx.start(options);
    }
  </script>
</body>
</html>`;
