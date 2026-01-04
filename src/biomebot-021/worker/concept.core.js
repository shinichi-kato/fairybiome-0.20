/*
concept.core.js
=================

*/

import {ConceptStore} from '../../conceptStore/conceptStore';

export const core = {
  botId: null,
  moduleName: null,
  channel: null,

  init:({config,moduleName}) => {
    // config: {
    //   botId: Aurula
    //   backgroundColor: #de53a1
    //   avatarDir: wing-fairy-girl
    //   talkResumingRate: 0.8
    // }
    core.botId = config.botId;
    core.moduleName = config.moduleName;
    core.avatarDir= config.avatarDir;
    core.channel = new BroadcastChannel(`biomebot-${botId}`);
    core.channel.onmessage = function (event){
      const action = event.data;
      switch(action.type){
        
      }
    }
  },

  deploy:() => {
    // ロード
  },

  run:()=>{
    // ここで発言
  }
}
