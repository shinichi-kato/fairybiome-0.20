/*
Messageクラス
=============
## role: string
- "user" | "bot" | "cue"

## text: string
- メッセージ本文

## target: string
- "self" | "other" 　
self=独り言、other=誰かに向けた言葉

## date: string
- Dateオブジェクト

## emo: string
- "happy" | "sad" | "angry" | "surprised" | "neutral"

## facing: string
- "personal" | "face" | "away"

## location: string
- "private" | "public"


## score: number
類似度
*/

export class Message {
    constructor(){
        this.role= "";
        this.text= "";
        this.timestamp= new Date();
        this.emo= "";
        this.facing= "";
        this.location= "";
        this.ecoState="";
        this.displayName="";
        this.backgroundColor="";
        this.props = {
            score: 0,
            botName: "",
            partName: ""
        }       
    }
}