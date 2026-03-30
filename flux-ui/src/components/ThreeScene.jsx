import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function ThreeScene({ style }) {
  const mountRef = useRef(null)
  const sceneRef = useRef({})

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const W = mount.clientWidth
    const H = mount.clientHeight

    // ── Renderer ──────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    // ── Scene ─────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x0D1117, 0.038)
    scene.background = new THREE.Color(0x0D1117)

    // ── Camera ────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100)
    camera.position.set(0, 6, 14)
    camera.lookAt(0, 0, 0)

    // ── Lighting ──────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0x112244, 1.2)
    scene.add(ambient)

    const dirLight = new THREE.DirectionalLight(0x00B4D8, 2.2)
    dirLight.position.set(8, 14, 6)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.set(1024, 1024)
    dirLight.shadow.camera.near = 0.1
    dirLight.shadow.camera.far = 50
    scene.add(dirLight)

    const pTeal = new THREE.PointLight(0x00B4D8, 1.8, 18)
    pTeal.position.set(0, 4, 2)
    scene.add(pTeal)

    const pRed1 = new THREE.PointLight(0xF85149, 2.2, 12)
    pRed1.position.set(-4, 3, 0)
    scene.add(pRed1)

    const pRed2 = new THREE.PointLight(0xF85149, 1.8, 12)
    pRed2.position.set(5, 2, -3)
    scene.add(pRed2)

    // ── Grid ──────────────────────────────────────────────────────────
    const grid = new THREE.GridHelper(28, 28, 0x00B4D8, 0x00B4D8)
    grid.material.opacity = 0.18
    grid.material.transparent = true
    scene.add(grid)

    // ── Server Block Builder ──────────────────────────────────────────
    function makeServer(x, z, chaos = false) {
      const group = new THREE.Group()

      // Body
      const bodyMat = new THREE.MeshPhongMaterial({
        color:     chaos ? 0x2A1820 : 0x1C2128,
        shininess: 30,
        specular:  new THREE.Color(0x224466),
      })
      const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1.1, 3.2), bodyMat)
      body.castShadow = true
      body.receiveShadow = true
      group.add(body)

      // Tray base
      const trayMat = new THREE.MeshPhongMaterial({ color: 0x0D1117, shininess: 80 })
      const tray = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.15, 3.3), trayMat)
      tray.position.y = -0.62
      group.add(tray)

      // 4 cylinder legs
      const legMat = new THREE.MeshPhongMaterial({ color: 0x30363D, shininess: 60 })
      const legPositions = [[-0.7,-0.75,1.2],[-0.7,-0.75,-1.2],[0.7,-0.75,1.2],[0.7,-0.75,-1.2]]
      legPositions.forEach(([lx,ly,lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8), legMat)
        leg.position.set(lx, ly, lz)
        group.add(leg)
      })

      // LED strip front edge
      const ledColor = chaos ? 0xF85149 : 0x00B4D8
      const ledMat   = new THREE.MeshBasicMaterial({ color: ledColor })
      const led      = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.06), ledMat)
      led.position.set(0, 0.2, 1.62)
      group.add(led)

      // LED glow quad behind strip
      const glowGeo  = new THREE.PlaneGeometry(1.9, 0.5)
      const glowMat  = new THREE.MeshBasicMaterial({
        color:       ledColor,
        transparent: true,
        opacity:     0.18,
        side:        THREE.DoubleSide,
      })
      const glow = new THREE.Mesh(glowGeo, glowMat)
      glow.position.set(0, 0.2, 1.58)
      group.add(glow)

      group.position.set(x, 0, z)
      group.userData = {
        chaos,
        led,
        ledMat,
        glowMat,
        baseY:  0,
        freq:   0.35 + Math.random() * 0.45,
        amp:    0.08 + Math.random() * 0.10,
        rotSpd: (Math.random() > 0.5 ? 1 : -1) * (0.002 + Math.random() * 0.003),
        phase:  Math.random() * Math.PI * 2,
      }

      scene.add(group)
      return group
    }

    // 7 server blocks at staggered positions
    const positions = [
      [-5, -3], [-2, -3], [1, -3],   // back row
      [-3.5, 0], [0.5, 0],            // mid row
      [-1.5, 3], [2.5, 3],            // front row
    ]
    const servers = positions.map(([x, z], i) =>
      makeServer(x, z, i === 1 || i === 5) // index 1 and 5 are chaos nodes
    )

    // ── OTel Trace Lines ──────────────────────────────────────────────
    const connections = [
      [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[0,3],[1,4]
    ]
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00B4D8, transparent: true, opacity: 0.15
    })
    connections.forEach(([a, b]) => {
      const pa = servers[a].position
      const pb = servers[b].position
      const points = [
        new THREE.Vector3(pa.x, 0.6, pa.z),
        new THREE.Vector3((pa.x+pb.x)/2, 1.5, (pa.z+pb.z)/2),
        new THREE.Vector3(pb.x, 0.6, pb.z),
      ]
      const curve = new THREE.CatmullRomCurve3(points)
      const geoLine = new THREE.BufferGeometry().setFromPoints(curve.getPoints(20))
      scene.add(new THREE.Line(geoLine, lineMat))
    })

    // ── Mouse Parallax ────────────────────────────────────────────────
    const mouse = { x: 0, y: 0 }
    const camTarget = { x: 0, y: 6, z: 14 }
    const camCurrent = { x: 0, y: 6, z: 14 }
    const onMouseMove = (e) => {
      mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2
      mouse.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', onMouseMove)

    // ── Animation Loop ────────────────────────────────────────────────
    let animId
    const clock = new THREE.Clock()

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()

      servers.forEach(srv => {
        const { chaos, led, ledMat, glowMat, freq, amp, rotSpd, phase } = srv.userData
        srv.position.y = Math.sin(t * freq * Math.PI * 2 + phase) * amp
        srv.rotation.y += rotSpd

        if (chaos) {
          // Flickering red LED
          const flicker = Math.sin(t * 8.5) > 0.25
          ledMat.color.set(flicker ? 0xF85149 : 0x661010)
          glowMat.opacity = flicker ? 0.22 : 0.05
        }
      })

      // Camera parallax lerp
      camTarget.x = -mouse.x * 2.8
      camTarget.y = 6 - mouse.y * 1.6
      camCurrent.x += (camTarget.x - camCurrent.x) * 0.04
      camCurrent.y += (camTarget.y - camCurrent.y) * 0.04
      camera.position.set(camCurrent.x, camCurrent.y, camCurrent.z)
      camera.lookAt(0, 0, 0)

      renderer.render(scene, camera)
    }
    animate()

    // ── Resize ────────────────────────────────────────────────────────
    const onResize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    // ── Cleanup ───────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div ref={mountRef} style={{
      width: '100%', height: '420px',
      position: 'relative',
      ...style,
    }}>
      {/* SVG Data Flow Lines */}
      <svg style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', overflow: 'hidden',
      }}>
        {[0,1,2,3,4].map(i => (
          <line key={i}
            x1={`${20 + i * 15}%`} y1="0%"
            x2={`${12 + i * 15}%`} y2="100%"
            stroke="#00B4D8" strokeWidth="1"
            strokeDasharray="8 28"
            style={{
              opacity: 0.12,
              animation: `data-flow ${1.8 + i * 0.4}s linear infinite`,
            }}
          />
        ))}
      </svg>

      {/* Text Overlay */}
      <div style={{
        position:   'absolute', inset: 0,
        display:    'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        <h1 className="flux-hero-text" style={{
          fontFamily:   "'Chakra Petch', sans-serif",
          fontSize:     '52px',
          fontWeight:   800,
          letterSpacing:'0.12em',
          color:        '#E6EDF3',
          textShadow:   '0 0 80px rgba(0,180,216,0.4), 0 0 40px rgba(0,180,216,0.2)',
          textTransform:'uppercase',
          lineHeight:   1,
        }}>FLUX</h1>

        <p className="flux-hero-sub" style={{
          fontFamily:   "'JetBrains Mono', monospace",
          fontSize:     '12px',
          color:        '#007A96',
          letterSpacing:'0.15em',
          marginTop:    '12px',
          textAlign:    'center',
        }}>
          vCluster Orchestration · OpenTelemetry · LLM Analysis
        </p>
      </div>

      {/* Bottom gradient fade */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '120px',
        background: 'linear-gradient(to bottom, transparent, #0D1117)',
        pointerEvents: 'none',
      }} />
    </div>
  )
}
