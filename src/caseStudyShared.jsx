import React from "react";
import { CaseStudyLazyImage } from "./CaseStudyLazyImage";
import { getMockupSrc } from "./caseStudyMedia";
import { CHAPTERS } from "./layoutContent";
import { MONO, HEADER, BODY } from "./editorialUtils";

export function CaseStudyVisual({ slot, caption, ink, accent, hue, priority = false, tall = false }) {
  const src = getMockupSrc("plain", slot, hue, ink, accent);
  return (
    <figure className={`cs-visual${tall ? " cs-visual--tall" : ""}`}>
      <div className="cs-visual-frame">
        <CaseStudyLazyImage src={src} alt={caption || "Project visual"} priority={priority} />
      </div>
      {caption && (
        <figcaption className="cs-visual-caption" style={{ fontFamily: MONO, color: `${ink}55` }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export function CaseStudyWireGrid({ variant, ink, accent }) {
  const frames = variant === "lofi" ? 3 : 2;
  return (
    <div className={`cs-wire-grid cs-wire-grid--${variant}`}>
      {[...Array(frames)].map((_, i) => (
        <div key={i} className={`cs-wire-frame cs-wire-frame--${variant}`} style={{ borderColor: `${ink}10` }}>
          <div className="cs-wire-chrome">
            <span style={{ background: variant === "lofi" ? `${ink}14` : accent }} />
            <span style={{ background: `${ink}08` }} />
            <span style={{ background: `${ink}06` }} />
          </div>
          <div className="cs-wire-body">
            <div className="cs-wire-line" style={{ width: "68%", background: `${ink}0c` }} />
            <div className="cs-wire-line" style={{ width: "48%", background: `${ink}08` }} />
            <div className="cs-wire-block" style={{ background: `${ink}05` }} />
            <div className="cs-wire-line" style={{ width: "82%", background: `${ink}08` }} />
          </div>
          <span className="cs-wire-tag" style={{ fontFamily: MONO, color: `${ink}44` }}>
            {variant === "lofi" ? "Lo-fi" : "Hi-fi"} {String(i + 1).padStart(2, "0")}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CaseStudySection({ id, index, title, ink, accent, bodyInk, children, variant = "default" }) {
  return (
    <section id={id} className={`cs-section-pair${variant === "quote" ? " cs-section-pair--quote" : ""}`}>
      <span className="cs-section-index" style={{ fontFamily: MONO, color: accent }}>
        {index}
      </span>
      <div className="cs-section-main">
        <h2 className="cs-section-title" style={{ fontFamily: MONO, color: accent }}>
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

export function CaseStudyBody({ content, item, ink, bodyInk, accent, hue, skipOverview = false }) {
  return (
    <>
      {!skipOverview && (
        <CaseStudyVisual slot="overview" caption="Overview" ink={ink} accent={accent} hue={hue} priority tall />
      )}

      <CaseStudySection id="cs-problem" index="01" title="Problem" ink={ink} accent={accent} bodyInk={bodyInk}>
        <p className="cs-body" style={{ fontFamily: BODY, color: bodyInk }}>{content.problem}</p>
      </CaseStudySection>

      <CaseStudyVisual slot="discovery" caption="Discovery & structure" ink={ink} accent={accent} hue={hue} />

      <CaseStudySection id="cs-process" index="02" title="Process" ink={ink} accent={accent} bodyInk={bodyInk}>
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
      </CaseStudySection>

      <CaseStudySection id="cs-solution" index="03" title="Solution" ink={ink} accent={accent} bodyInk={bodyInk} variant="quote">
        <blockquote className="cs-pullquote-text" style={{ fontFamily: HEADER, color: ink, borderLeftColor: accent }}>
          {content.solution}
        </blockquote>
      </CaseStudySection>

      <CaseStudySection id="cs-wireframes" index="04" title="Wireframes" ink={ink} accent={accent} bodyInk={bodyInk}>
        <p className="cs-body" style={{ fontFamily: BODY, color: bodyInk }}>{content.wireframeLofi}</p>
        <CaseStudyWireGrid variant="lofi" ink={ink} accent={accent} />
        <p className="cs-body cs-body--gap" style={{ fontFamily: BODY, color: bodyInk }}>{content.wireframeHifi}</p>
        <CaseStudyVisual slot="final" caption="Final interface" ink={ink} accent={accent} hue={hue} />
      </CaseStudySection>

      <CaseStudySection id="cs-impact" index="05" title="Impact" ink={ink} accent={accent} bodyInk={bodyInk}>
        <p className="cs-body" style={{ fontFamily: BODY, color: bodyInk }}>{content.impact}</p>
        <div className="cs-metrics">
          {content.impactStats.map((stat) => (
            <div key={stat.label} className="cs-metric" style={{ borderColor: `${ink}08` }}>
              <div className="cs-metric-value" style={{ fontFamily: HEADER, color: accent }}>{stat.value}</div>
              <div className="cs-metric-label" style={{ fontFamily: BODY, color: bodyInk }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </CaseStudySection>
    </>
  );
}

export function ChapterNav({ ink, accent }) {
  return (
    <nav className="cs-chapter-nav" aria-label="Case study sections">
      {CHAPTERS.map((ch) => (
        <a key={ch.id} href={`#cs-${ch.id}`} className="cs-chapter-link" style={{ fontFamily: MONO }}>
          <span className="cs-chapter-num" style={{ color: accent }}>{ch.num}</span>
          <span className="cs-chapter-label" style={{ color: ink }}>{ch.label}</span>
        </a>
      ))}
    </nav>
  );
}
