/*
BiomebotProvider
===========================
複数のパートが競争的に動作することで一つのキャラクタを形成する
チャットボット

## 登場するチャットボットの決定

1. チャットボットはユーザと会話を始めると「コネクト状態」になる。
コネクト状態はアプリ終了後も継続し、次回アプリを起動した場合も
コネクト状態のチャットボットが再び姿を見せるようになる。

2. コネクト状態はチャットボットの方から解除することがある。

3. コネクト状態の妖精がいない場合はランダムで現れる妖精が決まるが、
妖精はその種類ごとに時間帯や天候によって出現しやすさが違う。

### 起動チャットボットの指定
現れるチャットボットを固定することができる。
`summon="aurula"|"iwatoko"|"sphaera"`で姿を見せるチャットボットを
指定でき、`initialPart=パート名`により起動する妖精の最初のパートを
設定することができる。指定しなかった場合は妖精の設定したパートが
ランダムに選ばれる。

## データ入出力
チャットボットのオリジナルデータはgraphqlで供給される。
内容のコピーがfirestoreにアップロードされ、それをアプリがダウンロードして
利用する。firestoreとの同期は一日に最大一回でチャットボット起動時である。

チャットボットのデータはfilesystem上で以下の構成である。ファイル中の#で始まる行は
コメント行で、firestoreへは転送しない.

chatbot
└Aurula
    ├ main
    ├ greeting
    ︙
    └ story
firestore上では
chatbots collection
└Aurula document
  │ {updates} modulesの更新日付  
  └modules collection
        ├ main
        ├ greeting
        ︙
        └ story

とする。

firestoreへのアクセス回数を減らすため、更新時は{updates}をチェックして変更したものだけを
更新する。


*/

export default function BiomebotProvider({ firebase, firestore, summon, initialPart }) {

}