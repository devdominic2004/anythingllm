const { resolveProviderConnector } = require('./utils/chats');
const { reformulateQuery } = require('./utils/helpers/chat/reformulate');
const { PrismaClient } = require('@prisma/client');

async function test() {
  const prisma = new PrismaClient();
  const workspace = await prisma.workspaces.findFirst({where: {id: 1}});
  const { connector: LLMConnector } = await resolveProviderConnector({ workspace, prompt: "What is Gaston Brumm's age, gender and Country?" });
  
  const queries = await reformulateQuery("What is Gaston Brumm's age, gender and Country?", LLMConnector);
  console.log("REFORMULATED QUERIES:");
  console.log(JSON.stringify(queries, null, 2));
}

test().catch(e => console.error(e)).finally(() => process.exit(0));
