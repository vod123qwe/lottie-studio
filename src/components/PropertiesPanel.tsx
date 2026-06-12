import { useState, type ReactNode } from 'react'
import { useEditor, useSelectedLayer } from '../store/editorStore'
import { evalProperty } from '../core/interpolate'
import { hexToRgb, rgbToHex } from '../core/factory'
import { type Easing, type PropKind, type Property } from '../core/model'
import { PRESETS, PRESET_CATEGORIES, type PresetCategory } from '../core/presets'
import { Icon, type IconName } from './Icons'

// ---------------------------------------------------------------------------
// Inspector: composition settings on top, then the selected layer's shape,
// fill, animatable transform properties (each with a keyframe toggle + add),
// and one-click animation presets. Sections collapse like Arcade's inspector.
// ---------------------------------------------------------------------------

const round = (n: number) => Math.round(n * 100) / 100

const EASING_LABELS: Record<Easing, string> = {
  linear: 'Linear',
  easeIn: 'Ease In',
  easeOut: 'Ease Out',
  easeInOut: 'Ease In-Out',
  smoothIn: 'Smooth In',
  smoothOut: 'Smooth Out',
  smoothInOut: 'Smooth In-Out',
  backIn: 'Back In',
  backOut: 'Back Out',
  backInOut: 'Back In-Out',
}

const EASING_GROUPS: { label: string; items: Easing[] }[] = [
  { label: 'Basic', items: ['linear', 'easeIn', 'easeOut', 'easeInOut'] },
  { label: 'Smooth', items: ['smoothIn', 'smoothOut', 'smoothInOut'] },
  { label: 'Overshoot', items: ['backIn', 'backOut', 'backInOut'] },
]

const PRESET_ICONS: Record<string, IconName> = {
  // in
  fadeIn: 'sun',
  popIn: 'sparkles',
  zoomIn: 'maximize',
  bounceIn: 'arrow-down',
  slideInLeft: 'arrow-left',
  slideInRight: 'arrow-right',
  slideInUp: 'arrow-up',
  slideInDown: 'arrow-down',
  rollIn: 'rotate',
  flyIn: 'sparkles',
  dropIn: 'arrow-down',
  // out
  fadeOut: 'sunset',
  zoomOut: 'minimize',
  slideOutLeft: 'arrow-left',
  slideOutRight: 'arrow-right',
  slideOutUp: 'arrow-up',
  fallOut: 'arrow-down',
  // emphasis
  shake: 'move',
  wobble: 'activity',
  heartbeat: 'heart',
  flash: 'zap',
  tada: 'sparkles',
  rubberBand: 'maximize',
  // loop
  spin: 'rotate',
  pulse: 'activity',
  float: 'arrow-up',
  breathe: 'activity',
  swing: 'rotate',
  // motion
  ride: 'activity',
  hover: 'arrow-up',
  jump: 'arrow-up',
  wheelie: 'rotate',
  sway: 'activity',
  walkBob: 'move',
  // fx
  speedLines: 'wind',
  dust: 'sparkles',
  sparkle: 'sparkles',
  glow: 'sun',
}

/** Collapsible inspector section with a chevron header. */
function Section({
  title,
  sub,
  defaultOpen = true,
  children,
}: {
  title: string
  sub?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={'prop-group' + (open ? '' : ' collapsed')}>
      <button className={'section-head' + (open ? '' : ' collapsed')} onClick={() => setOpen((v) => !v)}>
        <Icon name="chevron-down" size={14} className="chev" />
        <span className="title">{title}</span>
        {sub && <span className="sub">{sub}</span>}
      </button>
      {open && children}
    </div>
  )
}

function NumField(props: {
  label: string
  value: number
  onCommit: (v: number) => void
  step?: number
  min?: number
}) {
  return (
    <label className="num">
      <span>{props.label}</span>
      <input
        type="number"
        value={round(props.value)}
        step={props.step ?? 1}
        min={props.min}
        onChange={(e) => props.onCommit(parseFloat(e.target.value) || 0)}
      />
    </label>
  )
}

function CompSettings() {
  const comp = useEditor((s) => s.comp)
  const setComp = useEditor((s) => s.setComp)
  return (
    <Section title="Composition">
      <label className="text-field">
        <span>Name</span>
        <input value={comp.name} onChange={(e) => setComp({ name: e.target.value })} />
      </label>
      <div className="row">
        <NumField label="W" value={comp.w} min={1} onCommit={(w) => setComp({ w })} />
        <NumField label="H" value={comp.h} min={1} onCommit={(h) => setComp({ h })} />
      </div>
      <div className="row">
        <NumField label="FPS" value={comp.fr} min={1} onCommit={(fr) => setComp({ fr })} />
        <NumField label="Frames" value={comp.duration} min={1} onCommit={(duration) => setComp({ duration })} />
      </div>
      <label className="color-field">
        <span>Canvas</span>
        <input type="color" value={comp.bg} onChange={(e) => setComp({ bg: e.target.value })} />
        <em>preview only</em>
      </label>
    </Section>
  )
}

/** Stopwatch + add-keyframe controls shared by every animatable row. */
function PropControls({ layerId, kind, prop }: { layerId: string; kind: PropKind; prop: Property }) {
  const playhead = useEditor((s) => s.playhead)
  const toggleAnimated = useEditor((s) => s.toggleAnimated)
  const addKeyframe = useEditor((s) => s.addKeyframe)
  const hasKfHere = prop.animated && prop.keyframes.some((k) => k.t === Math.round(playhead))
  return (
    <div className="prop-controls">
      <button
        className={'stopwatch' + (prop.animated ? ' on' : '')}
        title={prop.animated ? 'Stop animating (bake current value)' : 'Animate this property'}
        onClick={() => toggleAnimated(layerId, kind)}
      >
        <Icon name="clock" size={15} />
      </button>
      <button
        className={'kf-add' + (hasKfHere ? ' filled' : '')}
        title="Add / update keyframe at playhead"
        onClick={() => addKeyframe(layerId, kind)}
      >
        <Icon name="diamond" size={14} />
      </button>
    </div>
  )
}

function Presets({ layerId }: { layerId: string }) {
  const applyPreset = useEditor((s) => s.applyPreset)
  const [cat, setCat] = useState<PresetCategory>('in')
  const list = PRESETS.filter((p) => p.category === cat)
  return (
    <Section title="Presets">
      <div className="cat-tabs">
        {PRESET_CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={'cat-tab' + (c.id === cat ? ' active' : '')}
            onClick={() => setCat(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="preset-grid">
        {list.map((p) => (
          <button key={p.id} className="preset" title={p.hint} onClick={() => applyPreset(layerId, p.id)}>
            <Icon name={PRESET_ICONS[p.id] ?? 'sparkles'} size={15} />
            {p.name}
          </button>
        ))}
      </div>
    </Section>
  )
}

function KeyframeEasing() {
  const ref = useEditor((s) => s.selectedKeyframe)
  const comp = useEditor((s) => s.comp)
  const setKeyframeEasing = useEditor((s) => s.setKeyframeEasing)
  if (!ref) return null
  const layer = comp.layers.find((l) => l.id === ref.layerId)
  const kf = layer?.[ref.prop].keyframes.find((k) => k.id === ref.kfId)
  if (!kf) return null
  return (
    <Section title="Selected keyframe" sub={`frame ${kf.t}`}>
      <label className="text-field">
        <span>Easing</span>
        <select
          value={kf.easing}
          onChange={(e) => setKeyframeEasing(ref.layerId, ref.prop, ref.kfId, e.target.value as Easing)}
        >
          {EASING_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((e) => (
                <option key={e} value={e}>
                  {EASING_LABELS[e]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <p className="hint">Easing applies to the segment leaving this keyframe.</p>
    </Section>
  )
}

const SHAPE_SUB: Record<string, string> = { rect: 'rectangle', ellipse: 'ellipse', path: 'path' }

export function PropertiesPanel() {
  const layer = useSelectedLayer()
  const playhead = useEditor((s) => s.playhead)
  const setProperty = useEditor((s) => s.setProperty)
  const setLayerSize = useEditor((s) => s.setLayerSize)
  const setCornerRadius = useEditor((s) => s.setCornerRadius)
  const setFillEnabled = useEditor((s) => s.setFillEnabled)
  const setStrokeColor = useEditor((s) => s.setStrokeColor)
  const setStrokeWidth = useEditor((s) => s.setStrokeWidth)

  return (
    <section className="panel props-panel">
      <CompSettings />

      {!layer && <p className="empty">Select a layer to edit its properties.</p>}

      {layer && (
        <>
          <Section title="Shape" sub={SHAPE_SUB[layer.shape]}>
            {layer.shape !== 'path' && (
              <>
                <div className="row">
                  <NumField
                    label="W"
                    value={layer.size[0]}
                    min={1}
                    onCommit={(w) => setLayerSize(layer.id, [w, layer.size[1]])}
                  />
                  <NumField
                    label="H"
                    value={layer.size[1]}
                    min={1}
                    onCommit={(h) => setLayerSize(layer.id, [layer.size[0], h])}
                  />
                </div>
                {layer.shape === 'rect' && (
                  <div className="row">
                    <NumField
                      label="R"
                      value={layer.cornerRadius}
                      min={0}
                      onCommit={(r) => setCornerRadius(layer.id, r)}
                    />
                    <div className="num" style={{ visibility: 'hidden' }} />
                  </div>
                )}
              </>
            )}

            <label className="color-field">
              <span>Fill</span>
              <input
                type="color"
                value={rgbToHex(evalProperty(layer.fillColor, playhead))}
                disabled={layer.fillEnabled === false}
                onChange={(e) => setProperty(layer.id, 'fillColor', hexToRgb(e.target.value))}
              />
              {layer.shape === 'path' && (
                <input
                  type="checkbox"
                  className="switch"
                  checked={layer.fillEnabled !== false}
                  title="Toggle fill"
                  onChange={(e) => setFillEnabled(layer.id, e.target.checked)}
                />
              )}
              <PropControls layerId={layer.id} kind="fillColor" prop={layer.fillColor} />
            </label>

            {layer.shape === 'path' && layer.stroke && (
              <label className="color-field">
                <span>Stroke</span>
                <input
                  type="color"
                  value={rgbToHex(layer.stroke.color)}
                  onChange={(e) => setStrokeColor(layer.id, hexToRgb(e.target.value))}
                />
                <div className="num" style={{ maxWidth: 96 }}>
                  <span>W</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={round(layer.stroke.width)}
                    onChange={(e) => setStrokeWidth(layer.id, parseFloat(e.target.value) || 0)}
                  />
                </div>
              </label>
            )}
          </Section>

          <Section title="Transform">
            <div className="prop-row">
              <PropControls layerId={layer.id} kind="position" prop={layer.position} />
              <span className="prop-label">Position</span>
              <div className="row tight">
                <NumField
                  label="X"
                  value={evalProperty(layer.position, playhead)[0]}
                  onCommit={(x) =>
                    setProperty(layer.id, 'position', [x, evalProperty(layer.position, playhead)[1]])
                  }
                />
                <NumField
                  label="Y"
                  value={evalProperty(layer.position, playhead)[1]}
                  onCommit={(y) =>
                    setProperty(layer.id, 'position', [evalProperty(layer.position, playhead)[0], y])
                  }
                />
              </div>
            </div>

            <div className="prop-row">
              <PropControls layerId={layer.id} kind="scale" prop={layer.scale} />
              <span className="prop-label">Scale</span>
              <div className="row tight">
                <NumField
                  label="X%"
                  value={evalProperty(layer.scale, playhead)[0]}
                  onCommit={(x) =>
                    setProperty(layer.id, 'scale', [x, evalProperty(layer.scale, playhead)[1]])
                  }
                />
                <NumField
                  label="Y%"
                  value={evalProperty(layer.scale, playhead)[1]}
                  onCommit={(y) =>
                    setProperty(layer.id, 'scale', [evalProperty(layer.scale, playhead)[0], y])
                  }
                />
              </div>
            </div>

            <div className="prop-row">
              <PropControls layerId={layer.id} kind="rotation" prop={layer.rotation} />
              <span className="prop-label">Rotation</span>
              <div className="row tight">
                <NumField
                  label="°"
                  value={evalProperty(layer.rotation, playhead)[0]}
                  onCommit={(r) => setProperty(layer.id, 'rotation', [r])}
                />
              </div>
            </div>

            <div className="prop-row">
              <PropControls layerId={layer.id} kind="opacity" prop={layer.opacity} />
              <span className="prop-label">Opacity</span>
              <div className="row tight">
                <NumField
                  label="%"
                  value={evalProperty(layer.opacity, playhead)[0]}
                  min={0}
                  onCommit={(o) =>
                    setProperty(layer.id, 'opacity', [Math.max(0, Math.min(100, o))])
                  }
                />
              </div>
            </div>
          </Section>

          <Presets layerId={layer.id} />
        </>
      )}

      <KeyframeEasing />
    </section>
  )
}
