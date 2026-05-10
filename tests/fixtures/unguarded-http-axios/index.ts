import axios from "axios";

export async function postData(url: string, data: unknown) {
  return axios.post(url, data);
}
