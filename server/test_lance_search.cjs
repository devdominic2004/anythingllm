const { getVectorDbClass } = require("../server/utils/helpers");
const path = require("path");

// Load env
require("dotenv").config({ path: path.resolve(__dirname, "../server/.env") });

async function test() {
  try {
    const vectorDB = getVectorDbClass();
    const { client } = await vectorDB.connect();
    
    // Find first workspace namespace
    const namespaces = await client.tableNames();
    if (namespaces.length === 0) {
      console.log("No tables found.");
      return;
    }
    
    const table = await client.openTable(namespaces[0]);
    console.log(`Testing query on table: ${namespaces[0]}`);

    // Try a LIKE query for a common word like 'the' or 'test'
    // In LanceDB JS API, we might use: table.query().where("text LIKE '%the%'").limit(5).toArray()
    // or maybe table.search().where(...)
    const results = await table.query().where("text LIKE '%the%'").limit(2).toArray();
    console.log("Query Results length:", results.length);
    console.log("First result:", results[0]?.text?.slice(0, 100));

    // Wait, what if we use ILIKE?
    const results2 = await table.query().where("text ILIKE '%The%'").limit(2).toArray();
    console.log("ILIKE Query Results length:", results2.length);

  } catch (err) {
    console.error("Error testing LanceDB query:", err);
  }
}

test();
