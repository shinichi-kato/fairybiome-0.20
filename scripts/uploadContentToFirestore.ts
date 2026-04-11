/**
 * uploadContentToFirestore
 * content/ フォルダから Firestore へ content ファイルをアップロード
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { parseDialog } from './transformers/dialogTransformer';
import { parseConcept } from './transformers/conceptTransformer';
import { parseConfig } from './transformers/configTransformer';
import { readContentFiles } from './transformers/fileReader';
import type { FirestoreContent } from './firestoreSchema';

const FIRESTORE_COLLECTION = 'content';

async function initializeFirebase() {
  const credentialPath = process.env.FIREBASE_ADMIN_SDK_KEY;

  if (!credentialPath) {
    throw new Error('FIREBASE_ADMIN_SDK_KEY environment variable is not set');
  }

  const serviceAccount = {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  };

  const app = initializeApp({
    credential: cert(serviceAccount as any),
  });

  return getFirestore(app);
}

async function uploadContentToFirestore() {
  console.log('📚 Content Upload to Firestore Start...');

  try {
    const db = await initializeFirebase();
    const contentFiles = readContentFiles();

    console.log(`📁 Found ${contentFiles.length} content files`);

    let successCount = 0;
    let errorCount = 0;

    for (const file of contentFiles) {
      try {
        let firestoreDoc: FirestoreContent | null = null;

        if (file.extension === 'dialog') {
          const parsed = parseDialog(file.content);
          firestoreDoc = {
            botId: file.botId || 'common',
            moduleName: file.moduleName,
            fileType: 'dialog',
            tags: parsed.tags,
            messages: parsed.messages,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          } as FirestoreContent;
        } else if (file.extension === 'concept') {
          const parsed = parseConcept(file.content);
          firestoreDoc = {
            botId: file.botId || 'common',
            moduleName: file.moduleName,
            fileType: 'concept',
            description: parsed.description,
            triples: parsed.triples,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          } as FirestoreContent;
        } else if (file.extension === 'config') {
          const parsed = parseConfig(file.content);
          firestoreDoc = {
            botId: file.botId || 'common',
            moduleName: file.moduleName,
            fileType: 'config',
            config: parsed,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          } as FirestoreContent;
        }

        if (firestoreDoc) {
          const docId = `${file.botId}-${file.moduleName}`;
          await db.collection(FIRESTORE_COLLECTION).doc(docId).set(firestoreDoc);
          console.log(`✅ Uploaded: ${file.relativePath}`);
          successCount++;
        }
      } catch (error) {
        console.error(`❌ Error uploading ${file.relativePath}:`, error);
        errorCount++;
      }
    }

    console.log(
      `\n📊 Upload Complete: ${successCount} success, ${errorCount} errors`
    );
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// CLI 実行
if (require.main === module) {
  uploadContentToFirestore().catch(console.error);
}

export { uploadContentToFirestore };
