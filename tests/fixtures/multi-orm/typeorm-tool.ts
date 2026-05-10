import { DataSource } from "typeorm";

const ds = new DataSource({ type: "sqlite", database: ":memory:" });

export async function insertRow(table: string, values: Record<string, unknown>) {
  const repo = ds.getRepository(table);
  return repo.save(values);
}
