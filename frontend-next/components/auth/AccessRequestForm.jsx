'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthProvider';
import {
  strongPasswordRequirementBullets,
  validateStrongPassword,
} from '@/lib/passwordPolicy';
import { resolveAppOrigin } from '@/lib/appOrigin';
import { BrandWordmark } from '@/components/brand/BrandLogo';

function maskCnpj(value) {
  const d = value.replace(/\D/g, '').slice(0, 14);
  if (d.length > 12) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  if (d.length > 8) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  }
  if (d.length > 5) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  }
  if (d.length > 2) {
    return `${d.slice(0, 2)}.${d.slice(2)}`;
  }
  return d;
}

const inputCls =
  'h-11 w-full rounded-xl border border-[#e8edf2] bg-white px-3 text-sm text-[#0B2030] placeholder:text-[#94a3b8] focus:border-[#00856A] focus:outline-none focus:ring-2 focus:ring-[#00856A]/20';

function Field({ label, required, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-[#0B2030]">
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="col-span-full border-b border-[#e8edf2] pb-2 text-base font-semibold text-[#0B2030]">
      {children}
    </h2>
  );
}

export function AccessRequestForm({ signupMode = 'self_serve' }) {
  const router = useRouter();
  const { signIn } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [empresaTelefone, setEmpresaTelefone] = useState('');
  const [empresaEmail, setEmpresaEmail] = useState('');

  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjMessage, setCnpjMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const lookupCnpj = async () => {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) return;
    setCnpjLoading(true);
    setCnpjMessage('');
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) {
        setCnpjMessage('Não encontramos esse CNPJ — você pode preencher os dados manualmente.');
        return;
      }
      const d = await res.json();
      if (d.razao_social) setRazaoSocial(String(d.razao_social));
      if (d.nome_fantasia) setNomeFantasia(String(d.nome_fantasia));
      if (d.cep) setCep(String(d.cep).replace(/\D/g, ''));
      const rua = [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(' ').trim();
      if (rua) setLogradouro(rua);
      if (d.numero) setNumero(String(d.numero));
      if (d.complemento) setComplemento(String(d.complemento));
      if (d.bairro) setBairro(String(d.bairro));
      if (d.municipio) setCidade(String(d.municipio));
      if (d.uf) setEstado(String(d.uf));
      if (d.ddd_telefone_1) setEmpresaTelefone(String(d.ddd_telefone_1));
      if (d.email) setEmpresaEmail(String(d.email));
      setCnpjMessage('Dados da empresa preenchidos automaticamente. Confira e ajuste se necessário.');
    } catch {
      setCnpjMessage('Não foi possível consultar o CNPJ agora — preencha os dados manualmente.');
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim() || !email.trim() || !phone.trim() || !password || !confirmPassword) {
      setError('Preencha todos os campos obrigatórios da seção "Seus dados".');
      return;
    }
    const pwd = validateStrongPassword(password);
    if (!pwd.ok) {
      setError(pwd.message);
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }
    if (cnpj.replace(/\D/g, '').length !== 14) {
      setError('Informe um CNPJ válido (14 dígitos).');
      return;
    }
    if (!razaoSocial.trim() && !nomeFantasia.trim()) {
      setError('Informe a razão social ou o nome fantasia.');
      return;
    }

    setLoading(true);
    try {
      const result = await apiClient.postPublic('/auth/register-empresa', {
        user: {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          password,
        },
        empresa: {
          cnpj: cnpj.replace(/\D/g, ''),
          razaoSocial: razaoSocial.trim(),
          nomeFantasia: nomeFantasia.trim(),
          cep: cep.replace(/\D/g, ''),
          logradouro: logradouro.trim(),
          numero: numero.trim(),
          complemento: complemento.trim(),
          bairro: bairro.trim(),
          cidade: cidade.trim(),
          estado: estado.trim().toUpperCase(),
          telefone: empresaTelefone.trim(),
          email: empresaEmail.trim(),
        },
        observacao: null,
        appOrigin: resolveAppOrigin(),
        signupMode,
      });

      if (signupMode === 'self_serve') {
        await signIn(email.trim(), password);
        router.replace('/');
        return;
      }
      if (result?.pendingApproval) {
        setSubmitted(true);
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir o cadastro.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B2030] px-4 py-10">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <h1 className="text-xl font-bold text-[#0B2030]">Solicitação enviada</h1>
          <p className="mt-3 text-sm text-[#5c6b7a]">
            Recebemos seus dados. A equipe vai analisar e liberar o acesso.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#00856A] px-6 text-sm font-semibold text-white"
          >
            Ir para login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen justify-center bg-[#0B2030] px-4 py-10">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3 border-b border-[#e8edf2] pb-6">
          <BrandWordmark className="h-8" />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[#0B2030]">Quero ser cliente</h1>
            <p className="mt-1 text-sm text-[#5c6b7a]">
              Cadastro da empresa e do administrador
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SectionTitle>Seus dados</SectionTitle>

          <Field label="Nome completo" required>
            <input
              required
              className={inputCls}
              placeholder="Seu nome completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Field>
          <Field label="E-mail" required>
            <input
              required
              type="email"
              autoComplete="email"
              className={inputCls}
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="WhatsApp" required className="md:col-span-2">
            <input
              required
              className={inputCls}
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
            />
          </Field>

          <Field label="Senha" required>
            <div className="relative">
              <input
                required
                type={showPassword ? 'text' : 'password'}
                className={`${inputCls} pr-10`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5c6b7a]"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <ul className="mt-2 space-y-1 rounded-lg bg-[#f4f7fa] px-3 py-2 text-xs text-[#5c6b7a]">
              {strongPasswordRequirementBullets().map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
          </Field>
          <Field label="Confirmar senha" required>
            <div className="relative">
              <input
                required
                type={showConfirm ? 'text' : 'password'}
                className={`${inputCls} pr-10`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5c6b7a]"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <SectionTitle>Dados da empresa</SectionTitle>

          <Field label="Nome fantasia" className="md:col-span-2">
            <input
              className={inputCls}
              placeholder="Nome comercial da empresa"
              value={nomeFantasia}
              onChange={(e) => setNomeFantasia(e.target.value)}
            />
          </Field>
          <Field label="CNPJ" required>
            <input
              required
              className={inputCls}
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={(e) => setCnpj(maskCnpj(e.target.value))}
              onBlur={() => void lookupCnpj()}
              inputMode="numeric"
            />
            {cnpjLoading ? (
              <p className="mt-1 flex items-center gap-2 text-xs text-[#5c6b7a]">
                <Loader2 className="h-3 w-3 animate-spin" /> Buscando dados do CNPJ…
              </p>
            ) : cnpjMessage ? (
              <p className="mt-1 text-xs text-[#5c6b7a]">{cnpjMessage}</p>
            ) : null}
          </Field>
          <Field label="Razão social" required>
            <input
              className={inputCls}
              placeholder="Razão social da empresa"
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
            />
          </Field>
          <Field label="CEP">
            <input
              className={inputCls}
              placeholder="Somente números"
              value={cep}
              onChange={(e) => setCep(e.target.value.replace(/\D/g, '').slice(0, 8))}
              inputMode="numeric"
            />
          </Field>
          <Field label="Logradouro">
            <input
              className={inputCls}
              placeholder="Rua, avenida…"
              value={logradouro}
              onChange={(e) => setLogradouro(e.target.value)}
            />
          </Field>
          <Field label="Número">
            <input className={inputCls} placeholder="Nº" value={numero} onChange={(e) => setNumero(e.target.value)} />
          </Field>
          <Field label="Complemento">
            <input
              className={inputCls}
              placeholder="Sala, andar…"
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
            />
          </Field>
          <Field label="Bairro">
            <input className={inputCls} value={bairro} onChange={(e) => setBairro(e.target.value)} />
          </Field>
          <Field label="Cidade">
            <input className={inputCls} value={cidade} onChange={(e) => setCidade(e.target.value)} />
          </Field>
          <Field label="UF">
            <input
              className={inputCls}
              placeholder="UF"
              maxLength={2}
              value={estado}
              onChange={(e) => setEstado(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase())}
            />
          </Field>
          <Field label="Telefone da empresa">
            <input
              className={inputCls}
              value={empresaTelefone}
              onChange={(e) => setEmpresaTelefone(e.target.value)}
              inputMode="tel"
            />
          </Field>
          <Field label="E-mail da empresa">
            <input
              type="email"
              className={inputCls}
              placeholder="contato@empresa.com"
              value={empresaEmail}
              onChange={(e) => setEmpresaEmail(e.target.value)}
            />
          </Field>

          {error ? (
            <p className="col-span-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          <div className="col-span-full space-y-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#00856A] text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Enviar solicitação
            </button>
            <p className="text-center text-sm text-[#5c6b7a]">
              Já tem acesso?{' '}
              <Link href="/login" className="font-semibold text-[#00856A]">
                Fazer login
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
