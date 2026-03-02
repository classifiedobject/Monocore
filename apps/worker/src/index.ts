const apiBase = process.env.WORKER_API_BASE_URL ?? 'http://localhost:4000';

console.log(
  JSON.stringify({
    level: 'info',
    service: 'worker',
    message: 'Worker placeholder running',
    recurringRunDueHint: `POST ${apiBase}/app-api/finance/recurring/run-due`
  })
);
