import { kvRestGet, kvRestSet } from "@/lib/server/kv-rest"

const flashSaleKey = (userKey: string) => `kopilka:flash-sale:${userKey}`

export async function setFlashSaleStartedAt(userKey: string, startedAt: string) {
  return kvRestSet(flashSaleKey(userKey), startedAt)
}

export async function getFlashSaleStartedAt(userKey: string) {
  return kvRestGet(flashSaleKey(userKey))
}

export async function clearFlashSaleStartedAt(userKey: string) {
  return kvRestSet(flashSaleKey(userKey), "")
}
