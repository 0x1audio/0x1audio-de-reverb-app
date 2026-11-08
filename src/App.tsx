import { useRef, useState } from "react"
import { FolderOpenIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react"
import { Button, Callout, PageSection, Track, toast, transition, useFileDrop } from "@0x1audio/design-system"
import { OxError, ox, type Exported } from "@0x1audio/sdk/page"

import { basename } from "./drop.ts"
import { Hero } from "./hero.tsx"
import { DropOverlay, Intake, SaveTo, WaveSlot, Working } from "./parts.tsx"
import { useSongWave, type SongWave } from "./song-wave.ts"

type Run =
  | { state: "idle" }
  | { state: "working"; progress: number; label: string; stopping: boolean }
  | { state: "done"; outputs: string[] }
  | { state: "failed"; message: string }

export function App() {
  const [file, setFile] = useState("")
  const [blob, setBlob] = useState<Blob | null>(null)
  const [notice, setNotice] = useState("")
  const [output, setOutput] = useState("")
  const [run, setRun] = useState<Run>({ state: "idle" })
  const stop = useRef<AbortController | null>(null)
  const source = useSongWave(file, blob)
  const finished = run.state === "done" ? (run.outputs[0] ?? "") : ""
  const result = useSongWave(finished, null)
  const working = run.state === "working"
  const dragging = useFileDrop((dropped) => {
    if (working) return
    if (!ox.available()) {
      toast.error("Update 0x1audio to drop files here, or browse your Library.")
      return
    }
    const paths = dropped.map((item) => ox.files.fromDrop(item)).filter(Boolean)
    if (!paths.length) return
    choose(paths[0], dropped[0] ?? null, paths.length > 1)
  })

  const name = file ? basename(file) : ""

  function choose(next: string, body: Blob | null, several = false) {
    transition(() => {
      setFile(next)
      setBlob(body)
      setNotice(several ? `Using ${basename(next)}. SonicDryer takes one recording at a time.` : "")
      setRun({ state: "idle" })
    })
  }

  async function start() {
    if (!file || working) return
    const controller = new AbortController()
    stop.current = controller
    const folder = output.trim()
    setNotice("")
    setRun({ state: "working", progress: 0, label: "Getting ready", stopping: false })
    try {
      const done = await ox.run<{ items: Exported[] }>("dry", { recording: file, output: folder || null }, {
        signal: controller.signal,
        onProgress: (fraction, label) =>
          setRun((current) =>
            current.state === "working"
              ? { ...current, progress: fraction ?? current.progress, label: current.stopping || !label ? current.label : label }
              : current,
          ),
      })
      const outputs = done.items.map((item) => item.path)
      if (!outputs.length) {
        setRun({ state: "idle" })
        toast("Canceled", { description: "Nothing was saved." })
      } else {
        setRun({ state: "done", outputs })
      }
    } catch (error) {
      if (controller.signal.aborted || (error instanceof OxError && error.code === "cancelled")) {
        setRun({ state: "idle" })
        toast("Canceled", { description: "Nothing was saved." })
      } else {
        setRun({
          state: "failed",
          message: error instanceof Error && error.message ? error.message : "The audio couldn't be dried. Your original file was not changed.",
        })
      }
    } finally {
      stop.current = null
    }
  }

  function cancel() {
    if (run.state !== "working" || run.stopping) return
    setRun({ ...run, stopping: true, label: "Canceling" })
    stop.current?.abort()
  }

  return (
    <div data-app="sonicdryer" className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-8 px-8 pt-6 pb-10 max-sm:px-4 max-sm:pt-4">
        <Hero />

        {!file ? (
          <Intake
            title="Drop a recording here"
            description="SonicDryer takes the reverb and echo out of a vocal, an instrument, or a voice note. Your original stays as it is."
            dragging={dragging}
            onChoose={(paths) => choose(paths[0], null)}
          />
        ) : (
          <main className="grid animate-enter items-start gap-8 min-[880px]:grid-cols-2">
            <div className="flex flex-col gap-4">
              <PageSection
                className="pt-0"
                title="Recording"
                description="The take you want to dry."
                actions={
                  <Button variant="ghost" size="sm" className="-my-2 -mr-2.5" disabled={working} onClick={() => choose("", null)}>
                    <XIcon />
                    Remove
                  </Button>
                }
              >
                <Track label={name} wave={source.wave} src={source.src} empty={shape(file, source, "Reading the recording…")} />
                {notice ? <p className="text-[13px] text-muted-foreground">{notice}</p> : null}
              </PageSection>

              <SaveTo folder={output} disabled={working} onChange={setOutput} />

              {run.state === "working" ? (
                <Working progress={run.progress} label={run.label} stopping={run.stopping} onCancel={cancel} />
              ) : (
                <Button size="lg" variant={run.state === "done" ? "outline" : "default"} className="mt-2 w-full" onClick={() => void start()}>
                  {run.state === "done" ? "Dry it again" : "Dry it"}
                </Button>
              )}
            </div>

            <PageSection
              className="pt-0"
              title="Dry audio"
              description={
                run.state === "done"
                  ? <span className="block truncate">Saved and added to your Library.</span>
                  : "The same take, without the room."
              }
              actions={
                run.state === "done" ? (
                  <Button variant="ghost" size="sm" className="-my-2 -mr-2.5" onClick={() => void ox.files.reveal(finished)}>
                    <FolderOpenIcon />
                    Show in folder
                  </Button>
                ) : null
              }
            >
              {run.state === "done" ? (
                <Track
                  className="animate-enter [&_canvas]:text-brand"
                  label={basename(finished)}
                  wave={result.wave}
                  src={result.src}
                  empty={shape(finished, result, "")}
                />
              ) : run.state === "failed" ? (
                <Callout
                  tone="danger"
                  icon={<WarningCircleIcon />}
                  title="SonicDryer couldn't finish"
                  actions={
                    <Button variant="outline" size="sm" onClick={() => void start()}>
                      Try again
                    </Button>
                  }
                >
                  {run.message}
                </Callout>
              ) : (
                <WaveSlot label="Dry copy" hint={working ? "On its way" : "Shows up here when it's ready"} working={working} />
              )}
            </PageSection>
          </main>
        )}
      </div>
      {dragging && !working ? <DropOverlay label={file ? "Drop to use this recording instead" : "Drop to use this recording"} /> : null}
    </div>
  )
}

function shape(path: string, state: SongWave, reading: string) {
  if (!path) return ""
  if (!state.settled) return reading || "Reading the file…"
  if (state.missing) return "Reopen 0x1audio to see the shape."
  if (!state.wave) return "The shape of this file can't be drawn."
  return ""
}
