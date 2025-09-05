Biomebot System Control
========================

Biomebotは複数のpartを並列的・競争的に動作させることでキャラクタを表現するチャットボットである。
system controlではpartの稼働状況の表示、および起動・停止の操作を提供する。
UI上ではコンソールにworkerctlと入力すると別にdraggableなウィンドウが開き、そこに
workerのリストと稼働状況が表示される。

## partの実行管理
biomebotが実行できるpartはstatic/botModulesに記述する。
botModules直下のディレクトリ名がchatbotの型式で、ディレクトリ内に格納した以下のファイルを認識する。

| file           | 動作             | worker
|----------------|------------------|-------------------
| main.concept   | 起動停止の制御   | concept.worker.js
| *.concept      | 概念パート       | concept.worker.js
| *.episode      | エピソードパート | episode.worker.js

```
実際の起動状況はadmin画面で確認・操作できる。
管理画面では起動、停止、disableの操作ができる。

{
    directory: ディレクトリ名,

    status: 'alive':生きている
            'dead':応答なし
            'starting':起動中
            '':起動していない
}
```

## チャットボット動作との関連
biomebotが機動したら*.auto.conceptと*.auto.episodeが起動される。
`*.concept`や`*.episode`の中で出力文字列に
`{SYSTEM_START_MODULES}`を含めると同じディレクトリの全パートに起動コマンドを送り、
`{SYSYEM_STOP_MODULES}`を含めると同じディレクトリにあり.auto.以外のパートに停止コマンドを送る。
これにより呼ばれていない妖精に声をかけたら現れる、という挙動やさよならする
ことで妖精が不在状態に移行することが表現できる。
`{ROLL_FOR_ENCOUNTER}`は設定した確率で妖精が出現するかどうかを表す。
