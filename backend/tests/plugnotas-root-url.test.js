import test from 'node:test';
import assert from 'node:assert/strict';

const restoreEnv = (snapshot) => {
  if (snapshot.baseUrl === undefined) delete process.env.PLUGNOTAS_API_BASE_URL;
  else process.env.PLUGNOTAS_API_BASE_URL = snapshot.baseUrl;

  if (snapshot.pathPrefix === undefined) delete process.env.PLUGNOTAS_API_PATH_PREFIX;
  else process.env.PLUGNOTAS_API_PATH_PREFIX = snapshot.pathPrefix;
};

test('getPlugnotasRootUrl compõe a base sem prefixo', async () => {
  const snapshot = {
    baseUrl: process.env.PLUGNOTAS_API_BASE_URL,
    pathPrefix: process.env.PLUGNOTAS_API_PATH_PREFIX
  };
  process.env.PLUGNOTAS_API_BASE_URL = 'https://api.sandbox.plugnotas.com.br';
  process.env.PLUGNOTAS_API_PATH_PREFIX = '';

  try {
    const { getPlugnotasRootUrl } = await import('../src/services/plugnotas/root-url.js');
    assert.equal(getPlugnotasRootUrl(), 'https://api.sandbox.plugnotas.com.br');
    assert.equal(
      `${getPlugnotasRootUrl()}/empresa`,
      'https://api.sandbox.plugnotas.com.br/empresa'
    );
  } finally {
    restoreEnv(snapshot);
  }
});

test('getPlugnotasRootUrl compõe a base com prefixo /api', async () => {
  const snapshot = {
    baseUrl: process.env.PLUGNOTAS_API_BASE_URL,
    pathPrefix: process.env.PLUGNOTAS_API_PATH_PREFIX
  };
  process.env.PLUGNOTAS_API_BASE_URL = 'https://api.plugnotas.com.br';
  process.env.PLUGNOTAS_API_PATH_PREFIX = '/api';

  try {
    const { getPlugnotasRootUrl } = await import('../src/services/plugnotas/root-url.js');
    assert.equal(getPlugnotasRootUrl(), 'https://api.plugnotas.com.br/api');
    assert.equal(
      `${getPlugnotasRootUrl()}/empresa`,
      'https://api.plugnotas.com.br/api/empresa'
    );
  } finally {
    restoreEnv(snapshot);
  }
});

test('getPlugnotasRootUrl normaliza prefixo sem barra inicial para /api', async () => {
  const snapshot = {
    baseUrl: process.env.PLUGNOTAS_API_BASE_URL,
    pathPrefix: process.env.PLUGNOTAS_API_PATH_PREFIX
  };
  process.env.PLUGNOTAS_API_BASE_URL = 'https://api.plugnotas.com.br';
  process.env.PLUGNOTAS_API_PATH_PREFIX = 'api';

  try {
    const { getPlugnotasRootUrl } = await import('../src/services/plugnotas/root-url.js');
    assert.equal(getPlugnotasRootUrl(), 'https://api.plugnotas.com.br/api');
    assert.equal(
      `${getPlugnotasRootUrl()}/empresa`,
      'https://api.plugnotas.com.br/api/empresa'
    );
  } finally {
    restoreEnv(snapshot);
  }
});

test('host e prefixo alteram só a base resolvida, preservando o path canónico /empresa', async () => {
  const snapshot = {
    baseUrl: process.env.PLUGNOTAS_API_BASE_URL,
    pathPrefix: process.env.PLUGNOTAS_API_PATH_PREFIX
  };
  const scenarios = [
    {
      baseUrl: 'https://api.sandbox.plugnotas.com.br',
      pathPrefix: '',
      expectedRoot: 'https://api.sandbox.plugnotas.com.br'
    },
    {
      baseUrl: 'https://api.plugnotas.com.br',
      pathPrefix: '/api',
      expectedRoot: 'https://api.plugnotas.com.br/api'
    },
    {
      baseUrl: 'https://api-alt.plugnotas.com.br',
      pathPrefix: 'api',
      expectedRoot: 'https://api-alt.plugnotas.com.br/api'
    }
  ];

  try {
    const { getPlugnotasRootUrl } = await import('../src/services/plugnotas/root-url.js');

    for (const scenario of scenarios) {
      process.env.PLUGNOTAS_API_BASE_URL = scenario.baseUrl;
      process.env.PLUGNOTAS_API_PATH_PREFIX = scenario.pathPrefix;

      assert.equal(getPlugnotasRootUrl(), scenario.expectedRoot);
      assert.match(`${getPlugnotasRootUrl()}/empresa`, /\/empresa$/);
      assert.equal(
        `${getPlugnotasRootUrl()}/empresa`,
        `${scenario.expectedRoot}/empresa`
      );
    }
  } finally {
    restoreEnv(snapshot);
  }
});
