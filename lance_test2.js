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
      topN: 10,
    });
    
    console.log("ALL CHUNKS RETURNED:");
    for (const r of results.sourceDocuments) {
      console.log(`Score: ${r.score} | Distance: ${r._distance}`);
      console.log(r.text);
      console.log("-----------------------");
    }
  } catch (e) {
    console.error(e);
  }
}

test();
