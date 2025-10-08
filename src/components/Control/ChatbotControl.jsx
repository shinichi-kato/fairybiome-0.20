import React, { useEffect, useContext } from 'react';
import {
  AppBar, Toolbar, Typography, Button,
  Grid, Card, CardContent,
} from '@mui/material';

import { BiomebotContext } from '../../biomebot-021/BiomebotProvider';

export default function ChatbotControl() {
  const bot = useContext(BiomebotContext);

  const nodes = Object.entries(bot.botStatus).map(([botId, status]) => ({
      botId,
      status,
    }));

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            チャットボットの状態
          </Typography>
          <Button color="inherit" onClick={bot.getStatus}>
            再読込
          </Button>
        </Toolbar>
      </AppBar>

      <Grid container spacing={2} padding={2} sx={{backgroundColor:"#DDDDDD"}}>
        {nodes.map((node, index) => (
          <Grid size={{xs:12, sm:6, md:4}} key={node.botId}>
            <Card>
              <CardContent>
                <Typography variant="h6">{node.botId}</Typography>
                <Typography color="textSecondary">
                  {node.status}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  )
}
