'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { hasRole } from '@/lib/authRoles';
import {
  fetchCompanyFiscalProfile,
  fetchFiscalReadiness,
  fetchProductFiscalProfile,
  listAccountantClients,
  listAccountantEstablishments,
  listAccountantProducts,
  saveProductFiscalProfile,
} from '@/lib/accountantFiscalApi';
import { Card } from '@/components/ui/Card';
import { AppSelect } from '@/components/ui/AppSelect';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { LoadingPanel } from '@/components/ui/LoadingPanel';

export default function ProdutosFiscaisPage() {
  const { role } = useAuth();
  const canAccess = hasRole(role, ['admin']);

  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [establishments, setEstablishments] = useState([]);
  const [establishmentId, setEstablishmentId] = useState('');
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [companyProfile, setCompanyProfile] = useState(null);
  const [productProfile, setProductProfile] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!canAccess) return;
    listAccountantClients()
      .then((list) => {
        setClients(Array.isArray(list) ? list : []);
        if (list?.[0]?.empresaId) setSelectedClient(list[0].empresaId);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar clientes.'))
      .finally(() => setLoading(false));
  }, [canAccess]);

  const loadClientData = useCallback(async () => {
    if (!selectedClient) return;
    setLoading(true);
    setError(null);
    try {
      const est = await listAccountantEstablishments(selectedClient);
      const estList = est?.establishments || est || [];
      setEstablishments(estList);
      const estId = estList[0]?.establishmentId || '';
      setEstablishmentId(estId);
      const prods = await listAccountantProducts(selectedClient);
      setProducts(Array.isArray(prods) ? prods : []);
      if (estId) {
        const [comp, ready] = await Promise.all([
          fetchCompanyFiscalProfile(selectedClient, estId),
          fetchFiscalReadiness(selectedClient, estId),
        ]);
        setCompanyProfile(comp);
        setReadiness(ready);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dados fiscais.');
    } finally {
      setLoading(false);
    }
  }, [selectedClient]);

  useEffect(() => {
    loadClientData();
  }, [loadClientData]);

  useEffect(() => {
    if (!selectedClient || !selectedProduct || !establishmentId) {
      setProductProfile(null);
      return;
    }
    fetchProductFiscalProfile(selectedClient, selectedProduct, establishmentId)
      .then(setProductProfile)
      .catch(() => setProductProfile(null));
  }, [selectedClient, selectedProduct, establishmentId]);

  const handleSaveProduct = async () => {
    if (!selectedClient || !selectedProduct || !productProfile) return;
    setSaving(true);
    setMsg(null);
    try {
      await saveProductFiscalProfile(selectedClient, selectedProduct, establishmentId, productProfile);
      setMsg({ type: 'success', text: 'Perfil fiscal do produto salvo.' });
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Falha ao salvar.' });
    } finally {
      setSaving(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link href="/minha-conta" className="inline-flex items-center gap-2 text-sm text-[var(--accent)]">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <Card className="mt-4 p-6">
          <EmptyPanel title="Acesso restrito" description="Somente administradores podem configurar produtos fiscais." />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 pb-6">
      <Link href="/minha-conta" className="inline-flex items-center gap-2 text-sm text-[var(--accent)]">
        <ArrowLeft className="h-4 w-4" /> Voltar às configurações
      </Link>
      <header>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Produtos e configuração fiscal</h1>
        <p className="text-sm text-[var(--text-muted)]">Tratamento fiscal aprovado por CNPJ</p>
      </header>

      {msg ? (
        <div className={`rounded-[12px] border p-3 text-sm ${msg.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {msg.text}
        </div>
      ) : null}

      <Card className="space-y-4 p-4 sm:p-5">
        <AppSelect
          label="Cliente (CNPJ)"
          value={selectedClient}
          onChange={setSelectedClient}
          options={clients.map((c) => ({
            value: c.empresaId,
            label: c.label || c.nomeFantasia || c.razaoSocial || c.cpfCnpj,
          }))}
        />

        {establishments.length > 0 ? (
          <AppSelect
            label="Estabelecimento"
            value={establishmentId}
            onChange={setEstablishmentId}
            options={establishments.map((e) => ({
              value: e.establishmentId,
              label: e.label,
            }))}
          />
        ) : null}

        {loading ? <LoadingPanel label="Carregando…" /> : error ? (
          <ErrorPanel message={error} onRetry={loadClientData} />
        ) : (
          <>
            {readiness ? (
              <p className="text-xs text-[var(--text-muted)]">
                Prontidão fiscal: {readiness.status || readiness.overallStatus || '—'}
              </p>
            ) : null}
            {companyProfile ? (
              <div className="rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] p-3 text-sm">
                <p className="font-semibold">Empresa</p>
                <p className="text-xs text-[var(--text-muted)]">
                  CRT {companyProfile.crt ?? '—'} · Regime {companyProfile.taxRegime ?? '—'} · UF {companyProfile.issuerUf ?? '—'}
                </p>
              </div>
            ) : null}

            <AppSelect
              label="Produto"
              value={selectedProduct}
              onChange={setSelectedProduct}
              placeholder="Selecione…"
              options={[
                { value: '', label: 'Selecione…' },
                ...products.map((p) => ({
                  value: p.id,
                  label: p.descricao || p.nome || p.id,
                })),
              ]}
            />

            {productProfile ? (
              <div className="space-y-3 rounded-[12px] border border-[var(--card-border)] p-4">
                <p className="text-sm font-semibold">Perfil fiscal do produto</p>
                <label className="block text-xs text-[var(--text-muted)]">
                  NCM
                  <input
                    value={productProfile.ncm || ''}
                    onChange={(e) => setProductProfile({ ...productProfile, ncm: e.target.value })}
                    className="mt-1 h-10 w-full rounded-[12px] border px-3 text-sm"
                  />
                </label>
                <label className="block text-xs text-[var(--text-muted)]">
                  CEST
                  <input
                    value={productProfile.cest || ''}
                    onChange={(e) => setProductProfile({ ...productProfile, cest: e.target.value })}
                    className="mt-1 h-10 w-full rounded-[12px] border px-3 text-sm"
                  />
                </label>
                <p className="text-xs text-[var(--text-muted)]">
                  Status: {productProfile.taxClassificationStatus || productProfile.status || '—'}
                </p>
                <button
                  type="button"
                  onClick={handleSaveProduct}
                  disabled={saving}
                  className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-[var(--accent)] px-3 text-xs font-semibold text-white"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Salvar perfil
                </button>
              </div>
            ) : selectedProduct ? (
              <EmptyPanel title="Sem perfil fiscal" description="Este produto ainda não possui perfil cadastrado." />
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}
