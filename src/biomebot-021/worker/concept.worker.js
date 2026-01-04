import {conceptWorker} from './concept.core';

self.onmessage = (event) => {
  const action = event.data;

  switch(action.type){
    case 'deploy': {
      const botId = action.botId
      conceptWorker.deploy(botId)
    }
  }
}