export type MigrationCommandRunner = {
  up: () => Promise<unknown>;
  down: (options?: { to: string | 0 }) => Promise<unknown>;
  pending: () => Promise<Array<{ name: string }>>;
  executed: () => Promise<Array<{ name: string }>>;
};

export const runMigrationCommand = async (
  runner: MigrationCommandRunner,
  command: string,
  all = false
): Promise<string[] | null> => {
  if (command === "up") {
    await runner.up();
    return null;
  }
  if (command === "down") {
    await runner.down(all ? { to: 0 } : undefined);
    return null;
  }
  if (command === "pending") {
    return (await runner.pending()).map(({ name }) => name);
  }
  if (command === "executed") {
    return (await runner.executed()).map(({ name }) => name);
  }

  throw new Error(`Unknown migration command: ${command}`);
};
