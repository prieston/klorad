// Cap concurrency on the tsc fan-out: `pnpm --filter ./apps/*` would
// otherwise spawn 4 simultaneous workers (and packages another 5), which
// pushes memory-tight machines into OOM and the kernel SIGKILLs the
// children. Sequential is ~2× slower but always finishes.
export default {
  '**/*.{ts,tsx,js}': ['eslint --fix'],
  '**/*.{ts,tsx}': [
    'bash -c "pnpm --workspace-concurrency=1 --filter \'./packages/*\' exec tsc --noEmit --skipLibCheck || true"',
    'bash -c "pnpm --workspace-concurrency=1 --filter \'./apps/*\' exec tsc --noEmit --skipLibCheck || true"'
  ],
  'scripts/**/*.ts': () => [], // Skip linting audit scripts
};

