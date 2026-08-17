const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.workspaces.findMany({where: {id: 1}}).then(res => {
  console.log(JSON.stringify(res, null, 2));
}).catch(e => console.error(e)).finally(() => process.exit(0));
