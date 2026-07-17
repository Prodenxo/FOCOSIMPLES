import {
  mapIcmsForPlugnotas,
  mapNfeItemForPlugnotas,
  resolveNfeConsumidorFinal,
  buildDefaultNfePagamentos,
} from '../plugnotasNfeItem';
import { buildNfeLikePayloadFromForm, getDefaultNfeLikeForm } from '../meiNfseForms';

describe('plugnotasNfeItem', () => {
  it('envia quantidade e valorUnitario no formato Plugnotas { comercial, tributavel }', () => {
    const form = getDefaultNfeLikeForm();
    form.emitenteCpfCnpj = '11222333000181';
    form.destinatarioCpfCnpj = '01858368000158';
    form.destinatarioRazaoSocial = 'Condomínio';
    form.destinatarioEndereco = {
      cep: '28800000',
      logradouro: 'Rua A',
      numero: '1',
      complemento: '',
      bairro: 'Centro',
      codigoCidade: '3304557',
      descricaoCidade: 'Rio das Ostras',
      estado: 'RJ',
    };
    form.itens[0]!.codigo = '001';
    form.itens[0]!.descricao = 'Agua';
    form.itens[0]!.ncm = '22011000';
    form.itens[0]!.quantidade = '42';
    form.itens[0]!.valorUnitario = '12';
    form.itens[0]!.tributos.icms.csosn = '102';
    form.itens[0]!.tributos.pis.cst = '49';
    form.itens[0]!.tributos.cofins.cst = '49';

    const payload = buildNfeLikePayloadFromForm(form, 'NFE');
    const item = payload.itens[0]!;

    expect(item.unidadeComercial).toBe('UN');
    expect(item.quantidade).toEqual({ comercial: 42, tributavel: 42 });
    expect(item.valorUnitario).toEqual({ comercial: 12, tributavel: 12 });
    expect(item.valor).toBe(504);
    expect(item.tributos?.icms?.cst).toBe('102');
    expect(item.tributos?.icms?.csosn).toBeUndefined();
    expect(payload.consumidorFinal).toBe(false);
    expect(payload.pagamentos?.[0]).toEqual({
      meio: '99',
      valor: 504,
      descricaoMeio: 'Outros',
    });
  });

  it('buildDefaultNfePagamentos inclui descricaoMeio para meio 99', () => {
    expect(buildDefaultNfePagamentos(100)).toEqual([
      { meio: '99', valor: 100, descricaoMeio: 'Outros' },
    ]);
  });

  it('consumidorFinal true para CPF e CNPJ não contribuinte sem IE', () => {
    expect(resolveNfeConsumidorFinal('52998224725')).toBe(true);
    expect(resolveNfeConsumidorFinal('01858368000158', '2')).toBe(true);
    expect(resolveNfeConsumidorFinal('01858368000158', '1', '16419141')).toBe(false);
  });

  it('mapIcmsForPlugnotas coloca CSOSN no campo cst', () => {
    expect(mapIcmsForPlugnotas({ csosn: '102' })).toEqual({ origem: '0', cst: '102' });
  });

  it('mapNfeItemForPlugnotas não envia campo unidade string', () => {
    const mapped = mapNfeItemForPlugnotas(
      {
        codigo: '1',
        descricao: 'X',
        ncm: '22011000',
        cfop: '5102',
        unidade: 'UN',
        quantidade: '2',
        valorUnitario: '10',
        desconto: '',
        cest: '',
        sku: '',
      },
      { pis: { cst: '49' }, cofins: { cst: '49' }, icms: { cst: '102' } },
    );
    expect(mapped.unidade).toBeUndefined();
    expect(mapped.unidadeComercial).toBe('UN');
  });
});
