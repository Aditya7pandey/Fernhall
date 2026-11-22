import { randomUUID } from 'node:crypto'
import { extname } from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import { env } from '../../env.js'
import { badRequest } from '../../lib/http.js'
import { requireAdmin } from '../../middleware/auth.js'
import { adminCatalogRouter } from './catalog.js'
import { adminSalesRouter } from './sales.js'

export const adminRouter = Router()
adminRouter.use(requireAdmin)
adminRouter.use(adminCatalogRouter)
adminRouter.use(adminSalesRouter)

// ─── Image uploads (stored on local disk, served from /uploads) ─────────────

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])

const upload = multer({
  storage: multer.diskStorage({
    destination: env.uploadDir,
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase() || '.jpg'}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => cb(null, IMAGE_TYPES.has(file.mimetype)),
})

/** multipart/form-data with one or more `files` fields → { urls: ['/uploads/…'] } */
adminRouter.post('/uploads', upload.array('files', 10), (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  if (files.length === 0) throw badRequest('Upload JPEG, PNG, WebP, GIF or AVIF images up to 5 MB')
  res.status(201).json({ urls: files.map((f) => `/uploads/${f.filename}`) })
})
