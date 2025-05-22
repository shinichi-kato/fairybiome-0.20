biomebot main
=================================================

main ではチャットボットに共通するパラメータの定義および概念の操作を行う。
概念の記述には簡略化したrdf記法を用い、問い合わせには簡易化したsparqlを用いる。

## シンボル

| 名前           | 例           | 概要                           |
|----------------|--------------|--------------------------------|
| 固有概念タグ   | {:CONCEPT}   | 個人の概念タグ。毎回評価される |
| システム変数   | {SYSTEM}     | 毎回評価されるタグ             |
| 永続変数       | {Persistent} | 記憶が永続する変数             |
| セッション変数 | {session}    | セッション終了時に消滅する変数 |
| 揮発変数       | ?volatile    | 一度の返答生成で消滅する変数   |

## mainの記述例

```
# #で始まる行はコメント行
# 空行は無視する

# 概念記憶
{:AURULA} {:called} アウルラ
{:AURULA} {:isA} {:AIR_FAIRY}
{:AURULA} {:describedAs} 羽のある空気の妖精
{:AURULA} {:likes} {:NUTS}
{:NUTS} {:isA} {:FRUIT}
{:NUTS} {:isA} {:FOOD}
{:AURULA} {:importGraph} "別ファイルのパス" # 別ファイルに記述した知識をロード

# 通常のタグ記憶。概念の知識でないパラメータはこちらで定義
{BACKGROUND_COLOR} #de53a1
{AVATAR_DIR} wing-fairy-girl
{DESU} です。,でーす。

# 概念から変数への代入
{BOT_NAME} SELECT ?x WHERE {:AURULA} {:called} ?y
{USER_NAME} select ?x where {user} {:called} ?x
```

## mainの記法
### 概念記憶の記法(簡略化したRDF)

概念記憶とは「apple is a fruit」ような言及をtripleで表現したものである。これをRDFでは
subject, predicate, objectの3要素(triple)で記述し、tripleの集合をグラフと呼ぶ。
mainではチャットボット固有の知識と概念の体系をグラフとして表す。
ここで概念は `{:Concept}` のように':'で始まる名前を{}で囲うことで表す。

### 概念の問い合わせ(簡略化したsparql)

main ではsparql類似の記法で概念記憶を検索できる。
下記のようにタグに続いてクエリを記述すると、タグが評価されたときに検索が実行され、
検索結果が代入される。

```
{food} SELECT ?y WHERE {:AURULA} {:likes} ?x. ?x {:isA}+ {:OBJECT}. ?x {:called} ?y
```

ここで?x {:isA}+ {:OBJECT}は ?x {:isA} ?x1 →?x1 {:isA} ?x2 →　... と1回以上たどって最終的に 
?xn {:isA} {:OBJECT}に辿り着けば真となる演算子である。これを用いると任意の階層にある下位概念が
特定の上位概念に属するかを簡易に調べられる。なお、{:isA}*や{:isA}?は実装していない。

クエリで得られたデータはタグに記憶されるが、記憶先のタグの種類によってその動作が異なり、
{SYSTEM}の記憶タグでは記憶タグが評価されるたびに候補の中からランダムに一つを選択する。
{Persistent} では候補の中から採用された値が記憶され、以降も永続する。
{session}ではセッションが終わると記憶が残らない。 



## mainの機能
* 各種パラメータの定義
Biomebot Mainはチャットボットの各種パラメータを定義し、他のpartに対して共通の情報を提供する。

Biomebot Mainパートは以下に示すような概念的知識の操作を行う。
* 概念の獲得:ユーザについて、未知の単語についてなどの知識を新たに獲得する。
* 概念への問い合わせ: ユーザから聞かれた場合、botの知っている知識を答える。
* 概念の更新: ユーザとの会話の中で知識の修正が必要になった場合対応する。
* 概念の削除: 間違っていた知識や不要な知識は削除する。

これらを実現するため、mainパートでは概念的知識をtripleとして記述する。


## 概念の獲得

### 自己についての概念
妖精は自身について下記のような知識を持っており、ユーザからの問い合わせに答えることができる。

```
{:SPHAERA} {:called} "スパエラ"
{:SPHAERA} {:isA} {:WATER_FAIRY}
{:SPHAERA} {:describedAs} "青い水の妖精。"
{:SPHAERA} {:likes} {:AURULA}
{:SPHAERA} {:friendOf} {:AURULA}
{:SPHAERA} {:likes} {:FAILY_WATER}
{:SPHAERA} {:knows} {:IWATOKO}
{:SPHAERA} {:dislikes} {:SWAMP_FAILY}
```

# 概念に対する問い合わせ
## 値の照会
ユーザからの質問は以下のようなルールに従って検索され、結果がユーザに報告される
```
{:LIKE_WHAT_PATTERN1} {:isAPatternOf} {:likes}
{:LIKE_WHAT_PATTERN1} {:listen} "user ?nameの好きなものって何？ => select ?x where ?s {:called} ?name.?s {:likes} ?x0.?x0 {:called} ?x"
{:LIKE_WHAT_PATTERN1} {:ifMatch} "bot ?xだよ"
{:LIKE_WHAT_PATTERN1} {:ifNotMatch} "bot なんだろうね。"

{:LIKE_WHAT_PATTERN2} {:listen} "user ?sの好きな?kindって何？ => select ?x where ?s {:likes} ?x.?x {:isA} ?k.?k {:called} ?kind"
{:LIKE_WHAT_PATTERN2} {:ifMatch} "bot ?xだよ"
```
{:listen}は自然言語のパターン部とそれを読み替えたクエリ部に分かれる。{:ifMatch}ではパターン部で使用した辺すやselectで指定した変数が利用できる。結果が存在したら{:ifMatch}が、存在しなければ{:ifNotMatch}がレンダリングされる。

## 存在するかどうかの照会
user スパエラってアウルラのこと好き？ -> bot うん
{:DO_YOU_LIKE_PATTERN} {:isAPatternOf} {:likes}
{:DO_YOU_LIKE_PATTERN} {:listen} "user ?par1って?par2のこと好き？ => select * where ?p1 {:called} ?par1.?p2 {:called} ?par2.?p1 {:likes} ?p2"
{:DO_YOU_LIKE_PATTERN} {:ifMatch} "bot うん"
{:DO_YOU_LIKE_PATTERN} {:ifNotMatch} "bot よくわかんない"
```
こちらは真偽を聞くもので、問い合わせの結果該当する記憶があるかないかが帰る。マッチした場合は{:ifMatch}を、マッチしなかった場合は{:ifNotMatch}を返す。好きであるという情報がなかった場合は「嫌い」と「よく知らない」のどちらの可能性もある。

user スパエラってアウルラのこと好き？ -> bot ちょっと苦手
{:DO_YOU_LIKE_PATTERN2} {:listen} "user ?par1って?par2のこと好き？ => select * where ?p1 {:called} ?par1.?p2 {:called} ?par2.?p1 {:dislikes} ?p2"
{:DO_YOU_LIKE_PATTERN2} {:ifMatch} bot ちょっと苦手
{:DO_YOU_LIKE_PATTERN2} {:ifNotMatch} bot どうかな
```
同じ質問に対して返答可能なパターンを複数記述できる。複数マッチした場合はランダムに選ばれた一つが解決される。前の例と同じく「好き？」という質問に対する真偽を聞いているが、実際には{:disliked}を使って嫌いであるかどうかをチェックしている。これにより好きと聞かれて苦手と答えることができる。

# 概念の追加
## 妖精の名付け
ユーザーは妖精にニックネームを付与することができる。`{:NICKNAME_PATTERN} {:isAPatternOf} {:called}`を記述することでmainはこのパターンが呼び名に関するものであることがわかる。呼び名は他のパターンよりも優先度が高い。

```
user アウルラのこと、ルラって呼んでいい？ -> bot 「ルラ」だね。いいよ！
{:NICKNAME_PATTERN} {:isAPatternOf} {:called}
{:NICKNAME_PATTERN} {:listen} "user {YOU}のこと?nicknameって呼んでいい？ => select {user} where {user} {:called} ?nickname."
{:NICKNAME_PATTERN} {:ifNotMatch} "bot ?nickname、なの？。=> insert {:AURULA} {:invokePattern}  {:NICKNAME_PATTTEN2}"

{:NICKNAME_PATTERN2} {:match} "user {YES}"
{:NICKNAME_PATTERN2} {:ifMatch} "bot ありがとう！=> delete {:AURULA} {:called} {:WANTED} insert {:AURULA} {:called} ?nickname"

```
## ユーザについての概念とその学習
### ユーザの識別
{:USER01}というconceptは
{:USER01} {:id} "firestoreId"
というtripleで特定のユーザに紐づけられる。この対応はチャットボットに依存せず
firestoreのusers collection userdocで定義する。
### ユーザについての概念
チャットボットがユーザと知り合ったとき、チャットボットには
```
{:USER01} {:id} firestore上のId
{:USER01} {:called} {:WANTED} # まずは名前を聞くところから
{:USER01} {:isA} {:HUMAN} # 多分人間でしょう
{:USER01} {:describedAs} {:WANTED}
{:USER01} {:likes} {:WANTED}
{:USER01} {:dislike} {:WANTED}
{:USER01} {:friendOf} {:WANTED}

{:USER01} {:files} {:USER01_240112}  # この項目はログインした日ごとに増える
{:USER01_240112} {:localeDate} 2024/01/12 # toLocaleDateString("jp-JP") 
{:USER01_240112} {:sounds} {:WANTED} # 今日の状態
{:USER01_240112} {:teachedNewConcept} {:WANTED} # 今日獲得した知識

```
という知識がinsertされ、{user} = {:USER01}というセッション変数が自動で生成される。このWANTEDを
減らすことがチャットボットの動機である。ではあるがあれこれ聞きすぎるとユーザが面倒になるので、
{:conceptTold}が増えるほど聞かなくなる

### ユーザの名前を聞く
{:called}が{:WANTED}になっているのは最も優先して解決すべき状況である。そのためチャットボットは最初にユーザの名前を尋ねる。{:listen}では任意の入力にマッチ(*)し、ユーザ名が未獲得であることを確認する。
{:accept}ではユーザ入力から

```
{:YOUR_NAME_PATTERN1} {:isAPatternOf} {:called}
{:YOUR_NAME_PATTERN1} {:listen} "* => select * where {user} {:called} {:WANTED}"
{:YOUR_NAME_PATTERN1} {:ifMatch} "はじめまして！お名前なんていうの？ => insert {:AURULA} {:invokePattern} {YOUT_NAME_PATTERN2}"

{:YOUR_NAME_PATTERN2} {:match} "user ?xです。よろしく。"
{:YOUR_NAME_PATTERN2} {:ifMatch} "bot ?xですね。=> insert {:AURULA} {:invokePattern} {YOUT_NAME_PATTERN3}"

{:YOUR_NAME_PATTERN3} {:match} "user {YES}"
{:YOUR_NAME_PATTERN3} {:ifMatch} "bot ありがとう！ よろしくね。私は{BOT_NAME}だよ。=> delete {user} {:called} {:WANTED} insert {user} {:called} ?x"

```

## 個別の知識と常識
個別の知識はstatic/botModules/<botId>/mainに記述され、共通の知識はstatic/botModules直下に格納されたすべての知識ファイルである。
個別の知識と共通の知識で同じ名前のタグが使われた場合、個別の知識が優先される。またdeleteやinsertの操作は個別の知識に対してのみ実行される。

## 入出力文字列への利用
### 入力文字列のタグ化
入力文字列に概念や単語タグの{:called}が含まれる場合、それをタグに置き換えることで表記のゆらぎを吸収する。

`リンゴは好き？`→`{:APPLE}は{:likes}？`

このときもとの表層形を記憶し、それを出力文字列に戻す際に利用する。