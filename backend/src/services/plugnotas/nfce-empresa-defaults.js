import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Única fonte de valores padrão NFC-e (cadastro empresa / QR v1) — ver `config/plugnotas-nfce-empresa-defaults.json`. */
const loadDefaults = () => {
  const path = join(__dirname, '../../../../config/plugnotas-nfce-empresa-defaults.json');
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const base = { ...raw.nfceConfigQrV1 };
  return {
    nfceConfigQrV1Base: base,
    nfceBlockCadastro: {
      ...raw.nfceBlockCadastro,
      config: { ...base }
    }
  };
};

const loaded = loadDefaults();

export const NFCE_CONFIG_QR_V1_BASE = loaded.nfceConfigQrV1Base;
export const NFCE_BLOCK_CADASTRO_DEFAULT = loaded.nfceBlockCadastro;
