jest.mock('../apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  downloadToFile: jest.fn(),
}));

import { apiClient } from '../apiClient';
import {
  atualizarCatalogoNfseCliente,
  criarCatalogoNfseCliente,
  excluirCatalogoNfseCliente,
  listarCatalogoNfseClientes,
} from '../../services/meiNotasService';

describe('meiNotasService — catálogo clientes (CRUD)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue([]);
    (apiClient.post as jest.Mock).mockResolvedValue({ id: '1' });
    (apiClient.patch as jest.Mock).mockResolvedValue({ id: '1' });
    (apiClient.delete as jest.Mock).mockResolvedValue(undefined);
  });

  it('listarCatalogoNfseClientes envia limit, offset e q na query', async () => {
    await listarCatalogoNfseClientes({ limit: 50, offset: 50, q: 'acme', documentType: 'NFSE' });
    expect(apiClient.get).toHaveBeenCalledWith(
      '/mei-notas/catalogo/clientes?q=acme&limit=50&offset=50&documentType=NFSE'
    );
  });

  it('criarCatalogoNfseCliente faz POST no collection', async () => {
    const body = { documento: '12345678901', nome: 'Fulano', documentType: 'NFSE' as const };
    await criarCatalogoNfseCliente(body);
    expect(apiClient.post).toHaveBeenCalledWith('/mei-notas/catalogo/clientes', body);
  });

  it('atualizarCatalogoNfseCliente faz PATCH com id codificado', async () => {
    await atualizarCatalogoNfseCliente('abc/12', { nome: 'X' });
    expect(apiClient.patch).toHaveBeenCalledWith('/mei-notas/catalogo/clientes/abc%2F12', { nome: 'X' });
  });

  it('excluirCatalogoNfseCliente faz DELETE com id codificado', async () => {
    await excluirCatalogoNfseCliente('x-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/mei-notas/catalogo/clientes/x-1');
  });
});
