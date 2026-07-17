/**
 * Libera a porta do backend antes de `npm run dev` (evita EADDRINUSE quando ficou um node órfão).
 */
import { execSync } from 'node:child_process';

const port = String(process.env.PORT || 3333).trim();

function killPids(pids) {
  for (const pid of pids) {
    if (!pid || pid === '0') continue;
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      } else {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
      }
      // eslint-disable-next-line no-console
      console.log(`[free-dev-port] encerrou PID ${pid} na porta ${port}`);
    } catch {
      // processo já saiu
    }
  }
}

function freePortWindows() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    const pids = new Set();
    for (const line of out.split('\n')) {
      if (!line.includes('LISTENING')) continue;
      if (!line.includes(`:${port}`)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid) pids.add(pid);
    }
    killPids([...pids]);
  } catch {
    // nada escutando
  }
}

function freePortUnix() {
  try {
    const pids = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' })
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    killPids(pids);
  } catch {
    // nada escutando
  }
}

if (process.platform === 'win32') {
  freePortWindows();
} else {
  freePortUnix();
}
