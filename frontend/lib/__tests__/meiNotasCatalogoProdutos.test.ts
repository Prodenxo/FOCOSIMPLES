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
  atualizarCatalogoNfseProduto,
  criarCatalogoNfseProduto,
  excluirCatalogoNfseProduto,
  listarCatalogoNfseProdutos,
} from '../../services/meiNotasService';

describe('meiNotasService — catálogo produtos/serviços (CRUD)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue([]);
    (apiClient.post as jest.Mock).mockResolvedValue({ id: '1' });
    (apiClient.patch as jest.Mock).mockResolvedValue({ id: '1' });
    (apiClient.delete as jest.Mock).mockResolvedValue(undefined);
  });

  it('listarCatalogoNfseProdutos envia limit, offset, q e documentType', async () => {
    await listarCatalogoNfseProdutos({ limit: 50, offset: 50, q: 'serv', documentType: 'NFSE' });
    expect(apiClient.get).toHaveBeenCalledWith(
      '/mei-notas/catalogo/produtos?q=serv&limit=50&offset=50&documentType=NFSE'
    );
  });

  it('criarCatalogoNfseProduto faz POST no collection', async () => {
    const body = {
      codigo: 'S1',
      cnae: '6201501',
      discriminacao: 'Descrição',
      aliquota: 5,
      documentType: 'NFSE' as const,
    };
    await criarCatalogoNfseProduto(body);
    expect(apiClient.post).toHaveBeenCalledWith('/mei-notas/catalogo/produtos', body);
  });

  it('atualizarCatalogoNfseProduto faz PATCH com id codificado', async () => {
    await atualizarCatalogoNfseProduto('p/1', { discriminacao: 'X' });
    expect(apiClient.patch).toHaveBeenCalledWith('/mei-notas/catalogo/produtos/p%2F1', {
      discriminacao: 'X',
    });
  });

  it('excluirCatalogoNfseProduto faz DELETE com id codificado', async () => {
    await excluirCatalogoNfseProduto('x-2');
    expect(apiClient.delete).toHaveBeenCalledWith('/mei-notas/catalogo/produtos/x-2');
  });
});
