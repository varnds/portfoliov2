import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import {
  Sun,
  X,
  Leaf,
  Snowflake,
  Flower,
  Moon,
  Box,
} from "lucide-react";
import {
  INTRO_HOLD_MS,
  FOOTER_HEIGHT,
  INTRO_DURATION_MS,
  ROPE_PATH_LENGTH,
  CAMERA_START_Y,
  NAME_TEXT,
  lerp,
  smootherstep,
  clamp,
  computeIntroValues,
  garmentLocal,
  garmentFallOffset,
  garmentRotation,
  middlePieceExtraRot,
  middlePieceSwingY,
  GARMENT_ROT_PIVOT_Y,
  gustRotation,
  gustBillowY,
  pinScale,
  nameCharProgress,
  nameCharOffset,
  basketMotion,
  BASKET_PHASE_START,
  BASKET_CENTER_X,
  BASKET_CENTER_Y,
  BASKET_DUST_COLOR,
  BASKET_DUST_OFFSETS,
  basketDustPuff,
  ropeBezierControl,
  sockRopeBezierControl,
  garmentHangPosition,
  resolveSockEasterEggPosition,
  pinScaleFromLandProgress,
  sockLandingSwingRot,
  sockLandingSwingY,
  sockSettleSwingRot,
  sockSettleSwingY,
  SOCK_INSERT_INDEX,
  basketHasImpacted,
  BASKET_IMPACT_PROGRESS,
  isBasketClick,
  BIRD_FLY_TO_LEFT_MS,
  BIRD_INTRO_FLIGHT_WALL_MS,
  BIRD_PERCH_X,
  BIRD_PERCH_Y,
} from "./introMath";
import { CaseStudyEditorial } from "./CaseStudyEditorial";

const Scene3D = lazy(() => import("./scene3d/Scene3D").then((m) => ({ default: m.Scene3D })));
import { PlayButton } from "./game/PlayButton";
import { RevealCard } from "./game/RevealCard";
import { WelcomeCard, ContextHint } from "./game/PlayHints";
import { AvatarSwitcher } from "./game/AvatarSwitcher";
import { CameraSwitcher } from "./game/CameraSwitcher";

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const DISPLAY = "'Fraunces', serif";
const HEADER = "'Suranna', serif";
const BODY = "'Source Sans 3', sans-serif";

const SEASONS = {
  spring: {
    name: "Spring Awakening",
    icon: Flower,
    sky1: "#EDF9F6",
    sky2: "#E3F5F0",
    sky3: "#CBECE3",
    ink: "#1B2E24",
    accent: "#E11D48",
    cloth: "#F8FCFA",
    clothTint: "#FBF3E4",
    soft: "#4D7C59",
    sun: "#FFFDF6",
    hill1: "#C2DED0",
    hill2: "#A8CDBC",
    hill3: "#8CBBA4",
    description: "Sprouting high-fidelity design prototypes, fresh interaction sprints, and accessible visual systems.",
    tagline: "GARDENING TACTILE INTERFACES & ORGANIC MOTIONS"
  },
  summer: {
    name: "Desert Summer",
    icon: Sun,
    sky1: "#FBE9C8",
    sky2: "#F4D29A",
    sky3: "#EBB87E",
    ink: "#3A2A22",
    accent: "#D65B3E",
    cloth: "#FBF4E6",
    clothTint: "#FFFDF7",
    soft: "#9C8366",
    sun: "#FFF7E4",
    hill1: "#DCAE82",
    hill2: "#C69363",
    hill3: "#A67343",
    description: "High-performance platform scaling, robust technical UX frameworks, and cloud-console developer ecosystems.",
    tagline: "ROBUST INFRASTRUCTURE BAKED IN WARM SUNLIGHT"
  },
  autumn: {
    name: "Golden Autumn",
    icon: Leaf,
    sky1: "#FFEDD5",
    sky2: "#FED7AA",
    sky3: "#F97316",
    ink: "#431407",
    accent: "#EA580C",
    cloth: "#FFF7ED",
    clothTint: "#FFFDF6",
    soft: "#C2410C",
    sun: "#FFedd5",
    hill1: "#FDBA74",
    hill2: "#F97316",
    hill3: "#C2410C",
    description: "Thorough UX research synthesis, rich document architecture, and elegant, harvest-ready design strategies.",
    tagline: "HARVESTING MATURE DATA MODEL INFRASTRUCTURES"
  },
  winter: {
    name: "Solstice Winter",
    icon: Snowflake,
    sky1: "#F1F5F9",
    sky2: "#E2E8F0",
    sky3: "#CBD5E1",
    ink: "#0F172A",
    accent: "#2563EB",
    cloth: "#FFFFFF",
    clothTint: "#F4ECD6",
    soft: "#64748B",
    sun: "#E2E8F0",
    hill1: "#DCE4EE",
    hill2: "#ECF2F8",
    hill3: "#FBFDFF",
    description: "Crisp design execution, razor-sharp alignment grids, and bulletproof user testing metrics.",
    tagline: "SYSTEM ARCHITECTURES SCULPTED IN COOL GLASS"
  },
  night: {
    name: "Midnight Studio",
    icon: Moon,
    sky1: "#1B2247",
    sky2: "#232C57",
    sky3: "#2E3866",
    ink: "#E8ECFF",
    accent: "#FBBF24",
    cloth: "#C9D2F0",
    clothTint: "#EDE6CF",
    soft: "#8A93C4",
    sun: "#F5F3E0",
    hill1: "#2A3360",
    hill2: "#222A52",
    hill3: "#1A2044",
    description: "Quiet late-night craft, deep focus, and ideas that glow brightest after dark.",
    tagline: "DESIGNING IN THE QUIET HOURS"
  }
};

const DESIGN_SYSTEMS_INFO = {
  weave: {
    label: "System Architecture & Flow",
    desc: "Structuring complete user maps, technical API schemas, and robust interactive state systems.",
    care: "Refined through detailed heuristic audits and cross-functional engineering alignment."
  },
  dots: {
    label: "Interactive Prototyping",
    desc: "Crafting delightful micro-interactions, spring-loaded motion behaviors, and fully physics-driven interfaces.",
    care: "Engineered with modern CSS, high-frame-rate JS triggers, and cognitive feedback loops."
  },
  stripe: {
    label: "Ecosystem & Platform Design",
    desc: "Architecting developer dashboards, complex layout blocks, and highly reusable design token models.",
    care: "Built with rigorous accessibility considerations and clear design library rules."
  },
  plain: {
    label: "Visual Interface Craft",
    desc: "Meticulous typesetting, high-contrast visual design, custom grids, and polished layout aesthetics.",
    care: "Validated strictly against WCAG AA guidelines with beautiful modern style guidelines."
  }
};

const INITIAL_PIECES = [
  {
    id: 0,
    title: "PLAYER SAFETY",
    note: "Trust & moderation system design",
    summary: "Designed trust and moderation flows that help players report issues quickly while keeping communities safe and accountable.",
    fabric: "weave",
    hue: "#F6EEDD",
    url: "https://example.com/work/player-safety",
  },
  {
    id: 1,
    title: "ROBLOX MATCHMAKING",
    note: "Grouping & queue mechanics",
    summary: "Reworked grouping and queue mechanics to get players into the right experiences faster, with fairer matches.",
    fabric: "dots",
    hue: "#F7E9D6",
    url: "https://example.com/work/roblox-matchmaking",
  },
  {
    id: 2,
    title: "OPENCLOUD",
    note: "Developer tools & console platform",
    summary: "Shipped developer tools and console patterns that make complex cloud workflows feel clear, fast, and dependable.",
    fabric: "plain",
    hue: "#F4D9C2",
    url: "https://example.com/work/opencloud",
  },
  {
    id: 3,
    title: "SERVICES FOR MATHWORKS",
    note: "Enterprise workspace layouts",
    summary: "Built enterprise workspace layouts balancing dense technical data with a calm, navigable structure.",
    fabric: "stripe",
    hue: "#FBF4E6",
    url: "https://example.com/work/mathworks",
  },
  {
    id: 4,
    title: "ZORRO",
    note: "Confidential design ecosystem",
    summary: "Led a confidential product ecosystem spanning navigation, tokens, and high-fidelity workflows under NDA.",
    fabric: "weave",
    hue: "#FBF4E6",
    url: "https://example.com/work/zorro",
  },
];

const SOCK_PIECE = {
  id: 99,
  isSock: true,
  title: "",
  note: "Thank you for coming.",
  fabric: "plain",
  hue: "#FFFFFF",
};

const SOCK_REVEAL_MS = 760;
const SOCK_SETTLE_MS = 480;
const SEASON_KEYS = ["spring", "summer", "autumn", "winter", "night"];

const CASE_STUDY_BY_ID = {
  0: {
    problem: "Players needed a faster, clearer way to report safety issues without breaking immersion or losing game context. Moderators were juggling fragmented tools that slowed response time and made policy enforcement inconsistent at scale.",
    process: "Partnered with trust & safety, policy, and engineering to map reporting paths end-to-end — from in-experience triggers through escalation, review, and player follow-up.",
    processSteps: [
      "Journey mapping with players and moderators across report types and severity tiers",
      "Flow iteration on inline reporting, evidence capture, and status transparency",
      "High-fidelity prototypes validated with policy partners before phased rollout",
    ],
    solution: "A unified reporting and moderation system with contextual entry points, guided evidence collection, and clearer status for both players and internal teams — aligned to policy without adding friction.",
    impact: "Shipped with trust & safety partners across core experiences. Teams reported faster triage, clearer escalation paths, and stronger alignment between player-facing flows and backend moderation tools.",
    impactStats: [
      { value: "38%", label: "Faster time-to-submit for safety reports" },
      { value: "2.4×", label: "Increase in complete report submissions" },
      { value: "14 wk", label: "From discovery synthesis to phased ship" },
    ],
    wireframeLofi: "Early structure explorations for inline reporting, escalation tiers, and moderator handoff.",
    wireframeHifi: "Polished UI direction for player-facing flows and internal review surfaces.",
  },
  1: {
    problem: "Matchmaking queues felt opaque — players couldn't tell why they were waiting, when grouping would resolve, or whether the system was working fairly across experiences and skill bands.",
    process: "Worked with gameplay and systems design to stress-test queue states, grouping logic, and player mental models under load and edge-case match conditions.",
    processSteps: [
      "Qualitative research on wait-state anxiety and drop-off during matchmaking",
      "IA and state-model iteration for queue progress, party grouping, and re-queue flows",
      "Prototype testing on fairness cues, ETA communication, and error recovery",
    ],
    solution: "Redesigned queue and grouping mechanics with clearer wait states, fairer match signals, and recovery paths that keep players oriented when conditions change mid-queue.",
    impact: "Reduced confusion during peak matchmaking windows and established reusable patterns for wait-state communication across multiple experiences.",
    impactStats: [
      { value: "27%", label: "Reduction in mid-queue drop-off" },
      { value: "1.8×", label: "Improvement in perceived match fairness" },
      { value: "10 wk", label: "Cross-functional iteration to launch" },
    ],
    wireframeLofi: "Queue state explorations, party grouping layouts, and edge-case recovery paths.",
    wireframeHifi: "Final matchmaking UI with progress cues and system-status patterns.",
  },
  2: {
    problem: "Developers managing cloud resources faced dense consoles, scattered workflows, and steep onboarding — complex operations felt brittle and hard to trust at scale.",
    process: "Embedded with platform and developer-experience teams to simplify console navigation, operational density, and the path from first login to confident daily use.",
    processSteps: [
      "Developer interviews and workflow audits across provisioning, monitoring, and ops tasks",
      "Information architecture passes to reduce nested navigation and redundant entry points",
      "Component system build-out with eng for repeatable console patterns",
    ],
    solution: "A clearer console platform with streamlined workflows, shared UI patterns, and onboarding affordances that make heavy cloud operations feel legible and dependable.",
    impact: "Shortened onboarding for new developers and established a pattern library reused across multiple cloud tools.",
    impactStats: [
      { value: "45%", label: "Fewer steps in core provisioning flows" },
      { value: "3×", label: "Faster first-task completion in onboarding tests" },
      { value: "16 wk", label: "Platform patterns documented and shipped" },
    ],
    wireframeLofi: "Console IA studies, task-flow wireframes, and density stress tests.",
    wireframeHifi: "Production-ready developer console screens and shared component specs.",
  },
  3: {
    problem: "Enterprise users needed to scan dense technical datasets quickly without losing spatial context — existing workspace layouts buried navigation and overwhelmed new users.",
    process: "Ran structured usability sessions with technical practitioners to balance data density, hierarchy, and calm visual rhythm across primary workspace tasks.",
    processSteps: [
      "Workflow synthesis across analysis, configuration, and collaboration tasks",
      "Grid and navigation prototypes stress-tested with realistic data volumes",
      "Visual system refinement for scannability, contrast, and long-session comfort",
    ],
    solution: "Enterprise workspace layouts that organize dense information into scannable regions, with navigation tested against real practitioner workflows and accessibility requirements.",
    impact: "Improved task completion in usability studies and delivered a calmer visual system for long-form technical work.",
    impactStats: [
      { value: "32%", label: "Faster scan-to-action in usability tests" },
      { value: "AA", label: "Validated against WCAG contrast targets" },
      { value: "12 wk", label: "From wireframes to validated hi-fi system" },
    ],
    wireframeLofi: "Workspace grid studies and navigation hierarchy explorations.",
    wireframeHifi: "Enterprise UI direction with dense-data layouts and tokenized components.",
  },
  4: {
    problem: "A multi-product suite under NDA needed a coherent navigation model, shared tokens, and high-fidelity workflows — without fragmenting across teams or breaking confidentiality constraints.",
    process: "Led cross-product design alignment under strict confidentiality, establishing shared foundations while preserving team-specific workflow depth.",
    processSteps: [
      "Ecosystem audit across navigation, tokens, and core task flows",
      "Confidential stakeholder reviews on IA, patterns, and phased delivery",
      "High-fidelity workflow specs for primary user journeys under NDA",
    ],
    solution: "A confidential design ecosystem spanning navigation architecture, token systems, and production-ready workflows — structured for multi-product scale while protecting sensitive details.",
    impact: "Aligned multiple product teams on a shared foundation and accelerated high-fidelity delivery for core confidential workflows.",
    impactStats: [
      { value: "5+", label: "Product surfaces aligned to shared system" },
      { value: "1", label: "Unified token + navigation foundation" },
      { value: "NDA", label: "Confidential delivery throughout" },
    ],
    wireframeLofi: "Confidential IA and flow explorations (representative placeholders).",
    wireframeHifi: "High-fidelity workflow direction under NDA (representative placeholders).",
  },
};

const PROJECT_META = {
  0: { category: "Trust & Safety", date: "2021 — 2023", role: "Lead Product Designer" },
  1: { category: "Gameplay Systems", date: "2020 — 2022", role: "Product Designer" },
  2: { category: "Developer Platform", date: "2019 — 2021", role: "Product Designer" },
  3: { category: "Enterprise UX", date: "2020 — 2022", role: "Lead UX Designer" },
  4: { category: "Confidential / NDA", date: "2021 — Present", role: "Design Lead" },
};

function projectMeta(item) {
  return PROJECT_META[item.id] ?? {
    category: item.note,
    date: "Present",
    role: "Product Designer",
  };
}

function caseStudyContent(item) {
  const content = CASE_STUDY_BY_ID[item.id];
  if (content) return content;
  return {
    problem: `${item.summary} The work required balancing user needs, technical constraints, and cross-functional alignment from discovery through ship.`,
    process: `Research synthesis, iterative flows, and high-fidelity prototyping for ${item.note.toLowerCase()} — with regular reviews before launch.`,
    processSteps: [
      "Discovery and stakeholder interviews across primary user journeys",
      "Flow mapping, IA stress tests, and iterative wireframe reviews",
      "Visual system build-out, prototype validation, and phased ship",
    ],
    solution: item.summary,
    impact: "Measured through task completion, qualitative feedback, and adoption after rollout.",
    impactStats: [
      { value: "—", label: "Outcomes tracked post-launch" },
      { value: "3", label: "Cross-functional workstreams" },
      { value: "Ship", label: "End-to-end UX ownership" },
    ],
    wireframeLofi: "Early structure explorations and flow validation.",
    wireframeHifi: "Polished UI direction aligned to the design system.",
  };
}

const PROJECT_VIEW_GROW_MS = 580;
const PROJECT_VIEW_DROP_MS = 620;

function ProjectCaseStudySheetContent({
  item,
  ink,
  bodyInk,
  accent,
  cloth,
  clothTint,
  hue,
  meta,
  projectIndex,
  projects,
  onNav,
  onProjectSelect,
  layoutId,
  onLayoutChange,
  season,
}) {
  const content = caseStudyContent(item);
  return (
    <div className="case-study-sheet-content case-study-sheet-content--card" style={{ "--cs-accent": accent }}>
      <CaseStudyEditorial
        item={item}
        content={content}
        ink={ink}
        bodyInk={bodyInk}
        accent={accent}
        cloth={cloth}
        clothTint={clothTint}
        hue={hue}
        meta={meta}
        projectIndex={projectIndex}
        projects={projects}
        onNav={onNav}
        onProjectSelect={onProjectSelect}
        layoutId={layoutId}
        onLayoutChange={onLayoutChange}
        season={season}
      />
    </div>
  );
}

const ROPE_PIN_MIN = 108;
const ROPE_PIN_MAX = 932;
const GARMENT_SVG_WIDTH = 48;

const FOCUS_MODE = {
  spreadSlot: 14,
  spreadBase: 6,
  stagger: 26,
  transitionMs: 620,
  cardAnchorY: 72,
  cardWidthFactor: 3.7,
  cardWidthMin: 178,
  cardWidthMax: 292,
  clothLighten: 0.14,
};

function clampSpreadOffset(hangX, offset) {
  const pinX = hangX + offset;
  if (pinX < ROPE_PIN_MIN) return ROPE_PIN_MIN - hangX;
  if (pinX > ROPE_PIN_MAX) return ROPE_PIN_MAX - hangX;
  return offset;
}

function garmentFocusOffset(index, selectedIndex, hangXs) {
  if (selectedIndex < 0 || index === selectedIndex) return 0;
  const dist = index - selectedIndex;
  const sign = dist < 0 ? -1 : 1;
  const raw = sign * (Math.abs(dist) * FOCUS_MODE.spreadSlot + FOCUS_MODE.spreadBase);
  return clampSpreadOffset(hangXs[index], raw);
}

function garmentFocusStagger(index, selectedIndex) {
  if (selectedIndex < 0 || index === selectedIndex) return 0;
  return Math.abs(index - selectedIndex) * FOCUS_MODE.stagger;
}

function spreadCloseDuration(pieceCount) {
  return FOCUS_MODE.transitionMs + Math.max(0, pieceCount - 1) * FOCUS_MODE.stagger + 48;
}

function computeFocusCardPos(svg, focusedIndex, pieceCount) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;

  const playground = svg.parentElement;
  if (!playground) return null;
  const bounds = playground.getBoundingClientRect();

  const scale = Math.abs(ctm.a);
  const cardWidth = Math.min(
    FOCUS_MODE.cardWidthMax,
    Math.max(FOCUS_MODE.cardWidthMin, GARMENT_SVG_WIDTH * scale * FOCUS_MODE.cardWidthFactor)
  );

  const { x, y } = garmentHangPosition(focusedIndex, pieceCount);
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y + FOCUS_MODE.cardAnchorY;
  const screen = pt.matrixTransform(ctm);

  return {
    x: screen.x - bounds.left,
    y: screen.y - bounds.top,
    width: cardWidth,
  };
}

// Front-hill surface Y for spring poppies — matches the front hill SVG path
function hillSurfaceY(x) {
  const cx = Math.max(-320, Math.min(1360, x));
  const x0 = -320, y0 = 500, cx1 = 150, cy1 = 470, x1 = 450, y1 = 515;
  if (cx <= x1) {
    const t = (cx - x0) / (x1 - x0);
    const mt = 1 - t;
    return mt * mt * y0 + 2 * mt * t * cy1 + t * t * y1;
  }
  const cx2 = 750, cy2 = 560, x2 = 1360, y2 = 495;
  const t = (cx - x1) / (x2 - x1);
  const mt = 1 - t;
  return mt * mt * y1 + 2 * mt * t * cy2 + t * t * y2;
}

/** Middle hill (hill2) crest — right post sits here, behind the front hill */
function hill2SurfaceY(x) {
  const cx = Math.max(-320, Math.min(1360, x));
  const x0 = -320, y0 = 480, cx1 = 350, cy1 = 430, x1 = 750, y1 = 480;
  if (cx <= x1) {
    const t = (cx - x0) / (x1 - x0);
    const mt = 1 - t;
    return mt * mt * y0 + 2 * mt * t * cy1 + t * t * y1;
  }
  const cx2 = 1150, cy2 = 530, x2 = 1360, y2 = 450;
  const t = (cx - x1) / (x2 - x1);
  const mt = 1 - t;
  return mt * mt * y1 + 2 * mt * t * cy2 + t * t * y2;
}

const RIGHT_POST_X = 970;
const RIGHT_POST_BOTTOM = Math.round(hill2SurfaceY(RIGHT_POST_X));

const SUNFLOWER_HEAD_Y = -48;
const SUNFLOWER_MIN_CLICK = 10;
const SUNFLOWER_MAX_CLICK = 15;
const SUNFLOWER_REPLACE_RADIUS = 20;

function sunflowerPetalLayer(count, length, width, fill, stroke, rotOffset = 0) {
  return Array.from({ length: count }, (_, i) => (
    <ellipse
      key={`${fill}-${i}`}
      cx="0"
      cy={-length * 0.62}
      rx={width}
      ry={length * 0.5}
      fill={fill}
      stroke={stroke}
      strokeWidth="0.28"
      transform={`translate(0, ${SUNFLOWER_HEAD_Y}) rotate(${(360 / count) * i + rotOffset})`}
    />
  ));
}

function SpringSunflowerBloom() {
  const seeds = Array.from({ length: 18 }, (_, i) => {
    const angle = (i * 137.508 * Math.PI) / 180;
    const radius = 0.85 + Math.sqrt(i + 1) * 0.85;
    return {
      cx: Math.cos(angle) * radius,
      cy: SUNFLOWER_HEAD_Y + Math.sin(angle) * radius,
      r: 0.35 + (i % 3) * 0.12,
    };
  });

  return (
    <g className="sunflower-bloom">
      <path
        d="M0 25 Q6 -5 0 -45"
        stroke="#3A6346"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M0 -12 C-8 -10 -12 -5 -13 0 Q-6 -9 0 -12"
        fill="#4A7C59"
        stroke="#3A6346"
        strokeWidth="0.5"
      />
      <path
        d="M0 -24 C8 -22 12 -17 13 -11 Q6 -21 0 -24"
        fill="#5A9468"
        stroke="#3A6346"
        strokeWidth="0.5"
      />

      <g className="sunflower-head">
        {sunflowerPetalLayer(18, 17, 3.2, "#EAB308", "#CA8A04")}
        {sunflowerPetalLayer(14, 14, 2.5, "#FACC15", "#EAB308", 11)}
        {sunflowerPetalLayer(10, 10, 1.9, "#FDE68A", "#FACC15", 7)}

        <circle cx="0" cy={SUNFLOWER_HEAD_Y} r="8.5" fill="#4E342E" />
        <circle cx="0" cy={SUNFLOWER_HEAD_Y} r="7.2" fill="#5D4037" />
        {seeds.map((seed, i) => (
          <circle
            key={`seed-${i}`}
            cx={seed.cx}
            cy={seed.cy}
            r={seed.r}
            fill={i % 2 === 0 ? "#3E2723" : "#2D1B14"}
          />
        ))}
        <circle cx="0" cy={SUNFLOWER_HEAD_Y} r="2.2" fill="#6D4C41" opacity="0.4" />
      </g>
    </g>
  );
}

function poppyHiddenBySunflower(flower, sunflower) {
  if (!sunflower) return false;
  return Math.hypot(flower.x - sunflower.x, flower.y - sunflower.y) < SUNFLOWER_REPLACE_RADIUS;
}

function shouldTriggerSunflower(clickCount) {
  if (clickCount < SUNFLOWER_MIN_CLICK) return false;
  if (clickCount >= SUNFLOWER_MAX_CLICK) return true;
  return Math.random() < 1 / (SUNFLOWER_MAX_CLICK + 1 - clickCount);
}

// Night firefly taps — ground & hill bands only (not sky / clothesline)
function isOnNightGround(svgX, svgY) {
  if (svgY < 418 || svgY > 638) return false;
  if (svgX < -300 || svgX > 1380) return false;
  return true;
}

// Map screen clicks to SVG user space
function clientPointToSvg(svg, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (ctm) {
    const loc = pt.matrixTransform(ctm.inverse());
    return { x: loc.x, y: loc.y };
  }
  const vb = svg.viewBox.baseVal;
  const rect = svg.getBoundingClientRect();
  const scale = Math.min(rect.width / vb.width, rect.height / vb.height);
  const renderedW = vb.width * scale;
  const renderedH = vb.height * scale;
  const offsetX = (rect.width - renderedW) / 2;
  const offsetY = rect.height - renderedH;
  return {
    x: vb.x + (clientX - rect.left - offsetX) / scale,
    y: vb.y + (clientY - rect.top - offsetY) / scale,
  };
}

const PRE_PLANTED_POPPIES = [
  { id: 100, x: -80, y: 438 },
  { id: 101, x: 80,  y: 442 },
  { id: 102, x: 300, y: 432 },
  { id: 103, x: 520, y: 436 },
  { id: 104, x: 737, y: 528 },
  { id: 107, x: 708, y: 526 },
  { id: 105, x: 980, y: 474 },
  { id: 106, x: 1130, y: 471 },

  { id: 200, x: -50, y: 470 },
  { id: 201, x: 150, y: 468 },
  { id: 202, x: 380, y: 458 },
  { id: 203, x: 620, y: 476 },
  { id: 204, x: 850, y: 462 },
  { id: 205, x: 1050, y: 471 },
  { id: 206, x: 1150, y: 466 },

  { id: 300, x: -90, y: 508 },
  { id: 301, x: 60,  y: 502 },
  { id: 302, x: 250, y: 492 },
  { id: 303, x: 470, y: 516 },
  { id: 304, x: 690, y: 508 },
  { id: 305, x: 880, y: 499 },
  { id: 306, x: 1020, y: 506 },
  { id: 307, x: 1140, y: 512 }
];

// Extends the same three-row meadow band into the left/right flanks — y anchored to front-hill surface
const FLANK_POPPIES = [
  { id: 402, x: -240, y: 473 },
  { id: 403, x: -250, y: 477 },
  { id: 405, x: -220, y: 510 },

  { id: 501, x: 1280, y: 484 },
  { id: 503, x: 1300, y: 485 },
  { id: 505, x: 1270, y: 510 },
];

const ALL_SPRING_POPPIES = [...PRE_PLANTED_POPPIES, ...FLANK_POPPIES];
const PRE_PLANTED_POPPY_IDS = new Set(ALL_SPRING_POPPIES.map((f) => f.id));
const MAX_USER_POPPIES = 80;

const FIREFLY_DRIFT = { dxScale: 82, dyMin: 26, dyRange: 38 };

function HillFirefly({ x, y, flightMs, driftX, driftY, wiggle1, wiggle2, blinkDelay, blinkMs }) {
  return (
    <g transform={`translate(${x}, ${y})`} style={{ pointerEvents: "none" }}>
      <g
        className="hill-firefly-flight"
        style={{
          "--dx": driftX,
          "--dy": driftY,
          "--w1": wiggle1,
          "--w2": wiggle2,
          "--flight-ms": `${flightMs}ms`,
        }}
      >
        <g
          className="hill-firefly-glow"
          style={{
            "--blink-delay": `${blinkDelay}s`,
            "--blink-ms": `${blinkMs}ms`,
          }}
        >
          <circle cx="0" cy="0" r="5.5" fill="#FDE047" opacity="0.42" filter="url(#fireflyGlow)" />
          <circle cx="0" cy="0" r="1.8" fill="#FEF08A" opacity="0.95" />
          <circle cx="0" cy="0" r="0.7" fill="#FFFBEB" />
        </g>
      </g>
    </g>
  );
}

function spawnFirefly(x, y, setFireflies) {
  const interactionId = Date.now();
  const flightMs = 4600 + Math.floor(Math.random() * 1800);
  const newFirefly = {
    id: interactionId,
    x,
    y,
    flightMs,
    driftX: (Math.random() - 0.5) * FIREFLY_DRIFT.dxScale,
    driftY: -(FIREFLY_DRIFT.dyMin + Math.random() * FIREFLY_DRIFT.dyRange),
    wiggle1: (Math.random() - 0.5) * 20,
    wiggle2: (Math.random() - 0.5) * 18,
    blinkDelay: Math.random() * 1.4,
    blinkMs: 850 + Math.floor(Math.random() * 450),
  };
  setFireflies((prev) => [...prev, newFirefly]);
  setTimeout(() => {
    setFireflies((prev) => prev.filter((f) => f.id !== interactionId));
  }, flightMs + 120);
}

const NIGHT_STARS = [...Array(34)].map((_, i) => {
  const h1 = Math.abs(Math.sin(i * 12.9898 + 78.233) * 43758.5453) % 1;
  const h2 = Math.abs(Math.sin(i * 39.346 + 11.135) * 43758.5453) % 1;
  const h3 = Math.abs(Math.sin(i * 73.156 + 52.235) * 43758.5453) % 1;
  return {
    sx: -90 + h1 * 1040,
    sy: -55 + h2 * 270,
    r: 0.5 + h3 * 1.8
  };
});

const WINTER_SNOW_DRIFT_X = 200;
const WINTER_SNOW_COUNT = 38;
const WINTER_SNOW_LANE_COUNT = 15;
const WINTER_SNOW_LANE_START = -80;
const WINTER_SNOW_LANE_STEP = 92;

function winterSnowStartX(index) {
  const lane = index % WINTER_SNOW_LANE_COUNT;
  const jitter = ((index * 53 + lane * 19) % 44) - 22;
  return WINTER_SNOW_LANE_START + lane * WINTER_SNOW_LANE_STEP + jitter;
}

function birdSnowOrigin(position) {
  if (position === "right") return { x: 964, y: 111 };
  return { x: 74, y: 111 };
}

function BirdHeadSnowflakeGlyph({ variant }) {
  const stroke = {
    stroke: "#FFFFFF",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: { filter: "drop-shadow(0 0 0.5px rgba(100,116,139,0.4))" },
  };

  switch (variant % 5) {
    case 0:
      return <path d="M-4 0 L4 0 M0 -4 L0 4 M-3 -3 L3 3 M-3 3 L3 -3" {...stroke} strokeWidth="1.5" />;
    case 1:
      return (
        <path
          d="M0 -5 L0 5 M-4.33 -2.5 L4.33 2.5 M-4.33 2.5 L4.33 -2.5 M-1.1 -4.1 L1.1 -2.9 M1.1 4.1 L-1.1 2.9"
          {...stroke}
          strokeWidth="1.25"
        />
      );
    case 2:
      return (
        <path
          d="M0 -5.5 L0 5.5 M-4.76 -2.75 L4.76 2.75 M-4.76 2.75 L4.76 -2.75 M-1.4 -4.2 L1.4 -2.2 M-1.4 4.2 L1.4 2.2"
          {...stroke}
          strokeWidth="1.15"
        />
      );
    case 3:
      return (
        <path
          d="M0 -4.2 L3.64 -2.1 L3.64 2.1 L0 4.2 L-3.64 2.1 L-3.64 -2.1 Z M0 -4.2 L0 4.2 M-3.64 -2.1 L3.64 2.1"
          {...stroke}
          strokeWidth="1.1"
        />
      );
    default:
      return (
        <path
          d="M0 -5 L0 5 M-4.33 -2.5 L4.33 2.5 M-4.33 2.5 L4.33 -2.5 M0 -4 L-1.1 -2.8 M0 -4 L1.1 -2.8 M0 4 L-1.1 2.8 M0 4 L1.1 2.8"
          {...stroke}
          strokeWidth="1.05"
        />
      );
  }
}

const BIRD_HEAD_SNOWFLAKES = [
  { x: 10, y: 2.2, delay: 0, drift: -2, rot: 0, scale: 0.44, variant: 0 },
  { x: 6.8, y: 4.2, delay: 0.65, drift: -3, rot: -18, scale: 0.38, variant: 1 },
  { x: 13.2, y: 3.6, delay: 1.3, drift: 2.5, rot: 14, scale: 0.36, variant: 2 },
  { x: 8.2, y: 3.1, delay: 1.95, drift: -1.5, rot: -8, scale: 0.34, variant: 3 },
  { x: 10, y: 5.5, delay: 2.6, drift: -1, rot: 22, scale: 0.32, variant: 4 },
  { x: 11.8, y: 4.8, delay: 3.25, drift: 2, rot: -12, scale: 0.33, variant: 0 },
  { x: 7.2, y: 2.4, delay: 3.9, drift: -2.5, rot: 10, scale: 0.31, variant: 1 },
  { x: 14, y: 5, delay: 4.55, drift: 1.5, rot: -20, scale: 0.3, variant: 2 },
  { x: 5.6, y: 5.1, delay: 5.2, drift: -2, rot: 16, scale: 0.3, variant: 3 },
];

function BirdHeadSnowflakes() {
  return (
    <g pointerEvents="none" className="bird-head-snowflakes">
      {BIRD_HEAD_SNOWFLAKES.map((f, i) => (
        <g
          key={i}
          className="bird-head-snowflake-land"
          style={{
            "--land-x": `${f.x}px`,
            "--land-y": `${f.y}px`,
            "--land-rot": `${f.rot}deg`,
            "--land-scale": f.scale,
            "--land-drift": `${f.drift}px`,
            animationDelay: `${f.delay}s`,
          }}
        >
          <BirdHeadSnowflakeGlyph variant={f.variant} />
        </g>
      ))}
    </g>
  );
}

export default function App() {
  const svgRef = useRef(null);
  const [pieces, setPieces] = useState(INITIAL_PIECES);
  const [hot, setHot] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [spreadLayoutHeld, setSpreadLayoutHeld] = useState(false);
  const spreadCenterRef = useRef(-1);
  const spreadCloseTimerRef = useRef(null);
  const [windStrength, setWindStrength] = useState(3.0);
  const [currentSeasonKey, setCurrentSeasonKey] = useState("summer");

  const [birdPosition, setBirdPosition] = useState("left");
  const [isBirdFlying, setIsBirdFlying] = useState(false);
  const [birdGone, setBirdGone] = useState(false);
  const [birdChirp, setBirdChirp] = useState(false);
  const [chimeContact, setChimeContact] = useState(false);
  const [shiver, setShiver] = useState(false);
  const [lanternOn, setLanternOn] = useState(false);
  const [lanternIgniting, setLanternIgniting] = useState(false);
  const lanternIgniteTimerRef = useRef(null);
  const [meteor, setMeteor] = useState(null);

  const [bloomedFlowers, setBloomedFlowers] = useState(ALL_SPRING_POPPIES);
  const [springSunflower, setSpringSunflower] = useState(null);
  const springSunflowerRef = useRef(false);
  const springGroundClickCountRef = useRef(0);
  const [rustledLeaves, setRustledLeaves] = useState([]);
  const [snowSplashes, setSnowSplashes] = useState([]);
  const [birdSnowFall, setBirdSnowFall] = useState([]);
  const [birdSnowLandingKey, setBirdSnowLandingKey] = useState(0);
  const [projectViewOpen, setProjectViewOpen] = useState(false);
  const [projectViewClosing, setProjectViewClosing] = useState(false);
  const [projectViewEntered, setProjectViewEntered] = useState(false);
  const [projectViewSettled, setProjectViewSettled] = useState(false);
  const projectViewCloseTimerRef = useRef(null);
  const projectViewSheetRef = useRef(null);
  const projectViewFinishLockRef = useRef(false);
  const focusCardRef = useRef(null);
  const [growCardOrigin, setGrowCardOrigin] = useState(null);
  const studyScrollRef = useRef(null);
  const [fireflies, setFireflies] = useState([]);

  const [projectLayoutId, setProjectLayoutId] = useState("fold");

  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("NEW CASE STUDY");
  const [newType, setNewType] = useState("SHIRT");
  const [newFabric, setNewFabric] = useState("stripe");
  const [newHue, setNewHue] = useState("#EFE6D2");
  const [newNote, setNewNote] = useState("Interactive UI case study");
  const [addError, setAddError] = useState("");
  const [seasonsClicked, setSeasonsClicked] = useState(() => new Set());
  const [scene3D, setScene3D] = useState(false);
  // Manage an immersive cross-fade in/out of the 3D world: keep the canvas
  // mounted through the fade-out, and re-key it on each entry so the intro
  // camera dolly replays.
  const [keepMounted3D, setKeepMounted3D] = useState(false);
  const [enter3D, setEnter3D] = useState(false);
  const [entry3DCount, setEntry3DCount] = useState(0);
  const scene3DRef = useRef(false);
  const [sockAnimProgress, setSockAnimProgress] = useState(0);
  const [sockSettleProgress, setSockSettleProgress] = useState(0);
  const [sockRevealDone, setSockRevealDone] = useState(false);
  const [sockNoteOpen, setSockNoteOpen] = useState(false);
  const sockTriggeredRef = useRef(false);

  const P = SEASONS[currentSeasonKey];
  const portfolioPieces = useMemo(() => pieces.filter((p) => !p.isSock), [pieces]);
  const sockOnLine = pieces.some((p) => p.isSock);
  const sockAnimating = sockOnLine && !sockRevealDone;
  const sockSettling = sockAnimating && sockAnimProgress >= 1;
  const isWinter = currentSeasonKey === "winter";
  const isNight = currentSeasonKey === "night";
  const sel = pieces.find((p) => p.id === hot) || pieces.find((p) => p.id === selectedId);

  const birdStartleRef = useRef(() => {});
  const recallBirdRef = useRef(() => {});
  const birdGoneRef = useRef(false);
  const introCompleteRef = useRef(false);
  const introBirdLaunchRef = useRef(null);
  const groundTapLockRef = useRef(0);
  const [viewportWidth, setViewportWidth] = useState(
    () => (typeof window !== "undefined" ? window.innerWidth : 1200)
  );

  const reducedMotion = typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [introProgress, setIntroProgress] = useState(reducedMotion ? 1 : 0);
  const [introComplete, setIntroComplete] = useState(reducedMotion);
  const [introPlayId, setIntroPlayId] = useState(0);
  const introActive = !introComplete;
  introCompleteRef.current = introComplete;
  scene3DRef.current = scene3D;

  useEffect(() => {
    if (introComplete) void import("./scene3d/Scene3D");
  }, [introComplete]);

  useEffect(() => {
    if (scene3D) {
      setKeepMounted3D(true);
      setEntry3DCount((c) => c + 1);
      setEnter3D(false);
      return undefined;
    }
    setEnter3D(false);
    const t = setTimeout(() => setKeepMounted3D(false), 850);
    return () => clearTimeout(t);
  }, [scene3D]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (introComplete) return;
    let raf = 0;
    let cancelled = false;
    let lastPublished = -1;
    const t0 = performance.now();

    const publish = (p, force = false) => {
      if (!force && Math.abs(p - lastPublished) < 0.0008) return;
      lastPublished = p;
      setIntroProgress(p);
    };

    const tick = (now) => {
      if (cancelled) return;
      const elapsed = now - t0;
      if (elapsed < INTRO_HOLD_MS) {
        publish(0);
      } else {
        const raw = clamp((elapsed - INTRO_HOLD_MS) / INTRO_DURATION_MS, 0, 1);
        const p = smootherstep(raw);
        if (basketHasImpacted(p) && !introBirdLaunchRef.current) {
          introBirdLaunchRef.current = now;
        }
        publish(p, basketHasImpacted(p) && lastPublished < BASKET_IMPACT_PROGRESS);
        if (raw >= 1) {
          publish(1, true);
          const birdDone = !introBirdLaunchRef.current
            || (now - introBirdLaunchRef.current >= BIRD_INTRO_FLIGHT_WALL_MS);
          if (birdDone) {
            setIntroComplete(true);
            return;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [introComplete, introPlayId]);

  useEffect(() => {
    if (lanternIgniteTimerRef.current) {
      clearTimeout(lanternIgniteTimerRef.current);
      lanternIgniteTimerRef.current = null;
    }
    if (!lanternOn) {
      setLanternIgniting(false);
      return;
    }
    setLanternIgniting(true);
    lanternIgniteTimerRef.current = setTimeout(() => {
      setLanternIgniting(false);
      lanternIgniteTimerRef.current = null;
    }, 180);
    return () => {
      if (lanternIgniteTimerRef.current) {
        clearTimeout(lanternIgniteTimerRef.current);
        lanternIgniteTimerRef.current = null;
      }
    };
  }, [lanternOn]);

  // Narrower viewBox on smaller screens keeps the clothesline from shrinking too much
  const sceneViewBox = (() => {
    if (viewportWidth < 480) return "-60 -70 1080 700";
    if (viewportWidth < 768) return "-140 -70 1280 700";
    if (viewportWidth < 1200) return "-220 -70 1480 700";
    return "-310 -70 1660 700";
  })();

  const [sceneMinX, sceneMinY, sceneWidth, sceneHeight] = sceneViewBox.split(/\s+/).map(Number);
  const sceneMaxX = sceneMinX + sceneWidth;
  const poppyInset = 12; // petal radius — keep blooms fully inside the visible viewBox

  const intro = computeIntroValues(introProgress, pieces.length);
  const cameraT = introComplete ? 1 : intro.cameraT;
  const activeViewBox = `${sceneMinX} ${lerp(CAMERA_START_Y, sceneMinY, cameraT)} ${sceneWidth} ${sceneHeight}`;
  const footerProgress = introComplete ? 1 : intro.footerOpacity;
  const settleBlend = introComplete ? 1 : clamp((introProgress - 0.96) / 0.04, 0, 1);
  const hangPositions = useMemo(
    () => pieces.map((_, i) => garmentHangPosition(i, pieces.length)),
    [pieces]
  );
  const hangXs = useMemo(() => hangPositions.map((h) => h.x), [hangPositions]);
  const focusedIndex = selectedId !== null ? pieces.findIndex((p) => p.id === selectedId) : -1;
  const projectFocusActive = introComplete && focusedIndex >= 0;

  if (focusedIndex >= 0) {
    spreadCenterRef.current = focusedIndex;
  }
  const spreadCenterIndex = spreadCenterRef.current;
  const spreadLayoutActive = projectFocusActive || (spreadLayoutHeld && spreadCenterIndex >= 0);
  const spreadClosing = spreadLayoutActive && !projectFocusActive;

  useEffect(() => {
    if (focusedIndex >= 0) {
      if (spreadCloseTimerRef.current) {
        clearTimeout(spreadCloseTimerRef.current);
        spreadCloseTimerRef.current = null;
      }
      setSpreadLayoutHeld(true);
      return undefined;
    }

    if (spreadCenterRef.current < 0) {
      setSpreadLayoutHeld(false);
      return undefined;
    }

    setSpreadLayoutHeld(true);
    spreadCloseTimerRef.current = setTimeout(() => {
      spreadCenterRef.current = -1;
      setSpreadLayoutHeld(false);
      spreadCloseTimerRef.current = null;
    }, spreadCloseDuration(pieces.length));

    return () => {
      if (spreadCloseTimerRef.current) {
        clearTimeout(spreadCloseTimerRef.current);
        spreadCloseTimerRef.current = null;
      }
    };
  }, [focusedIndex, pieces.length]);

  const focusCardPos = useMemo(() => {
    if (!projectFocusActive || !svgRef.current || focusedIndex < 0) return null;
    return computeFocusCardPos(svgRef.current, focusedIndex, pieces.length);
  }, [projectFocusActive, focusedIndex, pieces.length, activeViewBox, viewportWidth]);
  const sockHangXForRope = (() => {
    if (!sockAnimating) {
      return hangXs[SOCK_INSERT_INDEX] ?? garmentHangPosition(SOCK_INSERT_INDEX, pieces.length).x;
    }
    const sockIdx = pieces.findIndex((p) => p.isSock);
    if (sockIdx < 0) return hangXs[SOCK_INSERT_INDEX] ?? 520;
    return resolveSockEasterEggPosition(sockIdx, pieces[sockIdx], sockAnimProgress).x;
  })();
  const ropeCtrl = (() => {
    if (!introComplete) {
      return ropeBezierControl(introProgress, pieces.length, hangXs, intro.ropeDraw >= 0.98);
    }
    if (sockAnimating) {
      return sockRopeBezierControl(sockAnimProgress, sockHangXForRope);
    }
    return { cx: 520, cy: 196 };
  })();
  const ropeControlY = introComplete
    ? ropeCtrl.cy
    : lerp(ropeCtrl.cy, 196, settleBlend);
  const ropeControlX = introComplete
    ? ropeCtrl.cx
    : lerp(ropeCtrl.cx, 520, settleBlend);
  const ropeSwayActive = introComplete && (!sockAnimating || sockSettling);
  const basketAnim = basketMotion(intro.basket);
  const showBasket = introComplete || introProgress >= BASKET_PHASE_START;
  const basketOpacity = introComplete || introProgress >= BASKET_PHASE_START ? 1 : 0;
  const nameChars = NAME_TEXT.split("");
  const introBirdFlying = !introComplete && basketHasImpacted(introProgress);
  const introBirdOpacity = introComplete ? 1 : (introBirdFlying ? 1 : 0);
  const showBirdSnowCap =
    isWinter
    && introComplete
    && !birdGone
    && !isBirdFlying
    && (birdPosition === "left" || birdPosition === "right");
  const prevShowBirdSnowRef = useRef(false);

  useEffect(() => {
    if (projectViewCloseTimerRef.current) {
      clearTimeout(projectViewCloseTimerRef.current);
      projectViewCloseTimerRef.current = null;
    }
    setProjectViewOpen(false);
    setProjectViewClosing(false);
    setProjectViewEntered(false);
    setGrowCardOrigin(null);
  }, [selectedId]);

  useEffect(() => {
    if (!projectViewOpen || projectViewClosing) return undefined;
    setProjectViewEntered(false);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setProjectViewEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [projectViewOpen, projectViewClosing]);

  useEffect(() => {
    if (!projectViewEntered) {
      setProjectViewSettled(false);
      return undefined;
    }
    const timer = setTimeout(() => setProjectViewSettled(true), PROJECT_VIEW_GROW_MS);
    return () => clearTimeout(timer);
  }, [projectViewEntered]);

  const triggerSockReveal = () => {
    if (sockTriggeredRef.current) return;
    sockTriggeredRef.current = true;
    setPieces((prev) => {
      if (prev.some((p) => p.isSock)) return prev;
      const next = [...prev];
      next.splice(2, 0, SOCK_PIECE);
      return next;
    });
    setSockAnimProgress(0);
    setSockSettleProgress(0);
    setSockRevealDone(false);
    setSockNoteOpen(false);
  };

  const handleSeasonSelect = (key) => {
    setCurrentSeasonKey(key);
    if (key !== "night") setLanternOn(false);
    if (key === "night") {
      setBirdGone(true);
    } else {
      setBirdGone(false);
      triggerBirdStartle();
    }
    if (key === "winter") {
      setShiver(true);
      setTimeout(() => setShiver(false), 470);
    }
    setSeasonsClicked((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (seasonsClicked.size < SEASON_KEYS.length || sockTriggeredRef.current) return;
    triggerSockReveal();
  }, [seasonsClicked]);

  useEffect(() => {
    if (!sockOnLine || sockRevealDone) return undefined;
    let cancelled = false;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now) => {
      if (cancelled) return;
      const elapsed = now - t0;
      if (elapsed < SOCK_REVEAL_MS) {
        setSockAnimProgress(elapsed / SOCK_REVEAL_MS);
        setSockSettleProgress(0);
        raf = requestAnimationFrame(tick);
      } else if (elapsed < SOCK_REVEAL_MS + SOCK_SETTLE_MS) {
        setSockAnimProgress(1);
        setSockSettleProgress((elapsed - SOCK_REVEAL_MS) / SOCK_SETTLE_MS);
        raf = requestAnimationFrame(tick);
      } else {
        setSockAnimProgress(1);
        setSockSettleProgress(1);
        setSockRevealDone(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [sockOnLine, sockRevealDone]);

  useEffect(() => {
    if (!sockNoteOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setSockNoteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sockNoteOpen]);

  useEffect(() => {
    const viewActive = projectViewOpen || projectViewClosing;
    if (!viewActive) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      closeProjectView();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectViewOpen, projectViewClosing]);

  useEffect(() => () => {
    if (projectViewCloseTimerRef.current) {
      clearTimeout(projectViewCloseTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (showBirdSnowCap && !prevShowBirdSnowRef.current) {
      setBirdSnowLandingKey((k) => k + 1);
    }
    prevShowBirdSnowRef.current = showBirdSnowCap;
  }, [showBirdSnowCap]);

  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Suranna&family=Source+Sans+3:wght@400;500;600;700&display=swap";
    document.head.appendChild(l);

    const recurringFlight = setInterval(() => {
      if (!introCompleteRef.current) return;
      if (birdGoneRef.current) {
        recallBirdRef.current();
      } else {
        birdStartleRef.current();
      }
    }, 9000);

    return () => {
      document.head.removeChild(l);
      clearInterval(recurringFlight);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shooting stars only in the night theme
  useEffect(() => {
    if (currentSeasonKey !== "night") {
      setMeteor(null);
      return;
    }

    let timer;
    const launch = () => {
      const startX = 100 + Math.random() * 700;
      const startY = 20 + Math.random() * 180;
      const len = 120 + Math.random() * 120;
      const dropX = 180 + Math.random() * 160;
      const dropY = 120 + Math.random() * 120;
      setMeteor({ id: Date.now(), startX, startY, len, dropX, dropY });
      setTimeout(() => setMeteor(null), 1400);
      timer = setTimeout(launch, 6000 + Math.random() * 9000);
    };
    timer = setTimeout(launch, 3000 + Math.random() * 4000);
    return () => clearTimeout(timer);
  }, [currentSeasonKey]);

  useEffect(() => {
    if (currentSeasonKey !== "night") {
      setFireflies([]);
    }
    if (currentSeasonKey !== "winter") {
      setBirdSnowFall([]);
    }
  }, [currentSeasonKey]);

  const spawnBirdSnowFall = (position) => {
    if (position !== "left" && position !== "right") return;
    const origin = birdSnowOrigin(position);
    const flakes = Array.from({ length: 12 }).map((_, idx) => ({
      id: `bird-snow-${Date.now()}-${idx}`,
      x: origin.x + (Math.random() * 12 - 6),
      y: origin.y + (Math.random() * 5 - 2),
      vx: (Math.random() * 24 - 12) + (position === "right" ? -8 : 6),
      vy: 40 + Math.random() * 35,
      r: 2.4 + Math.random() * 2.2,
    }));
    setBirdSnowFall((prev) => [...prev, ...flakes]);
    setTimeout(() => {
      setBirdSnowFall((prev) => prev.filter((f) => !flakes.some((sf) => sf.id === f.id)));
    }, 1300);
  };

  const finishProjectViewClose = () => {
    if (projectViewFinishLockRef.current) return;
    projectViewFinishLockRef.current = true;
    if (projectViewCloseTimerRef.current) {
      clearTimeout(projectViewCloseTimerRef.current);
      projectViewCloseTimerRef.current = null;
    }
    setProjectViewOpen(false);
    setProjectViewClosing(false);
    setProjectViewEntered(false);
    setGrowCardOrigin(null);
    window.setTimeout(() => {
      projectViewFinishLockRef.current = false;
    }, 0);
  };

  const closeProjectView = () => {
    if (!projectViewOpen || projectViewClosing) return;
    setProjectViewClosing(true);
    projectViewCloseTimerRef.current = window.setTimeout(
      finishProjectViewClose,
      PROJECT_VIEW_DROP_MS + 80,
    );
  };

  const handleEditorialNav = (dest) => {
    if (dest === "work") {
      closeProjectView();
      setSelectedId(null);
      setHot(null);
      return;
    }
    if (dest === "contact") {
      closeProjectView();
      setSelectedId(null);
      setHot(null);
      window.location.href = "mailto:hello@varnadas.com";
    }
  };

  const handleEditorialProjectSelect = (index) => {
    const piece = portfolioPieces[index];
    if (!piece) return;
    const wasOpen = projectViewOpen;
    setSelectedId(piece.id);
    setHot(piece.id);
    if (wasOpen) closeProjectView();
    window.setTimeout(() => {
      handleViewProject();
    }, wasOpen ? PROJECT_VIEW_DROP_MS + 120 : 680);
  };

  const handleProjectViewSheetTransitionEnd = (e) => {
    if (!projectViewClosing || e.target !== projectViewSheetRef.current) return;
    if (e.propertyName !== "transform") return;
    finishProjectViewClose();
  };

  const captureGrowCardOrigin = () => {
    if (focusCardRef.current) {
      const r = focusCardRef.current.getBoundingClientRect();
      setGrowCardOrigin({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      });
      return;
    }
    if (focusCardPos && svgRef.current?.parentElement) {
      const bounds = svgRef.current.parentElement.getBoundingClientRect();
      setGrowCardOrigin({
        top: bounds.top + focusCardPos.y - 8,
        left: bounds.left + focusCardPos.x - (focusCardPos.width / 2),
        width: focusCardPos.width,
        height: 118,
      });
    }
  };

  const handleViewProject = () => {
    projectViewFinishLockRef.current = false;
    if (projectViewCloseTimerRef.current) {
      clearTimeout(projectViewCloseTimerRef.current);
      projectViewCloseTimerRef.current = null;
    }
    captureGrowCardOrigin();
    setProjectViewClosing(false);
    setProjectViewEntered(false);
    if (studyScrollRef.current) studyScrollRef.current.scrollTop = 0;
    setProjectViewOpen(true);
  };

  const resetToDefault = () => {
    setPieces(INITIAL_PIECES);
    setSeasonsClicked(new Set());
    sockTriggeredRef.current = false;
    setSockAnimProgress(0);
    setSockSettleProgress(0);
    setSockRevealDone(false);
    setSockNoteOpen(false);
    setWindStrength(3.0);
    setCurrentSeasonKey("summer");
    setSelectedId(null);
    setHot(null);
    setAddError("");
    setBirdPosition("left");
    setIsBirdFlying(false);
    setBirdGone(false);
    setBloomedFlowers(ALL_SPRING_POPPIES);
    springSunflowerRef.current = false;
    springGroundClickCountRef.current = 0;
    setSpringSunflower(null);
    setRustledLeaves([]);
    setSnowSplashes([]);
    setBirdSnowFall([]);
    if (projectViewCloseTimerRef.current) {
      clearTimeout(projectViewCloseTimerRef.current);
      projectViewCloseTimerRef.current = null;
    }
    setProjectViewOpen(false);
    setProjectViewClosing(false);
    setProjectViewEntered(false);
    setGrowCardOrigin(null);
    setFireflies([]);
  };

  const triggerBirdStartle = () => {
    if (!introCompleteRef.current || isBirdFlying || birdGone || birdPosition.startsWith("flying")) return;

    const startPos = birdPosition;
    if (isWinter && (startPos === "left" || startPos === "right")) {
      spawnBirdSnowFall(startPos);
    }

    setIsBirdFlying(true);
    setBirdChirp(true);
    setTimeout(() => setBirdChirp(false), 1500);

    const nextPos = startPos === "left" ? "right" : "left";
    const flightDirection = startPos === "left" ? "flying-to-right" : "flying-to-left";

    setBirdPosition(flightDirection);

    setTimeout(() => {
      setBirdPosition(nextPos);
      setIsBirdFlying(false);
    }, 1800);
  };

  birdStartleRef.current = triggerBirdStartle;

  const shooBird = () => {
    if (birdGone || birdPosition.startsWith("flying")) return;
    playChirpSound();
    setBirdChirp(true);
    setTimeout(() => setBirdChirp(false), 1200);
    const startPos = birdPosition;
    if (isWinter && (startPos === "left" || startPos === "right")) {
      spawnBirdSnowFall(startPos);
    }
    const flightDirection = startPos === "left" ? "flying-away-right" : "flying-away-left";
    setIsBirdFlying(true);
    setBirdPosition(flightDirection);
    setTimeout(() => {
      setBirdGone(true);
      setIsBirdFlying(false);
      setBirdPosition("left");
    }, 1000);
  };

  const recallBird = () => {
    if (!birdGone || isBirdFlying || isNight) return;
    setBirdGone(false);
    setBirdPosition("flying-to-left");
    setIsBirdFlying(true);
    setTimeout(() => {
      setBirdPosition("left");
      setIsBirdFlying(false);
    }, 1800);
  };

  birdGoneRef.current = birdGone;
  recallBirdRef.current = recallBird;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "o" || e.key === "O") {
        recallBirdRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const audioCtxRef = useRef(null);
  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  // Windchime: warm metallic bell tones with inharmonic partials and long shimmer
  const playChimeSound = () => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const master = ctx.createGain();
    master.gain.value = 0.4;
    master.connect(ctx.destination);
    const pitches = [1046.5, 1244.5, 1567.98, 1864.66, 2093];
    const order = pitches
      .map((p) => ({ p, r: Math.random() }))
      .sort((a, b) => a.r - b.r)
      .slice(0, 4)
      .map((o) => o.p);
    order.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.2 + Math.random() * 0.04;
      const partials = [
        { mult: 1, gain: 0.14, decay: 3.4 },
        { mult: 2.76, gain: 0.05, decay: 2.2 },
        { mult: 5.4, gain: 0.025, decay: 1.2 }
      ];
      partials.forEach((pt) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq * pt.mult;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(pt.gain, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0006, t + pt.decay);
        osc.connect(g).connect(master);
        osc.start(t);
        osc.stop(t + pt.decay + 0.1);
      });
    });
  };

  const playLampSound = (turningOn) => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const master = ctx.createGain();
    const panner = ctx.createStereoPanner();
    master.gain.value = 0.26;
    panner.pan.value = 0.22;
    master.connect(panner);
    panner.connect(ctx.destination);

    const neonHum = (startT, stopT) => {
      const buzz = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const whine = ctx.createOscillator();
      const bpf = ctx.createBiquadFilter();
      const whineGain = ctx.createGain();
      const g = ctx.createGain();
      buzz.type = "triangle";
      overtone.type = "sine";
      whine.type = "sine";
      buzz.frequency.value = 120;
      overtone.frequency.value = 180;
      whine.frequency.value = 3400;
      bpf.type = "bandpass";
      bpf.frequency.value = 420;
      bpf.Q.value = 0.85;
      buzz.connect(bpf);
      overtone.connect(bpf);
      bpf.connect(g);
      whineGain.gain.value = 0.055;
      whine.connect(whineGain).connect(g);
      g.connect(master);
      buzz.start(startT);
      overtone.start(startT);
      whine.start(startT);
      buzz.stop(stopT);
      overtone.stop(stopT);
      whine.stop(stopT);
      return g;
    };

    const neonStrike = (startT, fromHz, toHz, peak, duration) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(fromHz, startT);
      osc.frequency.exponentialRampToValueAtTime(toHz, startT + duration * 0.75);
      osc.frequency.linearRampToValueAtTime(toHz * 0.92, startT + duration);
      g.gain.setValueAtTime(0, startT);
      g.gain.linearRampToValueAtTime(peak, startT + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, startT + duration);
      osc.connect(g).connect(master);
      osc.start(startT);
      osc.stop(startT + duration + 0.03);
    };

    const neonCrackle = (startT, vol) => {
      const len = Math.floor(ctx.sampleRate * 0.016);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bpf = ctx.createBiquadFilter();
      bpf.type = "bandpass";
      bpf.frequency.value = 1800 + Math.random() * 600;
      bpf.Q.value = 2.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, startT);
      g.gain.linearRampToValueAtTime(vol, startT + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0001, startT + 0.014);
      src.connect(bpf).connect(g).connect(master);
      src.start(startT);
      src.stop(startT + 0.02);
    };

    const flickerPattern = (gainNode, startT, peaks, tailStart) => {
      gainNode.gain.setValueAtTime(0, startT);
      peaks.forEach(({ at, level }) => gainNode.gain.setValueAtTime(level, startT + at));
      gainNode.gain.setValueAtTime(peaks[peaks.length - 1].level, startT + tailStart);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startT + tailStart + 0.22);
    };

    if (turningOn) {
      neonStrike(t, 320, 2900, 0.045, 0.2);
      const humGain = neonHum(t, t + 0.42);
      flickerPattern(humGain, t, [
        { at: 0.01, level: 0.11 },
        { at: 0.03, level: 0.02 },
        { at: 0.05, level: 0.13 },
        { at: 0.07, level: 0.025 },
        { at: 0.09, level: 0.12 },
        { at: 0.11, level: 0.03 },
        { at: 0.13, level: 0.14 },
        { at: 0.16, level: 0.08 },
        { at: 0.18, level: 0.15 },
      ], 0.18);
      [0.01, 0.05, 0.09, 0.13].forEach((at) => neonCrackle(t + at, 0.012 + Math.random() * 0.006));
    } else {
      neonStrike(t, 2600, 380, 0.03, 0.16);
      const humGain = neonHum(t, t + 0.28);
      flickerPattern(humGain, t, [
        { at: 0, level: 0.14 },
        { at: 0.03, level: 0.04 },
        { at: 0.06, level: 0.09 },
        { at: 0.09, level: 0.02 },
        { at: 0.12, level: 0.05 },
      ], 0.12);
      [0.03, 0.09].forEach((at) => neonCrackle(t + at, 0.008));
    }
  };

  // Bird chirp: a quick, bright, surprising burst of tight rising blips
  const playChirpSound = () => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const master = ctx.createGain();
    master.gain.value = 1.0;
    master.connect(ctx.destination);
    const blips = [0, 0.06, 0.115, 0.16];
    blips.forEach((offset, i) => {
      const t = ctx.currentTime + offset;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      const base = 2600 + i * 180;
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.exponentialRampToValueAtTime(base * 1.7, t + 0.025);
      osc.frequency.exponentialRampToValueAtTime(base * 1.15, t + 0.06);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.28, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0006, t + 0.08);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + 0.1);
    });
  };

  const skipIntro = () => {
    setIntroProgress(1);
    setIntroComplete(true);
    introBirdLaunchRef.current = null;
    setBirdPosition("left");
    setIsBirdFlying(false);
    setBirdGone(false);
  };

  const replayIntro = () => {
    setIntroProgress(0);
    setIntroComplete(false);
    setIntroPlayId((n) => n + 1);
    introBirdLaunchRef.current = null;
    setBirdPosition("left");
    setIsBirdFlying(false);
    setBirdGone(false);
    setBirdChirp(false);
    playChimeSound();
  };

  const handleAddPiece = (e) => {
    e.preventDefault();
    if (pieces.length >= 8) {
      setAddError("The clothesline is full! Remove an existing case study to hang a new concept.");
      return;
    }
    const newId = Date.now();
    const finalTitle = newTitle.toUpperCase().trim() || "NEW PROJECT";
    const finalNote = newNote.trim() || "UX conceptual sprint";

    setPieces([...pieces, {
      id: newId,
      title: finalTitle,
      note: finalNote,
      fabric: newFabric,
      hue: newHue
    }]);
    setIsAdding(false);
    setSelectedId(newId);
    setAddError("");
    triggerBirdStartle();
  };

  const removePiece = (id) => {
    setPieces(pieces.filter(p => p.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (hot === id) setHot(null);
    setAddError("");
    triggerBirdStartle();
  };

  const triggerGustOfWind = () => {
    const prev = windStrength;
    setWindStrength(7.0);
    triggerBirdStartle();
    setChimeContact(true);
    setTimeout(() => setChimeContact(false), 2800);
    setTimeout(() => {
      setWindStrength(prev);
    }, 2800);
  };

  const handleNightHillPointer = (e) => {
    if (!svgRef.current || currentSeasonKey !== "night" || !introComplete) return;
    e.stopPropagation();
    const now = Date.now();
    if (now - groundTapLockRef.current < 350) return;
    groundTapLockRef.current = now;

    const { x, y } = clientPointToSvg(svgRef.current, e.clientX, e.clientY);
    if (!isOnNightGround(x, y)) return;

    if (selectedId !== null) {
      setSelectedId(null);
      setHot(null);
    }
    spawnFirefly(x, y, setFireflies);
  };

  const handleBasketClick = (e) => {
    if (!introComplete) return;
    e.stopPropagation();
  };

  const handleGroundInteraction = (e) => {
    if (!svgRef.current) return;
    const now = Date.now();
    if (now - groundTapLockRef.current < 350) return;
    groundTapLockRef.current = now;

    const svg = svgRef.current;
    const { x, y } = clientPointToSvg(svg, e.clientX, e.clientY);

    if (selectedId !== null) {
      setSelectedId(null);
      setHot(null);
      return;
    }

    if (y > 380) {
      if (showBasket && isBasketClick(x, y)) return;

      const interactionId = Date.now();

      if (currentSeasonKey === "spring") {
        const flowerX = Math.max(-280, Math.min(1320, x));
        const surfaceY = hillSurfaceY(flowerX);
        if (y < surfaceY - 40 || y > 638) return;
        const flowerY = y - (6 + Math.random() * 4);
        let triggersSunflower = false;

        if (!springSunflowerRef.current) {
          springGroundClickCountRef.current += 1;
          triggersSunflower = shouldTriggerSunflower(springGroundClickCountRef.current);
        }

        if (triggersSunflower) {
          springSunflowerRef.current = true;
          setSpringSunflower({ id: interactionId, x: flowerX, y: flowerY });
        } else {
          const newFlower = { id: interactionId, x: flowerX, y: flowerY };
          setBloomedFlowers((prev) => {
            let list = [...prev, newFlower];
            while (list.filter((f) => !PRE_PLANTED_POPPY_IDS.has(f.id)).length > MAX_USER_POPPIES) {
              const oldestUserIdx = list.findIndex((f) => !PRE_PLANTED_POPPY_IDS.has(f.id));
              if (oldestUserIdx === -1) break;
              list = [...list.slice(0, oldestUserIdx), ...list.slice(oldestUserIdx + 1)];
            }
            return list;
          });
        }
      } else if (currentSeasonKey === "autumn") {
        const rustled = Array.from({ length: 4 }).map((_, idx) => ({
          id: `${interactionId}-${idx}`,
          x: x + (Math.random() * 30 - 15),
          y: y - (Math.random() * 10),
          dx: Math.random() * 100 - 50,
          dy: -100 - Math.random() * 100,
          angle: Math.random() * 360
        }));
        setRustledLeaves(prev => [...prev, ...rustled]);
        setTimeout(() => {
          setRustledLeaves(prev => prev.filter(l => !rustled.includes(l)));
        }, 2200);
      } else if (currentSeasonKey === "winter") {
        const splashes = Array.from({ length: 6 }).map((_, idx) => ({
          id: `${interactionId}-${idx}`,
          x,
          y,
          vx: Math.random() * 4 - 2,
          vy: -3 - Math.random() * 4
        }));
        setSnowSplashes(prev => [...prev, ...splashes]);
        setTimeout(() => {
          setSnowSplashes(prev => prev.filter(s => !splashes.includes(s)));
        }, 1500);
      }
    }
  };

  const nav = ["WORK", "CREATIVE WORK", "CONTACT"];

  const nightFooterLit = isNight && lanternOn;
  const nightFooterDim = isNight && !lanternOn;
  const titleLit = isNight && lanternOn;
  const titleColor = titleLit ? "#FFF4D6" : P.ink;
  const titleSubColor = titleLit ? "#F0E0B8" : P.ink;
  const titleDescColor = titleLit ? "#E8D4A8" : P.ink;
  const footerBg = isNight ? (lanternOn ? "#F5F0E6" : P.ink) : P.ink;
  const footerText = isNight
    ? (lanternOn ? "#1B2247" : P.cloth)
    : (sel ? "#FFF" : P.cloth);
  const footerNavColor = isNight ? (lanternOn ? "#1B2247" : P.cloth) : P.cloth;
  const footerStripBg = `color-mix(in srgb, ${P.sky3} ${Math.round((1 - intro.ground) * 100)}%, ${P.hill3})`;
  const footerRevealOpacity = introComplete
    ? (nightFooterDim ? 0.52 : 1)
    : footerProgress;

  const renderSeasonalParticles = () => {
    const count =
      currentSeasonKey === "night" ? 34
      : currentSeasonKey === "winter" ? WINTER_SNOW_COUNT
      : 14;
    return [...Array(count)].map((_, i) => {
      const delay = i * -1.8;
      const duration = 12 / windStrength + (i % 4);
      const style = {
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
        transformOrigin: "center"
      };

      if (currentSeasonKey === "spring") {
        return (
          <g key={i} className={`drifting-sakura-container particle-spring-${i}`} style={style}>
            <g className="drifting-sakura">
              <ellipse cx="0" cy="0" rx="5" ry="3" fill="#FDA4AF" opacity="0.85" />
              <path d="M-2 0 Q0 -1 2 0" stroke="#f43f5e" strokeWidth="0.4" fill="none" />
            </g>
          </g>
        );
      }
      if (currentSeasonKey === "summer") {
        return (
          <g key={i} className={`drifting-heat-container particle-summer-${i}`} style={style}>
            <circle cx="0" cy="0" r="1.8" fill="#FDE047" opacity="0.65" />
            <circle cx="0" cy="0" r="0.8" fill="#FFFFFF" opacity="0.95" />
          </g>
        );
      }
      if (currentSeasonKey === "autumn") {
        const colors = ["#F97316", "#EA580C", "#D97706", "#C2410C"];
        const leafColor = colors[i % colors.length];
        return (
          <g key={i} className={`drifting-leaf-container particle-autumn-${i}`} style={style}>
            <g className="tumbling-leaf">
              <path d="M-5 0 C-4 -6, -1 -6, 0 -3 C1 -6, 4 -6, 5 0 C4 4, 1 5, 0 8 C-1 5, -4 4, -5 0 Z" fill={leafColor} opacity="0.9" />
              <line x1="0" y1="-2" x2="0" y2="8" stroke="#78350F" strokeWidth="0.5" />
            </g>
          </g>
        );
      }
      if (currentSeasonKey === "winter") {
        const startX = winterSnowStartX(i);
        return (
          <g
            key={i}
            className="drifting-snow-container"
            style={{
              "--sx": `${startX}px`,
              "--drift-x": `${WINTER_SNOW_DRIFT_X}px`,
              animationDuration: `${6.5 + (i % 6) * 0.55}s`,
              animationDelay: `${-((i * 1.35) + (i % 7) * 1.1)}s`,
              transformOrigin: "center",
            }}
          >
            <path d="M-4 0 L4 0 M0 -4 L0 4 M-3 -3 L3 3 M-3 3 L3 -3" stroke="#FFFFFF" strokeWidth="1.6" opacity="1" style={{ filter: "drop-shadow(0 0 1px rgba(100,116,139,0.45))" }} />
          </g>
        );
      }
      if (currentSeasonKey === "night") {
        const { sx, sy, r } = NIGHT_STARS[i];
        return (
          <g key={i} className={`star-twinkle star-${i % 6}`} transform={`translate(${sx}, ${sy})`}>
            <circle cx="0" cy="0" r={r} fill="#F5F3E0" />
          </g>
        );
      }
      return null;
    });
  };

  return (
    <div
      className={`${shiver ? "winter-shiver" : ""}${introActive ? " intro-active" : ""}`}
      style={{
        position: "fixed",
        inset: 0,
        background: `linear-gradient(to bottom, ${P.sky1} 0%, ${P.sky2} 45%, ${P.sky3} 70%)`,
        overflow: "hidden",
        transition: "all 1s cubic-bezier(0.4, 0, 0.2, 1)",
        color: P.ink
      }}
    >
      {/* WIND PARTICLES & ATMOSPHERIC EFFECTS */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1, opacity: enter3D ? 0 : 0.95, transition: "opacity 0.85s ease" }}>
        <svg style={{ width: "100%", height: "100%" }}>
          {renderSeasonalParticles()}
          {isNight && meteor && (
            <g key={meteor.id} className="meteor"
              style={{ "--dx": `${meteor.dropX}px`, "--dy": `${meteor.dropY}px` }}>
              <line
                x1={meteor.startX} y1={meteor.startY}
                x2={meteor.startX - meteor.len} y2={meteor.startY - meteor.len * 0.6}
                stroke="url(#meteorTrail)" strokeWidth="2.2" strokeLinecap="round" />
              <circle cx={meteor.startX} cy={meteor.startY} r="2.6" fill="#FFFFFF" />
            </g>
          )}
          <defs>
            <linearGradient id="meteorTrail" x1="0" y1="0" x2="1" y2="0.6">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.9" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Night dimming veil — lifts when the lantern is lit */}
      <div style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 8,
        background: "#0A0E25",
        opacity: isNight && !lanternOn ? 0.5 : 0,
        transition: "opacity 0.45s ease"
      }} />
      {/* Frosty chill vignette — flashes in during the winter shiver */}
      <div style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 10,
        background: "radial-gradient(130% 110% at 50% 50%, transparent 50%, rgba(186,214,240,0.4) 82%, rgba(147,190,234,0.6) 100%)",
        opacity: shiver ? 1 : 0,
        transition: "opacity 0.5s ease"
      }} />

      <div style={{ position: "absolute", inset: 0 }}>
        {/* PRIMARY INTERACTIVE PLAYGROUND */}
        <div style={{
          position: "absolute",
          inset: 0,
          bottom: FOOTER_HEIGHT,
          display: "flex",
          flexDirection: "column",
        }}>

          {keepMounted3D && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 1,
                opacity: enter3D ? 1 : 0,
                transition: "opacity 0.85s ease",
                pointerEvents: enter3D ? "auto" : "none",
              }}
            >
            <Suspense fallback={null}>
            <Scene3D
              active={scene3D}
              entryKey={entry3DCount}
              onTransitionReady={() => {
                if (scene3DRef.current) {
                  requestAnimationFrame(() => setEnter3D(true));
                }
              }}
              palette={P}
              seasonKey={currentSeasonKey}
              lanternOn={lanternOn}
              onToggleLantern={() => {
                if (currentSeasonKey !== "night") return;
                setLanternOn((v) => {
                  playLampSound(!v);
                  return !v;
                });
              }}
              onChimeStrike={playChimeSound}
              onChirp={playChirpSound}
              ropeControlY={ropeControlY}
              rightPostBottom={RIGHT_POST_BOTTOM}
              pieces={pieces.filter((pc) => !pc.isSock || (sockOnLine && (sockAnimating || sockRevealDone || introComplete)))}
              hangPositions={hangPositions}
              windStrength={windStrength}
              hot={hot}
              selectedId={selectedId}
              onGarmentPointerOver={(id) => {
                if (!introComplete || projectFocusActive) return;
                setHot(id);
              }}
              onGarmentPointerOut={() => {
                if (!introComplete) return;
                if (selectedId === null) setHot(null);
              }}
              onGarmentClick={(pc) => {
                if (!introComplete) return;
                if (pc.isSock) {
                  if (sockRevealDone) setSockNoteOpen(true);
                  return;
                }
                if (selectedId === pc.id) {
                  setSelectedId(null);
                  return;
                }
                setHot(pc.id);
                setSelectedId(pc.id);
              }}
            />
            </Suspense>
            </div>
          )}

          <svg
            ref={svgRef}
            viewBox={activeViewBox}
            preserveAspectRatio="xMidYMax meet"
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              flex: 1,
              minHeight: viewportWidth < 768 ? 380 : undefined,
              pointerEvents: enter3D ? "none" : (introComplete ? "auto" : "none"),
              opacity: enter3D ? 0 : 1,
              transition: "opacity 0.85s ease",
            }}
            onClick={handleGroundInteraction}
          >
            <defs>
              <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={P.sky1} />
                <stop offset="55%" stopColor={P.sky2} />
                <stop offset="100%" stopColor={P.sky3} />
              </linearGradient>
              <radialGradient id="sun" cx="78%" cy="22%" r="40%">
                <stop offset="0%" stopColor={P.sun} stopOpacity="0.4" />
                <stop offset="35%" stopColor={P.sky2} stopOpacity="0.18" />
                <stop offset="100%" stopColor={P.sky2} stopOpacity="0" />
              </radialGradient>
              <radialGradient id="sunDisk" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={P.sun} stopOpacity="1" />
                <stop offset="62%" stopColor={P.sun} stopOpacity="0.92" />
                <stop offset="82%" stopColor={P.sun} stopOpacity="0.28" />
                <stop offset="100%" stopColor={P.sun} stopOpacity="0" />
              </radialGradient>
              <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor={P.ink} floodOpacity="0.12" />
              </filter>
              <filter id="fireflyGlow" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur stdDeviation="1.6" />
              </filter>
              <radialGradient id="lanternLight" cx="50%" cy="48%" r="50%">
                <stop offset="0%" stopColor="#FFF9E6" stopOpacity="0.85" />
                <stop offset="22%" stopColor="#FFE9A8" stopOpacity="0.4" />
                <stop offset="48%" stopColor="#FCD34D" stopOpacity="0.18" />
                <stop offset="72%" stopColor="#FBBF24" stopOpacity="0.07" />
                <stop offset="100%" stopColor="#FBBF24" stopOpacity="0" />
              </radialGradient>
              <filter id="lanternSoft" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="10" />
              </filter>
              <filter id="lanternCastBlur" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="32" />
              </filter>
              <radialGradient id="lanternCast" gradientUnits="userSpaceOnUse" cx="970" cy="98" r="660">
                <stop offset="0%" stopColor="#FFF8E7" stopOpacity="0.4" />
                <stop offset="28%" stopColor="#FFE9A8" stopOpacity="0.2" />
                <stop offset="55%" stopColor="#FCD34D" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#FBBF24" stopOpacity="0" />
              </radialGradient>
              <filter id="moonGlow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="12" />
              </filter>
              <filter id="moonSoft" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="3" />
              </filter>
              <radialGradient id="moonBloom" cx="34%" cy="38%" r="62%">
                <stop offset="0%" stopColor="#FFF4C9" stopOpacity="0.42" />
                <stop offset="38%" stopColor="#F5E8B8" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#F5E8B8" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="moonSurface" cx="28%" cy="30%" r="72%">
                <stop offset="0%" stopColor="#FFFDF3" />
                <stop offset="45%" stopColor="#F7F0D4" />
                <stop offset="100%" stopColor="#CFC6A4" />
              </radialGradient>
              <linearGradient id="moonLimb" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFDF5" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#FBBF24" stopOpacity="0.35" />
              </linearGradient>
              <mask id="moonCrescent">
                <rect x="-90" y="-90" width="180" height="180" fill="black" />
                <circle cx="0" cy="0" r="56" fill="white" />
                <circle cx="36" cy="-6" r="45" fill="black" />
              </mask>
              <filter id="grain">
                <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
                <feColorMatrix type="saturate" values="0" />
                <feComponentTransfer><feFuncA type="linear" slope="0.05" /></feComponentTransfer>
                <feComposite operator="over" in2="SourceGraphic" />
              </filter>

              {/* bandhani — dense rows of small tie-dye dots with light centers */}
              <pattern id="weave" width="11" height="11" patternUnits="userSpaceOnUse">
                <circle cx="3" cy="3" r="1.7" fill={P.accent} opacity="0.5" />
                <circle cx="3" cy="3" r="0.6" fill={P.cloth} opacity="0.95" />
                <circle cx="8.5" cy="8.5" r="1.7" fill={P.accent} opacity="0.5" />
                <circle cx="8.5" cy="8.5" r="0.6" fill={P.cloth} opacity="0.95" />
              </pattern>
              {/* block-print butti — small repeated flower motif */}
              <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
                <g fill={P.accent} opacity="0.5">
                  <circle cx="6" cy="6" r="1.5" />
                  <ellipse cx="6" cy="2.5" rx="1" ry="1.8" />
                  <ellipse cx="6" cy="9.5" rx="1" ry="1.8" />
                  <ellipse cx="2.5" cy="6" rx="1.8" ry="1" />
                  <ellipse cx="9.5" cy="6" rx="1.8" ry="1" />
                  <ellipse cx="3.5" cy="3.5" rx="1.3" ry="1.3" transform="rotate(45 3.5 3.5)" />
                  <ellipse cx="8.5" cy="8.5" rx="1.3" ry="1.3" />
                </g>
                <g fill={P.accent} opacity="0.5">
                  <circle cx="17" cy="17" r="1.5" />
                  <ellipse cx="17" cy="13.5" rx="1" ry="1.8" />
                  <ellipse cx="17" cy="20.5" rx="1" ry="1.8" />
                  <ellipse cx="13.5" cy="17" rx="1.8" ry="1" />
                  <ellipse cx="20.5" cy="17" rx="1.8" ry="1" />
                </g>
              </pattern>
              {/* leheriya — fine diagonal wave stripes */}
              <pattern id="stripe" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="12" stroke={P.accent} strokeWidth="1.4" opacity="0.32" />
                <line x1="6" y1="0" x2="6" y2="12" stroke={P.soft} strokeWidth="1" opacity="0.3" />
              </pattern>

              <pattern id="woven-straw" width="10" height="10" patternUnits="userSpaceOnUse">
                <rect width="10" height="10" fill="none" />
                <path d="M0 2.5 H10 M0 7.5 H10" stroke="#F1D2B3" strokeWidth="1.2" opacity="0.5" />
                <path d="M2.5 0 V10 M7.5 0 V10" stroke="#E5C19B" strokeWidth="1" opacity="0.45" />
              </pattern>
            </defs>

            {/* Sky is the page-level CSS gradient — no duplicate SVG fill (avoids a visible seam) */}

            {/* Distant glowing sun / moon — painted before clouds so clouds pass in front */}
            <g
              style={{
                opacity: introComplete ? 1 : intro.atmosphere,
                transform: introComplete ? undefined : `translateY(${intro.sunRiseY * (1 - settleBlend)}px)`,
              }}
            >
              {/* SUN (day): soft halo + feathered disk + solid core */}
              <g style={{ opacity: isNight ? 0 : 1, transition: "opacity 1s ease" }}>
                <circle cx="820" cy="180" r="115" fill="url(#sunDisk)" opacity="0.12" />
                <circle cx="820" cy="125" r="92" fill="url(#sunDisk)" />
                <circle cx="820" cy="125" r="70" fill={P.sun} opacity="0.97" />
              </g>
              {/* MOON (night): tilted crescent with earthshine, golden limb, orbiting starlets */}
              <g
                className="moon-scene"
                transform="translate(820, 125) rotate(-16)"
                style={{ opacity: isNight ? 1 : 0, transition: "opacity 1s ease" }}
              >
                {/* Halo, bloom, sparkles — hidden while the street lantern is lit */}
                <g style={{ opacity: isNight && !lanternOn ? 1 : 0, transition: "opacity 0.45s ease" }}>
                  <ellipse cx="6" cy="-2" rx="112" ry="96" fill="url(#moonBloom)" opacity="0.72" />
                  <circle cx="0" cy="0" r="58" fill="#B8C2EA" opacity="0.06" filter="url(#moonSoft)" />
                  <circle cx="0" cy="0" r="60" fill="#FFF6D6" opacity="0.22" filter="url(#moonGlow)" />
                  <g fill="#FFF9E8">
                    <circle cx="-74" cy="-30" r="2" className="moon-sparkle moon-sparkle-0" />
                    <circle cx="-88" cy="6" r="1.3" className="moon-sparkle moon-sparkle-1" />
                    <circle cx="-64" cy="36" r="1.6" className="moon-sparkle moon-sparkle-2" />
                    <path d="M -96 -14 l2.2 0 l0.7 2.2 l-1.3 -1 l-1.3 1 z" className="moon-sparkle moon-sparkle-3" />
                  </g>
                </g>
                {/* Crescent — dim when lantern on, bright (not scene-lighting) when off */}
                <g
                  style={{
                    opacity: isNight ? (lanternOn ? 0.28 : 1) : 0,
                    filter: isNight && !lanternOn ? "brightness(1.14)" : "none",
                    transition: "opacity 0.45s ease, filter 0.45s ease"
                  }}
                >
                  <circle cx="0" cy="0" r="58" fill="#7B86B8" opacity="0.1" />
                  <g mask="url(#moonCrescent)">
                    <circle cx="0" cy="0" r="56" fill="url(#moonSurface)" />
                    <ellipse cx="-10" cy="10" rx="17" ry="13" fill="#E5DCC0" opacity="0.34" />
                    <ellipse cx="8" cy="-14" rx="11" ry="8" fill="#D9D0B6" opacity="0.28" />
                    <ellipse cx="-18" cy="-8" rx="7" ry="5" fill="#CEC4A8" opacity="0.22" />
                  </g>
                  <path
                    d="M -52 -8 A 56 56 0 1 1 -18 52"
                    fill="none"
                    stroke="url(#moonLimb)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    mask="url(#moonCrescent)"
                  />
                </g>
              </g>
            </g>

            {/* Drifting Clouds — SVG motion keeps them reliably in front of the moon */}
            <g
              fill={isNight ? (lanternOn ? "#5C6688" : "#7A84A8") : "#FFFFFF"}
              className={introComplete || intro.cloudReveal > 0.02 ? "clouds-revealed" : ""}
              opacity={
                introComplete
                  ? (isNight ? (lanternOn ? 0.42 : 0.58) : 0.88)
                  : 0.92 * intro.cloudReveal * (isNight ? (lanternOn ? 0.42 : 0.58) : 0.88)
              }
              style={{ transition: introActive ? "none" : "opacity 0.45s ease, fill 0.45s ease" }}
            >
              <g className="cloud-drift cloud-drift-a">
                <animateTransform attributeName="transform" type="translate" from="-300 0" to="1420 0" dur="72s" repeatCount="indefinite" />
                <ellipse cx="0" cy="48" rx="50" ry="17" />
                <ellipse cx="-44" cy="54" rx="34" ry="13" />
                <ellipse cx="42" cy="55" rx="36" ry="12" />
              </g>
              <g className="cloud-drift cloud-drift-b">
                <animateTransform attributeName="transform" type="translate" from="-300 0" to="1420 0" dur="72s" begin="-24s" repeatCount="indefinite" />
                <ellipse cx="0" cy="48" rx="46" ry="16" />
                <ellipse cx="-40" cy="54" rx="32" ry="12" />
                <ellipse cx="38" cy="55" rx="34" ry="11" />
              </g>
              <g className="cloud-drift cloud-drift-c">
                <animateTransform attributeName="transform" type="translate" from="-300 0" to="1420 0" dur="72s" begin="-48s" repeatCount="indefinite" />
                <ellipse cx="0" cy="48" rx="44" ry="15" />
                <ellipse cx="-38" cy="54" rx="30" ry="11" />
                <ellipse cx="36" cy="55" rx="32" ry="10" />
              </g>
            </g>

            {/* Animated Birds Flock (hidden at night) */}
            <g
              stroke={P.ink}
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
              style={{
                opacity: introComplete
                  ? (isNight ? 0 : 0.6)
                  : intro.atmosphere * (isNight ? 0 : 0.6),
              }}
            >
              <g className="flock-a">
                <path d="M0 0 q9 -8 17 0 q8 -8 17 0" />
                <path d="M44 16 q7 -6 13 0 q6 -6 13 0" />
                <path d="M30 -14 q6 -5 11 0 q5 -5 11 0" />
              </g>
            </g>

            {/* LANDSCAPE HILL LAYERS */}
            <g style={{ opacity: introComplete ? 1 : intro.ground }}>
              <path
                d="M -320 640 L -320 440 Q 250 370, 550 450 T 1360 410 L 1360 640 Z"
                fill={P.hill1}
                style={{ transition: "fill 1s ease" }}
              />

              <path
                d="M -320 640 L -320 480 Q 350 430, 750 480 T 1360 450 L 1360 640 Z"
                fill={P.hill2}
                style={{ transition: "fill 1s ease" }}
              />

              <path
                id="front-hill-base"
                d="M -320 640 L -320 500 Q 150 470, 450 515 T 1360 495 L 1360 640 Z"
                fill={P.hill3}
                style={{ transition: "fill 1s ease", cursor: "pointer" }}
              />

              <g style={{ opacity: isWinter ? 1 : 0, transition: "opacity 1s ease", pointerEvents: "none" }}>
                {/* Soft powdery sheen near each snowy crest for subtle texture */}
                <path
                  fill="#FFFFFF"
                  opacity="0.45"
                  d="M -320 500 Q 150 470, 450 515 T 1360 495 L 1360 512 Q 450 532, 150 487 T -320 517 Z"
                />
              </g>

            </g>

            {/* Night hill tap target — ground & dunes only, not sky */}
            {currentSeasonKey === "night" && introComplete && (
              <rect
                x={sceneMinX}
                y={418}
                width={sceneWidth}
                height={220}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onPointerDown={handleNightHillPointer}
              />
            )}

            {/* Clothesline posts */}
            <g
              stroke={P.ink}
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              style={{ opacity: introComplete ? 1 : intro.ropeOpacity, transition: "stroke 1s ease" }}
            >
              <path d="M70 130 V470" />
              <path d={`M${RIGHT_POST_X} 130 V${RIGHT_POST_BOTTOM}`} />
              <path d="M40 150 L100 130 M40 130 L100 150" strokeWidth="2.5" />
              <path d="M940 150 L1000 130 M940 130 L1000 150" strokeWidth="2.5" />
            </g>

            <g fill="#FFFFFF" stroke="none" style={{ opacity: isWinter ? 0.95 : 0, transition: "opacity 1s ease", pointerEvents: "none" }}>
              <path d="M 35 145 Q 70 135 105 145 Q 70 148 35 145 Z" />
              <path d="M 935 145 Q 970 135 1005 145 Q 970 148 935 145 Z" />
            </g>

            {/* NIGHT: street-lantern mounted on top of the right pole — click to light the scene */}
            <g
              style={{ opacity: isNight ? 1 : 0, transition: "opacity 1s ease", pointerEvents: isNight ? "auto" : "none", cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                if (isNight) {
                  setLanternOn((v) => {
                    playLampSound(!v);
                    return !v;
                  });
                }
              }}
            >
              {/* smooth lantern bloom — single gradient + blur, no hard rings */}
              {lanternOn && (
                <circle
                  className={lanternIgniting ? "lantern-bloom lantern-ignite-flicker" : "lantern-bloom"}
                  cx="970" cy="96" r="110"
                  fill="url(#lanternLight)"
                  filter="url(#lanternSoft)"
                  style={{ pointerEvents: "none" }}
                />
              )}

              <g stroke={P.ink} strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" fill={P.soft}>
                {/* base collar sitting on the pole top (pole top ~y130) */}
                <path d="M963 128 h14 l-3 -8 h-8 Z" />
                {/* tapered glass cage (wider top, narrow bottom) */}
                <path d="M958 95 L982 95 L976 120 L964 120 Z"
                  fill={lanternOn ? "#FFE08A" : "#2E3658"}
                  style={{ transition: lanternOn ? "fill 0.4s ease" : "fill 0.1s ease" }} />
                {/* glowing inner pane when lit */}
                <path
                  className={lanternOn && lanternIgniting ? "lantern-ignite-flicker" : undefined}
                  d="M963 97 L977 97 L973 117 L967 117 Z"
                  fill={lanternOn ? "#FFF4C2" : "#222B4A"} stroke="none"
                  style={{ transition: lanternOn ? "fill 0.4s ease" : "fill 0.1s ease" }} />
                {/* corner frame edge */}
                <path d="M970 95 V120" stroke={P.ink} strokeWidth="0.8" opacity="0.5" fill="none" />
                {/* brim above the cage */}
                <path d="M956 95 h28" stroke={P.ink} strokeWidth="2" />
                {/* peaked dome cap + top knob */}
                <path d="M970 80 L982 94 q-12 4 -24 0 Z" />
                <circle cx="970" cy="78" r="2.2" />
              </g>

            </g>

            {/* Dynamic Chime Assembly */}
            <g
              className={`wind-chime-assembly ${chimeContact ? "chime-clang" : ""}`}
              style={{
                opacity: introComplete ? 1 : intro.atmosphere,
                cursor: introComplete ? "pointer" : "default",
                transformOrigin: "48px 132px",
                animation: introComplete ? `unifiedSway ${6.5 / windStrength}s ease-in-out infinite` : "none",
              }}
              onClick={(e) => {
                if (!introComplete) return;
                e.stopPropagation();
                setChimeContact(true);
                playChimeSound();
                setTimeout(() => setChimeContact(false), 1500);
              }}
            >
              <line x1="48" y1="132" x2="48" y2="149" stroke={P.ink} strokeWidth="1.5" />
              <circle cx="48" cy="132" r="1.8" fill={P.ink} />
              <rect x="36" y="149" width="24" height="4" rx="1" fill={P.soft} stroke={P.ink} strokeWidth="1" />

              <rect x="39" y="153" width="3" height="28" rx="1" fill={P.cloth} stroke={P.ink} strokeWidth="1" />
              <rect x="46" y="153" width="3" height="34" rx="1" fill={P.cloth} stroke={P.ink} strokeWidth="1" />
              <rect x="53" y="153" width="3" height="24" rx="1" fill={P.cloth} stroke={P.ink} strokeWidth="1" />

              <circle cx="48" cy="172" r="2.5" fill={P.accent} />
              <line x1="48" y1="172" x2="48" y2="194" stroke={P.ink} strokeWidth="1" />
              <polygon points="45,194 51,194 48,200" fill={P.accent} stroke={P.ink} strokeWidth="1" />

              {chimeContact && (
                <g stroke={P.accent} strokeWidth="1" fill="none" opacity="0.8">
                  <circle cx="48" cy="174" r="15" className="sound-ring" />
                  <circle cx="48" cy="174" r="28" className="sound-ring" style={{ animationDelay: "0.2s" }} />
                </g>
              )}
            </g>

            {/* The line */}
            <path
              id="line"
              className={ropeSwayActive ? "sway-line" : sockAnimating ? "sock-rope-drop" : "intro-rope-loading"}
              d={`M70 138 Q${ropeControlX} ${ropeControlY} 970 138`}
              stroke={P.ink}
              strokeWidth="2.5"
              fill="none"
              opacity={introComplete ? 1 : intro.ropeOpacity}
              style={{
                transition: introComplete ? "stroke 1s ease" : "none",
                strokeDasharray: introComplete ? undefined : ROPE_PATH_LENGTH,
                strokeDashoffset: introComplete ? undefined : ROPE_PATH_LENGTH * (1 - intro.ropeDraw),
              }}
            />

            <g style={{ opacity: isWinter ? 1 : 0, transition: "opacity 0.8s ease", pointerEvents: "none" }}>
                <path
                  className={ropeSwayActive ? "sway-line" : sockAnimating ? "sock-rope-drop" : "intro-rope-loading"}
                  d={`M70 137 Q${ropeControlX} ${ropeControlY - 1} 970 137`}
                  stroke="#FFFFFF"
                  strokeWidth="3.5"
                  fill="none"
                  opacity={windStrength > 4.5 ? "0.4" : "0.95"}
                  strokeLinecap="round"
                />
                <g fill="#FFFFFF" opacity="0.9">
                  <polygon points="318,162 322,176 326,162" />
                  <polygon points="497,162 501,176 505,162" />
                  <polygon points="677,162 681,176 685,162" />
                </g>
              </g>

            {/* PORTFOLIO CASE STUDY GARMENTS */}
            {pieces.map((_, i) => i).map((i) => {
              const pc = pieces[i];
              const anchor = hangPositions[i];
              let hangX = anchor.x;
              let hangY = anchor.y;
              if (sockAnimating && sockAnimProgress < 1) {
                ({ x: hangX, y: hangY } = resolveSockEasterEggPosition(i, pc, sockAnimProgress));
              }
              const x = 0;
              const y = 0;
              const isHovered = hot === pc.id;
              const isSelected = !pc.isSock && selectedId === pc.id;
              const isSpreadAnchor = projectFocusActive && i === spreadCenterIndex;
              const focusDx = projectFocusActive
                ? garmentFocusOffset(i, spreadCenterIndex, hangXs)
                : 0;
              const focusDelay = projectFocusActive
                ? garmentFocusStagger(i, spreadCenterIndex)
                : 0;
              const focusTransitionMs = spreadClosing
                ? FOCUS_MODE.transitionMs + 80
                : FOCUS_MODE.transitionMs;
              const showGarmentLabel = isHovered || (projectFocusActive && isSelected);
              const isHighlit = projectFocusActive ? isSelected : (isHovered || isSelected);

              const gLocal = introComplete ? 1 : garmentLocal(introProgress, i, pieces.length);
              const sockMotionActive = pc.isSock && sockAnimating;
              const showPiece = pc.isSock
                ? sockOnLine && (sockAnimating || sockRevealDone || introComplete)
                : (introComplete || gLocal > 0);
              const pieceOpacity = showPiece
                ? (pc.isSock && sockAnimating
                  ? 1
                  : Math.min(1, introComplete ? 1 : gLocal / 0.06))
                : 0;
              const sockSwingY = sockMotionActive
                ? (sockAnimProgress < 1
                  ? sockLandingSwingY(sockAnimProgress)
                  : sockSettleSwingY(sockSettleProgress))
                : 0;
              const fallY = sockMotionActive
                ? sockSwingY
                : (introComplete ? 0 : (
                garmentFallOffset(gLocal)
                + middlePieceSwingY(gLocal, i)
                + gustBillowY(introProgress, i, gLocal)
              ) * (1 - settleBlend));
              const pieceRot = sockMotionActive
                ? (sockAnimProgress < 1
                  ? garmentRotation(sockAnimProgress, i) + sockLandingSwingRot(sockAnimProgress)
                  : sockSettleSwingRot(sockSettleProgress))
                : (introComplete ? 0 : (
                garmentRotation(gLocal, i)
                + middlePieceExtraRot(gLocal, i)
                + gustRotation(introProgress, i, gLocal)
              ) * (1 - settleBlend));
              const pinS = sockMotionActive
                ? (sockAnimProgress < 1 ? pinScaleFromLandProgress(sockAnimProgress) : 1)
                : (introComplete ? 1 : pinScale(introProgress, i, pieces.length));

              const lampWarmth = isNight && lanternOn ? Math.pow(Math.max(0, Math.min(1, (hangX - 70) / 900)), 0.82) : 0;
              const windSpeedFactor = windStrength > 0 ? (9 + (i % 3) * 1.4) / windStrength : 1000;
              const animationStyle = {
                animationDuration: `${windSpeedFactor}s`,
                animationDelay: `${i * -0.7}s`,
                transformOrigin: `${x}px ${y}px`,
                cursor: introComplete ? "pointer" : "default",
              };

              return (
                <g key={pc.id} className={`piece-wrapper ${introComplete ? "scene-interactive" : ""}`} opacity={pieceOpacity}>
                  <g
                    className={`piece-spread-offset${isSpreadAnchor ? " piece-spread-offset--anchor" : ""}`}
                    style={{
                      "--focus-x": `${focusDx}px`,
                      "--focus-delay": `${focusDelay}ms`,
                      "--focus-transition": `${focusTransitionMs}ms`,
                    }}
                  >
                  <g transform={`translate(${hangX} ${hangY})`}>
                  <g className="piece-flutter" style={{ animationDelay: `${i * -0.4}s`, transformOrigin: `${x}px ${y}px`, ...(sockMotionActive ? { animation: "none" } : {}) }}>
                  <g transform={`translate(0 ${fallY})`}>
                  <g transform={`rotate(${pieceRot} ${x} ${y + GARMENT_ROT_PIVOT_Y})`}>
                  <g
                    opacity={pinS > 0.01 ? 1 : 0}
                    transform={`translate(${x} ${y}) scale(${Math.max(pinS, 0.001)}) translate(${-x} ${-y})`}
                    style={{ pointerEvents: "none" }}
                  >
                    {pc.isSock ? (
                      <g transform="translate(-60, -14)">
                        <rect x="57.4" y="14" width="5.2" height="15" rx="2.4" fill="#C68A4E" />
                        <rect x="57.4" y="14" width="5.2" height="15" rx="2.4" fill="none" stroke="#8A5A2C" strokeWidth="0.6" opacity="0.7" />
                        <line x1="60" y1="17" x2="60" y2="27" stroke="#8A5A2C" strokeWidth="0.5" opacity="0.5" />
                      </g>
                    ) : (
                      <>
                        <g>
                          <rect x={x - 22} y={y - 8} width="5.2" height="15" rx="2.4" fill="#C68A4E" />
                          <rect x={x - 22} y={y - 8} width="5.2" height="15" rx="2.4" fill="none" stroke="#8A5A2C" strokeWidth="0.6" opacity="0.7" />
                          <line x1={x - 19.4} y1={y - 5} x2={x - 19.4} y2={y + 5} stroke="#8A5A2C" strokeWidth="0.5" opacity="0.5" />
                        </g>
                        <g>
                          <rect x={x + 16.8} y={y - 8} width="5.2" height="15" rx="2.4" fill="#C68A4E" />
                          <rect x={x + 16.8} y={y - 8} width="5.2" height="15" rx="2.4" fill="none" stroke="#8A5A2C" strokeWidth="0.6" opacity="0.7" />
                          <line x1={x + 19.4} y1={y - 5} x2={x + 19.4} y2={y + 5} stroke="#8A5A2C" strokeWidth="0.5" opacity="0.5" />
                        </g>
                      </>
                    )}
                  </g>

                  <g
                    style={introComplete && !sockMotionActive ? animationStyle : { transformOrigin: `${x}px ${y}px` }}
                    className={introComplete && !sockMotionActive ? "cloth-body" : undefined}
                  >
                    <rect
                      x={pc.isSock ? x - 32 : x - 42}
                      y={pc.isSock ? y - 2 : y - 68}
                      width={pc.isSock ? 42 : 84}
                      height={pc.isSock ? 112 : 240}
                      fill="transparent"
                      style={{ cursor: introComplete && (sockRevealDone || !pc.isSock) ? "pointer" : "default" }}
                      onPointerEnter={() => {
                        if (!introComplete || projectFocusActive) return;
                        setHot(pc.id);
                      }}
                      onPointerLeave={() => {
                        if (!introComplete) return;
                        if (selectedId !== pc.id) setHot(null);
                      }}
                      onClick={(e) => {
                        if (!introComplete) return;
                        e.stopPropagation();
                        if (pc.isSock) {
                          if (sockRevealDone) setSockNoteOpen(true);
                          return;
                        }
                        if (selectedId === pc.id) {
                          setSelectedId(null);
                          return;
                        }
                        setHot(pc.id);
                        setSelectedId(pc.id);
                      }}
                    />
                    <g pointerEvents="none">
                    {pc.isSock
                      ? sockShape(x, y, isHighlit, P)
                      : clothShape(pc, x, y, isHighlit, P, newType, currentSeasonKey, lampWarmth, projectFocusActive && !isSelected)}
                    {showGarmentLabel && !pc.isSock && (() => {
                      const labelW = Math.max(104, pc.title.length * 7.2 + 24);
                      const pillBg = isNight ? (lanternOn ? P.accent : "#F0C53A") : P.accent;
                      const labelText = isNight ? (lanternOn ? "#1B2247" : P.cloth) : P.cloth;
                      return (
                        <g className="garment-label">
                          <rect
                            x={x - labelW / 2}
                            y={y - 42}
                            width={labelW}
                            height={25}
                            rx={5}
                            fill={pillBg}
                            stroke="none"
                            style={{ transition: "fill 0.25s ease" }}
                          />
                          <text
                            x={x}
                            y={y - 26}
                            fontSize={9.5}
                            textAnchor="middle"
                            fill={labelText}
                            stroke="none"
                            style={{ fontFamily: MONO, fontWeight: 600, letterSpacing: 1.2, transition: "fill 0.25s ease" }}
                          >
                            {pc.title}
                          </text>
                          <path d={`M${x} ${y - 17} v9`} stroke={pillBg} strokeWidth="1.8" style={{ transition: "stroke 0.25s ease" }} />
                        </g>
                      );
                    })()}
                    </g>
                  </g>
                  </g>
                  </g>
                  </g>
                  </g>
                  </g>
                </g>
              );
            })}

            {rustledLeaves.map((l) => (
              <g key={l.id} transform={`translate(${l.x}, ${l.y})`} style={{ pointerEvents: "none" }}>
                <g
                  className="sand-ripple"
                  style={{
                    "--dx": `${l.dx}px`,
                    "--dy": `${l.dy}px`,
                    "--rot": `${l.angle}deg`
                  }}
                >
                  <path d="M-6 0 C-5 -7, -2 -7, 0 -3 C1 -7, 4 -7, 6 0 C5 5, 2 6, 0 10 Z" fill="#EA580C" opacity="0.85" />
                  <line x1="0" y1="-2" x2="0" y2="10" stroke="#78350F" strokeWidth="0.5" />
                </g>
              </g>
            ))}

            {snowSplashes.map((s) => (
              <circle
                key={s.id}
                cx={s.x}
                cy={s.y}
                r="3"
                fill="#FFFFFF"
                className="snow-splash"
                style={{
                  pointerEvents: "none",
                  "--vx": `${s.vx * 30}px`,
                  "--vy": `${s.vy * 30}px`
                }}
              />
            ))}

            {birdSnowFall.map((f) => (
              <circle
                key={f.id}
                cx={f.x}
                cy={f.y}
                r={f.r}
                fill="#FFFFFF"
                className="bird-snow-drop"
                style={{
                  pointerEvents: "none",
                  "--vx": `${f.vx}px`,
                  "--vy": `${f.vy}px`,
                }}
              />
            ))}

            {/* Grass blades */}
            <g
              stroke={P.ink}
              strokeWidth="2"
              fill="none"
              opacity={introComplete ? 0.55 : intro.ground * 0.55}
              strokeLinecap="round"
              style={{ transition: "stroke 1s ease", pointerEvents: "none" }}
            >
              {[...Array(26)].map((_, i) => {
                const gx = 30 + i * 39;
                return (
                  <path
                    key={i}
                    className="blade"
                    style={{
                      animationDelay: `${(i % 5) * -0.4}s`,
                      animationDuration: `${3 / (windStrength * 0.7 + 0.3)}s`,
                      transformOrigin: `${gx}px 500px`
                    }}
                    d={`M${gx} 500 q6 -22 -2 -40`}
                  />
                );
              })}
            </g>

            {/* Basket landing dust — in front of ground, around basket base (exact spec) */}
            {intro.dustVisible && (
              <g
                style={{ pointerEvents: "none" }}
                opacity={intro.dustGroupOpacity}
              >
                {BASKET_DUST_OFFSETS.map((_, di) => {
                  const puff = basketDustPuff(intro.basketLand, di);
                  return (
                    <ellipse
                      key={`dust-puff-${di}`}
                      cx={puff.cx}
                      cy={puff.cy}
                      rx={puff.rx}
                      ry={puff.ry}
                      fill={BASKET_DUST_COLOR}
                      opacity={puff.opacity}
                    />
                  );
                })}
              </g>
            )}

            {/* Premium Light Straw Wicker Basket — visible from progress 0.88, hard on */}
            {showBasket && (
            <g
              opacity={basketOpacity}
              onClick={handleBasketClick}
              style={{ cursor: introComplete ? "pointer" : "default" }}
              transform={
                introComplete
                  ? undefined
                  : `translate(0 ${basketAnim.y * (1 - settleBlend)})`
              }
            >
            <g
              transform={
                introComplete
                  ? undefined
                  : `translate(${BASKET_CENTER_X} ${BASKET_CENTER_Y}) rotate(${basketAnim.rot * (1 - settleBlend)}) translate(${-BASKET_CENTER_X} ${-BASKET_CENTER_Y})`
              }
              filter="url(#soft)"
              stroke={P.ink}
              strokeWidth="2.5"
              fill={P.cloth}
              strokeLinejoin="round"
            >
              <path d="M110 505 Q100 488, 122 490" fill="none" stroke={P.ink} strokeWidth="3" />
              <path d="M250 505 Q260 488, 238 490" fill="none" stroke={P.ink} strokeWidth="3" />

              <path d="M120 500 L240 500 L226 556 L134 556 Z" fill="#FDF3E5" />
              <path d="M120 500 L240 500 L226 556 L134 556 Z" fill="url(#woven-straw)" />

              <path d="M120 500 L240 500" stroke="#FCE9D3" strokeWidth="4.5" />
              <path d="M134 556 L226 556" stroke="#DFBD99" strokeWidth="5.5" />

              <path d="M125 518 Q180 521, 235 518" fill="none" stroke="#F5DBBE" strokeWidth="2.2" />
              <path d="M130 538 Q180 541, 230 538" fill="none" stroke="#F5DBBE" strokeWidth="2.2" />

              <path d="M150 498 q30 -28 60 -2" fill="none" stroke={P.accent} strokeWidth="2.5" />
              <path d="M150 504 q14 -22 30 -6 q16 -18 30 0" fill="none" stroke={P.soft} strokeWidth="1.6" />

              {/* Autumn leaves — move with basket during intro drop */}
              {currentSeasonKey === "autumn" && (
                <g stroke="#7C3A12" strokeWidth="0.7" strokeOpacity="0.5" style={{ pointerEvents: "none" }}>
                  <path d="M150 496 q3 -7 7 -1 q3 -7 7 0 q-1 6 -7 7 q-6 -1 -7 -6 Z" fill="#D97706" transform="rotate(-18 156 494)" />
                  <path d="M172 492 q3 -7 7 -1 q3 -7 7 0 q-1 6 -7 7 q-6 -1 -7 -6 Z" fill="#EA580C" transform="rotate(8 178 490)" />
                  <path d="M196 495 q3 -7 7 -1 q3 -7 7 0 q-1 6 -7 7 q-6 -1 -7 -6 Z" fill="#CA8A04" transform="rotate(22 202 493)" />
                  <path d="M216 498 q3 -6 6 -1 q3 -6 6 0 q-1 5 -6 6 q-5 -1 -6 -5 Z" fill="#C2410C" transform="rotate(-10 220 496)" />
                </g>
              )}
            </g>
            </g>
            )}

            {/* Spring flowers — in front of basket */}
            {currentSeasonKey === "spring" && (
              <g style={{ transition: "all 1s ease", pointerEvents: "none" }}>
                {bloomedFlowers
                  .filter((f) => f.x >= sceneMinX + poppyInset && f.x <= sceneMaxX - poppyInset)
                  .filter((f) => !poppyHiddenBySunflower(f, springSunflower))
                  .map((f) => (
                  <g key={f.id} transform={`translate(${f.x}, ${f.y})`}>
                    <g className="poppy-bloom">
                      <path d="M0 0 Q3 14 0 25" stroke="#3A6346" strokeWidth="1.6" fill="none" />
                      <circle cx="-5" cy="-3" r="6" fill="#F43F5E" />
                      <circle cx="5" cy="-3" r="6" fill="#F43F5E" />
                      <circle cx="0" cy="5" r="6" fill="#E11D48" />
                      <circle cx="0" cy="-6" r="6" fill="#E11D48" />
                      <circle cx="0" cy="0" r="3.2" fill="#111827" />
                      <circle cx="0" cy="0" r="1.5" fill="#FBBF24" />
                    </g>
                  </g>
                ))}
                {springSunflower && springSunflower.x >= sceneMinX + poppyInset && springSunflower.x <= sceneMaxX - poppyInset && (
                  <g transform={`translate(${springSunflower.x}, ${springSunflower.y})`}>
                    <SpringSunflowerBloom />
                  </g>
                )}
              </g>
            )}

            {/* STARTLED BIRD — flies in during intro, then perches on left post */}
            <g
              onClick={(e) => {
                if (!introComplete) return;
                e.stopPropagation();
                shooBird();
              }}
              onMouseEnter={() => introComplete && setBirdChirp(true)}
              onMouseLeave={() => introComplete && setBirdChirp(false)}
              className={
                introComplete ? (
                  birdPosition === "flying-to-right" ? "scared-bird-flight-right" :
                  birdPosition === "flying-to-left" ? "scared-bird-flight-left" :
                  birdPosition === "flying-away-right" ? "bird-fly-away-right" :
                  birdPosition === "flying-away-left" ? "bird-fly-away-left" : ""
                ) : introBirdFlying ? "intro-bird-flight-left" : ""
              }
              style={{
                cursor: introComplete ? "pointer" : "default",
                opacity: (birdGone || isNight) ? 0 : (introComplete ? 1 : introBirdOpacity),
                pointerEvents: birdGone || isNight || !introComplete ? "none" : "auto",
                transition: introComplete ? "opacity 1s ease" : "none",
                transform: introComplete
                  ? (birdPosition === "left" ? `translate(${BIRD_PERCH_X}px, ${BIRD_PERCH_Y}px) scale(1, 1)` :
                     birdPosition === "right" ? "translate(970px, 122px) scale(-1, 1)" : undefined)
                  : undefined,
                transformOrigin: "center",
              }}
            >
              <g transform="translate(-10, -10)">
                <circle cx="10" cy="10" r="7" fill={P.accent} />
                <path d="M3 10 Q10 18 17 10" fill={P.accent} />
                <polygon points="16,8 20,10 16,12" fill="#3A2A22" />
                <path d="M4 11 L1 15 L5 13 Z" fill={P.accent} />
                <circle cx="13" cy="8" r="1.2" fill={P.cloth} />
                {showBirdSnowCap && birdSnowLandingKey > 0 && (
                  <BirdHeadSnowflakes key={birdSnowLandingKey} />
                )}
              </g>

              {birdChirp && !isBirdFlying && (
                <g transform="translate(15, -25)" opacity="0.9">
                  <rect x="-10" y="0" width="44" height="15" rx="4" fill={P.cloth} stroke={P.ink} strokeWidth="1" />
                  <text x="12" y="10" fontSize="8" textAnchor="middle" fill={P.ink} style={{ fontFamily: MONO, fontWeight: 600 }}>
                    ♫ chip
                  </text>
                </g>
              )}
            </g>

            {/* Lantern light cast — soft cone from the lamp onto clothes + ground */}
            <g
              style={{
                opacity: isNight && lanternOn ? 1 : 0,
                mixBlendMode: "screen",
                pointerEvents: "none",
                transition: lanternIgniting ? "none" : "opacity 0.5s ease",
                animation: lanternIgniting ? "lanternIgniteFlicker 0.18s steps(1) forwards" : "none",
              }}
            >
              <ellipse
                className="lantern-cast-layer"
                cx="700" cy="300" rx="580" ry="255"
                fill="url(#lanternCast)"
                filter="url(#lanternCastBlur)"
                transform="rotate(-16 700 300)"
              />
              <ellipse
                className="lantern-cast-layer"
                cx="500" cy="485" rx="400" ry="95"
                fill="url(#lanternCast)"
                filter="url(#lanternCastBlur)"
                opacity="0.72"
                transform="rotate(-10 500 485)"
              />
              <ellipse
                className="lantern-cast-layer"
                cx="210" cy="468" rx="160" ry="52"
                fill="url(#lanternCast)"
                filter="url(#lanternCastBlur)"
                opacity="0.45"
                transform="rotate(-8 210 468)"
              />
              <path
                d="M70 138 Q520 196 970 138"
                stroke="#FFF0C2"
                strokeWidth="5"
                fill="none"
                opacity="0.35"
                strokeLinecap="round"
              />
              <line
                x1="970" y1="128" x2="970" y2="468"
                stroke="#FFE9A8"
                strokeWidth="7"
                opacity="0.18"
                strokeLinecap="round"
              />
            </g>

            {/* Night fireflies — float above the hills, then fade out */}
            {currentSeasonKey === "night" && (
              <g style={{ pointerEvents: "none" }}>
                {fireflies.map((f) => (
                  <HillFirefly
                    key={f.id}
                    x={f.x}
                    y={f.y}
                    flightMs={f.flightMs}
                    driftX={f.driftX}
                    driftY={f.driftY}
                    wiggle1={f.wiggle1}
                    wiggle2={f.wiggle2}
                    blinkDelay={f.blinkDelay}
                    blinkMs={f.blinkMs}
                  />
                ))}
              </g>
            )}
          </svg>

          {projectFocusActive && focusCardPos && (() => {
            const item = pieces[focusedIndex];
            if (!item) return null;
            const hidePlaygroundPeek = (projectViewOpen || projectViewClosing) && growCardOrigin && projectViewOpen && !projectViewClosing;
            if (hidePlaygroundPeek) return null;

            const cardW = focusCardPos.width || 180;
            const titleSize = Math.max(9.5, cardW * 0.048) + 1;
            const bodySize = Math.max(11.5, cardW * 0.058) + 1;
            const btnSize = Math.max(8.5, cardW * 0.038) + 1;
            const tagSwaySec = windStrength > 0
              ? (9 + (focusedIndex % 3) * 1.4) / windStrength
              : 5;

            const closeCard = () => {
              setProjectViewOpen(false);
              setSelectedId(null);
              setHot(null);
            };

            const cardBg = isNight && lanternOn ? "#F5F0E6" : P.cloth;
            const cardInk = isNight && lanternOn ? "#1B2247" : P.ink;
            const cardBodyInk = isNight && lanternOn ? "#1B2247CC" : `${P.ink}CC`;
            const cardBtnBg = isNight && lanternOn ? "#1B2247" : P.ink;
            const cardBtnInk = isNight && lanternOn ? "#F5F0E6" : P.cloth;
            const cardCloseBg = isNight && lanternOn ? "#EDE6CF" : (P.clothTint || P.cloth);

            return (
              <div
                ref={focusCardRef}
                key={`focus-card-${item.id}`}
                className={`project-focus-card project-focus-card--compact${
                  projectViewClosing ? " project-focus-card--handoff-return" : ""
                }`}
                style={{
                  position: "absolute",
                  left: focusCardPos.x,
                  top: focusCardPos.y,
                  width: cardW,
                  zIndex: 15,
                  pointerEvents: "auto",
                  "--tag-sway-duration": `${tagSwaySec}s`,
                  "--tag-sway-delay": `${focusedIndex * -0.7}s`,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="project-focus-card-sway">
                  <div
                    className="project-focus-card-inner"
                    style={{
                      background: cardBg,
                      boxShadow: isNight && lanternOn
                        ? `0 10px 28px #00000040, 0 0 24px #FBBF2420, 0 2px 6px #00000018`
                        : `0 10px 28px ${P.ink}14, 0 2px 6px ${P.ink}0A`,
                      transition: "background 0.45s ease, box-shadow 0.45s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                      <span style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: P.accent,
                        flexShrink: 0,
                      }} />
                      <h3 style={{
                        margin: 0,
                        fontFamily: MONO,
                        fontSize: titleSize,
                        fontWeight: 600,
                        letterSpacing: 0.85,
                        color: cardInk,
                        lineHeight: 1.2,
                        transition: "color 0.45s ease",
                      }}>
                        {item.title}
                      </h3>
                    </div>
                    <p style={{
                      margin: "0 0 10px",
                      fontFamily: BODY,
                      fontSize: bodySize,
                      lineHeight: 1.45,
                      color: cardBodyInk,
                      transition: "color 0.45s ease",
                    }}>
                      {item.summary || item.note}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={handleViewProject}
                        className="project-focus-btn project-focus-btn-primary"
                        style={{
                          fontFamily: MONO,
                          fontSize: btnSize,
                          padding: "6px 11px",
                          background: cardBtnBg,
                          color: cardBtnInk,
                          border: "none",
                          outline: "none",
                          boxShadow: "none",
                          transition: "background 0.45s ease, color 0.45s ease",
                        }}
                      >
                        VIEW PROJECT →
                      </button>
                      <button
                        type="button"
                        onClick={closeCard}
                        className="project-focus-btn project-focus-close"
                        aria-label="Close project card"
                        style={{
                          background: cardCloseBg,
                          color: cardInk,
                          transition: "background 0.45s ease, color 0.45s ease",
                        }}
                      >
                        <X size={14} strokeWidth={2.25} aria-hidden />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {introActive && (
            <div style={{ position: "absolute", top: 24, left: 24, zIndex: 14, display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={skipIntro}
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: `1px solid ${P.ink}22`,
                  background: `${P.cloth}CC`,
                  color: P.ink,
                  cursor: "pointer",
                  backdropFilter: "blur(12px)",
                }}
              >
                Skip
              </button>
            </div>
          )}
          {!introActive && (
            <div style={{ position: "absolute", top: 24, left: 24, zIndex: 14 }}>
              <button
                type="button"
                onClick={replayIntro}
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: `1px solid ${P.ink}22`,
                  background: `${P.cloth}CC`,
                  color: P.ink,
                  cursor: "pointer",
                  backdropFilter: "blur(12px)",
                }}
              >
                Replay
              </button>
            </div>
          )}

          {/* Intro Title Typography */}
          <div
            style={{
            position: "absolute",
            top: "clamp(108px, 12vh, 140px)",
            left: "50%",
            maxWidth: 620,
            width: "90%",
            pointerEvents: "none",
            textAlign: "center",
            zIndex: 5,
            textShadow: titleLit ? "0 0 28px rgba(251,191,36,0.22)" : "none",
            opacity: introComplete ? 1 : intro.heroOpacity,
            transform: `translateX(-50%) translateY(${introComplete ? 0 : (1 - intro.heroOpacity) * 14}px)`,
          }}>
            <div
              className={introComplete ? undefined : "intro-role-fade-up"}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 }}
            >
              <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: titleLit ? "#FCD34D" : P.accent, transition: "background 0.5s ease" }} />
              <span style={{ fontFamily: BODY, fontSize: 13, fontWeight: 500, letterSpacing: 2.5, textTransform: "uppercase", color: titleSubColor, opacity: 0.8, transition: "color 1.1s ease" }}>
                Product & UX Designer
              </span>
            </div>
            <div style={{ fontFamily: HEADER, fontSize: "4rem", fontWeight: 400, color: titleColor, lineHeight: 1.05, letterSpacing: -0.5, transition: "color 1.1s ease" }}>
              {introComplete || introProgress >= 0.24 ? (
                <>Hi, I'm Varna Das<span style={{ color: titleLit ? "#FCD34D" : P.accent, transition: "color 1.1s ease" }}>.</span></>
              ) : (
                <span aria-label={NAME_TEXT}>
                  {nameChars.map((char, i) => {
                    const cp = nameCharProgress(introProgress, i, nameChars.length);
                    const yOff = nameCharOffset(cp);
                    return (
                      <span
                        key={`${char}-${i}`}
                        style={{
                          display: "inline-block",
                          opacity: cp > 0.02 ? 1 : 0,
                          transform: `translateY(${yOff}px)`,
                          color: char === "." ? (titleLit ? "#FCD34D" : P.accent) : titleColor,
                        }}
                      >
                        {char === " " ? "\u00A0" : char}
                      </span>
                    );
                  })}
                </span>
              )}
              <span
                style={{
                  fontSize: "1.0125rem",
                  fontWeight: 400,
                  fontFamily: BODY,
                  display: "block",
                  marginTop: 4,
                  lineHeight: 1.45,
                  marginLeft: "auto",
                  marginRight: "auto",
                  maxWidth: 450,
                  color: titleDescColor,
                  opacity: introComplete ? 0.82 : intro.descOpacity,
                  transform: introComplete ? undefined : `translateY(${(1 - intro.descOpacity / 0.82) * 8}px)`,
                  transition: "color 1.1s ease",
                }}
              >
                {P.description}
              </span>
            </div>
          </div>

          {/* View mode + season controls, floating top-right */}
          <div
            style={{
            position: "absolute",
            top: 24,
            right: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            zIndex: 12,
            opacity: introComplete
              ? (isNight && !lanternOn ? 0.58 : 1)
              : intro.toggleOpacity * (isNight && !lanternOn ? 0.58 : 1),
            pointerEvents: introComplete || intro.toggleOpacity > 0.5 ? "auto" : "none",
            transform: introComplete ? "translateY(0)" : `translateY(${(1 - intro.toggleOpacity) * 10}px)`,
            filter: isNight && !lanternOn ? "brightness(0.88) saturate(0.85)" : "none",
            transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.85s ease, transform 0.85s cubic-bezier(0.22, 1, 0.36, 1), filter 0.45s ease"
          }}>
            <button
              type="button"
              onClick={() => setScene3D((v) => !v)}
              title={scene3D ? "Switch to 2D view" : "Switch to 3D view"}
              aria-label={scene3D ? "Switch to 2D view" : "Switch to 3D view"}
              aria-pressed={scene3D}
              style={{
                width: 48,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "0 10px",
                borderRadius: 999,
                cursor: "pointer",
                border: scene3D ? `1px solid ${P.accent}88` : `1px solid ${P.cloth}66`,
                background: scene3D ? `${P.accent}CC` : `${P.cloth}30`,
                color: scene3D ? P.cloth : P.ink,
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                boxShadow: scene3D
                  ? `0 2px 8px ${P.accent}33, inset 0 1px 1px ${P.cloth}66`
                  : `0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.08)`,
                fontFamily: MONO,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1.5,
                transition: "all 0.3s cubic-bezier(0.34, 1.4, 0.64, 1)",
              }}
            >
              <Box size={14} strokeWidth={2} />
              {scene3D ? "2D" : "3D"}
            </button>

          <div
            style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: 6,
            borderRadius: 999,
            background: `${P.cloth}30`,
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: `1px solid ${P.cloth}66`,
            boxShadow: `0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.08), inset 0 1px 1px ${P.cloth}b3, inset 0 -1px 1px ${P.ink}0D`,
          }}>
            {Object.keys(SEASONS).map((key) => {
              const SeasonIcon = SEASONS[key].icon;
              const active = currentSeasonKey === key;
              return (
                <button
                  key={key}
                  onClick={() => handleSeasonSelect(key)}
                  title={SEASONS[key].name}
                  aria-label={SEASONS[key].name}
                  style={{
                    width: 36,
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    cursor: "pointer",
                    border: active ? `1px solid ${P.cloth}88` : "1px solid transparent",
                    background: active ? `${P.accent}B3` : "transparent",
                    color: active ? P.cloth : P.ink,
                    boxShadow: active
                      ? `0 2px 8px ${P.accent}33, inset 0 1px 1px ${P.cloth}66`
                      : "none",
                    backdropFilter: active ? "blur(8px)" : "none",
                    WebkitBackdropFilter: active ? "blur(8px)" : "none",
                    transition: "all 0.3s cubic-bezier(0.34, 1.4, 0.64, 1)",
                    transform: active ? "scale(1.02)" : "scale(1)"
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = `${P.cloth}59`; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <SeasonIcon size={16} strokeWidth={1.9} />
                </button>
              );
            })}
          </div>
          </div>

          {scene3D && introComplete && (
            <div
              style={{
                position: "absolute",
                left: 24,
                bottom: 88,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 999,
                background: `${P.cloth}55`,
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: `1px solid ${P.cloth}88`,
                fontFamily: MONO,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1.8,
                color: `${P.ink}CC`,
                zIndex: 12,
                pointerEvents: "none",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M4 2v8M8 4v8M12 6v8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M2 12h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
              </svg>
              DRAG TO EXPLORE
            </div>
          )}
          {scene3D && introComplete && <PlayButton visible={scene3D && introComplete} />}
          {scene3D && introComplete && <AvatarSwitcher visible={scene3D && introComplete} />}
          {scene3D && introComplete && <CameraSwitcher visible={scene3D && introComplete} />}
          {scene3D && introComplete && <WelcomeCard />}
          {scene3D && introComplete && <ContextHint />}
          <RevealCard />
        </div>

        {/* Dynamic Clothes Creator Menu */}
        {isAdding && (
          <div style={{
            position: "absolute",
            top: 24,
            right: 32,
            bottom: 72,
            width: 320,
            background: P.cloth,
            borderRadius: 20,
            padding: 24,
            boxShadow: "0 15px 40px rgba(0,0,0,0.15)",
            border: `1.5px solid ${P.ink}20`,
            zIndex: 16,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards"
          }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: P.accent }}>DESIGN A NEW CONCEPT</span>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setAddError("");
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: P.ink }}
                >
                  <X size={18} />
                </button>
              </div>

              {addError && (
                <div style={{
                  background: `${P.accent}15`,
                  border: `1px solid ${P.accent}`,
                  color: P.accent,
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontFamily: MONO,
                  fontSize: 10,
                  lineHeight: 1.3,
                  marginBottom: 12
                }}>
                  {addError}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontFamily: DISPLAY, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Case / Project Title:</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${P.ink}30`,
                      background: P.cloth,
                      color: P.ink,
                      fontFamily: MONO,
                      fontSize: 12,
                      boxSizing: "border-box"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontFamily: DISPLAY, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Visual Silhouette Style:</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${P.ink}30`,
                      background: P.cloth,
                      color: P.ink,
                      fontFamily: MONO,
                      fontSize: 12,
                      boxSizing: "border-box"
                    }}
                  >
                    <option value="SHIRT">Linen Shirt Silhouette</option>
                    <option value="DRESS">Flowing Silhouette Dress</option>
                    <option value="SCARF">Streamlined Scarf</option>
                    <option value="TROUSERS">Wide-Cut Trousers</option>
                    <option value="TEE">Classic Fitted Tee</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontFamily: DISPLAY, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Primary Methodology:</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {Object.keys(DESIGN_SYSTEMS_INFO).map((fabricKey) => (
                      <button
                        key={fabricKey}
                        type="button"
                        onClick={() => setNewFabric(fabricKey)}
                        style={{
                          padding: "6px",
                          borderRadius: 8,
                          border: `1.5px solid ${newFabric === fabricKey ? P.accent : P.ink + '20'}`,
                          background: newFabric === fabricKey ? `${P.accent}10` : P.cloth,
                          color: P.ink,
                          fontFamily: MONO,
                          fontSize: 11,
                          cursor: "pointer"
                        }}
                      >
                        {fabricKey === "weave" && "SYSTEM"}
                        {fabricKey === "dots" && "MOTION"}
                        {fabricKey === "stripe" && "PLATFORM"}
                        {fabricKey === "plain" && "VISUAL"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontFamily: DISPLAY, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Brand Palette Hue:</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["#F6EEDD", "#F7E9D6", "#F4D9C2", "#EFE6D2", "#FFF9F2", "#E0ECF8", "#E6F3E6", "#FAEAEA"].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewHue(color)}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: color,
                          border: `2px solid ${newHue === color ? P.accent : P.ink + '15'}`,
                          cursor: "pointer",
                          transform: newHue === color ? "scale(1.15)" : "scale(1)",
                          transition: "all 0.2s ease"
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontFamily: DISPLAY, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Brief Summary Note:</label>
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${P.ink}30`,
                      background: P.cloth,
                      color: P.ink,
                      fontFamily: MONO,
                      fontSize: 11,
                      boxSizing: "border-box"
                    }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleAddPiece}
              style={{
                width: "100%",
                background: P.accent,
                color: P.cloth,
                border: "none",
                borderRadius: 10,
                padding: "10px",
                fontFamily: MONO,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                marginTop: 12
              }}
            >
              PIN CONVENTIONAL PROTOTYPE
            </button>
          </div>
        )}

        {/* Ground color in footer strip until nav fades in on top */}
        {!introComplete && footerProgress < 1 && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: FOOTER_HEIGHT,
              background: footerStripBg,
              zIndex: 15,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Navigation Footer — fades in over the ground; no slide */}
        <div
          style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: FOOTER_HEIGHT,
          boxSizing: "border-box",
          background: footerBg,
          padding: "0 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          zIndex: 20,
          borderTop: `1px solid ${nightFooterDim ? `${P.cloth}30` : nightFooterLit ? `${P.soft}50` : `${P.cloth}10`}`,
          boxShadow: nightFooterLit ? "inset 0 8px 28px rgba(251,191,36,0.18)" : "none",
          opacity: footerRevealOpacity,
          pointerEvents: introComplete || footerProgress > 0.55 ? "auto" : "none",
          filter: nightFooterDim ? "saturate(0.85)" : "none",
        }}>
          <span style={{
            fontFamily: MONO,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: 1.5,
            color: footerText,
            minWidth: 260,
            transition: "all 0.3s ease",
            display: "flex",
            alignItems: "center",
            gap: 8
          }}>
            {sel ? (
              <>
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: P.accent }} />
                <span>{sel.title} — {sel.note.toUpperCase()}</span>
              </>
            ) : (
              <>
                <span className="pulse-dot" style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: nightFooterLit ? P.accent : P.cloth, transition: "background 0.5s ease" }} />
                <span>{P.tagline}</span>
              </>
            )}
          </span>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {nav.map((n) => (
              <a key={n} href="#" onClick={(e) => { e.preventDefault(); handleEditorialNav(n === "CREATIVE WORK" ? "work" : n.toLowerCase()); }}
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 2,
                  color: footerNavColor,
                  textDecoration: "none",
                  borderBottom: "2px solid transparent",
                  paddingBottom: 3,
                  cursor: "pointer",
                  transition: "color 0.5s ease, border-color 0.2s ease"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = P.accent)}
                onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
              >{n}</a>
            ))}
          </div>
        </div>
      </div>

      {sockNoteOpen && (
        <div
          className="sock-note-scrim"
          onClick={() => setSockNoteOpen(false)}
          role="presentation"
        >
          <div
            className="sock-note-card"
            role="dialog"
            aria-modal="true"
            aria-label="A note from the sock"
            onClick={(e) => e.stopPropagation()}
            style={{
              fontFamily: BODY,
              color: P.ink,
              background: P.cloth,
              borderColor: `${P.ink}12`,
            }}
          >
            <button
              type="button"
              className="sock-note-close"
              onClick={() => setSockNoteOpen(false)}
              aria-label="Close note"
              style={{ color: P.ink }}
            >
              <X size={14} strokeWidth={2.25} aria-hidden />
            </button>
            <p className="sock-note-text" style={{ fontFamily: HEADER, color: P.ink }}>
              Thank you for coming.
            </p>
            <p className="sock-note-sign" style={{ fontFamily: MONO, color: `${P.ink}66` }}>
              — from the line
            </p>
          </div>
        </div>
      )}

      {(projectViewOpen || projectViewClosing) && projectFocusActive && growCardOrigin && (() => {
        const item = pieces[focusedIndex];
        if (!item) return null;
        const sheetBg = isNight && lanternOn ? "#F5F0E6" : P.cloth;
        const sheetInk = isNight && lanternOn ? "#1B2247" : P.ink;
        const sheetBodyInk = isNight && lanternOn ? "#1B2247CC" : `${P.ink}CC`;
        const seasonPalette = {
          sky1: P.sky1,
          sky2: P.sky2,
          sky3: P.sky3,
          sun: P.sun,
          hill1: P.hill1,
          hill2: P.hill2,
          hill3: P.hill3,
          isNight,
        };
        return (
          <div className="project-view-frame">
            <div
              className={`project-view-scrim${
                projectViewEntered ? " is-visible" : ""
              }${projectViewClosing ? " is-closing" : ""}`}
              style={{
                background: "rgba(0, 0, 0, 0.025)",
              }}
              aria-hidden
            />
            <div
              ref={projectViewSheetRef}
              className={`project-grow-card${
                projectViewEntered ? " is-expanded" : ""
              }${projectViewSettled ? " is-settled" : ""
              }${projectViewClosing ? " is-closing" : ""}`}
              style={{
                "--grow-from-top": `${growCardOrigin.top}px`,
                "--grow-from-left": `${growCardOrigin.left}px`,
                "--grow-from-width": `${growCardOrigin.width}px`,
                "--grow-from-height": `${growCardOrigin.height}px`,
                background: sheetBg,
                color: sheetInk,
                "--sheet-bg": sheetBg,
                "--cs-accent": P.accent,
              }}
              onClick={(e) => e.stopPropagation()}
              onTransitionEnd={handleProjectViewSheetTransitionEnd}
              role="dialog"
              aria-modal="true"
              aria-label={`${item.title} case study`}
            >
              <div className="project-grow-card-inner">
                <div className="project-grow-card-body">
                  <div className="project-grow-card-study">
                    <div
                      ref={studyScrollRef}
                      className="project-view-sheet-scroll"
                    >
                      <div className="project-grow-card-toolbar">
                        <button
                          type="button"
                          className="project-view-sheet-close project-grow-card-fold"
                          onClick={closeProjectView}
                          aria-label="Fold case study"
                          style={{ color: sheetInk, borderColor: `${sheetInk}14` }}
                        >
                          <span>Fold</span>
                          <X size={14} strokeWidth={2.25} aria-hidden />
                        </button>
                      </div>
                      <ProjectCaseStudySheetContent
                        key={item.id}
                        item={item}
                        ink={sheetInk}
                        bodyInk={sheetBodyInk}
                        accent={P.accent}
                        cloth={P.cloth}
                        clothTint={P.clothTint}
                        hue={item.hue}
                        meta={projectMeta(item)}
                        projectIndex={portfolioPieces.findIndex((p) => p.id === item.id)}
                        projects={portfolioPieces}
                        onNav={handleEditorialNav}
                        onProjectSelect={handleEditorialProjectSelect}
                        layoutId={projectLayoutId}
                        onLayoutChange={setProjectLayoutId}
                        season={seasonPalette}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}


      {/* CSS ANIMATIONS */}
      <style>{`
        .intro-active .sway-line.intro-rope-loading {
          animation: none !important;
        }
        .sock-rope-drop {
          animation: none !important;
        }
        .intro-role-fade-up {
          animation: introRoleFadeUp 1.1s cubic-bezier(0.22, 1, 0.36, 1) 0.9s both;
        }
        @keyframes introRoleFadeUp {
          from { opacity: 0; transform: translateY(10px); letter-spacing: 0.18em; }
          to   { opacity: 0.8; transform: translateY(0); letter-spacing: 0.16em; }
        }

        @keyframes unifiedSway {
          0%, 100% { transform: rotate(-5deg); }
          50%      { transform: rotate(5deg); }
        }
        @keyframes sway {
          0%, 100% { transform: rotate(-4deg) skewX(-2deg); }
          50%      { transform: rotate(4deg)  skewX(3deg); }
        }
        @keyframes flutter {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50%      { transform: translateY(-4px) rotate(1deg); }
        }
        @keyframes lineSway {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(5px); }
        }
        @keyframes blade {
          0%, 100% { transform: rotate(-5deg); }
          50%      { transform: rotate(5deg); }
        }
        @keyframes winterShiver {
          0%   { transform: translateX(0); }
          15%  { transform: translateX(-5px); }
          30%  { transform: translateX(5px); }
          45%  { transform: translateX(-4px); }
          60%  { transform: translateX(4px); }
          75%  { transform: translateX(-2px); }
          90%  { transform: translateX(2px); }
          100% { transform: translateX(0); }
        }
        .winter-shiver { animation: winterShiver 0.09s linear 5; }
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.25; }
          50%      { opacity: 1; }
        }
        .star-twinkle { animation: starTwinkle 3s ease-in-out infinite; }
        .star-0 { animation-duration: 2.4s; animation-delay: 0s; }
        .star-1 { animation-duration: 3.1s; animation-delay: -0.6s; }
        .star-2 { animation-duration: 2.8s; animation-delay: -1.2s; }
        .star-3 { animation-duration: 3.6s; animation-delay: -1.8s; }
        .star-4 { animation-duration: 2.6s; animation-delay: -2.4s; }
        .star-5 { animation-duration: 3.3s; animation-delay: -0.3s; }
        @keyframes lanternIgniteFlicker {
          0%   { opacity: 0.2; }
          14%  { opacity: 1; }
          28%  { opacity: 0.35; }
          42%  { opacity: 0.95; }
          56%  { opacity: 0.5; }
          70%  { opacity: 0.9; }
          84%  { opacity: 0.65; }
          100% { opacity: 1; }
        }
        .lantern-ignite-flicker {
          animation: lanternIgniteFlicker 0.18s steps(1) forwards;
        }
        @keyframes moonSparkle {
          0%, 100% { opacity: 0.3; }
          50%      { opacity: 1; }
        }
        .moon-sparkle { animation: moonSparkle 3.2s ease-in-out infinite; }
        .moon-sparkle-0 { animation-delay: 0s; }
        .moon-sparkle-1 { animation-delay: -0.8s; }
        .moon-sparkle-2 { animation-delay: -1.6s; }
        .moon-sparkle-3 { animation-delay: -2.4s; }
        @keyframes flock {
          from { transform: translate(-120px, 40px); }
          to   { transform: translate(1180px, -30px); }
        }
        @keyframes flap {
          0%, 100% { transform: scaleY(1); }
          50%      { transform: scaleY(0.65); }
        }
        @keyframes cloudFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .cloud-drift {
          opacity: 0;
        }
        .clouds-revealed .cloud-drift {
          animation: cloudFadeIn 2.4s ease-out forwards;
        }
        .clouds-revealed .cloud-drift-b {
          animation-delay: 0.35s;
        }
        .clouds-revealed .cloud-drift-c {
          animation-delay: 0.65s;
        }
        @media (prefers-reduced-motion: reduce) {
          .clouds-revealed .cloud-drift {
            animation: cloudFadeIn 0.4s ease-out forwards;
          }
          .clouds-revealed .cloud-drift-b { animation-delay: 0.08s; }
          .clouds-revealed .cloud-drift-c { animation-delay: 0.15s; }
        }

        @keyframes windParticle {
          from { transform: translateX(-200px); opacity: 0.1; }
          50%  { opacity: 0.5; }
          to   { transform: translateX(1200px); opacity: 0.0; }
        }

        @keyframes springPath0 { 0% { transform: translate(50px, -50px) rotate(0deg); opacity: 0; } 10% { opacity: 0.95; } 100% { transform: translate(500px, 600px) rotate(360deg); opacity: 0; } }
        @keyframes springPath1 { 0% { transform: translate(250px, -50px) rotate(0deg); opacity: 0; } 10% { opacity: 0.95; } 100% { transform: translate(700px, 600px) rotate(270deg); opacity: 0; } }
        @keyframes springPath2 { 0% { transform: translate(450px, -50px) rotate(0deg); opacity: 0; } 10% { opacity: 0.95; } 100% { transform: translate(900px, 600px) rotate(540deg); opacity: 0; } }
        @keyframes springPath3 { 0% { transform: translate(650px, -50px) rotate(0deg); opacity: 0; } 10% { opacity: 0.95; } 100% { transform: translate(1050px, 600px) rotate(180deg); opacity: 0; } }
        @keyframes springPath4 { 0% { transform: translate(850px, -50px) rotate(0deg); opacity: 0; } 10% { opacity: 0.95; } 100% { transform: translate(1150px, 600px) rotate(420deg); opacity: 0; } }

        @keyframes summerPath0 { 0% { transform: translate(100px, -50px) scale(0.8); opacity: 0; } 20% { opacity: 0.7; } 100% { transform: translate(400px, 600px) scale(1.2); opacity: 0; } }
        @keyframes summerPath1 { 0% { transform: translate(350px, -50px) scale(0.8); opacity: 0; } 20% { opacity: 0.7; } 100% { transform: translate(650px, 600px) scale(1.2); opacity: 0; } }
        @keyframes summerPath2 { 0% { transform: translate(600px, -50px) scale(0.8); opacity: 0; } 20% { opacity: 0.7; } 100% { transform: translate(900px, 600px) scale(1.2); opacity: 0; } }
        @keyframes summerPath3 { 0% { transform: translate(800px, -50px) scale(0.8); opacity: 0; } 20% { opacity: 0.7; } 100% { transform: translate(1100px, 600px) scale(1.2); opacity: 0; } }

        @keyframes autumnPath0 { 0% { transform: translate(50px, -50px) rotate(0deg); opacity: 0; } 15% { opacity: 0.95; } 100% { transform: translate(450px, 600px) rotate(720deg); opacity: 0; } }
        @keyframes autumnPath1 { 0% { transform: translate(250px, -50px) rotate(0deg); opacity: 0; } 15% { opacity: 0.95; } 100% { transform: translate(650px, 600px) rotate(540deg); opacity: 0; } }
        @keyframes autumnPath2 { 0% { transform: translate(450px, -50px) rotate(0deg); opacity: 0; } 15% { opacity: 0.95; } 100% { transform: translate(850px, 600px) rotate(900deg); opacity: 0; } }
        @keyframes autumnPath3 { 0% { transform: translate(650px, -50px) rotate(0deg); opacity: 0; } 15% { opacity: 0.95; } 100% { transform: translate(1050px, 600px) rotate(360deg); opacity: 0; } }
        @keyframes autumnPath4 { 0% { transform: translate(850px, -50px) rotate(0deg); opacity: 0; } 15% { opacity: 0.95; } 100% { transform: translate(1150px, 600px) rotate(640deg); opacity: 0; } }

        @keyframes winterDrift {
          0% { transform: translate(var(--sx, 0px), -50px); opacity: 1; }
          92% { opacity: 1; }
          100% { transform: translate(calc(var(--sx, 0px) + var(--drift-x, 200px)), 600px); opacity: 0; }
        }

        @keyframes birdFlyToRight {
          0%   { transform: translate(70px, 122px) scale(1, 1); }
          15%  { transform: translate(200px, -55px) scale(1, 1); }
          35%  { transform: translate(380px, 90px) scale(1, 1); }
          55%  { transform: translate(560px, -60px) scale(1, 1); }
          75%  { transform: translate(750px, 70px) scale(1, 1); }
          90%  { transform: translate(880px, -45px) scale(-1, 1); }
          100% { transform: translate(970px, 122px) scale(-1, 1); }
        }

        @keyframes birdFlyToLeft {
          0%   { transform: translate(970px, 122px) scale(-1, 1); }
          15%  { transform: translate(840px, -55px) scale(-1, 1); }
          35%  { transform: translate(660px, 90px) scale(-1, 1); }
          55%  { transform: translate(480px, -60px) scale(-1, 1); }
          75%  { transform: translate(290px, 70px) scale(-1, 1); }
          90%  { transform: translate(160px, -45px) scale(1, 1); }
          100% { transform: translate(70px, 122px) scale(1, 1); }
        }

        @keyframes birdFlyAwayRight {
          0%   { transform: translate(70px, 122px) scale(1, 1); opacity: 1; }
          45%  { transform: translate(580px, -115px) scale(1, 1); opacity: 1; }
          100% { transform: translate(1360px, -75px) scale(1, 1); opacity: 0; }
        }

        @keyframes birdFlyAwayLeft {
          0%   { transform: translate(970px, 122px) scale(-1, 1); opacity: 1; }
          45%  { transform: translate(460px, -115px) scale(-1, 1); opacity: 1; }
          100% { transform: translate(-160px, -75px) scale(-1, 1); opacity: 0; }
        }

        @keyframes soundExpand {
          0% { transform: scale(0.4); opacity: 1; }
          100% { transform: scale(1.8); opacity: 0; }
        }

        @keyframes slideIn {
          from { transform: translateX(50px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes tagSway {
          0%, 100% { transform: rotate(-0.9deg) translateY(0); }
          50%      { transform: rotate(0.9deg) translateY(-1px); }
        }
        @keyframes projectCardIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .sock-note-scrim {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(0, 0, 0, 0.18);
          animation: sockNoteIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .sock-note-card {
          position: relative;
          max-width: 320px;
          width: 100%;
          padding: 28px 32px 24px;
          border-radius: 18px;
          border: 1px solid transparent;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04);
          text-align: center;
          animation: sockCardIn 0.42s cubic-bezier(0.22, 1, 0.36, 1) 0.04s both;
        }
        .sock-note-close {
          position: absolute;
          top: 12px;
          right: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: none;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.04);
          cursor: pointer;
          transition: opacity 0.18s ease;
        }
        .sock-note-close:hover {
          opacity: 0.72;
        }
        .sock-note-text {
          margin: 0 0 12px;
          font-size: clamp(1.35rem, 3vw, 1.65rem);
          line-height: 1.35;
          font-weight: 400;
        }
        .sock-note-sign {
          margin: 0;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        @keyframes sockNoteIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes sockCardIn {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .garment-label {
          transition: opacity 0.2s ease;
        }
        .project-focus-card {
          transform: translate(-50%, 0);
          transition: left 0.62s cubic-bezier(0.22, 1, 0.36, 1), top 0.62s cubic-bezier(0.22, 1, 0.36, 1), width 0.35s ease, opacity 0.35s ease;
        }
        .project-focus-card--compact {
          transform: translate(-50%, -8px);
        }
        .project-focus-card--handoff-return {
          pointer-events: none;
          animation: focusCardReturnDrop 0.54s cubic-bezier(0.22, 1, 0.36, 1) 0.14s both;
        }
        .project-focus-card--handoff-return .project-focus-card-sway {
          animation: none;
        }
        .project-view-frame {
          position: fixed;
          inset: 0;
          z-index: 40;
          padding: 10px;
          box-sizing: border-box;
          pointer-events: none;
        }
        .project-grow-card {
          position: fixed;
          z-index: 2;
          isolation: isolate;
          -webkit-font-smoothing: subpixel-antialiased;
          top: var(--grow-from-top);
          left: var(--grow-from-left);
          width: var(--grow-from-width);
          height: var(--grow-from-height);
          border-radius: 16px;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.14), 0 2px 6px rgba(0, 0, 0, 0.08);
          overflow: hidden;
          pointer-events: auto;
          transform: none;
          opacity: 1;
          transition:
            top 0.58s cubic-bezier(0.22, 1, 0.36, 1),
            left 0.58s cubic-bezier(0.22, 1, 0.36, 1),
            width 0.58s cubic-bezier(0.22, 1, 0.36, 1),
            height 0.58s cubic-bezier(0.22, 1, 0.36, 1),
            transform 0.58s cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 0.45s ease;
        }
        .project-grow-card.is-expanded {
          top: 10px;
          left: 10px;
          width: calc(100vw - 20px);
          height: calc(100vh - 20px);
          transform: none;
          border-radius: 16px;
          box-shadow: 0 16px 56px rgba(0, 0, 0, 0.14), 0 0 0 1px rgba(0, 0, 0, 0.04);
        }
        .project-grow-card.is-expanded.is-settled {
          transition: box-shadow 0.3s ease;
        }
        .project-grow-card-inner {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
        }
        .project-grow-card-toolbar {
          position: sticky;
          top: 0;
          z-index: 6;
          display: flex;
          justify-content: flex-end;
          padding: 12px 20px 8px;
          margin-bottom: 0;
          background: transparent;
          pointer-events: none;
        }
        .project-grow-card-fold {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 14px 8px 12px;
          border-radius: 999px;
          border: 1px solid transparent;
          background: rgba(255, 255, 255, 0.88);
          cursor: pointer;
          font-family: ${MONO};
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.95px;
          text-transform: uppercase;
          white-space: nowrap;
          pointer-events: auto;
          opacity: 0;
          transition: opacity 0.28s ease 0.08s, background 0.2s ease, border-color 0.2s ease;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
        }
        .project-grow-card.is-expanded .project-grow-card-fold {
          opacity: 1;
        }
        .project-grow-card-fold:hover {
          opacity: 0.84;
        }
        .project-grow-card-body {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .project-grow-card-summary {
          margin: 0;
          padding: 0 16px 12px;
          font-size: 13px;
          line-height: 1.45;
          flex-shrink: 0;
          opacity: 1;
          max-height: 140px;
          overflow: hidden;
          transition:
            opacity 0.18s ease,
            max-height 0.24s ease,
            padding 0.2s ease;
        }
        /* Hide peek summary as soon as the card expands — editorial content replaces it */
        .project-grow-card.is-expanded .project-grow-card-summary {
          opacity: 0;
          max-height: 0;
          padding-top: 0;
          padding-bottom: 0;
          pointer-events: none;
        }
        .project-grow-card-study {
          flex: 0;
          max-height: 0;
          min-height: 0;
          overflow: hidden;
          opacity: 0;
          pointer-events: none;
        }
        .project-grow-card.is-expanded .project-grow-card-study {
          flex: 1;
          min-height: 0;
          max-height: none;
          display: flex;
          flex-direction: column;
          visibility: visible;
          pointer-events: auto;
          opacity: 1;
        }
        .project-grow-card.is-closing .project-grow-card-study {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: opacity 0.14s ease, visibility 0.14s ease;
        }
        .project-grow-card.is-closing .project-grow-card-summary {
          opacity: 1;
          max-height: 140px;
          padding: 0 16px 12px;
          transition:
            opacity 0.28s ease 0.06s,
            max-height 0.32s cubic-bezier(0.22, 1, 0.36, 1) 0.04s,
            padding 0.28s ease 0.04s;
        }
        .project-grow-card.is-closing {
          pointer-events: none;
          transition:
            top 0.01s linear,
            left 0.01s linear,
            width 0.01s linear,
            height 0.01s linear,
            transform 0.58s cubic-bezier(0.55, 0, 1, 0.42),
            opacity 0.36s ease 0.04s,
            box-shadow 0.3s ease;
        }
        .project-grow-card.is-closing.is-expanded {
          transform: translateY(72vh);
          opacity: 0;
        }
        .project-grow-card.is-closing .project-grow-card-fold {
          opacity: 0;
          transform: translateY(-6px);
          transition: opacity 0.14s ease, transform 0.16s ease;
        }
        @media (prefers-reduced-motion: reduce) {
          .project-grow-card,
          .project-grow-card-summary,
          .project-grow-card-study,
          .project-grow-card-fold,
          .project-view-sheet-scroll,
          .cs-scroll-reveal {
            animation: none !important;
            transition-duration: 0.01ms !important;
          }
          .cs-scroll-reveal {
            opacity: 1 !important;
            filter: none !important;
            animation: none !important;
          }
          .project-grow-card.is-expanded .project-grow-card-study {
            opacity: 1;
            visibility: visible;
          }
        }
        .project-view-scrim {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.46s ease;
        }
        .project-view-scrim.is-visible {
          opacity: 1;
          transition: opacity 0.4s ease 0.06s;
        }
        .project-view-scrim.is-closing {
          opacity: 0;
          transition: opacity 0.34s ease 0.04s;
        }
        .project-view-sheet-close {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 14px 8px 11px;
          border: none;
          border-radius: 999px;
          cursor: pointer;
          flex-shrink: 0;
          font-family: ${MONO};
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .project-view-sheet-close:hover {
          opacity: 0.88;
        }
        .project-view-sheet-close:active {
          transform: scale(0.98);
        }
        .project-view-sheet-scroll {
          flex: 1 1 auto;
          min-height: 0;
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 0 0 48px;
          -webkit-overflow-scrolling: touch;
          scroll-behavior: auto;
          overscroll-behavior: contain;
          filter: none;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
        }
        .project-view-sheet-scroll,
        .project-view-sheet-scroll * {
          filter: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        .layout-tab-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 0 0 28px;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.07);
        }
        .layout-tab {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid transparent;
          cursor: pointer;
          transition: opacity 0.18s ease, background 0.18s ease;
        }
        .layout-tab:hover { opacity: 0.82; }
        .layout-tab-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .layout-tab-credit {
          font-size: 9px;
          letter-spacing: 0.06em;
        }
        .project-page-wrap { width: 100%; min-height: 100%; }
        .project-layout--grid {
          width: 100%;
          margin: 0;
          padding: 0;
          min-height: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }
        .project-layout--grid .studio-topbar--light {
          padding: 8px 40px 24px;
          flex-shrink: 0;
        }
        .studio-topbar {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 20px;
          padding: 8px 0 32px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .studio-topbar--light {
          border-bottom-color: rgba(0, 0, 0, 0.07);
        }
        .studio-mark {
          border: none;
          background: none;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          cursor: pointer;
        }
        .studio-meta {
          margin: 0;
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          text-align: center;
        }
        .studio-nav { display: flex; gap: 18px; }
        .studio-nav button {
          border: none;
          background: none;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          cursor: pointer;
        }
        .studio-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 32px;
          padding: 40px 0;
        }
        .studio-col-label {
          margin: 0 0 20px;
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .studio-name {
          margin: 0 0 20px;
          font-size: clamp(2rem, 4vw, 2.75rem);
          line-height: 1;
        }
        .studio-bio p,
        .frame-bio p {
          margin: 0 0 1em;
          font-size: 15px;
          line-height: 1.65;
        }
        .studio-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 18px;
        }
        .studio-list li { display: grid; gap: 4px; }
        .studio-list span:first-child { font-size: 10px; letter-spacing: 0.08em; }
        .studio-marquee {
          overflow: hidden;
          padding: 28px 0 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .studio-marquee span {
          display: block;
          font-size: clamp(2.5rem, 6vw, 4.5rem);
          line-height: 1;
          letter-spacing: -0.03em;
          white-space: nowrap;
          animation: studioMarquee 18s linear infinite;
        }
        @keyframes studioMarquee {
          from { transform: translateX(0); }
          to { transform: translateX(-28%); }
        }
        .project-studio-split {
          display: grid;
          grid-template-columns: clamp(260px, 30vw, 360px) minmax(0, 1fr);
          gap: 0;
          flex: 1;
          align-items: stretch;
          min-height: calc(100vh - 200px);
        }
        .project-studio-rail {
          padding: 40px 32px 48px 40px;
          border-right: 1px solid;
          position: sticky;
          top: 0;
          align-self: stretch;
          min-height: 100%;
        }
        .project-studio-rail h1 {
          margin: 0 0 16px;
          font-size: clamp(1.75rem, 3vw, 2.25rem);
          line-height: 1.05;
        }
        .project-studio-rail > p {
          margin: 0 0 24px;
          font-size: 15px;
          line-height: 1.55;
        }
        .project-studio-meta {
          margin: 0 0 28px;
          display: grid;
          gap: 16px;
        }
        .project-studio-meta dt {
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .project-studio-meta dd { margin: 0; font-size: 14px; }
        .project-studio-main {
          background: #F3F3F1;
          padding: 40px 48px 80px;
          min-height: 100%;
        }
        .studio-body { width: 100%; max-width: none; }
        .studio-body .cs-visual { margin: 0 0 40px; max-width: none; }
        .studio-body .cs-visual-frame { border-radius: 10px; max-width: none; }
        .studio-section { margin-bottom: 48px; }
        .studio-section-num {
          display: block;
          margin-bottom: 8px;
          font-size: 10px;
          letter-spacing: 0.12em;
        }
        .studio-section-title {
          margin: 0 0 16px;
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .studio-section-body {
          margin: 0;
          font-size: 16px;
          line-height: 1.7;
          max-width: 68ch;
        }
        .studio-section-body--gap { margin-top: 24px; }
        .studio-quote {
          margin: 0;
          padding-left: 20px;
          border-left: 3px solid;
          font-size: clamp(1.35rem, 2.5vw, 1.85rem);
          line-height: 1.35;
          max-width: 48ch;
        }
        .studio-steps {
          list-style: none;
          margin: 20px 0 0;
          padding: 0;
          display: grid;
          gap: 0;
        }
        .studio-steps li {
          display: grid;
          grid-template-columns: 32px 1fr;
          gap: 12px;
          padding: 14px 0;
          border-top: 1px solid;
          font-size: 15px;
          line-height: 1.55;
        }
        .studio-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-top: 24px;
        }
        .studio-metric {
          padding: 20px;
          border: 1px solid;
          border-radius: 8px;
        }
        .studio-metric-value {
          font-size: clamp(1.5rem, 2.5vw, 2rem);
          line-height: 1;
        }
        .studio-metric-label {
          margin-top: 8px;
          font-size: 13px;
          line-height: 1.4;
        }
        .studio-project-num { font-size: 11px; letter-spacing: 0.1em; }
        .project-layout--chromatic {
          width: 100%;
          margin: 0;
          padding: 0 40px 64px;
          min-height: 100%;
          box-sizing: border-box;
        }
        .chromatic-topbar {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          padding: 12px 0 32px;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .chromatic-topbar button {
          border: none;
          background: none;
          cursor: pointer;
          justify-self: start;
        }
        .chromatic-topbar button:last-child { justify-self: end; }
        .chromatic-topbar span { justify-self: center; }
        .chromatic-hero h1,
        .project-chromatic-hero h1 {
          margin: 0 0 12px;
          font-size: clamp(2.5rem, 6vw, 4.5rem);
          line-height: 0.95;
          letter-spacing: -0.03em;
        }
        .chromatic-columns {
          display: grid;
          grid-template-columns: 1fr minmax(180px, 240px) 1fr;
          gap: 32px;
          padding-top: 24px;
        }
        .chromatic-columns h2 {
          margin: 0 0 20px;
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .chromatic-list,
        .chromatic-services {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 16px;
        }
        .chromatic-list li { display: grid; gap: 4px; }
        .chromatic-portrait-wrap { text-align: center; }
        .chromatic-portrait {
          aspect-ratio: 3 / 4;
          background: rgba(0, 0, 0, 0.12);
          border-radius: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 3rem;
          margin-bottom: 12px;
        }
        .project-chromatic-hero { padding-bottom: 24px; }
        .project-chromatic-meta {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 24px;
          padding-bottom: 28px;
        }
        .project-chromatic-meta div { display: grid; gap: 6px; }
        .project-chromatic-meta span:first-child {
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .project-chromatic-card {
          margin: 0 -48px;
          padding: 0 48px 64px;
          border-radius: 16px 16px 0 0;
        }
        .project-layout--frame {
          width: 100%;
          margin: 0;
          padding: 20px 40px;
          min-height: 100%;
          box-sizing: border-box;
        }
        .frame-card {
          border-radius: 24px;
          padding: 32px 40px 48px;
          min-height: calc(100vh - 120px);
        }
        .frame-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 40px;
        }
        .frame-display {
          font-size: clamp(3.5rem, 10vw, 6rem);
          line-height: 0.85;
          letter-spacing: -0.04em;
        }
        .frame-nav {
          display: flex;
          flex-direction: column;
          gap: 8px;
          text-align: right;
        }
        .frame-nav a {
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          text-decoration: none;
        }
        .frame-body {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(200px, 280px);
          gap: 40px;
          align-items: end;
        }
        .frame-kicker {
          margin: 0 0 16px;
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .frame-title {
          margin: 0 0 24px;
          font-size: clamp(1.75rem, 3.5vw, 2.5rem);
          line-height: 1.15;
        }
        .frame-portrait-ring {
          position: relative;
          display: flex;
          justify-content: center;
        }
        .frame-portrait {
          width: 200px;
          height: 200px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 3rem;
        }
        .frame-cta {
          position: absolute;
          top: 0;
          right: -8px;
          padding: 10px 14px;
          border-radius: 999px;
          font-size: 9px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .frame-project-head { margin-bottom: 24px; }
        .frame-project-num {
          display: block;
          margin-bottom: 10px;
          font-size: 11px;
          letter-spacing: 0.1em;
        }
        .frame-project-title {
          margin: 0 0 16px;
          font-size: clamp(2rem, 4.5vw, 3.25rem);
          line-height: 1.02;
        }
        .frame-project-lead {
          margin: 0;
          font-size: 1.05rem;
          line-height: 1.55;
        }
        .frame-project-meta {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 140px));
          gap: 24px;
          margin-bottom: 28px;
          padding-bottom: 24px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.07);
        }
        .frame-project-meta div { display: grid; gap: 6px; }
        .frame-project-meta span:first-child {
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .project-page-wrap--grid .layout-tab-bar {
          border-bottom-color: rgba(0, 0, 0, 0.07);
        }
        .page-overlay-sheet {
          position: fixed;
          z-index: 2;
          top: 10px;
          left: 10px;
          width: calc(100vw - 20px);
          height: calc(100vh - 20px);
          border-radius: 16px;
          box-shadow: 0 16px 56px rgba(0, 0, 0, 0.14), 0 0 0 1px rgba(0, 0, 0, 0.04);
          overflow: hidden;
          pointer-events: auto;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.42s cubic-bezier(0.22, 1, 0.36, 1), transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
          display: flex;
          flex-direction: column;
        }
        .page-overlay-sheet.is-entered {
          opacity: 1;
          transform: none;
        }
        .page-overlay-sheet.is-closing {
          opacity: 0;
          transform: translateY(12px);
          pointer-events: none;
          transition: opacity 0.32s ease, transform 0.34s ease;
        }
        .project-grow-card-fold.is-visible {
          opacity: 1;
        }
        .ed-chrome {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          gap: 16px;
          margin: 0 -48px;
          padding: 0 48px 24px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.07);
        }
        .ed-chrome-brand {
          justify-self: start;
          border: none;
          background: none;
          padding: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          cursor: pointer;
        }
        .ed-chrome-projects {
          justify-self: center;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .ed-chrome-projects-label {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.12em;
        }
        .ed-chrome-project-nums {
          display: flex;
          gap: 10px;
        }
        .ed-chrome-project-num {
          border: none;
          background: none;
          padding: 0;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.06em;
          cursor: pointer;
          opacity: 0.72;
          transition: opacity 0.18s ease;
        }
        .ed-chrome-project-num.is-active,
        .ed-chrome-project-num:hover {
          opacity: 1;
        }
        .ed-chrome-links {
          justify-self: end;
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .ed-chrome-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: none;
          background: none;
          padding: 0;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          cursor: pointer;
          transition: opacity 0.18s ease;
        }
        .ed-chrome-link-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .cs-editorial {
          display: grid;
          grid-template-columns: 56px minmax(0, 640px) 1fr;
          column-gap: 28px;
          align-items: start;
        }
        .cs-hero {
          grid-column: 2;
          padding: 8px 0 56px;
        }
        .cs-hero-band {
          grid-column: 1 / -1;
          margin: 0 -48px 0;
          padding: 32px 48px 40px;
        }
        .cs-hero-band-inner {
          display: grid;
          grid-template-columns: 56px minmax(0, 640px) 1fr;
          column-gap: 28px;
          max-width: 1120px;
          margin: 0 auto;
        }
        .cs-hero-band-content {
          grid-column: 2;
        }
        .cs-project-num {
          display: block;
          margin-bottom: 12px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          opacity: 0.72;
        }
        .cs-hero-kicker {
          margin: 16px 0 0;
          font-size: clamp(1rem, 1.8vw, 1.2rem);
          font-weight: 400;
          line-height: 1.55;
          opacity: 0.9;
        }
        .cs-hero-kicker em {
          font-style: italic;
        }
        .cs-hero-title {
          margin: 0;
          font-size: clamp(2.5rem, 6.5vw, 4.25rem);
          font-weight: 400;
          line-height: 0.98;
          letter-spacing: -0.03em;
          max-width: 14ch;
        }
        .cs-meta-row {
          grid-column: 1 / -1;
          margin: 0 -48px;
          padding: 24px 48px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.07);
        }
        .cs-meta-row-inner {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 180px));
          gap: 32px;
          max-width: 1120px;
          margin: 0 auto;
          padding-left: calc(56px + 28px);
        }
        .cs-meta-col {
          display: grid;
          gap: 6px;
        }
        .cs-meta-label {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .cs-meta-value {
          font-size: 14px;
          line-height: 1.45;
        }
        .cs-hero-after {
          grid-column: 1 / -1;
          margin: 0 -48px 48px;
          padding: 20px 48px 0;
          border-bottom: 1px solid rgba(0, 0, 0, 0.07);
        }
        .cs-hero-after-inner {
          display: grid;
          grid-template-columns: 56px minmax(0, 640px) 1fr;
          column-gap: 28px;
          max-width: 1120px;
          margin: 0 auto;
          padding: 0 0 20px;
        }
        .cs-chapter-nav {
          grid-column: 2;
          display: flex;
          flex-wrap: wrap;
          gap: 6px 28px;
        }
        .cs-chapter-link {
          display: inline-flex;
          align-items: baseline;
          gap: 7px;
          text-decoration: none;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          transition: opacity 0.18s ease;
        }
        .cs-chapter-link:hover {
          opacity: 0.72;
        }
        .cs-chapter-link:hover .cs-chapter-label {
          color: var(--cs-accent);
        }
        .cs-span-full {
          grid-column: 1 / -1;
        }
        .cs-section-pair {
          display: contents;
        }
        .cs-visual {
          grid-column: 1 / -1;
          margin: 0 0 72px;
        }
        .cs-visual--tall .cs-visual-frame {
          aspect-ratio: 16 / 9;
        }
        .cs-visual-frame {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 10;
          border-radius: 12px;
          overflow: hidden;
          background: #F0F0EE;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 12px 40px rgba(0, 0, 0, 0.06);
        }
        .cs-visual-frame .cs-mockup-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center top;
          display: block;
        }
        .cs-visual-caption {
          margin: 12px 0 0;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .cs-section-index {
          grid-column: 1;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          padding-top: 6px;
          position: sticky;
          top: 72px;
          align-self: start;
        }
        .cs-section-main {
          grid-column: 2;
          margin-bottom: 72px;
        }
        .cs-section-pair--quote .cs-section-main {
          padding: 40px 0;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        }
        .cs-section-title {
          margin: 0 0 20px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .cs-body {
          margin: 0;
          font-size: 17px;
          line-height: 1.72;
        }
        .cs-body--gap {
          margin-top: 28px;
        }
        .cs-steps {
          list-style: none;
          margin: 28px 0 0;
          padding: 0;
          display: grid;
          gap: 0;
        }
        .cs-step {
          display: grid;
          grid-template-columns: 40px 1fr;
          gap: 16px;
          padding: 20px 0;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
          font-size: 16px;
          line-height: 1.6;
        }
        .cs-step:last-child {
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        }
        .cs-step-num {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          padding-top: 3px;
        }
        .cs-pullquote-text {
          margin: 0;
          padding: 0 0 0 28px;
          border-left: 3px solid transparent;
          font-size: clamp(1.5rem, 3vw, 2.125rem);
          line-height: 1.38;
          font-weight: 400;
          letter-spacing: -0.015em;
        }
        .cs-wire-grid {
          display: grid;
          gap: 16px;
          margin: 28px 0;
        }
        .cs-wire-grid--lofi {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .cs-wire-frame {
          position: relative;
          background: #FFFFFF;
          border: 1px solid transparent;
          border-radius: 10px;
          padding: 14px;
          min-height: 140px;
        }
        .cs-wire-chrome {
          display: flex;
          gap: 5px;
          margin-bottom: 12px;
        }
        .cs-wire-chrome span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }
        .cs-wire-body {
          display: grid;
          gap: 8px;
        }
        .cs-wire-line {
          height: 6px;
          border-radius: 3px;
        }
        .cs-wire-block {
          height: 48px;
          border-radius: 6px;
        }
        .cs-wire-tag {
          position: absolute;
          right: 10px;
          bottom: 8px;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .cs-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1px;
          margin-top: 36px;
          background: rgba(0, 0, 0, 0.06);
          border-radius: 12px;
          overflow: hidden;
        }
        .cs-metric {
          padding: 28px 20px;
          background: #FAFAF8;
          text-align: left;
        }
        .cs-metric-value {
          font-size: clamp(1.75rem, 3vw, 2.25rem);
          line-height: 1.1;
          margin-bottom: 8px;
          letter-spacing: -0.02em;
        }
        .cs-metric-label {
          font-size: 13px;
          line-height: 1.45;
          opacity: 0.72;
        }
        @media (max-width: 768px) {
          .case-study-sheet-content,
          .project-grow-card-toolbar {
            padding-left: 20px;
            padding-right: 20px;
          }
          .case-study-sheet-content {
            padding-bottom: 64px;
          }
          .cs-editorial {
            grid-template-columns: 1fr;
          }
          .cs-hero,
          .cs-section-index,
          .cs-section-main {
            grid-column: 1;
          }
          .cs-section-index {
            position: static;
            margin-bottom: 8px;
          }
          .cs-hero-band {
            margin-left: -20px;
            margin-right: -20px;
            padding-left: 20px;
            padding-right: 20px;
          }
          .cs-hero-after {
            margin-left: -20px;
            margin-right: -20px;
            padding-left: 20px;
            padding-right: 20px;
          }
          .cs-hero-band-inner,
          .cs-hero-after-inner {
            grid-template-columns: 1fr;
          }
          .cs-hero-band-content,
          .cs-hero-lead,
          .cs-chapter-nav {
            grid-column: 1;
          }
          .cs-hero-title {
            max-width: none;
          }
          .ed-chrome {
            grid-template-columns: 1fr;
            margin-left: -20px;
            margin-right: -20px;
            padding-left: 20px;
            padding-right: 20px;
            gap: 16px;
          }
          .ed-chrome-brand,
          .ed-chrome-projects,
          .ed-chrome-links {
            justify-self: start;
          }
          .ed-chrome-project-nums {
            flex-wrap: wrap;
          }
          .layout-tab-bar--inset {
            padding-left: 20px;
            padding-right: 20px;
          }
          .project-layout--editorial,
          .spread-project-bar,
          .spread-band--text,
          .spread-band--quote,
          .spread-band--stats,
          .project-layout--frame {
            padding-left: 20px;
            padding-right: 20px;
          }
          .project-layout--grid .studio-topbar--light {
            padding-left: 20px;
            padding-right: 20px;
          }
          .project-studio-rail {
            padding-left: 20px;
          }
          .project-studio-main {
            padding: 32px 20px 64px;
          }
          .studio-grid,
          .chromatic-columns,
          .project-chromatic-meta {
            grid-template-columns: 1fr;
          }
          .project-studio-split,
          .frame-body,
          .ed-spread-main,
          .ed-spread-timeline,
          .ed-spread-project-body,
          .frame-stage-intro,
          .frame-bubble-row,
          .frame-bento,
          .frame-study-cards {
            grid-template-columns: 1fr;
          }
          .frame-tile--span2 { grid-column: span 1; }
          .chrom-immersion-name-line2 { margin-left: 0; }
          .chrom-stats { grid-template-columns: 1fr; }
          .project-studio-rail {
            position: static;
            border-right: none;
            border-bottom: 1px solid;
            padding-right: 0;
          }
          .magazine-row {
            grid-template-columns: 1fr;
          }
          .studio-metrics,
          .spread-stats,
          .magazine-stats {
            grid-template-columns: 1fr;
          }
          .project-chromatic-card {
            margin: 0 -20px;
            padding: 0 20px 48px;
          }
          .cs-meta-row {
            margin-left: -20px;
            margin-right: -20px;
            padding-left: 20px;
            padding-right: 20px;
          }
          .cs-meta-row-inner {
            grid-template-columns: 1fr;
            padding-left: 0;
            gap: 20px;
          }
          .cs-wire-grid--lofi {
            grid-template-columns: 1fr;
          }
          .cs-metrics {
            grid-template-columns: 1fr;
          }
          .cs-nav {
            gap: 6px;
          }
        }
        @keyframes focusCardReturnDrop {
          from { opacity: 0; transform: translate(-50%, 14px) scale(0.95); }
          to { opacity: 1; transform: translate(-50%, -8px) scale(1); }
        }
        .project-focus-card-sway {
          transform-origin: top center;
          animation: tagSway var(--tag-sway-duration, 5s) ease-in-out infinite;
          animation-delay: var(--tag-sway-delay, 0s);
        }
        .project-focus-card-inner {
          border-radius: 16px;
          padding: 13px 16px 10px;
          position: relative;
          animation: projectCardIn 0.52s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .project-focus-card--compact .project-focus-card-inner {
          padding: 13px 16px 10px;
        }
        .project-focus-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          outline: none;
          -webkit-appearance: none;
          appearance: none;
          border-radius: 999px;
          font-weight: 600;
          letter-spacing: 0.6px;
          text-decoration: none;
          cursor: pointer;
          transition: opacity 0.15s ease;
        }
        .project-focus-btn-primary {
          box-shadow: none;
        }
        .project-focus-btn-primary:focus,
        .project-focus-btn-primary:focus-visible {
          outline: none;
          box-shadow: none;
        }
        .project-focus-btn-primary:hover {
          opacity: 0.88;
        }
        .project-focus-btn:active {
          opacity: 0.82;
        }
        .project-focus-close {
          width: 30px;
          height: 30px;
          padding: 0;
          flex-shrink: 0;
          border: none;
        }
        .project-focus-close:hover {
          opacity: 0.82;
        }
        .project-focus-btn-secondary {
          border: none;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        @keyframes popIn {
          0% { transform: scale(0) rotate(-15deg); opacity: 0; }
          70% { transform: scale(1.2) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes leafRustle {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; }
        }
        @keyframes snowSplashAnim {
          0% { transform: translate(0, 0); opacity: 1; }
          100% { transform: translate(var(--vx), var(--vy)); opacity: 0; }
        }
        @keyframes birdSnowDrop {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          70% { opacity: 0.85; }
          100% { transform: translate(var(--vx), var(--vy)) scale(0.55); opacity: 0; }
        }
        @keyframes birdHeadSnowLand {
          0% {
            transform: translate(calc(var(--land-x) + var(--land-drift)), calc(var(--land-y) - 38px)) rotate(var(--land-rot)) scale(calc(var(--land-scale) * 0.65));
            opacity: 0;
          }
          12% { opacity: 0.9; }
          78% {
            transform: translate(var(--land-x), calc(var(--land-y) + 2px)) rotate(var(--land-rot)) scale(calc(var(--land-scale) * 1.06));
            opacity: 1;
          }
          100% {
            transform: translate(var(--land-x), var(--land-y)) rotate(var(--land-rot)) scale(var(--land-scale));
            opacity: 1;
          }
        }
        @keyframes fireflyFlight {
          0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
          5% { transform: translate(-2px, -2px) scale(1); opacity: 1; }
          20% { transform: translate(calc(var(--dx) * 0.22 * 1px + var(--w1) * 1px), calc(var(--dy) * 0.1 * 1px)) scale(1); opacity: 1; }
          36% { transform: translate(calc(var(--dx) * 0.44 * 1px - var(--w2) * 0.5px), calc(var(--dy) * 0.26 * 1px)) scale(1); opacity: 1; }
          52% { transform: translate(calc(var(--dx) * 0.6 * 1px + var(--w1) * 0.6px), calc(var(--dy) * 0.44 * 1px)) scale(0.98); opacity: 1; }
          66% { transform: translate(calc(var(--dx) * 0.74 * 1px - var(--w2) * 0.4px), calc(var(--dy) * 0.6 * 1px)) scale(0.95); opacity: 0.92; }
          80% { transform: translate(calc(var(--dx) * 0.88 * 1px), calc(var(--dy) * 0.78 * 1px)) scale(0.88); opacity: 0.6; }
          100% { transform: translate(calc(var(--dx) * 1px), calc(var(--dy) * 1px)) scale(0.65); opacity: 0; }
        }
        @keyframes fireflyBlink {
          0%, 38%, 100% { opacity: 0.18; }
          44%, 50% { opacity: 1; }
          54% { opacity: 0.3; }
          58% { opacity: 0.95; }
          72%, 88% { opacity: 0.22; }
          80% { opacity: 0.88; }
        }

        .pulse-dot {
          animation: pulse 2s infinite ease-in-out;
        }
        .flock-a { animation: flock 28s linear infinite; }
        .flock-a path { animation: flap 0.85s ease-in-out infinite; transform-origin: center; }

        @keyframes meteorFly {
          0%   { transform: translate(0, 0); opacity: 0; }
          12%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)); opacity: 0; }
        }
        .meteor { animation: meteorFly 1.3s ease-in forwards; }

        .drifting-sakura-container.particle-spring-0 { animation: springPath0 11s linear infinite; }
        .drifting-sakura-container.particle-spring-1 { animation: springPath1 12s linear infinite; animation-delay: -1.5s; }
        .drifting-sakura-container.particle-spring-2 { animation: springPath2 10s linear infinite; animation-delay: -3.2s; }
        .drifting-sakura-container.particle-spring-3 { animation: springPath3 13s linear infinite; animation-delay: -4.8s; }
        .drifting-sakura-container.particle-spring-4 { animation: springPath4 11s linear infinite; animation-delay: -6.4s; }
        .drifting-sakura-container.particle-spring-5 { animation: springPath0 12s linear infinite; animation-delay: -8s; }
        .drifting-sakura-container.particle-spring-6 { animation: springPath2 11s linear infinite; animation-delay: -9.5s; }
        .drifting-sakura-container.particle-spring-7 { animation: springPath1 13s linear infinite; animation-delay: -11s; }
        .drifting-sakura-container.particle-spring-8 { animation: springPath3 10s linear infinite; animation-delay: -2s; }
        .drifting-sakura-container.particle-spring-9 { animation: springPath4 12s linear infinite; animation-delay: -5s; }
        .drifting-sakura-container.particle-spring-10 { animation: springPath0 11s linear infinite; animation-delay: -7.5s; }
        .drifting-sakura-container.particle-spring-11 { animation: springPath1 13s linear infinite; animation-delay: -3s; }
        .drifting-sakura-container.particle-spring-12 { animation: springPath2 10s linear infinite; animation-delay: -9s; }
        .drifting-sakura-container.particle-spring-13 { animation: springPath3 12s linear infinite; animation-delay: -6s; }

        .drifting-heat-container.particle-summer-0 { animation: summerPath0 10s linear infinite; }
        .drifting-heat-container.particle-summer-1 { animation: summerPath1 11s linear infinite; animation-delay: -2s; }
        .drifting-heat-container.particle-summer-2 { animation: summerPath2 9s linear infinite; animation-delay: -4s; }
        .drifting-heat-container.particle-summer-3 { animation: summerPath3 12s linear infinite; animation-delay: -6s; }
        .drifting-heat-container.particle-summer-4 { animation: summerPath0 10s linear infinite; animation-delay: -8s; }
        .drifting-heat-container.particle-summer-5 { animation: summerPath1 11s linear infinite; animation-delay: -1.2s; }
        .drifting-heat-container.particle-summer-6 { animation: summerPath2 9s linear infinite; animation-delay: -3.4s; }
        .drifting-heat-container.particle-summer-7 { animation: summerPath3 12s linear infinite; animation-delay: -5.6s; }
        .drifting-heat-container.particle-summer-8 { animation: summerPath0 10s linear infinite; animation-delay: -7.8s; }
        .drifting-heat-container.particle-summer-9 { animation: summerPath1 11s linear infinite; animation-delay: -2.2s; }
        .drifting-heat-container.particle-summer-10 { animation: summerPath2 9s linear infinite; animation-delay: -4.4s; }
        .drifting-heat-container.particle-summer-11 { animation: summerPath3 12s linear infinite; animation-delay: -6.6s; }
        .drifting-heat-container.particle-summer-12 { animation: summerPath0 10s linear infinite; animation-delay: -8.8s; }
        .drifting-heat-container.particle-summer-13 { animation: summerPath1 11s linear infinite; animation-delay: -1.5s; }

        .drifting-leaf-container.particle-autumn-0 { animation: autumnPath0 13s linear infinite; }
        .drifting-leaf-container.particle-autumn-1 { animation: autumnPath1 14s linear infinite; animation-delay: -2s; }
        .drifting-leaf-container.particle-autumn-2 { animation: autumnPath2 12s linear infinite; animation-delay: -4s; }
        .drifting-leaf-container.particle-autumn-3 { animation: autumnPath3 15s linear infinite; animation-delay: -6s; }
        .drifting-leaf-container.particle-autumn-4 { animation: autumnPath4 13s linear infinite; animation-delay: -8s; }
        .drifting-leaf-container.particle-autumn-5 { animation: autumnPath0 14s linear infinite; animation-delay: -10s; }
        .drifting-leaf-container.particle-autumn-6 { animation: autumnPath2 12s linear infinite; animation-delay: -12s; }
        .drifting-leaf-container.particle-autumn-7 { animation: autumnPath1 15s linear infinite; animation-delay: -14s; }
        .drifting-leaf-container.particle-autumn-8 { animation: autumnPath3 13s linear infinite; animation-delay: -1s; }
        .drifting-leaf-container.particle-autumn-9 { animation: autumnPath4 14s linear infinite; animation-delay: -5s; }
        .drifting-leaf-container.particle-autumn-10 { animation: autumnPath0 12s linear infinite; animation-delay: -7s; }
        .drifting-leaf-container.particle-autumn-11 { animation: autumnPath1 15s linear infinite; animation-delay: -3s; }
        .drifting-leaf-container.particle-autumn-12 { animation: autumnPath2 13s linear infinite; animation-delay: -9s; }
        .drifting-leaf-container.particle-autumn-13 { animation: autumnPath3 14s linear infinite; animation-delay: -11s; }

        .drifting-snow-container {
          animation: winterDrift linear infinite;
        }

        .intro-bird-flight-left {
          animation: birdFlyToLeft 1.8s cubic-bezier(0.25, 1, 0.5, 1) -450ms both;
        }
        .scared-bird-flight-right {
          animation: birdFlyToRight 1.8s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        .scared-bird-flight-left {
          animation: birdFlyToLeft 1.8s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        .bird-fly-away-right {
          animation: birdFlyAwayRight 1s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        .bird-fly-away-left {
          animation: birdFlyAwayLeft 1s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }

        .chime-clang {
          animation: unifiedSway 1.1s ease-in-out infinite !important;
        }
        .sound-ring {
          transform-origin: 48px 174px;
          animation: soundExpand 0.8s ease-out forwards;
        }

        .poppy-bloom {
          animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          transform-origin: 0px 25px;
        }
        .sunflower-bloom {
          animation: sunflowerPop 1.1s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          transform-origin: 0px 25px;
        }
        .sunflower-head {
          animation: sunflowerSway 5s ease-in-out 1.1s infinite;
          transform-origin: 0 -38px;
        }
        @keyframes sunflowerPop {
          0% { transform: scale(0) rotate(-12deg); opacity: 0; }
          50% { transform: scale(1.12) rotate(4deg); opacity: 1; }
          75% { transform: scale(0.97) rotate(-1deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes sunflowerSway {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(2deg); }
        }
        .sand-ripple {
          animation: leafRustle 1.8s ease-out forwards;
        }
        .snow-splash {
          animation: snowSplashAnim 1.2s ease-out forwards;
        }
        .bird-snow-drop {
          animation: birdSnowDrop 1.15s cubic-bezier(0.45, 0.05, 0.55, 0.95) forwards;
        }
        .bird-head-snowflake-land {
          transform-box: fill-box;
          transform-origin: center;
          opacity: 0;
          animation: birdHeadSnowLand 1.05s cubic-bezier(0.33, 1, 0.42, 1) forwards;
        }
        .hill-firefly-flight {
          animation-name: fireflyFlight;
          animation-duration: var(--flight-ms, 5.5s);
          animation-timing-function: cubic-bezier(0.42, 0.02, 0.48, 1);
          animation-fill-mode: forwards;
          transform-origin: 0 0;
          transform-box: fill-box;
        }
        .hill-firefly-glow {
          animation: fireflyBlink var(--blink-ms, 1.05s) ease-in-out infinite;
          animation-delay: var(--blink-delay, 0s);
        }

        .cloth-body {
          animation: sway var(--wind-speed, 4.2s) ease-in-out infinite;
        }
        .piece-wrapper {
          /* flutter lives on .piece-flutter; spread motion on .piece-spread-offset */
        }
        .piece-flutter {
          animation: flutter 5s ease-in-out infinite;
        }
        .piece-spread-offset {
          transform: translateX(var(--focus-x, 0px));
        }
        .piece-wrapper.scene-interactive .piece-spread-offset {
          transition: transform var(--focus-transition, 620ms) cubic-bezier(0.22, 1, 0.36, 1) var(--focus-delay, 0ms);
        }
        .piece-spread-offset--anchor {
          transition: none !important;
        }
        .sway-line { animation: lineSway 4.8s ease-in-out infinite; transform-origin: center; }
        .blade { animation: blade 3.6s ease-in-out infinite; }
        .action-btn:hover {
          transform: scale(1.02);
        }

        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${P.accent};
          cursor: pointer;
          transition: transform 0.1s ease;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.3);
        }
      `}</style>
    </div>
  );
}

function blendHex(a, b, t) {
  const pa = a.replace("#", "");
  const pb = b.replace("#", "");
  const ar = parseInt(pa.slice(0, 2), 16);
  const ag = parseInt(pa.slice(2, 4), 16);
  const ab = parseInt(pa.slice(4, 6), 16);
  const br = parseInt(pb.slice(0, 2), 16);
  const bg = parseInt(pb.slice(2, 4), 16);
  const bb = parseInt(pb.slice(4, 6), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function sockShape(x, y, on, P) {
  const body = on ? blendHex("#FCF6EA", P.accent, 0.04) : "#FCF6EA";
  const cuff = on ? blendHex("#EFE9DD", P.accent, 0.04) : "#EFE9DD";
  const rib = "#3A2A22";
  const heart = "#D65B3E";

  return (
    <g transform={`translate(${x - 60}, ${y - 14})`} stroke="none">
      <path
        d="M51 36
          L51 72
          Q51 88 42 94
          Q30 102 29 115
          Q29 127 41 128
          Q54 128 60 117
          Q68 103 68 85
          L68 36 Z"
        fill={body}
      />
      <rect x="49" y="26" width="21" height="12" rx="4" fill={cuff} />
      <line x1="54" y1="29" x2="54" y2="35" stroke={rib} strokeWidth="1" opacity="0.18" />
      <line x1="61" y1="29" x2="61" y2="35" stroke={rib} strokeWidth="1" opacity="0.18" />
      <text x="59" y="72" fontSize="12" textAnchor="middle" fill={heart}>
        ♥
      </text>
    </g>
  );
}

const getClothType = (pc, creatorType) => {
  if (creatorType && pc.id > 4) {
    return creatorType;
  }
  const title = pc.title.toUpperCase();
  if (title.includes("SAFETY") || title.includes("TEE")) return "TEE";
  if (title.includes("MATCHMAKING") || title.includes("DRESS")) return "DRESS";
  if (title.includes("OPENCLOUD") || title.includes("SCARF")) return "SCARF";
  if (title.includes("MATHWORKS") || title.includes("TROUSERS")) return "TROUSERS";
  if (title.includes("ZORRO") || title.includes("SHIRT")) return "SHIRT";
  return "TEE";
};

function clothShape(pc, x, y, on, P, creatorType, currentSeasonKey, lampWarmth = 0, focusLighten = false) {
  const stroke = on ? P.accent : P.ink;
  const tinted = P.clothTint ? blendHex(pc.hue, P.clothTint, 0.3) : pc.hue;
  let fill = on ? blendHex(tinted, P.accent, 0.18) : tinted;
  if (focusLighten) {
    fill = blendHex(fill, P.clothTint || P.cloth, FOCUS_MODE.clothLighten);
  }
  if (lampWarmth > 0) {
    fill = blendHex(fill, "#FFE9A8", 0.1 + lampWarmth * 0.3);
    fill = blendHex(fill, "#FFFDF5", lampWarmth * 0.14);
  }
  const fabricFill =
    pc.fabric === "weave" ? "url(#weave)" :
    pc.fabric === "dots" ? "url(#dots)" :
    pc.fabric === "stripe" ? "url(#stripe)" : "none";

  const typeKey = getClothType(pc, creatorType);
  const winterFrostStyle = currentSeasonKey === "winter" ? { filter: "drop-shadow(0 0 4px #FFFFFF)" } : {};

  return (
    <g style={winterFrostStyle}>

      {typeKey === "DRESS" && (
        <g stroke="none" strokeLinejoin="round" strokeLinecap="round" style={{ transition: "stroke 0.4s ease" }}>
          <path d={`M${x - 20} ${y}
            L${x - 26} ${y + 40}
            L${x - 26} ${y + 150}
            L${x - 12} ${y + 150} L${x - 12} ${y + 132}
            L${x + 12} ${y + 132} L${x + 12} ${y + 150}
            L${x + 26} ${y + 150}
            L${x + 26} ${y + 40}
            L${x + 20} ${y}
            Q${x} ${y + 12}, ${x - 20} ${y} Z`} fill={fill} style={{ transition: "fill 0.4s ease" }} />
          <path d={`M${x - 20} ${y}
            L${x - 26} ${y + 40}
            L${x - 26} ${y + 150}
            L${x - 12} ${y + 150} L${x - 12} ${y + 132}
            L${x + 12} ${y + 132} L${x + 12} ${y + 150}
            L${x + 26} ${y + 150}
            L${x + 26} ${y + 40}
            L${x + 20} ${y}
            Q${x} ${y + 12}, ${x - 20} ${y} Z`} fill={fabricFill} stroke="none" />
          <path d={`M${x - 7} ${y + 4} L${x} ${y + 48} L${x + 7} ${y + 4}`} fill="none" stroke={stroke} strokeWidth="1.4" />
          <g fill={P.accent} opacity="0.7">
            <circle cx={x} cy={y + 14} r="1.3" />
            <circle cx={x} cy={y + 26} r="1.3" />
          </g>
          <path d={`M${x - 26} ${y + 144} L${x - 12} ${y + 144} M${x + 12} ${y + 144} L${x + 26} ${y + 144}`} stroke={P.accent} strokeWidth="3" fill="none" opacity="0.7" />
          <g fill="none" stroke={P.accent} strokeWidth="1" opacity="0.55">
            <path d={`M${x - 21} ${y + 128} q6 -4 2 4 q-2 4 -4 1 q-2 -2 2 -5`} />
            <path d={`M${x + 17} ${y + 128} q6 -4 2 4 q-2 4 -4 1 q-2 -2 2 -5`} />
          </g>
          {currentSeasonKey === "winter" && (
            <g fill="#FFFFFF" stroke={stroke} strokeWidth="1" opacity="0.9">
              <polygon points={`${x - 21},${y + 150} ${x - 19},${y + 163} ${x - 17},${y + 150}`} />
              <polygon points={`${x + 17},${y + 150} ${x + 19},${y + 165} ${x + 21},${y + 150}`} />
            </g>
          )}
        </g>
      )}

      {typeKey === "SCARF" && (
        <g stroke="none" strokeLinejoin="round" strokeLinecap="round" style={{ transition: "stroke 0.4s ease" }}>
          <path d={`M${x - 28} ${y}
            C${x - 36} ${y + 75}, ${x - 30} ${y + 118}, ${x - 34} ${y + 162}
            Q${x - 22} ${y + 171}, ${x - 10} ${y + 163}
            C${x - 8} ${y + 118}, ${x - 10} ${y + 75}, ${x - 4} ${y + 5} Z`} fill={fill} style={{ transition: "fill 0.4s ease" }} />
          <path d={`M${x - 28} ${y}
            C${x - 36} ${y + 75}, ${x - 30} ${y + 118}, ${x - 34} ${y + 162}
            Q${x - 22} ${y + 171}, ${x - 10} ${y + 163}
            C${x - 8} ${y + 118}, ${x - 10} ${y + 75}, ${x - 4} ${y + 5} Z`} fill={fabricFill} stroke="none" />
          <path d={`M${x + 4} ${y + 5}
            C${x + 10} ${y + 70}, ${x + 8} ${y + 108}, ${x + 10} ${y + 150}
            Q${x + 22} ${y + 158}, ${x + 34} ${y + 148}
            C${x + 30} ${y + 108}, ${x + 36} ${y + 70}, ${x + 28} ${y} Z`} fill={fill} style={{ transition: "fill 0.4s ease" }} />
          <path d={`M${x + 4} ${y + 5}
            C${x + 10} ${y + 70}, ${x + 8} ${y + 108}, ${x + 10} ${y + 150}
            Q${x + 22} ${y + 158}, ${x + 34} ${y + 148}
            C${x + 30} ${y + 108}, ${x + 36} ${y + 70}, ${x + 28} ${y} Z`} fill={fabricFill} stroke="none" />
          <path d={`M${x - 34} ${y + 156} Q${x - 22} ${y + 167}, ${x - 10} ${y + 157}`} stroke={P.accent} strokeWidth="3.5" fill="none" opacity="0.8" />
          <path d={`M${x + 10} ${y + 142} Q${x + 22} ${y + 153}, ${x + 34} ${y + 141}`} stroke={P.accent} strokeWidth="3.5" fill="none" opacity="0.8" />
          <path d={`M${x - 31} ${y + 10} C${x - 39} ${y + 80}, ${x - 33} ${y + 120}, ${x - 37} ${y + 158}`} stroke={P.accent} strokeWidth="1.4" fill="none" opacity="0.5" />
          <path d={`M${x + 31} ${y + 10} C${x + 39} ${y + 80}, ${x + 33} ${y + 112}, ${x + 37} ${y + 146}`} stroke={P.accent} strokeWidth="1.4" fill="none" opacity="0.5" />
          <g stroke={P.accent} strokeWidth="0.7" fill="none" opacity="0.28">
            <path d={`M${x - 24} ${y + 16} C${x - 22} ${y + 60}, ${x - 26} ${y + 110}, ${x - 25} ${y + 160}`} />
            <path d={`M${x - 16} ${y + 14} C${x - 14} ${y + 60}, ${x - 18} ${y + 110}, ${x - 17} ${y + 161}`} />
            <path d={`M${x + 24} ${y + 16} C${x + 22} ${y + 55}, ${x + 26} ${y + 100}, ${x + 25} ${y + 148}`} />
            <path d={`M${x + 16} ${y + 14} C${x + 14} ${y + 55}, ${x + 18} ${y + 100}, ${x + 17} ${y + 148}`} />
          </g>
          <g stroke={P.accent} strokeWidth="1" opacity="0.7">
            <path d={`M${x - 30} ${y + 161} l-1 7`} />
            <path d={`M${x - 22} ${y + 166} l0 7`} />
            <path d={`M${x - 14} ${y + 162} l1 7`} />
            <path d={`M${x + 14} ${y + 149} l-1 7`} />
            <path d={`M${x + 22} ${y + 154} l0 7`} />
            <path d={`M${x + 30} ${y + 149} l1 7`} />
          </g>
          {currentSeasonKey === "winter" && (
            <g fill="#FFFFFF" stroke={stroke} strokeWidth="1" opacity="0.9">
              <polygon points={`${x - 26},${y + 161} ${x - 24},${y + 173} ${x - 22},${y + 161}`} />
              <polygon points={`${x + 22},${y + 148} ${x + 24},${y + 160} ${x + 26},${y + 148}`} />
            </g>
          )}
        </g>
      )}

      {typeKey === "TROUSERS" && (
        <g stroke="none" strokeLinejoin="round" strokeLinecap="round" style={{ transition: "stroke 0.4s ease" }}>
          <path d={`M${x - 24} ${y} h48
            C${x + 26} ${y + 60}, ${x + 16} ${y + 120}, ${x + 12} ${y + 156}
            q-7 6 -13 -1 L${x} ${y + 74}
            L${x - 13} ${y + 155} q-6 8 -13 1
            C${x - 16} ${y + 120}, ${x - 26} ${y + 60}, ${x - 24} ${y} Z`} fill={fill} style={{ transition: "fill 0.4s ease" }} />
          <rect x={x - 24} y={y} width="48" height="150" fill={fabricFill} stroke="none" opacity="0.6" />
          <g stroke={stroke} strokeWidth="0.9" fill="none" opacity="0.6">
            <path d={`M${x - 19} ${y + 120} q6 3 12 0`} />
            <path d={`M${x - 19} ${y + 128} q6 3 12 0`} />
            <path d={`M${x - 19} ${y + 136} q6 3 12 0`} />
            <path d={`M${x - 19} ${y + 144} q6 3 12 0`} />
            <path d={`M${x + 7} ${y + 120} q6 3 12 0`} />
            <path d={`M${x + 7} ${y + 128} q6 3 12 0`} />
            <path d={`M${x + 7} ${y + 136} q6 3 12 0`} />
            <path d={`M${x + 7} ${y + 144} q6 3 12 0`} />
          </g>
          {currentSeasonKey === "winter" && (
            <g fill="#FFFFFF" stroke={stroke} strokeWidth="1" opacity="0.9">
              <polygon points={`${x - 15},${y + 153} ${x - 13},${y + 165} ${x - 11},${y + 153}`} />
              <polygon points={`${x + 5},${y + 153} ${x + 7},${y + 165} ${x + 9},${y + 153}`} />
            </g>
          )}
        </g>
      )}

      {typeKey === "SHIRT" && (
        <g stroke="none" strokeLinejoin="round" strokeLinecap="round" style={{ transition: "stroke 0.4s ease" }}>
          <path d={`M${x - 28} ${y}
            L${x - 36} ${y + 150}
            Q${x} ${y + 166}, ${x + 36} ${y + 150}
            L${x + 30} ${y}
            Q${x} ${y + 12}, ${x - 28} ${y} Z`} fill={fill} style={{ transition: "fill 0.4s ease" }} />
          <path d={`M${x - 28} ${y}
            L${x - 36} ${y + 150}
            Q${x} ${y + 166}, ${x + 36} ${y + 150}
            L${x + 30} ${y}
            Q${x} ${y + 12}, ${x - 28} ${y} Z`} fill={fabricFill} stroke="none" />
          <g stroke={P.accent} strokeWidth="0.9" opacity="0.45" fill="none">
            <path d={`M${x - 18} ${y + 12} L${x - 22} ${y + 150}`} />
            <path d={`M${x - 8} ${y + 10} L${x - 11} ${y + 154}`} />
            <path d={`M${x + 2} ${y + 9} L${x + 1} ${y + 156}`} />
            <path d={`M${x + 12} ${y + 10} L${x + 14} ${y + 153}`} />
          </g>
          <path d={`M${x + 30} ${y + 3} L${x + 25} ${y + 150}`} stroke={P.accent} strokeWidth="4" fill="none" opacity="0.8" />
          <path d={`M${x - 34} ${y + 145} Q${x} ${y + 161}, ${x + 34} ${y + 145}`} stroke={P.accent} strokeWidth="5" fill="none" opacity="0.8" />
          <path d={`M${x - 32} ${y + 134} Q${x} ${y + 149}, ${x + 32} ${y + 134}`} stroke={P.accent} strokeWidth="2" fill="none" opacity="0.5" />
          <path d={`M${x + 30} ${y}
            Q${x + 48} ${y + 2}, ${x + 47} ${y + 30}
            Q${x + 46} ${y + 70}, ${x + 40} ${y + 100}
            Q${x + 34} ${y + 92}, ${x + 30} ${y + 96}
            Q${x + 33} ${y + 60}, ${x + 30} ${y} Z`} fill={`${P.accent}40`} stroke={stroke} strokeWidth="1.2" />
          <path d={`M${x + 47} ${y + 30} Q${x + 46} ${y + 70}, ${x + 40} ${y + 100}`} stroke={P.accent} strokeWidth="2.5" fill="none" opacity="0.85" />
          <g fill="none" stroke={P.accent} strokeWidth="1" opacity="0.75">
            <path d={`M${x + 36} ${y + 30} q6 -4 2 4 q-2 4 -4 1 q-2 -2 2 -5`} />
            <path d={`M${x + 36} ${y + 55} q6 -4 2 4 q-2 4 -4 1 q-2 -2 2 -5`} />
            <path d={`M${x + 35} ${y + 80} q6 -4 2 4 q-2 4 -4 1 q-2 -2 2 -5`} />
          </g>
          {currentSeasonKey === "winter" && (
            <g fill="#FFFFFF" stroke={stroke} strokeWidth="1" opacity="0.9">
              <polygon points={`${x - 26},${y + 150} ${x - 24},${y + 163} ${x - 22},${y + 150}`} />
              <polygon points={`${x + 20},${y + 150} ${x + 22},${y + 165} ${x + 24},${y + 150}`} />
            </g>
          )}
        </g>
      )}

      {typeKey === "TEE" && (
        <g stroke="none" strokeLinejoin="round" strokeLinecap="round" style={{ transition: "stroke 0.4s ease" }}>
          <path d={`M${x - 20} ${y}
            L${x - 16} ${y + 24}
            C${x - 40} ${y + 84}, ${x - 50} ${y + 130}, ${x - 44} ${y + 150}
            Q${x} ${y + 172}, ${x + 44} ${y + 150}
            C${x + 50} ${y + 130}, ${x + 40} ${y + 84}, ${x + 16} ${y + 24}
            L${x + 20} ${y}
            Q${x} ${y + 12}, ${x - 20} ${y} Z`} fill={fill} style={{ transition: "fill 0.4s ease" }} />
          <path d={`M${x - 16} ${y + 24}
            C${x - 40} ${y + 84}, ${x - 50} ${y + 130}, ${x - 44} ${y + 150}
            Q${x} ${y + 172}, ${x + 44} ${y + 150}
            C${x + 50} ${y + 130}, ${x + 40} ${y + 84}, ${x + 16} ${y + 24} Z`} fill={fabricFill} stroke="none" />
          <path d={`M${x - 20} ${y + 8} Q${x} ${y + 18}, ${x + 20} ${y + 8}`} stroke={P.accent} strokeWidth="2.5" fill="none" opacity="0.7" />
          <path d={`M${x - 42} ${y + 140} Q${x} ${y + 162}, ${x + 42} ${y + 140}`} stroke={P.accent} strokeWidth="5" fill="none" opacity="0.75" />
          <path d={`M${x - 40} ${y + 126} Q${x} ${y + 146}, ${x + 40} ${y + 126}`} stroke={P.accent} strokeWidth="2" fill="none" opacity="0.5" />
          <g fill="none" stroke={P.accent} strokeWidth="1.2" opacity="0.6">
            <path d={`M${x - 30} ${y + 112} q8 -7 16 0`} />
            <path d={`M${x - 8} ${y + 116} q8 -7 16 0`} />
            <path d={`M${x + 14} ${y + 112} q8 -7 16 0`} />
          </g>
          {currentSeasonKey === "winter" && (
            <g fill="#FFFFFF" stroke={stroke} strokeWidth="1" opacity="0.9">
              <polygon points={`${x - 30},${y + 150} ${x - 28},${y + 163} ${x - 26},${y + 150}`} />
              <polygon points={`${x + 26},${y + 150} ${x + 28},${y + 165} ${x + 30},${y + 150}`} />
            </g>
          )}
        </g>
      )}
    </g>
  );
}

