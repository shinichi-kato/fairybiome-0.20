"use client"

import React, { useEffect, useState } from "react"
import { EpisodeStorage } from "../EpisodeStorage/EpisodeStorage"

type PartJson = {
  partName: string
  status: string
  response: any
}

export default function TestChatUI() {
  const [botNames] = useState(["BotA", "BotB"])
  const [parts, setParts] = useState<string[]>(["part1", "part2"]) // initial options
  const [selectedBot, setSelectedBot] = useState(botNames[0])
  const [selectedPart, setSelectedPart] = useState(parts[0])
  const [inputText, setInputText] = useState("")
  const [lastJson, setLastJson] = useState<PartJson | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [storage, setStorage] = useState<any | null>(null)
  const [deployed, setDeployed] = useState(false)
  const [lastRepliedAt, setLastRepliedAt] = useState<string | null>(null)

  useEffect(() => {
    setSelectedPart(parts[0])
  }, [parts])

  async function deployPart() {
    setStatus("deploying")
    setLastJson(null)
    try {
      const s = new EpisodeStorage(selectedBot)
      // read static episode file (EpisodeStorage expects static/bots/{bot}/{part}.episode.json)
      await s.readStatic(selectedBot, selectedPart)
      await s.build(selectedBot, selectedPart)
      setStorage(s)
      setDeployed(true)
      setStatus("deployed")
    } catch (err) {
      setStatus("error")
      setLastJson({ partName: selectedPart, status: "error", response: { error: String(err) } })
    }
  }

  async function send() {
    setStatus("running")
    setLastJson(null)
    try {
      if (deployed && storage) {
        const message = { role: "user", id: "dummy", text: inputText }
        const result = storage.retrieve(message)
        if (!result) {
          setLastJson({ partName: selectedPart, status: "not_found", response: null })
          setStatus("not_found")
        } else {
          const payload: PartJson = {
            partName: selectedPart,
            status: "ok",
            response: { bot: selectedBot, input: inputText, reply: result },
          }
          setLastJson(payload)
          setStatus("ok")
          setLastRepliedAt(new Date().toISOString())
        }
      } else {
        // fallback to static JSON fetch
        const res = await fetch(`/static/bot/part/${selectedPart}.json`)
        if (!res.ok) throw new Error("not found")
        const data = await res.json()
        const payload: PartJson = {
          partName: selectedPart,
          status: data.status ?? "ok",
          response: {
            bot: selectedBot,
            input: inputText,
            partData: data,
          },
        }
        setLastJson(payload)
        setStatus(payload.status)
      }
    } catch (err) {
      setStatus("error")
      setLastJson({ partName: selectedPart, status: "error", response: { error: String(err) } })
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-semibold mb-4">テスト用会話UI</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <label className="flex flex-col">
          <span className="text-sm">チャットボット</span>
          <select value={selectedBot} onChange={(e) => setSelectedBot(e.target.value)} className="mt-1 p-2 border rounded">
            {botNames.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="text-sm">パート</span>
          <select value={selectedPart} onChange={(e) => setSelectedPart(e.target.value)} className="mt-1 p-2 border rounded">
            {parts.map((p) => (
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
