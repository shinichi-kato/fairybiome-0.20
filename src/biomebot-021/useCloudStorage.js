/*
useCloudStorage
===============

firestore上のストレージに対するI/Oを提供する。

## チャットボットのデータ
firestore上で以下のような構造データを保持する。
collection chatbot
├doc botId
│  ├ config
│  └ collection modules
│      └ doc {botModlule}
└doc lock

## 部屋ごとの会話ログ
collection log
├doc {private/userId}
└doc {commons/roomId}
   
## チャットボットのロック状態
チャットボットのロックはchatbot/lockに集約

usage
const [] = useCloudStorage(firebase, )

*/