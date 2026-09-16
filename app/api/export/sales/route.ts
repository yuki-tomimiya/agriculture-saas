import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('userId')?.value
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const url = new URL(request.url)
    const cropId = url.searchParams.get('cropId') ?? undefined
    const fromStr = url.searchParams.get('from') ?? undefined
    const toStr = url.searchParams.get('to') ?? undefined

    const where: any = { userId }
    if (cropId) {
      where.cropId = cropId
    }
    if (fromStr || toStr) {
      where.date = {}
      if (fromStr) {
        const from = new Date(fromStr)
        if (!Number.isNaN(from.getTime())) {
          where.date.gte = from
        }
      }
      if (toStr) {
        const to = new Date(toStr)
        if (!Number.isNaN(to.getTime())) {
          where.date.lte = to
        }
      }
    }

    const saleModel = (prisma as {
      sale?: {
        findMany: (args: unknown) => Promise<
          {
            id: string
            date: Date
            quantity: number
            unit: string
            unitPrice: number
            amount: number
            customerName: string
            channel: string | null
            notes: string | null
            crop: { name: string } | null
            farm: { name: string } | null
          }[]
        >
      }
    }).sale

    if (!saleModel?.findMany) {
      return NextResponse.json(
        { error: '販売データがまだ利用できません（Prisma の生成・マイグレーションが未実行の可能性があります）' },
        { status: 500 }
      )
    }

    const sales = await saleModel.findMany({
      where,
      include: {
        crop: true,
        farm: true,
      },
      orderBy: { date: 'asc' },
    })

    const header = [
      'date',
      'crop',
      'farm',
      'quantity',
      'unit',
      'unitPrice',
      'amount',
      'customerName',
      'channel',
      'notes',
    ]

    const esc = (value: unknown): string => {
      if (value === null || value === undefined) return '""'
      const s = String(value).replace(/"/g, '""')
      return `"${s}"`
    }

    const rows = sales.map((s) =>
      [
        esc(s.date.toISOString().slice(0, 10)),
        esc(s.crop?.name ?? ''),
        esc(s.farm?.name ?? ''),
        esc(s.quantity),
        esc(s.unit),
        esc(s.unitPrice),
        esc(s.amount),
        esc(s.customerName),
        esc(s.channel ?? ''),
        esc(s.notes ?? ''),
      ].join(',')
    )

    const csv = '\uFEFF' + [header.join(','), ...rows].join('\n')

    const fileName = cropId ? `sales-${cropId}-${new Date().toISOString().slice(0, 10)}.csv` : `sales-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('Sales export error:', error)
    return NextResponse.json({ error: '販売データのエクスポートに失敗しました' }, { status: 500 })
  }
}

