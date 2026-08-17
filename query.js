const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.workspace_chats.findMany({orderBy: {id: 'desc'}, take: 2}).then(chats => {
  console.log(JSON.stringify(chats, null, 2));
}).catch(e => console.error(e)).finally(() => process.exit(0));
