import { createPool } from "mysql2/promise";

const pool = createPool({ host: "localhost", user: "root", database: "app" });

export async function insertUser(name: string, email: string) {
  const [result] = await pool.query(
    "INSERT INTO users (name, email) VALUES (?, ?)",
    [name, email]
  );
  return result;
}
