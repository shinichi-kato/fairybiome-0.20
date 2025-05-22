/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

function numberToAlpha(num) {
  let str = '';
  while (num >= 0) {
    str = String.fromCharCode((num % 26) + 65) + str;
    num = Math.floor(num / 26) - 1;
  }
  return str;
}

// Triggered when a new user is created in Firebase Auth
exports.assignReadableId = functions.auth.user().onCreate(async (user) => {
  const db = admin.firestore();
  const counterRef = db.doc("counters/user_id");
  const userRef = db.doc(`users/${user.uid}`);

  const readableId = await db.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    let count = 0;
    if (counterDoc.exists) {
      count = counterDoc.data().value;
    }
    const newId = `USER_${numberToAlpha(count)}`;
    transaction.set(counterRef, { value: count + 1 });
    return newId;
  });

  await userRef.set({
    email: user.email,
    readableId: readableId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`✅ Assigned ${readableId} to ${user.email}`);
});