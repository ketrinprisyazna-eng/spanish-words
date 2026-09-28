/* ============ Настройки Firebase (для синхронизации между устройствами) ============
   Как заполнить:
   1. Зайди на https://console.firebase.google.com и создай проект (бесплатно).
   2. В проекте: Build → Authentication → Get started → включи способ входа "Email/Password".
   3. В проекте: Build → Firestore Database → Create database → режим "Start in test mode"
      (или production — правила ниже подойдут для обоих; можно поменять позже).
   4. В настройках проекта (⚙️ Project settings → General → "Your apps" → добавь Web-приложение "</>")
      скопируй объект firebaseConfig и вставь его значения сюда вместо ПРОЧЕРКОВ.
      Это НЕ секретные ключи — их можно спокойно хранить в открытом коде сайта,
      безопасность обеспечивают правила Firestore (см. ниже) и пароль пользователя.
   5. В Firestore → Rules вставь:
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /progress/{uid} {
              allow read, write: if request.auth != null && request.auth.uid == uid;
            }
          }
        }
   Если оставить как есть (без реального apiKey) — приложение продолжит работать
   локально, просто без синхронизации между устройствами.
*/
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDSpI6d0fq4NWpX0JkVd8GEGmZztqoIGKk",
  authDomain: "spanish-words-3e503.firebaseapp.com",
  projectId: "spanish-words-3e503",
  storageBucket: "spanish-words-3e503.firebasestorage.app",
  messagingSenderId: "366045450814",
  appId: "1:366045450814:web:6b3a56bb70b28d79d0776f",
};
