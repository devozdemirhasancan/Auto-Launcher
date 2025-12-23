import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import './App.css';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const App = () => {
    const [status, setStatus] = useState('Ready');
    const [progress, setProgress] = useState(0);
    const [timeline, setTimeline] = useState([]);
    const [isTauriReady, setIsTauriReady] = useState(false);
    const appendLog = useCallback((message, tone = 'info') => {
        setTimeline((prev) => [
            { timestamp: new Date().toLocaleTimeString(), message, tone },
            ...prev,
        ].slice(0, 6));
    }, []);
    useEffect(() => {
        setIsTauriReady(typeof window !== 'undefined' && Boolean(window.__TAURI_IPC__));
    }, []);
    useEffect(() => {
        if (!isTauriReady) {
            setStatus('Web preview mode: Tauri bridge inactive. Use "npm run tauri dev" for the native updater.');
            return;
        }
        let unlistenStatus = null;
        let unlistenProgress = null;
        (async () => {
            unlistenStatus = await listen('status', (event) => {
                setStatus(event.payload);
                appendLog(event.payload);
            });
            unlistenProgress = await listen('progress', (event) => {
                setProgress(event.payload);
            });
        })();
        return () => {
            unlistenStatus?.();
            unlistenProgress?.();
        };
    }, [appendLog, isTauriReady]);
    const runWebPreviewDemo = useCallback(async () => {
        const steps = [
            { label: 'Scanning install footprint…', progress: 10 },
            { label: 'Resolving manifest ➝ version 1.0.0', progress: 25 },
            { label: 'Downloading 3 files (simulated)…', progress: 55 },
            { label: 'Verifying SHA-256 fingerprints…', progress: 75 },
            { label: 'Applying atomically to live folder…', progress: 90 },
            { label: 'Update complete ✔', progress: 100, tone: 'success' },
        ];
        for (const step of steps) {
            setStatus(step.label);
            appendLog(step.label, step.tone ?? 'info');
            setProgress(step.progress);
            await delay(step.progress === 100 ? 400 : 700);
        }
    }, [appendLog]);
    const handleUpdate = async () => {
        setStatus('Starting update…');
        setProgress(0);
        appendLog('Update requested', 'info');
        if (!isTauriReady) {
            await runWebPreviewDemo();
            return;
        }
        try {
            await invoke('start_update');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setStatus(`Error: ${message}`);
            appendLog(message, 'error');
        }
    };
    const runtimeLabel = isTauriReady ? 'Tauri bridge active' : 'Web preview (mock)';
    const runtimeTone = isTauriReady ? 'badge-online' : 'badge-offline';
    return (_jsxs("div", { className: "app-shell", children: [_jsx("header", { className: "hero", children: _jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "CanartWorks Launcher" }), _jsx("h1", { children: "Crash-safe patch pipeline" }), _jsx("p", { className: "subhead", children: "Plan \u2192 Download \u2192 Verify \u2192 Apply \u2192 Verify again. Every update obeys the invariant roll-forward-or-rollback promise." }), _jsxs("div", { className: "hero-badges", children: [_jsx("span", { className: `badge ${runtimeTone}`, children: runtimeLabel }), _jsx("span", { className: "badge badge-muted", children: "SHA-256 integrity" }), _jsx("span", { className: "badge badge-muted", children: "Atomic apply" })] })] }) }), _jsxs("main", { className: "panel-grid", children: [_jsxs("section", { className: "panel primary", children: [_jsxs("div", { className: "panel-header", children: [_jsxs("div", { children: [_jsx("p", { className: "label", children: "Update channel" }), _jsx("h2", { children: "Stable \u2022 1.0.0" })] }), _jsx("button", { className: "ghost-button", children: "Switch channel" })] }), _jsxs("div", { className: "status-row", children: [_jsx("p", { className: "status-text", children: status }), _jsx("span", { className: "eta", children: "ETA auto-calculated" })] }), _jsx("div", { className: "progress", children: _jsx("div", { className: "progress-bar", style: { width: `${progress}%` } }) }), _jsxs("div", { className: "progress-meta", children: [_jsxs("span", { children: [progress.toFixed(0), "%"] }), _jsx("span", { children: "Crash-safe updater" })] }), _jsxs("div", { className: "action-row", children: [_jsx("button", { className: "cta", onClick: handleUpdate, children: isTauriReady ? 'Start update' : 'Simulate update' }), _jsx("button", { className: "secondary", onClick: () => {
                                            setStatus('Manual repair scheduled');
                                            appendLog('User requested repair verification run.', 'info');
                                        }, children: "Verify & repair" })] })] }), _jsxs("section", { className: "panel secondary", children: [_jsx("h3", { children: "Telemetry snapshot" }), _jsxs("ul", { className: "metrics", children: [_jsxs("li", { children: [_jsx("span", { className: "metric-label", children: "Last success" }), _jsx("span", { className: "metric-value", children: "1.0.0 \u2022 build123" })] }), _jsxs("li", { children: [_jsx("span", { className: "metric-label", children: "Download policy" }), _jsx("span", { className: "metric-value", children: "Chunked + resume" })] }), _jsxs("li", { children: [_jsx("span", { className: "metric-label", children: "Rollback window" }), _jsx("span", { className: "metric-value", children: "Previous 2 builds" })] })] })] }), _jsxs("section", { className: "panel log", children: [_jsxs("div", { className: "panel-header compact", children: [_jsx("h3", { children: "Event feed" }), _jsx("button", { className: "ghost-button", onClick: () => setTimeline([]), children: "Clear" })] }), _jsxs("ul", { className: "timeline", children: [timeline.length === 0 && (_jsx("li", { className: "timeline-empty", children: "No events yet. Kick off an update." })), timeline.map((entry, index) => (_jsxs("li", { className: `timeline-item ${entry.tone}`, children: [_jsx("span", { className: "timestamp", children: entry.timestamp }), _jsx("p", { children: entry.message })] }, `${entry.timestamp}-${index}`)))] })] })] })] }));
};
export default App;
