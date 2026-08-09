/*
Messageクラス
=============
## role: string
- "user" | "bot-endo" | "bot-exo" | "cue"
bot-endo: botの独り言
bot-exo: botの普通の発言

## text: string
- メッセージ本文

## date: string
- Dateオブジェクト

## emo: string
- "happy" | "sad" | "angry" | "surprised" | "neutral"

## facing: string
- "face" | "away"

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