import { groupCatalogoClientes, formatCatalogGrupoMeta } from '../meiCatalogClienteGroup'
import type { NfseCatalogCliente } from '../../services/meiNotasService'

describe('groupCatalogoClientes', () => {
  it('agrupa NFSE e NFE do mesmo documento e ignora inactive', () => {
    const rows: NfseCatalogCliente[] = [
      {
        id: '1',
        documento: '12345678901',
        nome: 'Fulano',
        document_type: 'NFSE',
        active: true,
        last_used_at: '2026-01-02T00:00:00Z',
      },
      {
        id: '2',
        documento: '123.456.789-01',
        nome: 'Fulano',
        document_type: 'NFE',
        active: true,
        last_used_at: '2026-01-01T00:00:00Z',
      },
      {
        id: '3',
        documento: '12345678901',
        nome: 'Fulano',
        document_type: 'NFCE',
        active: false,
      },
      {
        id: '4',
        documento: '99999999999',
        nome: 'Outro',
        document_type: 'NFSE',
        active: true,
        last_used_at: '2026-02-01T00:00:00Z',
      },
    ]

    const groups = groupCatalogoClientes(rows)
    expect(groups).toHaveLength(2)
    expect(groups[0].documento).toBe('99999999999')
    expect(groups[1].documento).toBe('12345678901')
    expect(groups[1].activeTypes).toEqual(['NFE', 'NFSE'])
    expect(formatCatalogGrupoMeta(groups[1])).toBe('NFE · NFSE')
  })
})
