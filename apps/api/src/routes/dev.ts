import { Router } from 'express'
import * as lab from '../controllers/dev/lab.controller.js'

/** Dev-only performance lab — mounted in app.ts when NODE_ENV !== 'production'. No auth: never expose. */
export const devRouter = Router()
devRouter.get('/lab/customers', lab.labCustomers)
devRouter.get('/lab/orders', lab.labOrders)
devRouter.get('/lab/explain', lab.listExperiments)
devRouter.get('/lab/explain/:name', lab.explainExperiment)
