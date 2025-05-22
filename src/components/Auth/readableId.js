import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';

async function assignReadableId(firestore, user) {
  const userRef = doc(firestore, 'users', user.uid);
  const docSnap = await getDoc(userRef);

  // If user already has a readableId, do nothing
  if (docSnap.exists() && docSnap.data().readableId) {
    return;
  }

  const counterRef = doc(firestore, 'config', 'userCounter');

  await runTransaction(firestore, async (transaction) => {
    let counterDoc = await transaction.get(counterRef);
    let count = 0;

    // If counter document does not exist, initialize it
    if (!counterDoc.exists()) {
      transaction.set(counterRef, { count: 1 }); // start from 1
    } else {
      count = counterDoc.data().count;
      transaction.update(counterRef, { count: count + 1 });
    }

    const readableId = indexToReadableId(count);

    // Merge to avoid overwriting existing fields
    transaction.set(userRef, {
      readableId,
    }, { merge: true });
  });
}

function indexToReadableId(index) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let id = '';
  do {
    id = letters[index % 26] + id;
    index = Math.floor(index / 26) - 1;
  } while (index >= 0);
  return `USER_${id}`;
}