import mongoose from "mongoose";

const ItemSchema = new mongoose.Schema({ name: String, value: Number });
const Item = mongoose.model("Item", ItemSchema);

export async function saveItem(name: string, value: number) {
  const item = new Item({ name, value });
  return item.save();
}
