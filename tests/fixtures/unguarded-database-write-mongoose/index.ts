import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({ name: String, email: String });
const User = mongoose.model("User", UserSchema);

export async function createUser(name: string, email: string) {
  const user = new User({ name, email });
  return user.save();
}
