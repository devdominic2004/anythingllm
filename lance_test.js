const { LanceDb } = require('./utils/vectorDbProviders/lance');
const { NativeEmbedder } = require('./utils/EmbeddingEngines/native');

async function test() {
  try {
    const embedder = new NativeEmbedder();
    const query = "What is Gaston Brumm's age, gender and Country?";
    const queryVector = await embedder.embedTextInput(query);
    
    const lance = new LanceDb();
    const { client } = await lance.connect();
    
    const results = await lance.similarityResponse({
      client,
      namespace: 'my-workspace',
      queryVector,
      topN: 4,
    });
    
    console.log("SIMILARITY SEARCH RESULTS:");
    console.log(JSON.stringify(results.sourceDocuments, null, 2));
    if (results.contextTexts && results.contextTexts.length > 0) {
      console.log("FIRST RESULT CONTENT:");
      console.log(results.contextTexts[0]);
    } else {
      console.log("NO RESULTS FOUND.");
    }
  } catch (e) {
    console.error(e);
  }
}

test();
