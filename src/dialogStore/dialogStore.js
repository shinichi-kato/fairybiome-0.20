/*
LogMemoryStore - indexedDBを記憶媒体としたログ型辞書
===============================================
## usage
### construct

const ls = new LogMemoryStore(storeId);
チャットボットのIdをstoreIdとして与えることでチャットボット固有のデータにアクセスする。
storeIdを指定しない場合、selectはあらゆるチャットボットの固有の知識に加え
storeId無指定の状態でinsertされたアクセスする。

## ファイル形式

#で始まる行はコメント、
{key} value,value,...はmemoryStoreへの記憶
ユーザ発言は
user テキスト(12/1 8:20)
のように'user'から始まり、スペースに続いて出力するテキストをそのまま表記する。
末尾にタイムスタンプを書くことができ、
(12/1) 日付のみ
(8:20) 時刻のみ
(12/1 8:21) 日付と時刻
のいずれかの形式にする。

チャットボットの発言は冒頭が
bot
またはavatar名
greeting
などを指定する。
空行は話題の切り替わりとなる。

```
# 
{animal} うさぎ,キリン,象
user こんにちは！(1/1 8:20)
bot こんにちは。元気でした？ (1/1 8:20)
```

*/

import Dexie from 'dexie';

export class LogStore {

  constructor(storeId){
    this._db = new Dexie("LogMemoeyStore");
    this._db.version(1).stores({

    })
  }

}