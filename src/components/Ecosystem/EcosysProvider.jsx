/*
EcosysProvider
====================================================

チャットルームの昼夜・天候を提供する。昼夜の変化および天候の変化は
現れる妖精の種類に影響し、状況に即した話題のトリガーになる。

## 昼夜
日の出と日没の時刻は日付から近似値を計算できる。それをもとに背景色を
変えることで昼夜を表現する。ローカル環境からは設定画面を操作でき、
時刻の補正ができる。昼夜の変化に応じて下記のようなメッセージを出力する。
タイムスタンプにより状況は一意に特定できるため、特徴量は設定しない。

状況    特徴量      メッセージ
---------------------------------------------------
深夜     ---      {ECOSYS_START_MIDNIGHT}
夜明け   ---      {ECOSYS_START_DAWN}
日の出   ---      {ECOSYS_START_SUNRISE}
朝       ---      {ECOSYS_START_MORNING}
午前中   ---      {ECOSYS_START_LATE_MORNING}
昼       ---      {ECOSYS_START_NOON}
午後     ---      {ECOSYS_START_AFTERNOON}
夕方     ---      {ECOSYS_START_EVENING}
日没     ---      {ECOSYS_START_SUNSET}
薄暮     ---      {ECOSYS_START_DUSK}
夜       ---      {ECOSYS_START_NIGHT}
--------------------------------------------------

日の出と日没の基準は以下の日時とする。
日没が最も早い日：  12/7 17:00
日没が最も遅い日：   7/7 19:00
日の出が最も早い日： 6/7 05:00
日の出が最も遅い日： 1/7 07:00

夜明けと朝は日の出の±1時間、夕方と薄暮は日没の±1時間
昼は11:30-13:30で固定とする

## 天候

天候はフラクタル的な乱数に従って変化する。ユーザに通知する
情報はメッセージとして伝達される「雨が振り始めた」という
トリガ情報と特徴量として埋め込まれる「雨が降っている」という
レベル情報である。天候の変化チェックは2分ごとに行う。


天候   特徴量             メッセージ
-----------------------------------------------
快晴 {ECOSYS_CLEAR}     {ECOSYS_START_CLEAR}
晴れ {ECOSYS_SUNNY}     {ECOSYS_START_SUNNY}
曇り {ECOSYS_CLOUDY}    {ECOSYS_START_CLOUDY}
雨   {ECOSYS_RAIN}      {ECOSYS_START_RAIN}
台風 {ECOSYS_STORM}     {ECOSYS_START_STROM}
雪   {ECOSYS_SNOW}      {ECOSYS_START_SNOW}
吹雪 {ECOSYS_BLIZZARD}  {ECOSYS_START_BLIZZARD}
------------------------------------------------

*/