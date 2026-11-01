import { io } from "next/cache";

export async function live() {
  await io();
}
