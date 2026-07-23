import 'dotenv/config'
import { Worker } from 'bullmq'
import fs from 'fs'
import csv from 'fast-csv'
import { prisma } from '../prisma'

// Pass plain connection options rather than an ioredis instance: bullmq
// bundles its own copy of ioredis, which is a structurally different (if
// compatible) type from the top-level `ioredis` package's `Redis` class —
// passing an instance of the "wrong" copy fails type-checking even though it
// works at runtime. A plain options object sidesteps the mismatch entirely.
const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379
}

const queueName = 'csv-import'

const worker = new Worker(
  queueName,
  async (job) => {
    console.log('Processing CSV job:', job.id, job.name)

    const { filePath, merchantId } = job.data as {
      filePath: string
      merchantId?: string
    }

    if (!filePath) {
      throw new Error('filePath missing')
    }

    const rows: any[] = []

    await new Promise<number>((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv.parse({ headers: true }))
        .on('error', (err) => reject(err))
        .on('data', (row) => rows.push(row))
        .on('end', (rowCount: number) => resolve(rowCount))
    })

    const merchant = await prisma.merchant.findFirst()

    if (!merchant && !merchantId) {
      throw new Error('No merchant found')
    }

    for (const r of rows) {
      try {
        await prisma.order.create({
          data: {
            merchantId: merchantId || merchant!.id,
            customerName:
              r.customer ||
              r.Customer ||
              r.customerName ||
              'Unknown',
            phone: r.phone || r.Phone || '',
            address: r.address || r.Address || '',
            amount: Number(r.amount || r.Amount || 0),
            paymentType: (r.paymentType ||
              r.PaymentType ||
              'COD') as any,
            status: 'NEW'
          }
        })
      } catch (err) {
        console.error('Failed to insert row', r, err)
      }
    }

    try {
      fs.unlinkSync(filePath)
    } catch {
      // ignore
    }

    return { created: rows.length }
  },
  { connection }
)

worker.on('completed', (job) =>
  console.log('CSV job completed', job.id)
)

worker.on('failed', (job, err) =>
  console.error('CSV job failed', job?.id, err)
)

console.log('Worker started for queue', queueName)