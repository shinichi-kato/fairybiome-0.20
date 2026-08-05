"use client"

import React, { useEffect, useState, useReducer } from "react"
import { EpisodeStorage } from "../EpisodeStorage/EpisodeStorage"

type PartJson = {
  partName: string
  status: string
  response: any
}

type BotAndParts = {
  partTree: Record<string, string[]>
  botNames: string[]
  partNames: string[]
  selectedBot: string
  selectedPart: string
}

type BotAndPartsAction =
  | { type: 'SET_SELECTED_BOT'; botName: string }
  | { type: 'SET_SELECTED_PART'; partName: string }

function reducer(state: BotAndParts, action: BotAndPartsAction): BotAndParts {
  switch (action.type) {
    case 'SET_SELECTED_BOT': {
      const selectedBot = action.botName
      const partNames = selectedBot ? state.partTree[selectedBot] ?? [] : []
      const selectedPart = partNames[0] ?? ''
      return {
        ...state,
        selectedBot,
        partNames,
        selectedPart,
      }
    }
    case 'SET_SELECTED_PART': {
      return {
        ...state,
        selectedPart: action.partName,
      }
    }
    default:
      return state
  }
}


function initializeBotAndParts(): BotAndParts {
  const staticFilesJson = process.env.NEXT_PUBLIC_STATIC_FILES
  if (!staticFilesJson) {
    return {
      partTree: {},
      botNames: [],
      partNames: [],
      selectedBot: "",
      selectedPart: "",
    }
  }

  let staticFiles
  try {
    staticFiles = JSON.parse(staticFilesJson)
  } catch (err) {
    console.warn('TestChatUI: failed to parse NEXT_PUBLIC_STATIC_FILES', err)
    return {
      partTree: {},
      botNames: [],
      partNames: [],
      selectedBot: "",
      selectedPart: "",
    }
  }

  if (!staticFiles || typeof staticFiles !== 'object' || Array.isArray(staticFiles)) {
    return {
      partTree: {},
      botNames: [],
      partNames: [],
      selectedBot: "",
      selectedPart: "",
    }
  }

  const bots = staticFiles.bots
  if (!bots || typeof bots !== 'object' || Array.isArray(bots)) {
    return {
      partTree: {},
      botNames: [],
      partNames: [],
      selectedBot: "",
      selectedPart: "",
    }
  }

  const partTreeSets: Record<string, Set<string>> = {}

  for (const [botName, partPaths] of Object.entries(bots)) {
    if (!Array.isArray(partPaths)) continue

    if (!partTreeSets[botName]) {
      partTreeSets[botName] = new Set()
    }

    for (const entry of partPaths) {
      if (typeof entry !== 'string') continue

      const normalized = entry.replace(/\\/g, '/')
      const match = normalized.match(/^static\/bots\/([^\/]+)\/(.+?)\.episode\.json$/)
      const simpleMatch = normalized.match(/([^/]+)\.episode\.json$/)
      const partName = match ? match[2] : simpleMatch ? simpleMatch[1] : null
      if (!partName) continue

      partTreeSets[botName].add(partName)
    }
  }

  const botNames = Object.keys(partTreeSets).sort()
  const partTree: Record<string, string[]> = {}
  for (const botName of botNames) {
    partTree[botName] = Array.from(partTreeSets[botName]).sort()
  }

  const selectedBot = botNames[0] ?? ""
  const partNames = selectedBot ? partTree[selectedBot] : []
  const selectedPart = partNames[0] ?? ""

  return {
    partTree,
    botNames,
    partNames,
    selectedBot,
    selectedPart,
  }
}

export default function TestChatUI() {
  const initialBotAndParts = initializeBotAndParts()
  const [botAndParts, dispatch] = useReducer(reducer, initialBotAndParts)
  const [inputText, setInputText] = useState("")
  const [lastJson, setLastJson] = useState<PartJson | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [storage, setStorage] = useState<any | null>(null)
  const [deployed, setDeployed] = useState(false)
  const [lastRepliedAt, setLastRepliedAt] = useState<string | null>(null)

  async function deployPart() {
    setStatus("deploying")
    setLastJson(null)
    try {
      const s = new EpisodeStorage(botAndParts.selectedBot)
      // read static episode file (EpisodeStorage expects static/bots/{bot}/{part}.episode.json)
      await s.readStatic(botAndParts.selectedBot, botAndParts.selectedPart)
      await s.build(botAndParts.selectedBot, botAndParts.selectedPart)
      setStorage(s)
      setDeployed(true)
      setStatus("deployed")
    } catch (err) {
      setStatus("error")
      setLastJson({ partName: botAndParts.selectedPart, status: "error", response: { error: String(err) } })
    }
  }

  async function send() {
    setStatus("running")
    setLastJson(null)
    try {
      if (deployed && storage) {
        const message = { role: "user", id: "dummy", text: inputText }
        const verbose = true;
        const result = storage.retrieve(message, verbose)
        if (!result) {
          setLastJson({ partName: botAndParts.selectedPart, status: "not_found", response: null })
          setStatus("not_found")
        } else {
          const payload: PartJson = {
            partName: botAndParts.selectedPart,
            status: "ok",
            response: {
              bot: botAndParts.selectedBot,
              input: inputText,
              ...result,
            },
          }
          setLastJson(payload)
          setStatus("ok")
          setLastRepliedAt(new Date().toISOString())
        }
      } else {
        // fallback to static JSON fetch
        const res = await fetch(`/static/bot/part/${botAndParts.selectedPart}.json`)
        if (!res.ok) throw new Error("not found")
        const data = await res.json()
        const payload: PartJson = {
          partName: botAndParts.selectedPart,
          status: data.status ?? "ok",
          response: {
            bot: botAndParts.selectedBot,
            input: inputText,
            partData: data,
          },
        }
        setLastJson(payload)
        setStatus(payload.status)
      }
    } catch (err) {
      setStatus("error")
      setLastJson({ partName: botAndParts.selectedPart, status: "error", response: { error: String(err) } })
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-semibold mb-4">テスト用会話UI</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <label className="flex flex-col">
          <span className="text-sm">チャットボット</span>
          <select value={botAndParts.selectedBot} onChange={(e) => dispatch({ type: 'SET_SELECTED_BOT', botName: e.target.value })} className="mt-1 p-2 border rounded">
            {botAndParts.botNames.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="text-sm">パート</span>
          <select value={botAndParts.selectedPart} onChange={(e) => dispatch({ type: 'SET_SELECTED_PART', partName: e.target.value })} className="mt-1 p-2 border rounded">
            {botAndParts.partNames.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col md:col-span-1">
          <span className="text-sm">ステータス</span>
          <div className="mt-1 p-2 border rounded h-10 flex items-center">{status ?? "idle"}</div>
        </label>
      </div>

      <div className="mb-4">
        <label className="flex flex-col">
          <span className="text-sm">ユーザ入力</span>
          <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} className="mt-1 p-2 border rounded h-28" />
        </label>
      </div>

      <div className="flex gap-3 mb-6 items-center">
        {!deployed ? (
          <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={deployPart}>
            Deploy
          </button>
        ) : (
          <div className="px-3 py-1 bg-green-100 text-green-800 rounded">Deployed</div>
        )}

        <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={send}>
          送信
        </button>

        <button
          className="px-4 py-2 border rounded"
          onClick={() => {
            setInputText("")
            setLastJson(null)
            setStatus(null)
          }}
        >
          クリア
        </button>

        {lastRepliedAt ? <div className="ml-4 text-sm text-gray-600">Last reply: {new Date(lastRepliedAt).toLocaleString()}</div> : null}
      </div>

      <div>
        <h3 className="font-medium mb-2">パートから返されたJSON</h3>
        <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-64">{lastJson ? JSON.stringify(lastJson, null, 2) : "(empty)"}</pre>
      </div>
    </div>
  )
}
