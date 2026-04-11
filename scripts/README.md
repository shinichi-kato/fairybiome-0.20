# Firestore Content Upload Setup

This directory contains the script to upload content files from `content/botModules/` to Firestore.

## Environment Variables

Before running the upload script, set up the following environment variables:

```bash
# Firebase Admin SDK configuration
export FIREBASE_PROJECT_ID=<your-project-id>
export FIREBASE_PRIVATE_KEY_ID=<your-key-id>
export FIREBASE_PRIVATE_KEY=<your-private-key>  # Note: Use \n for newlines
export FIREBASE_CLIENT_EMAIL=<your-client-email>
export FIREBASE_CLIENT_ID=<your-client-id>
export FIREBASE_CLIENT_X509_CERT_URL=<your-cert-url>
```

Or create a `.env.local` file in the project root:

```bash
# .env.local
FIREBASE_ADMIN_SDK_KEY=path/to/service-account-key.json
FIREBASE_PROJECT_ID=<your-project-id>
FIREBASE_PRIVATE_KEY_ID=<your-key-id>
FIREBASE_PRIVATE_KEY=<your-private-key>
FIREBASE_CLIENT_EMAIL=<your-client-email>
FIREBASE_CLIENT_ID=<your-client-id>
FIREBASE_CLIENT_X509_CERT_URL=<your-cert-url>
```

## Running the Upload Script

```bash
# Setup (one-time)
npm run setup:content

# Or directly with Node
node scripts/uploadContentToFirestore.ts
```

## What Gets Uploaded

The script reads all files in `content/botModules/`:

- **`.dialog` files**: Conversation logs with tags and messages
- **`.concept` files**: RDF triples and ontology
- **`.config` files**: Bot configuration

Each file is parsed and uploaded to the Firestore `content` collection with the document ID: `{botId}-{moduleName}`

## Firestore Collection Structure

```
content/
├── Aurula-greetings (DialogStore)
├── Aurula-main (ConceptStore)
├── Aurula-setup (BiomebotConfig)
├── common-common (ConceptStore)
└── ...
```

Each document includes:
- `botId`: Bot identifier (e.g., "Aurula", "common")
- `moduleName`: Module name without extension
- `fileType`: "dialog" | "concept" | "config"
- `tags/triples/config`: Parsed content
- `createdAt` / `updatedAt`: Timestamps

## Firestore Rules

Ensure your Firestore security rules allow these operations:

```firestore
match /content/{document=**} {
  allow read, write: if request.auth != null;
}
```
