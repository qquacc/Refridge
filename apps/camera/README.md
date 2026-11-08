# Refridge camera app

This app belongs to the root npm workspace. Keep `packages/shared/` and the backend with it. Run installation/build/development from the project root; see `../../README.md` and `../../docs/DEPLOYMENT.md`.

Independent companion: `/camera/`. Pair with a 6-character camera code, start the camera, and leave motion enabled. Captures settle before upload. Both companions use the main app’s HTTPS server; recognition runs on that server when configured, not in this browser.
