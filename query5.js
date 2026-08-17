const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.documents.findMany({where: {}}).then(res => {
  const xlsxDocs = res.filter(doc => doc.name.includes('xlsx'));
  console.log(JSON.stringify(xlsxDocs, null, 2));
}).catch(e => console.error(e)).finally(() => process.exit(0));
