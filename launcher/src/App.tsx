import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import './App.css'

type TimelineEntry = {
  timestamp: string
  message: string
  tone: 'info' | 'success' | 'error'
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const App = () => {
  const [status, setStatus] = useState('Ready')
  const [progress, setProgress] = useState(0)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [isTauriReady, setIsTauriReady] = useState(false)

  const appendLog = useCallback(
    (message: string, tone: TimelineEntry['tone'] = 'info') => {
      setTimeline((prev) => [
        { timestamp: new Date().toLocaleTimeString(), message, tone },
        ...prev,
      ].slice(0, 6))
    },
    []
  )

  useEffect(() => {
    setIsTauriReady(
      typeof window !== 'undefined' && Boolean((window as any).__TAURI_IPC__)
    )
  }, [])

  useEffect(() => {
    if (!isTauriReady) {
      setStatus(
        'Web preview mode: Tauri bridge inactive. Use "npm run tauri dev" for the native updater.'
      )
      return
    }

    let unlistenStatus: UnlistenFn | null = null
    let unlistenProgress: UnlistenFn | null = null

    ;(async () => {
      unlistenStatus = await listen<string>('status', (event) => {
        setStatus(event.payload)
        appendLog(event.payload)
      })

      unlistenProgress = await listen<number>('progress', (event) => {
        setProgress(event.payload)
      })
    })()

    return () => {
      unlistenStatus?.()
      unlistenProgress?.()
    }
  }, [appendLog, isTauriReady])

  const runWebPreviewDemo = useCallback(async () => {
    const steps: { label: string; progress: number; tone?: TimelineEntry['tone'] }[] = [
      { label: 'Scanning install footprint…', progress: 10 },
      { label: 'Resolving manifest ➝ version 1.0.0', progress: 25 },
      { label: 'Downloading 3 files (simulated)…', progress: 55 },
      { label: 'Verifying SHA-256 fingerprints…', progress: 75 },
      { label: 'Applying atomically to live folder…', progress: 90 },
      { label: 'Update complete ✔', progress: 100, tone: 'success' },
    ]

    for (const step of steps) {
      setStatus(step.label)
      appendLog(step.label, step.tone ?? 'info')
      setProgress(step.progress)
      await delay(step.progress === 100 ? 400 : 700)
    }
  }, [appendLog])

  const handleUpdate = async () => {
    setStatus('Starting update…')
    setProgress(0)
    appendLog('Update requested', 'info')

    if (!isTauriReady) {
      await runWebPreviewDemo()
      return
    }

    try {
      await invoke('start_update')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Error: ${message}`)
      appendLog(message, 'error')
    }
  }

  const runtimeLabel = isTauriReady ? 'Tauri bridge active' : 'Web preview (mock)'
  const runtimeTone = isTauriReady ? 'badge-online' : 'badge-offline'

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">CanartWorks Launcher</p>
          <h1>Crash-safe patch pipeline</h1>
          <p className="subhead">
            Plan → Download → Verify → Apply → Verify again. Every update obeys
            the invariant roll-forward-or-rollback promise.
          </p>
          <div className="hero-badges">
            <span className={`badge ${runtimeTone}`}>{runtimeLabel}</span>
            <span className="badge badge-muted">SHA-256 integrity</span>
            <span className="badge badge-muted">Atomic apply</span>
          </div>
        </div>
      </header>

      <main className="panel-grid">
        <section className="panel primary">
          <div className="panel-header">
            <div>
              <p className="label">Update channel</p>
              <h2>Stable • 1.0.0</h2>
            </div>
            <button className="ghost-button">Switch channel</button>
          </div>

          <div className="status-row">
            <p className="status-text">{status}</p>
            <span className="eta">ETA auto-calculated</span>
          </div>

          <div className="progress">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-meta">
            <span>{progress.toFixed(0)}%</span>
            <span>Crash-safe updater</span>
          </div>

          <div className="action-row">
            <button className="cta" onClick={handleUpdate}>
              {isTauriReady ? 'Start update' : 'Simulate update'}
            </button>
            <button
              className="secondary"
              onClick={() => {
                setStatus('Manual repair scheduled')
                appendLog('User requested repair verification run.', 'info')
              }}
            >
              Verify & repair
            </button>
          </div>
        </section>

        <section className="panel secondary">
          <h3>Telemetry snapshot</h3>
          <ul className="metrics">
            <li>
              <span className="metric-label">Last success</span>
              <span className="metric-value">1.0.0 • build123</span>
            </li>
            <li>
              <span className="metric-label">Download policy</span>
              <span className="metric-value">Chunked + resume</span>
            </li>
            <li>
              <span className="metric-label">Rollback window</span>
              <span className="metric-value">Previous 2 builds</span>
            </li>
          </ul>
        </section>

        <section className="panel log">
          <div className="panel-header compact">
            <h3>Event feed</h3>
            <button
              className="ghost-button"
              onClick={() => setTimeline([])}
            >
              Clear
            </button>
          </div>
          <ul className="timeline">
            {timeline.length === 0 && (
              <li className="timeline-empty">No events yet. Kick off an update.</li>
            )}
            {timeline.map((entry, index) => (
              <li key={`${entry.timestamp}-${index}`} className={`timeline-item ${entry.tone}`}>
                <span className="timestamp">{entry.timestamp}</span>
                <p>{entry.message}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}

export default App
