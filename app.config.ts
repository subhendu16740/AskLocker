import { existsSync } from "node:fs";
import { ExpoConfig, ConfigContext } from "expo/config";

/** expo.dev › Projects › asklocker › Project ID, once it exists. */
const EAS_PROJECT_ID = "";

export default ({ config }: ConfigContext): ExpoConfig => {
  // In Firebase Studio, WEB_HOST is set to the workspace hostname.
  // The web preview is served from port 9000, so we need to allow
  // that origin for CORS in the Expo dev server.
  const webHost = process.env.WEB_HOST;
  const routerExtra: Record<string, unknown> = {};
  if (webHost) {
    routerExtra.origin = `https://9000-${webHost}`;
  }

  // The Android app's builds (EAS, eas.json): the Expo project they belong
  // to, from expo.dev › Projects. Not a secret. Empty, `eas build` stops and
  // says the project is not set up.
  const easProjectId = process.env.EAS_PROJECT_ID || EAS_PROJECT_ID || undefined;

  // Firebase, for notifications in the Android app (075): EAS's file
  // variable GOOGLE_SERVICES_JSON, else a google-services.json beside this
  // file. Without either the build still works, and Settings › Notifications
  // says they aren't ready.
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON || (existsSync("./google-services.json") ? "./google-services.json" : undefined);

  return {
    ...config,
    name: "AskLocker",
    slug: "asklocker",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "asklocker",
    userInterfaceStyle: "automatic",
    ios: {
      icon: "./assets/expo.icon",
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#2A3D66",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
      package: "com.asklocker.app",
      // Google Play's photo rules: a photo is picked with Android's own
      // photo picker, which needs no access to the whole gallery, so the
      // permissions that would ask for it are kept out. The camera stays.
      blockedPermissions: [
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_MEDIA_AUDIO",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.RECORD_AUDIO",
        "android.permission.SYSTEM_ALERT_WINDOW",
      ],
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    web: {
      bundler: "metro",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#2A3D66",
          android: {
            image: "./assets/images/splash-icon.png",
            imageWidth: 76,
          },
        },
      ],
      "expo-web-browser",
      [
        "expo-image-picker",
        {
          cameraPermission: "AskLocker uses the camera to scan your documents.",
          photosPermission: "AskLocker opens your photos so you can add a document.",
          microphonePermission: false,
        },
      ],
      [
        "expo-notifications",
        {
          // The mark alone, white on clear: Android draws the status bar's
          // icon from its shape (the web's badge, scripts/render-icons.mjs).
          icon: "./public/badge-96.png",
          color: "#2A3D66",
          defaultChannel: "reminders",
        },
      ],
    ],
    extra: {
      router: routerExtra,
      // Settings › About. Stamped when the bundle is built, so for a web
      // deploy this is the day it was released; Cloudflare Pages also says
      // which commit.
      releaseDate: new Date().toISOString(),
      commit: (process.env.CF_PAGES_COMMIT_SHA || process.env.EAS_BUILD_GIT_COMMIT_HASH || "").slice(0, 7),
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    },
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  };
};
