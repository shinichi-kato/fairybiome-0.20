
import React from 'react';
import { AuthProvider } from './src/auth/AuthProvider';

export const wrapRootElement = ({ element }) => (
  <AuthProvider>{element}</AuthProvider>
);
