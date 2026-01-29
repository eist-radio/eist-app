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

// Styled media receiver - minimal code, just branding
const RECEIVER_HTML = `<!DOCTYPE html>
<html>
<head>
  <script src="https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js"></script>
  <style>
    cast-media-player {
      --splash-image: none;
      --background-color: #4733FF;
      --playback-logo-image: url('https://eist.ie/images/eist-logo.png');
      --theme-hue: 250;
      --progress-color: #AFFC41;
    }
  </style>
</head>
<body>
  <cast-media-player></cast-media-player>
  <script>
    const ctx = cast.framework.CastReceiverContext.getInstance();
    ctx.start();
  </script>
</body>
</html>`;
