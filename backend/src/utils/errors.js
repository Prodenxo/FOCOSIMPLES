export class HttpError extends Error {
  constructor(status, message, errors = null) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export const badRequest = (message, errors = null) => new HttpError(400, message, errors);
export const unauthorized = (message = 'Não autenticado') => new HttpError(401, message);
export const forbidden = (message = 'Acesso negado', errors = null) =>
  new HttpError(403, message, errors);
export const notFound = (message = 'Recurso não encontrado', errors = null) =>
  new HttpError(404, message, errors);
export const serviceUnavailable = (message = 'Serviço indisponível', errors = null) =>
  new HttpError(503, message, errors);
export const tooManyRequests = (message = 'Muitas requisições') => new HttpError(429, message);
