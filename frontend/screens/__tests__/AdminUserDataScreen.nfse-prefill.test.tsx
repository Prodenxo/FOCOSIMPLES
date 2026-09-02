import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';

jest.mock('@expo/vector-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- factory Jest (hoisting)
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  return {
    Ionicons: function MockIonicons(props: { name?: string }) {
      return React.createElement(Text, { testID: `ionicon-${props.name ?? 'icon'}` }, 'icon');
    },
  };
});

const mockFetchAdminNfsePrestadorPrefill = jest.fn();

jest.mock('../../services/adminUserDataService', () => ({
  fetchAdminUserTransactions: jest.fn().mockResolvedValue([]),
  fetchAdminUserCategories: jest.fn().mockResolvedValue([]),
  fetchAdminUserBalance: jest.fn().mockResolvedValue(null),
  fetchAdminUserBudgetSummary: jest.fn().mockResolvedValue([]),
  fetchAdminDasStatus: jest.fn().mockResolvedValue(null),
  reprocessAdminDas: jest.fn(),
  fetchAdminMeiCertificateStatus: jest.fn().mockResolvedValue({
    documento: '12345678000190',
    hasUserCertificate: true,
  }),
  fetchAdminMeiPeriods: jest.fn().mockResolvedValue([]),
  fetchAdminParcelamentos: jest.fn().mockResolvedValue({ parcelamentos: [] }),
  fetchAdminNotas: jest.fn().mockResolvedValue([]),
  downloadAdminMeiGuide: jest.fn(),
  sendAdminMeiGuideWhatsapp: jest.fn(),
  downloadAdminParcelamentoPdf: jest.fn(),
  emitirNotaAsAdmin: jest.fn(),
  fetchAdminNfsePrestadorPrefill: (...args: unknown[]) => mockFetchAdminNfsePrestadorPrefill(...args),
}));

jest.mock('../../lib/user-management', () => ({
  listUsers: jest.fn().mockResolvedValue([
    {
      id: 'user-integration-1',
      email: 't@t.com',
      displayName: 'Test',
      phone: null,
      role: 'user',
      empresaId: null,
    },
  ]),
}));

jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    role: 'admin',
    empresaId: null,
  })),
}));

jest.mock('../../store/themeStore', () => ({
  useThemeStore: jest.fn(() => ({
    isDarkMode: false,
  })),
}));

jest.mock('../../lib/auth-roles', () => ({
  hasRole: jest.fn((_role: unknown, allowed: string[]) => allowed.includes('admin')),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  shareAsync: jest.fn(),
}));

// eslint-disable-next-line import/first -- jest.mock deve preceder o import do ecrã
import AdminUserDataScreen from '../AdminUserDataScreen';

describe('AdminUserDataScreen — prefill NFSe (QA 2.4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchAdminNfsePrestadorPrefill.mockResolvedValue({
      prestadorCpfCnpj: '12345678000190',
      prestadorRazaoSocial: null,
      prestadorEmail: null,
      prestadorInscricaoMunicipal: null,
      prestadorEndereco: {
        logradouro: 'Rua Integração',
        numero: '99',
        codigoCidade: '3550308',
        cep: '01001000',
        complemento: '',
        bairro: 'Sé',
        estado: 'SP',
        descricaoCidade: 'São Paulo',
      },
      sourceRowId: 'row-i',
    });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function flushEffects() {
    await act(async () => {
      await new Promise<void>((resolve) => setImmediate(resolve));
    });
  }

  async function mountWithFiscalTab() {
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<AdminUserDataScreen onBack={() => {}} />);
    });
    for (let i = 0; i < 6; i += 1) {
      await flushEffects();
    }
    const fiscalTab = root.root.findByProps({ testID: 'admin-section-tab-fiscal' });
    await act(async () => {
      fiscalTab.props.onPress();
    });
    await flushEffects();
    await flushEffects();
    return root;
  }

  it('ao abrir o modal chama fetchAdminNfsePrestadorPrefill com selectedUserId e mostra resumo do endereço', async () => {
    const root = await mountWithFiscalTab();

    const openBtn = root.root.findByProps({ testID: 'admin-open-emitir-nfse-modal' });
    await act(async () => {
      openBtn.props.onPress();
    });
    await flushEffects();
    await flushEffects();

    expect(mockFetchAdminNfsePrestadorPrefill).toHaveBeenCalledWith('user-integration-1');

    const resumo = root.root.findByProps({ testID: 'admin-nfse-prestador-endereco-resumo' });
    expect(String(resumo.props.children)).toContain('Rua Integração');
    expect(String(resumo.props.children)).not.toContain('Curitiba');

    await act(async () => {
      root.unmount();
    });
  });

  it('em erro de rede do prefill mostra resumo vazio (sem morada inventada)', async () => {
    mockFetchAdminNfsePrestadorPrefill.mockRejectedValueOnce(new Error('Falha 500'));

    const root = await mountWithFiscalTab();

    const openBtn = root.root.findByProps({ testID: 'admin-open-emitir-nfse-modal' });
    await act(async () => {
      openBtn.props.onPress();
    });
    await flushEffects();
    await flushEffects();

    const resumo = root.root.findByProps({ testID: 'admin-nfse-prestador-endereco-resumo' });
    expect(String(resumo.props.children)).toMatch(/Nenhum endereço veio do cadastro MEI/);

    await act(async () => {
      root.unmount();
    });
  });
});
