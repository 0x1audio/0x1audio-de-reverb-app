import { useRef, useState } from "react"
import { Button, Dropzone, Label, Progress, useFileDrop } from "@0x1audio/design-system"
import { host, job } from "@0x1audio/sdk/page"

import lava from "./chroma-lava.jpg"
import { basename } from "./drop.ts"

interface JobResult {
  outputs: string[]
  stopped?: boolean
}

export function App() {
  const [file, setFile] = useState("")
  const [notice, setNotice] = useState("")
  const [output, setOutput] = useState("")
  const [pending, setPending] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState("")
  const [stopped, setStopped] = useState(false)
  const [outputs, setOutputs] = useState<string[]>([])
  const stop = useRef<AbortController | null>(null)
  const dragging = useFileDrop((dropped) => {
    if (pending) return
    const bridge = host()
    if (!bridge?.pathFor) {
      setMessage("Update 0x1audio to drop files here, or use Choose audio.")
      return
    }
    const paths = dropped.map((item) => bridge.pathFor?.(item) ?? "").filter(Boolean)
    if (!paths.length) return
    choose(paths[0], paths.length > 1)
  })

  const folder = output ? basename(output) : ""
  const name = file ? basename(file) : ""

  function choose(next: string, several: boolean) {
    setFile(next)
    setNotice(several ? `Using ${basename(next)}. One recording at a time.` : "")
    setOutputs([])
    setMessage("")
    setStopped(false)
  }

  async function chooseFile() {
    const bridge = host()
    if (!bridge?.pick) {
      setMessage("Reopen this app in 0x1audio.")
      return
    }
    const picked = await bridge.pick("file")
    if (picked[0]) choose(picked[0], false)
  }

  async function chooseFolder() {
    const bridge = host()
    if (!bridge?.pick) {
      setMessage("Reopen this app in 0x1audio.")
      return
    }
    const picked = await bridge.pick("folder")
    if (picked[0]) setOutput(picked[0])
  }

  async function start() {
    if (!file || pending) return
    const controller = new AbortController()
    stop.current = controller
    setPending(true)
    setProgress(0)
    setOutputs([])
    setMessage("")
    setStopped(false)
    try {
      const result = await job<JobResult>(
        "start",
        { files: [file], output },
        (fraction) => setProgress(fraction),
        controller.signal,
      )
      if (result.stopped) setStopped(true)
      else if (result.outputs.length) setOutputs(result.outputs)
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessage(error instanceof Error ? error.message : "The echo couldn't be removed. Your original file was not changed.")
      }
    } finally {
      stop.current = null
      setPending(false)
    }
  }

  const saved = outputs[0] ? basename(outputs[0]) : ""

  return (
    <div className="relative min-h-svh bg-background text-foreground">
      <header className="relative h-32">
        <img src={lava} alt="" className="pointer-events-none absolute inset-0 size-full object-cover object-[center_22%]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 from-10% to-background" />
      </header>
      <main className="relative mx-auto flex w-full max-w-md flex-col px-6 pb-10">
        <div className="flex flex-col items-center gap-2 pb-8 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-balance">De-reverb</h1>
          <p className="text-sm text-muted-foreground">Take the room echo out. Everything else stays.</p>
        </div>

        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <Dropzone
              description={file ? <span className="block truncate">{name}</span> : "A recording with room echo."}
              dragging={dragging}
              disabled={pending}
              onChoose={() => void chooseFile()}
            />
            {notice ? <p className="text-center text-sm text-muted-foreground">{notice}</p> : null}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Label className="shrink-0">Save to</Label>
              <span className="min-w-0 flex-1 truncate text-sm">{folder || "Same folder as the audio"}</span>
              <Button type="button" variant="outline" className="h-10 shrink-0" disabled={pending} onClick={() => void chooseFolder()}>
                Choose folder
              </Button>
            </div>
            {output ? (
              <button type="button" className="self-start text-sm text-muted-foreground underline-offset-4 hover:underline" disabled={pending} onClick={() => setOutput("")}>
                Same folder as the audio
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            {outputs.length ? (
              <>
                <p className="text-sm">{folder ? `Saved ${saved} to ${folder}.` : `Saved ${saved} next to the original.`}</p>
                <Button type="button" variant="outline" className="h-10 w-full" onClick={() => void host()?.reveal?.(outputs[0])}>
                  Show in folder
                </Button>
              </>
            ) : null}
            {pending ? (
              <>
                <p className="text-sm">Taking the room echo out of {name}…</p>
                <p className="text-sm text-muted-foreground">This can take a few minutes.</p>
                <Progress value={Math.round(progress * 100)} />
                <Button type="button" variant="outline" className="h-10 w-full" onClick={() => stop.current?.abort()}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button type="button" className="h-12 w-full text-base" disabled={!file} onClick={() => void start()}>
                Remove room echo
              </Button>
            )}
            {stopped ? <p className="text-sm text-muted-foreground">Stopped. Nothing was saved.</p> : null}
            {message ? <p className="text-sm">{message}</p> : null}
          </div>
        </div>
      </main>
    </div>
  )
}
