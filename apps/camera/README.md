# Refridge camera app

This app belongs to the root npm workspace. Keep `packages/shared/` and the backend with it. Run installation/build/development from the project root; see `../../README.md` and `../../docs/DEPLOYMENT.md`.

Independent companion: `/camera/`. Pair with a 6-character camera code, start the camera, and leave motion enabled. Captures settle before upload. Both companions use the main app’s HTTPS server; recognition runs on that server when configured, not in this browser.

Opening `/camera/` always offers the six-character pairing-code form. A saved pairing is checked with the server before it can be resumed; invalid or removed pairings return to code entry. A new `?pair=` link overrides a cached pairing. After entering a code and selecting Top Camera or Side Camera, start the camera and keep the page open so it appears online in the main app. No username/password is needed on the camera phone.
