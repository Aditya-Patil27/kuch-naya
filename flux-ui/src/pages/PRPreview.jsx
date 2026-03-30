import { useState } from 'react'
import { C, FONTS, cardBorder } from '../tokens'
import { PrimaryBtn, GhostBtn } from '../components/UI'

const SCENARIOS = [
  {
    id:      'block',
    label:   'MERGE BLOCKED',
    verdict: 'BLOCK',
    markdown: `## 🔴 MERGE BLOCKED — Performance Regression Detected

**PR #406** · \`ui/dashboard\` · \`refactor/lazy-comment-thread\`

---

### Critical Finding

The lazy-loading implementation introduces a **synchronous DOM reflow cascade** under concurrent load.

| Metric | Baseline | PR Branch | Delta |
|--------|----------|-----------|-------|
| P50 Latency | \`42ms\` | \`189ms\` | **+347%** 🔴 |
| P99 Latency | \`94ms\` | \`242ms\` | **+157%** 🔴 |
| Error Rate | \`0.02%\` | \`2.8%\` | **+13,900%** 🔴 |
| DB Connections | \`48\` | \`312\` | **+550%** 🔴 |

### Chaos Scenarios Executed

\`LATENCY_INJECTION\` · \`POD_TERMINATION\` · \`PACKET_LOSS_8PCT\`

### Recommendation

\`\`\`js
// Use requestAnimationFrame to defer layout reads
observer = new IntersectionObserver((entries) => {
  requestAnimationFrame(() => {
    entries.forEach(e => e.target.load())
  })
})
\`\`\`

**Confidence:** HIGH · **Analysis Duration:** 7m 14s`,
    source: [
      { line: '## 🔴 MERGE BLOCKED — Performance Regression', type:'header' },
      { line: '',                                                type:'blank' },
      { line: 'PR #406 · ui/dashboard',                         type:'meta' },
      { line: '',                                                type:'blank' },
      { line: '| Metric | Baseline | PR Branch | Delta |',       type:'table-header' },
      { line: '|--------|----------|-----------|-------|',        type:'divider' },
      { line: '| P50 Latency | 42ms | 189ms | +347% 🔴 |',       type:'table-row-fail' },
      { line: '| P99 Latency | 94ms | 242ms | +157% 🔴 |',       type:'table-row-fail' },
      { line: '| Error Rate  | 0.02%| 2.8%  | +13900% 🔴 |',     type:'table-row-fail' },
      { line: '',                                                type:'blank' },
      { line: '### Chaos Scenarios Executed',                    type:'sub-header' },
      { line: 'LATENCY_INJECTION · POD_TERMINATION · PACKET_LOSS', type:'body' },
      { line: '',                                                type:'blank' },
      { line: '// Use requestAnimationFrame to defer layout reads', type:'code' },
      { line: 'observer = new IntersectionObserver((entries) => {', type:'code' },
      { line: '  requestAnimationFrame(() => {',                 type:'code' },
      { line: '    entries.forEach(e => e.target.load())',       type:'code' },
      { line: '  })',                                            type:'code' },
      { line: '})',                                              type:'code' },
    ],
  },
  {
    id:      'pass',
    label:   'PR PASSED',
    verdict: 'PASS',
    markdown: `## 🟢 MERGE APPROVED — No Regressions Detected

**PR #405** · \`core/db\` · \`fix/connection-pool-exhaustion\`

---

### Summary

Connection pool exhaustion fix improves P99 latency by **-5.6%** across all tested endpoints.

| Metric | Baseline | PR Branch | Delta |
|--------|----------|-----------|-------|
| P50 Latency | \`42ms\` | \`40ms\` | **-4.8%** 🟢 |
| P99 Latency | \`94ms\` | \`80ms\` | **-14.9%** 🟢 |
| Error Rate | \`0.02%\` | \`0.01%\` | **-50%** 🟢 |

**Confidence:** HIGH · **Analysis Duration:** 4m 08s`,
    source: [
      { line: '## 🟢 MERGE APPROVED — No Regressions',        type:'header-pass' },
      { line: '',                                              type:'blank' },
      { line: 'PR #405 · core/db',                            type:'meta' },
      { line: '',                                              type:'blank' },
      { line: '| Metric | Baseline | PR Branch | Delta |',     type:'table-header' },
      { line: '|--------|----------|-----------|-------|',      type:'divider' },
      { line: '| P50 Latency | 42ms | 40ms | -4.8% 🟢 |',     type:'table-row-pass' },
      { line: '| P99 Latency | 94ms | 80ms | -14.9% 🟢 |',    type:'table-row-pass' },
      { line: '| Error Rate  | 0.02%| 0.01% | -50% 🟢 |',     type:'table-row-pass' },
    ],
  },
  {
    id:      'warn',
    label:   'WARN — REVIEW',
    verdict: 'WARN',
    markdown: `## 🟡 REVIEW REQUESTED — Minor Regressions

**PR #403** · \`infra/platform\` · \`chore/upgrade-platform-runtime-1.29\`

---

P99 latency increased by **+9.7%** — within acceptable range but warrants review.

**Confidence:** MEDIUM · **Analysis Duration:** 3m 21s`,
    source: [
      { line: '## 🟡 REVIEW REQUESTED — Minor Regressions',  type:'header-warn' },
      { line: '',                                             type:'blank' },
      { line: 'PR #403 · infra/platform',                    type:'meta' },
      { line: '',                                             type:'blank' },
      { line: 'P99 latency increased by +9.7% — within',    type:'body' },
      { line: 'acceptable range but warrants review.',        type:'body' },
      { line: '',                                             type:'blank' },
      { line: 'Confidence: MEDIUM · Duration: 3m 21s',       type:'meta' },
    ],
  },
]

function getSourceColor(type) {
  switch (type) {
    case 'header':      return C.teal
    case 'header-pass': return C.green
    case 'header-warn': return C.amber
    case 'sub-header':  return C.teal
    case 'table-header':return '#7d8590'
    case 'divider':     return '#30363D'
    case 'table-row-fail': return C.red
    case 'table-row-pass': return C.green
    case 'code':        return '#CE9178'
    case 'meta':        return C.muted
    case 'blank':       return 'transparent'
    default:            return '#7d8590'
  }
}

function MarkdownRenderer({ content }) {
  const lines = content.split('\n')
  return (
    <div style={{ fontFamily:"Georgia, serif", fontSize:'14px', lineHeight:1.7, color:'#24292F' }}>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height:'8px' }} />
        if (line.startsWith('## ')) return (
          <h2 key={i} style={{ fontSize:'18px', fontWeight:700, marginBottom:'8px', marginTop:'8px', borderBottom:'1px solid #D0D7DE', paddingBottom:'8px' }}>
            {line.replace('## ','')}
          </h2>
        )
        if (line.startsWith('### ')) return (
          <h3 key={i} style={{ fontSize:'14px', fontWeight:600, marginBottom:'6px', marginTop:'12px' }}>
            {line.replace('### ','')}
          </h3>
        )
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} style={{ fontWeight:700 }}>{line.replace(/\*\*/g,'')}</p>
        }
        if (line.startsWith('|')) {
          const cells = line.split('|').filter(Boolean).map(c => c.trim())
          const isDivider = line.includes('---')
          if (isDivider) return null
          return (
            <div key={i} style={{ display:'flex', gap:'0', borderBottom:'1px solid #D0D7DE' }}>
              {cells.map((cell, ci) => (
                <div key={ci} style={{ flex:1, padding:'6px 10px', fontFamily:"'JetBrains Mono', monospace", fontSize:'12px', color:'#24292F' }}>
                  {cell}
                </div>
              ))}
            </div>
          )
        }
        if (line.startsWith('```') || line.endsWith('```')) return null
        if (line.startsWith('---')) return <hr key={i} style={{ border:'none', borderTop:'1px solid #D0D7DE', margin:'12px 0' }} />
        return <p key={i} style={{ marginBottom:'4px' }} dangerouslySetInnerHTML={{ __html:
          line
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code style="background:#f6f8fa;border:1px solid #D0D7DE;border-radius:4px;padding:2px 6px;font-family:JetBrains Mono,monospace;font-size:12px">$1</code>')
        }} />
      })}
    </div>
  )
}

export default function PRPreview() {
  const [activeScenario, setActiveScenario] = useState('block')
  const [copied, setCopied] = useState(false)

  const scenario = SCENARIOS.find(s => s.id === activeScenario)

  const handleCopy = () => {
    navigator.clipboard?.writeText(scenario.markdown).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const verdictColor = scenario.verdict === 'BLOCK' ? '#CF222E' : scenario.verdict === 'PASS' ? '#1A7F37' : '#9A6700'
  const verdictBg    = scenario.verdict === 'BLOCK' ? '#FFEBE9' : scenario.verdict === 'PASS' ? '#DAFBE1' : '#FFF8C5'

  return (
    <div style={{ paddingTop:'56px', background:'#0D1117', minHeight:'100vh' }}>
      <div style={{ padding:'28px' }}>
        <div style={{ marginBottom:'20px' }}>
          <h1 style={{ fontFamily:FONTS.heading, fontSize:'22px', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:C.text }}>
            PR COMMENT PREVIEW
          </h1>
          <p style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.muted, marginTop:'4px' }}>
            GitHub-rendered AI analysis output
          </p>
        </div>

        {/* Scenario switcher */}
        <div style={{ display:'flex', gap:'10px', marginBottom:'20px' }}>
          {SCENARIOS.map(s => (
            <button key={s.id} onClick={() => setActiveScenario(s.id)} style={{
              fontFamily: FONTS.heading, fontSize:'12px', fontWeight:700,
              letterSpacing:'0.06em', textTransform:'uppercase',
              padding:'7px 20px', borderRadius:'6px', cursor:'pointer',
              border: activeScenario===s.id ? `1px solid rgba(0,180,216,0.5)` : `1px solid ${C.border}`,
              background: activeScenario===s.id ? `linear-gradient(#161B22, #161B22) padding-box, linear-gradient(135deg, rgba(0,180,216,0.4), rgba(48,54,61,0.8)) border-box` : 'transparent',
              color: activeScenario===s.id ? C.teal : C.muted,
              transition:'all 0.2s',
            }}>{s.label}</button>
          ))}
        </div>

        {/* 50/50 split */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>

          {/* LEFT — Raw source */}
          <div style={{ ...cardBorder(), overflow:'hidden', animation:'fadeUp 0.4s both' }}>
            <div style={{ background:'#0D1117', padding:'12px 16px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ fontFamily:FONTS.heading, fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted }}>
                RAW MARKDOWN SOURCE
              </span>
            </div>
            <div style={{ padding:'16px', overflowX:'auto' }}>
              {scenario.source.map((l, i) => (
                <div key={i} style={{
                  fontFamily: FONTS.mono,
                  fontSize: '11px',
                  lineHeight: '20px',
                  whiteSpace: 'pre',
                  color: getSourceColor(l.type),
                }}>
                  {l.line || '\u00A0'}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — GitHub simulation */}
          <div style={{ animation:'fadeUp 0.4s 0.08s both' }}>
            {/* GitHub-style comment bubble */}
            <div style={{
              background:'#ffffff',
              borderRadius:'10px',
              border:'1px solid #D0D7DE',
              overflow:'hidden',
              boxShadow:'0 1px 0 rgba(27,31,36,0.04)',
            }}>
              {/* Comment header */}
              <div style={{
                background:'#F6F8FA',
                borderBottom:'1px solid #D0D7DE',
                padding:'8px 16px',
                display:'flex', alignItems:'center', justifyContent:'space-between',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  {/* Bot avatar */}
                  <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'#0D1117', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontSize:'12px' }}>⚡</span>
                  </div>
                  <span style={{ fontFamily:"'Segoe UI', system-ui, sans-serif", fontSize:'13px', fontWeight:600, color:'#24292F' }}>
                    flux-ai-bot
                  </span>
                  <span style={{ fontFamily:"'Segoe UI', system-ui, sans-serif", fontSize:'12px', color:'#57606A' }}>
                    commented just now
                  </span>
                </div>
                {/* Verdict badge */}
                <span style={{
                  background: verdictBg, color: verdictColor,
                  border:`1px solid ${verdictColor}40`,
                  borderRadius:'20px', padding:'3px 10px',
                  fontFamily:"'Segoe UI', system-ui, sans-serif",
                  fontSize:'12px', fontWeight:700,
                }}>
                  {scenario.verdict === 'BLOCK' ? '✕ MERGE BLOCKED' : scenario.verdict === 'PASS' ? '✓ APPROVED' : '⚠ REVIEW'}
                </span>
              </div>

              {/* Comment body */}
              <div style={{ padding:'16px 20px', maxHeight:'480px', overflowY:'auto' }}>
                <MarkdownRenderer content={scenario.markdown} />
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display:'flex', gap:'12px', marginTop:'20px' }}>
          <PrimaryBtn onClick={handleCopy} style={{
            transition:'background 0.2s, color 0.2s',
            background: copied ? C.green : C.teal,
          }}>
            {copied ? '✓ COPIED' : 'COPY MARKDOWN'}
          </PrimaryBtn>
          <GhostBtn>VIEW ON GITHUB ↗</GhostBtn>
        </div>
      </div>
    </div>
  )
}
