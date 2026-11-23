import type { Request, Response } from 'express'
import { badRequest } from '../../lib/http.js'

/** multipart/form-data with one or more `files` fields → { urls: ['/uploads/…'] } */
export function uploadImages(req: Request, res: Response) {
  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  if (files.length === 0) throw badRequest('Upload JPEG, PNG, WebP, GIF or AVIF images up to 5 MB')
  res.status(201).json({ urls: files.map((f) => `/uploads/${f.filename}`) })
}
