import got from "got";

export async function postData(url: string, data: unknown) {
  return got.post(url, { json: data });
}
