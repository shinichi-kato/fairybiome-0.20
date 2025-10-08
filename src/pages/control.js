import React from 'react';
import { graphql } from 'gatsby';
import Container from '@mui/material/Container';


import AuthProvider from '../components/Auth/AuthProvider';
import EcosystemProvider from '../components/Ecosystem/EcosystemProvider';
import BiomebotProvider from '../biomebot-021/BiomebotProvider';
import useFirebase from '../useFirebase';

import ChatbotControl from '../components/Control/ChatbotControl';

export default function IndexPage() {
  const [firebase, firestore] = useFirebase();

  return (
    <Container maxWidth='xs' disableGutters sx={{ height: '100vh' }}>
      <AuthProvider firebase={firebase} firestore={firestore}>
        <EcosystemProvider firestore={firestore}>
          <BiomebotProvider>
            <ChatbotControl />
          </BiomebotProvider>

        </EcosystemProvider>
      </AuthProvider>
    </Container>
  )
}