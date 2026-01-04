Biomebot
==========
「心のパート」モデルを用いた小規模コミュニティ向けチャットボット

## システム構成

### biomebotCentral (SharedWorker)
* チャットボットのスクリプトを読み込み、partのワーカーを生成
* ecosystem、chatroomからメッセージを受け取り内部表現に変換
* 内部表現をpartのworkerにbroadcast channelで送信する。
* partのworkerが生成した発言(内言)から実際の発言を選び、自然言語に変換
* 自然言語化した発言をchatroomに送信。

### biomebotPart (dedicated worker)
* centralや他のpartから内部表現のメッセージを受取り発言が可能であれば発言(内部表現)を生成
* broadcast channnelで内言を送信

### ecosystem (SharedWorker)
* biomebot, chatroomに人工環境の情報を送信

### chatroom 
* biomebot, ecosystemからのメッセージをUIにレンダリングする
* ユーザ入力をbiomebotに送信する

## チャットボットの会話のメカニズム
人の心は一見複雑で矛盾も含んだ挙動をする。この挙動はより単純な意図を持った
「パート」が複数競争的・共同的に働くことにより現れると考えるのが心のパート
理論である。それを模してこのチャットボットでは単純なチャットボットを複数
動作させ、それらの相互作用を通して発言内容を決める。



### １対１の会話
1:1の会話では、場の人数(=2)が特徴量の一つになる。
またチャットボットは場の無言時間が長いと発話しようとする。これはタイマーで
回っている会話のループが1回目でNGだった場合2回目に入るが、ループ回数ごとに
しきい値が低下するという挙動で表現する。

### 多対多の会話
他対多の会話では場の人数が特徴量の一つとなり、現在の人数との差に応じて
スコアが与えられる。またチャットボットのタイマー周期が人数に応じて長くなる
が、ばらつきも大きくする。これは考えるべきことが多くなることを模倣した
挙動である。

また
* 会話ログ中での会話相手が今の相手と同じかどうか
* 相手がユーザがチャットボットか
も特徴量の一つになる。

## チャットボットのライフサイクル
一つのBiomebotインスタンスは一つのチャットボットを構成する。
Biomebotはチャットボットを構成するworkerのインスタンスを管理する。
workerを動作させるソースとなるデータはgraphqlで供給され、
ローカルではconceptStore(概念記憶),sequenceStore(エピソード記憶),memoryStore
(ワーキングメモリ)に格納される。それらのうち会話を通して更新、獲得された
情報はfirestoreに記憶され、ローカルと同期する。

biomebotインスタンス生成時にgraphqlからmainのみが読み込まれる。

biomebot.summon()でbotが出現するかどうかが判定され、判定になった場合は
残りの全データの同期が行われてworkerインスタンスが生成される。

biomebot.run()で会話が可能になる。

biomebot.terminate()でbotの同期が行われ、完了したらworkerが破棄される。
## channel構成

| type      | ch name           | ch type   | 概要
|-----------|-------------------|-----------|-----------------------------
| hearbeat  | biomebot          | broadcast | 排他制御
| input     | biomebot-${botId} | broadcast | チャットボットへの入力
| propose   | biomebot-${botId} | boradcast | 発言候補の発信
| approve   | biomebot-${botId} | boradcast | 発言候補の採用通知
| output    | biomebot-${botId} | boradcast | チャットボットからの出力
| status    | -                 | worker    | workerの状態報告
| deploy    | -                 | worker    | workerを会話可能状態に
| terminate | -                 | worker    | workerを終了



