exports.onCreateNode = async ({ node, actions, loadNodeContent, createNodeId }) => {
  const { createNode, createParentChildLink } = actions;

  // .conceptファイルのみ処理
  if (node.extension !== "concept") {
    return;
  }

  const content = await loadNodeContent(node);
  const parts = content.split(/^---$/m);

  const description = parts[0].trim();
  const triplesRaw = parts.length > 1 ? parts[1] : "";

  const triples = [];
  const lines = triplesRaw.split("\n");
  for (const line of lines) {
    if (line.trim().startsWith("#") || line.trim() === "") continue;
    const match = line.match(/^\{:(.+?)\}\s+\{:(.+?)\}\s+(.+)$/);
    if (match) {
      const [, subject, predicate, object] = match;
      triples.push({ s:subject, p:predicate, o:object });
    }
  }

  const conceptNode = {
    id: createNodeId(`${node.id}-concept`),
    parent: node.id,
    children: [],
    internal: {
      type: "ConceptStore",
      contentDigest: node.internal.contentDigest,
    },
    description,
    triples,
  };

  createNode(conceptNode);
  createParentChildLink({ parent: node, child: conceptNode });
};