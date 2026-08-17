const { LanceDb } = require('./utils/vectorDbProviders/lance');
const { NativeEmbedder } = require('./utils/EmbeddingEngines/native');

async function test() {
  try {
    const embedder = new NativeEmbedder();
    const query = "What is Gaston Brumm's age, gender and Country?";
    const queryVector = await embedder.embedTextInput(query);
    
    const lance = new LanceDb();
    const { client } = await lance.connect();
    
    const collection = await client.openTable('my-workspace');
    const response = await collection
      .vectorSearch(queryVector)
      .distanceType("cosine")
      .limit(10)
      .toArray();
      
    console.log("Raw LanceDB search results:");
    for (const r of response) {
      if (r.url && r.url.includes('0cae')) {
        console.log(`ID: ${r.id} | Distance: ${r._distance} | Text preview: ${r.text.substring(0, 50).replace(/\n/g, ' ')}...`);
      }
    }
  } catch (e) {
    console.error(e);
  }
}

test();
