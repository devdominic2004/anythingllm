const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const chats = await prisma.workspace_chats.findMany({
    orderBy: { id: 'desc' },
    take: 3
  });
  console.log(JSON.stringify(chats.map(c => ({
    id: c.id,
    prompt: c.prompt,
    response: JSON.parse(c.response)
  })), null, 2));
}

run()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
