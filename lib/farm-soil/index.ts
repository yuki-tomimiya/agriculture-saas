import { prisma } from '../prisma'
import { createFarmSoilService } from './service'
export const farmSoilService = createFarmSoilService(prisma)
