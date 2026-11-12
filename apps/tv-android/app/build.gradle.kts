plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "app.lumovio.tv"
    compileSdk = 34

    defaultConfig {
        applicationId = "app.lumovio.tv"
        // Android TV 5.1 and newer: what cheap TVs still ship.
        minSdk = 22
        targetSdk = 34
        // The release workflow's build numbers itself: the count of the app's commits, so every change
        // is a newer version the installed app offers to update to. A local build stays 1 / "1.0".
        versionCode = (project.findProperty("versionCode") as String?)?.toInt() ?: 1
        versionName = (project.findProperty("versionName") as String?) ?: "1.0"
        buildConfigField("String", "SITE_URL", "\"https://lumovio.app/\"")
    }

    signingConfigs {
        // The release key: in the CI's secrets, a copy kept outside the repository (never committed). One key for every
        // version, or a TV can't update the app it has. Without it a local release build is signed with the debug key.
        val store = System.getenv("LUMOVIO_KEYSTORE")
        if (store != null) {
            create("release") {
                storeFile = file(store)
                storePassword = System.getenv("LUMOVIO_KEYSTORE_PASSWORD")
                keyAlias = "lumovio"
                keyPassword = System.getenv("LUMOVIO_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            // A local dev server for checks: `-PsiteUrl=http://192.168.1.10:3000/`
            // (the app opens only that host then).
            val site = (project.findProperty("siteUrl") as String?) ?: "https://lumovio.app/"
            buildConfigField("String", "SITE_URL", "\"$site\"")
            applicationIdSuffix = ".debug"
        }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
