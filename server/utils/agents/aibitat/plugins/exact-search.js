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
              const workspace = this.super.handlerProps?.invocation?.workspace;
              if (!workspace) {
                return "Could not determine the current workspace.";
              }

              const maxResults = workspace?.topN ? Math.min(workspace.topN, 6) : 4;
              let results = [];

              if (vectorDB.name === "LanceDb") {
                const { client } = await vectorDB.connect();
                const tableExists = await vectorDB.namespaceExists(client, workspace.slug);
                if (!tableExists) return "No documents found in this workspace to search.";
                const table = await client.openTable(workspace.slug);
                results = await table
                  .query()
                  .where(`text ILIKE '%${query.replace(/'/g, "''")}%'`)
                  .limit(maxResults)
                  .toArray();
              } else if (vectorDB.name === "QDrant") {
                const { client } = await vectorDB.connect();
                const namespaceExists = await vectorDB.namespaceExists(client, workspace.slug);
                if (!namespaceExists) return "No documents found in this workspace to search.";

                let matchedPoints = [];
                // 1. Try Qdrant full-text search match filter
                try {
                  const searchRes = await client.scroll(workspace.slug, {
                    filter: {
                      must: [{ key: "text", match: { text: query } }],
                    },
                    limit: maxResults,
                    with_payload: true,
                  });
                  matchedPoints = searchRes.points || [];
                } catch (e) {}

                // 2. If full-text filter yielded no results, scroll and scan payloads (case-insensitive substring match)
                if (matchedPoints.length === 0) {
                  let nextOffset = null;
                  let totalScanned = 0;
                  const queryLower = query.toLowerCase();
                  while (matchedPoints.length < maxResults && totalScanned < 1000) {
                    const scroll = await client.scroll(workspace.slug, {
                      limit: 100,
                      offset: nextOffset,
                      with_payload: true,
                    });
                    const points = scroll.points || [];
                    if (points.length === 0) break;
                    for (const p of points) {
                      if (
                        p.payload?.text &&
                        p.payload.text.toLowerCase().includes(queryLower)
                      ) {
                        matchedPoints.push(p);
                        if (matchedPoints.length >= maxResults) break;
                      }
                    }
                    nextOffset = scroll.next_page_offset;
                    totalScanned += points.length;
                    if (!nextOffset) break;
                  }
                }

                results = matchedPoints.map((p) => ({
                  id: p.id,
                  text: p.payload?.text || "",
                  title: p.payload?.title || p.payload?.source || "Document",
                  docTitle: p.payload?.docTitle || p.payload?.title,
                  sourceUrl: p.payload?.sourceUrl || p.payload?.url,
                  ...p.payload,
                }));
              } else {
                return `Exact keyword search is currently supported for LanceDb and QDrant vector databases.`;
              }

              if (results.length === 0) {
                this.super.introspect(
                  `${this.caller}: No exact matches found for "${query}".`
                );
                return `No exact matches found in the documents for "${query}".`;
              }

              this.super.introspect(
                `${this.caller}: Found ${results.length} exact match(es) for "${query}".`
              );

              // Add clean citations (strip heavy vectors and internal fields)
              const sources = results.map(({ vector: _v, _distance: _d, ...rest }) => ({
                ...rest,
                score: 1.0, // Exact match
              }));

              if (typeof this.super.addCitation === "function") {
                this.super.addCitation(sources);
              }

              let combinedText = `Found ${results.length} exact match(es) for "${query}":\n\n`;
              for (const res of results) {
                const title = res.title || "Document";
                const textSnippet =
                  res.text?.length > 1500
                    ? res.text.slice(0, 1500) + "... [truncated]"
                    : res.text;
                combinedText += `Source: ${title}\nContent:\n${textSnippet}\n\n`;
              }
              combinedText += `Please provide a clear, helpful, and natural response to the user's prompt based on the exact match information above.`;

              return combinedText;
            } catch (error) {
              this.super.handlerProps?.log?.(
                `Exact Keyword Search Error: ${error.message}`
              );
              return `There was an error while searching for the exact keyword: ${error.message}`;
            }
          },
        });
      },
    };
  },
};

module.exports = { exactSearch };
