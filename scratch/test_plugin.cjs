const path = require("path");
// Load env
require("dotenv").config({ path: path.resolve(__dirname, "../server/.env") });
const ImportedPlugin = require("../server/utils/agents/imported");

try {
  const plugin = ImportedPlugin.loadPluginByHubId("keyword-search");
  console.log("Plugin loaded successfully:", plugin.name);
  console.log("Handler loaded:", typeof plugin.handler.runtime.handler === "function");
} catch (e) {
  console.error("Failed to load plugin:", e);
}
