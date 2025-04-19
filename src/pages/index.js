import React from 'react';
import { graphql } from 'gatsby';
import Container from '@mui/material/Container';


import AuthProvider from '../components/Auth/AuthProvider';
import EcosystemProvider from '../components/Ecosystem/EcosystemProvider';
import useFirebase from '../useFirebase';

import EcosystemTest from '../components/Ecosystem/EcosystemTest';

export default function IndexPage(){
  const [firebase, firestore] = useFirebase();

  return (
    <Container maxWidth='xs' disableGutters sx={{ height: '100vh' }}>
           <AuthProvider firebase={firebase} firestore={firestore}>
           <EcosystemProvider firestore={firestore}> 
            <EcosystemTest />
           </EcosystemProvider>
           </AuthProvider>
    </Container>
  )
}