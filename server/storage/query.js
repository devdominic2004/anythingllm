const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  await prisma.system_settings.upsert({
    where: { label: "document_vision" },
    update: { value: "true" },
    create: { label: "document_vision", value: "true" },
  });
  console.log("Document Vision setting force enabled");
}
main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
