import { randomUUID } from 'node:crypto'
import { extname } from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import * as uploads from '../../controllers/admin/uploads.controller.js'
import { env } from '../../env.js'
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

adminRouter.post('/uploads', upload.array('files', 10), uploads.uploadImages)
