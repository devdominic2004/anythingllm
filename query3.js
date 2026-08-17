const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.workspace_documents.findMany({where: {workspaceId: 1}}).then(res => {
  console.log(JSON.stringify(res, null, 2));
}).catch(e => console.error(e)).finally(() => process.exit(0));
