import { DataSource, Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
class User {
  @PrimaryGeneratedColumn()
  id!: number;
  @Column()
  name!: string;
}

const ds = new DataSource({ type: "sqlite", database: ":memory:", entities: [User] });

export async function createUser(name: string) {
  const repo = ds.getRepository(User);
  const user = repo.create({ name });
  return repo.save(user);
}
