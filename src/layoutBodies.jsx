import React from "react";
import { CaseStudyVisual, CaseStudyWireGrid } from "./caseStudyShared";
import { CHAPTERS } from "./layoutContent";
import { MONO, HEADER, BODY, luminance } from "./editorialUtils";

function chromPanelBg(bandText, i) {
  const light = luminance(bandText) > 0.55;
  const a = i % 2 === 0 ? 0.1 : 0.18;
  return light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
}

function onColorSurface(bandText, alpha) {
  return luminance(bandText) > 0.55 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
}

export function EditorialChapterNav({ ink, accent }) {
  return (
    <nav className="ed-spread-chapters" aria-label="Case study sections">
      {CHAPTERS.map((ch) => (
        <a key={ch.id} href={`#cs-${ch.id}`} className="ed-spread-chapter" style={{ fontFamily: MONO }}>
          <span style={{ color: accent }}>{ch.num}</span>
          <span style={{ color: ink }}>{ch.label}</span>
        </a>
      ))}
    </nav>
  );
}

export function ChromaticChapterNav({ bandText, accent }) {
  return (
    <nav className="chrom-dock" aria-label="Case study sections" style={{ color: bandText }}>
      {CHAPTERS.map((ch) => (
        <a
          key={ch.id}
          href={`#cs-${ch.id}`}
          className="chrom-dock-link"
          style={{ fontFamily: MONO, borderColor: onColorSurface(bandText, 0.28), background: onColorSurface(bandText, 0.1) }}
        >
          {ch.label}
        </a>
      ))}
    </nav>
  );
}

export function FrameChapterNav({ ink, accent, cloth }) {
  return (
    <nav className="frame-chips" aria-label="Case study sections">
      {CHAPTERS.map((ch) => (
        <a
          key={ch.id}
          href={`#cs-${ch.id}`}
          className="frame-chip"
          style={{ fontFamily: MONO, background: `${accent}18`, color: ink, borderColor: `${ink}12` }}
        >
          {ch.num} {ch.label}
        </a>
      ))}
    </nav>
  );
}

export function CaseStudyBodyEditorial({ content, ink, bodyInk, accent, hue, skipOverview = false }) {
  return (
    <div className="ed-spread-body cs-editorial">
      {!skipOverview && (
        <CaseStudyVisual slot="overview" caption="Overview" ink={ink} accent={accent} hue={hue} priority tall />
      )}

      <span className="cs-section-index" style={{ fontFamily: MONO, color: accent }}>01</span>
      <section id="cs-problem" className="cs-section-main">
        <h2 className="cs-section-title" style={{ fontFamily: MONO, color: accent }}>Problem</h2>
        <p className="cs-body" style={{ fontFamily: BODY, color: bodyInk }}>{content.problem}</p>
      </section>

      <div className="cs-span-full">
        <CaseStudyVisual slot="discovery" caption="Discovery & structure" ink={ink} accent={accent} hue={hue} />
      </div>

      <span className="cs-section-index" style={{ fontFamily: MONO, color: accent }}>02</span>
      <section id="cs-process" className="cs-section-main">
        <h2 className="cs-section-title" style={{ fontFamily: MONO, color: accent }}>Process</h2>
        <p className="cs-body" style={{ fontFamily: BODY, color: bodyInk }}>{content.process}</p>
        <ol className="cs-steps">
          {content.processSteps.map((step, i) => (
            <li key={step} className="cs-step" style={{ fontFamily: BODY, color: bodyInk }}>
              <span className="cs-step-num" style={{ fontFamily: MONO, color: accent }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <span className="cs-section-index" style={{ fontFamily: MONO, color: accent }}>03</span>
      <section id="cs-solution" className="cs-section-main cs-section-main--quote">
        <h2 className="cs-section-title" style={{ fontFamily: MONO, color: accent }}>Solution</h2>
        <blockquote className="cs-pullquote-text" style={{ fontFamily: HEADER, color: ink, borderLeftColor: accent }}>
          {content.solution}
        </blockquote>
      </section>

      <span className="cs-section-index" style={{ fontFamily: MONO, color: accent }}>04</span>
      <section id="cs-wireframes" className="cs-section-main">
        <h2 className="cs-section-title" style={{ fontFamily: MONO, color: accent }}>Wireframes</h2>
        <p className="cs-body" style={{ fontFamily: BODY, color: bodyInk }}>{content.wireframeLofi}</p>
        <CaseStudyWireGrid variant="lofi" ink={ink} accent={accent} />
        <p className="cs-body cs-body--gap" style={{ fontFamily: BODY, color: bodyInk }}>{content.wireframeHifi}</p>
        <CaseStudyVisual slot="final" caption="Final interface" ink={ink} accent={accent} hue={hue} />
      </section>

      <span className="cs-section-index" style={{ fontFamily: MONO, color: accent }}>05</span>
      <section id="cs-impact" className="cs-section-main">
        <h2 className="cs-section-title" style={{ fontFamily: MONO, color: accent }}>Impact</h2>
        <p className="cs-body" style={{ fontFamily: BODY, color: bodyInk }}>{content.impact}</p>
        <div className="cs-metrics">
          {content.impactStats.map((stat) => (
            <div key={stat.label} className="cs-metric" style={{ borderColor: `${ink}08` }}>
              <div className="cs-metric-value" style={{ fontFamily: HEADER, color: accent }}>{stat.value}</div>
              <div className="cs-metric-label" style={{ fontFamily: BODY, color: bodyInk }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function CaseStudyBodyChromatic({ content, ink, bodyInk, accent, hue, bandText, skipOverview = false }) {
  const panel = (i) => chromPanelBg(bandText, i);

  return (
    <div className="chrom-study">
      {!skipOverview && (
        <div className="chrom-bleed">
          <CaseStudyVisual slot="overview" caption="Overview" ink={ink} accent={accent} hue={hue} priority tall />
        </div>
      )}

      <section id="cs-problem" className="chrom-panel" style={{ background: panel(0) }}>
        <span className="chrom-panel-num" style={{ fontFamily: MONO, color: bandText }}>01</span>
        <h2 className="chrom-panel-title" style={{ fontFamily: HEADER, color: bandText }}>Problem</h2>
        <p className="chrom-panel-body" style={{ fontFamily: BODY, color: bandText }}>{content.problem}</p>
      </section>

      <div className="chrom-bleed chrom-bleed--inset">
        <CaseStudyVisual slot="discovery" caption="Discovery" ink={ink} accent={accent} hue={hue} />
      </div>

      <section id="cs-process" className="chrom-panel" style={{ background: panel(1) }}>
        <span className="chrom-panel-num" style={{ fontFamily: MONO, color: bandText }}>02</span>
        <h2 className="chrom-panel-title" style={{ fontFamily: HEADER, color: bandText }}>Process</h2>
        <p className="chrom-panel-body" style={{ fontFamily: BODY, color: bandText }}>{content.process}</p>
        <ol className="chrom-steps">
          {content.processSteps.map((step, i) => (
            <li key={step} style={{ fontFamily: BODY, color: bandText, borderColor: onColorSurface(bandText, 0.22) }}>
              <span style={{ fontFamily: MONO }}>{String(i + 1).padStart(2, "0")}</span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section id="cs-solution" className="chrom-panel chrom-panel--quote" style={{ background: panel(0) }}>
        <span className="chrom-panel-num" style={{ fontFamily: MONO, color: bandText }}>03</span>
        <blockquote className="chrom-quote" style={{ fontFamily: HEADER, color: bandText }}>
          {content.solution}
        </blockquote>
      </section>

      <section id="cs-wireframes" className="chrom-panel" style={{ background: panel(1) }}>
        <span className="chrom-panel-num" style={{ fontFamily: MONO, color: bandText }}>04</span>
        <h2 className="chrom-panel-title" style={{ fontFamily: HEADER, color: bandText }}>Wireframes</h2>
        <p className="chrom-panel-body" style={{ fontFamily: BODY, color: bandText }}>{content.wireframeLofi}</p>
        <div className="chrom-wire-wrap">
          <CaseStudyWireGrid variant="lofi" ink={bandText} accent={bandText} />
        </div>
        <CaseStudyVisual slot="final" caption="Final interface" ink={ink} accent={accent} hue={hue} />
      </section>

      <section id="cs-impact" className="chrom-panel chrom-panel--stats" style={{ background: panel(0) }}>
        <span className="chrom-panel-num" style={{ fontFamily: MONO, color: bandText }}>05</span>
        <h2 className="chrom-panel-title" style={{ fontFamily: HEADER, color: bandText }}>Impact</h2>
        <p className="chrom-panel-body" style={{ fontFamily: BODY, color: bandText }}>{content.impact}</p>
        <div className="chrom-stats">
          {content.impactStats.map((stat) => (
            <div key={stat.label} className="chrom-stat" style={{ borderColor: onColorSurface(bandText, 0.28) }}>
              <div className="chrom-stat-value" style={{ fontFamily: HEADER, color: bandText }}>{stat.value}</div>
              <div className="chrom-stat-label" style={{ fontFamily: MONO, color: bandText }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Compact case study body for the floating project card */
export function CaseStudyBodyCard({ content, ink, bodyInk, accent, hue, skipOverview = false, pegSections = false }) {
  const block = (id, num, title, children) => (
    <section key={id} id={id} className={`card-section${pegSections ? " card-section--peg" : ""}`}>
      {pegSections && <span className="card-section-peg" style={{ color: accent }} aria-hidden>◆</span>}
      <span className="card-section-num" style={{ fontFamily: MONO, color: accent }}>{num}</span>
      <h2 className="card-section-title" style={{ fontFamily: MONO, color: accent }}>{title}</h2>
      {children}
    </section>
  );

  return (
    <div className="card-body">
      {!skipOverview && (
        <CaseStudyVisual slot="overview" caption="Overview" ink={ink} accent={accent} hue={hue} priority />
      )}
      {block("cs-problem", "01", "Problem", (
        <p style={{ fontFamily: BODY, color: bodyInk, margin: 0, lineHeight: 1.65 }}>{content.problem}</p>
      ))}
      <CaseStudyVisual slot="discovery" caption="Discovery" ink={ink} accent={accent} hue={hue} />
      {block("cs-process", "02", "Process", (
        <>
          <p style={{ fontFamily: BODY, color: bodyInk, margin: "0 0 12px", lineHeight: 1.65 }}>{content.process}</p>
          <ol className="card-steps">
            {content.processSteps.map((step, i) => (
              <li key={step} style={{ fontFamily: BODY, color: bodyInk }}>
                <span style={{ fontFamily: MONO, color: accent }}>{String(i + 1).padStart(2, "0")}</span>
                {step}
              </li>
            ))}
          </ol>
        </>
      ))}
      {block("cs-solution", "03", "Solution", (
        <blockquote className="card-quote" style={{ fontFamily: HEADER, color: ink, borderColor: accent }}>
          {content.solution}
        </blockquote>
      ))}
      {block("cs-wireframes", "04", "Wireframes", (
        <>
          <p style={{ fontFamily: BODY, color: bodyInk, margin: "0 0 12px" }}>{content.wireframeLofi}</p>
          <CaseStudyWireGrid variant="lofi" ink={ink} accent={accent} />
          <CaseStudyVisual slot="final" caption="Final" ink={ink} accent={accent} hue={hue} />
        </>
      ))}
      {block("cs-impact", "05", "Impact", (
        <>
          <p style={{ fontFamily: BODY, color: bodyInk, margin: "0 0 16px" }}>{content.impact}</p>
          <div className="card-metrics">
            {content.impactStats.map((stat) => (
              <div key={stat.label} className="card-metric" style={{ borderColor: `${ink}10` }}>
                <div style={{ fontFamily: HEADER, color: accent }}>{stat.value}</div>
                <div style={{ fontFamily: BODY, color: bodyInk, fontSize: 12 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </>
      ))}
    </div>
  );
}

export function CaseStudyBodyStudio({ content, ink, bodyInk, accent, hue, skipOverview = false }) {
  const section = (id, index, title, children) => (
    <section key={id} id={id} className="studio-section">
      <span className="studio-section-num" style={{ fontFamily: MONO, color: accent }}>{index}</span>
      <h2 className="studio-section-title" style={{ fontFamily: MONO, color: accent }}>{title}</h2>
      {children}
    </section>
  );

  return (
    <div className="studio-body">
      {!skipOverview && (
        <div className="studio-visual">
          <CaseStudyVisual slot="overview" caption="Overview" ink={ink} accent={accent} hue={hue} priority tall />
        </div>
      )}

      {section("cs-problem", "01", "Problem", (
        <p className="studio-section-body" style={{ fontFamily: BODY, color: bodyInk }}>{content.problem}</p>
      ))}

      <div className="studio-visual">
        <CaseStudyVisual slot="discovery" caption="Discovery & structure" ink={ink} accent={accent} hue={hue} />
      </div>

      {section("cs-process", "02", "Process", (
        <>
          <p className="studio-section-body" style={{ fontFamily: BODY, color: bodyInk }}>{content.process}</p>
          <ol className="studio-steps">
            {content.processSteps.map((step, i) => (
              <li key={step} style={{ fontFamily: BODY, color: bodyInk, borderColor: `${ink}10` }}>
                <span style={{ fontFamily: MONO, color: accent }}>{String(i + 1).padStart(2, "0")}</span>
                {step}
              </li>
            ))}
          </ol>
        </>
      ))}

      {section("cs-solution", "03", "Solution", (
        <blockquote className="studio-quote" style={{ fontFamily: HEADER, color: ink, borderLeftColor: accent }}>
          {content.solution}
        </blockquote>
      ))}

      {section("cs-wireframes", "04", "Wireframes", (
        <>
          <p className="studio-section-body" style={{ fontFamily: BODY, color: bodyInk }}>{content.wireframeLofi}</p>
          <CaseStudyWireGrid variant="lofi" ink={ink} accent={accent} />
          <p className="studio-section-body studio-section-body--gap" style={{ fontFamily: BODY, color: bodyInk }}>{content.wireframeHifi}</p>
          <CaseStudyVisual slot="final" caption="Final interface" ink={ink} accent={accent} hue={hue} />
        </>
      ))}

      {section("cs-impact", "05", "Impact", (
        <>
          <p className="studio-section-body" style={{ fontFamily: BODY, color: bodyInk }}>{content.impact}</p>
          <div className="studio-metrics">
            {content.impactStats.map((stat) => (
              <div key={stat.label} className="studio-metric" style={{ borderColor: `${ink}10` }}>
                <div className="studio-metric-value" style={{ fontFamily: HEADER, color: accent }}>{stat.value}</div>
                <div className="studio-metric-label" style={{ fontFamily: BODY, color: bodyInk }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </>
      ))}
    </div>
  );
}

export function CaseStudyBodySpread({ content, ink, bodyInk, accent, hue, cloth, skipOverview = false }) {
  const band = (type, children, id) => (
    <section key={id || type} id={id} className={`spread-band spread-band--${type}`}>
      {children}
    </section>
  );

  return (
    <div className="spread-study">
      {!skipOverview && band("visual", (
        <CaseStudyVisual slot="overview" caption="Overview" ink={ink} accent={accent} hue={hue} priority tall />
      ))}

      {band("text", (
        <>
          <span className="spread-num" style={{ fontFamily: MONO, color: accent }}>01</span>
          <h2 className="spread-title" style={{ fontFamily: HEADER, color: ink }}>Problem</h2>
          <p className="spread-body" style={{ fontFamily: BODY, color: bodyInk }}>{content.problem}</p>
        </>
      ), "cs-problem")}

      {band("visual", (
        <CaseStudyVisual slot="discovery" caption="Discovery" ink={ink} accent={accent} hue={hue} />
      ))}

      {band("text", (
        <>
          <span className="spread-num" style={{ fontFamily: MONO, color: accent }}>02</span>
          <h2 className="spread-title" style={{ fontFamily: HEADER, color: ink }}>Process</h2>
          <p className="spread-body" style={{ fontFamily: BODY, color: bodyInk }}>{content.process}</p>
          <ol className="spread-steps">
            {content.processSteps.map((step, i) => (
              <li key={step} style={{ fontFamily: BODY, color: bodyInk }}>
                <span style={{ fontFamily: MONO, color: accent }}>{String(i + 1).padStart(2, "0")}</span>
                {step}
              </li>
            ))}
          </ol>
        </>
      ), "cs-process")}

      {band("quote", (
        <>
          <span className="spread-num" style={{ fontFamily: MONO, color: accent }}>03</span>
          <blockquote className="spread-quote" style={{ fontFamily: HEADER, color: ink }}>{content.solution}</blockquote>
        </>
      ), "cs-solution")}

      {band("text", (
        <>
          <span className="spread-num" style={{ fontFamily: MONO, color: accent }}>04</span>
          <h2 className="spread-title" style={{ fontFamily: HEADER, color: ink }}>Wireframes</h2>
          <p className="spread-body" style={{ fontFamily: BODY, color: bodyInk }}>{content.wireframeLofi}</p>
          <CaseStudyWireGrid variant="lofi" ink={ink} accent={accent} />
          <CaseStudyVisual slot="final" caption="Final" ink={ink} accent={accent} hue={hue} />
        </>
      ), "cs-wireframes")}

      {band("stats", (
        <>
          <span className="spread-num" style={{ fontFamily: MONO, color: accent }}>05</span>
          <h2 className="spread-title" style={{ fontFamily: HEADER, color: ink }}>Impact</h2>
          <p className="spread-body" style={{ fontFamily: BODY, color: bodyInk }}>{content.impact}</p>
          <div className="spread-stats">
            {content.impactStats.map((stat) => (
              <div key={stat.label} className="spread-stat">
                <div className="spread-stat-value" style={{ fontFamily: HEADER, color: accent }}>{stat.value}</div>
                <div className="spread-stat-label" style={{ fontFamily: MONO, color: bodyInk }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </>
      ), "cs-impact")}
    </div>
  );
}

export function CaseStudyBodyMagazine({ content, ink, bodyInk, accent, hue, skipOverview = false }) {
  return (
    <div className="magazine-body">
      {!skipOverview && (
        <div className="magazine-visual magazine-visual--hero">
          <CaseStudyVisual slot="overview" caption="Overview" ink={ink} accent={accent} hue={hue} priority tall />
        </div>
      )}

      <div className="magazine-row" id="cs-problem">
        <div className="magazine-copy">
          <span className="magazine-num" style={{ fontFamily: MONO, color: accent }}>01</span>
          <h2 className="magazine-title" style={{ fontFamily: HEADER, color: ink }}>Problem</h2>
          <p style={{ fontFamily: BODY, color: bodyInk }}>{content.problem}</p>
        </div>
        <div className="magazine-aside magazine-aside--visual">
          <CaseStudyVisual slot="discovery" caption="Discovery" ink={ink} accent={accent} hue={hue} />
        </div>
      </div>

      <div className="magazine-row magazine-row--reverse" id="cs-process">
        <div className="magazine-copy">
          <span className="magazine-num" style={{ fontFamily: MONO, color: accent }}>02</span>
          <h2 className="magazine-title" style={{ fontFamily: HEADER, color: ink }}>Process</h2>
          <p style={{ fontFamily: BODY, color: bodyInk }}>{content.process}</p>
          <ol className="magazine-steps">
            {content.processSteps.map((step, i) => (
              <li key={step} style={{ fontFamily: BODY, color: bodyInk }}>
                <span style={{ fontFamily: MONO, color: accent }}>{String(i + 1).padStart(2, "0")}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <blockquote id="cs-solution" className="magazine-pullquote" style={{ fontFamily: HEADER, color: ink, borderColor: accent }}>
        <span className="magazine-num" style={{ fontFamily: MONO, color: accent }}>03</span>
        {content.solution}
      </blockquote>

      <div className="magazine-row" id="cs-wireframes">
        <div className="magazine-copy magazine-copy--wide">
          <span className="magazine-num" style={{ fontFamily: MONO, color: accent }}>04</span>
          <h2 className="magazine-title" style={{ fontFamily: HEADER, color: ink }}>Wireframes</h2>
          <p style={{ fontFamily: BODY, color: bodyInk }}>{content.wireframeLofi}</p>
          <CaseStudyWireGrid variant="lofi" ink={ink} accent={accent} />
          <CaseStudyVisual slot="final" caption="Final" ink={ink} accent={accent} hue={hue} />
        </div>
      </div>

      <div className="magazine-impact" id="cs-impact">
        <span className="magazine-num" style={{ fontFamily: MONO, color: accent }}>05</span>
        <h2 className="magazine-title" style={{ fontFamily: HEADER, color: ink }}>Impact</h2>
        <p style={{ fontFamily: BODY, color: bodyInk }}>{content.impact}</p>
        <div className="magazine-stats">
          {content.impactStats.map((stat) => (
            <div key={stat.label} className="magazine-stat" style={{ borderColor: `${ink}10` }}>
              <div style={{ fontFamily: HEADER, color: accent }}>{stat.value}</div>
              <div style={{ fontFamily: BODY, color: bodyInk }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CaseStudyBodyFrame({ content, ink, bodyInk, accent, hue, cloth, skipOverview = false }) {
  return (
    <div className="frame-bento">
      {!skipOverview && (
        <div className="frame-tile frame-tile--visual frame-tile--span2">
          <CaseStudyVisual slot="overview" caption="Overview" ink={ink} accent={accent} hue={hue} priority tall />
        </div>
      )}

      <article id="cs-problem" className="frame-tile frame-tile--problem" style={{ background: `${accent}12`, borderColor: `${ink}10` }}>
        <span className="frame-tile-num" style={{ fontFamily: MONO, color: accent }}>01</span>
        <h2 className="frame-tile-title" style={{ fontFamily: HEADER, color: ink }}>Problem</h2>
        <p className="frame-tile-body" style={{ fontFamily: BODY, color: bodyInk }}>{content.problem}</p>
      </article>

      <article id="cs-process" className="frame-tile frame-tile--process" style={{ background: cloth, borderColor: `${ink}10` }}>
        <span className="frame-tile-num" style={{ fontFamily: MONO, color: accent }}>02</span>
        <h2 className="frame-tile-title" style={{ fontFamily: HEADER, color: ink }}>Process</h2>
        <ul className="frame-tile-list">
          {content.processSteps.map((step, i) => (
            <li key={step} style={{ fontFamily: BODY, color: bodyInk }}>
              <span style={{ fontFamily: MONO, color: accent }}>{String(i + 1).padStart(2, "0")}</span>
              {step}
            </li>
          ))}
        </ul>
      </article>

      <article id="cs-solution" className="frame-tile frame-tile--quote frame-tile--span2" style={{ background: accent, color: cloth }}>
        <span className="frame-tile-num" style={{ fontFamily: MONO, color: cloth }}>03</span>
        <blockquote className="frame-tile-quote" style={{ fontFamily: HEADER, color: cloth }}>
          {content.solution}
        </blockquote>
      </article>

      <div className="frame-tile frame-tile--visual frame-tile--span2">
        <CaseStudyVisual slot="discovery" caption="Discovery" ink={ink} accent={accent} hue={hue} />
      </div>

      <article id="cs-wireframes" className="frame-tile frame-tile--wire frame-tile--span2" style={{ borderColor: `${ink}10` }}>
        <span className="frame-tile-num" style={{ fontFamily: MONO, color: accent }}>04</span>
        <h2 className="frame-tile-title" style={{ fontFamily: HEADER, color: ink }}>Wireframes</h2>
        <CaseStudyWireGrid variant="lofi" ink={ink} accent={accent} />
        <CaseStudyVisual slot="final" caption="Final" ink={ink} accent={accent} hue={hue} />
      </article>

      <article id="cs-impact" className="frame-tile frame-tile--impact frame-tile--span2" style={{ background: `${accent}0A`, borderColor: `${ink}10` }}>
        <span className="frame-tile-num" style={{ fontFamily: MONO, color: accent }}>05</span>
        <h2 className="frame-tile-title" style={{ fontFamily: HEADER, color: ink }}>Impact</h2>
        <p className="frame-tile-body" style={{ fontFamily: BODY, color: bodyInk }}>{content.impact}</p>
        <div className="frame-stat-pills">
          {content.impactStats.map((stat) => (
            <div key={stat.label} className="frame-stat-pill" style={{ background: accent, color: cloth }}>
              <span className="frame-stat-pill-value" style={{ fontFamily: HEADER }}>{stat.value}</span>
              <span className="frame-stat-pill-label" style={{ fontFamily: MONO }}>{stat.label}</span>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
