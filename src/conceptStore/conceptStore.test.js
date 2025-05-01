import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import {ConceptStore,ConceptStoreWhere} from './conceptStore';

describe('conceptStore', ()=>{

    let cs;

    it('insert', async () =>{
        cs = new ConceptStore(1);
        await cs.insert([
          "{:AURULA} {:likes} {:NUTS}",
          "{:NUTS} {:called} 'nuts of maron'",
          "{:NUTS} {:called} 果実",
          "{:NUTS} {:isA} {:FOOD}",
          "{:AURULA} {:likes} {:IWATOKO}",
          "{:IWATOKO} {:isA} {:FAIRY}",
          "{:DOG} {:called} 犬",
          "{:AURULA} {:dislikes} {:DOG}",
          "{:FOOD} {:isA} {:OBJECT}"
        ]
        );
        console.log(await cs.toArray());
    })
    
    it('select *', async()=>{
      const res = await cs.select('*').where(['{:AURULA} {:likes} ?x','?x {:isA} {:FOOD}','?x {:called} ?y']).toArray();
      console.log(res)
    })

    it('select ?x', async()=>{
      const res = await cs.select('?x,?y').where(['{:AURULA} {:likes} ?x','?x {:isA} {:FOOD}','?x {:called} ?y']).toArray();
      console.log(res)
    })

    it("execute select with +operator",async()=>{
      const r= await cs.execute("select ?y where {:AURULA} {:likes} ?x. ?x {:isA}+ {:OBJECT}. ?x {:called} ?y")
      console.log("result",r)
    })
    
    it("execute insert",async()=>{
      await cs.execute("insert {:AURULA} {:likes} {:FLYING}. {:FLYING} {:isA} {:EVENT}");
      console.log(await cs.toArray())
    })

  })