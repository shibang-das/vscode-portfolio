/* ────────────────────────────────────────────────────────────────
   data.js — single source of truth for every panel in the workbench.
   Edit here; the UI is generated from these objects.
   ──────────────────────────────────────────────────────────────── */

const PROFILE = {
  name: 'Shibang Das',
  first: 'Shibang',
  role: 'Backend Engineer',
  company: 'Joveo',
  tagline: 'Backend Engineer @ Joveo · Java · Spring Boot · Kafka',
  location: 'India · IST (UTC+5:30)',
  email: 'shibangsde@gmail.com',
  phone: '+91 9007559005',
  linkedin: 'https://www.linkedin.com/in/shibang-das',
  codeforces: 'https://codeforces.com/profile/clowntk',
  leetcode: 'https://leetcode.com/u/ShibangDS/',
  resume: 'Shibang_Das_Resume.pdf',
  blurb: [
    'I build backend systems that stay fast when the traffic is not polite about it.',
    'Right now that means Java and Spring Boot microservices on AWS at Joveo — Kafka for the event flow, PostgreSQL underneath, and a lot of query plans read very carefully.',
    'Before the services, there were the problems: 1500+ of them, an Expert badge on Codeforces, and a habit of reaching for the algorithm before the framework.'
  ],
  facts: [
    { k: 'now',      v: 'Backend Intern @ Joveo' },
    { k: 'stack',    v: 'Java · Spring Boot · Kafka · PostgreSQL · AWS' },
    { k: 'degree',   v: 'BTech + MTech, IIT (BHU) Varanasi' },
    { k: 'rating',   v: 'Codeforces Expert (1708) · LeetCode Knight (1977)' },
    { k: 'offboard', v: 'National-level chess player, 2000+ across formats' }
  ]
};

const EXPERIENCE = [
  {
    company: 'Joveo',
    role: 'Backend Intern',
    period: 'Dec 2025 — Present',
    current: true,
    tag: 'Java · Spring Boot · Kafka · AWS',
    points: [
      'Built and shipped Java/Spring Boot microservices on AWS, wiring PostgreSQL and Kafka into a scalable event-driven architecture.',
      'Worked across ATS and CRM integration flows — ATS→Joveo sync, job and apply-URL pipelines — mapping recruitment data end to end for full-funnel candidate tracking.',
      'Cut API latency for several high-traffic widgets in Unified Analytics, Joveo’s primary revenue product, by rewriting queries and streamlining the data path.'
    ]
  },
  {
    company: 'Tredence',
    role: 'Software Engineer',
    period: 'Jul 2025 — Nov 2025',
    tag: 'FastAPI · LangGraph · RDF',
    points: [
      'Built a FastAPI semantic-extraction pipeline on OntoCast, LangGraph and the OpenAI API that turns unstructured text into RDF triples and domain ontologies — roughly 60% less manual modelling.',
      'Configured Apache Jena Fuseki to store and serve those knowledge graphs over SPARQL for real-time querying.'
    ]
  },
  {
    company: 'DataCurve (YC W24)',
    role: 'Freelancer',
    period: 'May 2025 — Jul 2025',
    tag: 'DSA · LLM evaluation',
    points: [
      'Authored 120+ original DSA problems and solved 50+ unseen model-generated ones.',
      'Refined the training set by solving and validating recursion, DP and tree problems — internal benchmark accuracy moved from ~60% to 75%.'
    ]
  },
  {
    company: 'NeuroNexus Innovations',
    role: 'Software Engineer Intern',
    period: 'May 2024 — Jul 2024',
    tag: 'Node · Socket.io · Playwright',
    points: [
      'Reworked sign-in for new users with React OAuth and Google integration.',
      'Wrote the backend for a real-time chat widget in Socket.io — sub-second connect to support, ~40% faster response times.',
      'Covered the web app with end-to-end Playwright integration tests.'
    ]
  }
];

const EDUCATION = {
  school: 'Indian Institute of Technology (BHU), Varanasi',
  degree: 'BTech + MTech, Mechanical Engineering',
  period: 'Dec 2020 — Jun 2025',
  detail: 'CPI 8.41 · Uttar Pradesh, India'
};

const PROJECTS = [
  {
    name: 'BookLoom',
    kind: 'Full-stack bookstore',
    accent: '#f5a524',
    stack: ['MongoDB', 'Express.js', 'React.js', 'Node.js', 'JWT', 'bcrypt.js'],
    points: [
      'Storefront where customers browse and buy books through layered filters.',
      'REST cart and order-management services — edit a selection before checkout, then track the order history after.',
      'Auth on JWT + bcrypt.js, with MongoDB holding user and order state.'
    ],
    links: []
  },
  {
    name: 'ChessGo',
    kind: 'Real-time PvP chess',
    accent: '#2dd4bf',
    stack: ['Express.js', 'Node.js', 'Chess.js', 'Socket.io'],
    points: [
      'Drag-and-drop chess with live spectating and full move validation.',
      'Socket.io keeps board state and player roles in sync across every connected client.',
      'Chess.js owns the rules; Node + Express manage connections and broadcast state updates.'
    ],
    links: []
  }
];

const SKILLS = [
  { group: 'Languages',   items: ['C++', 'Java', 'Python', 'JavaScript', 'SQL', 'HTML/CSS'] },
  { group: 'Backend',     items: ['Spring Boot', 'Node.js', 'Express.js', 'FastAPI', 'REST APIs', 'Socket.io'] },
  { group: 'Data',        items: ['PostgreSQL', 'MongoDB', 'Kafka', 'Apache Jena Fuseki', 'SPARQL'] },
  { group: 'Cloud & Test',items: ['AWS', 'Playwright', 'Git'] },
  { group: 'Frontend',    items: ['React.js', 'React OAuth'] },
  { group: 'Foundations', items: ['Data Structures & Algorithms', 'Operating Systems', 'DBMS', 'OOP', 'Computer Networking'] }
];

const PROFICIENCY = [
  { label: 'Backend & APIs',      pct: 90, color: '#f5a524' },
  { label: 'DSA / problem solving',pct: 95, color: '#2dd4bf' },
  { label: 'Databases & queries', pct: 85, color: '#a78bfa' },
  { label: 'Distributed systems', pct: 74, color: '#f87171' },
  { label: 'Frontend',            pct: 68, color: '#60a5fa' }
];

const ACHIEVEMENTS = [
  { icon: '△', title: 'Codeforces Expert',  detail: 'Max rating 1708 · handle clowntk', level: 'ok' },
  { icon: '◇', title: 'LeetCode Knight',    detail: 'Max rating 1977 · handle ShibangDS', level: 'ok' },
  { icon: '▲', title: '1500+ problems solved', detail: 'LeetCode, GeeksforGeeks and friends', level: 'ok' },
  { icon: '◈', title: 'Meta HackerCup 2024', detail: 'Global rank 1269, Round 2', level: 'info' },
  { icon: '◉', title: 'Google Kickstart',   detail: 'Global rank 1437, Farewell Round A', level: 'info' },
  { icon: '⬡', title: 'Flipkart GRiD 6.0',  detail: 'Qualified Level 2 out of 4.8 lakh entrants', level: 'info' },
  { icon: '♞', title: 'National & Inter-IIT chess', detail: 'U14 2015-16, U17 2016-17 · 2000+ all formats', level: 'warn' }
];

const LINKS = [
  { label: 'Email',      value: PROFILE.email,     href: 'mailto:' + PROFILE.email, icon: '✉' },
  { label: 'Phone',      value: PROFILE.phone,     href: 'tel:+919007559005',       icon: '☏' },
  { label: 'LinkedIn',   value: 'in/shibang-das',  href: PROFILE.linkedin,          icon: 'in' },
  { label: 'Codeforces', value: 'clowntk · 1708',  href: PROFILE.codeforces,        icon: 'CF' },
  { label: 'LeetCode',   value: 'ShibangDS · 1977',href: PROFILE.leetcode,          icon: 'LC' }
];

/* File tree — each leaf maps to a renderer in views.js */
const FILES = [
  { id: 'home',      name: 'home.tsx',        dir: 'src', lang: 'tsx',  icon: '⬡', color: '#61dafb' },
  { id: 'about',     name: 'about.md',        dir: 'src', lang: 'md',   icon: '≡', color: '#9aa7b4' },
  { id: 'experience',name: 'experience.ts',   dir: 'src', lang: 'ts',   icon: '⬢', color: '#3178c6' },
  { id: 'projects',  name: 'projects.json',   dir: 'src', lang: 'json', icon: '{}', color: '#f5a524' },
  { id: 'skills',    name: 'skills.yaml',     dir: 'src', lang: 'yaml', icon: '⊞', color: '#c586c0' },
  { id: 'achievements', name: 'achievements.log', dir: '', lang: 'log', icon: '✶', color: '#2dd4bf' },
  { id: 'contact',   name: 'contact.sh',      dir: '',    lang: 'sh',   icon: '$',  color: '#34d399' },
  { id: 'readme',    name: 'README.md',       dir: '',    lang: 'md',   icon: '≡', color: '#9aa7b4' }
];

const THEMES = [
  { id: 'ember',     label: 'Ember (default)', swatch: ['#0d1117', '#f5a524', '#2dd4bf'] },
  { id: 'ice',       label: 'Ice Harbour',     swatch: ['#0b1220', '#60a5fa', '#a78bfa'] },
  { id: 'moss',      label: 'Moss Terminal',   swatch: ['#0c1410', '#7ee787', '#e3b341'] },
  { id: 'plum',      label: 'Plum Dusk',       swatch: ['#15101d', '#d8a0ff', '#78dce8'] },
  { id: 'paper',     label: 'Paper (light)',   swatch: ['#f5f2ea', '#b45309', '#0f766e'] },
  { id: 'mono',      label: 'Monochrome',      swatch: ['#101010', '#e8e8e8', '#8a8a8a'] }
];

const SHORTCUTS = [
  ['Ctrl K  /  Ctrl P', 'Command palette'],
  ['Ctrl `', 'Toggle terminal'],
  ['Ctrl B', 'Toggle sidebar'],
  ['Ctrl I', 'Toggle assistant'],
  ['Ctrl Shift T', 'Cycle colour theme'],
  ['Ctrl W', 'Close current tab'],
  ['Ctrl Tab', 'Next tab'],
  ['Ctrl 1 … 8', 'Jump to Nth file'],
  ['Ctrl + / − / 0', 'Zoom in / out / reset'],
  ['Ctrl L', 'Clear terminal'],
  ['?', 'This sheet'],
  ['Esc', 'Close any overlay']
];
