const path = require("path");

exports.onCreateNode = async ({ node, actions, loadNodeContent, createContentDigest }) => {
  const { createNode, createParentChildLink } = actions;

  const ext = path.extname(node.absolutePath || "");
  if (ext !== ".config") return;

  // console.log("✅ Processing config:", node.relativePath);

  const content = await loadNodeContent(node);
  const lines = content.split("\n");

  const config = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || trimmed === "") continue;

    const [key, valueRaw] = trimmed.split(":");
    if (!key || !valueRaw) continue;

    const keyClean = key.trim();
    let value = valueRaw.trim();

    // 数値変換（必要に応じて）
    if (!isNaN(parseFloat(value))) {
      value = parseFloat(value);
    }

    config[keyClean] = value;
  }

  const configNode = {
    id: `${node.id} >>> biomebotConfig`,
    parent: node.id,
    children: [],
    internal: {
      type: "BiomebotConfig",
      contentDigest: createContentDigest(config),
    },
    ...config,
  };

  createNode(configNode);
  createParentChildLink({ parent: node, child: configNode });
};