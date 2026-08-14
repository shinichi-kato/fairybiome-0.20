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
- "self" | "face" | "away"

## location: string
- "private" | "public"


## score: number
類似度
*/

export class Message {
    constructor(obj){
        if (obj){
            this.copy(obj);
            return;
        }
        this.role= "";
        this.text= "";
        this.target = "";
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
            partNames: [],
        }       
    }

    copy(other){
        this.role= other.role;
        this.text= other.text;
        this.target = other.target;
        this.timestamp= new Date(other.timestamp);
        this.emo= other.emo;
        this.facing= other.facing;
        this.location= other.location;
        this.ecoState=other.ecoState;
        this.displayName=other.displayName;
        this.backgroundColor=other.backgroundColor;

        const props = other.props ?? {};
        this.props = {
            ...props,
            botName: props.botName ?? "",
            score: props.score ?? 0,
            partNames: Array.isArray(props.partNames) ? [...props.partNames] : [],
        };
    }
}