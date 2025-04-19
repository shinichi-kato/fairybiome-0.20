
import React, {useContext} from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

import {EcosystemContext} from '../Ecosystem/EcosystemProvider';


export default function EcosystemTest(){
  const eco = useContext(EcosystemContext);

  return (
    <Box>
      <Button
        onClick={eco.openDialog}
      >環境ダイアログを開く</Button>

    </Box>
  )
}