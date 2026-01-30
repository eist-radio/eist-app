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
import android.util.Log
import androidx.media.MediaBrowserServiceCompat

/**
 * MediaBrowserService that exposes react-native-track-player's MediaSession to Android Auto.
 *
 * This service binds to the MusicService created by react-native-track-player and extracts
 * its MediaSessionCompat token via reflection, then exposes it to Android Auto clients.
 */
class MediaBrowserService : MediaBrowserServiceCompat() {

    companion object {
        private const val TAG = "EistMediaBrowser"
        private const val ROOT_ID = "root"
        private const val LIVE_RADIO_ID = "live_radio"
        private const val RETRY_DELAY_MS = 1000L
        private const val MAX_RETRIES = 30
    }

    private var musicService: Any? = null
    private var isBound = false
    private val handler = Handler(Looper.getMainLooper())
    private var retryCount = 0
    private var mediaController: MediaControllerCompat? = null
    private var metadataCallback: MediaControllerCompat.Callback? = null

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            Log.d(TAG, "Connected to MusicService")
            try {
                // The binder is MusicService.MusicBinder, get the service instance
                val getServiceMethod = binder?.javaClass?.getMethod("getService")
                musicService = getServiceMethod?.invoke(binder)
                Log.d(TAG, "Got MusicService instance: \${musicService?.javaClass?.name}")
                isBound = true
                extractAndSetSessionToken()
            } catch (e: Exception) {
                Log.e(TAG, "Error getting MusicService from binder", e)
            }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            Log.d(TAG, "Disconnected from MusicService")
            musicService = null
            isBound = false
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "MediaBrowserService created")
        bindToMusicService()
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "MediaBrowserService destroyed")
        handler.removeCallbacksAndMessages(null)

        // Unregister metadata callback
        metadataCallback?.let { callback ->
            try {
                mediaController?.unregisterCallback(callback)
            } catch (e: Exception) {
                Log.e(TAG, "Error unregistering metadata callback", e)
            }
        }
        metadataCallback = null
        mediaController = null

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
            intent.component = ComponentName(
                packageName,
                "com.doublesymmetry.trackplayer.service.MusicService"
            )
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

    private fun extractAndSetSessionToken() {
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
                handler.postDelayed({ extractAndSetSessionToken() }, RETRY_DELAY_MS)
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
                handler.postDelayed({ extractAndSetSessionToken() }, RETRY_DELAY_MS)
                return
            }

            Log.d(TAG, "Got MediaSession, setting session token")
            sessionToken = mediaSession.sessionToken
            Log.i(TAG, "Session token set successfully!")

            // Register metadata callback to fix DISPLAY_SUBTITLE for Android Auto
            // Android Auto uses DISPLAY_SUBTITLE for the second line, but kotlin-audio
            // only sets METADATA_KEY_ARTIST. We intercept and copy artist to display_subtitle.
            try {
                mediaController = MediaControllerCompat(this, mediaSession.sessionToken)
                metadataCallback = object : MediaControllerCompat.Callback() {
                    override fun onMetadataChanged(metadata: MediaMetadataCompat?) {
                        if (metadata == null) return

                        val displaySubtitle = metadata.getString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE)
                        val artist = metadata.getString(MediaMetadataCompat.METADATA_KEY_ARTIST)

                        Log.d(TAG, "Metadata changed - artist: \$artist, displaySubtitle: \$displaySubtitle")

                        // If display subtitle is missing but artist exists, fix the metadata
                        if (displaySubtitle.isNullOrEmpty() && !artist.isNullOrEmpty()) {
                            Log.d(TAG, "Fixing metadata: copying artist to DISPLAY_SUBTITLE")
                            val fixedMetadata = MediaMetadataCompat.Builder(metadata)
                                .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, artist)
                                .build()
                            mediaSession.setMetadata(fixedMetadata)
                        }
                    }
                }
                mediaController?.registerCallback(metadataCallback!!)
                Log.i(TAG, "Metadata callback registered for Android Auto fix")
            } catch (e: Exception) {
                Log.e(TAG, "Error registering metadata callback", e)
            }

        } catch (e: NoSuchFieldException) {
            Log.e(TAG, "Field not found - track-player internals may have changed", e)
        } catch (e: Exception) {
            Log.e(TAG, "Error extracting MediaSession token", e)
            handler.postDelayed({ extractAndSetSessionToken() }, RETRY_DELAY_MS)
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

/**
 * Expo config plugin to add Android Auto support
 */
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
