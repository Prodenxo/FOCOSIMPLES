import { rewriteLocalhostDevApiUrl } from '../expoDevApiUrl'
import { getMeiApiBaseUrl } from '../runtimeEnv'

describe('rewriteLocalhostDevApiUrl', () => {
  it('substitui localhost pelo IP do Metro no native', () => {
    expect(
      rewriteLocalhostDevApiUrl('http://localhost:3333', {
        platform: 'android',
        lanHost: '192.168.0.12',
      }),
    ).toBe('http://192.168.0.12:3333')
  })

  it('não altera URL no web', () => {
    expect(
      rewriteLocalhostDevApiUrl('http://localhost:3333', {
        platform: 'web',
        lanHost: '192.168.0.12',
      }),
    ).toBe('http://localhost:3333')
  })
})

describe('getMeiApiBaseUrl', () => {
  const originalWindow = global.window

  afterEach(() => {
    if (originalWindow) {
      global.window = originalWindow
    } else {
      // @ts-expect-error test cleanup
      delete global.window
    }
  })

  it('usa localhost:3333 no browser local mesmo sem env dev', () => {
    Object.defineProperty(global, 'window', {
      value: { location: { hostname: 'localhost' } },
      writable: true,
    })
    expect(getMeiApiBaseUrl()).toBe('http://localhost:3333')
  })

  it('usa produção fora de localhost', () => {
    process.env.EXPO_PUBLIC_MEI_API_URL = 'https://auto-back.example.com'
    Object.defineProperty(global, 'window', {
      value: { location: { hostname: 'app.example.com' } },
      writable: true,
    })
    expect(getMeiApiBaseUrl()).toBe('https://auto-back.example.com')
  })
})
