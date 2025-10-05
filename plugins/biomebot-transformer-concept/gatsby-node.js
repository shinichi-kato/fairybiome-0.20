exports.onCreateNode = async ({ node, actions, loadNodeContent }) => {
  const { createNode, createParentChildLink } = actions;
  // .conceptファイルのみ処理
  if (node.extension !== "concept") {
    return;
  }

  const content = await loadNodeContent(node);
  const [description, triplesRaw] = content.split(/^---$/m);

  const triples = [];
  const lines = triplesRaw.split("\n");
  for (const line of lines) {
    if (line.trim().startsWith("#") || line.trim() === "") continue;
    const match = line.match(/^\{:(.+?)\}\s+\{:(.+?)\}\s+(.+)$/);
    if (match) {
      const [, subject, predicate, object] = match;
      triples.push({ subject, predicate, object });
    }
  }

  const conceptNode = {
    id: `${node.id} >>> ConceptEntry`,
    parent: node.id,
    children: [],
    internal: {
      type: "ConceptEntry",
      contentDigest: node.internal.contentDigest,
    },
    description: description.trim(),
    triples,
  };

  createNode(conceptNode);
  createParentChildLink({ parent: node, child: conceptNode });
};
