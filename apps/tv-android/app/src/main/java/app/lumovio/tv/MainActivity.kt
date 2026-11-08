package app.lumovio.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInstaller
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.Toast
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URISyntaxException
import java.net.URL

/**
 * Lumovio for Android TV (docs/tv-mode-handoff-2026-10-23.md §11.1): one screen with a WebView that opens the site,
 * which answers it with its TV shell (the user agent says `LumovioTV/<version>`). Everything — the interface, the data,
 * the player — is the site's; the app only gives what a TV browser can't: the remote's Back and media keys reach the
 * page, video goes full screen, the screen stays on while a video plays, `http://` servers at home can be reached
 * (mixed content) while the app itself never leaves lumovio.app, the session survives a restart, and a newer version
 * published on the site is offered as an update.
 */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var root: FrameLayout
    private var offline: View? = null
    private var startup: View? = null
    private var fullscreen: View? = null
    private var fullscreenCallback: WebChromeClient.CustomViewCallback? = null
    /** The installer session this app started (an update); a status for any other is ignored. */
    @Volatile private var updateSession: Int? = null

    private val home: Uri by lazy { Uri.parse(BuildConfig.SITE_URL) }

    @SuppressLint("SetJavaScriptEnabled", "AddJavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = FrameLayout(this).apply { setBackgroundColor(INK) }
        web = WebView(this).apply {
            setBackgroundColor(INK)
            isFocusable = true
            isFocusableInTouchMode = true
        }
        root.addView(web, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        // The Activity can draw before WebView has HTML. Keep the system splash's final mark until the page paints.
        startup = ImageView(this).apply {
            setImageResource(R.drawable.lumovio_splash_still)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }.also {
            val size = (128 * resources.displayMetrics.density).toInt()
            root.addView(it, FrameLayout.LayoutParams(size, size, Gravity.CENTER))
        }
        setContentView(root)

        if (debuggable) WebView.setWebContentsDebuggingEnabled(true)

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            // A Jellyfin, Plex or TorrServer at home is often plain http: the site reaches it with fetch (the browser's
            // "compatibility" mode would block that). Safe because the app opens nothing but the site (below).
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            userAgentString = "$userAgentString LumovioTV/${BuildConfig.VERSION_NAME} (AndroidTV)"
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(web, false)
        }
        web.addJavascriptInterface(Bridge(), "LumovioTV")
        web.webViewClient = Client()
        web.webChromeClient = Chrome()

        if (savedInstanceState != null) web.restoreState(savedInstanceState) else web.loadUrl(home.toString())
        web.requestFocus()
        if (savedInstanceState == null) checkForUpdate()
    }

    private val debuggable: Boolean get() = 0 != (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE)

    /**
     * Updates come from the site (TV document §11.1): each release build publishes `downloads/lumovio-tv.json` and the
     * APK next to it (.github/workflows/tv-app.yml). A newer version is offered once per start; "Update" downloads it
     * and hands it to the system installer, which asks the person — the first time also for leave to install from
     * Lumovio. A debug build (a stand, another package) never updates itself.
     */
    private fun checkForUpdate() {
        if (debuggable) return
        Thread {
            val latest = try {
                val c = URL(home.buildUpon().path("/downloads/lumovio-tv.json").build().toString()).openConnection() as HttpURLConnection
                c.connectTimeout = 8000
                c.readTimeout = 8000
                c.inputStream.bufferedReader().use { JSONObject(it.readText()) }
            } catch (_: Exception) {
                return@Thread
            }
            if (latest.optInt("versionCode") <= BuildConfig.VERSION_CODE) return@Thread
            val apk = home.buildUpon().path("/" + latest.optString("apk", "downloads/lumovio-tv.apk").trimStart('/')).build().toString()
            runOnUiThread { offerUpdate(latest.optString("versionName"), apk) }
        }.start()
    }

    private fun offerUpdate(version: String, apk: String) {
        if (isFinishing) return
        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle(R.string.update_title)
            .setMessage(getString(R.string.update_text, version))
            .setPositiveButton(R.string.update_now) { _, _ -> install(apk) }
            .setNegativeButton(R.string.update_later, null)
            .show()
    }

    /** Streams the APK into an installer session; the system then asks to confirm (onNewIntent). */
    private fun install(apk: String) {
        Toast.makeText(this, R.string.update_downloading, Toast.LENGTH_SHORT).show()
        Thread {
            try {
                val c = URL(apk).openConnection() as HttpURLConnection
                c.connectTimeout = 15000
                c.readTimeout = 30000
                val installer = packageManager.packageInstaller
                val id = installer.createSession(PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL))
                updateSession = id
                installer.openSession(id).use { session ->
                    val size = c.contentLength.toLong().takeIf { it > 0 } ?: -1L
                    c.inputStream.use { input ->
                        session.openWrite("lumovio-tv.apk", 0, size).use { out ->
                            input.copyTo(out)
                            session.fsync(out)
                        }
                    }
                    val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
                    val status = Intent(this, MainActivity::class.java).setAction(ACTION_INSTALL)
                    session.commit(PendingIntent.getActivity(this, id, status, flags).intentSender)
                }
            } catch (_: Exception) {
                runOnUiThread { Toast.makeText(this, R.string.update_failed, Toast.LENGTH_LONG).show() }
            }
        }.start()
    }

    @SuppressLint("UnsafeIntentLaunch") // checked below: this app's own session, into the system installer only
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // The activity is exported: only the status of the session this app started counts, and its confirmation is
        // opened only when it leads to the system's package installer — never an intent another app slipped in.
        if (intent.action != ACTION_INSTALL || updateSession == null) return
        if (intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1) != updateSession) return
        when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                @Suppress("DEPRECATION")
                val confirm = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT) ?: return
                // The system addresses it to its installer (no lookup: package visibility would hide it on Android 11+).
                val target = confirm.component?.packageName ?: confirm.`package` ?: return
                if (target.endsWith("packageinstaller")) startActivity(confirm)
            }
            // Installed (the app restarts as the new version) or cancelled by the person: nothing to say.
            PackageInstaller.STATUS_SUCCESS, PackageInstaller.STATUS_FAILURE_ABORTED -> Unit
            else -> Toast.makeText(this, R.string.update_failed, Toast.LENGTH_LONG).show()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    // The session cookie on disk, so the TV doesn't ask for a code again after a restart.
    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush()
        web.onPause()
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }

    /**
     * The remote: Back goes to the page (it closes the top layer, hides the player's controls, goes back a screen — or
     * asks whether to leave on the home screen), the media keys become the page's keys. Arrows and OK reach the page by
     * themselves as keydown events.
     */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (startup != null && (event.keyCode == KeyEvent.KEYCODE_BACK || event.keyCode == KeyEvent.KEYCODE_ESCAPE)) {
            if (event.action == KeyEvent.ACTION_UP) finish()
            return true
        }
        if (offline != null) {
            if (event.keyCode == KeyEvent.KEYCODE_BACK && event.action == KeyEvent.ACTION_UP) finish()
            return super.dispatchKeyEvent(event)
        }
        val key = when (event.keyCode) {
            KeyEvent.KEYCODE_BACK, KeyEvent.KEYCODE_ESCAPE -> "GoBack"
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_MEDIA_PLAY, KeyEvent.KEYCODE_MEDIA_PAUSE -> " "
            KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> "ArrowRight"
            KeyEvent.KEYCODE_MEDIA_REWIND -> "ArrowLeft"
            else -> null
        } ?: return super.dispatchKeyEvent(event)
        if (fullscreen != null && key == "GoBack" && event.action == KeyEvent.ACTION_UP) {
            fullscreenCallback?.onCustomViewHidden()
            return true
        }
        if (event.action == KeyEvent.ACTION_DOWN) {
            val js = "(function(){var t=document.activeElement||document.body;t.dispatchEvent(new KeyboardEvent('keydown',{key:${JSONObject.quote(key)},bubbles:true,cancelable:true,repeat:${event.repeatCount > 0}}));})()"
            web.evaluateJavascript(js, null)
        }
        return true
    }

    private fun askToLeave() {
        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle(R.string.exit_title)
            .setPositiveButton(R.string.exit_yes) { _, _ -> finish() }
            .setNegativeButton(R.string.exit_no, null)
            .show()
    }

    private fun showOffline() {
        clearStartup()
        if (offline != null) return
        val v = layoutInflater.inflate(R.layout.offline, root, false)
        v.findViewById<Button>(R.id.retry).setOnClickListener {
            root.removeView(v)
            offline = null
            web.reload()
            web.requestFocus()
        }
        root.addView(v)
        offline = v
        v.findViewById<Button>(R.id.retry).requestFocus()
    }

    private fun isSite(uri: Uri): Boolean = uri.scheme == home.scheme && uri.host == home.host

    private fun external(view: WebView, url: String) {
        val quoted = JSONObject.quote(url)
        view.evaluateJavascript("window.dispatchEvent(new CustomEvent('lumovio:external',{detail:$quoted}))", null)
    }

    /** A player app on this TV from the site's intent: address; the store's page for it when it isn't installed. */
    private fun openPlayer(view: WebView, address: String) {
        val intent = try {
            Intent.parseUri(address, Intent.URI_INTENT_SCHEME)
        } catch (e: URISyntaxException) {
            return
        }
        // Only an app that opens a link: never a component of this or another app named by the page.
        intent.addCategory(Intent.CATEGORY_BROWSABLE)
        intent.component = null
        intent.selector = null
        try {
            startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            val pkg = intent.`package` ?: return
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg")))
            } catch (e: ActivityNotFoundException) {
                external(view, "https://play.google.com/store/apps/details?id=$pkg")
            }
        }
    }

    private fun clearStartup() {
        startup?.let { root.removeView(it) }
        startup = null
    }

    private inner class Client : WebViewClient() {
        override fun onPageCommitVisible(view: WebView, url: String?) {
            clearStartup()
        }

        override fun onPageFinished(view: WebView, url: String?) {
            // Android 5.1 lacks onPageCommitVisible (API 23).
            if (Build.VERSION.SDK_INT < 23) clearStartup()
        }
        // A new page: whatever the last one asked for is over — a video playing as its page went away (a reload, Back to
        // another document) never got to say it stopped, and the TV would never sleep again.
        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }

        // The app opens nothing but the site; another address is offered to open on a phone (the site shows its QR).
        // "Open in VLC / MX Player" is an intent: address with the server's login in it: the app opens the player itself,
        // and the address is never handed back to be shown on the screen.
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            if (!request.isForMainFrame || isSite(request.url)) return false
            if (request.url.scheme == "intent") {
                openPlayer(view, request.url.toString())
                return true
            }
            external(view, request.url.toString())
            return true
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) showOffline()
        }
    }

    private inner class Chrome : WebChromeClient() {
        // Video full screen: without these the page's requestFullscreen does nothing in a WebView.
        override fun onShowCustomView(view: View, callback: CustomViewCallback) {
            if (fullscreen != null) {
                callback.onCustomViewHidden()
                return
            }
            fullscreen = view
            fullscreenCallback = callback
            root.addView(view, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
            web.visibility = View.GONE
        }

        override fun onHideCustomView() {
            fullscreen?.let { root.removeView(it) }
            fullscreen = null
            fullscreenCallback = null
            web.visibility = View.VISIBLE
            web.requestFocus()
        }
    }

    /**
     * What the page may ask of the app (`window.LumovioTV`): its version and abilities, keeping the screen on while a
     * video plays, and the question before leaving. No credentials and no files cross it.
     */
    private inner class Bridge {
        @JavascriptInterface
        fun version(): String = BuildConfig.VERSION_NAME

        @JavascriptInterface
        fun abilities(): String = """{"mixedContent":true,"keepScreenOn":true,"exitPrompt":true,"webView":"${Build.VERSION.SDK_INT}"}"""

        @JavascriptInterface
        fun keepScreenOn(on: Boolean) {
            runOnUiThread {
                if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }

        @JavascriptInterface
        fun exitPrompt() {
            runOnUiThread { askToLeave() }
        }
    }

    companion object {
        private val INK = Color.rgb(11, 12, 16)
        private const val ACTION_INSTALL = "app.lumovio.tv.INSTALL_STATUS"
    }
}
