const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.workspace_documents.findMany({where: {workspaceId: 1}}).then(res => {
  const xlsxDocs = res.filter(doc => doc.filename.includes('xlsx'));
  console.log(JSON.stringify(xlsxDocs, null, 2));
}).catch(e => console.error(e)).finally(() => process.exit(0));
