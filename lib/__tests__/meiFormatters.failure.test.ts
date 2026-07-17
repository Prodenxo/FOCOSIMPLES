import {
  extractNfseFailureMessage,
  isHiddenNfseE0014RejectedRecord,
  notaFiscalExibeMotivoFalha,
} from '../meiFormatters';

describe('extractNfseFailureMessage', () => {
  it('extrai Codigo/Descricao embutidos na mensagem PlugNotas', () => {
    const message = extractNfseFailureMessage([
      {
        mensagem:
          'Erro desconhecido: Erro ao realizar a requisição. [{"Codigo":"E0206","Descricao":"CPF do tomador informado na DPS é inválido."}]',
        situacao: 'REJEITADO',
      },
    ]);

    expect(message).toBe('E0206: CPF do tomador informado na DPS é inválido.');
  });

  it('lê mensagemRetorno em retorno', () => {
    const message = extractNfseFailureMessage({
      retorno: {
        mensagemRetorno: 'Nota já cancelada',
        situacao: 'REJEITADA',
      },
    });

    expect(message).toBe('Nota já cancelada');
  });

  it('humaniza E0014 (série/número RPS duplicado)', () => {
    const message = extractNfseFailureMessage({
      mensagemRetorno:
        'E0014: Conjunto de Série, Número, Código do Município Emissor e CNPJ/CPF informado nesta DPS já existe em uma NFS-e gerada a partir de uma DPS enviada anteriormente.',
    });

    expect(message).toMatch(/Numeração repetida/i);
    expect(message).toMatch(/Não é bloqueio por cliente/i);
    expect(message).toMatch(/E0014/);
  });

  it('retorna null quando não há detalhe', () => {
    expect(extractNfseFailureMessage(null)).toBeNull();
  });
});

describe('notaFiscalExibeMotivoFalha', () => {
  it('exibe para rejeitado e interrompido', () => {
    expect(notaFiscalExibeMotivoFalha('rejeitado')).toBe(true);
    expect(notaFiscalExibeMotivoFalha('interrompido')).toBe(true);
    expect(notaFiscalExibeMotivoFalha('concluido')).toBe(false);
  });
});

describe('isHiddenNfseE0014RejectedRecord', () => {
  it('oculta rejeitado com E0014 na resposta', () => {
    expect(
      isHiddenNfseE0014RejectedRecord({
        status: 'REJEITADO',
        document_type: 'NFSE',
        response_json: {
          retorno: {
            mensagemRetorno: 'E0014 - Conjunto de Série, Número...',
          },
        },
      }),
    ).toBe(true);
  });

  it('mantém outras rejeições visíveis', () => {
    expect(
      isHiddenNfseE0014RejectedRecord({
        status: 'REJEITADO',
        document_type: 'NFSE',
        response_json: { retorno: { mensagemRetorno: 'E0206: CPF inválido' } },
      }),
    ).toBe(false);
  });
});
