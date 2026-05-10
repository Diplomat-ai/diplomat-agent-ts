import axios from "axios";
import got from "got";

export async function axiosPoster(url: string, data: unknown) {
  return axios.post(url, data);
}

export async function fetchPoster(url: string, data: unknown) {
  return fetch(url, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function gotPoster(url: string, data: unknown) {
  return got.post(url, { json: data });
}
