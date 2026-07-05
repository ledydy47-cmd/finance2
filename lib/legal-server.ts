import fs from "fs"
import path from "path"

export function readLegalDocument(filename: "terms.md" | "privacy.md") {
  const filePath = path.join(process.cwd(), "legal", filename)
  return fs.readFileSync(filePath, "utf8")
}
