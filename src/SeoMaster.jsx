import { useState, useCallback, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:     "#0a0f1e",
  bg2:    "#0f1629",
  card:   "#131c30",
  card2:  "#182035",
  hover:  "#1c2840",
  border: "#1e2d45",
  bord2:  "#253550",
  blue:   "#3b6cf4",
  blueH:  "#2d58d4",
  blueLt: "#6b93f8",
  teal:   "#0ea5a0",
  muted:  "#7a92b0",
  dim:    "#3a5070",
  text:   "#b8cce0",
  bright: "#e8f0fa",
  green:  "#34d399",
  yellow: "#fbbf24",
  red:    "#f87171",
  orange: "#fb923c",
};

const AUDIT_TABS = [
  { v:"overview",  l:"Overview"       },
  { v:"fix",       l:"Fix Issues"     },
  { v:"perf",      l:"Performance"    },
  { v:"compare",   l:"Competitors"    },
  { v:"previews",  l:"Previews"       },
  { v:"serp",      l:"SERP Editor"    },
  { v:"schema",    l:"Structured Data"},
  { v:"history",   l:"History"        },
];

const PAGES = { home:"home", audit:"audit", privacy:"privacy", terms:"terms", contact:"contact", pricing:"pricing" };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcScore(fb){ if(!fb?.length) return 100; const w={error:15,warning:5,good:0}; return Math.max(0,100-fb.reduce((s,f)=>s+(w[f.status]||0),0)); }
function sc(s){ return s>=80?T.green:s>=60?T.yellow:T.red; }
function hn(url){ try{ return new URL(url).hostname; }catch{ return url; } }
function fmtDate(iso){ try{ return new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }catch{ return ""; } }

// ─── API ──────────────────────────────────────────────────────────────────────
async function apiCall(prompt, sys="You are an SEO expert. Respond ONLY with valid JSON. No markdown. No code fences."){
  const res = await fetch("/api/audit",{
  method:"POST", headers:{"Content-Type":"application/json"},
  body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:2000, system:sys, messages:[{role:"user",content:prompt}] }),
});
  const d = await res.json();
  const txt = d.content?.find(c=>c.type==="text")?.text||"";
  try{ return JSON.parse(txt.replace(/```json|```/g,"").trim()); }catch{ return null; }
}

// ─── Global CSS ───────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{background:#0a0f1e;color:#b8cce0;font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;}
a{color:inherit;text-decoration:none;}
button{font-family:inherit;}

/* Layout */
.wrap{max-width:1100px;margin:0 auto;padding:0 20px;}
.wrap-sm{max-width:760px;margin:0 auto;padding:0 20px;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px;}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;}
.col{display:flex;flex-direction:column;gap:14px;}
@media(max-width:768px){.grid2,.grid3{grid-template-columns:1fr;} .hide-mob{display:none!important;}}
@media(max-width:480px){.wrap,.wrap-sm{padding:0 14px;}}

/* Cards */
.card{background:#131c30;border:1px solid #1e2d45;border-radius:12px;padding:22px;}
.card-sm{background:#131c30;border:1px solid #1e2d45;border-radius:10px;padding:16px;}
.card-inset{background:#0f1629;border:1px solid #1a2640;border-radius:8px;padding:14px;}

/* Buttons */
.btn-primary{background:#3b6cf4;color:#fff;border:none;border-radius:8px;padding:11px 24px;font-size:14px;font-weight:600;cursor:pointer;transition:background .15s;display:inline-flex;align-items:center;gap:8px;}
.btn-primary:hover{background:#2d58d4;}
.btn-primary:disabled{opacity:.45;cursor:not-allowed;}
.btn-secondary{background:none;border:1px solid #1e2d45;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:500;color:#7a92b0;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:6px;}
.btn-secondary:hover{background:#1c2840;color:#b8cce0;border-color:#253550;}
.btn-secondary.active{border-color:#3b6cf4;background:#3b6cf415;color:#6b93f8;}
.btn-ghost{background:none;border:none;color:#7a92b0;cursor:pointer;font-size:13px;font-weight:500;padding:6px 12px;border-radius:6px;transition:all .15s;}
.btn-ghost:hover{background:#1c2840;color:#b8cce0;}

/* Tabs */
.tabs{display:flex;gap:2px;padding:4px;background:#0f1629;border-radius:10px;border:1px solid #1e2d45;overflow-x:auto;scrollbar-width:none;}
.tabs::-webkit-scrollbar{display:none;}
.tab{background:none;border:none;cursor:pointer;padding:7px 13px;border-radius:7px;font-size:12.5px;font-weight:500;color:#7a92b0;transition:all .15s;white-space:nowrap;font-family:inherit;}
.tab:hover{background:#1c2840;color:#b8cce0;}
.tab.on{background:#1a2d4a;color:#e8f0fa;border:0.5px solid #253550;}

/* Badges */
.badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:4px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}
.badge-ok{background:#064e3b;color:#34d399;}
.badge-warn{background:#451a03;color:#fbbf24;}
.badge-err{background:#450a0a;color:#fca5a5;}
.badge-info{background:#1e3a5f;color:#6b93f8;}

/* Inputs */
.inp{background:#0f1629;border:1px solid #1e2d45;color:#e8f0fa;border-radius:8px;font-family:inherit;width:100%;padding:9px 13px;font-size:13px;transition:border-color .15s;}
.inp:focus{outline:none;border-color:#3b6cf4;}
.inp::placeholder{color:#3a5070;}
textarea.inp{resize:vertical;line-height:1.6;}

/* URL search bar */
.search-bar{display:flex;align-items:center;background:#131c30;border:1.5px solid #3b6cf4;border-radius:10px;padding:0 5px 0 0;box-shadow:0 0 0 3px #3b6cf420;transition:box-shadow .2s;}
.search-bar:focus-within{box-shadow:0 0 0 4px #3b6cf430;}
.search-input{flex:1;background:transparent;border:none;outline:none;font-size:14px;color:#e8f0fa;padding:0 8px;height:46px;font-family:inherit;}
.search-input::placeholder{color:#3a5070;}

/* Loader spinner */
@keyframes spin{to{transform:rotate(360deg);}}
.spinner{width:20px;height:20px;border:2px solid #1e2d45;border-top-color:#3b6cf4;border-radius:50%;animation:spin .7s linear infinite;display:inline-block;}
.spinner-lg{width:36px;height:36px;border-width:3px;}

/* Animations */
@keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
.fade-up{animation:fadeUp .25s ease;}

/* Progress bar */
.pbar{height:5px;border-radius:3px;background:#1c2840;overflow:hidden;}
.pfill{height:100%;border-radius:3px;transition:width .6s ease;}

/* Misc */
.divider{height:1px;background:#1e2d45;margin:16px 0;}
.tag{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:5px;font-size:12px;font-weight:500;background:#182035;border:1px solid #253550;color:#7a92b0;}
.score-ring text{font-family:'Inter',sans-serif;}

/* Page sections */
.page-hero{padding:80px 0 60px;text-align:center;}
.section{padding:60px 0;}
.section-sm{padding:40px 0;}

/* Feature grid on landing */
.feat-card{background:#131c30;border:1px solid #1e2d45;border-radius:14px;padding:24px;transition:border-color .2s,transform .2s;}
.feat-card:hover{border-color:#253550;transform:translateY(-2px);}

/* Table */
.tbl{width:100%;border-collapse:collapse;font-size:13px;}
.tbl th{padding:10px 14px;text-align:left;font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:.5px;color:#7a92b0;background:#0f1629;border-bottom:1px solid #1e2d45;}
.tbl td{padding:10px 14px;border-bottom:1px solid #1a2640;color:#b8cce0;}
.tbl tr:last-child td{border-bottom:none;}
.tbl tr:hover td{background:#131c3080;}

/* Highlight row */
.tbl th.hl,.tbl td.hl{color:#6b93f8;font-weight:600;}

/* Pricing cards */
.price-card{background:#131c30;border:1px solid #1e2d45;border-radius:14px;padding:28px;position:relative;}
.price-card.featured{border-color:#3b6cf4;box-shadow:0 0 0 1px #3b6cf440;}

/* Footer */
footer{border-top:1px solid #1e2d45;padding:40px 0 28px;}
`;

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState(PAGES.home);
  const [auditUrl, setAuditUrl] = useState("");

  const goAudit = (url) => { setAuditUrl(url||""); setPage(PAGES.audit); };
  const goPage  = (p) => { setPage(p); window.scrollTo(0,0); };

  return (
    <div style={{minHeight:"100vh",background:T.bg}}>
      <style>{CSS}</style>
      <Nav current={page} goPage={goPage} goAudit={goAudit}/>
      {page===PAGES.home    && <HomePage    goAudit={goAudit} goPage={goPage}/>}
      {page===PAGES.audit   && <AuditPage   initUrl={auditUrl}/>}
      {page===PAGES.pricing && <PricingPage goAudit={goAudit}/>}
      {page===PAGES.privacy && <PrivacyPage/>}
      {page===PAGES.terms   && <TermsPage/>}
      {page===PAGES.contact && <ContactPage/>}
      <Footer goPage={goPage}/>
    </div>
  );
}

// ─── NAV ──────────────────────────────────────────────────────────────────────
function Nav({ current, goPage, goAudit }) {
  const [open, setOpen] = useState(false);
  return (
    <header style={{borderBottom:`1px solid ${T.border}`,background:"#0a0f1ef5",backdropFilter:"blur(10px)",position:"sticky",top:0,zIndex:100}}>
      <div className="wrap" style={{height:56,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        {/* Logo */}
        <button onClick={()=>goPage(PAGES.home)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="7" fill="#1a3a8a"/>
            <path d="M7 21L14 7l7 14" stroke="#6b93f8" strokeWidth="2" strokeLinejoin="round" fill="none"/>
            <path d="M9.5 16h9" stroke="#6b93f8" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span style={{fontWeight:700,fontSize:15,color:T.bright,letterSpacing:"-0.2px"}}>Rankly<span style={{color:T.blueLt}}>.dev</span></span>
        </button>

        {/* Desktop nav */}
        <nav className="hide-mob" style={{display:"flex",alignItems:"center",gap:6}}>
          {[{l:"Home",p:PAGES.home},{l:"Pricing",p:PAGES.pricing},{l:"Contact",p:PAGES.contact}].map(n=>(
            <button key={n.p} className="btn-ghost" onClick={()=>goPage(n.p)}
              style={{color:current===n.p?T.bright:T.muted}}>{n.l}</button>
          ))}
          <button className="btn-primary" style={{padding:"8px 18px",fontSize:13,marginLeft:8}} onClick={()=>goPage(PAGES.audit)}>
            Run Audit
          </button>
        </nav>

        {/* Mobile hamburger */}
        <button className="btn-ghost" style={{display:"none"}} id="ham" onClick={()=>setOpen(o=>!o)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke={T.muted} strokeWidth="1.8" strokeLinecap="round"/></svg>
        </button>
        <style>{`@media(max-width:768px){#ham{display:flex!important;}}`}</style>
      </div>
      {open && (
        <div style={{borderTop:`1px solid ${T.border}`,background:T.bg2,padding:"12px 20px",display:"flex",flexDirection:"column",gap:4}}>
          {[{l:"Home",p:PAGES.home},{l:"Pricing",p:PAGES.pricing},{l:"Contact",p:PAGES.contact}].map(n=>(
            <button key={n.p} className="btn-ghost" style={{textAlign:"left",justifyContent:"flex-start",color:current===n.p?T.bright:T.muted}} onClick={()=>{goPage(n.p);setOpen(false);}}>{n.l}</button>
          ))}
          <button className="btn-primary" style={{marginTop:6,justifyContent:"center"}} onClick={()=>{goPage(PAGES.audit);setOpen(false);}}>Run Audit</button>
        </div>
      )}
    </header>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────
function Footer({ goPage }) {
  return (
    <footer>
      <div className="wrap">
        <div className="grid3" style={{marginBottom:32}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <svg width="24" height="24" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="7" fill="#1a3a8a"/><path d="M7 21L14 7l7 14" stroke="#6b93f8" strokeWidth="2" strokeLinejoin="round" fill="none"/><path d="M9.5 16h9" stroke="#6b93f8" strokeWidth="1.8" strokeLinecap="round"/></svg>
              <span style={{fontWeight:700,fontSize:14,color:T.bright}}>Rankly.dev</span>
            </div>
            <p style={{fontSize:13,color:T.muted,lineHeight:1.7}}>Professional SEO auditing platform. Analyse any website's on-page signals, performance, and structured data.</p>
          </div>
          <div>
            <p style={{fontSize:12,fontWeight:600,color:T.bright,textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:12}}>Product</p>
            {[{l:"Run Audit",p:PAGES.audit},{l:"Pricing",p:PAGES.pricing}].map(x=>(
              <button key={x.p} className="btn-ghost" style={{display:"block",textAlign:"left",padding:"4px 0",color:T.muted,fontSize:13}} onClick={()=>goPage(x.p)}>{x.l}</button>
            ))}
          </div>
          <div>
            <p style={{fontSize:12,fontWeight:600,color:T.bright,textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:12}}>Company</p>
            {[{l:"Contact",p:PAGES.contact},{l:"Privacy Policy",p:PAGES.privacy},{l:"Terms of Use",p:PAGES.terms}].map(x=>(
              <button key={x.p} className="btn-ghost" style={{display:"block",textAlign:"left",padding:"4px 0",color:T.muted,fontSize:13}} onClick={()=>goPage(x.p)}>{x.l}</button>
            ))}
          </div>
        </div>
        <div style={{borderTop:`1px solid ${T.border}`,paddingTop:20,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <p style={{fontSize:12,color:T.dim}}>© {new Date().getFullYear()} Rankly.dev — All rights reserved.</p>
          <p style={{fontSize:12,color:T.dim}}>Built for SEO professionals.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
function HomePage({ goAudit, goPage }) {
  const [sfx, setSfx] = useState("");
  const features = [
    {icon:"◎",title:"On-Page Analysis",desc:"Complete audit of title tags, meta descriptions, headings, images, canonical tags, and structured data."},
    {icon:"⚡",title:"Core Web Vitals",desc:"LCP, CLS, FCP and TBT scores with actionable optimisation opportunities and savings estimates."},
    {icon:"E",title:"E-E-A-T Scoring",desc:"Experience, Expertise, Authoritativeness and Trust signals — graded and broken down with specific recommendations."},
    {icon:"⇌",title:"Competitor Benchmarking",desc:"Compare your site's SEO metrics side-by-side against up to three competitors in seconds."},
    {icon:"⊡",title:"Social Previews",desc:"See exactly how your pages appear when shared on Google, Twitter/X, and Facebook before you publish."},
    {icon:"{}",title:"Structured Data Generator",desc:"Generate production-ready JSON-LD for Articles, Products, FAQs, Local Businesses, and more."},
  ];
  return (
    <div>
      {/* Hero */}
      <div className="page-hero">
        <div className="wrap-sm">
          <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 14px",borderRadius:20,background:"#1a3a8a20",border:`1px solid #1a3a8a`,fontSize:12,color:T.blueLt,marginBottom:22,fontWeight:500}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:T.green,display:"inline-block"}}/>
            Free SEO Audit Tool
          </div>
          <h1 style={{fontSize:"clamp(30px,5vw,50px)",fontWeight:700,lineHeight:1.15,letterSpacing:"-0.8px",color:T.bright,marginBottom:16}}>
            Complete SEO audit<br/>for any website
          </h1>
          <p style={{fontSize:"clamp(14px,2vw,17px)",color:T.muted,lineHeight:1.75,marginBottom:36,maxWidth:520,margin:"0 auto 36px"}}>
            On-page signals, E-E-A-T scoring, Core Web Vitals, competitor gap analysis, social previews and schema generation — all in one place.
          </p>
          {/* Search */}
          <div style={{maxWidth:580,margin:"0 auto",marginBottom:16}}>
            <div className="search-bar">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{marginLeft:14,flexShrink:0}}><circle cx="8" cy="8" r="5.5" stroke={T.muted} strokeWidth="1.5"/><path d="M12.5 12.5l3 3" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/></svg>
              <span style={{fontSize:13,fontWeight:500,color:T.blueLt,whiteSpace:"nowrap",padding:"0 4px 0 8px",lineHeight:"46px",opacity:.85}}>https://</span>
              <input className="search-input" value={sfx} onChange={e=>setSfx(e.target.value.replace(/^https?:\/\//i,""))} onKeyDown={e=>e.key==="Enter"&&sfx.trim()&&goAudit("https://"+sfx.trim())} placeholder="yourdomain.com"/>
              <button className="btn-primary" style={{borderRadius:7,margin:"4px",padding:"10px 20px",fontSize:13}} onClick={()=>sfx.trim()&&goAudit("https://"+sfx.trim())}>
                Run Audit
              </button>
            </div>
          </div>
          <p style={{fontSize:12,color:T.dim}}>No account required. Results in under 15 seconds.</p>
        </div>
      </div>

      {/* Features */}
      <div className="section" style={{borderTop:`1px solid ${T.border}`}}>
        <div className="wrap">
          <div style={{textAlign:"center",marginBottom:40}}>
            <h2 style={{fontSize:"clamp(22px,3vw,32px)",fontWeight:700,color:T.bright,letterSpacing:"-0.4px",marginBottom:10}}>Everything you need to rank</h2>
            <p style={{fontSize:15,color:T.muted,maxWidth:480,margin:"0 auto"}}>Eight specialised audit modules covering every aspect of on-page SEO.</p>
          </div>
          <div className="grid3">
            {features.map((f,i)=>(
              <div key={i} className="feat-card">
                <div style={{width:38,height:38,borderRadius:9,background:"#1a2d4a",border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:T.blueLt,marginBottom:14}}>{f.icon}</div>
                <p style={{fontSize:14,fontWeight:600,color:T.bright,marginBottom:7}}>{f.title}</p>
                <p style={{fontSize:13,color:T.muted,lineHeight:1.65}}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="section-sm">
        <div className="wrap-sm" style={{textAlign:"center"}}>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:"40px 28px"}}>
            <h2 style={{fontSize:"clamp(20px,3vw,28px)",fontWeight:700,color:T.bright,marginBottom:10}}>Ready to improve your rankings?</h2>
            <p style={{fontSize:14,color:T.muted,marginBottom:24,lineHeight:1.7}}>Run a free audit on any URL right now — no sign-up, no credit card.</p>
            <button className="btn-primary" style={{fontSize:14,padding:"12px 28px"}} onClick={()=>goPage(PAGES.audit)}>Start Free Audit</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AUDIT PAGE ───────────────────────────────────────────────────────────────
function AuditPage({ initUrl }) {
  const [sfx, setSfx]     = useState(initUrl?initUrl.replace(/^https?:\/\//i,""):"");
  const [urlErr, setUE]   = useState("");
  const [data, setData]   = useState(null);
  const [loading, setL]   = useState(false);
  const [err, setErr]     = useState("");
  const [tab, setTab]     = useState("overview");
  const [hist, setHist]   = useState(()=>{ try{ return JSON.parse(localStorage.getItem("rk_h")||"[]"); }catch{ return []; } });

  const saveHist = useCallback((item)=>{
    setHist(prev=>{ const n=[item,...prev.filter(h=>h.url!==item.url)].slice(0,20); try{ localStorage.setItem("rk_h",JSON.stringify(n)); }catch{} return n; });
  },[]);

  const run = async (raw) => {
    let u=(raw||("https://"+sfx)).trim();
    if(!u||u==="https://"){ setUE("Please enter a website address"); return; }
    if(!/^https?:\/\//i.test(u)) u="https://"+u;
    try{ new URL(u); }catch{ setUE("That doesn't look like a valid URL"); return; }
    setUE(""); setErr(""); setL(true); setData(null); setTab("overview");
    try{
      const r = await apiCall(`Perform a detailed SEO audit for: ${u}

Return ONLY this exact JSON (realistic values for well-known domains, informed estimates for others):
{
  "url":"${u}","title":"string or null","description":"string or null",
  "ogTitle":"string or null","ogDescription":"string or null","ogImage":"url or null",
  "twitterCard":"string or null","twitterTitle":"string or null","twitterDescription":"string or null",
  "feedback":[
    {"category":"Title","status":"good|warning|error","message":"specific detail"},
    {"category":"Description","status":"good|warning|error","message":"specific detail"},
    {"category":"OpenGraph","status":"good|warning|error","message":"specific detail"},
    {"category":"Twitter","status":"good|warning|error","message":"specific detail"},
    {"category":"Structure","status":"good|warning|error","message":"specific detail"},
    {"category":"Images","status":"good|warning|error","message":"specific detail"},
    {"category":"Schema","status":"good|warning|error","message":"specific detail"},
    {"category":"Mobile","status":"good|warning|error","message":"specific detail"},
    {"category":"Performance","status":"good|warning|error","message":"specific detail"}
  ],
  "pageSignals":{"wordCount":850,"h1Count":1,"h2Count":5,"h3Count":8,"imageCount":12,"imagesWithAlt":10,"internalLinks":24,"externalLinks":6,"hasCanonical":true,"hasRobotsMeta":true,"hasViewport":true,"hasStructuredData":false,"schemaTypes":[]},
  "eeat":{"score":65,"grade":"B","experienceScore":60,"expertiseScore":70,"authoritativenessScore":65,"trustScore":65,
    "signals":[
      {"name":"Author Information","category":"expertise","present":true,"description":"Named author found"},
      {"name":"Contact Details","category":"trust","present":true,"description":"Contact page accessible"},
      {"name":"Privacy Policy","category":"trust","present":true,"description":"Privacy policy linked"},
      {"name":"HTTPS","category":"trust","present":true,"description":"Site uses HTTPS"},
      {"name":"External Citations","category":"authoritativeness","present":false,"description":"No external authority links found"},
      {"name":"About Page","category":"authoritativeness","present":true,"description":"About page present"},
      {"name":"User Testimonials","category":"experience","present":false,"description":"No reviews or testimonials"},
      {"name":"In-depth Content","category":"expertise","present":true,"description":"Content exceeds 500 words"},
      {"name":"Social Profiles","category":"authoritativeness","present":false,"description":"Social links not detected"}
    ]
  },
  "vitals":{"performanceScore":72,"lcp":{"score":65,"value":"3.2s"},"cls":{"score":90,"value":"0.05"},"fcp":{"score":75,"value":"1.8s"},"tbt":{"score":80,"value":"180ms"},
    "opportunities":[
      {"title":"Eliminate render-blocking resources","description":"Defer or async-load scripts blocking initial render","savings":0.5},
      {"title":"Properly size images","description":"Serve images at their display dimensions","savings":0.3}
    ]
  }
}`);
      if(!r) throw new Error();
      r.healthScore = calcScore(r.feedback);
      setData(r);
      saveHist({url:u,score:r.healthScore,at:new Date().toISOString()});
    }catch{ setErr("Audit failed — please check the URL and try again."); }
    setL(false);
  };

  // Auto-run if initUrl provided
  useEffect(()=>{ if(initUrl) run(initUrl); },[]);

  const score = data?.healthScore??0;

  return (
    <div className="wrap" style={{padding:"32px 20px 60px"}}>
      {/* Search bar */}
      <div style={{marginBottom:28,maxWidth:680}}>
        <div className="search-bar">
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" style={{marginLeft:12,flexShrink:0}}><circle cx="8" cy="8" r="5.5" stroke={T.muted} strokeWidth="1.5"/><path d="M12.5 12.5l3 3" stroke={T.muted} strokeWidth="1.5" strokeLinecap="round"/></svg>
          <span style={{fontSize:13,fontWeight:500,color:T.blueLt,whiteSpace:"nowrap",padding:"0 3px 0 7px",lineHeight:"46px",opacity:.85}}>https://</span>
          <input className="search-input" value={sfx} onChange={e=>setSfx(e.target.value.replace(/^https?:\/\//i,""))} onKeyDown={e=>e.key==="Enter"&&run()} placeholder="yourdomain.com"/>
          <button className="btn-primary" style={{borderRadius:7,margin:"4px",padding:"9px 18px",fontSize:13,minWidth:80}} disabled={loading} onClick={()=>run()}>
            {loading?<span className="spinner"/>:"Run Audit"}
          </button>
        </div>
        {urlErr && <p style={{color:T.red,fontSize:12,marginTop:5}}>⚠ {urlErr}</p>}
        {/* Recents */}
        {hist.length>0 && !data && !loading && (
          <div style={{display:"flex",alignItems:"center",gap:7,marginTop:10,flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:T.dim}}>Recent:</span>
            {hist.slice(0,5).map(h=>(
              <button key={h.url} className="tag" style={{cursor:"pointer"}} onClick={()=>{ setSfx(hn(h.url)); run(h.url); }}>
                {hn(h.url)} <span style={{color:sc(h.score),fontWeight:700,fontSize:10}}>{h.score}%</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {err && <div style={{maxWidth:680,padding:"11px 16px",background:"#450a0a",border:`1px solid #7f1d1d`,borderRadius:9,color:T.red,fontSize:13,marginBottom:20}}>⚠ {err}</div>}

      {/* Loading */}
      {loading && (
        <div style={{textAlign:"center",padding:"72px 0"}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:18}}><span className="spinner spinner-lg"/></div>
          <p style={{fontSize:15,fontWeight:500,color:T.text,marginBottom:6}}>Running SEO audit…</p>
          <p style={{fontSize:13,color:T.dim}}>Checking metadata, on-page signals, and performance indicators</p>
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <div className="fade-up">
          {/* Score banner */}
          <div className="card" style={{marginBottom:18,display:"flex",alignItems:"center",gap:22,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:18}}>
              <svg width="76" height="76" viewBox="0 0 76 76" className="score-ring">
                <circle cx="38" cy="38" r="32" fill="none" stroke={T.border} strokeWidth="6"/>
                <circle cx="38" cy="38" r="32" fill="none" stroke={sc(score)} strokeWidth="6"
                  strokeDasharray={`${(score/100)*201} 201`} strokeLinecap="round" transform="rotate(-90 38 38)"/>
                <text x="38" y="44" textAnchor="middle" fill={sc(score)} fontSize="19" fontWeight="700">{score}</text>
              </svg>
              <div>
                <p style={{fontSize:11,color:T.dim,textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:3}}>SEO Health Score</p>
                <p style={{fontSize:21,fontWeight:700,color:T.bright,lineHeight:1.2}}>{score>=80?"Strong":score>=60?"Room to improve":"Needs attention"}</p>
                <a href={data.url} target="_blank" rel="noreferrer" style={{fontSize:12,color:T.blue,display:"flex",alignItems:"center",gap:4,marginTop:4}}>
                  {hn(data.url)}
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 10L10 2M10 2H5M10 2v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </a>
              </div>
            </div>
            <div style={{flex:1,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(86px,1fr))",gap:9}}>
              {["Title","Description","OpenGraph","Twitter"].map(cat=>{
                const fb=data.feedback.filter(f=>f.category===cat); const s=fb.length?calcScore(fb):100;
                return (
                  <div key={cat} style={{textAlign:"center",padding:"10px 6px",background:T.card2,borderRadius:8,border:`1px solid ${T.border}`}}>
                    <div style={{fontSize:16,fontWeight:700,color:sc(s)}}>{s}%</div>
                    <div style={{fontSize:11,color:T.muted,marginTop:2}}>{cat}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs" style={{marginBottom:16}}>
            {AUDIT_TABS.map(t=><button key={t.v} className={`tab${tab===t.v?" on":""}`} onClick={()=>setTab(t.v)}>{t.l}</button>)}
          </div>

          {tab==="overview" && <OverviewTab data={data}/>}
          {tab==="fix"      && <FixTab      data={data}/>}
          {tab==="perf"     && <PerfTab     data={data}/>}
          {tab==="compare"  && <CompareTab  data={data}/>}
          {tab==="previews" && <PreviewsTab data={data}/>}
          {tab==="serp"     && <SerpTab     data={data}/>}
          {tab==="schema"   && <SchemaTab   data={data}/>}
          {tab==="history"  && <HistoryTab  hist={hist} run={run} setSfx={setSfx}/>}
        </div>
      )}

      {!data&&!loading&&!err&&(
        <div style={{textAlign:"center",padding:"80px 0",color:T.dim}}>
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{margin:"0 auto 16px",display:"block"}}>
            <circle cx="22" cy="22" r="20" stroke={T.border} strokeWidth="1.5"/>
            <circle cx="18" cy="18" r="7" stroke={T.dim} strokeWidth="1.5" fill="none"/>
            <path d="M23.5 23.5l5 5" stroke={T.dim} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p style={{fontSize:15,color:T.muted,marginBottom:6}}>Enter a URL above to run your SEO audit</p>
          <p style={{fontSize:13,color:T.dim}}>Results appear within seconds</p>
        </div>
      )}
    </div>
  );
}

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────
function OverviewTab({ data }) {
  return (
    <div className="col">
      <div className="card">
        <p style={{fontSize:14,fontWeight:600,color:T.bright,marginBottom:14}}>Audit Results</p>
        <div className="col" style={{gap:8}}>
          {data.feedback.map((f,i)=>{
            const bg=f.status==="error"?"#450a0a22":f.status==="warning"?"#451a0322":"#064e3b22";
            const bd=f.status==="error"?"#7f1d1d":f.status==="warning"?"#854d0e":"#166534";
            const ic=f.status==="error"?T.red:f.status==="warning"?T.yellow:T.green;
            const sym=f.status==="error"?"✕":f.status==="warning"?"▲":"✓";
            return (
              <div key={i} style={{display:"flex",alignItems:"flex-start",gap:11,padding:"10px 13px",borderRadius:8,background:bg,border:`1px solid ${bd}`}}>
                <span style={{color:ic,fontWeight:700,fontSize:12,marginTop:2,minWidth:12}}>{sym}</span>
                <div>
                  <span className={`badge badge-${f.status==="error"?"err":f.status==="warning"?"warn":"ok"}`} style={{marginBottom:5}}>{f.category}</span>
                  <p style={{fontSize:13,color:T.muted,lineHeight:1.55}}>{f.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid2">
        {data.eeat     && <EeatCard     eeat={data.eeat}/>}
        {data.pageSignals && <SignalsCard signals={data.pageSignals}/>}
      </div>
    </div>
  );
}

function EeatCard({ eeat }) {
  const cats={experience:{l:"Experience",c:"#f97316"},expertise:{l:"Expertise",c:"#3b82f6"},authoritativeness:{l:"Authority",c:"#a855f7"},trust:{l:"Trust",c:"#22c55e"}};
  const gc={A:"#22c55e",B:"#84cc16",C:"#facc15",D:"#f97316",F:"#ef4444"};
  return (
    <div className="card">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div>
          <p style={{fontSize:14,fontWeight:600,color:T.bright}}>E-E-A-T Score</p>
          <p style={{fontSize:11,color:T.dim,marginTop:2}}>Experience · Expertise · Authority · Trust</p>
        </div>
        <div style={{textAlign:"center",background:T.card2,borderRadius:8,padding:"7px 14px",border:`1px solid ${T.border}`}}>
          <div style={{fontSize:24,fontWeight:700,color:gc[eeat.grade]||"#888"}}>{eeat.grade}</div>
          <div style={{fontSize:11,color:T.dim}}>{eeat.score}/100</div>
        </div>
      </div>
      {[["experience",eeat.experienceScore],["expertise",eeat.expertiseScore],["authoritativeness",eeat.authoritativenessScore],["trust",eeat.trustScore]].map(([k,s])=>(
        <div key={k} style={{marginBottom:9}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
            <span style={{color:cats[k].c,fontWeight:500}}>{cats[k].l}</span>
            <span style={{fontWeight:600,color:T.text}}>{s}%</span>
          </div>
          <div className="pbar"><div className="pfill" style={{width:`${s}%`,background:cats[k].c}}/></div>
        </div>
      ))}
      <div style={{marginTop:12}}>
        {eeat.signals?.map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
            <span style={{color:s.present?T.green:T.red,fontSize:11,fontWeight:700,minWidth:12}}>{s.present?"✓":"✕"}</span>
            <span style={{fontSize:12,flex:1,color:T.muted}}>{s.name}</span>
            <span style={{fontSize:10,color:T.dim,background:T.card2,padding:"1px 7px",borderRadius:3}}>{s.category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignalsCard({ signals }) {
  const rows=[
    ["Words",signals.wordCount,null],
    ["H1 tags",signals.h1Count,signals.h1Count===1?T.green:T.red],
    ["H2 tags",signals.h2Count,null],
    ["Images",`${signals.imagesWithAlt}/${signals.imageCount} with alt`,null],
    ["Internal links",signals.internalLinks,null],
    ["External links",signals.externalLinks,null],
    ["Canonical",signals.hasCanonical?"Present":"Missing",signals.hasCanonical?T.green:T.red],
    ["Schema markup",signals.hasStructuredData?(signals.schemaTypes?.join(", ")||"Present"):"None",signals.hasStructuredData?T.green:T.yellow],
    ["Viewport meta",signals.hasViewport?"Present":"Missing",signals.hasViewport?T.green:T.red],
    ["Robots meta",signals.hasRobotsMeta?"Present":"Not set",null],
  ];
  return (
    <div className="card">
      <p style={{fontSize:14,fontWeight:600,color:T.bright,marginBottom:14}}>Page Signals</p>
      {rows.map(([l,v,c])=>(
        <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${T.border}`}}>
          <span style={{fontSize:12,color:T.muted}}>{l}</span>
          <span style={{fontSize:12,fontWeight:600,color:c||T.text}}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// ─── FIX ISSUES TAB ───────────────────────────────────────────────────────────
function FixTab({ data }) {
  const [recs,setRecs]   = useState(null);
  const [loading,setL]   = useState(false);
  const [copied,setCopy] = useState(null);
  const issues = data.feedback.filter(f=>f.status!=="good");

  const fetch_ = async ()=>{
    setL(true);
    const r = await apiCall(
      `Provide specific SEO fix recommendations for this page:
URL: ${data.url}
Title: ${data.title||"MISSING"}
Description: ${data.description||"MISSING"}
Issues: ${issues.map(f=>`[${f.category}] ${f.message}`).join(" | ")}
Return: {"recommendations":[{"category":"string","current":"current value or null","recommended":"improved version","rationale":"clear specific reason"}]}`,
      "Senior SEO specialist. Return only valid JSON."
    );
    if(r?.recommendations) setRecs(r.recommendations);
    setL(false);
  };

  const copy=(text,i)=>{ navigator.clipboard.writeText(text); setCopy(i); setTimeout(()=>setCopy(null),2000); };

  return (
    <div className="col">
      <div className="card" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
        <div>
          <p style={{fontSize:14,fontWeight:600,color:T.bright,marginBottom:4}}>Issue Recommendations</p>
          <p style={{fontSize:13,color:T.muted}}>{issues.length} issue{issues.length!==1?"s":""} found across {[...new Set(issues.map(f=>f.category))].length} categories.{issues.length===0?" Your page looks well optimised!":""}</p>
        </div>
        <button className="btn-primary" onClick={fetch_} disabled={loading||issues.length===0} style={{flexShrink:0}}>
          {loading?<><span className="spinner"/>Analysing…</>:"Get Recommendations"}
        </button>
      </div>
      {recs?.map((s,i)=>(
        <div key={i} className="card fade-up">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span className="badge badge-warn">{s.category}</span>
            <button className="btn-secondary" style={{fontSize:12,padding:"4px 12px"}} onClick={()=>copy(s.recommended,i)}>
              {copied===i?"✓ Copied":"Copy"}
            </button>
          </div>
          {s.current&&<p style={{fontSize:12,color:T.dim,marginBottom:8,lineHeight:1.5}}>Current: <em style={{color:T.muted}}>{s.current}</em></p>}
          <div className="card-inset" style={{marginBottom:8}}>
            <p style={{fontSize:13,fontWeight:500,color:T.bright,lineHeight:1.55}}>{s.recommended}</p>
          </div>
          <p style={{fontSize:12,color:T.muted,lineHeight:1.55}}>Rationale: {s.rationale}</p>
        </div>
      ))}
    </div>
  );
}

// ─── PERFORMANCE TAB ──────────────────────────────────────────────────────────
function PerfTab({ data }) {
  const v=data.vitals;
  if(!v) return <div className="card"><p style={{color:T.muted}}>No performance data available.</p></div>;
  const vc=s=>s>=90?T.green:s>=50?T.yellow:T.red;
  const vl=s=>s>=90?"Good":s>=50?"Needs work":"Poor";
  const metrics=[
    {k:"lcp",l:"Largest Contentful Paint",d:"Time until the main content element is visible"},
    {k:"cls",l:"Cumulative Layout Shift",  d:"Measures unexpected layout shifts during load"},
    {k:"fcp",l:"First Contentful Paint",   d:"Time until the first content renders on screen"},
    {k:"tbt",l:"Total Blocking Time",      d:"Total time the main thread was blocked"},
  ];
  return (
    <div className="col">
      <div className="card" style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
        <div style={{textAlign:"center",minWidth:80}}>
          <div style={{fontSize:40,fontWeight:700,color:vc(v.performanceScore)}}>{v.performanceScore}</div>
          <div style={{fontSize:11,color:T.muted,textTransform:"uppercase",letterSpacing:"0.5px"}}>Performance</div>
        </div>
        <div style={{flex:1}}>
          <p style={{fontSize:14,fontWeight:600,color:T.bright,marginBottom:5}}>Core Web Vitals</p>
          <p style={{fontSize:13,color:T.muted,lineHeight:1.65}}>These metrics are direct Google ranking signals. Improvements here affect both search position and user experience scores.</p>
        </div>
      </div>
      <div className="grid2">
        {metrics.map(m=>(
          <div key={m.k} className="card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <p style={{fontSize:12,color:T.muted,lineHeight:1.4,maxWidth:"55%"}}>{m.l}</p>
              <span style={{fontSize:22,fontWeight:700,color:vc(v[m.k].score)}}>{v[m.k].value}</span>
            </div>
            <div className="pbar" style={{marginBottom:7}}><div className="pfill" style={{width:`${v[m.k].score}%`,background:vc(v[m.k].score)}}/></div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:11,color:T.dim}}>{m.d.slice(0,38)}…</span>
              <span style={{fontSize:11,fontWeight:600,color:vc(v[m.k].score)}}>{vl(v[m.k].score)}</span>
            </div>
          </div>
        ))}
      </div>
      {v.opportunities?.length>0&&(
        <div className="card">
          <p style={{fontSize:14,fontWeight:600,color:T.bright,marginBottom:14}}>Optimisation Opportunities</p>
          {v.opportunities.map((o,i)=>(
            <div key={i} style={{padding:"11px 0",borderBottom:`1px solid ${T.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <p style={{fontSize:13,fontWeight:500,color:T.text}}>{o.title}</p>
                {o.savings&&<span style={{fontSize:11,color:T.yellow,fontWeight:600,background:"#451a0328",padding:"2px 8px",borderRadius:4}}>−{o.savings}s</span>}
              </div>
              <p style={{fontSize:12,color:T.muted,lineHeight:1.55}}>{o.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── COMPETITORS TAB ──────────────────────────────────────────────────────────
function CompareTab({ data }) {
  const [urls,setUrls]   = useState([""]);
  const [res,setRes]     = useState(null);
  const [loading,setL]   = useState(false);

  const run = async()=>{
    const valid=urls.filter(u=>u.trim());
    if(!valid.length) return;
    setL(true);
    const r = await apiCall(
      `SEO competitor analysis for these URLs: ${valid.join(", ")}
Return: {"results":[{"url":"..","title":"..","description":"..","healthScore":75,"ogImage":null,"twitterCard":null,"feedback":[...]}]}`,
      "SEO analyst. Return only valid JSON."
    );
    if(r?.results) setRes(r.results);
    setL(false);
  };

  const all = res ? [data,...res] : null;

  return (
    <div className="col">
      <div className="card">
        <p style={{fontSize:14,fontWeight:600,color:T.bright,marginBottom:4}}>Competitor Benchmarking</p>
        <p style={{fontSize:13,color:T.muted,marginBottom:16}}>Compare <strong style={{color:T.blueLt}}>{hn(data.url)}</strong> against up to 3 competitors across key SEO metrics.</p>
        {urls.map((u,i)=>(
          <div key={i} style={{display:"flex",gap:8,marginBottom:8}}>
            <input className="inp" type="text" value={u} onChange={e=>setUrls(p=>p.map((x,j)=>j===i?e.target.value:x))} placeholder={`Competitor ${i+1} URL — https://example.com`}/>
            {urls.length>1&&<button className="btn-secondary" onClick={()=>setUrls(p=>p.filter((_,j)=>j!==i))}>Remove</button>}
          </div>
        ))}
        <div style={{display:"flex",gap:8,marginTop:10}}>
          {urls.length<3&&<button className="btn-secondary" onClick={()=>setUrls(u=>[...u,""])}>+ Add competitor</button>}
          <button className="btn-primary" onClick={run} disabled={loading}>
            {loading?<><span className="spinner"/>Comparing…</>:"Compare"}
          </button>
        </div>
      </div>
      {all&&(
        <div className="card" style={{padding:0,overflowX:"auto"}}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Metric</th>
                <th className="hl">You — {hn(data.url)}</th>
                {res.map((r,i)=><th key={i}>{hn(r.url)}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                {l:"SEO Score",    g:d=>({v:`${d.healthScore??calcScore(d.feedback)}%`,c:sc(d.healthScore??calcScore(d.feedback))})},
                {l:"Title",        g:d=>({v:d.title?`${d.title.length} chars`:"Missing",c:d.title?T.text:T.red})},
                {l:"Description",  g:d=>({v:d.description?`${d.description.length} chars`:"Missing",c:d.description?T.text:T.red})},
                {l:"OG Image",     g:d=>({v:d.ogImage?"Present":"Missing",c:d.ogImage?T.green:T.red})},
                {l:"Twitter Card", g:d=>({v:d.twitterCard?"Present":"Missing",c:d.twitterCard?T.green:T.red})},
              ].map(row=>(
                <tr key={row.l}>
                  <td style={{color:T.muted,fontWeight:500}}>{row.l}</td>
                  {all.map((d,i)=>{ const {v,c}=row.g(d); return <td key={i} className={i===0?"hl":""} style={{color:c,fontWeight:600}}>{v}</td>; })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── PREVIEWS TAB ─────────────────────────────────────────────────────────────
function PreviewsTab({ data }) {
  const [tab,setTab]=useState("google");
  const host=hn(data.url);
  return (
    <div className="col">
      <div style={{display:"flex",gap:6}}>
        {["google","twitter","facebook"].map(t=><button key={t} className={`btn-secondary${tab===t?" active":""}`} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</button>)}
      </div>
      {tab==="google"&&(
        <div className="card" style={{maxWidth:600}}>
          <p style={{fontSize:11,color:T.dim,marginBottom:12,textTransform:"uppercase",letterSpacing:"0.5px"}}>Google Search — Desktop</p>
          <div style={{padding:18,background:"#fff",borderRadius:8,border:"1px solid #e5e7eb",fontFamily:"arial,sans-serif"}}>
            <p style={{fontSize:12,color:"#188038",marginBottom:3}}>{data.url}</p>
            <p style={{fontSize:18,color:"#1a0dab",marginBottom:5,lineHeight:1.25}}>{data.title||"(No title tag)"}</p>
            <p style={{fontSize:14,color:"#4d5156",lineHeight:1.65}}>{data.description||"No meta description — Google will auto-generate a snippet from the page content."}</p>
          </div>
        </div>
      )}
      {tab==="twitter"&&(
        <div className="card" style={{maxWidth:500}}>
          <p style={{fontSize:11,color:T.dim,marginBottom:12,textTransform:"uppercase",letterSpacing:"0.5px"}}>Twitter / X — Link Card</p>
          <div style={{border:"1px solid #2f3336",borderRadius:14,overflow:"hidden",background:"#000"}}>
            {data.ogImage?<img src={data.ogImage} alt="" style={{width:"100%",height:196,objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>
              :<div style={{height:110,background:"#16202c",display:"flex",alignItems:"center",justifyContent:"center",color:"#536471",fontSize:13}}>No preview image set</div>}
            <div style={{padding:"10px 14px"}}>
              <p style={{fontSize:12,color:"#536471"}}>{host}</p>
              <p style={{fontSize:14,fontWeight:700,color:"#e7e9ea",marginTop:2}}>{data.twitterTitle||data.title||"(No title)"}</p>
              <p style={{fontSize:13,color:"#71767b",marginTop:2}}>{data.twitterDescription||data.description||"(No description)"}</p>
            </div>
          </div>
          {!data.twitterCard&&<p style={{fontSize:12,color:T.yellow,marginTop:8}}>⚠ No twitter:card meta tag — the link will not expand as a card.</p>}
        </div>
      )}
      {tab==="facebook"&&(
        <div className="card" style={{maxWidth:500}}>
          <p style={{fontSize:11,color:T.dim,marginBottom:12,textTransform:"uppercase",letterSpacing:"0.5px"}}>Facebook — Link Share</p>
          <div style={{border:"1px solid #dddfe2",overflow:"hidden",fontFamily:"helvetica,arial,sans-serif"}}>
            {data.ogImage?<img src={data.ogImage} alt="" style={{width:"100%",height:196,objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>
              :<div style={{height:110,background:"#e4e6eb",display:"flex",alignItems:"center",justifyContent:"center",color:"#8a8d91",fontSize:13}}>No og:image set</div>}
            <div style={{padding:"10px 14px",background:"#f0f2f5",borderTop:"1px solid #dddfe2"}}>
              <p style={{fontSize:11,color:"#8a8d91",textTransform:"uppercase"}}>{host}</p>
              <p style={{fontSize:14,fontWeight:600,color:"#1c1e21",marginTop:2}}>{data.ogTitle||data.title||"(No og:title)"}</p>
              <p style={{fontSize:12,color:"#606770",marginTop:2}}>{data.ogDescription||data.description||"(No og:description)"}</p>
            </div>
          </div>
          {(!data.ogTitle||!data.ogDescription)&&<p style={{fontSize:12,color:T.yellow,marginTop:8}}>⚠ Missing OpenGraph tags — Facebook will guess at the content to display.</p>}
        </div>
      )}
    </div>
  );
}

// ─── SERP EDITOR TAB ─────────────────────────────────────────────────────────
function SerpTab({ data }) {
  const [title,setTitle]=useState(data.title||"");
  const [desc,setDesc]  =useState(data.description||"");
  const [mob,setMob]    =useState(false);
  const [copied,setCopy]=useState(false);
  useEffect(()=>{ setTitle(data.title||""); setDesc(data.description||""); },[data]);
  const tl=title.length, dl=desc.length;
  const ts=tl===0?"empty":tl<30?"short":tl>60?"long":"good";
  const ds=dl===0?"empty":dl<120?"short":dl>160?"long":"good";
  const sC=s=>s==="good"?T.green:s==="empty"?T.red:T.yellow;
  const sM=s=>({good:"Optimal",empty:"Empty",short:"Too short",long:"Too long"}[s]);
  const copyHTML=()=>{ navigator.clipboard.writeText(`<title>${title}</title>\n<meta name="description" content="${desc}" />`); setCopy(true); setTimeout(()=>setCopy(false),2000); };
  return (
    <div className="grid2">
      <div className="card">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <p style={{fontSize:14,fontWeight:600,color:T.bright}}>SERP Snippet Editor</p>
          <div style={{display:"flex",gap:4}}>
            <button className={`btn-secondary${!mob?" active":""}`} onClick={()=>setMob(false)}>Desktop</button>
            <button className={`btn-secondary${mob?" active":""}`}  onClick={()=>setMob(true)}>Mobile</button>
          </div>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.muted,marginBottom:5}}>
            <label>Title tag</label><span style={{color:sC(ts),fontWeight:500}}>{tl}/60 — {sM(ts)}</span>
          </div>
          <input className="inp" type="text" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Page title…"/>
          <div style={{height:3,borderRadius:2,background:T.border,overflow:"hidden",marginTop:4}}>
            <div style={{height:"100%",width:`${Math.min(100,(tl/60)*100)}%`,background:sC(ts),transition:"all .3s"}}/>
          </div>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.muted,marginBottom:5}}>
            <label>Meta description</label><span style={{color:sC(ds),fontWeight:500}}>{dl}/160 — {sM(ds)}</span>
          </div>
          <textarea className="inp" value={desc} onChange={e=>setDesc(e.target.value)} rows={3} placeholder="Meta description…"/>
          <div style={{height:3,borderRadius:2,background:T.border,overflow:"hidden",marginTop:4}}>
            <div style={{height:"100%",width:`${Math.min(100,(dl/160)*100)}%`,background:sC(ds),transition:"all .3s"}}/>
          </div>
        </div>
        <button className="btn-secondary" style={{width:"100%",justifyContent:"center"}} onClick={copyHTML}>
          {copied?"✓ HTML tags copied to clipboard":"Copy title and meta tags"}
        </button>
      </div>
      <div className="card">
        <p style={{fontSize:14,fontWeight:600,color:T.bright,marginBottom:4}}>Live Preview</p>
        <p style={{fontSize:11,color:T.dim,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.5px"}}>Google {mob?"Mobile":"Desktop"} result</p>
        <div style={{padding:18,background:"#fff",borderRadius:8,border:"1px solid #e5e7eb",fontFamily:"arial,sans-serif"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <div style={{width:18,height:18,borderRadius:"50%",background:"#ddd"}}/>
            <p style={{fontSize:12,color:"#188038"}}>{data.url}</p>
          </div>
          <p style={{fontSize:mob?15:18,color:"#1a0dab",marginBottom:4,lineHeight:1.25}}>{(mob?title.slice(0,50):title.slice(0,60))||"Add a title tag"}</p>
          <p style={{fontSize:13,color:"#4d5156",lineHeight:1.65}}>{(mob?desc.slice(0,100):desc.slice(0,160))||"Add a meta description to control how your page appears in search results."}</p>
        </div>
        {tl>60&&<p style={{fontSize:12,color:T.yellow,marginTop:8}}>⚠ Title is {tl-60} chars over — will be cut off</p>}
        {dl>160&&<p style={{fontSize:12,color:T.yellow,marginTop:6}}>⚠ Description is {dl-160} chars over — may be truncated</p>}
      </div>
    </div>
  );
}

// ─── STRUCTURED DATA TAB ─────────────────────────────────────────────────────
function SchemaTab({ data }) {
  const [type,setType]=useState("Article");
  const [copied,setCopy]=useState(false);
  const host=hn(data.url);
  const schemas={
    Article:()=>({"@context":"https://schema.org","@type":"Article","headline":data.title||"Article Headline","description":data.description||"","author":{"@type":"Person","name":"Author Name"},"publisher":{"@type":"Organization","name":host,"logo":{"@type":"ImageObject","url":`https://${host}/logo.png`}},"datePublished":new Date().toISOString().split("T")[0],"image":data.ogImage||`https://${host}/featured.jpg`}),
    Product:()=>({"@context":"https://schema.org","@type":"Product","name":data.title||"Product Name","description":data.description||"","image":data.ogImage||`https://${host}/product.jpg`,"offers":{"@type":"Offer","price":"0.00","priceCurrency":"USD","availability":"https://schema.org/InStock"}}),
    FAQ:()=>({"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is this about?","acceptedAnswer":{"@type":"Answer","text":"Your answer here."}},{"@type":"Question","name":"How does it work?","acceptedAnswer":{"@type":"Answer","text":"Describe how it works."}}]}),
    LocalBusiness:()=>({"@context":"https://schema.org","@type":"LocalBusiness","name":host.split(".")[0],"url":data.url,"telephone":"+1-000-000-0000","address":{"@type":"PostalAddress","streetAddress":"123 Main St","addressLocality":"City","addressRegion":"ST","postalCode":"00000","addressCountry":"US"}}),
    Person:()=>({"@context":"https://schema.org","@type":"Person","name":"Author Name","url":data.url,"sameAs":[`https://twitter.com/username`,`https://linkedin.com/in/username`]}),
    WebPage:()=>({"@context":"https://schema.org","@type":"WebPage","name":data.title||"Page Title","description":data.description||"","url":data.url,"inLanguage":"en-US"}),
    BreadcrumbList:()=>({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":data.url.replace(/\/[^/]+$/,"")},{"@type":"ListItem","position":2,"name":data.title||"Page","item":data.url}]}),
  };
  const code=JSON.stringify(schemas[type]?.(),null,2);
  const full=`<script type="application/ld+json">\n${code}\n<\/script>`;
  const copy=()=>{ navigator.clipboard.writeText(full); setCopy(true); setTimeout(()=>setCopy(false),2000); };
  return (
    <div className="card">
      <p style={{fontSize:14,fontWeight:600,color:T.bright,marginBottom:4}}>Structured Data Generator</p>
      <p style={{fontSize:13,color:T.muted,marginBottom:16,lineHeight:1.65}}>JSON-LD markup tells search engines what your content is, enabling rich results like star ratings, FAQs and product cards.</p>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:16}}>
        {Object.keys(schemas).map(t=><button key={t} className={`btn-secondary${type===t?" active":""}`} onClick={()=>setType(t)}>{t}</button>)}
      </div>
      <div style={{position:"relative"}}>
        <button onClick={copy} style={{position:"absolute",top:10,right:10,padding:"4px 12px",borderRadius:5,border:`1px solid #ffffff18`,background:"#ffffff0a",color:"#8ea3bb",cursor:"pointer",fontSize:12}}>
          {copied?"✓ Copied":"Copy"}
        </button>
        <pre style={{background:"#070d1a",color:"#8da4c4",borderRadius:9,padding:"16px",fontSize:11.5,overflowX:"auto",lineHeight:1.8,fontFamily:"'Fira Code','Cascadia Code','Consolas',monospace",border:`1px solid ${T.border}`}}>
          {full}
        </pre>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:12,flexWrap:"wrap",gap:8}}>
        <p style={{fontSize:12,color:T.dim}}>Paste this inside your page &lt;head&gt; element.</p>
        <a href="https://search.google.com/test/rich-results" target="_blank" rel="noreferrer" style={{fontSize:12,color:T.blue,display:"flex",alignItems:"center",gap:4}}>
          Validate with Google Rich Results Test
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 10L10 2M10 2H5M10 2v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </a>
      </div>
    </div>
  );
}

// ─── HISTORY TAB ──────────────────────────────────────────────────────────────
function HistoryTab({ hist, run, setSfx }) {
  if(!hist.length) return (
    <div className="card" style={{textAlign:"center",padding:"52px"}}>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{margin:"0 auto 14px",display:"block"}}>
        <circle cx="20" cy="20" r="18" stroke={T.border} strokeWidth="1.5"/>
        <path d="M20 11v9l5 3" stroke={T.dim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <p style={{fontSize:14,color:T.muted,marginBottom:4}}>No audit history yet</p>
      <p style={{fontSize:13,color:T.dim}}>Your past audits will appear here once you run them</p>
    </div>
  );
  const chartData=[...hist].reverse().map((h,i)=>({i:i+1,score:h.score,label:hn(h.url)}));
  return (
    <div className="col">
      {chartData.length>=2&&(
        <div className="card">
          <p style={{fontSize:14,fontWeight:600,color:T.bright,marginBottom:16}}>Score History</p>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.blue} stopOpacity={0.25}/>
                  <stop offset="95%" stopColor={T.blue} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
              <XAxis dataKey="label" tick={{fontSize:10,fill:T.muted}} interval="preserveStartEnd"/>
              <YAxis domain={[0,100]} tick={{fontSize:10,fill:T.muted}}/>
              <Tooltip contentStyle={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.text}} formatter={v=>[`${v}%`,"Score"]}/>
              <Area type="monotone" dataKey="score" stroke={T.blue} strokeWidth={2} fill="url(#sg)" dot={{fill:T.blue,r:4}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="card">
        <p style={{fontSize:14,fontWeight:600,color:T.bright,marginBottom:14}}>Past Audits</p>
        {hist.map((h,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"10px",borderRadius:8,cursor:"pointer",transition:"background .1s",borderBottom:`1px solid ${T.border}`}}
            onClick={()=>{ setSfx(hn(h.url)); run(h.url); }}
            onMouseEnter={e=>e.currentTarget.style.background=T.hover}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div style={{width:46,height:46,borderRadius:9,background:`${sc(h.score)}14`,border:`1px solid ${sc(h.score)}30`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{fontSize:12,fontWeight:700,color:sc(h.score)}}>{h.score}%</span>
            </div>
            <div style={{flex:1}}>
              <p style={{fontSize:13,fontWeight:500,color:T.bright}}>{hn(h.url)}</p>
              <p style={{fontSize:11,color:T.dim}}>{fmtDate(h.at)}</p>
            </div>
            <button className="btn-secondary" style={{fontSize:12,padding:"4px 12px",flexShrink:0}} onClick={e=>{e.stopPropagation();setSfx(hn(h.url));run(h.url);}}>Re-run</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PRICING PAGE ─────────────────────────────────────────────────────────────
function PricingPage({ goAudit }) {
  const plans=[
    {name:"Free",price:"$0",period:"forever",features:["Unlimited URL audits","All 8 audit modules","E-E-A-T scoring","Core Web Vitals","Social previews","Structured data generator","Audit history (20 entries)"],cta:"Start for free",primary:false},
    {name:"Pro",price:"$19",period:"per month",features:["Everything in Free","Priority processing","PDF audit export","Bulk URL auditing","Scheduled re-audits","Email reports","Priority support"],cta:"Get started",primary:true},
    {name:"Agency",price:"$79",period:"per month",features:["Everything in Pro","Unlimited team members","White-label reports","API access","Dedicated account manager","Custom integrations","SLA guarantee"],cta:"Contact us",primary:false},
  ];
  return (
    <div className="section">
      <div className="wrap">
        <div style={{textAlign:"center",marginBottom:48}}>
          <h1 style={{fontSize:"clamp(26px,4vw,40px)",fontWeight:700,color:T.bright,letterSpacing:"-0.5px",marginBottom:12}}>Simple, transparent pricing</h1>
          <p style={{fontSize:16,color:T.muted,maxWidth:440,margin:"0 auto"}}>Start free. Upgrade when you need more.</p>
        </div>
        <div className="grid3">
          {plans.map((p,i)=>(
            <div key={i} className={`price-card${p.primary?" featured":""}`}>
              {p.primary&&<div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",background:T.blue,color:"#fff",fontSize:11,fontWeight:700,padding:"3px 14px",borderRadius:20,whiteSpace:"nowrap",letterSpacing:"0.4px"}}>MOST POPULAR</div>}
              <p style={{fontSize:16,fontWeight:700,color:T.bright,marginBottom:6}}>{p.name}</p>
              <div style={{marginBottom:18}}>
                <span style={{fontSize:36,fontWeight:700,color:T.bright}}>{p.price}</span>
                <span style={{fontSize:13,color:T.muted,marginLeft:6}}>{p.period}</span>
              </div>
              {p.features.map((f,j)=>(
                <div key={j} style={{display:"flex",alignItems:"center",gap:9,marginBottom:9}}>
                  <span style={{color:T.green,fontSize:12,fontWeight:700}}>✓</span>
                  <span style={{fontSize:13,color:T.muted}}>{f}</span>
                </div>
              ))}
              <button className={p.primary?"btn-primary":"btn-secondary"} style={{width:"100%",justifyContent:"center",marginTop:20}} onClick={()=>goAudit("")}>
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PRIVACY PAGE ─────────────────────────────────────────────────────────────
function PrivacyPage() {
  const sections=[
    {h:"Information We Collect",b:"When you use Rankly.dev, we collect only the information necessary to provide the service. This includes URLs you submit for analysis, aggregate usage data (pages visited, features used), and technical data such as browser type and screen resolution. We do not require account creation and do not collect personally identifiable information by default."},
    {h:"How We Use Your Information",b:"Information you provide is used solely to deliver the SEO audit results you request. Submitted URLs are processed in real-time and are not stored on our servers beyond the duration of your session. Aggregate, anonymised usage data helps us understand which features are most valuable and improve the product accordingly."},
    {h:"Data Storage and Security",b:"Audit history is stored locally in your browser using localStorage and is never transmitted to our servers. We use industry-standard HTTPS encryption for all data in transit. We do not sell, rent, or share your data with third parties for marketing purposes."},
    {h:"Third-Party Services",b:"Rankly.dev uses the Anthropic API to process SEO analysis requests. URL data submitted for analysis is transmitted to Anthropic in accordance with their privacy policy and terms of service. We recommend reviewing Anthropic's privacy policy at anthropic.com/privacy for details on how they handle data."},
    {h:"Cookies",b:"We use only essential cookies required for the service to function. We do not use tracking cookies or third-party advertising cookies. You may disable cookies in your browser settings, though this may affect certain site functionality."},
    {h:"Your Rights",b:"You have the right to request deletion of any data associated with your use of Rankly.dev. Since we store minimal data, this primarily means clearing your browser's localStorage for this domain. For any privacy-related concerns, contact us at privacy@rankly.dev."},
    {h:"Changes to This Policy",b:"We may update this privacy policy from time to time. Material changes will be noted with an updated date at the top of this page. Continued use of the service after changes constitutes acceptance of the updated policy."},
  ];
  return (
    <div className="wrap-sm" style={{padding:"48px 20px 80px"}}>
      <p style={{fontSize:12,color:T.dim,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.6px"}}>Legal</p>
      <h1 style={{fontSize:"clamp(24px,4vw,36px)",fontWeight:700,color:T.bright,marginBottom:6}}>Privacy Policy</h1>
      <p style={{fontSize:13,color:T.dim,marginBottom:36}}>Last updated: {new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</p>
      <p style={{fontSize:14,color:T.muted,lineHeight:1.75,marginBottom:32}}>At Rankly.dev, we take your privacy seriously. This policy describes what data we collect, why we collect it, and how we use it.</p>
      {sections.map((s,i)=>(
        <div key={i} style={{marginBottom:28}}>
          <h2 style={{fontSize:16,fontWeight:600,color:T.bright,marginBottom:8}}>{s.h}</h2>
          <p style={{fontSize:14,color:T.muted,lineHeight:1.75}}>{s.b}</p>
        </div>
      ))}
      <div style={{borderTop:`1px solid ${T.border}`,paddingTop:24,marginTop:16}}>
        <p style={{fontSize:13,color:T.dim}}>Questions? Email us at <span style={{color:T.blue}}>privacy@rankly.dev</span></p>
      </div>
    </div>
  );
}

// ─── TERMS PAGE ───────────────────────────────────────────────────────────────
function TermsPage() {
  const sections=[
    {h:"Acceptance of Terms",b:"By accessing or using Rankly.dev, you agree to be bound by these Terms of Use. If you do not agree to these terms, please do not use the service. We reserve the right to update these terms at any time, with changes taking effect upon posting."},
    {h:"Description of Service",b:"Rankly.dev provides an SEO analysis platform that audits websites for on-page optimisation signals, performance metrics, and structured data. The service is provided on an 'as-is' basis. While we strive for accuracy, SEO audit results are informational in nature and should not be relied upon as the sole basis for business decisions."},
    {h:"Permitted Use",b:"You may use Rankly.dev to audit websites that you own, manage, or have explicit permission to analyse. You may not use the service to scrape data at scale, attempt to reverse-engineer the platform, submit malicious or harmful URLs, or circumvent any rate limiting or access controls."},
    {h:"Intellectual Property",b:"The Rankly.dev platform, including its design, code, and content, is the intellectual property of Rankly.dev. You retain ownership of any URLs or content you submit. You grant us a limited licence to process submitted URLs solely for the purpose of providing audit results."},
    {h:"Disclaimer of Warranties",b:"The service is provided without warranties of any kind, express or implied. We do not guarantee that audit results will improve your search rankings. SEO outcomes depend on many factors outside our control, including search engine algorithm changes."},
    {h:"Limitation of Liability",b:"To the fullest extent permitted by law, Rankly.dev shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service. Our total liability shall not exceed the amount paid by you, if any, in the 12 months preceding the claim."},
    {h:"Governing Law",b:"These terms are governed by and construed in accordance with applicable law. Any disputes shall be resolved through binding arbitration or in the courts of the applicable jurisdiction."},
  ];
  return (
    <div className="wrap-sm" style={{padding:"48px 20px 80px"}}>
      <p style={{fontSize:12,color:T.dim,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.6px"}}>Legal</p>
      <h1 style={{fontSize:"clamp(24px,4vw,36px)",fontWeight:700,color:T.bright,marginBottom:6}}>Terms of Use</h1>
      <p style={{fontSize:13,color:T.dim,marginBottom:36}}>Last updated: {new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</p>
      <p style={{fontSize:14,color:T.muted,lineHeight:1.75,marginBottom:32}}>Please read these Terms of Use carefully before using Rankly.dev. These terms govern your access to and use of our service.</p>
      {sections.map((s,i)=>(
        <div key={i} style={{marginBottom:28}}>
          <h2 style={{fontSize:16,fontWeight:600,color:T.bright,marginBottom:8}}>{s.h}</h2>
          <p style={{fontSize:14,color:T.muted,lineHeight:1.75}}>{s.b}</p>
        </div>
      ))}
      <div style={{borderTop:`1px solid ${T.border}`,paddingTop:24,marginTop:16}}>
        <p style={{fontSize:13,color:T.dim}}>Questions? Email us at <span style={{color:T.blue}}>legal@rankly.dev</span></p>
      </div>
    </div>
  );
}

// ─── CONTACT PAGE ─────────────────────────────────────────────────────────────
function ContactPage() {
  const [form,setForm]=useState({name:"",email:"",subject:"",message:""});
  const [sent,setSent]=useState(false);
  const update=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  const submit=e=>{ e.preventDefault(); if(form.name&&form.email&&form.message){ setSent(true); } };
  return (
    <div className="wrap-sm" style={{padding:"48px 20px 80px"}}>
      <p style={{fontSize:12,color:T.dim,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.6px"}}>Get in touch</p>
      <h1 style={{fontSize:"clamp(24px,4vw,36px)",fontWeight:700,color:T.bright,marginBottom:8}}>Contact us</h1>
      <p style={{fontSize:14,color:T.muted,marginBottom:36,lineHeight:1.7}}>Have a question, feedback, or want to discuss a custom plan? We typically respond within one business day.</p>
      {sent?(
        <div className="card" style={{textAlign:"center",padding:"48px"}}>
          <div style={{width:48,height:48,borderRadius:"50%",background:"#064e3b",border:`1px solid ${T.green}30`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:22,color:T.green}}>✓</div>
          <p style={{fontSize:16,fontWeight:600,color:T.bright,marginBottom:6}}>Message sent</p>
          <p style={{fontSize:13,color:T.muted}}>We'll get back to you at {form.email} within one business day.</p>
        </div>
      ):(
        <form onSubmit={submit} className="col">
          <div className="grid2">
            <div>
              <label style={{fontSize:12,color:T.muted,display:"block",marginBottom:6}}>Name *</label>
              <input className="inp" type="text" value={form.name} onChange={update("name")} placeholder="Your name" required/>
            </div>
            <div>
              <label style={{fontSize:12,color:T.muted,display:"block",marginBottom:6}}>Email *</label>
              <input className="inp" type="email" value={form.email} onChange={update("email")} placeholder="you@company.com" required/>
            </div>
          </div>
          <div>
            <label style={{fontSize:12,color:T.muted,display:"block",marginBottom:6}}>Subject</label>
            <input className="inp" type="text" value={form.subject} onChange={update("subject")} placeholder="How can we help?"/>
          </div>
          <div>
            <label style={{fontSize:12,color:T.muted,display:"block",marginBottom:6}}>Message *</label>
            <textarea className="inp" rows={5} value={form.message} onChange={update("message")} placeholder="Tell us more…" required/>
          </div>
          <div>
            <button className="btn-primary" type="submit" style={{padding:"11px 28px"}}>Send message</button>
          </div>
          <p style={{fontSize:12,color:T.dim}}>You can also email us directly at <span style={{color:T.blue}}>hello@rankly.dev</span></p>
        </form>
      )}
    </div>
  );
}
