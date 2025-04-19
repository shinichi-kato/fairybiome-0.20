/* 
 dbio class
 */

import Dexie from "dexie";

export class Dbio {
  constructor(){
    this.db = new Dexie('Biomebot')
  
}