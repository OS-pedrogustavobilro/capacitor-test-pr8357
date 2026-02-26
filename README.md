# capacitor-test-pr8357

This is a sample app to test the Capacitor PR https://github.com/ionic-team/capacitor/pull/8357 (which is a rebased version of https://github.com/ionic-team/capacitor/pull/5956).

The app contains a few `.wav` audio files, and tries to load it concurrently with range requests.

On Android - it often results on the wrong `Content-Range` header being returned to the WebView.

Use the "TEST ALL 4 AUDIO FILES CONCURRENTLY", you may get some failures in mismatch of returned headers, or try the "STRESS TEST: 20 CONCURRENT REQUESTS (SAME FILE)" to reproduce more consistently.


## Setup

1. `npm install`

2. `ionic cap sync` (or `npm run build` + `npx cap sync`)

3. `npx cap run android` (or `npx cap open android` and build from Android Studio) - **You should get the bug** 

4. Apply the fix, either by pointing to the branch of the Capacitor Fork in the aforementioned PRs containing the fix (re-run install and build/sync), or by manually patching `node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/WebViewLocalServer.java` with the code from the PR - **The bug should now be fixed**.