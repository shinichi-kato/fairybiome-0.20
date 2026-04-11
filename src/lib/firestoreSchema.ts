/**
 * Firestore スキーマ定義
 * content ファイルから Firestore に保存するドキュメント構造を定義
 */

export interface FirestoreDialog {
  botId: string;
  moduleName: string;
  fileType: 'dialog';
  tags: Array<{
    key: string;
    value: string[];
  }>;
  messages: Array<{
    head: string | null;
    text: string | null;
    date: string | null;
    time: string | null;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FirestoreConcept {
  botId: string;
  moduleName: string;
  fileType: 'concept';
  description: string;
  triples: Array<{
    s: string;
    p: string;
    o: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FirestoreConfig {
  botId: string;
  moduleName: string;
  fileType: 'config';
  config: {
    [key: string]: string | number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type FirestoreContent = FirestoreDialog | FirestoreConcept | FirestoreConfig;

/**
 * Firestore collection パス
 */
export const FIRESTORE_COLLECTION = 'content';
