/**
 * Concept ファイルパーサー
 * .concept 形式から概念と triple を抽出
 */

export interface ConceptTriple {
  s: string;
  p: string;
  o: string;
}

export interface ParsedConcept {
  description: string;
  triples: ConceptTriple[];
}

export function parseConcept(content: string): ParsedConcept {
  const parts = content.split(/^---$/m);

  const description = parts[0].trim();
  const triplesRaw = parts.length > 1 ? parts[1] : '';

  const triples: ConceptTriple[] = [];
  const lines = triplesRaw.split('\n');

  for (const line of lines) {
    // コメント行と空行をスキップ
    if (line.trim().startsWith('#') || line.trim() === '') {
      continue;
    }

    // RDF triple パース: {:subject} {:predicate} object
    const match = line.match(/^\{:(.+?)\}\s+\{:(.+?)\}\s+(.+)$/);
    if (match) {
      const [, subject, predicate, object] = match;
      triples.push({
        s: subject,
        p: predicate,
        o: object,
      });
    }
  }

  return { description, triples };
}
