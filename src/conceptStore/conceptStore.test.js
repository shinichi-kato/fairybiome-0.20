import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { ConceptStore, ConceptStoreWhere } from './conceptStore';

describe('conceptStore', () => {

  let cs;
  let cs2;

  it('insert', async () => {
    cs = new ConceptStore(1);
    await cs.insert([
      "{:AURULA} {:isA} {:FAIRY}",
      "{:AURULA} {:called} アウルラ",
      "{:AURULA} {:likes} {:NUTS}",
      "{:NUTS} {:called} 'nuts of maron'",
      "{:NUTS} {:called} 果実,木の実,ナッツ",
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

  it('select *', async () => {
    const res = await cs.select('*').where(['{:AURULA} ?p ?o']).toArray();
    console.log(res)
  })

  it('select ?x', async () => {
    const res = await cs.select('?x,?y').where(['{:AURULA} {:likes} ?x', '?x {:isA} {:FOOD}', '?x {:called} ?y']).toArray();
    console.log(res)
  })

  it("execute select with +operator", async () => {
    const r = await cs.execute("select ?y where {:AURULA} {:likes} ?x. ?x {:isA}+ {:OBJECT}. ?x {:called} ?y")
    console.log("result", r)
  })

  it("execute insert", async () => {
    await cs.execute("insert {:AURULA} {:likes} {:FLYING}. {:FLYING} {:isA} {:EVENT}");
    console.log(await cs.toArray())
  })

  it(' IATOKO insert', async () => {
    cs2 = new ConceptStore("{:IWATOKO}");
    await cs2.insert([
      "{:IWATOKO} {:called} イワトコ",
      "{:IWATOKO} {:isA} {:FAIRY}",
    ]
    );
    console.log(await cs2.toArray());
  })

  const query ="?s {:isA} {:FAIRY}.?s {:called} ?x"
  it('global select', async () => {
    const globalCs = new ConceptStore();
    const res = await globalCs.execute(`select distinct ?s,?x where ${query}`);
    console.log(res)
  })

  it('local select', async () => {
    const res = await cs.select('?x,?s').where(query).toArray();
    console.log(res)
  })

  it('updatedAt', async () => {
    const res = await cs.updatedAt();
    console.log(res)
  })


})