/**
 * Script de teste para verificar se uma Edge Function está acessível
 * 
 * Uso:
 *   deno run --allow-net test-edge-function.ts [nome-da-funcao] [project-ref]
 * 
 * Exemplo:
 *   deno run --allow-net test-edge-function.ts auth iqcupswgotsuncysagmj
 */

const FUNCTION_NAME = Deno.args[0] || 'auth'
const PROJECT_REF = Deno.args[1] || 'iqcupswgotsuncysagmj'

const BASE_URL = `https://${PROJECT_REF}.supabase.co/functions/v1`

console.log('========================================')
console.log('Teste de Conectividade - Edge Function')
console.log('========================================')
console.log('')
console.log(`Função: ${FUNCTION_NAME}`)
console.log(`URL: ${BASE_URL}/${FUNCTION_NAME}`)
console.log('')

// Teste 1: OPTIONS (Preflight CORS)
console.log('[TESTE 1] OPTIONS (Preflight CORS)')
console.log('----------------------------------------')
try {
  const optionsResponse = await fetch(`${BASE_URL}/${FUNCTION_NAME}`, {
    method: 'OPTIONS',
    headers: {
      'apikey': 'test-key', // Não precisa ser válido para OPTIONS
    },
  })

  console.log(`Status: ${optionsResponse.status}`)
  console.log(`Status Text: ${optionsResponse.statusText}`)
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': optionsResponse.headers.get('Access-Control-Allow-Origin'),
    'Access-Control-Allow-Methods': optionsResponse.headers.get('Access-Control-Allow-Methods'),
    'Access-Control-Allow-Headers': optionsResponse.headers.get('Access-Control-Allow-Headers'),
  }
  
  console.log('CORS Headers:', corsHeaders)
  
  if (optionsResponse.status === 204) {
    console.log('✅ OPTIONS funcionando corretamente')
  } else {
    console.log('❌ OPTIONS retornou status incorreto (esperado: 204)')
  }
} catch (error) {
  console.error('❌ Erro ao testar OPTIONS:', error.message)
}

console.log('')

// Teste 2: GET (sem autenticação - deve retornar erro de autenticação ou 404)
console.log('[TESTE 2] GET (sem autenticação)')
console.log('----------------------------------------')
try {
  const getResponse = await fetch(`${BASE_URL}/${FUNCTION_NAME}`, {
    method: 'GET',
    headers: {
      'apikey': 'test-key',
      'Content-Type': 'application/json',
    },
  })

  console.log(`Status: ${getResponse.status}`)
  console.log(`Status Text: ${getResponse.statusText}`)
  
  const contentType = getResponse.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    const data = await getResponse.json()
    console.log('Resposta:', JSON.stringify(data, null, 2))
  } else {
    const text = await getResponse.text()
    console.log('Resposta (texto):', text.substring(0, 200))
  }
  
  if (getResponse.status === 401 || getResponse.status === 404) {
    console.log('✅ Função está respondendo (erro esperado sem autenticação)')
  } else if (getResponse.status === 500) {
    console.log('⚠️  Erro interno do servidor - verifique variáveis de ambiente')
  } else {
    console.log('⚠️  Status inesperado')
  }
} catch (error) {
  console.error('❌ Erro ao testar GET:', error.message)
  
  if (error.message.includes('CORS')) {
    console.log('')
    console.log('⚠️  ERRO DE CORS DETECTADO!')
    console.log('Isso geralmente indica que:')
    console.log('1. A função não está deployada')
    console.log('2. A função não está tratando OPTIONS corretamente')
    console.log('3. Há um problema de rede/firewall')
  }
}

console.log('')
console.log('========================================')
console.log('Teste concluído')
console.log('========================================')
console.log('')
console.log('Se todos os testes passaram, a função está funcionando!')
console.log('Se houver erros, verifique:')
console.log('1. Se a função está deployada')
console.log('2. Se as variáveis de ambiente estão configuradas')
console.log('3. Os logs da função no painel do Supabase')
