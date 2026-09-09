/**
 * Reinicia o Next.js com cache limpo.
 * Mata instâncias antigas nas portas 3000/3002 antes de subir de novo.
 */
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORTS = [3000, 3002];
const root = path.join(__dirname, '..');

function killPort(port) {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const pids = new Set();
    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.includes('LISTENING')) continue;
      const pid = trimmed.split(/\s+/).pop();
      if (pid && /^\d+$/.test(pid)) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`[restart] processo ${pid} na porta ${port} encerrado`);
      } catch {
        /* já encerrado */
      }
    }
  } catch {
    /* nenhum processo na porta */
  }
}

for (const port of PORTS) killPort(port);

const nextDir = path.join(root, '.next');
if (fs.existsSync(nextDir)) {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log('[restart] pasta .next removida');
}

console.log('[restart] subindo em http://localhost:3002 …');
const child = spawn('npx', ['next', 'dev', '-p', '3002'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 0));
