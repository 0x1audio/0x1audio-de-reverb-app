import { useRef, useState } from "react"
import { XIcon } from "@phosphor-icons/react"
import { Button, Dropzone, FolderField, Label, Track, toast, useFileDrop } from "@0x1audio/design-system"
import { host, job } from "@0x1audio/sdk/page"

import dryer from "./dryer-header.jpg"
import nozzle from "./dryer-nozzle.jpg"
import { basename } from "./drop.ts"
import { useSongWave, type SongWave } from "./song-wave.ts"
import { Wordmark } from "./wordmark.tsx"

interface JobResult {
  outputs: string[]
  stopped?: boolean
}

export function App() {
  const [file, setFile] = useState("")
  const [blob, setBlob] = useState<Blob | null>(null)
  const [notice, setNotice] = useState("")
  const [output, setOutput] = useState("")
  const [pending, setPending] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("")
  const [stopping, setStopping] = useState(false)
  const [outputs, setOutputs] = useState<string[]>([])
  const stop = useRef<AbortController | null>(null)
  const canceling = useRef(false)
  const source = useSongWave(file, blob)
  const finished = outputs[0] ?? ""
  const result = useSongWave(finished, null)
  const dragging = useFileDrop((dropped) => {
    if (pending) return
    const bridge = host()
    if (!bridge?.pathFor) {
      toast.error("Update 0x1audio to drop files here, or browse your Library.")
      return
    }
    const paths = dropped.map((item) => bridge.pathFor?.(item) ?? "").filter(Boolean)
    if (!paths.length) return
    choose(paths[0], dropped[0] ?? null, paths.length > 1)
  })

  const name = file ? basename(file) : ""

  function choose(next: string, body: Blob | null, several: boolean) {
    setFile(next)
    setBlob(body)
    setNotice(several ? `Using ${basename(next)}. One recording at a time.` : "")
    setOutputs([])
  }

  function take(paths: string[]) {
    if (paths[0]) choose(paths[0], null, false)
  }

  async function chooseFolder() {
    const bridge = host()
    if (!bridge?.pick) {
      toast.error("Reopen this app in 0x1audio.")
      return
    }
    const picked = await bridge.pick("folder")
    if (picked[0]) setOutput(picked[0])
  }

  async function start() {
    if (!file || pending) return
    const controller = new AbortController()
    stop.current = controller
    canceling.current = false
    setStopping(false)
    setPending(true)
    setProgress(0)
    setStatus("Getting ready")
    setOutputs([])
    try {
      const result = await job<JobResult>(
        "start",
        { files: [file], output: output.trim() },
        (fraction, label) => {
          setProgress(fraction)
          if (!canceling.current && label) setStatus(label)
        },
        controller.signal,
      )
      if (result.stopped) toast("Canceled", { description: "Nothing was saved." })
      else if (result.outputs.length) {
        setOutputs(result.outputs)
        toast.success("Dry audio is ready", {
          description: output.trim() ? `Saved to ${basename(output.trim())}.` : "Saved in the same folder as the audio.",
          action: { label: "Show in folder", onClick: () => void host()?.reveal?.(result.outputs[0]) },
        })
      }
    } catch (error) {
      if (controller.signal.aborted) toast("Canceled", { description: "Nothing was saved." })
      else toast.error(error instanceof Error ? error.message : "The audio couldn't be dried. Your original file was not changed.")
    } finally {
      stop.current = null
      canceling.current = false
      setStopping(false)
      setPending(false)
    }
  }

  function cancel() {
    if (canceling.current) return
    canceling.current = true
    setStopping(true)
    setStatus("Canceling…")
    stop.current?.abort()
  }

  return (
    <div className="relative min-h-svh bg-background text-foreground">
      <header className="relative h-44">
        <img src={dryer} alt="" className="pointer-events-none absolute inset-0 size-full object-cover object-center" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-background" />
      </header>
      <main className="relative mx-auto flex w-full max-w-6xl flex-col px-8 pb-6">
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <h1 className="flex items-center gap-4">
            <img src={nozzle} alt="" className="size-24 rounded-full object-cover" />
            <Wordmark className="h-14" />
          </h1>
          <p className="text-sm text-muted-foreground">Dry the room out of a recording.</p>
        </div>

        <div className="grid items-start gap-8 min-[880px]:grid-cols-2">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Dropzone
                title={file ? name : undefined}
                description={file ? undefined : "A recording to dry."}
                dragging={dragging}
                disabled={pending}
                onChoose={take}
                extra={
                  file ? (
                    <button
                      type="button"
                      className="text-sm text-muted-foreground"
                      disabled={pending}
                      aria-label={`Remove ${name}`}
                      onClick={() => choose("", null, false)}
                    >
                      Remove
                    </button>
                  ) : null
                }
              />
              {notice ? <p className="text-center text-sm text-muted-foreground">{notice}</p> : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Save to</Label>
              <FolderField value={output} disabled={pending} onValueChange={setOutput} onBrowse={() => void chooseFolder()} />
            </div>

            <div className="flex flex-col gap-3">
              {pending ? (
                <Button type="button" variant="outline-destructive" className="h-10 w-full" onClick={cancel}>
                  <XIcon size={16} />
                  {stopping ? "Canceling…" : "Cancel"}
                </Button>
              ) : (
                <Button type="button" className="h-12 w-full text-base" disabled={!file} onClick={() => void start()}>
                  Start processing
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Track label="Original" file={file ? basename(file) : ""} wave={source.wave} src={source.src} empty={shape(file, source, "The recording shows up here.")} />
            <Track
              label="Dry audio"
              file={finished ? basename(finished) : ""}
              wave={result.wave}
              src={result.src}
              empty={shape(finished, result, "This shows up when processing finishes.")}
              progress={pending ? { value: Math.round(progress * 100), label: status || "Drying audio" } : null}
            />
          </div>
        </div>
      </main>
    </div>
  )
}

function shape(path: string, state: SongWave, idle: string) {
  if (!path) return idle
  if (!state.settled) return "Reading the recording…"
  if (state.missing) return "Reopen 0x1audio to see the shape."
  if (!state.wave) return "The shape of this file can't be drawn."
  return ""
}
