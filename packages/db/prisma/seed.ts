import 'dotenv/config'
import bcrypt from 'bcryptjs'
import type { OrderStatus } from '../src/generated/prisma/client.js'
import { prisma } from '../src/index.js'

/** Demo seed — wipes and repopulates the database. Never run against production.
 *  Prices are INR in paise (₹1 = 100), GST-inclusive. */

const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`

// Deterministic PRNG so every seed produces the same data
let state = 42
const rand = () => ((state = (state * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32)
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min

const categories = [
  { slug: 'apparel', name: 'Apparel', description: 'Everyday essentials and statement layers, cut from considered fabrics.', imageUrl: img('1490481651871-ab68de25d43d') },
  { slug: 'footwear', name: 'Footwear', description: 'From city runners to handcrafted leather — shoes built to be lived in.', imageUrl: img('1560769629-975ec94e6a86') },
  { slug: 'accessories', name: 'Accessories', description: 'Watches, bags and eyewear that finish the look.', imageUrl: img('1524805444758-089113d48a6d') },
  { slug: 'electronics', name: 'Electronics', description: 'Thoughtfully designed tech for work, play and everything between.', imageUrl: img('1505740420928-5e560c06d30e') },
  { slug: 'home-living', name: 'Home & Living', description: 'Furniture, lighting and objects for calm, beautiful spaces.', imageUrl: img('1586023492125-27b2c045efd7') },
  { slug: 'beauty', name: 'Beauty', description: 'Clean skincare and self-care rituals, made with natural ingredients.', imageUrl: img('1612817288484-6f916006741a') },
] as const

type Seed = {
  name: string
  category: (typeof categories)[number]['slug']
  price: number
  compareAt?: number
  stock: number
  images: string[]
  featured?: boolean
  description: string
}

const products: Seed[] = [
  // Apparel
  { name: 'Essential Organic Cotton Tee', category: 'apparel', price: 239900, stock: 120, images: [img('1521572163474-6864f9cf17ab')], featured: true,
    description: 'A wardrobe cornerstone in 100% organic cotton jersey. Midweight, pre-shrunk and garment-washed for a soft, lived-in feel from the first wear.' },
  { name: 'Peace Sign Graphic Tee', category: 'apparel', price: 289900, stock: 64, images: [img('1503341455253-b2e723bb3dbb')],
    description: 'Relaxed-fit black tee with a hand-drawn skeleton peace sign print. Heavyweight cotton with a ribbed crew neck.' },
  { name: 'Crest Logo Tee', category: 'apparel', price: 249900, stock: 80, images: [img('1618354691373-d851c5c3a990')],
    description: 'Clean black tee finished with a small embroidered crest on the chest. Boxy cut, dropped shoulders.' },
  { name: 'Retro Cat Graphic Tee', category: 'apparel', price: 269900, compareAt: 339900, stock: 45, images: [img('1576566588028-4147f3842f27')],
    description: 'Vintage-wash tee in sand with a playful retro cat graphic. Soft, slightly faded and made to be worn on repeat.' },
  { name: 'Heavyweight Fleece Hoodie', category: 'apparel', price: 739900, stock: 70, images: [img('1556821840-3a63f95609a7')],
    description: '480gsm brushed-back fleece in heather grey. Double-lined hood, kangaroo pocket and ribbed cuffs that hold their shape.' },
  { name: 'Hand-Knit Fringe Poncho', category: 'apparel', price: 639900, stock: 18, images: [img('1434389677669-e08b4cac3105')],
    description: 'Open-knit cream poncho with a V-neck and fringed hem. Hand-knitted from soft cotton blend — layer it over anything.' },
  { name: 'Suede Bomber Jacket', category: 'apparel', price: 1819900, stock: 9, images: [img('1591047139829-d91aecb6caea')],
    description: 'Tobacco suede bomber with ribbed trims and a satin lining. A modern take on a classic silhouette.' },
  { name: 'Sunburst Lounge Set', category: 'apparel', price: 819900, compareAt: 1069900, stock: 30, images: [img('1515886657613-9f3515b0c78f')],
    description: 'Matching cropped hoodie and joggers in sunshine yellow. Brushed cotton fleece for maximum comfort.' },
  { name: 'Tailored Navy Suit', category: 'apparel', price: 3989900, stock: 7, images: [img('1617137968427-85924c800a22')],
    description: 'Slim-fit two-piece suit in Italian wool with a subtle sheen. Half-canvassed jacket and flat-front trousers.' },

  // Footwear
  { name: 'Aero Knit Runner', category: 'footwear', price: 1079900, stock: 40, images: [img('1491553895911-0055eca6402d')], featured: true,
    description: 'Featherlight knit upper on a responsive foam midsole. Engineered for daily miles and all-day city wear.' },
  { name: 'Emerald Suede Brogue', category: 'footwear', price: 1539900, stock: 14, images: [img('1560343090-f0409e92791a')],
    description: 'Handcrafted brogue in deep emerald suede with a stacked leather sole. Goodyear-welted to last for years.' },
  { name: 'Prism Chunky Sneaker', category: 'footwear', price: 959900, compareAt: 1209900, stock: 3, images: [img('1560769629-975ec94e6a86')],
    description: 'Statement sneaker with layered mesh and suede panels in a multicolour palette over a chunky sole.' },

  // Accessories
  { name: 'Minimal Chrono Watch', category: 'accessories', price: 1369900, stock: 25, images: [img('1523275335684-37898b6baf30')], featured: true,
    description: 'Clean white dial in a brushed steel case with a silicone strap. Sapphire crystal and 50m water resistance.' },
  { name: 'Heritage Chronograph', category: 'accessories', price: 2489900, compareAt: 2899900, stock: 8, images: [img('1622434641406-a158123450f9')],
    description: 'Bronze-tone chronograph with a textured dial, tachymeter bezel and a dark leather strap.' },
  { name: 'Skeleton Automatic Watch', category: 'accessories', price: 3529900, stock: 5, images: [img('1524805444758-089113d48a6d')], featured: true,
    description: 'Open-heart automatic movement visible through the dial. Polished steel case on hand-stitched brown leather.' },
  { name: 'Classic Wayfarer Sunglasses', category: 'accessories', price: 1209900, stock: 36, images: [img('1572635196237-14b3f281503f')],
    description: 'Timeless acetate frames with polarised, 100% UV-protective lenses. Includes a leather case.' },
  { name: 'Commuter Backpack', category: 'accessories', price: 999900, stock: 28, images: [img('1553062407-98eeb64c6a62')],
    description: 'Water-resistant navy backpack with a padded 16" laptop sleeve, hidden back pocket and luggage pass-through.' },
  { name: 'Heritage Leather Backpack', category: 'accessories', price: 2199900, stock: 10, images: [img('1622560480605-d83c853bc5c3')],
    description: 'Vegetable-tanned leather backpack that develops a rich patina over time. Brass zips and a cotton-lined interior.' },
  { name: 'Scarlet Top-Handle Bag', category: 'accessories', price: 2619900, compareAt: 3159900, stock: 6, images: [img('1584917865442-de89df76afd3')],
    description: 'Structured top-handle bag in scarlet pebbled leather with a turn-lock closure and detachable shoulder strap.' },

  // Electronics
  { name: 'Studio Wireless Headphones', category: 'electronics', price: 2069900, compareAt: 2489900, stock: 22, images: [img('1505740420928-5e560c06d30e')], featured: true,
    description: 'Adaptive noise cancelling, 40-hour battery and plush memory-foam cushions. Studio-grade sound, untethered.' },
  { name: 'Monitor Over-Ear Headphones', category: 'electronics', price: 1319900, stock: 30, images: [img('1583394838336-acd977736f90')],
    description: 'Closed-back monitor headphones with a flat, accurate response. Detachable cable and swivelling earcups.' },
  { name: 'Pulse Smartwatch', category: 'electronics', price: 3319900, stock: 15, images: [img('1546868871-7041f2a55e12')],
    description: 'Always-on display, heart-rate and sleep tracking, GPS and up to 18 hours of battery life.' },
  { name: 'Bookshelf Speaker Pair', category: 'electronics', price: 2899900, stock: 11, images: [img('1545454675-3531b543be5d')],
    description: 'Powered two-way bookshelf speakers with Bluetooth, optical input and a warm walnut finish.' },
  { name: 'True Wireless Earbuds', category: 'electronics', price: 1079900, compareAt: 1319900, stock: 48, images: [img('1590658268037-6bf12165a8df')],
    description: 'Compact earbuds with active noise cancelling, transparency mode and a pocketable wireless charging case.' },
  { name: 'Sport Wireless Earbuds', category: 'electronics', price: 739900, stock: 0, images: [img('1606220588913-b3aacb4d2f46')],
    description: 'Sweat-proof earbuds with secure-fit wings and punchy bass. 8 hours per charge, 24 with the case.' },
  { name: 'Ultrabook 14', category: 'electronics', price: 10789900, stock: 6, images: [img('1496181133206-80ce9b88a853')],
    description: '14" aluminium ultrabook with a 2.8K display, 16GB RAM, 1TB SSD and all-day battery. Under 1.3kg.' },

  // Home & Living
  { name: 'Velvet Three-Seat Sofa', category: 'home-living', price: 12449900, compareAt: 14939900, stock: 4, images: [img('1555041469-a586c61ea9bc')], featured: true,
    description: 'Deep emerald velvet sofa with feather-wrapped cushions and solid oak legs. Generous, sink-in comfort.' },
  { name: 'Tufted Accent Chair', category: 'home-living', price: 3489900, stock: 9, images: [img('1567538096630-e0c55bd6374c')],
    description: 'Button-tufted chair in ivory bouclé on carved white legs. A sculptural statement for any corner.' },
  { name: 'Nordic Dining Chair', category: 'home-living', price: 1159900, stock: 40, images: [img('1592078615290-033ee584e267')],
    description: 'Moulded seat with a padded cushion on solid beech legs. Sold individually.' },
  { name: 'Arc Floor Lamp', category: 'home-living', price: 1569900, stock: 16, images: [img('1507473885765-e6ed057f782c')],
    description: 'Adjustable steel floor lamp with a matte grey dome shade. Perfect for reading nooks.' },
  { name: 'Dome Pendant Light', category: 'home-living', price: 829900, stock: 2, images: [img('1513506003901-1e6a229e2d15')],
    description: 'Spun-metal pendant in soft white with a frosted diffuser for glare-free light over tables and islands.' },
  { name: 'Potted Succulent', category: 'home-living', price: 199900, stock: 90, images: [img('1485955900006-10f4d324d411')],
    description: 'An easy-going aloe succulent in a mint ceramic pot. Thrives on neglect and bright light.' },
  { name: 'Vintage Woven Rug', category: 'home-living', price: 3199900, stock: 7, images: [img('1600166898405-da9535204843')],
    description: 'Hand-loomed rug in muted cream and gold with a softly distressed vintage pattern. 160 × 230 cm.' },

  // Beauty
  { name: 'Hydrating Cream Cleanser', category: 'beauty', price: 269900, stock: 75, images: [img('1620916566398-39f1143ab7be')],
    description: 'Gentle, non-foaming cleanser with ceramides and oat extract that removes makeup without stripping.' },
  { name: 'Botanical Body Lotion Trio', category: 'beauty', price: 489900, compareAt: 599900, stock: 34, images: [img('1631729371254-42c2892f0e6e')], featured: true,
    description: 'Three lightweight body lotions — neroli, cedar and fig — with shea butter and squalane.' },
  { name: 'Artisan Lavender Soap Set', category: 'beauty', price: 219900, stock: 60, images: [img('1600857544200-b2f666a9a2ec')],
    description: 'Cold-process soaps made in small batches with lavender essential oil and olive oil. Set of four.' },
  { name: 'Radiance Face Oil', category: 'beauty', price: 569900, stock: 3, images: [img('1612817288484-6f916006741a')],
    description: 'Rosehip and sea buckthorn face oil that restores glow overnight. Cold-pressed and fragrance-free.' },
]

const firstNames = ['Olivia', 'Liam', 'Emma', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'Lucas', 'Mia', 'Aarav', 'Priya', 'Kenji', 'Zara', 'Mateo', 'Chloe', 'Omar']
const lastNames = ['Carter', 'Nguyen', 'Patel', 'Garcia', 'Kim', 'Rossi', 'Okafor', 'Silva', 'Müller', 'Haddad', 'Johansson', 'Tanaka']
const cities = [
  { city: 'Austin', state: 'TX', postalCode: '78701' },
  { city: 'Portland', state: 'OR', postalCode: '97205' },
  { city: 'Brooklyn', state: 'NY', postalCode: '11201' },
  { city: 'Denver', state: 'CO', postalCode: '80202' },
  { city: 'Chicago', state: 'IL', postalCode: '60607' },
  { city: 'San Diego', state: 'CA', postalCode: '92101' },
]

const reviewTexts = [
  { rating: 5, title: 'Absolutely love it', body: 'The quality is outstanding and it looks even better in person. Would buy again in a heartbeat.' },
  { rating: 5, title: 'Exceeded expectations', body: 'Arrived quickly and beautifully packaged. Feels premium and well made.' },
  { rating: 4, title: 'Really good', body: 'Great quality for the price. Took a star off because delivery took a little longer than expected.' },
  { rating: 4, title: 'Very happy', body: 'Exactly as described. Fit and finish are excellent.' },
  { rating: 5, title: 'My new favourite', body: "I've been using it every day since it arrived. Highly recommend." },
  { rating: 3, title: 'Good, not perfect', body: 'Nice overall but the colour is slightly different to the photos.' },
  { rating: 4, title: 'Solid purchase', body: 'Does exactly what I wanted. Would recommend to friends.' },
  { rating: 2, title: 'Not for me', body: 'Quality is fine but it just did not suit me. Returns were easy though.' },
]

async function main() {
  console.log('Clearing existing data…')
  await prisma.$transaction([
    prisma.idempotencyKey.deleteMany(),
    prisma.paymentEvent.deleteMany(),
    prisma.orderNotification.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.wishlistItem.deleteMany(),
    prisma.review.deleteMany(),
    prisma.address.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.coupon.deleteMany(),
    prisma.user.deleteMany(),
  ])

  console.log('Creating categories & products…')
  const categoryIds: Record<string, string> = {}
  for (const c of categories) categoryIds[c.slug] = (await prisma.category.create({ data: c })).id

  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000
  const createdProducts = []
  for (const [i, p] of products.entries()) {
    const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    createdProducts.push(
      await prisma.product.create({
        data: {
          name: p.name,
          slug,
          description: p.description,
          priceCents: p.price,
          compareAtPriceCents: p.compareAt ?? null,
          sku: `SKU-${String(1000 + i)}`,
          stock: p.stock,
          images: p.images,
          categoryId: categoryIds[p.category]!,
          featured: p.featured ?? false,
          createdAt: new Date(now - (products.length - i) * DAY * 2),
        },
      }),
    )
  }

  console.log('Creating users…')
  const adminHash = await bcrypt.hash('admin1234', 12)
  const customerHash = await bcrypt.hash('demo1234', 12)
  await prisma.user.create({ data: { email: 'admin@ecom.dev', name: 'Store Admin', role: 'ADMIN', passwordHash: adminHash } })

  const demo = await prisma.user.create({
    data: {
      email: 'demo@ecom.dev',
      name: 'Alex Morgan',
      passwordHash: customerHash,
      addresses: {
        create: [
          { fullName: 'Alex Morgan', line1: '221 Market Street', line2: 'Apt 4B', city: 'San Francisco', state: 'CA', postalCode: '94105', country: 'United States', phone: '+1 415 555 0134', isDefault: true },
          { fullName: 'Alex Morgan', line1: '88 Harbor Way', city: 'Seattle', state: 'WA', postalCode: '98101', country: 'United States' },
        ],
      },
    },
  })

  const customers = [demo]
  for (let i = 0; i < 24; i++) {
    const first = pick(firstNames)
    const last = pick(lastNames)
    const loc = pick(cities)
    customers.push(
      await prisma.user.create({
        data: {
          email: `${first}.${last}.${i}`.toLowerCase().normalize('NFKD').replace(/[^a-z0-9.]/g, '') + '@example.com',
          name: `${first} ${last}`,
          passwordHash: customerHash,
          createdAt: new Date(now - int(1, 120) * DAY),
          addresses: {
            create: { fullName: `${first} ${last}`, line1: `${int(10, 999)} ${pick(['Oak', 'Maple', 'Pine', 'Cedar', 'Elm'])} Ave`, ...loc, country: 'United States', isDefault: true },
          },
        },
      }),
    )
  }

  console.log('Creating reviews…')
  for (const product of createdProducts) {
    const reviewers = [...customers].sort(() => rand() - 0.5).slice(0, int(0, 7))
    for (const user of reviewers) {
      const r = pick(reviewTexts)
      await prisma.review.create({
        data: { ...r, productId: product.id, userId: user.id, createdAt: new Date(now - int(1, 90) * DAY) },
      })
    }
    const agg = await prisma.review.aggregate({ where: { productId: product.id }, _avg: { rating: true }, _count: { _all: true } })
    await prisma.product.update({
      where: { id: product.id },
      data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count._all },
    })
  }

  console.log('Creating coupons…')
  await prisma.coupon.createMany({
    data: [
      { code: 'WELCOME10', description: '10% off your order', type: 'PERCENT', value: 10 },
      { code: 'SAVE200', description: '₹200 off orders over ₹2,000', type: 'FIXED', value: 20000, minSubtotalCents: 200000 },
      { code: 'SUMMER25', description: '25% off — summer sale', type: 'PERCENT', value: 25, expiresAt: new Date(now - 30 * DAY), isActive: false },
      { code: 'VIP500', description: '₹500 off for VIP customers', type: 'FIXED', value: 50000, minSubtotalCents: 500000, maxUses: 100, usedCount: 12 },
    ],
  })

  console.log('Creating order history…')
  // Historical orders are seeded as already paid (paymentProvider "seed") so the admin dashboard has data.
  const addresses = await prisma.address.findMany()
  for (let i = 0; i < 220; i++) {
    const user = i < 4 ? demo : pick(customers)
    const address = addresses.find((a) => a.userId === user.id)!
    const daysAgo = i < 4 ? [2, 9, 21, 40][i]! : int(0, 75)
    const createdAt = new Date(now - daysAgo * DAY - int(0, 23) * 60 * 60 * 1000)
    const lines = [...createdProducts].sort(() => rand() - 0.5).slice(0, int(1, 3)).map((p) => ({ p, quantity: int(1, 2) }))
    const subtotal = lines.reduce((s, l) => s + l.p.priceCents * l.quantity, 0)
    // Mirrors apps/api/src/lib/pricing.ts: ₹99 shipping, free from ₹2,999; prices include 18% GST
    const shipping = subtotal >= 299900 ? 0 : 9900
    const tax = Math.round((subtotal * 0.18) / 1.18)

    const status: OrderStatus =
      daysAgo > 10 ? (rand() < 0.08 ? 'CANCELLED' : 'DELIVERED')
      : daysAgo > 4 ? pick(['SHIPPED', 'DELIVERED', 'SHIPPED'] as const)
      : daysAgo > 1 ? pick(['PROCESSING', 'PAID', 'SHIPPED'] as const)
      : pick(['PAID', 'PENDING_PAYMENT', 'PAID'] as const)
    const paid = status !== 'PENDING_PAYMENT' && status !== 'CANCELLED'
    const { fullName, line1, line2, city, state: region, postalCode, country, phone } = address

    await prisma.order.create({
      data: {
        userId: user.id,
        email: user.email,
        status,
        paymentStatus: paid ? 'PAID' : 'UNPAID',
        paymentProvider: paid ? 'seed' : null,
        paymentRef: paid ? `seed_${i}` : null,
        shippingAddress: { fullName, line1, line2, city, state: region, postalCode, country, phone },
        shippingMethod: rand() < 0.8 ? 'standard' : 'express',
        subtotalCents: subtotal,
        shippingCents: shipping,
        taxCents: tax,
        totalCents: subtotal + shipping,
        createdAt,
        paidAt: paid ? createdAt : null,
        shippedAt: status === 'SHIPPED' || status === 'DELIVERED' ? new Date(createdAt.getTime() + DAY) : null,
        deliveredAt: status === 'DELIVERED' ? new Date(createdAt.getTime() + 4 * DAY) : null,
        cancelledAt: status === 'CANCELLED' ? new Date(createdAt.getTime() + DAY / 2) : null,
        items: {
          create: lines.map(({ p, quantity }) => ({ productId: p.id, name: p.name, imageUrl: p.images[0] ?? null, priceCents: p.priceCents, quantity })),
        },
      },
    })
  }

  // A couple of wishlist items for the demo user
  await prisma.wishlistItem.createMany({
    data: createdProducts.filter((p) => p.featured).slice(0, 3).map((p) => ({ userId: demo.id, productId: p.id })),
  })

  console.log(`
Seed complete:
  ${categories.length} categories, ${products.length} products, ${customers.length} customers, 220 orders

  Admin:    admin@ecom.dev / admin1234
  Customer: demo@ecom.dev  / demo1234
  Coupons:  WELCOME10, SAVE200 (min ₹2,000), VIP500 (min ₹5,000)
`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
