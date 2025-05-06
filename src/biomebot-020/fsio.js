import { collection } from 'firebase/firestore';

export async function getCatalogue(firestore) {
  const report = {};
  const botsRef = collection(firestore, 'chatbots');
  const snap = await getDocs(botsRef);
  snap.forEach((doc)=> {
    const data = doc.data();
    report[doc.id] = {
      ...data
    }
  })

  return report;
}

export async function saveConcepts(){

}

export async function loadConcepts(){
  
}