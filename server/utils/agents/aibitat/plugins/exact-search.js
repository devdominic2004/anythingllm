const { getVectorDbClass } = require("../../../helpers");

const exactSearch = {
  name: "exact-search",
  startupConfig: {
    params: {},
  },
  plugin: function () {
    return {
      name: this.name,
      setup(aibitat) {
        aibitat.function({
          super: aibitat,
          name: this.name,
          description:
            "Searches the workspace documents for an exact keyword, ID, or phrase, bypassing standard semantic search. Best for incident numbers, IDs, and exact terms.",
          examples: [
            {
              prompt: "Find documents mentioning INC-12345",
              call: JSON.stringify({ query: "INC-12345" }),
            },
            {
              prompt: "What is the status of incident 99999?",
              call: JSON.stringify({ query: "99999" }),
            },
            {
              prompt: "Search for exact keyword 'System Failure 44'",
              call: JSON.stringify({ query: "System Failure 44" }),
            },
          ],
          parameters: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The exact keyword, ID, or phrase to search for.",
              },
            },
            additionalProperties: false,
          },
          handler: async function ({ query }) {
            try {
              if (!query) {
                return "No query provided for exact search.";
              }

              this.super.introspect(
                `${this.caller}: Initiating exact keyword search for: "${query}"`
              );

              const vectorDB = getVectorDbClass();
              if (vectorDB.name !== "LanceDb") {
                return "Exact keyword search is currently only supported when using LanceDb as the vector database.";
              }

              const workspace = this.super.handlerProps.invocation.workspace;
              if (!workspace) {
                return "Could not determine the current workspace.";
              }

              const { client } = await vectorDB.connect();
              const tableExists = await vectorDB.namespaceExists(client, workspace.slug);

              if (!tableExists) {
                return "No documents found in this workspace to search.";
              }

              const table = await client.openTable(workspace.slug);

              // LanceDb SQL ILIKE query for exact string match
              const results = await table
                .query()
                .where(`text ILIKE '%${query.replace(/'/g, "''")}%'`)
                .limit(20)
                .toArray();

              if (results.length === 0) {
                this.super.introspect(
                  `${this.caller}: No exact matches found for "${query}".`
                );
                return `No exact matches found in the documents for "${query}".`;
              }

              this.super.introspect(
                `${this.caller}: Found ${results.length} exact matches. Returning to context.`
              );

              // Add citations
              const sources = results.map((rest) => {
                return {
                  ...rest,
                  score: 1.0, // Exact match
                };
              });

              if (typeof this.super.addCitation === "function") {
                this.super.addCitation(sources);
              }

              let combinedText = `Exact Keyword Matches for "${query}":\n\n`;
              for (const res of results) {
                combinedText += `Source: ${res.title}\nContent:\n${res.text}\n\n`;
              }

              return combinedText;
            } catch (error) {
              this.super.handlerProps.log(
                `Exact Keyword Search Error: ${error.message}`
              );
              return `There was an error while searching for the exact keyword. ${error.message}`;
            }
          },
        });
      },
    };
  },
};

module.exports = { exactSearch };
