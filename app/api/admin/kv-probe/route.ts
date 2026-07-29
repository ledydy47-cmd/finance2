import { NextResponse } from "next/server"
import { isAdminSupportAuthorized } from "@/lib/server/admin-auth"
import {
  hasKvRestConfig,
  kvRestDel,
  kvRestGet,
  kvRestPipeline,
  kvRestSet,
  kvRestType,
} from "@/lib/server/kv-rest"

export const maxDuration = 30

export async function GET(request: Request) {
  if (!isAdminSupportAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  if (!hasKvRestConfig()) {
    return NextResponse.json({ error: "NO_KV_CONFIG" })
  }

  const probeKey = "kopilka:kv-probe"
  const probeValue = `probe-${Date.now()}`
  const indexKey = "kopilka:analytics:user-index"

  const setResult = await kvRestSet(probeKey, probeValue)
  const getResult = await kvRestGet(probeKey)
  const pipelineResult = await kvRestPipeline([
    ["SET", `${probeKey}:pipe`, probeValue],
    ["SADD", indexKey, "kv-probe-user"],
  ])
  const indexType = await kvRestType(indexKey)
  await kvRestDel(probeKey)
  await kvRestDel(`${probeKey}:pipe`)

  return NextResponse.json({
    setOk: setResult,
    getMatches: getResult === probeValue,
    pipelineOk: pipelineResult.ok,
    pipelineError: pipelineResult.ok ? null : pipelineResult.error,
    indexType,
  })
}
