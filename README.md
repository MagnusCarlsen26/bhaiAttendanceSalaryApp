# attendanceSalaryApp

## Android CI/CD

This project is configured for Android-only Expo delivery with two lanes:

- `main` builds a production APK and publishes production OTA updates.
- `stage` builds a preview APK and publishes preview OTA updates.

### One-time setup

1. Sign in to Expo locally.
2. Run `npx eas-cli@latest init` from the project root.
3. Complete any EAS project linking prompts so Expo writes the project metadata it needs.
4. Create a programmatic Expo access token.
5. Add the token to GitHub as the `EXPO_TOKEN` repository secret.
6. If Expo asks for credentials on the first build, complete one interactive EAS build locally before relying on CI.

### Workflows

- `.github/workflows/android-apk.yml`
  - Runs on pushes to `main` and `stage`
  - Builds an Android `.apk` with EAS Build
  - Adds the EAS build URL to the job summary
  - Uploads the APK as a GitHub Actions artifact when a direct artifact URL is available

- `.github/workflows/expo-ota-update.yml`
  - Runs on pushes to `main` and `stage` when app files change
  - Publishes OTA updates with EAS Update
  - Uses `production` for `main` and `preview` for `stage`

### Versioning rules

- `runtimeVersion.policy = appVersion`
  - OTA updates only apply to builds with the same app version
- `cli.appVersionSource = remote`
  - EAS manages Android build number increments remotely for CI builds
- `autoIncrement = true`
  - each APK build gets a new Android version code automatically

### Release guidance

- JS or asset changes only:
  - push to `stage` for preview OTA/APK
  - push to `main` for production OTA/APK
- Native dependency or native config changes:
  - bump `expo.version` in `app.json`
  - ship a new APK build
  - future OTA updates continue within that app version
