import { Router } from 'express';

import multer from 'multer';

import { requireAuth } from '../middlewares/auth.js';

import { requireFiscalPurchaseImport } from '../middlewares/requireFiscalPurchaseImport.js';

import * as controller from '../controllers/fiscal-purchase.controller.js';

import { DEFAULT_MAX_PURCHASE_XML_BYTES } from '../fiscal-engine/acquisition/constants.js';

import { badRequest } from '../utils/errors.js';



const router = Router();

const upload = multer({

  storage: multer.memoryStorage(),

  limits: { fileSize: DEFAULT_MAX_PURCHASE_XML_BYTES },

});



const handlePurchaseXmlUpload = (req, res, next) => {

  upload.single('xml')(req, res, (err) => {

    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {

      return next(badRequest('Arquivo XML excede o tamanho máximo permitido'));

    }

    if (err instanceof multer.MulterError) {

      return next(badRequest(err.message));

    }

    return next(err);

  });

};



router.post(

  '/import-xml',

  requireAuth,

  requireFiscalPurchaseImport,

  handlePurchaseXmlUpload,

  controller.importPurchaseXml,

);



router.get(

  '/invoices/:chave',

  requireAuth,

  requireFiscalPurchaseImport,

  controller.getPurchaseByChave,

);



export default router;

