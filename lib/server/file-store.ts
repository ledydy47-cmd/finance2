import fs from "fs/promises"
import path from "path"
import { isKvDisabled } from "@/lib/server/kv-rest"

const RUNTIME_DIR = path.join("/tmp", "kopilka-data")
const BUNDLED_DIR = path.join(process.cwd(), "data")

function useRuntimeStorage() {
  return Boolean(process.env.VERCEL) || isKvDisabled()
}

function bundledPath(filename: string) {
  return path.join(BUNDLED_DIR, filename)
}

function runtimePath(filename: string) {
  return path.join(RUNTIME_DIR, filename)
}

export async function readJsonDataFile<T>(filename: string, fallback: T): Promise<T> {
  const paths = useRuntimeStorage()
    ? [runtimePath(filename), bundledPath(filename)]
    : [bundledPath(filename), runtimePath(filename)]

  for (const filePath of paths) {
    try {
      const raw = await fs.readFile(filePath, "utf8")
      return JSON.parse(raw) as T
    } catch {
      // try next path
    }
  }

  return fallback
}

export async function writeJsonDataFile(filename: string, value: unknown) {
  const filePath = useRuntimeStorage() ? runtimePath(filename) : bundledPath(filename)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(value), "utf8")
}
