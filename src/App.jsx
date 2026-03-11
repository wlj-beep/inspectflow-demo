import { useState, useRef, useEffect } from "react";

const TOOL_TYPES = ["Variable","Go/No-Go","Attribute"];
const SAMPLING_OPTIONS = [
  { value:"first_last", label:"First & Last" },
  { value:"every_5",   label:"Every 5th"    },
  { value:"every_10",  label:"Every 10th"   },
  { value:"100pct",    label:"100%"          },
];
function getSamplePieces(plan,qty){
  if(qty<=0) return [];
  switch(plan){
    case "first_last": return qty===1?[1]:[1,qty];
    case "every_5":  { const p=[]; for(let i=1;i<=qty;i+=5)p.push(i); if(p[p.length-1]!==qty)p.push(qty); return p; }
    case "every_10": { const p=[]; for(let i=1;i<=qty;i+=10)p.push(i); if(p[p.length-1]!==qty)p.push(qty); return p; }
    default: return Array.from({length:qty},(_,i)=>i+1);
  }
}
function samplingLabel(v){ return SAMPLING_OPTIONS.find(o=>o.value===v)?.label??v; }
const MISSING_REASONS = ["Scrapped","Lost","Damaged","Other"];
const OPERATOR_NAMES  = ["J. Morris","R. Tatum","D. Kowalski","S. Patel","L. Chen","M. Okafor","T. Brennan","A. Vasquez"];

const INITIAL_TOOLS = {
  "t01":{ id:"t01", name:"Outside Micrometer",   type:"Variable",  itNum:"IT-0042" },
  "t02":{ id:"t02", name:"Vernier Caliper",       type:"Variable",  itNum:"IT-0018" },
  "t03":{ id:"t03", name:"Bore Gauge",            type:"Variable",  itNum:"IT-0031" },
  "t04":{ id:"t04", name:"Inside Micrometer",     type:"Variable",  itNum:"IT-0029" },
  "t05":{ id:"t05", name:"Depth Micrometer",      type:"Variable",  itNum:"IT-0055" },
  "t06":{ id:"t06", name:"Height Gauge",          type:"Variable",  itNum:"IT-0011" },
  "t07":{ id:"t07", name:"Profilometer",          type:"Variable",  itNum:"IT-0063" },
  "t08":{ id:"t08", name:"CMM",                   type:"Variable",  itNum:"IT-0001" },
  "t09":{ id:"t09", name:"Plug Gauge",            type:"Go/No-Go",  itNum:"IT-0074" },
  "t10":{ id:"t10", name:"Thread Gauge",          type:"Go/No-Go",  itNum:"IT-0082" },
  "t11":{ id:"t11", name:"Ring Gauge",            type:"Go/No-Go",  itNum:"IT-0091" },
  "t12":{ id:"t12", name:"Snap Gauge",            type:"Go/No-Go",  itNum:"IT-0090" },
  "t13":{ id:"t13", name:"Surface Comparator",    type:"Attribute", itNum:"IT-0044" },
  "t14":{ id:"t14", name:"Optical Comparator",    type:"Attribute", itNum:"IT-0038" },
};

const INITIAL_PARTS = {
  "1234":{
    partNumber:"1234", description:"Hydraulic Cylinder Body",
    operations:{
      "10":{ label:"Rough Turn", dimensions:[
        { id:"d1", name:"Outer Diameter", nominal:1.0000, tolPlus:0.0050, tolMinus:0.0050, unit:"in", sampling:"first_last", tools:["t01","t02","t08"] },
        { id:"d2", name:"Overall Length",  nominal:2.5000, tolPlus:0.0100, tolMinus:0.0100, unit:"in", sampling:"first_last", tools:["t02","t06"] },
      ]},
      "20":{ label:"Bore & Finish", dimensions:[
        { id:"d3", name:"Bore Diameter",  nominal:0.6250, tolPlus:0.0030, tolMinus:0.0000, unit:"in", sampling:"100pct",    tools:["t03","t04","t09","t08"] },
        { id:"d4", name:"Surface Finish", nominal:32.0,   tolPlus:8.0,    tolMinus:8.0,    unit:"Ra", sampling:"first_last", tools:["t07","t13"] },
      ]},
      "30":{ label:"Thread & Final", dimensions:[
        { id:"d5", name:"Thread Pitch Dia", nominal:0.5000, tolPlus:0.0020, tolMinus:0.0020, unit:"in", sampling:"100pct",    tools:["t10","t08","t14"] },
        { id:"d6", name:"Chamfer Depth",    nominal:0.0620, tolPlus:0.0050, tolMinus:0.0050, unit:"in", sampling:"first_last", tools:["t05","t02"] },
      ]},
    },
  },
};
const INITIAL_JOBS = {
  "J-10041":{ jobNumber:"J-10041", partNumber:"1234", operation:"10", lot:"Lot A", qty:8,  status:"closed" },
  "J-10042":{ jobNumber:"J-10042", partNumber:"1234", operation:"20", lot:"Lot A", qty:12, status:"open"   },
  "J-10043":{ jobNumber:"J-10043", partNumber:"1234", operation:"30", lot:"Lot A", qty:12, status:"open"   },
  "J-10044":{ jobNumber:"J-10044", partNumber:"1234", operation:"10", lot:"Lot B", qty:5,  status:"draft"  },
};
const INITIAL_RECORDS = [
  { id:"r001", jobNumber:"J-10041", partNumber:"1234", operation:"10", lot:"Lot A", qty:8,
    timestamp:"2026-03-07 06:42", operator:"J. Morris",
    values:{
      d1_1:"1.0021", d1_2:"1.0018", d1_3:"0.9998", d1_4:"1.0003",
      d1_5:"1.0055", d1_6:"1.0009", d1_7:"0.9991", d1_8:"0.9988",
      d2_1:"2.4982", d2_2:"2.5004", d2_3:"2.4997", d2_4:"2.5011",
      d2_5:"2.4993", d2_6:"2.5006", d2_7:"2.4988", d2_8:"2.5018",
    },
    tools:{ d1:{toolId:"t01",itNum:"IT-0042"}, d2:{toolId:"t02",itNum:"IT-0018"} },
    missingPieces:{}, oot:true, status:"complete",
    comment:"Piece 5 Outer Diameter reads 1.0055 — exceeds +.0050 tolerance by 0.0005. Reviewed with supervisor D. Kowalski. Piece accepted per engineering disposition ENG-2026-031. No corrective action required at this time." },
];

function isOOT(value,tolPlus,tolMinus,nominal){
  const v=parseFloat(value);
  if(isNaN(v)||value==="") return null;
  return (v>nominal+tolPlus)||(v<nominal-tolMinus);
}
function fmtSpec(dim){
  const dec=dim.unit==="Ra"?1:4;
  const n=parseFloat(dim.nominal).toFixed(dec);
  const p=parseFloat(dim.tolPlus).toFixed(dec);
  const m=parseFloat(dim.tolMinus).toFixed(dec);
  return p===m?`${n} \u00b1${p} ${dim.unit}`:`${n} +${p}/\u2212${m} ${dim.unit}`;
}
function uid(){ return Math.random().toString(36).slice(2,8); }
function nowStr(){ return new Date().toISOString().slice(0,16).replace("T"," "); }

function TypeBadge({ type, small }){
  const s=small?{fontSize:".58rem",padding:".08rem .3rem"}:{};
  if(type==="Go/No-Go") return <span className="tbadge tbadge-gng" style={s}>Go/No-Go</span>;
  if(type==="Attribute") return <span className="tbadge tbadge-attr" style={s}>Attribute</span>;
  return <span className="tbadge tbadge-var" style={s}>Variable</span>;
}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0d1017;--surface:#141820;--panel:#1a1f2c;--panel2:#1f2535;
  --border:#252d40;--border2:#2e3a52;--text:#c8d0e4;--muted:#5a6480;
  --accent:#d4891a;--accent2:#f0a830;--ok:#27c76a;--warn:#e03535;
  --info:#2e88d4;--draft:#9b6fd4;--incomplete:#d4a017;
  --mono:'Share Tech Mono',monospace;--sans:'Barlow',sans-serif;--cond:'Barlow Condensed',sans-serif;
}
html,body{background:var(--bg);color:var(--text);font-family:var(--sans);min-height:100vh;font-size:15px}
.app-header{background:var(--surface);border-bottom:2px solid var(--accent);padding:0 1.75rem;display:flex;align-items:center;gap:1.5rem;height:54px;position:sticky;top:0;z-index:200}
.logo{font-family:var(--cond);font-size:1.1rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--accent2);display:flex;align-items:center;gap:.5rem}
.logo-icon{width:22px;height:22px;position:relative;flex-shrink:0}
.logo-icon::before{content:"";position:absolute;inset:2px;border:2px solid var(--accent);border-radius:2px}
.logo-icon::after{content:"";position:absolute;width:8px;height:8px;background:var(--accent);top:50%;left:50%;transform:translate(-50%,-50%)}
.header-sep{width:1px;height:22px;background:var(--border2)}
.header-sub{font-size:.68rem;color:var(--muted);letter-spacing:.12em;text-transform:uppercase}
.nav{display:flex;margin-left:auto}
.nav-btn{background:none;border:none;cursor:pointer;font-family:var(--cond);font-size:.82rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);padding:.4rem 1.1rem;border-bottom:2px solid transparent;margin-bottom:-2px;transition:color .15s,border-color .15s}
.nav-btn:hover{color:var(--text)}.nav-btn.active{color:var(--accent2);border-bottom-color:var(--accent2)}
.page{padding:1.75rem;max-width:1100px;margin:0 auto}
.card{background:var(--surface);border:1px solid var(--border);border-radius:3px;margin-bottom:1rem}
.card-head{padding:.65rem 1.25rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:var(--panel);border-radius:3px 3px 0 0}
.card-title{font-family:var(--cond);font-size:.72rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.card-body{padding:1.25rem}
.field{display:flex;flex-direction:column;gap:.3rem}
.field label{font-size:.68rem;color:var(--muted);letter-spacing:.1em;text-transform:uppercase}
input,select,textarea{width:100%;background:var(--panel2);border:1px solid var(--border2);color:var(--text);font-family:var(--sans);font-size:.88rem;padding:.5rem .7rem;border-radius:2px;outline:none;transition:border-color .15s}
input:focus,select:focus,textarea:focus{border-color:var(--accent)}
textarea{resize:vertical;min-height:68px;font-size:.84rem}
select option{background:var(--panel2)}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
.row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem}
.ac-wrap{position:relative}
.ac-list{position:absolute;top:100%;left:0;right:0;background:var(--panel);border:1px solid var(--accent);border-top:none;border-radius:0 0 3px 3px;z-index:400;max-height:200px;overflow-y:auto}
.ac-item{padding:.45rem .75rem;font-size:.84rem;cursor:pointer;transition:background .1s}
.ac-item:hover,.ac-item.hi{background:var(--panel2);color:var(--accent2)}
.ac-sub{font-size:.7rem;color:var(--muted);margin-top:.1rem;font-family:var(--mono)}
.btn{display:inline-flex;align-items:center;gap:.35rem;font-family:var(--cond);font-size:.8rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:.5rem 1.25rem;border-radius:2px;cursor:pointer;border:none;transition:all .15s;white-space:nowrap}
.btn:disabled{opacity:.35;cursor:not-allowed}
.btn-primary{background:var(--accent);color:#000}.btn-primary:not(:disabled):hover{background:var(--accent2)}
.btn-ghost{background:var(--panel2);color:var(--text);border:1px solid var(--border2)}.btn-ghost:hover{border-color:var(--accent);color:var(--accent2)}
.btn-draft{background:var(--panel2);color:var(--draft);border:1px solid var(--draft)}.btn-draft:hover{background:#1e1530}
.btn-partial{background:var(--panel2);color:var(--incomplete);border:1px solid var(--incomplete)}.btn-partial:hover{background:#1e1a0a}
.btn-danger{background:transparent;color:var(--warn);border:1px solid #6b2020}.btn-danger:hover{background:#2a0d0d}
.btn-sm{padding:.28rem .65rem;font-size:.7rem}
.btn-xs{padding:.18rem .45rem;font-size:.65rem}
.job-strip{background:var(--panel);border:1px solid var(--border2);border-left:3px solid var(--accent);border-radius:3px;padding:.85rem 1.25rem;display:flex;flex-wrap:wrap;gap:2rem;align-items:center;margin-bottom:1rem}
.strip-field{display:flex;flex-direction:column;gap:.15rem}
.strip-label{font-size:.62rem;color:var(--muted);letter-spacing:.12em;text-transform:uppercase}
.strip-val{font-family:var(--mono);font-size:.9rem;color:var(--accent2)}
.meas-scroll{overflow-x:auto}
.meas-table{border-collapse:collapse;font-size:.82rem;table-layout:fixed}
.meas-table .rl{width:118px;background:var(--panel);border-right:2px solid var(--border2);font-family:var(--cond);font-size:.67rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);padding:.42rem .85rem;white-space:nowrap;text-align:right;vertical-align:middle}
.meas-table .dc{width:160px;border-right:1px solid var(--border);vertical-align:top;overflow:hidden}
.meas-table .dc:last-child{border-right:none}
.meas-table .hrow td{border-bottom:1px solid var(--border);vertical-align:top}
.dim-hdr{padding:.55rem .7rem .35rem}
.dim-hdr-name{font-family:var(--cond);font-size:.8rem;font-weight:700;color:var(--text);letter-spacing:.04em;word-break:break-word}
.dim-hdr-spec{font-family:var(--mono);font-size:.68rem;color:var(--muted);margin-top:.15rem}
.hdr-cell{padding:.3rem .6rem;vertical-align:middle}
.hdr-inp{width:100%;background:var(--panel);border:1px solid var(--border2);color:var(--text);font-family:var(--sans);font-size:.78rem;padding:.32rem .5rem;border-radius:2px;outline:none;transition:border-color .15s}
.hdr-inp:focus{border-color:var(--accent)}
.hdr-inp.mf{font-family:var(--mono);font-size:.75rem}
.tag-cell{padding:.32rem .6rem;vertical-align:middle}
.sample-tag{display:inline-block;font-family:var(--mono);font-size:.62rem;background:var(--panel2);border:1px solid var(--border2);color:var(--info);padding:.1rem .35rem;border-radius:2px;white-space:nowrap;text-transform:uppercase;letter-spacing:.05em;margin-right:.2rem;margin-bottom:.2rem}
.gauge-tag{display:inline-block;font-family:var(--mono);font-size:.62rem;background:#1a0d2e;border:1px solid #5a3080;color:#b080f0;padding:.1rem .35rem;border-radius:2px;white-space:nowrap;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.2rem}
.meas-table .div-row td{border-bottom:2px solid var(--accent) !important;padding:0 !important;height:2px;line-height:0;font-size:0}
.meas-table .pr td{padding:.26rem .4rem;border-bottom:1px solid var(--border);vertical-align:middle}
.meas-table .pr:last-child td{border-bottom:none}
.meas-table .pr:hover td{background:rgba(255,255,255,.018)}
.meas-table .pr.mr td{background:#180d0d}
.vi{font-family:var(--mono) !important;font-size:.86rem !important;text-align:center !important;padding:.28rem .3rem !important;background:var(--panel2) !important;width:100%;display:block}
.vi.ok{border-color:var(--ok) !important;color:var(--ok)}
.vi.oot{border-color:var(--warn) !important;color:var(--warn)}
.vi.ux{border-color:var(--info) !important;border-style:dashed !important}
.na-btn{display:block;width:100%;background:none;border:1px dashed var(--border2);color:var(--border2);border-radius:2px;padding:.24rem .3rem;font-family:var(--mono);font-size:.78rem;cursor:pointer;transition:all .15s;text-align:center}
.na-btn:hover{border-color:var(--info);color:var(--info)}
.ue-wrap{display:flex;align-items:center;gap:.2rem}
.ue-wrap .vi{flex:1}
.relock-btn{background:none;border:none;cursor:pointer;color:var(--muted);font-size:.85rem;line-height:1;padding:.1rem;flex-shrink:0}.relock-btn:hover{color:var(--warn)}
.pf-wrap{display:flex;gap:.2rem}
.pf-btn{flex:1;padding:.24rem .1rem;border-radius:2px;font-family:var(--cond);font-size:.67rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;border:1px solid var(--border2);background:var(--panel2);color:var(--muted);transition:all .15s}
.pf-btn.pass-on{background:#0b2318;border-color:var(--ok);color:var(--ok)}
.pf-btn.fail-on{background:#2a0d0d;border-color:var(--warn);color:var(--warn)}
.mp-tag{display:inline-flex;align-items:center;font-size:.6rem;color:var(--warn);font-family:var(--mono);background:#2a0d0d;border:1px solid #6b2020;border-radius:2px;padding:.08rem .3rem;margin-top:.15rem;white-space:nowrap}
.tbadge{display:inline-block;font-family:var(--mono);font-size:.65rem;padding:.12rem .4rem;border-radius:2px;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap}
.tbadge-var{background:#0d1f2e;color:var(--info);border:1px solid #1e4a6e}
.tbadge-gng{background:#1a0d2e;color:#b080f0;border:1px solid #5a3080}
.tbadge-attr{background:#1a1208;color:var(--incomplete);border:1px solid #5a4010}
.tool-search-wrap{position:relative}
.tool-popover{position:absolute;top:calc(100% + 4px);left:0;min-width:290px;background:var(--surface);border:1px solid var(--accent);border-radius:3px;z-index:500;box-shadow:0 8px 24px rgba(0,0,0,.55);padding:.65rem}
.tool-pop-filters{display:flex;gap:.35rem;margin-bottom:.5rem;flex-wrap:wrap}
.tpf-btn{background:var(--panel2);border:1px solid var(--border2);color:var(--muted);font-family:var(--cond);font-size:.65rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;padding:.2rem .55rem;border-radius:2px;cursor:pointer;transition:all .15s}
.tpf-btn.on{border-color:var(--accent);color:var(--accent2);background:var(--panel)}
.tool-pop-list{max-height:175px;overflow-y:auto;display:flex;flex-direction:column;gap:.22rem}
.tool-pop-item{display:flex;align-items:center;justify-content:space-between;padding:.3rem .5rem;background:var(--panel);border:1px solid var(--border2);border-radius:2px;cursor:pointer;transition:background .1s}
.tool-pop-item:hover{background:var(--panel2)}
.tool-pop-item.added{border-color:#1a5c38;cursor:default}
.tpi-name{font-size:.8rem;color:var(--text)}
.tpi-it{font-family:var(--mono);font-size:.68rem;color:var(--muted)}
.dim-tool-list{display:flex;flex-wrap:wrap;gap:.25rem;margin-bottom:.4rem;min-height:10px}
.dim-tool-tag{display:inline-flex;align-items:center;gap:.3rem;background:var(--panel2);border:1px solid var(--border2);border-radius:2px;padding:.15rem .45rem;font-size:.75rem;color:var(--text)}
.dim-tool-tag .rm{background:none;border:none;cursor:pointer;color:var(--muted);font-size:.78rem;line-height:1}.dim-tool-tag .rm:hover{color:var(--warn)}
.badge{display:inline-flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:.63rem;letter-spacing:.05em;padding:.15rem .45rem;border-radius:2px;text-transform:uppercase;white-space:nowrap}
.badge-ok{background:#0b2318;color:var(--ok);border:1px solid #1a5c38}
.badge-oot{background:#2a0d0d;color:var(--warn);border:1px solid #6b2020}
.badge-open{background:#0d1f2e;color:var(--info);border:1px solid #1e4a6e}
.badge-closed{background:var(--panel2);color:var(--muted);border:1px solid var(--border2)}
.badge-draft{background:#1a1030;color:var(--draft);border:1px solid var(--draft)}
.badge-incomplete{background:#1e1a0a;color:var(--incomplete);border:1px solid var(--incomplete)}
.badge-pend{background:var(--panel2);color:var(--muted);border:1px solid var(--border)}
.oot-banner{background:#200e0e;border:1px solid #6b2020;border-left:3px solid var(--warn);border-radius:3px;padding:.9rem 1.25rem;display:flex;gap:.9rem;align-items:flex-start;margin-bottom:1rem}
.oot-icon{color:var(--warn);font-size:1.1rem;flex-shrink:0}
.oot-title{font-family:var(--cond);font-size:.78rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--warn)}
.oot-body{font-size:.76rem;color:#a07070;margin-top:.2rem;line-height:1.5}
.inc-banner{background:#1a1208;border:1px solid #5a4010;border-left:3px solid var(--incomplete);border-radius:3px;padding:.9rem 1.25rem;margin-bottom:1rem}
.inc-title{font-family:var(--cond);font-size:.78rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--incomplete);margin-bottom:.5rem}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:600;display:flex;align-items:center;justify-content:center;padding:1rem}
.modal{background:var(--surface);border:1px solid var(--border2);border-top:2px solid var(--accent);border-radius:4px;width:100%;max-width:500px;padding:1.5rem;max-height:90vh;overflow-y:auto}
.modal-title{font-family:var(--cond);font-size:1rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--accent2);margin-bottom:1.25rem}
.success-card{background:#0a1e12;border:1px solid #1a5c38;border-left:3px solid var(--ok);border-radius:3px;padding:2rem;text-align:center;display:flex;flex-direction:column;align-items:center;gap:.75rem}
.success-title{font-family:var(--cond);font-size:1.1rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ok)}
.draft-card{background:#120e1e;border:1px solid var(--draft);border-left:3px solid var(--draft);border-radius:3px;padding:2rem;text-align:center;display:flex;flex-direction:column;align-items:center;gap:.75rem}
.draft-title{font-family:var(--cond);font-size:1.1rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--draft)}
.sub-tabs{display:flex;border-bottom:1px solid var(--border2);margin-bottom:1.25rem}
.sub-tab{background:none;border:none;cursor:pointer;font-family:var(--cond);font-size:.78rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);padding:.55rem 1.2rem;border-bottom:2px solid transparent;margin-bottom:-1px;transition:color .15s,border-color .15s}
.sub-tab.active{color:var(--accent2);border-bottom-color:var(--accent2)}
.sub-tab:hover:not(.active){color:var(--text)}
.data-table{width:100%;border-collapse:collapse;font-size:.8rem}
.data-table thead th{font-family:var(--cond);font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);padding:.5rem .85rem;text-align:left;border-bottom:1px solid var(--border2);background:var(--panel)}
.data-table tbody tr{border-bottom:1px solid var(--border);transition:background .1s}
.data-table tbody tr:hover{background:var(--panel)}
.data-table tbody td{padding:.5rem .85rem;vertical-align:middle}
.edit-table{width:100%;border-collapse:collapse;font-size:.8rem}
.edit-table th{font-family:var(--cond);font-size:.64rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);padding:.45rem .6rem;text-align:left;border-bottom:1px solid var(--border2);background:var(--panel);white-space:nowrap}
.edit-table td{padding:.35rem .4rem;border-bottom:1px solid var(--border);vertical-align:middle}
.edit-table tr:last-child td{border-bottom:none}
.edit-table input,.edit-table select{padding:.28rem .45rem;font-size:.78rem;background:var(--panel);border:1px solid var(--border2)}
.mt1{margin-top:.75rem}.mt2{margin-top:1.25rem}
.gap1{display:flex;gap:.75rem;align-items:center;flex-wrap:wrap}
.text-muted{color:var(--muted);font-size:.78rem}
.text-warn{color:var(--warn)}.text-ok{color:var(--ok)}
.mono{font-family:var(--mono) !important}.accent-text{color:var(--accent2) !important}
.section-label{font-family:var(--cond);font-size:.7rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--info);margin-bottom:.6rem}
.empty-state{padding:2.5rem;text-align:center;color:var(--muted);font-size:.82rem}
.tr-click{cursor:pointer}
.err-text{color:var(--warn);font-size:.75rem;margin-top:.3rem}
.search-inp{background:var(--panel2);border:1px solid var(--border2);color:var(--text);font-family:var(--sans);font-size:.84rem;padding:.4rem .65rem;border-radius:2px;outline:none;transition:border-color .15s;width:100%}
.search-inp:focus{border-color:var(--accent)}
.rec-modal{background:var(--surface);border:1px solid var(--border2);border-top:2px solid var(--accent);border-radius:4px;width:100%;max-width:820px;padding:0;max-height:92vh;overflow:hidden;display:flex;flex-direction:column}
.rec-modal-head{padding:1rem 1.5rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.rec-modal-body{overflow-y:auto;padding:1.25rem 1.5rem;flex:1}
.rec-strip{display:flex;flex-wrap:wrap;gap:1.5rem;padding:.85rem 1.25rem;background:var(--panel);border:1px solid var(--border2);border-left:3px solid var(--accent);border-radius:3px;margin-bottom:1.1rem}
.rec-field{display:flex;flex-direction:column;gap:.12rem}
.rec-label{font-size:.6rem;color:var(--muted);letter-spacing:.12em;text-transform:uppercase}
.rec-val{font-family:var(--mono);font-size:.85rem;color:var(--accent2)}
.det-table{width:100%;border-collapse:collapse;font-size:.8rem}
.det-table th{font-family:var(--cond);font-size:.64rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);padding:.4rem .65rem;text-align:left;border-bottom:1px solid var(--border2);background:var(--panel);white-space:nowrap}
.det-table td{padding:.38rem .65rem;border-bottom:1px solid var(--border);vertical-align:middle}
.det-table tr:last-child td{border-bottom:none}
.det-table .val-ok{font-family:var(--mono);font-size:.82rem;color:var(--ok)}
.det-table .val-oot{font-family:var(--mono);font-size:.82rem;color:var(--warn);font-weight:700}
.det-table .val-na{font-family:var(--mono);font-size:.78rem;color:var(--border2)}
.det-section{font-family:var(--cond);font-size:.68rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--info);padding:.6rem 0 .35rem;border-bottom:1px solid var(--border2);margin-bottom:.5rem}
.it-reminder{font-family:var(--mono);font-size:.68rem;color:var(--info);margin-top:.22rem;padding:.1rem .35rem;background:#0d1f2e;border:1px solid #1e4a6e;border-radius:2px;display:inline-block}
.meas-table .dc{position:relative}
.col-resize{position:absolute;top:0;right:0;width:5px;height:100%;cursor:col-resize;z-index:10;background:transparent;user-select:none}
.col-resize:hover,.col-resize.dragging{background:var(--accent)}
`;

function AutocompleteInput({ value, onChange, options, placeholder, style, renderOption, filterFn }) {
  const [open,setOpen]=useState(false);
  const [cursor,setCursor]=useState(-1);
  const ref=useRef();
  const filtered=options.filter(o=>filterFn?filterFn(o,value):o.toLowerCase().includes(value.toLowerCase()));
  const show=open&&filtered.length>0&&value.length>0;
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);
  function pick(v){onChange(v);setOpen(false);setCursor(-1);}
  return (
    <div className="ac-wrap" ref={ref}>
      <input value={value} placeholder={placeholder} style={style} autoComplete="off"
        onChange={e=>{onChange(e.target.value);setOpen(true);setCursor(-1);}}
        onFocus={()=>setOpen(true)}
        onKeyDown={e=>{
          if(!show)return;
          if(e.key==="ArrowDown"){e.preventDefault();setCursor(c=>Math.min(c+1,filtered.length-1));}
          if(e.key==="ArrowUp"){e.preventDefault();setCursor(c=>Math.max(c-1,0));}
          if(e.key==="Enter"&&cursor>=0){e.preventDefault();const o=filtered[cursor];pick(typeof o==="object"?o.value:o);}
          if(e.key==="Escape")setOpen(false);
        }} />
      {show&&(
        <div className="ac-list">
          {filtered.map((o,i)=>{
            const v=typeof o==="object"?o.value:o;
            return <div key={v} className={`ac-item${cursor===i?" hi":""}`} onMouseDown={()=>pick(v)}>
              {renderOption?renderOption(o):<span>{v}</span>}
            </div>;
          })}
        </div>
      )}
    </div>
  );
}

function ToolSearchPopover({ toolLibrary, selectedIds, onAdd, onRemove }) {
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState("");
  const [tf,setTf]=useState("All");
  const ref=useRef();
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);
  const filtered=Object.values(toolLibrary).filter(t=>{
    const ms=!search||t.name.toLowerCase().includes(search.toLowerCase())||t.itNum.toLowerCase().includes(search.toLowerCase());
    return ms&&(tf==="All"||t.type===tf);
  });
  return (
    <div className="tool-search-wrap" ref={ref}>
      <div className="dim-tool-list">
        {selectedIds.map(id=>{
          const t=toolLibrary[id];if(!t)return null;
          return <span className="dim-tool-tag" key={id}><TypeBadge type={t.type} small/>{t.name}<button className="rm" onClick={()=>onRemove(id)}>×</button></span>;
        })}
      </div>
      <button className="btn btn-ghost btn-xs" onClick={()=>setOpen(o=>!o)}>+ Add Tool</button>
      {open&&(
        <div className="tool-popover">
          <input className="search-inp" style={{marginBottom:".45rem"}} placeholder="Search name or IT #…"
            value={search} onChange={e=>setSearch(e.target.value)} autoFocus />
          <div className="tool-pop-filters">
            {["All",...TOOL_TYPES].map(t=>(
              <button key={t} className={`tpf-btn${tf===t?" on":""}`} onClick={()=>setTf(t)}>{t}</button>
            ))}
          </div>
          <div className="tool-pop-list">
            {filtered.length===0&&<div style={{fontSize:".75rem",color:"var(--muted)",padding:".5rem"}}>No tools match.</div>}
            {filtered.map(t=>{
              const added=selectedIds.includes(t.id);
              return (
                <div key={t.id} className={`tool-pop-item${added?" added":""}`} onClick={()=>{if(!added)onAdd(t.id);}}>
                  <div><div className="tpi-name">{t.name}</div><div className="tpi-it">{t.itNum}</div></div>
                  <div style={{display:"flex",alignItems:"center",gap:".4rem"}}>
                    <TypeBadge type={t.type} small/>
                    {added&&<span style={{color:"var(--ok)",fontSize:".7rem"}}>✔</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MissingPieceModal({ pieces, missingPieces, onSave, onCancel }) {
  const [local,setLocal]=useState(()=>{
    const m={};pieces.forEach(p=>{m[p]=missingPieces[p]||{reason:"",ncNum:"",details:""};});return m;
  });
  const valid=pieces.every(p=>local[p]?.reason&&!(local[p]?.reason==="Scrapped"&&!local[p]?.ncNum));
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-title">Missing Piece Justification</div>
        <p className="text-muted" style={{marginBottom:"1rem",lineHeight:1.5}}>Pieces {pieces.join(", ")} have incomplete data. Provide a reason for each.</p>
        {pieces.map(p=>(
          <div key={p} style={{marginBottom:"1rem",padding:".75rem",background:"var(--panel)",borderRadius:"3px",border:"1px solid var(--border2)"}}>
            <div style={{fontFamily:"var(--mono)",fontSize:".8rem",color:"var(--accent2)",marginBottom:".5rem"}}>Piece {p}</div>
            <div className="row2" style={{gap:".6rem"}}>
              <div className="field"><label>Reason</label>
                <select value={local[p]?.reason||""} onChange={e=>setLocal(v=>({...v,[p]:{...v[p],reason:e.target.value}}))}>
                  <option value="">— Select —</option>
                  {MISSING_REASONS.map(r=><option key={r} value={r}>{r}</option>)}
                </select></div>
              <div className="field"><label>NC # {local[p]?.reason==="Scrapped"?"(Required)":"(Opt.)"}</label>
                <input value={local[p]?.ncNum||""} placeholder="NC-2026-041" style={{fontFamily:"var(--mono)"}}
                  onChange={e=>setLocal(v=>({...v,[p]:{...v[p],ncNum:e.target.value}}))} /></div>
            </div>
            {local[p]?.reason==="Other"&&(
              <div className="field" style={{marginTop:".5rem"}}><label>Details</label>
                <input value={local[p]?.details||""} placeholder="Describe reason…" onChange={e=>setLocal(v=>({...v,[p]:{...v[p],details:e.target.value}}))} /></div>
            )}
            {local[p]?.reason==="Scrapped"&&!local[p]?.ncNum&&<p className="err-text">NC # required for scrapped pieces</p>}
          </div>
        ))}
        <div className="gap1 mt2">
          <button className="btn btn-partial" disabled={!valid} onClick={()=>onSave(local)}>Confirm &amp; Partial Submit</button>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function OperatorView({ parts, jobs, toolLibrary, onSubmit, onDraft }) {
  const [step,setStep]=useState("lookup");
  const [jobInput,setJobInput]=useState("");
  const [currentJob,setCurrentJob]=useState(null);
  const [values,setValues]=useState({});
  const [toolSel,setToolSel]=useState({});
  const [unlocked,setUnlocked]=useState({});
  const [missing,setMissing]=useState({});
  const [comment,setComment]=useState("");
  const [opName,setOpName]=useState("");
  const [showModal,setShowModal]=useState(false);
  const [colWidths,setColWidths]=useState({});

  const part=currentJob?parts[currentJob.partNumber]:null;
  const opData=part?part.operations[currentJob.operation]:null;
  const dims=opData?.dimensions??[];

  function getColWidth(dimId){ return colWidths[dimId]||160; }
  function startResize(e,dimId){
    e.preventDefault();
    const startX=e.clientX;
    const startW=getColWidth(dimId);
    function onMove(ev){ setColWidths(p=>({...p,[dimId]:Math.max(110,startW+ev.clientX-startX)})); }
    function onUp(){ document.removeEventListener("mousemove",onMove);document.removeEventListener("mouseup",onUp); }
    document.addEventListener("mousemove",onMove);document.addEventListener("mouseup",onUp);
  }

  const allPieces=dims.length>0
    ?[...new Set(dims.flatMap(d=>getSamplePieces(d.sampling,currentJob.qty)))].sort((a,b)=>a-b):[];

  function isGaugeMode(dimId){
    const tid=toolSel[dimId]?.toolId;
    return !!(tid&&toolLibrary[tid]?.type==="Go/No-Go");
  }
  function cellRequired(dimId,pNum){
    const inPlan=getSamplePieces(dims.find(d=>d.id===dimId)?.sampling,currentJob.qty).includes(pNum);
    if(inPlan)return true;
    const key=`${dimId}_${pNum}`;
    return !!(unlocked[key]&&(values[key]||"")!=="");
  }

  const hasStarted=Object.values(values).some(v=>v!==undefined&&v!=="");
  const incompletePieces=dims.length>0?allPieces.filter(pNum=>{
    if(missing[pNum])return false;
    return dims.some(dim=>cellRequired(dim.id,pNum)&&(values[`${dim.id}_${pNum}`]??"")==="");
  }):[];
  const ootList=dims.flatMap(dim=>{
    if(isGaugeMode(dim.id))return [];
    return getSamplePieces(dim.sampling,currentJob.qty)
      .filter(p=>!missing[p]&&isOOT(values[`${dim.id}_${p}`],dim.tolPlus,dim.tolMinus,dim.nominal)===true)
      .map(p=>({dim,piece:p}));
  });
  const hasOOT=ootList.length>0;
  const toolsReady=dims.every(d=>toolSel[d.id]?.toolId&&toolSel[d.id]?.itNum);
  const canFull=toolsReady&&incompletePieces.length===0&&!(hasOOT&&!comment.trim());
  const canPartial=toolsReady&&incompletePieces.length>0;

  function loadJob(key){
    const job=jobs[key?.trim().toUpperCase()];
    if(!job||(job.status!=="open"&&job.status!=="draft"))return;
    const dd=job.status==="draft"&&job.draftData;
    const ts={};
    parts[job.partNumber]?.operations[job.operation]?.dimensions.forEach(d=>{
      const firstId=d.tools[0]||"";
      ts[d.id]=dd?.toolSel?.[d.id]||{toolId:firstId,itNum:toolLibrary[firstId]?.itNum||""};
    });
    setCurrentJob(job);setValues(dd?.values||{});setToolSel(ts);
    setUnlocked(dd?.unlocked||{});setMissing(dd?.missing||{});setComment(dd?.comment||"");
    setStep("entry");
  }
  function buildRecord(status,rm){
    return {id:"r"+Date.now(),jobNumber:currentJob.jobNumber,partNumber:currentJob.partNumber,
      operation:currentJob.operation,lot:currentJob.lot,qty:currentJob.qty,
      timestamp:nowStr(),operator:opName.trim(),values,tools:toolSel,unlocked,
      missingPieces:rm||missing,oot:hasOOT,status,comment};
  }
  function handleFull(){onSubmit(buildRecord("complete"),currentJob.jobNumber,"closed");setStep("success");}
  function handleMissingSave(r){setMissing(r);setShowModal(false);onSubmit(buildRecord("incomplete",r),currentJob.jobNumber,"incomplete");setStep("success");}
  function handleDraft(){onDraft({jobNumber:currentJob.jobNumber,draftData:{values,toolSel,unlocked,missing,comment,opName}});setStep("saved");}
  function reset(){setStep("lookup");setJobInput("");setCurrentJob(null);setValues({});setToolSel({});setUnlocked({});setMissing({});setComment("");}

  const openJobs=Object.values(jobs).filter(j=>j.status==="open"||j.status==="draft");

  if(step==="lookup") return (
    <div>
      <div className="card">
        <div className="card-head"><div className="card-title">Job Entry</div></div>
        <div className="card-body">
          <div className="row3">
            <div className="field" style={{gridColumn:"span 2"}}>
              <label>Job Number</label>
              <AutocompleteInput value={jobInput} onChange={setJobInput}
                options={openJobs.map(j=>({value:j.jobNumber,job:j}))}
                filterFn={(o,inp)=>o.value.toLowerCase().includes(inp.toLowerCase())}
                placeholder="e.g. J-10042" style={{fontFamily:"var(--mono)",fontSize:"1.05rem"}}
                renderOption={o=>(
                  <div>
                    <span style={{fontFamily:"var(--mono)",color:"var(--accent2)"}}>{o.value}</span>
                    {o.job.status==="draft"&&<span className="badge badge-draft" style={{marginLeft:".5rem",fontSize:".6rem"}}>Draft</span>}
                    <div className="ac-sub">Part {o.job.partNumber} · Op {o.job.operation} · {o.job.lot} · Qty {o.job.qty}</div>
                  </div>
                )} />
              {jobInput&&!jobs[jobInput.toUpperCase()]&&<p className="text-muted mt1" style={{fontSize:".75rem"}}>Job not found.</p>}
              {jobInput&&jobs[jobInput.toUpperCase()]?.status==="closed"&&<p className="mt1 text-warn" style={{fontSize:".75rem"}}>Job is closed.</p>}
              {(jobs[jobInput.toUpperCase()]?.status==="open"||jobs[jobInput.toUpperCase()]?.status==="draft")&&jobInput&&<p className="mt1 text-ok" style={{fontSize:".75rem"}}>Job found.</p>}
            </div>
            <div className="field">
              <label>Operator Name <span style={{color:"var(--warn)"}}>*</span></label>
              <AutocompleteInput value={opName} onChange={setOpName} options={OPERATOR_NAMES} placeholder="Select or type name…" />
            </div>
          </div>
          <div className="mt2">
            <button className="btn btn-primary"
              disabled={!jobs[jobInput.toUpperCase()]||(jobs[jobInput.toUpperCase()]?.status!=="open"&&jobs[jobInput.toUpperCase()]?.status!=="draft")||!opName.trim()}
              onClick={()=>loadJob(jobInput)}>Load Job →</button>
          </div>
        </div>
      </div>
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <div className="card-head"><div className="card-title">Available Jobs</div><div className="text-muted" style={{fontSize:".7rem"}}>Click to select</div></div>
        <table className="data-table">
          <thead><tr><th>Job #</th><th>Part</th><th>Operation</th><th>Lot</th><th>Qty</th><th>Status</th></tr></thead>
          <tbody>
            {openJobs.length===0&&<tr><td colSpan={6}><div className="empty-state">No open jobs.</div></td></tr>}
            {openJobs.map(j=>(
              <tr key={j.jobNumber} className="tr-click" onClick={()=>setJobInput(j.jobNumber)}>
                <td className="mono accent-text">{j.jobNumber}</td>
                <td className="mono">{j.partNumber}</td>
                <td>Op {j.operation} — {parts[j.partNumber]?.operations[j.operation]?.label}</td>
                <td>{j.lot}</td><td className="mono">{j.qty}</td>
                <td>{j.status==="draft"?<span className="badge badge-draft">Draft</span>:<span className="badge badge-open">Open</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if(step==="entry") return (
    <div>
      {showModal&&<MissingPieceModal pieces={incompletePieces} missingPieces={missing} onSave={handleMissingSave} onCancel={()=>setShowModal(false)}/>}
      <div className="job-strip">
        <div className="strip-field"><div className="strip-label">Job #</div><div className="strip-val">{currentJob.jobNumber}</div></div>
        <div className="strip-field"><div className="strip-label">Part</div><div className="strip-val">{currentJob.partNumber} <span style={{fontFamily:"var(--sans)",fontSize:".78rem",color:"var(--muted)"}}>{part?.description}</span></div></div>
        <div className="strip-field"><div className="strip-label">Operation</div><div className="strip-val">Op {currentJob.operation} — <span style={{fontFamily:"var(--sans)",fontSize:".82rem",color:"var(--text)"}}>{opData?.label}</span></div></div>
        <div className="strip-field"><div className="strip-label">Lot</div><div className="strip-val">{currentJob.lot}</div></div>
        <div className="strip-field"><div className="strip-label">Qty</div><div className="strip-val">{currentJob.qty} pcs</div></div>
        <div className="strip-field"><div className="strip-label">Operator</div><div className="strip-val" style={{fontFamily:"var(--sans)",fontSize:".85rem",color:"var(--text)"}}>{opName}</div></div>
        <button className="btn btn-ghost btn-sm" style={{marginLeft:"auto"}} onClick={reset}>← Back</button>
      </div>

      <div className="card" style={{padding:0}}>
        <div className="card-head">
          <div className="card-title">Measurement Entry</div>
          <div className="text-muted" style={{fontSize:".7rem"}}>+ unlocks N/A cells · × re-locks empty cells · drag column edges to resize</div>
        </div>
        <div className="meas-scroll">
          <table className="meas-table" style={{width: 118 + dims.reduce((s,d)=>s+getColWidth(d.id),0)}}>
            <colgroup>
              <col style={{width:"118px"}}/>
              {dims.map(d=><col key={d.id} style={{width:getColWidth(d.id)+"px"}}/>)}
            </colgroup>
            <tbody>
              <tr className="hrow">
                <td className="rl">Dimension</td>
                {dims.map(d=>(
                  <td key={d.id} className="dc" style={{padding:0,verticalAlign:"top",position:"relative"}}>
                    <div className="dim-hdr"><div className="dim-hdr-name">{d.name}</div><div className="dim-hdr-spec">{fmtSpec(d)}</div></div>
                    <div className="col-resize" onMouseDown={e=>startResize(e,d.id)}/>
                  </td>
                ))}
              </tr>
              <tr className="hrow">
                <td className="rl">Tool</td>
                {dims.map(d=>{
                  const selTool = toolLibrary[toolSel[d.id]?.toolId];
                  return (
                    <td key={d.id} className="dc hdr-cell" style={{verticalAlign:"top"}}>
                      <select className="hdr-inp" value={toolSel[d.id]?.toolId||""}
                        onChange={e=>{const tid=e.target.value;setToolSel(p=>({...p,[d.id]:{toolId:tid,itNum:toolLibrary[tid]?.itNum||""}}));}}>
                        <option value="">— Select —</option>
                        {d.tools.map(tid=>{const t=toolLibrary[tid];return t?<option key={tid} value={tid}>{t.name}</option>:null;})}
                      </select>
                      {selTool && <div className="it-reminder">{selTool.itNum}</div>}
                    </td>
                  );
                })}
              </tr>
              <tr className="hrow">
                <td className="rl">IT #</td>
                {dims.map(d=>(
                  <td key={d.id} className="dc hdr-cell">
                    <input className="hdr-inp mf" value={toolSel[d.id]?.itNum||""} placeholder="IT-0000"
                      onChange={e=>setToolSel(p=>({...p,[d.id]:{...p[d.id],itNum:e.target.value}}))}/>
                  </td>
                ))}
              </tr>
              <tr className="hrow">
                <td className="rl">Sampling</td>
                {dims.map(d=>(
                  <td key={d.id} className="dc tag-cell">
                    <span className="sample-tag">{samplingLabel(d.sampling)}</span>
                    {isGaugeMode(d.id)&&<span className="gauge-tag">Go/No-Go</span>}
                  </td>
                ))}
              </tr>
              <tr className="div-row">
                <td style={{padding:0,height:"2px",borderBottom:"2px solid var(--accent)"}}/>
                {dims.map(d=><td key={d.id} style={{padding:0,height:"2px",borderBottom:"2px solid var(--accent)"}}/>)}
              </tr>
              {allPieces.map(pNum=>{
                const isMissing=!!missing[pNum];
                return (
                  <tr className={`pr${isMissing?" mr":""}`} key={pNum}>
                    <td className="rl" style={{verticalAlign:"top",paddingTop:".45rem"}}>
                      Pc {pNum}
                      {isMissing&&<div className="mp-tag">{missing[pNum].reason}{missing[pNum].ncNum&&` · ${missing[pNum].ncNum}`}</div>}
                    </td>
                    {dims.map(dim=>{
                      const key=`${dim.id}_${pNum}`;
                      const inPlan=getSamplePieces(dim.sampling,currentJob.qty).includes(pNum);
                      const isUnlocked=!!unlocked[key];
                      const hasVal=(values[key]||"")!=="";
                      const gaugeMode=isGaugeMode(dim.id);
                      if(isMissing){
                        return <td key={dim.id} style={{textAlign:"center",color:"var(--border2)",fontFamily:"var(--mono)",fontSize:".78rem",padding:".26rem .4rem",verticalAlign:"middle"}}>—</td>;
                      }
                      if(!inPlan&&!isUnlocked){
                        return <td key={dim.id} style={{padding:".26rem .4rem",verticalAlign:"middle"}}><button className="na-btn" onClick={()=>setUnlocked(p=>({...p,[key]:true}))}>+</button></td>;
                      }
                      if(isUnlocked&&!hasVal&&!inPlan){
                        return (
                          <td key={dim.id} style={{padding:".26rem .4rem",verticalAlign:"middle"}}>
                            <div className="ue-wrap">
                              {gaugeMode?(
                                <div className="pf-wrap" style={{flex:1}}>
                                  <button className={`pf-btn${values[key]==="PASS"?" pass-on":""}`} onClick={()=>setValues(p=>({...p,[key]:"PASS"}))}>P</button>
                                  <button className={`pf-btn${values[key]==="FAIL"?" fail-on":""}`} onClick={()=>setValues(p=>({...p,[key]:"FAIL"}))}>F</button>
                                </div>
                              ):(
                                <input className="vi ux" type="number" step="0.0001" placeholder="0.0000" value={values[key]||""}
                                  onChange={e=>setValues(p=>({...p,[key]:e.target.value}))} style={{flex:1}}/>
                              )}
                              <button className="relock-btn" onClick={()=>setUnlocked(p=>{const n={...p};delete n[key];return n;})}>×</button>
                            </div>
                          </td>
                        );
                      }
                      if(gaugeMode){
                        const v=values[key];
                        return (
                          <td key={dim.id} style={{padding:".26rem .4rem",verticalAlign:"middle"}}>
                            <div className="pf-wrap">
                              <button className={`pf-btn${v==="PASS"?" pass-on":""}`} onClick={()=>setValues(p=>({...p,[key]:"PASS"}))}>Pass</button>
                              <button className={`pf-btn${v==="FAIL"?" fail-on":""}`} onClick={()=>setValues(p=>({...p,[key]:"FAIL"}))}>Fail</button>
                            </div>
                          </td>
                        );
                      }
                      const v=values[key]??"";
                      const st=isOOT(v,dim.tolPlus,dim.tolMinus,dim.nominal);
                      const cls=v===""?"":st===false?"ok":"oot";
                      return (
                        <td key={dim.id} style={{padding:".26rem .4rem",verticalAlign:"middle"}}>
                          <input className={`vi ${cls}${isUnlocked?" ux":""}`} type="number" step="0.0001"
                            value={v} placeholder="0.0000" onChange={e=>setValues(p=>({...p,[key]:e.target.value}))}/>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {hasOOT&&(
        <div className="oot-banner">
          <div className="oot-icon">▲</div>
          <div>
            <div className="oot-title">Out-of-Tolerance Detected</div>
            <div className="oot-body">{ootList.map((o,i)=><span key={i}>{o.dim.name} — Pc {o.piece}{i<ootList.length-1?",  ":""}</span>)}<br/>Comment required before submitting.</div>
          </div>
        </div>
      )}
      {hasStarted&&incompletePieces.length>0&&(
        <div className="inc-banner">
          <div className="inc-title">Incomplete Data — {incompletePieces.length} piece{incompletePieces.length!==1?"s":""} missing values</div>
          <p style={{fontSize:".78rem",color:"#a08040",lineHeight:1.5,marginBottom:".55rem"}}>Pieces {incompletePieces.join(", ")} have unfilled measurements. Save draft to return later, or Partial Submit to log reasons and close for supervisor review.</p>
          <div className="gap1">{incompletePieces.map(p=><span key={p} className="badge badge-incomplete">Pc {p}</span>)}</div>
        </div>
      )}
      <div className="card">
        <div className="card-head"><div className="card-title">{hasOOT?"OOT Comment (Required)":"Comments"}</div></div>
        <div className="card-body">
          <textarea value={comment} onChange={e=>setComment(e.target.value)}
            placeholder={hasOOT?"Describe the out-of-tolerance condition and corrective action...":"Optional notes…"}/>
          <div className="mt2 gap1">
            <button className="btn btn-primary" disabled={!canFull} onClick={handleFull}>Submit &amp; Close Job</button>
            {canPartial&&<button className="btn btn-partial" onClick={()=>setShowModal(true)}>Partial Submit…</button>}
            <button className="btn btn-draft" onClick={handleDraft}>Save Draft</button>
            {!toolsReady&&<span className="text-muted">Tool &amp; IT # required per dimension</span>}
            {toolsReady&&hasOOT&&!comment.trim()&&<span className="text-warn" style={{fontSize:".75rem"}}>Comment required for OOT</span>}
          </div>
        </div>
      </div>
    </div>
  );

  if(step==="saved") return (
    <div className="draft-card">
      <div style={{fontSize:"2rem"}}>💾</div>
      <div className="draft-title">Draft Saved</div>
      <p className="text-muted">Job <strong style={{color:"var(--draft)"}}>{currentJob.jobNumber}</strong> saved. Resume anytime from the job list.</p>
      <div className="gap1 mt1"><button className="btn btn-ghost" onClick={reset}>Back to Job List</button></div>
    </div>
  );
  return (
    <div className="success-card">
      <div style={{fontSize:"2rem"}}>✔</div>
      <div className="success-title">Record Submitted — Job Closed</div>
      <p className="text-muted">Job <strong style={{color:"var(--accent2)"}}>{currentJob?.jobNumber}</strong> · {currentJob?.lot} · Op {currentJob?.operation}</p>
      {hasOOT&&<p className="text-warn" style={{fontSize:".8rem"}}>OOT recorded — notify supervisor.</p>}
      <div className="gap1 mt1"><button className="btn btn-ghost" onClick={reset}>Enter Another Job</button></div>
    </div>
  );
}

function AdminTools({ toolLibrary, onToolsChange }) {
  const empty={name:"",type:"Variable",itNum:""};
  const [form,setForm]=useState(empty);
  const [err,setErr]=useState("");
  const [search,setSearch]=useState("");
  const [tf,setTf]=useState("All");
  function handleAdd(){
    if(!form.name.trim()||!form.itNum.trim()){setErr("Name and IT # required.");return;}
    const id="t"+uid();
    onToolsChange({...toolLibrary,[id]:{id,name:form.name.trim(),type:form.type,itNum:form.itNum.trim().toUpperCase()}});
    setForm(empty);setErr("");
  }
  function handleRemove(id){const n={...toolLibrary};delete n[id];onToolsChange(n);}
  const filtered=Object.values(toolLibrary).filter(t=>{
    const ms=!search||t.name.toLowerCase().includes(search.toLowerCase())||t.itNum.toLowerCase().includes(search.toLowerCase());
    return ms&&(tf==="All"||t.type===tf);
  });
  return (
    <div>
      <div className="card">
        <div className="card-head"><div className="card-title">Add New Tool</div></div>
        <div className="card-body">
          <div className="row3">
            <div className="field"><label>Tool Name</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Outside Micrometer"/></div>
            <div className="field"><label>Tool Type</label>
              <select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
                {TOOL_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select></div>
            <div className="field"><label>IT # / Cal. Number</label>
              <input value={form.itNum} onChange={e=>setForm(p=>({...p,itNum:e.target.value.toUpperCase()}))} placeholder="IT-0099" style={{fontFamily:"var(--mono)"}}/></div>
          </div>
          {err&&<p className="err-text mt1">{err}</p>}
          <div className="mt2"><button className="btn btn-primary" onClick={handleAdd}>+ Add Tool</button></div>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">Tool Library</div><div className="text-muted" style={{fontSize:".7rem"}}>{Object.keys(toolLibrary).length} tools</div></div>
        <div className="card-body" style={{paddingBottom:".5rem"}}>
          <div className="row2" style={{gap:".75rem",marginBottom:".75rem"}}>
            <input className="search-inp" placeholder="Search by name or IT #…" value={search} onChange={e=>setSearch(e.target.value)}/>
            <div style={{display:"flex",gap:".35rem",flexWrap:"wrap"}}>
              {["All",...TOOL_TYPES].map(t=><button key={t} className={`tpf-btn${tf===t?" on":""}`} onClick={()=>setTf(t)}>{t}</button>)}
            </div>
          </div>
        </div>
        <table className="data-table">
          <thead><tr><th>Tool Name</th><th>Type</th><th>IT #</th><th style={{width:"60px"}}></th></tr></thead>
          <tbody>
            {filtered.length===0&&<tr><td colSpan={4}><div className="empty-state">No tools match.</div></td></tr>}
            {filtered.map(t=>(
              <tr key={t.id}>
                <td style={{fontWeight:600}}>{t.name}</td>
                <td><TypeBadge type={t.type}/></td>
                <td className="mono">{t.itNum}</td>
                <td><button className="btn btn-danger btn-sm" onClick={()=>handleRemove(t.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminJobs({ parts, jobs, onAddJob }) {
  const empty={jobNumber:"",partNumber:"",operation:"",lot:"",qty:""};
  const [form,setForm]=useState(empty);
  const [err,setErr]=useState("");
  const partOps=form.partNumber&&parts[form.partNumber]?Object.entries(parts[form.partNumber].operations):[];
  function handleAdd(){
    if(!form.jobNumber||!form.partNumber||!form.operation||!form.lot||!form.qty){setErr("All fields required.");return;}
    if(jobs[form.jobNumber.toUpperCase()]){setErr("Job number already exists.");return;}
    onAddJob({...form,jobNumber:form.jobNumber.toUpperCase(),qty:parseInt(form.qty),status:"open"});
    setForm(empty);setErr("");
  }
  const sb=s=>{
    if(s==="open")return <span className="badge badge-open">Open</span>;
    if(s==="closed")return <span className="badge badge-closed">Closed</span>;
    if(s==="draft")return <span className="badge badge-draft">Draft</span>;
    if(s==="incomplete")return <span className="badge badge-incomplete">Incomplete</span>;
    return <span className="badge badge-pend">{s}</span>;
  };
  return (
    <div>
      <div className="card">
        <div className="card-head"><div className="card-title">Create New Job</div></div>
        <div className="card-body">
          <div className="row3">
            <div className="field"><label>Job Number</label><input value={form.jobNumber} onChange={e=>setForm(p=>({...p,jobNumber:e.target.value.toUpperCase()}))} placeholder="J-10045" style={{fontFamily:"var(--mono)"}}/></div>
            <div className="field"><label>Part Number</label>
              <select value={form.partNumber} onChange={e=>setForm(p=>({...p,partNumber:e.target.value,operation:""}))}>
                <option value="">— Select Part —</option>
                {Object.keys(parts).map(pn=><option key={pn} value={pn}>{pn} — {parts[pn].description}</option>)}
              </select></div>
            <div className="field"><label>Operation</label>
              <select value={form.operation} onChange={e=>setForm(p=>({...p,operation:e.target.value}))} disabled={!form.partNumber}>
                <option value="">— Select Op —</option>
                {partOps.map(([k,op])=><option key={k} value={k}>Op {k} — {op.label}</option>)}
              </select></div>
          </div>
          <div className="row2 mt1">
            <div className="field"><label>Lot</label><input value={form.lot} onChange={e=>setForm(p=>({...p,lot:e.target.value}))} placeholder="e.g. Lot C"/></div>
            <div className="field"><label>Qty</label><input type="number" min="1" value={form.qty} onChange={e=>setForm(p=>({...p,qty:e.target.value}))} placeholder="12" style={{fontFamily:"var(--mono)"}}/></div>
          </div>
          {err&&<p className="err-text mt1">{err}</p>}
          <div className="mt2"><button className="btn btn-primary" onClick={handleAdd}>+ Create Job</button></div>
        </div>
      </div>
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <div className="card-head"><div className="card-title">All Jobs</div></div>
        <table className="data-table">
          <thead><tr><th>Job #</th><th>Part</th><th>Operation</th><th>Lot</th><th>Qty</th><th>Status</th></tr></thead>
          <tbody>
            {Object.values(jobs).sort((a,b)=>b.jobNumber.localeCompare(a.jobNumber)).map(j=>(
              <tr key={j.jobNumber}>
                <td className="mono accent-text">{j.jobNumber}</td>
                <td><span className="mono">{j.partNumber}</span> <span className="text-muted">{parts[j.partNumber]?.description}</span></td>
                <td>Op {j.operation} — {parts[j.partNumber]?.operations[j.operation]?.label}</td>
                <td>{j.lot}</td><td className="mono">{j.qty}</td><td>{sb(j.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecordDetailModal({ record, parts, toolLibrary, onClose }) {
  const part   = parts[record.partNumber];
  const opData = part?.operations[record.operation];
  const dims   = opData?.dimensions ?? [];
  const allPieces = dims.length > 0
    ? [...new Set(dims.flatMap(d => getSamplePieces(d.sampling, record.qty)))].sort((a,b)=>a-b)
    : [];
  const resultBadge = record.status==="incomplete"
    ? <span className="badge badge-incomplete">Incomplete</span>
    : record.oot
      ? <span className="badge badge-oot">OOT</span>
      : <span className="badge badge-ok">OK</span>;
  return (
    <div className="modal-overlay">
      <div className="rec-modal">
        <div className="rec-modal-head">
          <div>
            <div className="modal-title" style={{marginBottom:0}}>Inspection Record — {record.jobNumber}</div>
            <div style={{fontSize:".72rem",color:"var(--muted)",marginTop:".2rem"}}>{record.timestamp} · {record.operator}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"1rem"}}>
            {resultBadge}
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ Close</button>
          </div>
        </div>
        <div className="rec-modal-body">
          <div className="rec-strip">
            <div className="rec-field"><div className="rec-label">Part</div><div className="rec-val">{record.partNumber}</div></div>
            <div className="rec-field"><div className="rec-label">Description</div><div className="rec-val" style={{fontFamily:"var(--sans)",fontSize:".82rem",color:"var(--text)"}}>{part?.description}</div></div>
            <div className="rec-field"><div className="rec-label">Operation</div><div className="rec-val">Op {record.operation} — <span style={{fontFamily:"var(--sans)",fontSize:".8rem",color:"var(--text)"}}>{opData?.label}</span></div></div>
            <div className="rec-field"><div className="rec-label">Lot</div><div className="rec-val">{record.lot}</div></div>
            <div className="rec-field"><div className="rec-label">Qty</div><div className="rec-val">{record.qty} pcs</div></div>
          </div>
          <div className="det-section">Tools Used</div>
          <table className="det-table" style={{marginBottom:"1.25rem"}}>
            <thead><tr><th>Dimension</th><th>Specification</th><th>Tool</th><th>Type</th><th>IT #</th></tr></thead>
            <tbody>
              {dims.map(d => {
                const ts  = record.tools?.[d.id];
                const tl  = toolLibrary[ts?.toolId];
                return (
                  <tr key={d.id}>
                    <td style={{fontWeight:600}}>{d.name}</td>
                    <td style={{fontFamily:"var(--mono)",fontSize:".78rem",color:"var(--muted)"}}>{fmtSpec(d)}</td>
                    <td>{tl?.name ?? <span style={{color:"var(--muted)"}}>—</span>}</td>
                    <td>{tl ? <TypeBadge type={tl.type}/> : "—"}</td>
                    <td style={{fontFamily:"var(--mono)",fontSize:".78rem"}}>{ts?.itNum ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="det-section">Measurements</div>
          <div style={{overflowX:"auto",border:"1px solid var(--border)",borderRadius:"3px",marginBottom:"1.25rem"}}>
            <table className="det-table" style={{tableLayout:"auto"}}>
              <thead>
                <tr>
                  <th style={{minWidth:"60px"}}>Piece</th>
                  {dims.map(d=><th key={d.id}>{d.name}<div style={{fontFamily:"var(--mono)",fontSize:".6rem",color:"var(--border2)",fontWeight:400,marginTop:".1rem"}}>{fmtSpec(d)}</div></th>)}
                </tr>
              </thead>
              <tbody>
                {allPieces.map(pNum => {
                  const mp = record.missingPieces?.[pNum];
                  return (
                    <tr key={pNum} style={mp?{background:"#180d0d"}:{}}>
                      <td style={{fontFamily:"var(--mono)",fontSize:".78rem",color:"var(--muted)",whiteSpace:"nowrap"}}>
                        Pc {pNum}
                        {mp && <div className="mp-tag">{mp.reason}{mp.ncNum&&` · ${mp.ncNum}`}</div>}
                      </td>
                      {dims.map(d => {
                        if(mp) return <td key={d.id} className="val-na">—</td>;
                        const inPlan = getSamplePieces(d.sampling, record.qty).includes(pNum);
                        const v = record.values?.[`${d.id}_${pNum}`];
                        if(!inPlan && (v===undefined||v==="")) {
                          return <td key={d.id} className="val-na">n/a</td>;
                        }
                        if(v==="PASS") return <td key={d.id} className="val-ok">PASS</td>;
                        if(v==="FAIL") return <td key={d.id} className="val-oot">FAIL</td>;
                        if(v===undefined||v==="") return <td key={d.id} className="val-na">—</td>;
                        const oot = isOOT(v, d.tolPlus, d.tolMinus, d.nominal);
                        return <td key={d.id} className={oot?"val-oot":"val-ok"}>{parseFloat(v).toFixed(d.unit==="Ra"?1:4)}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {Object.keys(record.missingPieces||{}).length > 0 && (
            <>
              <div className="det-section">Missing Piece Log</div>
              <table className="det-table" style={{marginBottom:"1.25rem"}}>
                <thead><tr><th>Piece</th><th>Reason</th><th>NC #</th><th>Details</th></tr></thead>
                <tbody>
                  {Object.entries(record.missingPieces).map(([p,m])=>(
                    <tr key={p}>
                      <td className="mono">Pc {p}</td>
                      <td>{m.reason}</td>
                      <td className="mono">{m.ncNum||"—"}</td>
                      <td className="text-muted">{m.details||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {record.comment && (
            <>
              <div className="det-section">{record.oot?"OOT Comment":"Notes"}</div>
              <div style={{background:"var(--panel)",border:"1px solid var(--border2)",borderLeft:`3px solid ${record.oot?"var(--warn)":"var(--border2)"}`,borderRadius:"3px",padding:".85rem 1.1rem",fontSize:".82rem",lineHeight:1.6,color:record.oot?"#c07070":"var(--text)"}}>
                {record.comment}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminRecords({ records, parts, toolLibrary }) {
  const [filter,setFilter]=useState({part:"",op:"",status:""});
  const [selected,setSelected]=useState(null);
  const allOps=[...new Set(records.map(r=>r.operation))].sort();
  const filtered=records.filter(r=>
    (!filter.part||r.partNumber.includes(filter.part))&&
    (!filter.op||r.operation===filter.op)&&
    (!filter.status||r.status===filter.status||(filter.status==="oot"&&r.oot))
  );
  const sb=r=>{
    if(r.status==="incomplete")return <span className="badge badge-incomplete">Incomplete</span>;
    if(r.oot)return <span className="badge badge-oot">OOT</span>;
    return <span className="badge badge-ok">OK</span>;
  };
  return (
    <div>
      {selected && <RecordDetailModal record={selected} parts={parts} toolLibrary={toolLibrary} onClose={()=>setSelected(null)}/>}
      <div className="card">
        <div className="card-head"><div className="card-title">Filter</div></div>
        <div className="card-body">
          <div className="row3">
            <div className="field"><label>Part #</label><input placeholder="All" value={filter.part} onChange={e=>setFilter(p=>({...p,part:e.target.value}))}/></div>
            <div className="field"><label>Operation</label>
              <select value={filter.op} onChange={e=>setFilter(p=>({...p,op:e.target.value}))}>
                <option value="">All</option>{allOps.map(o=><option key={o} value={o}>Op {o}</option>)}
              </select></div>
            <div className="field"><label>Result</label>
              <select value={filter.status} onChange={e=>setFilter(p=>({...p,status:e.target.value}))}>
                <option value="">All</option><option value="complete">Complete/OK</option><option value="oot">OOT</option><option value="incomplete">Incomplete</option>
              </select></div>
          </div>
        </div>
      </div>
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <div className="card-head">
          <div className="card-title">Records</div>
          <div className="text-muted" style={{fontSize:".7rem"}}>Click any row to view full detail</div>
        </div>
        <table className="data-table">
          <thead><tr><th>Timestamp</th><th>Job #</th><th>Part</th><th>Op</th><th>Lot</th><th>Qty</th><th>Operator</th><th>Result</th><th>Comment</th></tr></thead>
          <tbody>
            {filtered.length===0&&<tr><td colSpan={9}><div className="empty-state">No records match.</div></td></tr>}
            {filtered.map(r=>(
              <tr key={r.id} className="tr-click" onClick={()=>setSelected(r)}>
                <td className="mono" style={{fontSize:".74rem",whiteSpace:"nowrap"}}>{r.timestamp}</td>
                <td className="mono accent-text">{r.jobNumber}</td><td className="mono">{r.partNumber}</td>
                <td>Op {r.operation}</td><td>{r.lot}</td><td className="mono">{r.qty}</td>
                <td>{r.operator}</td><td>{sb(r)}</td>
                <td className="text-muted" style={{fontSize:".74rem",maxWidth:"160px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.comment||"—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted">{filtered.length} record{filtered.length!==1?"s":""}</p>
    </div>
  );
}

function AdminParts({ parts, toolLibrary, onPartsChange }) {
  const [newPart,setNewPart]=useState({partNumber:"",description:""});
  const [partErr,setPartErr]=useState("");
  const [newOp,setNewOp]=useState({});
  function handleAddPart(){
    const pn=newPart.partNumber.trim().toUpperCase();
    if(!pn||!newPart.description.trim()){setPartErr("Part number and description required.");return;}
    if(parts[pn]){setPartErr("Part number already exists.");return;}
    onPartsChange({...parts,[pn]:{partNumber:pn,description:newPart.description.trim(),operations:{}}});
    setNewPart({partNumber:"",description:""});setPartErr("");
  }
  function updateDesc(pn,v){onPartsChange({...parts,[pn]:{...parts[pn],description:v}});}
  function handleAddOp(pn){
    const o=newOp[pn]||{};const opKey=(o.opNum||"").trim();
    if(!opKey||!o.label?.trim())return;
    if(parts[pn].operations[opKey])return;
    onPartsChange({...parts,[pn]:{...parts[pn],operations:{...parts[pn].operations,[opKey]:{label:o.label.trim(),dimensions:[]}}}});
    setNewOp(p=>({...p,[pn]:{opNum:"",label:""}}));
  }
  function updateDim(pn,opKey,dimId,field,value){
    const dims=parts[pn].operations[opKey].dimensions.map(d=>d.id===dimId?{...d,[field]:value}:d);
    onPartsChange({...parts,[pn]:{...parts[pn],operations:{...parts[pn].operations,[opKey]:{...parts[pn].operations[opKey],dimensions:dims}}}});
  }
  function addDim(pn,opKey){
    const d={id:"d"+uid(),name:"New Dimension",nominal:0.0000,tolPlus:0.0050,tolMinus:0.0050,unit:"in",sampling:"first_last",tools:[]};
    onPartsChange({...parts,[pn]:{...parts[pn],operations:{...parts[pn].operations,[opKey]:{...parts[pn].operations[opKey],dimensions:[...parts[pn].operations[opKey].dimensions,d]}}}});
  }
  function removeDim(pn,opKey,dimId){
    const dims=parts[pn].operations[opKey].dimensions.filter(d=>d.id!==dimId);
    onPartsChange({...parts,[pn]:{...parts[pn],operations:{...parts[pn].operations,[opKey]:{...parts[pn].operations[opKey],dimensions:dims}}}});
  }
  return (
    <div>
      <div className="card">
        <div className="card-head"><div className="card-title">Add New Part</div></div>
        <div className="card-body">
          <div className="row2">
            <div className="field"><label>Part Number</label><input value={newPart.partNumber} onChange={e=>setNewPart(p=>({...p,partNumber:e.target.value.toUpperCase()}))} placeholder="e.g. 5678" style={{fontFamily:"var(--mono)"}}/></div>
            <div className="field"><label>Description</label><input value={newPart.description} onChange={e=>setNewPart(p=>({...p,description:e.target.value}))} placeholder="Part description"/></div>
          </div>
          {partErr&&<p className="err-text mt1">{partErr}</p>}
          <div className="mt2"><button className="btn btn-primary" onClick={handleAddPart}>+ Add Part</button></div>
        </div>
      </div>
      {Object.entries(parts).map(([pn,part])=>(
        <div className="card" key={pn}>
          <div className="card-head">
            <div style={{display:"flex",alignItems:"center",gap:"1rem",flex:1}}>
              <div className="card-title" style={{whiteSpace:"nowrap"}}>Part {pn}</div>
              <input value={part.description} onChange={e=>updateDesc(pn,e.target.value)}
                style={{background:"var(--panel2)",border:"1px solid var(--border2)",color:"var(--text)",fontFamily:"var(--sans)",fontSize:".85rem",padding:".3rem .6rem",borderRadius:"2px",outline:"none",flex:1,maxWidth:"400px",transition:"border-color .15s"}}
                onFocus={e=>e.target.style.borderColor="var(--accent)"}
                onBlur={e=>e.target.style.borderColor="var(--border2)"}/>
            </div>
          </div>
          <div style={{padding:"1rem 1.25rem"}}>
            {Object.entries(part.operations).map(([opKey,op])=>(
              <div key={opKey} style={{marginBottom:"1.5rem"}}>
                <div className="section-label">Op {opKey} — {op.label}</div>
                <div style={{overflowX:"auto",border:"1px solid var(--border)",borderRadius:"3px",marginBottom:".6rem"}}>
                  <table className="edit-table">
                    <thead><tr>
                      <th style={{minWidth:"140px"}}>Dimension</th>
                      <th style={{width:"85px"}}>Nominal</th>
                      <th style={{width:"82px"}}>Tol +</th>
                      <th style={{width:"82px"}}>Tol −</th>
                      <th style={{width:"60px"}}>Unit</th>
                      <th style={{width:"120px"}}>Sampling</th>
                      <th style={{minWidth:"220px"}}>Allowed Tools</th>
                      <th style={{width:"40px"}}></th>
                    </tr></thead>
                    <tbody>
                      {op.dimensions.length===0&&<tr><td colSpan={8} className="empty-state" style={{padding:"1rem",fontSize:".76rem"}}>No dimensions defined.</td></tr>}
                      {op.dimensions.map(d=>(
                        <tr key={d.id}>
                          <td><input value={d.name} onChange={e=>updateDim(pn,opKey,d.id,"name",e.target.value)}/></td>
                          <td><input type="number" step="0.0001" value={d.nominal} onChange={e=>updateDim(pn,opKey,d.id,"nominal",parseFloat(e.target.value)||0)} style={{fontFamily:"var(--mono)"}}/></td>
                          <td><input type="number" step="0.0001" value={d.tolPlus} onChange={e=>updateDim(pn,opKey,d.id,"tolPlus",parseFloat(e.target.value)||0)} style={{fontFamily:"var(--mono)"}}/></td>
                          <td><input type="number" step="0.0001" value={d.tolMinus} onChange={e=>updateDim(pn,opKey,d.id,"tolMinus",parseFloat(e.target.value)||0)} style={{fontFamily:"var(--mono)"}}/></td>
                          <td><select value={d.unit} onChange={e=>updateDim(pn,opKey,d.id,"unit",e.target.value)}>
                            <option>in</option><option>mm</option><option>Ra</option><option>deg</option>
                          </select></td>
                          <td><select value={d.sampling} onChange={e=>updateDim(pn,opKey,d.id,"sampling",e.target.value)}>
                            {SAMPLING_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                          </select></td>
                          <td>
                            <ToolSearchPopover toolLibrary={toolLibrary} selectedIds={d.tools}
                              onAdd={id=>updateDim(pn,opKey,d.id,"tools",[...d.tools,id])}
                              onRemove={id=>updateDim(pn,opKey,d.id,"tools",d.tools.filter(x=>x!==id))}/>
                          </td>
                          <td style={{textAlign:"center"}}><button className="btn btn-danger btn-sm" onClick={()=>removeDim(pn,opKey,d.id)}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={()=>addDim(pn,opKey)}>+ Add Dimension</button>
              </div>
            ))}
            <div style={{borderTop:"1px solid var(--border)",paddingTop:"1rem",marginTop:".5rem"}}>
              <div className="section-label" style={{color:"var(--muted)"}}>Add Operation</div>
              <div className="row3" style={{gap:".75rem"}}>
                <div className="field"><label>Op Number</label><input value={newOp[pn]?.opNum||""} onChange={e=>setNewOp(p=>({...p,[pn]:{...p[pn],opNum:e.target.value}}))} placeholder="e.g. 40" style={{fontFamily:"var(--mono)"}}/></div>
                <div className="field"><label>Op Label</label><input value={newOp[pn]?.label||""} onChange={e=>setNewOp(p=>({...p,[pn]:{...p[pn],label:e.target.value}}))} placeholder="e.g. Final Inspection"/></div>
                <div className="field" style={{justifyContent:"flex-end"}}><button className="btn btn-ghost" onClick={()=>handleAddOp(pn)}>+ Add Operation</button></div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminView({ parts, jobs, records, toolLibrary, onAddJob, onPartsChange, onToolsChange }) {
  const [tab,setTab]=useState("jobs");
  return (
    <div>
      <div className="sub-tabs">
        <button className={`sub-tab ${tab==="jobs"?"active":""}`} onClick={()=>setTab("jobs")}>Job Management</button>
        <button className={`sub-tab ${tab==="records"?"active":""}`} onClick={()=>setTab("records")}>Inspection Records</button>
        <button className={`sub-tab ${tab==="parts"?"active":""}`} onClick={()=>setTab("parts")}>Part / Op Setup</button>
        <button className={`sub-tab ${tab==="tools"?"active":""}`} onClick={()=>setTab("tools")}>Tool Library</button>
      </div>
      {tab==="jobs"&&<AdminJobs parts={parts} jobs={jobs} onAddJob={onAddJob}/>}
      {tab==="records"&&<AdminRecords records={records} parts={parts} toolLibrary={toolLibrary}/>}
      {tab==="parts"&&<AdminParts parts={parts} toolLibrary={toolLibrary} onPartsChange={onPartsChange}/>}
      {tab==="tools"&&<AdminTools toolLibrary={toolLibrary} onToolsChange={onToolsChange}/>}
    </div>
  );
}

export default function App() {
  const [view,setView]=useState("operator");
  const [parts,setParts]=useState(INITIAL_PARTS);
  const [jobs,setJobs]=useState(INITIAL_JOBS);
  const [records,setRecords]=useState(INITIAL_RECORDS);
  const [toolLibrary,setToolLibrary]=useState(INITIAL_TOOLS);
  function handleSubmit(record,jobNumber,newStatus){setRecords(prev=>[record,...prev]);setJobs(prev=>({...prev,[jobNumber]:{...prev[jobNumber],status:newStatus}}));}
  function handleDraft({jobNumber,draftData}){setJobs(prev=>({...prev,[jobNumber]:{...prev[jobNumber],status:"draft",draftData}}));}
  function handleAddJob(job){setJobs(prev=>({...prev,[job.jobNumber]:job}));}
  return (
    <>
      <style>{CSS}</style>
      <div className="app-header">
        <div className="logo"><div className="logo-icon"/>InspectFlow</div>
        <div className="header-sep"/>
        <div className="header-sub">Manufacturing Inspection System</div>
        <nav className="nav">
          <button className={`nav-btn ${view==="operator"?"active":""}`} onClick={()=>setView("operator")}>Operator Entry</button>
          <button className={`nav-btn ${view==="admin"?"active":""}`} onClick={()=>setView("admin")}>Admin</button>
        </nav>
      </div>
      <div className="page">
        {view==="operator"
          ?<OperatorView parts={parts} jobs={jobs} toolLibrary={toolLibrary} onSubmit={handleSubmit} onDraft={handleDraft}/>
          :<AdminView parts={parts} jobs={jobs} records={records} toolLibrary={toolLibrary} onAddJob={handleAddJob} onPartsChange={setParts} onToolsChange={setToolLibrary}/>}
      </div>
    </>
  );
}
