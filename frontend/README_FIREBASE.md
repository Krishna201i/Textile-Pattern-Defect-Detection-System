# Firebase setup for Textile Pattern Defect Detection (frontend)

This project uses Firebase Firestore and Storage for persisting scan history and preview images.

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Firestore and Storage from the console.
3. In Firestore, create a collection named `scans` (documents will be added by the app).
4. Update Firebase config in `src/firebaseClient.js` with your project credentials (already included).
5. Security rules (development): see `firebase.rules` in this folder. Use the Firebase Console or CLI to deploy rules.
   - For initial testing you may allow open read/write but secure before production.

Deploy rules with Firebase CLI (optional):
- Install CLI: npm install -g firebase-tools
- Login: firebase login
- Initialize: firebase init (choose Firestore and Storage, link to your project)
- Deploy rules: firebase deploy --only firestore:rules,storage:rules

Environment variables (optional): you may move firebase config to environment variables and use them in `firebaseClient.js`.

Note: The frontend now requires Firestore + Storage. If you do not want Firebase, revert `src/supabaseService.js` to the localStorage fallback version.
