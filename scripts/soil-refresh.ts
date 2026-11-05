import { prisma } from '../lib/prisma'
import { farmSoilService } from '../lib/farm-soil'

async function main() {
  if (process.argv.length > 2) throw new Error('soil:refreshは引数なしで使ってください')
  console.log(JSON.stringify(await farmSoilService.refreshAll(), null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
