import { Router } from 'express'
import {
  oauthCallbackRedirect,
  proxyGoogleCalendar,
} from '../controllers/googleCalendar.controller.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

// Callback público do Google (sem JWT) — AUTH_MODE=local
router.get('/oauth-callback', oauthCallbackRedirect)

router.all('/:path', requireAuth, proxyGoogleCalendar)

export default router
