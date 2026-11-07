import { useRef, useState } from "react"
import { XIcon } from "@phosphor-icons/react"
import { Button, Dropzone, FolderField, Label, Progress, toast, useFileDrop } from "@0x1audio/design-system"
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
  const [status, setStatus] = useState("")
  const [stopping, setStopping] = useState(false)
  const [outputs, setOutputs] = useState<string[]>([])
  const stop = useRef<AbortController | null>(null)
  const canceling = useRef(false)
  const dragging = useFileDrop((dropped) => {
    if (pending) return
    const bridge = host()
    if (!bridge?.pathFor) {
      toast.error("Update 0x1audio to drop files here, or use Choose audio.")
      return
    }
    const paths = dropped.map((item) => bridge.pathFor?.(item) ?? "").filter(Boolean)
    if (!paths.length) return
    choose(paths[0], paths.length > 1)
  })

  const name = file ? basename(file) : ""

  function choose(next: string, several: boolean) {
    setFile(next)
    setNotice(several ? `Using ${basename(next)}. One recording at a time.` : "")
    setOutputs([])
  }

  async function chooseFile() {
    const bridge = host()
    if (!bridge?.pick) {
      toast.error("Reopen this app in 0x1audio.")
      return
    }
    const picked = await bridge.pick("file")
    if (picked[0]) choose(picked[0], false)
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
        toast.success("The room echo is gone", {
          description: output.trim() ? `Saved to ${basename(output.trim())}.` : "Saved in the same folder as the audio.",
          action: { label: "Show in folder", onClick: () => void host()?.reveal?.(result.outputs[0]) },
        })
      }
    } catch (error) {
      if (controller.signal.aborted) toast("Canceled", { description: "Nothing was saved." })
      else toast.error(error instanceof Error ? error.message : "The echo couldn't be removed. Your original file was not changed.")
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
            <Label>Save to</Label>
            <FolderField value={output} disabled={pending} onValueChange={setOutput} onBrowse={() => void chooseFolder()} />
          </div>

          <div className="flex flex-col gap-3">
            {outputs.length ? (
              <Button type="button" variant="outline" className="h-10 w-full" onClick={() => void host()?.reveal?.(outputs[0])}>
                Show {saved}
              </Button>
            ) : null}
            {pending ? (
              <>
                <p className="text-sm">{status || "Getting ready"}</p>
                <Progress value={Math.round(progress * 100)} aria-label={status || "Progress"} />
                <Button type="button" variant="destructive" className="h-10 w-full" onClick={cancel}>
                  <XIcon size={16} />
                  {stopping ? "Canceling…" : "Cancel"}
                </Button>
              </>
            ) : (
              <Button type="button" className="h-12 w-full text-base" disabled={!file} onClick={() => void start()}>
                Start processing
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
