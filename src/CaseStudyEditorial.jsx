import React from "react";
import { LayoutTabBar } from "./LayoutTabBar";
import { PROJECT_LAYOUTS, CHAPTERS } from "./layoutContent";
import { CaseStudyBodyCard } from "./layoutBodies";
import {
  MotifClothesline,
  MotifSeasonSky,
  MotifSeasonHills,
  MotifFabricPattern,
  MotifGarmentSwatch,
  MotifClothespin,
} from "./sceneMotifs";
import { MONO, HEADER, BODY } from "./editorialUtils";

function ProjectMeta({ meta, ink, accent }) {
  return (
    <dl className="card-meta">
      {[
        { label: "Category", value: meta.category },
        { label: "Date", value: meta.date },
        { label: "Role", value: meta.role },
      ].map((row) => (
        <div key={row.label}>
          <dt style={{ fontFamily: MONO, color: `${ink}55` }}>{row.label}</dt>
          <dd style={{ fontFamily: BODY, color: ink }}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PegChapterNav({ ink, accent }) {
  return (
    <nav className="peg-chapters" aria-label="Sections">
      {CHAPTERS.map((ch) => (
        <a key={ch.id} href={`#cs-${ch.id}`} className="peg-chapter" style={{ fontFamily: MONO, color: ink }}>
          <MotifClothespin accent={accent} />
          <span style={{ color: accent }}>{ch.num}</span> {ch.label}
        </a>
      ))}
    </nav>
  );
}

function CardHeader({ item, meta, projectIndex, ink, accent, cloth, children }) {
  const projectNum = String(projectIndex + 1).padStart(2, "0");
  return (
    <header className="card-study-header">
      <div className="card-study-header-top">
        <span className="card-study-num" style={{ fontFamily: MONO, color: accent }}>{projectNum}</span>
        {children}
      </div>
      <h1 className="card-study-title" style={{ fontFamily: HEADER, color: ink }}>{item.title}</h1>
      <p className="card-study-lead" style={{ fontFamily: BODY, color: `${ink}CC` }}>
        {item.note} — {item.summary}
      </p>
      <ProjectMeta meta={meta} ink={ink} accent={accent} />
    </header>
  );
}

/** Rope at top, peg section markers, garment pinned to the line */
function ProjectLine(props) {
  const { item, ink, accent, meta, projectIndex } = props;
  return (
    <article className="project-layout project-layout--line">
      <MotifClothesline ink={ink} accent={accent} />
      <CardHeader {...props} projectIndex={projectIndex} meta={meta} item={item} ink={ink} accent={accent}>
        <MotifGarmentSwatch hue={item.hue} fabric={item.fabric} accent={accent} ink={ink} />
      </CardHeader>
      <PegChapterNav ink={ink} accent={accent} />
      <CaseStudyBodyCard {...props} pegSections />
    </article>
  );
}

/** Fabric texture wash + garment hue band — like the focus card unfolded */
function ProjectFold(props) {
  const { item, ink, bodyInk, accent, cloth, clothTint, meta, projectIndex } = props;
  return (
    <article className="project-layout project-layout--fold" style={{ background: cloth }}>
      <div className="fold-texture" aria-hidden>
        <MotifFabricPattern fabric={item.fabric} ink={ink} accent={accent} opacity={0.05} />
      </div>
      <div className="fold-hue-band" style={{ background: item.hue, borderColor: `${ink}12` }} aria-hidden />
      <div className="fold-inner">
        <CardHeader {...props} projectIndex={projectIndex} meta={meta} item={item} ink={ink} accent={accent} cloth={cloth}>
          <span className="fold-fabric-label" style={{ fontFamily: MONO, color: `${ink}55` }}>{item.fabric}</span>
        </CardHeader>
        <CaseStudyBodyCard {...props} />
      </div>
    </article>
  );
}

/** Season sky — hero band matches the home page gradient and sun */
function ProjectSky(props) {
  const { item, ink, accent, meta, projectIndex, season } = props;
  const { sky1, sky2, sky3, sun, isNight } = season || {};
  return (
    <article className="project-layout project-layout--sky">
      <div className="scene-sky-hero">
        <MotifSeasonSky
          sky1={sky1}
          sky2={sky2}
          sky3={sky3}
          sun={sun}
          ink={ink}
          showSun={!isNight}
        />
        <div className="scene-sky-hero-copy">
          <span className="card-study-num" style={{ fontFamily: MONO, color: accent }}>{String(projectIndex + 1).padStart(2, "0")}</span>
          <h1 className="card-study-title" style={{ fontFamily: HEADER, color: ink }}>{item.title}</h1>
          <p className="card-study-lead" style={{ fontFamily: BODY, color: `${ink}BB` }}>{item.summary}</p>
        </div>
      </div>
      <div className="scene-sky-body" style={{ background: props.cloth }}>
        <ProjectMeta meta={meta} ink={ink} accent={accent} />
        <CaseStudyBodyCard {...props} />
      </div>
    </article>
  );
}

/** Hills at the foot — same layered silhouettes as the home scene */
function ProjectHills(props) {
  const { item, ink, accent, cloth, meta, projectIndex, season } = props;
  const { sky1, sky2, sky3, sun, hill1, hill2, hill3, isNight } = season || {};
  return (
    <article className="project-layout project-layout--hills">
      <div className="scene-hills-backdrop" aria-hidden>
        <MotifSeasonSky
          sky1={sky1}
          sky2={sky2}
          sky3={sky3}
          sun={sun}
          ink={ink}
          showSun={!isNight}
          className="scene-hills-sky"
        />
      </div>
      <div className="scene-hills-content" style={{ background: cloth }}>
        <CardHeader {...props} projectIndex={projectIndex} meta={meta} item={item} ink={ink} accent={accent} cloth={cloth} />
        <CaseStudyBodyCard {...props} />
      </div>
      <footer className="scene-hills-foot" aria-hidden>
        <MotifSeasonHills hill1={hill1} hill2={hill2} hill3={hill3} />
      </footer>
    </article>
  );
}

const PROJECT_COMPONENTS = {
  line: ProjectLine,
  fold: ProjectFold,
  sky: ProjectSky,
  hills: ProjectHills,
};

export function CaseStudyEditorial(props) {
  const { layoutId, onLayoutChange, ink, accent } = props;
  const resolvedLayoutId = PROJECT_COMPONENTS[layoutId] ? layoutId : "fold";
  const Layout = PROJECT_COMPONENTS[resolvedLayoutId];

  return (
    <div className={`project-page-wrap project-page-wrap--card project-page-wrap--${resolvedLayoutId}`}>
      <LayoutTabBar
        tabs={PROJECT_LAYOUTS}
        activeId={resolvedLayoutId}
        onChange={onLayoutChange}
        ink={ink}
        accent={accent}
        mutedInk={`${ink}55`}
        className="layout-tab-bar--card project-layout-tabs"
      />
      <Layout {...props} />
    </div>
  );
}
