import * as simplesDasService from '../services/simples-das.service.js'
import { sendCreated, sendSuccess } from '../utils/response.js'

export const getIntegrationStatus = async (_req, res, next) => {
  try {
    return sendSuccess(res, simplesDasService.getSimplesDasIntegrationStatus())
  } catch (error) {
    next(error)
  }
}

export const listPeriods = async (req, res, next) => {
  try {
    const data = await simplesDasService.listSimplesDasPeriods(req.user.id, {
      cnpj: req.query.cnpj,
      ano: req.query.ano,
      refresh: String(req.query.refresh || '') === 'true',
    })
    return sendSuccess(res, data)
  } catch (error) {
    next(error)
  }
}

export const gerar = async (req, res, next) => {
  try {
    const data = await simplesDasService.gerarSimplesDas(req.user.id, req.body || {})
    return sendCreated(res, data, 'DAS gerado')
  } catch (error) {
    next(error)
  }
}

export const download = async (req, res, next) => {
  try {
    const regenerate = String(req.query.regenerate || '') === 'true'
    const data = await simplesDasService.downloadSimplesDas(req.user.id, req.params.id, {
      regenerate,
    })
    return sendSuccess(res, data)
  } catch (error) {
    next(error)
  }
}

export const getFaturamento = async (req, res, next) => {
  try {
    const data = await simplesDasService.getSimplesDasFaturamento(
      req.user.id,
      req.query.periodo || req.query.periodoApuracao,
    )
    return sendSuccess(res, data)
  } catch (error) {
    next(error)
  }
}

export const declarar = async (req, res, next) => {
  try {
    const data = await simplesDasService.declararSimplesDas(req.user.id, req.body || {})
    return sendCreated(res, data, 'Declaração transmitida')
  } catch (error) {
    next(error)
  }
}
