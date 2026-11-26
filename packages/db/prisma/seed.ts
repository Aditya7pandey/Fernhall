import 'dotenv/config'
import bcrypt from 'bcryptjs'
import type { NotificationKind, OrderStatus, Prisma } from '../src/generated/prisma/client.js'
import { prisma } from '../src/index.js'

/**
 * Demo seed — WIPES and repopulates the database. Never run against production.
 *
 * Builds a realistic, sizeable store so there's something to learn from (pagination, indexes,
 * aggregates, N+1s): ~1,000 customers, ~600 products, a year of orders with growth, weekends and
 * festive-season spikes, verified-purchase reviews, wishlists, carts and notifications.
 *
 * Tune the size:  SEED_CUSTOMERS=1000 SEED_VARIANTS_PER_PRODUCT=15 pnpm db:seed
 * Prices are INR in paise (₹1 = 100), GST-inclusive. Output is deterministic (fixed PRNG seed).
 */

const CUSTOMERS = Number(process.env.SEED_CUSTOMERS ?? 1000)
const VARIANTS_PER_PRODUCT = Number(process.env.SEED_VARIANTS_PER_PRODUCT ?? 15)
const HISTORY_DAYS = 365

const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`

// Deterministic PRNG so every seed produces the same data
let state = 42
const rand = () => ((state = (state * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32)
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min
const chance = (p: number) => rand() < p
const shuffle = <T>(arr: readonly T[]) => [...arr].sort(() => rand() - 0.5)
/** Standard normal via Box–Muller */
const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
let idCounter = 0
/** cuid-looking ids we choose ourselves, so related rows can be bulk-inserted with createMany */
const newId = () => `c${(idCounter++).toString(36).padStart(6, '0')}${Math.floor(rand() * 36 ** 8).toString(36).padStart(8, '0')}seed`
/** Picks index i with probability weights[i] / sum (cumulative table + binary search) */
function weightedPicker(weights: number[]) {
  const cum: number[] = []
  let total = 0
  for (const w of weights) cum.push((total += w))
  return () => {
    const r = rand() * total
    let lo = 0
    let hi = cum.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (cum[mid]! < r) lo = mid + 1
      else hi = mid
    }
    return lo
  }
}
/** createMany in chunks (Postgres allows 65,535 bind parameters per statement) */
async function insertMany<T>(label: string, rows: T[], insert: (chunk: T[]) => Promise<unknown>, size = 1000) {
  for (let i = 0; i < rows.length; i += size) await insert(rows.slice(i, i + size))
  console.log(`  ${label.padEnd(22)} ${rows.length.toLocaleString('en-IN')}`)
}
/** Rounds paise to a "₹x,x99" style price */
const retailPrice = (paise: number) => Math.max(9900, (Math.round(paise / 10000) * 100 - 1) * 100)
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

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

// ─── Catalogue generation ───────────────────────────────────────────────────
// Every curated product above becomes a "family": the original plus generated siblings that
// reuse its photography. Object shots get colour variants via Unsplash's `hue` parameter; photos
// with people or plants (where a hue shift would tint skin/leaves) only get flips and crops.

const FAMILY: Record<string, { noun: string; tint: boolean }> = {
  'Essential Organic Cotton Tee': { noun: 'Tee', tint: false },
  'Peace Sign Graphic Tee': { noun: 'Graphic Tee', tint: false },
  'Crest Logo Tee': { noun: 'Logo Tee', tint: true },
  'Retro Cat Graphic Tee': { noun: 'Print Tee', tint: true },
  'Heavyweight Fleece Hoodie': { noun: 'Hoodie', tint: true },
  'Hand-Knit Fringe Poncho': { noun: 'Poncho', tint: true },
  'Suede Bomber Jacket': { noun: 'Jacket', tint: false },
  'Sunburst Lounge Set': { noun: 'Lounge Set', tint: false },
  'Tailored Navy Suit': { noun: 'Suit', tint: false },
  'Aero Knit Runner': { noun: 'Runner', tint: true },
  'Emerald Suede Brogue': { noun: 'Brogue', tint: true },
  'Prism Chunky Sneaker': { noun: 'Sneaker', tint: true },
  'Minimal Chrono Watch': { noun: 'Watch', tint: true },
  'Heritage Chronograph': { noun: 'Chronograph', tint: true },
  'Skeleton Automatic Watch': { noun: 'Automatic Watch', tint: true },
  'Classic Wayfarer Sunglasses': { noun: 'Sunglasses', tint: true },
  'Commuter Backpack': { noun: 'Backpack', tint: true },
  'Heritage Leather Backpack': { noun: 'Rucksack', tint: true },
  'Scarlet Top-Handle Bag': { noun: 'Handbag', tint: true },
  'Studio Wireless Headphones': { noun: 'Wireless Headphones', tint: true },
  'Monitor Over-Ear Headphones': { noun: 'Over-Ear Headphones', tint: true },
  'Pulse Smartwatch': { noun: 'Smartwatch', tint: true },
  'Bookshelf Speaker Pair': { noun: 'Bookshelf Speakers', tint: true },
  'True Wireless Earbuds': { noun: 'Earbuds', tint: true },
  'Sport Wireless Earbuds': { noun: 'Sport Earbuds', tint: true },
  'Ultrabook 14': { noun: 'Laptop', tint: true },
  'Velvet Three-Seat Sofa': { noun: 'Sofa', tint: true },
  'Tufted Accent Chair': { noun: 'Accent Chair', tint: true },
  'Nordic Dining Chair': { noun: 'Dining Chair', tint: true },
  'Arc Floor Lamp': { noun: 'Floor Lamp', tint: true },
  'Dome Pendant Light': { noun: 'Pendant Light', tint: true },
  'Potted Succulent': { noun: 'Potted Plant', tint: false },
  'Vintage Woven Rug': { noun: 'Rug', tint: true },
  'Hydrating Cream Cleanser': { noun: 'Cleanser', tint: true },
  'Botanical Body Lotion Trio': { noun: 'Body Lotion', tint: true },
  'Artisan Lavender Soap Set': { noun: 'Soap Set', tint: false },
  'Radiance Face Oil': { noun: 'Face Oil', tint: true },
}

const ADJECTIVES: Record<string, string[]> = {
  apparel: ['Relaxed', 'Boxy', 'Oversized', 'Slim', 'Cropped', 'Vintage', 'Washed', 'Everyday', 'Weekend', 'Studio', 'Classic', 'Utility', 'Signature', 'Monsoon', 'Easy'],
  footwear: ['Trail', 'City', 'Everyday', 'Classic', 'Court', 'Retro', 'Featherlight', 'Cushioned', 'Handcrafted', 'Weekend', 'Monsoon', 'Studio'],
  accessories: ['Classic', 'Minimal', 'Field', 'Heritage', 'Explorer', 'Slim', 'Travel', 'Everyday', 'Signature', 'Urban', 'Weekender', 'Compact'],
  'home-living': ['Nordic', 'Mid-Century', 'Coastal', 'Japandi', 'Rustic', 'Modern', 'Classic', 'Curved', 'Low-Profile', 'Handwoven', 'Heritage', 'Studio'],
}
const MATERIALS: Record<string, string[]> = {
  apparel: ['Organic Cotton', 'Linen', 'Slub Cotton', 'Merino', 'Bamboo', 'Recycled', 'Brushed Fleece', 'Waffle-Knit', 'Pima Cotton', 'Khadi'],
  footwear: ['Suede', 'Leather', 'Knit', 'Canvas', 'Mesh', 'Nubuck', 'Recycled'],
  accessories: ['Steel', 'Titanium', 'Leather', 'Canvas', 'Nylon', 'Vegan Leather'],
  'home-living': ['Oak', 'Walnut', 'Rattan', 'Velvet', 'Bouclé', 'Linen', 'Teak', 'Mango Wood'],
  // per-noun overrides where the category list would read oddly
  Suit: ['Wool', 'Linen', 'Tweed', 'Cotton Twill'],
  Jacket: ['Suede', 'Denim', 'Leather', 'Corduroy', 'Quilted'],
  Watch: ['Steel', 'Titanium', 'Rose Gold', 'Ceramic'],
  Chronograph: ['Steel', 'Bronze', 'Titanium'],
  'Automatic Watch': ['Steel', 'Gold-Tone', 'Gunmetal'],
  Sunglasses: ['Acetate', 'Titanium', 'Tortoiseshell', 'Wire-Frame'],
  'Floor Lamp': ['Brass', 'Matte Steel', 'Oak', 'Rattan', 'Marble'],
  'Pendant Light': ['Brass', 'Ceramic', 'Rattan', 'Glass', 'Spun Metal'],
  'Potted Plant': ['Ceramic', 'Terracotta', 'Concrete', 'Glazed'],
  Rug: ['Jute', 'Wool', 'Cotton Dhurrie', 'Hand-Tufted', 'Kilim'],
}
const SERIES = ['Air', 'Pro', 'Max', 'Lite', 'Neo', 'Studio', 'Go', 'Ultra', 'Mini', 'Edge', 'Flex', 'Core', 'Plus', 'X', 'S2', 'Gen 3']
const LINES = ['Aura', 'Pulse', 'Echo', 'Nova', 'Volt', 'Orbit', 'Sonic', 'Zen', 'Halo', 'Drift', 'Prism', 'Lumen']
const INGREDIENTS = ['Vitamin C', 'Rose', 'Niacinamide', 'Green Tea', 'Charcoal', 'Aloe', 'Saffron', 'Sandalwood', 'Hyaluronic', 'Neem', 'Turmeric', 'Ceramide', 'Kumkumadi', 'Coconut', 'Ubtan', 'Rice Water']
const HUES = [25, 55, 90, 140, 180, 220, 270, 310]
const CROPS = ['&crop=focalpoint&fp-x=0.5&fp-y=0.5&fp-z=1.35', '&crop=focalpoint&fp-x=0.45&fp-y=0.4&fp-z=1.6', '&crop=focalpoint&fp-x=0.55&fp-y=0.55&fp-z=1.25']

type GenProduct = {
  id: string
  name: string
  slug: string
  description: string
  priceCents: number
  compareAtPriceCents: number | null
  sku: string
  stock: number
  images: string[]
  categoryId: string
  featured: boolean
  isActive: boolean
  createdAt: Date
  quality: number // hidden: drives review ratings
}

function variantName(base: Seed, used: Set<string>) {
  const { noun } = FAMILY[base.name]!
  for (let attempt = 0; attempt < 60; attempt++) {
    let name: string
    let blurb: string
    if (base.category === 'electronics') {
      const series = pick(SERIES)
      name = `${pick(LINES)} ${noun} ${series}`
      blurb = `The ${series} edition of our ${noun.toLowerCase()} line.`
    } else if (base.category === 'beauty') {
      const a = pick(INGREDIENTS)
      const b = pick(INGREDIENTS)
      name = chance(0.3) && a !== b ? `${a} & ${b} ${noun}` : `${a} ${noun}`
      blurb = `Made with ${a.toLowerCase()}${name.includes('&') ? ` and ${b.toLowerCase()}` : ''}.`
    } else {
      const adj = pick(ADJECTIVES[base.category]!)
      const material = pick(MATERIALS[noun] ?? MATERIALS[base.category]!)
      name = `${adj} ${material} ${noun}`
      blurb = `A ${adj.toLowerCase()} take on the ${base.name.toLowerCase()}, made in ${material.toLowerCase()}.`
    }
    if (!used.has(name)) {
      used.add(name)
      return { name, blurb }
    }
  }
  return null
}

function variantImages(base: Seed) {
  const [main] = base.images as [string]
  if (FAMILY[base.name]!.tint) {
    const hue = `&hue=${pick(HUES)}${chance(0.5) ? '&flip=h' : ''}`
    return [main + hue, main + hue + pick(CROPS)]
  }
  return [main + (chance(0.5) ? '&flip=h' : '') + pick(CROPS), main + '&flip=h']
}

// ─── People & places ────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Rohan', 'Kabir', 'Dhruv', 'Aryan', 'Kunal', 'Nikhil',
  'Rahul', 'Siddharth', 'Varun', 'Yash', 'Harsh', 'Manav', 'Om', 'Pranav', 'Rudra', 'Tanmay', 'Ananya', 'Diya', 'Aadhya', 'Saanvi', 'Myra',
  'Ira', 'Kiara', 'Anika', 'Navya', 'Riya', 'Sara', 'Meera', 'Priya', 'Pooja', 'Sneha', 'Kavya', 'Isha', 'Tanvi', 'Neha', 'Shreya', 'Aisha',
  'Fatima', 'Zoya', 'Imran', 'Farhan', 'Gurpreet', 'Harleen', 'Simran', 'Jaspreet', 'Joseph', 'Maria', 'Anjali', 'Lakshmi', 'Karthik', 'Vikram',
]
const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Iyer', 'Nair', 'Reddy', 'Patel', 'Shah', 'Mehta', 'Joshi', 'Kulkarni', 'Deshpande', 'Banerjee', 'Chatterjee',
  'Das', 'Bose', 'Singh', 'Kaur', 'Khan', 'Ali', 'Qureshi', 'Fernandes', 'D’Souza', 'Pillai', 'Menon', 'Rao', 'Naidu', 'Agarwal', 'Bansal',
  'Malhotra', 'Kapoor', 'Chopra', 'Saxena', 'Mishra', 'Pandey', 'Tiwari', 'Yadav', 'Jain', 'Sethi', 'Bhat',
]
// [city, state, PIN prefix, weight]
const CITIES: [string, string, string, number][] = [
  ['Mumbai', 'Maharashtra', '400', 14], ['Delhi', 'Delhi', '110', 13], ['Bengaluru', 'Karnataka', '560', 14], ['Hyderabad', 'Telangana', '500', 9],
  ['Chennai', 'Tamil Nadu', '600', 8], ['Kolkata', 'West Bengal', '700', 7], ['Pune', 'Maharashtra', '411', 8], ['Ahmedabad', 'Gujarat', '380', 5],
  ['Jaipur', 'Rajasthan', '302', 4], ['Lucknow', 'Uttar Pradesh', '226', 3], ['Kochi', 'Kerala', '682', 3], ['Chandigarh', 'Chandigarh', '160', 3],
  ['Indore', 'Madhya Pradesh', '452', 2], ['Bhopal', 'Madhya Pradesh', '462', 2], ['Surat', 'Gujarat', '395', 2], ['Nagpur', 'Maharashtra', '440', 2],
  ['Guwahati', 'Assam', '781', 2], ['Bhubaneswar', 'Odisha', '751', 2], ['Coimbatore', 'Tamil Nadu', '641', 2], ['Panaji', 'Goa', '403', 1],
  ['Noida', 'Uttar Pradesh', '201', 4], ['Gurugram', 'Haryana', '122', 5], ['Visakhapatnam', 'Andhra Pradesh', '530', 2], ['Patna', 'Bihar', '800', 2],
  ['Dehradun', 'Uttarakhand', '248', 1],
]
const STREETS = [
  'MG Road', 'Linking Road', 'Park Street', 'Brigade Road', 'Anna Salai', 'Road No. 12, Banjara Hills', 'FC Road', 'CG Road', 'Hazratganj',
  'Sector 17', 'Residency Road', '5th Block, Koramangala', '100 Feet Road, Indiranagar', 'Hill Road, Bandra West', 'Sector V, Salt Lake',
  'Civil Lines', 'Model Town', 'Jubilee Hills', 'Hiranandani Gardens, Powai', 'Golf Course Road', 'Sector 62', 'Panampilly Nagar', 'Boring Road',
]
const BUILDINGS = ['Sunrise Apartments', 'Green Park Residency', 'Lotus Towers', 'Silver Oak Society', 'Palm Grove', 'Shanti Niwas', 'Orchid Heights', 'Lake View CHS']
const pickCity = (() => {
  const next = weightedPicker(CITIES.map((c) => c[3]))
  return () => CITIES[next()]!
})()

function makeAddress(userId: string, fullName: string, isDefault: boolean) {
  const [city, state, pin] = pickCity()
  return {
    id: newId(),
    userId,
    fullName,
    line1: `Flat ${int(1, 24)}${pick(['A', 'B', 'C', ''])}0${int(1, 9)}, ${pick(BUILDINGS)}`,
    line2: pick(STREETS),
    city,
    state,
    postalCode: `${pin}${String(int(1, 99)).padStart(3, '0')}`,
    country: 'India',
    phone: `+91 9${int(100000000, 999999999)}`,
    isDefault,
  }
}

const REVIEWS: Record<number, { title: string; body: string }[]> = {
  5: [
    { title: 'Absolutely love it', body: 'The quality is outstanding and it looks even better in person. Would buy again in a heartbeat.' },
    { title: 'Worth every rupee', body: 'Premium feel, great finish, and it arrived well before the promised date.' },
    { title: 'My new favourite', body: "I've been using it every day since it arrived. Highly recommend." },
    { title: 'Exceeded expectations', body: 'Beautifully packaged and feels really well made. Gifted one to my sister too.' },
    { title: 'Perfect', body: 'Exactly what I was looking for. The colour is spot on.' },
  ],
  4: [
    { title: 'Really good', body: 'Great quality for the price. Took a star off because delivery took a little longer than expected.' },
    { title: 'Very happy', body: 'Exactly as described. Fit and finish are excellent.' },
    { title: 'Solid purchase', body: 'Does exactly what I wanted. Would recommend to friends.' },
    { title: 'Good value', body: 'Nice product, would have been five stars with slightly better packaging.' },
  ],
  3: [
    { title: 'Good, not perfect', body: 'Nice overall but the colour is slightly different to the photos.' },
    { title: 'Okay', body: 'It does the job. Nothing special for the price.' },
    { title: 'Average', body: 'Quality is fine, but I expected a bit more from the description.' },
  ],
  2: [
    { title: 'Not for me', body: 'Quality is fine but it just did not suit me. Returns were easy though.' },
    { title: 'Disappointed', body: 'Looked different from the pictures and the material feels thin.' },
  ],
  1: [
    { title: 'Poor quality', body: 'Started showing wear within two weeks. Would not buy again.' },
    { title: 'Not as described', body: 'The size and finish were nothing like the listing.' },
  ],
}

// ─── Time ───────────────────────────────────────────────────────────────────

const NOW = Date.now()
const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000
const MIN = 60 * 1000

/** How busy each day (0 = today … 364) was: growth, weekends and Indian sale seasons. */
function dayWeight(daysAgo: number) {
  const d = new Date(NOW - daysAgo * DAY)
  const md = (d.getMonth() + 1) * 100 + d.getDate()
  let w = 0.7 + 0.8 * (1 - daysAgo / HISTORY_DAYS) // the store is growing
  if (d.getDay() === 0 || d.getDay() === 6) w *= 1.25
  if (md >= 1018 && md <= 1110) w *= 2.4 // Diwali / festive sale
  if (md >= 810 && md <= 816) w *= 1.6 // Independence Day sale
  if (md >= 122 && md <= 127) w *= 1.5 // Republic Day sale
  if (md >= 1226 || md <= 102) w *= 1.4 // year-end sale
  return w
}
const pickDayAgo = weightedPicker(Array.from({ length: HISTORY_DAYS }, (_, d) => dayWeight(d)))
// Evenings are busiest
const pickHour = weightedPicker([1, 0.5, 0.3, 0.2, 0.2, 0.4, 1, 2, 3, 4, 4.5, 5, 5.5, 5, 4.5, 4.5, 5, 5.5, 6.5, 7.5, 8.5, 9, 7, 3.5])
/** A moment `daysAgo` days back at a typical shopping hour (never in the future) */
function momentOn(daysAgo: number) {
  const day = new Date(NOW - daysAgo * DAY)
  day.setHours(pickHour(), int(0, 59), int(0, 59), 0)
  return day.getTime() > NOW ? new Date(NOW - int(5, 300) * MIN) : day
}

// ─── Seed ───────────────────────────────────────────────────────────────────

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
  // Restart order numbers at 1
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Order"', 'number'), 1, false)`)

  console.log('Inserting…')

  // ── Categories
  const categoryIds: Record<string, string> = {}
  for (const c of categories) categoryIds[c.slug] = (await prisma.category.create({ data: c })).id

  // ── Products: the curated originals + generated family members
  const catalogue: GenProduct[] = []
  const usedNames = new Set(products.map((p) => p.name))
  const usedSlugs = new Set<string>()
  const uniqueSlug = (name: string) => {
    let slug = slugify(name)
    for (let n = 2; usedSlugs.has(slug); n++) slug = `${slugify(name)}-${n}`
    usedSlugs.add(slug)
    return slug
  }
  for (const [i, base] of products.entries()) {
    catalogue.push({
      id: newId(),
      name: base.name,
      slug: uniqueSlug(base.name),
      description: base.description,
      priceCents: base.price,
      compareAtPriceCents: base.compareAt ?? null,
      sku: `FH-${String(1000 + i)}`,
      stock: base.stock,
      images: base.images,
      categoryId: categoryIds[base.category]!,
      featured: base.featured ?? false,
      isActive: true,
      createdAt: new Date(NOW - (HISTORY_DAYS + int(1, 30)) * DAY), // on sale before the history starts
      quality: 4.1 + rand() * 0.8,
    })
    for (let v = 0; v < VARIANTS_PER_PRODUCT; v++) {
      const named = variantName(base, usedNames)
      if (!named) continue
      const price = retailPrice(base.price * (0.55 + rand()))
      const stockRoll = rand()
      catalogue.push({
        id: newId(),
        name: named.name,
        slug: uniqueSlug(named.name),
        description: `${named.blurb} ${base.description}`,
        priceCents: price,
        compareAtPriceCents: chance(0.18) ? retailPrice(price * (1.15 + rand() * 0.3)) : null,
        sku: `FH-${String(1000 + i)}-${String(v + 1).padStart(2, '0')}`,
        stock: stockRoll < 0.05 ? 0 : stockRoll < 0.15 ? int(1, 5) : int(6, 180),
        images: variantImages(base),
        categoryId: categoryIds[base.category]!,
        featured: chance(0.02),
        isActive: !chance(0.02), // a few discontinued
        createdAt: new Date(NOW - int(1, 360) * DAY - int(0, 23) * HOUR),
        quality: 2.9 + rand() * 2,
      })
    }
  }
  await insertMany('products', catalogue, (chunk) =>
    prisma.product.createMany({ data: chunk.map(({ quality: _q, ...p }) => p) }),
  )

  // Popularity follows a long tail: a few bestsellers, many slow movers. Originals sell more.
  const popularity: number[] = new Array(catalogue.length)
  shuffle(catalogue.map((_, i) => i)).forEach((productIndex, rank) => (popularity[productIndex] = 1 / (rank + 8) ** 0.9))
  catalogue.forEach((p, i) => {
    if (products.some((b) => b.name === p.name)) popularity[i]! *= 4
    if (!p.isActive) popularity[i] = 0.0001
  })
  const pickProductIndex = weightedPicker(popularity)
  const originals = catalogue.filter((p) => products.some((b) => b.name === p.name))
  /** A product that already existed at `when` */
  function productAvailableAt(when: Date) {
    for (let t = 0; t < 12; t++) {
      const p = catalogue[pickProductIndex()]!
      if (p.createdAt <= when) return p
    }
    return pick(originals) // the curated originals have been on sale the whole year
  }

  // ── Users: admin, the demo customer, then CUSTOMERS more
  const adminHash = await bcrypt.hash('admin1234', 12)
  const customerHash = await bcrypt.hash('demo1234', 12) // every seeded customer shares this password
  const pickSignupDay = weightedPicker(Array.from({ length: HISTORY_DAYS }, (_, d) => (d < HISTORY_DAYS - 20 ? 0.75 + (1 - d / HISTORY_DAYS) * 0.6 : 3)))

  type U = { id: string; email: string; name: string; createdAt: Date; activity: number }
  const users: (U & { role: 'ADMIN' | 'CUSTOMER'; passwordHash: string })[] = [
    { id: newId(), email: 'admin@ecom.dev', name: 'Store Admin', role: 'ADMIN', passwordHash: adminHash, createdAt: new Date(NOW - 365 * DAY), activity: 0 },
    { id: newId(), email: 'demo@ecom.dev', name: 'Alex Morgan', role: 'CUSTOMER', passwordHash: customerHash, createdAt: new Date(NOW - 360 * DAY), activity: 14 },
  ]
  const demo = users[1]!
  const emails = new Set(users.map((u) => u.email))
  for (let i = 0; i < CUSTOMERS; i++) {
    const first = pick(FIRST_NAMES)
    const last = pick(LAST_NAMES)
    let email = `${first}.${last}`.toLowerCase().normalize('NFKD').replace(/[^a-z.]/g, '') + '@example.com'
    for (let n = 2; emails.has(email); n++) email = email.replace(/\d*@/, `${n}@`)
    emails.add(email)
    // Orders per customer: ~25% never buy, most buy a few times, a few are loyal regulars
    const r = rand()
    const activity = r < 0.25 ? 0 : r < 0.55 ? int(1, 3) : r < 0.85 ? int(4, 10) : int(12, 40)
    users.push({ id: newId(), email, name: `${first} ${last}`, role: 'CUSTOMER', passwordHash: customerHash, createdAt: momentOn(pickSignupDay()), activity })
  }
  await insertMany('users', users, (chunk) =>
    prisma.user.createMany({ data: chunk.map(({ activity: _a, ...u }) => u) }),
  )
  const customers = users.filter((u) => u.role === 'CUSTOMER')

  // ── Addresses (1–2 each; the first is the default)
  const addresses: ReturnType<typeof makeAddress>[] = []
  const defaultAddress = new Map<string, ReturnType<typeof makeAddress>>()
  for (const u of customers) {
    const home = makeAddress(u.id, u.name, true)
    if (u === demo) Object.assign(home, { line1: 'Flat 4B, Prestige Lakeside', line2: '100 Feet Road, Indiranagar', city: 'Bengaluru', state: 'Karnataka', postalCode: '560038', phone: '+91 98450 01234' })
    addresses.push(home)
    defaultAddress.set(u.id, home)
    if (u === demo || chance(0.3)) addresses.push(makeAddress(u.id, u.name, false))
  }
  await insertMany('addresses', addresses, (chunk) => prisma.address.createMany({ data: chunk }))

  // ── Coupons
  const festiveEnd = new Date(new Date(NOW).getFullYear(), 10, 12)
  await prisma.coupon.createMany({
    data: [
      { code: 'WELCOME10', description: '10% off your first order', type: 'PERCENT', value: 10 },
      { code: 'SAVE200', description: '₹200 off orders over ₹2,000', type: 'FIXED', value: 20000, minSubtotalCents: 200000 },
      { code: 'VIP500', description: '₹500 off orders over ₹5,000', type: 'FIXED', value: 50000, minSubtotalCents: 500000, maxUses: 1000 },
      { code: 'FESTIVE15', description: '15% off — festive sale', type: 'PERCENT', value: 15, expiresAt: festiveEnd },
      { code: 'SUMMER25', description: '25% off — summer sale', type: 'PERCENT', value: 25, expiresAt: new Date(NOW - 120 * DAY), isActive: false },
    ],
  })
  const coupons = await prisma.coupon.findMany()
  const coupon = (code: string) => coupons.find((c) => c.code === code)!
  const isFestive = (d: Date) => {
    const md = (d.getMonth() + 1) * 100 + d.getDate()
    return md >= 1018 && md <= 1112
  }

  // ── Orders
  type OrderRow = Prisma.OrderCreateManyInput & { id: string; createdAt: Date; userId: string }
  type ItemRow = Prisma.OrderItemCreateManyInput & { productId: string }
  const orders: OrderRow[] = []
  const items: ItemRow[] = []
  const deliveredLines: { userId: string; productId: string; deliveredAt: Date }[] = []
  let paymentSeq = 0

  function addOrder(user: U, createdAt: Date, opts: { pending?: boolean; isFirst: boolean }) {
    const addr = defaultAddress.get(user.id)!
    const lineCount = pick([1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4])
    const chosen = new Map<string, { p: GenProduct; quantity: number }>()
    for (let l = 0; l < lineCount; l++) {
      const p = productAvailableAt(createdAt)
      const prev = chosen.get(p.id)
      chosen.set(p.id, { p, quantity: (prev?.quantity ?? 0) + (chance(0.85) ? 1 : int(2, 3)) })
    }
    const lines = [...chosen.values()]
    const subtotal = lines.reduce((s, l) => s + l.p.priceCents * l.quantity, 0)

    // Coupons — mirrors apps/api/src/lib/pricing.ts
    let used: (typeof coupons)[number] | null = null
    if (opts.isFirst && chance(0.3)) used = coupon('WELCOME10')
    else if (isFestive(createdAt) && createdAt <= festiveEnd && chance(0.35)) used = coupon('FESTIVE15')
    else if (subtotal >= 500000 && chance(0.06)) used = coupon('VIP500')
    else if (subtotal >= 200000 && chance(0.08)) used = coupon('SAVE200')
    const discount = !used ? 0 : Math.min(used.type === 'PERCENT' ? Math.round((subtotal * used.value) / 100) : used.value, subtotal)
    const method = chance(0.8) ? 'standard' : 'express'
    const shipping = method === 'express' ? 24900 : subtotal >= 299900 ? 0 : 9900
    const taxable = subtotal - discount
    const tax = Math.round((taxable * 0.18) / 1.18)

    // Lifecycle: abandoned / cancelled before paying, or paid → processing → shipped → delivered
    let status: OrderStatus
    const t = createdAt.getTime()
    let paidAt: Date | null = null
    let shippedAt: Date | null = null
    let deliveredAt: Date | null = null
    let cancelledAt: Date | null = null
    const roll = rand()
    if (opts.pending) status = 'PENDING_PAYMENT'
    else if (roll < 0.05) {
      status = 'CANCELLED' // never paid → expired by the order.expire job after 30 min
      cancelledAt = new Date(t + 30 * MIN)
    } else if (roll < 0.07) {
      status = 'CANCELLED' // customer cancelled before paying
      cancelledAt = new Date(t + int(2, 25) * MIN)
    } else {
      paidAt = new Date(t + int(1, 6) * MIN)
      const ship = paidAt.getTime() + int(10, 44) * HOUR
      const deliver = ship + (method === 'express' ? int(18, 40) : int(48, 130)) * HOUR
      if (deliver <= NOW) {
        status = 'DELIVERED'
        shippedAt = new Date(ship)
        deliveredAt = new Date(deliver)
      } else if (ship <= NOW) {
        status = 'SHIPPED'
        shippedAt = new Date(ship)
      } else status = paidAt.getTime() + 5 * HOUR <= NOW ? 'PROCESSING' : 'PAID'
    }
    if (cancelledAt && cancelledAt.getTime() > NOW) cancelledAt = new Date(NOW)
    const paid = paidAt !== null

    const id = newId()
    const { fullName, line1, line2, city, state: region, postalCode, country, phone } = addr
    orders.push({
      id,
      userId: user.id,
      email: user.email,
      status,
      shippingAddress: { fullName, line1, line2, city, state: region, postalCode, country, phone },
      shippingMethod: method,
      subtotalCents: subtotal,
      discountCents: discount,
      shippingCents: shipping,
      taxCents: tax,
      totalCents: taxable + shipping,
      couponCode: used?.code ?? null,
      currency: 'INR',
      paymentStatus: paid ? 'PAID' : 'UNPAID',
      paymentProvider: paid ? 'seed' : null,
      paymentRef: paid ? `seed_pay_${++paymentSeq}` : null,
      paidAt,
      shippedAt,
      deliveredAt,
      cancelledAt,
      createdAt,
      updatedAt: deliveredAt ?? shippedAt ?? cancelledAt ?? paidAt ?? createdAt,
    })
    for (const { p, quantity } of lines) {
      items.push({ id: newId(), orderId: id, productId: p.id, name: p.name, imageUrl: p.images[0] ?? null, priceCents: p.priceCents, quantity })
      if (deliveredAt) deliveredLines.push({ userId: user.id, productId: p.id, deliveredAt })
    }
  }

  for (const u of customers) {
    const signupDaysAgo = Math.floor((NOW - u.createdAt.getTime()) / DAY)
    const dates: Date[] = []
    for (let n = 0; n < u.activity; n++) {
      let d = pickDayAgo()
      for (let tries = 0; d > signupDaysAgo && tries < 30; tries++) d = pickDayAgo()
      if (d > signupDaysAgo) d = int(0, signupDaysAgo)
      dates.push(momentOn(d))
    }
    if (u === demo) dates.push(new Date(NOW - 2 * HOUR), new Date(NOW - 26 * HOUR), new Date(NOW - 3 * DAY)) // recent ones in every state
    dates.sort((a, b) => a.getTime() - b.getTime())
    dates.forEach((d, n) => addOrder(u, d < u.createdAt ? u.createdAt : d, { isFirst: n === 0 }))
  }
  // A handful of orders placed in the last few minutes, still awaiting payment.
  // The worker's sweep job will expire them ~35 min after you seed — watch it happen.
  for (let i = 0; i < 4; i++) addOrder(i === 0 ? demo : pick(customers), new Date(NOW - int(2, 15) * MIN), { pending: true, isFirst: false })

  // Insert in time order so the sequential order number follows the calendar
  const order = new Map(orders.map((o, i) => [o.id, i]))
  orders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  items.sort((a, b) => order.get(a.orderId)! - order.get(b.orderId)!)
  await insertMany('orders', orders, (chunk) => prisma.order.createMany({ data: chunk }), 500)
  await insertMany('order items', items, (chunk) => prisma.orderItem.createMany({ data: chunk }))

  // ── Reviews: only from customers whose order was delivered (verified purchases)
  const reviewed = new Set<string>()
  const reviews: Prisma.ReviewCreateManyInput[] = []
  const quality = new Map(catalogue.map((p) => [p.id, p.quality]))
  for (const line of deliveredLines) {
    const key = `${line.productId}:${line.userId}`
    if (reviewed.has(key) || !chance(0.24)) continue
    const createdAt = new Date(line.deliveredAt.getTime() + int(1, 20) * DAY + int(0, 23) * HOUR)
    if (createdAt.getTime() > NOW) continue
    reviewed.add(key)
    const rating = Math.min(5, Math.max(1, Math.round(quality.get(line.productId)! + gauss() * 0.9)))
    reviews.push({ id: newId(), productId: line.productId, userId: line.userId, rating, ...pick(REVIEWS[rating]!), createdAt, updatedAt: createdAt })
  }
  await insertMany('reviews', reviews, (chunk) => prisma.review.createMany({ data: chunk }))

  // ── Wishlists (~45% of customers) and open carts (~12%)
  const wishlist: Prisma.WishlistItemCreateManyInput[] = []
  const carts: Prisma.CartCreateManyInput[] = []
  const cartItems: Prisma.CartItemCreateManyInput[] = []
  for (const u of customers) {
    if (u === demo || chance(0.45)) {
      const seen = new Set<string>()
      for (let n = u === demo ? 5 : int(1, 10); n > 0; n--) {
        const p = productAvailableAt(new Date(NOW))
        if (seen.has(p.id) || !p.isActive) continue
        seen.add(p.id)
        wishlist.push({ userId: u.id, productId: p.id, createdAt: new Date(Math.max(u.createdAt.getTime(), NOW - int(0, 120) * DAY)) })
      }
    }
    if (u === demo || chance(0.12)) {
      const cartId = newId()
      carts.push({ id: cartId, userId: u.id })
      const seen = new Set<string>()
      for (let n = int(1, 3); n > 0; n--) {
        const p = productAvailableAt(new Date(NOW))
        if (seen.has(p.id) || !p.isActive || p.stock === 0) continue
        seen.add(p.id)
        cartItems.push({ id: newId(), cartId, productId: p.id, quantity: 1 })
      }
    }
  }
  await insertMany('wishlist items', wishlist, (chunk) => prisma.wishlistItem.createMany({ data: chunk }))
  await insertMany('carts', carts, (chunk) => prisma.cart.createMany({ data: chunk }))
  await insertMany('cart items', cartItems, (chunk) => prisma.cartItem.createMany({ data: chunk }))

  // ── Notifications for the last 14 days (what the queue workers would have sent)
  const notifications: Prisma.OrderNotificationCreateManyInput[] = []
  const note = (orderId: string, email: string, kind: NotificationKind, sentAt: Date) => {
    const old = NOW - sentAt.getTime() > 2 * DAY
    notifications.push({ id: newId(), orderId, kind, recipient: email, sentAt, readAt: old || chance(0.4) ? new Date(Math.min(NOW, sentAt.getTime() + int(1, 30) * HOUR)) : null })
  }
  for (const o of orders) {
    if (NOW - o.createdAt.getTime() > 14 * DAY) continue
    note(o.id, o.email, 'ORDER_RECEIVED', new Date(o.createdAt.getTime() + 4000))
    if (o.paidAt) note(o.id, o.email, 'PAYMENT_CONFIRMED', new Date((o.paidAt as Date).getTime() + 6000))
    if (o.status === 'CANCELLED' && o.cancelledAt && (o.cancelledAt as Date).getTime() - o.createdAt.getTime() >= 30 * MIN) {
      note(o.id, o.email, 'ORDER_EXPIRED', o.cancelledAt as Date)
    }
  }
  await insertMany('notifications', notifications, (chunk) => prisma.orderNotification.createMany({ data: chunk }))

  // ── Denormalised counters, computed in SQL (one statement each instead of 600 round-trips)
  await prisma.$executeRawUnsafe(`
    UPDATE "Product" p SET "ratingAvg" = s.avg, "ratingCount" = s.cnt
    FROM (SELECT "productId", ROUND(AVG(rating)::numeric, 1)::float AS avg, COUNT(*)::int AS cnt FROM "Review" GROUP BY "productId") s
    WHERE p.id = s."productId"`)
  await prisma.$executeRawUnsafe(`
    UPDATE "Coupon" c SET "usedCount" = s.cnt
    FROM (SELECT "couponCode", COUNT(*)::int AS cnt FROM "Order" WHERE "couponCode" IS NOT NULL AND "paymentStatus" = 'PAID' GROUP BY "couponCode") s
    WHERE c.code = s."couponCode"`)

  const revenue = orders.filter((o) => o.paymentStatus === 'PAID').reduce((s, o) => s + o.totalCents, 0)
  console.log(`
Seed complete:
  ${catalogue.length} products in ${categories.length} categories
  ${customers.length} customers (+1 admin), ${orders.length} orders over ${HISTORY_DAYS} days, ₹${Math.round(revenue / 100).toLocaleString('en-IN')} revenue

  Admin:     admin@ecom.dev / admin1234
  Customer:  demo@ecom.dev  / demo1234   (every seeded customer also uses demo1234)
  Coupons:   WELCOME10, SAVE200 (min ₹2,000), VIP500 (min ₹5,000), FESTIVE15 (festive season)
`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
