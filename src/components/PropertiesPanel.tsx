import { useEditor, useSelectedLayer } from '../store/editorStore'
import { evalProperty } from '../core/interpolate'
import { hexToRgb, rgbToHex } from '../core/factory'
import { EASINGS, type PropKind, type Property } from '../core/model'
import { PRESETS } from '../core/presets'

// ---------------------------------------------------------------------------
// Inspector: composition settings on top, then the selected layer's shape,
// fill, animatable transform properties (each with a keyframe toggle + add),
// and one-click animation presets.
// ---------------------------------------------------------------------------

const round = (n: number) => Math.round(n * 100) / 100

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
    <div className="prop-group">
      <div className="panel-head">Composition</div>
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
    </div>
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
        ⏱
      </button>
      <button
        className={'kf-add' + (hasKfHere ? ' filled' : '')}
        title="Add / update keyframe at playhead"
        onClick={() => addKeyframe(layerId, kind)}
      >
        ◆
      </button>
    </div>
  )
}

function Presets({ layerId }: { layerId: string }) {
  const applyPreset = useEditor((s) => s.applyPreset)
  return (
    <div className="prop-group">
      <div className="panel-head">Presets</div>
      <div className="preset-grid">
        {PRESETS.map((p) => (
          <button key={p.id} className="preset" title={p.hint} onClick={() => applyPreset(layerId, p.id)}>
            {p.name}
          </button>
        ))}
      </div>
    </div>
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
    <div className="prop-group">
      <div className="panel-head">Selected keyframe</div>
      <label className="text-field">
        <span>Easing</span>
        <select
          value={kf.easing}
          onChange={(e) => setKeyframeEasing(ref.layerId, ref.prop, ref.kfId, e.target.value as never)}
        >
          {EASINGS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </label>
      <p className="hint">Easing applies to the segment leaving this keyframe (frame {kf.t}).</p>
    </div>
  )
}

export function PropertiesPanel() {
  const layer = useSelectedLayer()
  const playhead = useEditor((s) => s.playhead)
  const setProperty = useEditor((s) => s.setProperty)
  const setLayerSize = useEditor((s) => s.setLayerSize)
  const setCornerRadius = useEditor((s) => s.setCornerRadius)

  return (
    <section className="panel props-panel">
      <CompSettings />

      {!layer && <p className="empty">Select a layer to edit its properties.</p>}

      {layer && (
        <>
          <div className="prop-group">
            <div className="panel-head">Shape · {layer.shape}</div>
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
              <NumField
                label="Radius"
                value={layer.cornerRadius}
                min={0}
                onCommit={(r) => setCornerRadius(layer.id, r)}
              />
            )}
            <label className="color-field">
              <span>Fill</span>
              <input
                type="color"
                value={rgbToHex(evalProperty(layer.fillColor, playhead))}
                onChange={(e) => setProperty(layer.id, 'fillColor', hexToRgb(e.target.value))}
              />
              <PropControls layerId={layer.id} kind="fillColor" prop={layer.fillColor} />
            </label>
          </div>

          <div className="prop-group">
            <div className="panel-head">Transform</div>

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
          </div>

          <Presets layerId={layer.id} />
        </>
      )}

      <KeyframeEasing />
    </section>
  )
}
