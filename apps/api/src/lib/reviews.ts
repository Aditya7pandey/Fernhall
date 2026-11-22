import { prisma } from '@ecom/db'

/** Keeps the denormalised ratingAvg / ratingCount on Product in sync with its reviews. */
export async function recomputeRating(productId: string) {
  const agg = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { _all: true },
  })
  await prisma.product.update({
    where: { id: productId },
    data: {
      ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10,
      ratingCount: agg._count._all,
    },
  })
}
