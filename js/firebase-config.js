/* Firebase 網頁設定。這些是公開的 client key，不是密鑰。
 * 安全靠 Firestore rules 和 Firebase Auth。
 * 專案 pinyin-practice-eabd1，Firestore 在 asia-east1。
 */
var FIREBASE_CONFIG = {
  apiKey: "AIzaSyDJiADxpTPBTZlIYMBmIzEM90D6m0EIHjc",
  authDomain: "pinyin-practice-eabd1.firebaseapp.com",
  projectId: "pinyin-practice-eabd1",
  storageBucket: "pinyin-practice-eabd1.firebasestorage.app",
  messagingSenderId: "18890109160",
  appId: "1:18890109160:web:2414862bb6c31325bfd95d"
};

if (typeof module === "object" && module.exports) module.exports = FIREBASE_CONFIG;
