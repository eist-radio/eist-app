const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');
const fs = require('fs');
const path = require('path');

// Kotlin source for MediaBrowserService
const MEDIA_BROWSER_SERVICE_KOTLIN = `package com.oootini.eistapp.service

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.support.v4.media.MediaBrowserCompat
import android.support.v4.media.MediaDescriptionCompat
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaControllerCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log
import androidx.media.MediaBrowserServiceCompat

/**
 * MediaBrowserService for Android Auto. Exposes its own proxy MediaSession (RNTP 4.1.2 can't handle playFromMediaId),
 * forwards commands to RNTP's session, and mirrors RNTP's state and metadata back onto the proxy.
 */
class MediaBrowserService : MediaBrowserServiceCompat() {

    companion object {
        private const val TAG = "EistMediaBrowser"
        private const val ROOT_ID = "root"
        private const val LIVE_RADIO_ID = "live_radio"
        private const val RETRY_DELAY_MS = 1000L
        private const val MAX_RETRIES = 30
        // Ignore RNTP's transient STOPPED/NONE from startFreshStream for this long after a start.
        private const val GRACE_MS = 4000L
        // Coalesce prepare + play (AA often sends both) into a single restart.
        private const val DEBOUNCE_MS = 1500L
        // Give up on a cold-start play after this long (JS boot, setupPlayer, and wiring all happen inside it).
        private const val PENDING_PLAY_TIMEOUT_MS = 20000L
        private const val MUSIC_SERVICE_CLASS = "com.doublesymmetry.trackplayer.service.MusicService"
    }

    private var musicService: Any? = null
    private var isBound = false
    private val handler = Handler(Looper.getMainLooper())
    private var retryCount = 0

    // Controller on RNTP's own session: forwards commands and mirrors state. RNTP's session is never modified.
    private var rntpController: MediaControllerCompat? = null
    private var mirrorCallback: MediaControllerCompat.Callback? = null

    // The proxy session Android Auto talks to.
    private var proxySession: MediaSessionCompat? = null

    // Cold-start: a play arrived before RNTP's controller was wired; flush later.
    private var pendingPlay = false
    // Debounce timestamp for coalescing prepare + play.
    private var lastForwardMs = 0L
    // Ignore RNTP transient idle states until this time (armed on every start).
    private var suppressIdleUntil = 0L

    // Callback for the PROXY session: every start entry point funnels into
    // startPlayback(); stop/pause forward to RNTP; skip is a deliberate no-op.
    private val proxyCallback = object : MediaSessionCompat.Callback() {
        override fun onPlay() {
            Log.d(TAG, "proxy onPlay")
            startPlayback()
        }

        override fun onPlayFromMediaId(mediaId: String?, extras: Bundle?) {
            Log.d(TAG, "proxy onPlayFromMediaId: " + mediaId)
            startPlayback()
        }

        override fun onPlayFromSearch(query: String?, extras: Bundle?) {
            Log.d(TAG, "proxy onPlayFromSearch: " + query)
            startPlayback()
        }

        override fun onPrepare() {
            Log.d(TAG, "proxy onPrepare")
            startPlayback()
        }

        override fun onPrepareFromMediaId(mediaId: String?, extras: Bundle?) {
            Log.d(TAG, "proxy onPrepareFromMediaId: " + mediaId)
            startPlayback()
        }

        override fun onPrepareFromSearch(query: String?, extras: Bundle?) {
            Log.d(TAG, "proxy onPrepareFromSearch: " + query)
            startPlayback()
        }

        // Treat a stop as a pause. RNTP has no stop action wired (no Capability.Stop), so a forwarded stop is dropped
        // and the card is left with no way to play again (the Google Play rejection).
        override fun onStop() {
            Log.d(TAG, "proxy onStop -> treating as pause")
            pauseAndPublishIdle()
        }

        override fun onPause() {
            Log.d(TAG, "proxy onPause -> forwarding to RNTP")
            pauseAndPublishIdle()
        }

        override fun onSkipToNext() { /* no-op: live radio */ }
        override fun onSkipToPrevious() { /* no-op: live radio */ }
    }

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            Log.d(TAG, "Connected to MusicService")
            try {
                // The binder is MusicService.MusicBinder, get the service instance
                val getServiceMethod = binder?.javaClass?.getMethod("getService")
                musicService = getServiceMethod?.invoke(binder)
                Log.d(TAG, "Got MusicService instance: \${musicService?.javaClass?.name}")
                isBound = true
                extractAndWireRntp()
            } catch (e: Exception) {
                Log.e(TAG, "Error getting MusicService from binder", e)
            }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            Log.d(TAG, "Disconnected from MusicService, will rebind")
            musicService = null
            isBound = false
            // Detach the stale mirror so a rebind wires a fresh controller.
            mirrorCallback?.let { cb ->
                try { rntpController?.unregisterCallback(cb) } catch (e: Exception) {}
            }
            mirrorCallback = null
            rntpController = null
            // Show paused, not a stale playing state.
            publishState(PlaybackStateCompat.STATE_PAUSED)
            // RNTP's MusicService went away (e.g. process/service restart). Rebind
            // so the proxy re-wires to the new session and keeps forwarding play.
            retryCount = 0
            handler.postDelayed({ bindToMusicService() }, RETRY_DELAY_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "MediaBrowserService created")

        // Create the proxy session synchronously so onGetRoot always has a token.
        // No media-button handling, so it never steals hardware keys or RNTP's lock screen controls.
        val session = MediaSessionCompat(this, "EistProxySession")
        session.setFlags(MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS)
        session.setMediaButtonReceiver(null)
        session.setCallback(proxyCallback)
        session.isActive = true
        proxySession = session
        sessionToken = session.sessionToken

        // Seed placeholder metadata + an idle state so AA has something to show
        // and offers a Play action before RNTP's controller is wired.
        seedMetadata()
        publishState(PlaybackStateCompat.STATE_STOPPED)

        bindToMusicService()
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "MediaBrowserService destroyed")
        handler.removeCallbacksAndMessages(null)

        // Unregister the mirror callback from RNTP's session FIRST, so no late
        // callback can touch the proxy session after it is released.
        mirrorCallback?.let { callback ->
            try {
                rntpController?.unregisterCallback(callback)
            } catch (e: Exception) {
                Log.e(TAG, "Error unregistering mirror callback", e)
            }
        }
        mirrorCallback = null
        rntpController = null

        // Release the proxy session AFTER the mirror is detached.
        proxySession?.let { session ->
            try {
                session.isActive = false
                session.release()
            } catch (e: Exception) {
                Log.e(TAG, "Error releasing proxy session", e)
            }
        }
        proxySession = null

        if (isBound) {
            try {
                unbindService(serviceConnection)
            } catch (e: Exception) {
                Log.e(TAG, "Error unbinding service", e)
            }
            isBound = false
        }
    }

    private fun bindToMusicService() {
        try {
            val intent = Intent()
            intent.component = ComponentName(packageName, MUSIC_SERVICE_CLASS)
            val bound = bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
            Log.d(TAG, "Binding to MusicService: \$bound")

            if (!bound) {
                // Service might not be started yet, retry
                scheduleRetry()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error binding to MusicService", e)
            scheduleRetry()
        }
    }

    // Binding never runs JS: RNTP starts its headless task (trackPlayerService.js, which calls setupPlayer) only from
    // onStartCommand. Without this, a cold start from the car waits forever for a player (the Google Play rejection).
    // Android Auto is bound to this service, so the app counts as foreground and startService is allowed.
    private fun startMusicService() {
        try {
            val intent = Intent()
            intent.component = ComponentName(packageName, MUSIC_SERVICE_CLASS)
            startService(intent)
            Log.d(TAG, "Started MusicService to boot the playback service JS")
        } catch (e: Exception) {
            Log.e(TAG, "Error starting MusicService", e)
        }
    }

    private fun scheduleRetry() {
        if (retryCount < MAX_RETRIES) {
            retryCount++
            Log.d(TAG, "Scheduling retry \$retryCount/\$MAX_RETRIES")
            handler.postDelayed({ bindToMusicService() }, RETRY_DELAY_MS)
        } else {
            Log.w(TAG, "Max retries reached, giving up on binding to MusicService")
        }
    }

    private fun findField(clazz: Class<*>?, fieldName: String): java.lang.reflect.Field? {
        var currentClass: Class<*>? = clazz
        while (currentClass != null) {
            try {
                val field = currentClass.getDeclaredField(fieldName)
                field.isAccessible = true
                return field
            } catch (e: NoSuchFieldException) {
                currentClass = currentClass.superclass
            }
        }
        return null
    }

    private fun extractAndWireRntp() {
        try {
            val service = musicService ?: run {
                Log.w(TAG, "MusicService is null")
                return
            }

            // Try to get the player field from MusicService
            val playerField = findField(service.javaClass, "player")
            if (playerField == null) {
                Log.e(TAG, "Could not find player field")
                return
            }
            val player = playerField.get(service)

            if (player == null) {
                Log.d(TAG, "Player not initialized yet, retrying...")
                handler.postDelayed({ extractAndWireRntp() }, RETRY_DELAY_MS)
                return
            }

            Log.d(TAG, "Got player: \${player.javaClass.name}")

            // First try: get mediaSession directly from player (BaseAudioPlayer has it)
            var mediaSession: MediaSessionCompat? = null
            val directMediaSessionField = findField(player.javaClass, "mediaSession")
            if (directMediaSessionField != null) {
                mediaSession = directMediaSessionField.get(player) as? MediaSessionCompat
                if (mediaSession != null) {
                    Log.d(TAG, "Got MediaSession directly from player")
                }
            }

            // Second try: get it through notificationManager
            if (mediaSession == null) {
                val notificationManagerField = findField(player.javaClass, "notificationManager")
                if (notificationManagerField != null) {
                    val notificationManager = notificationManagerField.get(player)
                    if (notificationManager != null) {
                        Log.d(TAG, "Got notificationManager: \${notificationManager.javaClass.name}")
                        val mediaSessionField = findField(notificationManager.javaClass, "mediaSession")
                        if (mediaSessionField != null) {
                            mediaSession = mediaSessionField.get(notificationManager) as? MediaSessionCompat
                        }
                    }
                }
            }

            if (mediaSession == null) {
                Log.d(TAG, "MediaSession not initialized yet, retrying...")
                handler.postDelayed({ extractAndWireRntp() }, RETRY_DELAY_MS)
                return
            }

            Log.d(TAG, "Got RNTP MediaSession, wiring controller + mirror")

            // Controller on RNTP's own session, for forwarding commands and mirroring state.
            try {
                // Detach any previous mirror before re-wiring (defensive against
                // a re-entry that skipped onServiceDisconnected).
                mirrorCallback?.let { old ->
                    try { rntpController?.unregisterCallback(old) } catch (e: Exception) {}
                }
                val controller = MediaControllerCompat(this, mediaSession.sessionToken)
                rntpController = controller

                val callback = object : MediaControllerCompat.Callback() {
                    override fun onPlaybackStateChanged(state: PlaybackStateCompat?) {
                        mirrorState(state)
                    }
                    override fun onMetadataChanged(metadata: MediaMetadataCompat?) {
                        mirrorMetadata(metadata)
                    }
                }
                mirrorCallback = callback
                controller.registerCallback(callback)

                // Seed the proxy from RNTP's current state so the card is
                // correct immediately.
                mirrorMetadata(controller.metadata)
                mirrorState(controller.playbackState)

                Log.i(TAG, "RNTP controller + mirror wired for Android Auto")

                // Flush a cold-start play that arrived before the controller existed.
                if (pendingPlay) {
                    pendingPlay = false
                    val n = System.currentTimeMillis()
                    lastForwardMs = n
                    suppressIdleUntil = n + GRACE_MS
                    publishState(PlaybackStateCompat.STATE_BUFFERING)
                    Log.d(TAG, "Flushing deferred cold-start play")
                    try {
                        controller.transportControls.play()
                    } catch (e: Exception) {
                        Log.e(TAG, "Error flushing deferred play", e)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error wiring RNTP controller + mirror", e)
            }

        } catch (e: NoSuchFieldException) {
            Log.e(TAG, "Field not found - track-player internals may have changed", e)
        } catch (e: Exception) {
            Log.e(TAG, "Error extracting MediaSession token", e)
            handler.postDelayed({ extractAndWireRntp() }, RETRY_DELAY_MS)
        }
    }

    // Android Auto's buttons come from this mask. Never advertise STOP or SKIP.
    // PLAY and PAUSE are advertised in every state, so the car can always resume.
    private fun transportActions(): Long {
        return PlaybackStateCompat.ACTION_PLAY or
            PlaybackStateCompat.ACTION_PAUSE or
            PlaybackStateCompat.ACTION_PLAY_PAUSE or
            PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID or
            PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH or
            PlaybackStateCompat.ACTION_PREPARE_FROM_MEDIA_ID or
            PlaybackStateCompat.ACTION_PREPARE_FROM_SEARCH
    }

    // Gives up on a cold-start play that never got a controller. The error state
    // tells the driver what to do, and still advertises play so they can retry.
    private val pendingPlayTimeout = Runnable {
        if (!pendingPlay) return@Runnable
        pendingPlay = false
        suppressIdleUntil = 0L
        Log.w(TAG, "Cold-start play timed out waiting for RNTP")
        val errorState = PlaybackStateCompat.Builder()
            .setState(PlaybackStateCompat.STATE_ERROR, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 0f)
            .setActions(transportActions())
            .setErrorMessage(
                PlaybackStateCompat.ERROR_CODE_APP_ERROR,
                "Open éist on your phone to start playback"
            )
            .build()
        try {
            proxySession?.setPlaybackState(errorState)
        } catch (e: Exception) {
            Log.e(TAG, "Error publishing playback error state", e)
        }
    }

    private fun publishState(state: Int) {
        val playbackState = PlaybackStateCompat.Builder()
            .setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1f)
            .setActions(transportActions())
            .build()
        try {
            proxySession?.setPlaybackState(playbackState)
        } catch (e: Exception) {
            Log.e(TAG, "Error publishing playback state", e)
        }
    }

    private fun seedMetadata() {
        val metadata = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, LIVE_RADIO_ID)
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, "éist radio")
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, "éist radio")
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, "Live radio")
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, -1L)
            .build()
        try {
            proxySession?.setMetadata(metadata)
        } catch (e: Exception) {
            Log.e(TAG, "Error seeding metadata", e)
        }
    }

    // All stop/pause entry points. Publish PAUSED synchronously so the car shows play even if RNTP drops the command.
    private fun pauseAndPublishIdle() {
        // Drop the start grace window, otherwise mirrorState() would discard
        // RNTP's genuine PAUSED and leave the card showing a stale active state.
        suppressIdleUntil = 0L
        // Let the next play through: without this a stop immediately after a
        // start is swallowed by the DEBOUNCE_MS coalescing window.
        lastForwardMs = 0L
        // Cancel a cold-start play still waiting for RNTP's controller, or it
        // starts the stream when wiring finishes, after the user stopped it.
        pendingPlay = false
        publishState(PlaybackStateCompat.STATE_PAUSED)
        try {
            rntpController?.transportControls?.pause()
        } catch (e: Exception) {
            Log.e(TAG, "Error forwarding pause to RNTP", e)
        }
    }

    // Every AA start entry point funnels here.
    private fun startPlayback() {
        val now = System.currentTimeMillis()
        // Synchronously publish BUFFERING to beat AA's playFromMediaId timeout.
        publishState(PlaybackStateCompat.STATE_BUFFERING)
        // Arm the grace window so RNTP's transient STOPPED/NONE from
        // startFreshStream() (stop -> reset -> add -> play) is ignored.
        suppressIdleUntil = now + GRACE_MS
        // Coalesce prepare + play into a single forwarded start.
        if (now - lastForwardMs < DEBOUNCE_MS) {
            Log.d(TAG, "startPlayback debounced")
            return
        }
        lastForwardMs = now
        val c = rntpController
        if (c != null) {
            Log.d(TAG, "Forwarding play() to RNTP")
            try {
                c.transportControls.play()
            } catch (e: Exception) {
                Log.e(TAG, "Error forwarding play to RNTP", e)
            }
        } else {
            Log.d(TAG, "RNTP controller not ready; deferring play")
            pendingPlay = true
            startMusicService()
            if (!isBound) bindToMusicService()
            handler.removeCallbacks(pendingPlayTimeout)
            handler.postDelayed(pendingPlayTimeout, PENDING_PLAY_TIMEOUT_MS)
        }
    }

    // Mirror RNTP's playback state onto the proxy, dropping transient idle
    // states within the grace window so BUFFERING is not clobbered.
    private fun mirrorState(state: PlaybackStateCompat?) {
        if (state == null) return
        val active = state.state == PlaybackStateCompat.STATE_PLAYING ||
            state.state == PlaybackStateCompat.STATE_BUFFERING ||
            state.state == PlaybackStateCompat.STATE_CONNECTING
        if (active) {
            suppressIdleUntil = 0L
        } else if (System.currentTimeMillis() < suppressIdleUntil) {
            Log.d(TAG, "Suppressing transient RNTP idle state: " + state.state)
            return
        }
        publishState(state.state)
    }

    // Mirror RNTP's metadata onto the proxy, applying the DISPLAY_SUBTITLE fix.
    private fun mirrorMetadata(metadata: MediaMetadataCompat?) {
        if (metadata == null) return
        val builder = MediaMetadataCompat.Builder(metadata)
        val displaySubtitle = metadata.getString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE)
        val artist = metadata.getString(MediaMetadataCompat.METADATA_KEY_ARTIST)
        // Android Auto reads DISPLAY_SUBTITLE but kotlin-audio only sets ARTIST. Copy it on the proxy only.
        if (displaySubtitle.isNullOrEmpty() && !artist.isNullOrEmpty()) {
            builder.putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, artist)
        }
        // Associate Now Playing with the browse item; hide the seek bar (live).
        builder.putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, LIVE_RADIO_ID)
        builder.putLong(MediaMetadataCompat.METADATA_KEY_DURATION, -1L)
        try {
            proxySession?.setMetadata(builder.build())
        } catch (e: Exception) {
            Log.e(TAG, "Error mirroring metadata", e)
        }
    }

    override fun onGetRoot(
        clientPackageName: String,
        clientUid: Int,
        rootHints: Bundle?
    ): BrowserRoot {
        Log.d(TAG, "onGetRoot called by: \$clientPackageName")
        return BrowserRoot(ROOT_ID, null)
    }

    override fun onLoadChildren(
        parentId: String,
        result: Result<MutableList<MediaBrowserCompat.MediaItem>>
    ) {
        Log.d(TAG, "onLoadChildren called for: \$parentId")

        if (parentId == ROOT_ID) {
            val mediaItems = mutableListOf<MediaBrowserCompat.MediaItem>()

            // Single playable item for live radio
            val description = MediaDescriptionCompat.Builder()
                .setMediaId(LIVE_RADIO_ID)
                .setTitle("éist radio")
                .setSubtitle("Tap to play live radio")
                .build()

            mediaItems.add(
                MediaBrowserCompat.MediaItem(
                    description,
                    MediaBrowserCompat.MediaItem.FLAG_PLAYABLE
                )
            )

            result.sendResult(mediaItems)
        } else {
            result.sendResult(mutableListOf())
        }
    }
}
`;

// XML for automotive app descriptor
const AUTOMOTIVE_APP_DESC_XML = `<?xml version="1.0" encoding="utf-8"?>
<automotiveApp>
    <uses name="media"/>
</automotiveApp>
`;

/** Expo config plugin to add Android Auto support. */
function withAndroidAuto(config) {
  // Step 1: Modify AndroidManifest.xml
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];

    if (!application) {
      throw new Error('Could not find application in AndroidManifest.xml');
    }

    // Ensure meta-data array exists
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    // Add Android Auto meta-data if not already present
    const hasAndroidAutoMeta = application['meta-data'].some(
      (meta) => meta.$?.['android:name'] === 'com.google.android.gms.car.application'
    );

    if (!hasAndroidAutoMeta) {
      application['meta-data'].push({
        $: {
          'android:name': 'com.google.android.gms.car.application',
          'android:resource': '@xml/automotive_app_desc',
        },
      });
    }

    // Ensure service array exists
    if (!application.service) {
      application.service = [];
    }

    // Add MediaBrowserService if not already present
    const hasMediaBrowserService = application.service.some(
      (service) => service.$?.['android:name'] === '.service.MediaBrowserService'
    );

    if (!hasMediaBrowserService) {
      application.service.push({
        $: {
          'android:name': '.service.MediaBrowserService',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.media.browse.MediaBrowserService',
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });

  // Step 2: Create xml/automotive_app_desc.xml and service/MediaBrowserService.kt
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const packageName = config.android?.package || 'com.oootini.eistapp';
      const packagePath = packageName.replace(/\./g, '/');

      // Create res/xml directory and automotive_app_desc.xml
      const xmlDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'xml');
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(xmlDir, 'automotive_app_desc.xml'),
        AUTOMOTIVE_APP_DESC_XML
      );

      // Create service directory and MediaBrowserService.kt
      const serviceDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        ...packagePath.split('/'),
        'service'
      );
      if (!fs.existsSync(serviceDir)) {
        fs.mkdirSync(serviceDir, { recursive: true });
      }

      // Update package name in Kotlin source if different
      const kotlinSource = MEDIA_BROWSER_SERVICE_KOTLIN.replace(
        'package com.oootini.eistapp.service',
        `package ${packageName}.service`
      );

      fs.writeFileSync(
        path.join(serviceDir, 'MediaBrowserService.kt'),
        kotlinSource
      );

      // Add androidx.media dependency to build.gradle
      const buildGradlePath = path.join(
        projectRoot,
        'android',
        'app',
        'build.gradle'
      );
      const buildGradle = fs.readFileSync(buildGradlePath, 'utf8');

      if (!buildGradle.includes('androidx.media:media')) {
        const newBuildGradle = mergeContents({
          tag: 'android-auto-media-dependency',
          src: buildGradle,
          newSrc: "    implementation 'androidx.media:media:1.6.0'",
          anchor: /implementation\("com\.facebook\.react:react-android"\)/,
          offset: 0,
          comment: '//',
        });

        fs.writeFileSync(buildGradlePath, newBuildGradle.contents);
      }

      return config;
    },
  ]);

  return config;
}

module.exports = withAndroidAuto;
