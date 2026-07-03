import { useState, useEffect, useMemo, useRef } from "react";



const fmt = (n) => new Intl.NumberFormat("es-MX", { style:"currency", currency:"MXN", maximumFractionDigits:2 }).format(n ?? 0);
const pad = (n) => String(n).padStart(2, "0");
const todayObj = () => { const d = new Date(); return { y:d.getFullYear(), m:d.getMonth()+1 }; };
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const DEFAULT_CARDS = [
  { id:"rappi", name:"RAPPI", payDay:4,  color:"#FF441F", limit:0 },
  { id:"bbva",  name:"BBVA",  payDay:6,  color:"#1664C0", limit:0 },
  { id:"nu",    name:"NU",    payDay:10, color:"#820AD1", limit:0 },
  { id:"plata", name:"PLATA", payDay:20, color:"#A0A0A0", limit:0 },
  { id:"amex",  name:"AMEX",  payDay:25, color:"#007A5E", limit:0 },
  { id:"citi",  name:"CITI",  payDay:28, color:"#003b6f", limit:0 },
];
const DEFAULT_FIXED = [
  { id:"renta",    name:"Renta",    amount:0, day:1, type:"fixed" },
  { id:"internet", name:"Internet", amount:0, day:1, type:"fixed" },
  { id:"luz",      name:"Luz",      amount:0, day:1, type:"variable" },
  { id:"agua",     name:"Agua",     amount:0, day:1, type:"variable" },
  { id:"gas",      name:"Gas",      amount:0, day:1, type:"variable" },
];
const DEFAULT_QUINCENAS = [
  { id:"q1", day:15, grossAmount:27000, deductions:3500, label:"1ra Quincena" },
  { id:"q2", day:30, grossAmount:27000, deductions:3500, label:"2da Quincena" },
];

// A purchase is either single-pay or MSI
// { id, cardId, description, total, isMSI, months (if MSI), chargeYear, chargeMonth }
// For MSI, generates monthly payments starting chargeYear/chargeMonth
function getPurchasePayments(p) {
  if (!p.isMSI) {
    return [{ year:p.chargeYear, month:p.chargeMonth, amount:p.total, purchaseId:p.id, desc:p.description, isMSI:false }];
  }
  const monthly = p.total / p.months;
  const out = [];
  for (let i = 0; i < p.months; i++) {
    const d = new Date(p.chargeYear, p.chargeMonth - 1 + i, 1);
    out.push({ year:d.getFullYear(), month:d.getMonth()+1, amount:monthly, purchaseId:p.id, desc:p.description, isMSI:true, installment:i+1, totalInstallments:p.months });
  }
  return out;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
const IS = { width:"100%", background:"#1F2937", border:"1px solid #374151", borderRadius:10, padding:"10px 14px", color:"#F9FAFB", fontSize:15, outline:"none", boxSizing:"border-box" };

function Sheet({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,.82)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#111827",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:520,maxHeight:"92vh",overflowY:"auto",padding:"24px 20px 40px"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}>
          <span style={{color:"#F9FAFB",fontWeight:800,fontSize:17}}>{title}</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#6B7280",fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function F({ label, hint, children }) {
  return (
    <div style={{marginBottom:13}}>
      <label style={{display:"block",color:"#9CA3AF",fontSize:11,fontWeight:700,letterSpacing:1.1,marginBottom:5}}>{label}</label>
      {children}
      {hint && <div style={{color:"#4B5563",fontSize:11,marginTop:3}}>{hint}</div>}
    </div>
  );
}
function Btn({ onClick, children, bg="#1F2937", border="#374151", color="#F9FAFB" }) {
  return <button onClick={onClick} style={{width:"100%",padding:"13px",borderRadius:12,background:bg,border:`1px solid ${border}`,color,fontSize:15,fontWeight:700,cursor:"pointer"}}>{children}</button>;
}
function Toggle({ value, onChange, labelOn, labelOff }) {
  return (
    <div onClick={()=>onChange(!value)} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:14}}>
      <div style={{width:46,height:26,borderRadius:13,background:value?"#4338CA":"#1F2937",border:`1px solid ${value?"#6366F1":"#374151"}`,position:"relative",transition:"background .2s,border .2s"}}>
        <div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:value?22:2,transition:"left .2s"}}/>
      </div>
      <span style={{color:"#D1D5DB",fontSize:14}}>{value ? labelOn : labelOff}</span>
    </div>
  );
}

// ─── Month selector helper ────────────────────────────────────────────────────
function MonthYearSelect({ year, month, onChange }) {
  const { y:cy, m:cm } = todayObj();
  const options = [];
  for (let i = -1; i <= 12; i++) {
    const d = new Date(cy, cm - 1 + i, 1);
    options.push({ y:d.getFullYear(), m:d.getMonth()+1 });
  }
  return (
    <select style={IS} value={`${year}-${month}`} onChange={e=>{ const [y,m]=e.target.value.split("-"); onChange(parseInt(y),parseInt(m)); }}>
      {options.map(o=>(
        <option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`}>{MONTHS[o.m-1]} {o.y}</option>
      ))}
    </select>
  );
}

// ─── Active Modal (single always-mounted component) ───────────────────────────
function ActiveModal({ modal, cards, fixedExpenses, purchases, quincenas,
  viewYear, viewMonth, md,
  setCards, setFixed, setPurchases, setQuincenas, updateMD, onSaveGoal, onUpdateGoal, onUpdateGoalMonth, onClose }) {

  const def = () => {
    const {y,m} = todayObj();
    return { description:"", total:"", isMSI:false, months:"12", chargeYear:y, chargeMonth:m };
  };

  const [fPurchase, setFP] = useState(def());
  const [f3, setF3] = useState({ name:"", payDay:"1", color:"#5c6bc0" });
  const [f4, setF4] = useState({ name:"", payDay:"1", color:"#5c6bc0" });
  const [f5, setF5] = useState({ name:"", amount:"", day:"1", type:"fixed" });
  const [f6, setF6] = useState({ name:"", amount:"", day:"1" });
  const [f7, setF7] = useState({ label:"", grossAmount:"", deductions:"0", day:"1" });
  const [f8, setF8] = useState({ label:"", grossAmount:"", deductions:"0", day:"1" });
  const [f9, setF9] = useState({ name:"", amount:"", date:"", sub:"" });
  const [f10,setF10]= useState({ name:"", amount:"", date:"" });
  const [f11,setF11]= useState({ name:"", amount:"", date:"" });
  const [fGoal,setFGoal] = useState({ name:"", target:"" });

  const prevType = useRef(null);

  useEffect(()=>{
    if(!modal) return;
    if(prevType.current===modal.type+JSON.stringify(modal.card?.id||modal.fe?.id||modal.q?.id)) return;
    prevType.current = modal.type+JSON.stringify(modal.card?.id||modal.fe?.id||modal.q?.id);
    const {y,m}=todayObj();
    const dy=`${viewYear}-${pad(viewMonth)}-${pad(new Date().getDate())}`;

    if(modal.type==="addPurchase")  setFP({ description:"", total:"", isMSI:false, months:"12", chargeYear:viewYear, chargeMonth:viewMonth });
    if(modal.type==="addCard")      setF3({ name:"", payDay:"1", color:"#5c6bc0" });
    if(modal.type==="editCard")     setF4({ name:modal.card.name, payDay:String(modal.card.payDay), color:modal.card.color, limit:String(modal.card.limit||0) });
    if(modal.type==="addFixed")     setF5({ name:"", amount:"", day:"1", type:"fixed" });
    if(modal.type==="editFixed")    setF6({ name:modal.fe.name, amount:String(md.fixed?.[modal.fe.id]??modal.fe.amount), day:String(modal.fe.day) });
    if(modal.type==="editQuincena") setF7({ label:modal.q.label, grossAmount:String(modal.q.grossAmount), deductions:String(modal.q.deductions), day:String(modal.q.day) });
    if(modal.type==="addQuincena")  setF8({ label:"", grossAmount:"", deductions:"0", day:"1" });
    if(modal.type==="addExtra")     setF9({ name:"", amount:"", date:dy, sub:"" });
    if(modal.type==="addVariable")  setF10({ name:"", amount:"", date:`${viewYear}-${pad(viewMonth)}-15` });
    if(modal.type==="addExtraIncome") setF11({ name:"", amount:"", date:dy });
    if(modal.type==="addGoal") setFGoal({ name:"", target:"" });
    if(modal.type==="editGoal") setFGoal({ name:modal.goal.name, target:String(modal.goal.target) });
  },[modal]);

  if(!modal) return null;

  const monthly = fPurchase.total && fPurchase.months ? parseFloat(fPurchase.total)/parseInt(fPurchase.months) : 0;
  const net7 = (parseFloat(f7.grossAmount)||0)-(parseFloat(f7.deductions)||0);
  const net8 = (parseFloat(f8.grossAmount)||0)-(parseFloat(f8.deductions)||0);
  const varCandidates = fixedExpenses.filter(fe=>fe.type==="variable");

  // ── addPurchase ───────────────────────────────────────────────────────────
  if(modal.type==="addPurchase") {
    const card = modal.card;
    const remainingInstallments = fPurchase.isMSI && fPurchase.total && fPurchase.months
      ? `${fmt(monthly)}/mes × ${fPurchase.months} meses = ${fmt(parseFloat(fPurchase.total)||0)}`
      : null;
    return (
      <Sheet title={`Nueva compra — ${card.name}`} onClose={onClose}>
        <F label="DESCRIPCIÓN">
          <input style={IS} placeholder="Ej: Zara, Uber, Farmacia..." value={fPurchase.description} onChange={e=>setFP(p=>({...p,description:e.target.value}))} autoFocus/>
        </F>
        <F label="MONTO TOTAL ($)">
          <input style={IS} type="number" min="0" placeholder="0.00" value={fPurchase.total} onChange={e=>setFP(p=>({...p,total:e.target.value}))}/>
        </F>

        <Toggle value={fPurchase.isMSI} onChange={v=>setFP(p=>({...p,isMSI:v}))} labelOn="Compra a MSI (meses sin intereses)" labelOff="Pago único (un solo cargo)"/>

        {fPurchase.isMSI && (
          <F label="NÚMERO DE MESES">
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:4}}>
              {[3,6,9,12,15,18,24].map(n=>(
                <button key={n} onClick={()=>setFP(p=>({...p,months:String(n)}))} style={{
                  padding:"8px 14px",borderRadius:8,cursor:"pointer",fontSize:14,fontWeight:700,
                  background:fPurchase.months===String(n)?"#4338CA":"#1F2937",
                  border:`1px solid ${fPurchase.months===String(n)?"#6366F1":"#374151"}`,
                  color:fPurchase.months===String(n)?"#C7D2FE":"#9CA3AF"}}>{n}</button>
              ))}
            </div>
          </F>
        )}

        <F label={fPurchase.isMSI ? "MES DEL PRIMER CARGO" : "MES DE CARGO"} hint={fPurchase.isMSI ? "Mes en que aparece el primer pago en tu estado de cuenta" : "Mes en que aparece este cargo"}>
          <MonthYearSelect year={fPurchase.chargeYear} month={fPurchase.chargeMonth} onChange={(y,m)=>setFP(p=>({...p,chargeYear:y,chargeMonth:m}))}/>
        </F>

        {fPurchase.total > 0 && (
          <div style={{background: fPurchase.isMSI?"#1E1B4B":"#0D2418",borderRadius:10,padding:"11px 14px",marginBottom:14,border:`1px solid ${fPurchase.isMSI?"#4338CA":"#059669"}`}}>
            {fPurchase.isMSI ? (
              <>
                <div style={{color:"#C7D2FE",fontSize:13,fontWeight:700}}>{fmt(monthly)}/mes × {fPurchase.months} meses</div>
                <div style={{color:"#818CF8",fontSize:12,marginTop:2}}>Primer cargo: {MONTHS[fPurchase.chargeMonth-1]} {fPurchase.chargeYear} · Último: {(()=>{ const d=new Date(fPurchase.chargeYear, fPurchase.chargeMonth-1+(parseInt(fPurchase.months)||1)-1,1); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; })()}</div>
              </>
            ) : (
              <div style={{color:"#34D399",fontSize:13,fontWeight:700}}>Cargo único de {fmt(parseFloat(fPurchase.total))} en {MONTHS[fPurchase.chargeMonth-1]} {fPurchase.chargeYear}</div>
            )}
          </div>
        )}

        <Btn bg="#4338CA" border="#6366F1" color="#fff" onClick={()=>{
          const tot=parseFloat(fPurchase.total);
          if(!fPurchase.description.trim()||!tot) return;
          setPurchases(prev=>[...prev,{
            id:Date.now().toString(), cardId:card.id,
            description:fPurchase.description.trim(), total:tot,
            isMSI:fPurchase.isMSI, months:parseInt(fPurchase.months)||1,
            chargeYear:fPurchase.chargeYear, chargeMonth:fPurchase.chargeMonth,
          }]);
          onClose();
        }}>Agregar compra</Btn>
      </Sheet>
    );
  }

  // ── viewCardPurchases ─────────────────────────────────────────────────────
  if(modal.type==="viewCardPurchases") {
    const card = modal.card;
    const cardPurchases = purchases.filter(p=>p.cardId===card.id);
    return (
      <Sheet title={`Compras — ${card.name}`} onClose={onClose}>
        {cardPurchases.length===0 && <div style={{color:"#4B5563",fontSize:14,textAlign:"center",padding:"20px 0"}}>Sin compras registradas</div>}
        {cardPurchases.map(p=>{
          const payments = getPurchasePayments(p);
          const thisMonth = payments.find(pay=>pay.year===viewYear&&pay.month===viewMonth);
          const remainingPays = p.isMSI ? payments.filter(pay=>{ const d=new Date(); return new Date(pay.year,pay.month-1)>=new Date(d.getFullYear(),d.getMonth()); }).length : null;
          return (
            <div key={p.id} style={{background:"#0F172A",borderRadius:12,padding:"12px 14px",marginBottom:10,border:"1px solid #1F2937"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{color:"#F9FAFB",fontWeight:700,fontSize:14}}>{p.description}</div>
                  <div style={{display:"flex",gap:8,marginTop:4,flexWrap:"wrap"}}>
                    {p.isMSI ? (
                      <>
                        <span style={{fontSize:11,background:"#1E1B4B",color:"#818CF8",padding:"2px 8px",borderRadius:20,fontWeight:700}}>{p.months} MSI</span>
                        <span style={{fontSize:11,color:"#6B7280"}}>{fmt(p.total/p.months)}/mes</span>
                        {remainingPays!==null && <span style={{fontSize:11,color:"#9CA3AF"}}>{remainingPays} pago{remainingPays!==1?"s":""} restante{remainingPays!==1?"s":""}</span>}
                      </>
                    ) : (
                      <span style={{fontSize:11,background:"#064E3B",color:"#34D399",padding:"2px 8px",borderRadius:20,fontWeight:700}}>Pago único</span>
                    )}
                    <span style={{fontSize:11,color:"#4B5563"}}>{MONTHS[p.chargeMonth-1]} {p.chargeYear}</span>
                  </div>
                  {thisMonth && <div style={{color:"#F59E0B",fontSize:12,marginTop:4}}>↳ Este mes: {fmt(thisMonth.amount)}</div>}
                </div>
                <div style={{textAlign:"right",marginLeft:10}}>
                  <div style={{color:"#F9FAFB",fontWeight:700}}>{fmt(p.total)}</div>
                  <button onClick={(e)=>{ e.stopPropagation(); setPurchases(prev=>prev.filter(x=>x.id!==p.id)); }}
                    style={{fontSize:11,color:"#EF4444",background:"#1F0000",border:"1px solid #EF444433",borderRadius:6,padding:"3px 8px",cursor:"pointer",marginTop:4}}>✕ Eliminar</button>
                </div>
              </div>
              {p.isMSI && remainingPays > 1 && (()=>{
                const now=new Date();const curY=now.getFullYear();const curM=now.getMonth()+1;
                const remaining=payments.filter(pay=>new Date(pay.year,pay.month-1)>=new Date(curY,curM-1));
                const remainingTotal=remaining.reduce((s,pay)=>s+pay.amount,0);
                return (
                  <div style={{marginTop:8,background:"#1A1625",borderRadius:8,padding:"8px 10px",border:"1px solid #4338CA33"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{color:"#C7D2FE",fontSize:11}}>Saldo restante: <strong>{fmt(remainingTotal)}</strong> ({remaining.length} pagos)</div>
                      </div>
                      <button onClick={(e)=>{
                        e.stopPropagation();
                        setPurchases(prev=>{
                          const without=prev.filter(x=>x.id!==p.id);
                          const liquidation={id:Date.now().toString(),cardId:p.cardId,description:p.description+" (liquidación)",total:remainingTotal,isMSI:false,months:1,chargeYear:curY,chargeMonth:curM};
                          return [...without,liquidation];
                        });
                      }} style={{fontSize:11,color:"#818CF8",background:"#1E1B4B",border:"1px solid #4338CA",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:700}}>💰 Liquidar</button>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
        <div style={{height:1,background:"#1F2937",margin:"4px 0 16px"}}/>
        <Btn bg="#4338CA" border="#6366F1" color="#fff" onClick={()=>{ onClose(); setTimeout(()=>modal.onAddPurchase&&modal.onAddPurchase(),50); }}>+ Nueva compra</Btn>
      </Sheet>
    );
  }

  // ── addCard ───────────────────────────────────────────────────────────────
  if(modal.type==="addCard") {
    return (
      <Sheet title="Nueva tarjeta" onClose={onClose}>
        <F label="NOMBRE"><input style={IS} placeholder="Ej: HSBC, Santander..." value={f3.name} onChange={e=>setF3(p=>({...p,name:e.target.value.toUpperCase()}))}/></F>
        <F label="DÍA DE PAGO"><input style={IS} type="number" min="1" max="31" value={f3.payDay} onChange={e=>setF3(p=>({...p,payDay:e.target.value}))}/></F>
        <F label="COLOR"><input style={{...IS,padding:"4px 8px",height:42}} type="color" value={f3.color} onChange={e=>setF3(p=>({...p,color:e.target.value}))}/></F>
        <F label="LÍMITE DE CRÉDITO ($)" hint="0 = no mostrar barra de uso"><input style={IS} type="number" min="0" value={f3.limit||""} placeholder="0.00" onChange={e=>setF3(p=>({...p,limit:e.target.value}))}/></F>
        <Btn bg="#4338CA" border="#6366F1" color="#fff" onClick={()=>{ if(!f3.name.trim()) return; setCards(prev=>[...prev,{id:Date.now().toString(),name:f3.name.trim(),payDay:parseInt(f3.payDay)||1,color:f3.color,limit:parseFloat(f3.limit)||0}]); onClose(); }}>Agregar tarjeta</Btn>
      </Sheet>
    );
  }

  // ── editCard ──────────────────────────────────────────────────────────────
  if(modal.type==="editCard") {
    const card=modal.card;
    return (
      <Sheet title={`Editar ${card.name}`} onClose={onClose}>
        <F label="NOMBRE"><input style={IS} value={f4.name} onChange={e=>setF4(p=>({...p,name:e.target.value.toUpperCase()}))}/></F>
        <F label="DÍA DE PAGO"><input style={IS} type="number" min="1" max="31" value={f4.payDay} onChange={e=>setF4(p=>({...p,payDay:e.target.value}))}/></F>
        <F label="COLOR"><input style={{...IS,padding:"4px 8px",height:42}} type="color" value={f4.color} onChange={e=>setF4(p=>({...p,color:e.target.value}))}/></F>
        <F label="LÍMITE DE CRÉDITO ($)" hint="0 = no mostrar barra de uso"><input style={IS} type="number" min="0" value={f4.limit||""} placeholder="0.00" onChange={e=>setF4(p=>({...p,limit:e.target.value}))}/></F>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>{ setCards(prev=>prev.filter(c=>c.id!==card.id)); onClose();}} style={{flex:1,padding:"12px",borderRadius:12,background:"#1F0000",border:"1px solid #EF444433",color:"#EF4444",fontSize:14,cursor:"pointer",fontWeight:700}}>Eliminar</button>
          <button onClick={()=>{ setCards(prev=>prev.map(c=>c.id===card.id?{...c,name:f4.name.trim(),payDay:parseInt(f4.payDay)||1,color:f4.color,limit:parseFloat(f4.limit)||0}:c)); onClose(); }} style={{flex:2,padding:"12px",borderRadius:12,background:"#4338CA",border:"none",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>Guardar</button>
        </div>
      </Sheet>
    );
  }

  // ── addFixed ──────────────────────────────────────────────────────────────
  if(modal.type==="addFixed") {
    return (
      <Sheet title="Nuevo gasto fijo" onClose={onClose}>
        <F label="NOMBRE"><input style={IS} placeholder="Ej: Renta, Internet..." value={f5.name} onChange={e=>setF5(p=>({...p,name:e.target.value}))}/></F>
        <F label="MONTO ($)" hint="Para variables pon 0 y actualízalo cada mes"><input style={IS} type="number" min="0" value={f5.amount} onChange={e=>setF5(p=>({...p,amount:e.target.value}))}/></F>
        <F label="DÍA DE PAGO"><input style={IS} type="number" min="1" max="31" value={f5.day} onChange={e=>setF5(p=>({...p,day:e.target.value}))}/></F>
        <F label="TIPO">
          <div style={{display:"flex",gap:8}}>
            {[["fixed","Fijo"],["variable","Variable"]].map(([t,l])=>(
              <button key={t} onClick={()=>setF5(p=>({...p,type:t}))} style={{flex:1,padding:"9px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,background:f5.type===t?"#1F2937":"#111827",border:`1px solid ${f5.type===t?"#4B5563":"#1F2937"}`,color:f5.type===t?"#F9FAFB":"#6B7280"}}>{l}</button>
            ))}
          </div>
        </F>
        <Btn onClick={()=>{ if(!f5.name.trim()) return; setFixed(prev=>[...prev,{id:Date.now().toString(),name:f5.name.trim(),amount:parseFloat(f5.amount)||0,day:parseInt(f5.day)||1,type:f5.type}]); onClose(); }}>Agregar</Btn>
      </Sheet>
    );
  }

  // ── editFixed ─────────────────────────────────────────────────────────────
  if(modal.type==="editFixed") {
    const fe=modal.fe;
    return (
      <Sheet title={`Editar ${fe.name}`} onClose={onClose}>
        <F label="NOMBRE"><input style={IS} value={f6.name} onChange={e=>setF6(p=>({...p,name:e.target.value}))}/></F>
        <F label={fe.type==="variable"?"MONTO ESTE MES ($)":"MONTO ($)"}><input style={IS} type="number" min="0" value={f6.amount} onChange={e=>setF6(p=>({...p,amount:e.target.value}))}/></F>
        <F label="DÍA"><input style={IS} type="number" min="1" max="31" value={f6.day} onChange={e=>setF6(p=>({...p,day:e.target.value}))}/></F>
        <Btn onClick={()=>{
          const a=parseFloat(f6.amount)||0;
          if(fe.type==="fixed") setFixed(prev=>prev.map(f=>f.id===fe.id?{...f,name:f6.name.trim(),amount:a,day:parseInt(f6.day)||1}:f));
          else { updateMD(cur=>({...cur,fixed:{...(cur.fixed||{}),[fe.id]:a}})); setFixed(prev=>prev.map(f=>f.id===fe.id?{...f,name:f6.name.trim(),day:parseInt(f6.day)||1}:f)); }
          onClose();
        }}>Guardar</Btn>
      </Sheet>
    );
  }

  // ── editQuincena ──────────────────────────────────────────────────────────
  if(modal.type==="editQuincena") {
    return (
      <Sheet title={`Editar ${modal.q.label}`} onClose={onClose}>
        <F label="ETIQUETA"><input style={IS} value={f7.label} onChange={e=>setF7(p=>({...p,label:e.target.value}))}/></F>
        <F label="INGRESO BRUTO ($)"><input style={IS} type="number" min="0" value={f7.grossAmount} onChange={e=>setF7(p=>({...p,grossAmount:e.target.value}))}/></F>
        <F label="DEDUCCIÓN GASTO CASA ($)"><input style={IS} type="number" min="0" value={f7.deductions} onChange={e=>setF7(p=>({...p,deductions:e.target.value}))}/></F>
        <F label="DÍA DEL MES"><input style={IS} type="number" min="1" max="31" value={f7.day} onChange={e=>setF7(p=>({...p,day:e.target.value}))}/></F>
        {net7>0 && <div style={{background:"#064E3B",borderRadius:10,padding:"10px 14px",marginBottom:14,color:"#34D399",fontWeight:700,fontSize:14}}>Neto: {fmt(net7)}</div>}
        <Btn bg="#064E3B" border="#059669" color="#34D399" onClick={()=>{ setQuincenas(prev=>prev.map(q=>q.id===modal.q.id?{...q,label:f7.label,grossAmount:parseFloat(f7.grossAmount)||0,deductions:parseFloat(f7.deductions)||0,day:parseInt(f7.day)||1}:q)); onClose(); }}>Guardar</Btn>
      </Sheet>
    );
  }

  // ── addQuincena ───────────────────────────────────────────────────────────
  if(modal.type==="addQuincena") {
    return (
      <Sheet title="Nuevo ingreso recurrente" onClose={onClose}>
        <F label="ETIQUETA"><input style={IS} placeholder="Ej: Bono, 3ra quincena..." value={f8.label} onChange={e=>setF8(p=>({...p,label:e.target.value}))}/></F>
        <F label="MONTO BRUTO ($)"><input style={IS} type="number" min="0" value={f8.grossAmount} onChange={e=>setF8(p=>({...p,grossAmount:e.target.value}))}/></F>
        <F label="DEDUCCIÓN ($)" hint="0 si no hay"><input style={IS} type="number" min="0" value={f8.deductions} onChange={e=>setF8(p=>({...p,deductions:e.target.value}))}/></F>
        <F label="DÍA DEL MES"><input style={IS} type="number" min="1" max="31" value={f8.day} onChange={e=>setF8(p=>({...p,day:e.target.value}))}/></F>
        {net8>0 && <div style={{background:"#064E3B",borderRadius:10,padding:"10px 14px",marginBottom:14,color:"#34D399",fontWeight:700,fontSize:14}}>Neto: {fmt(net8)}</div>}
        <Btn bg="#064E3B" border="#059669" color="#34D399" onClick={()=>{ if(!f8.label.trim()||!parseFloat(f8.grossAmount)) return; setQuincenas(prev=>[...prev,{id:Date.now().toString(),label:f8.label.trim(),grossAmount:parseFloat(f8.grossAmount)||0,deductions:parseFloat(f8.deductions)||0,day:parseInt(f8.day)||1}]); onClose(); }}>Agregar</Btn>
      </Sheet>
    );
  }

  // ── addExtra ──────────────────────────────────────────────────────────────
  if(modal.type==="addExtra") {
    return (
      <Sheet title="Gasto extra (este mes)" onClose={onClose}>
        <F label="NOMBRE"><input style={IS} placeholder="Ej: Mudanza, Doctor..." value={f9.name} onChange={e=>setF9(p=>({...p,name:e.target.value}))}/></F>
        <F label="MONTO ($)"><input style={IS} type="number" min="0" value={f9.amount} onChange={e=>setF9(p=>({...p,amount:e.target.value}))}/></F>
        <F label="FECHA"><input style={IS} type="date" value={f9.date} onChange={e=>setF9(p=>({...p,date:e.target.value}))}/></F>
        <F label="NOTA (OPCIONAL)"><input style={IS} value={f9.sub} onChange={e=>setF9(p=>({...p,sub:e.target.value}))}/></F>
        <Btn onClick={()=>{ if(!f9.name.trim()||!parseFloat(f9.amount)) return; updateMD(cur=>({...cur,extras:[...(cur.extras||[]),{id:Date.now().toString(),paid:false,name:f9.name.trim(),amount:parseFloat(f9.amount),date:f9.date,sub:f9.sub}]})); onClose(); }}>Agregar</Btn>
      </Sheet>
    );
  }

  // ── addVariable ───────────────────────────────────────────────────────────
  if(modal.type==="addVariable") {
    return (
      <Sheet title="Gasto variable este mes" onClose={onClose}>
        {varCandidates.length>0 && (
          <F label="ATAJO">
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:4}}>
              {varCandidates.map(vc=>(
                <button key={vc.id} onClick={()=>setF10(p=>({...p,name:vc.name}))} style={{padding:"5px 12px",borderRadius:20,cursor:"pointer",fontSize:12,background:f10.name===vc.name?"#1F2937":"#111827",border:"1px solid #374151",color:"#9CA3AF"}}>{vc.name}</button>
              ))}
            </div>
          </F>
        )}
        <F label="NOMBRE"><input style={IS} placeholder="Ej: CFE, Gas, Agua..." value={f10.name} onChange={e=>setF10(p=>({...p,name:e.target.value}))}/></F>
        <F label="MONTO ($)"><input style={IS} type="number" min="0" value={f10.amount} onChange={e=>setF10(p=>({...p,amount:e.target.value}))}/></F>
        <F label="FECHA"><input style={IS} type="date" value={f10.date} onChange={e=>setF10(p=>({...p,date:e.target.value}))}/></F>
        <Btn onClick={()=>{ if(!f10.name.trim()||!parseFloat(f10.amount)) return; updateMD(cur=>({...cur,variables:[...(cur.variables||[]),{id:Date.now().toString(),paid:false,name:f10.name.trim(),amount:parseFloat(f10.amount),date:f10.date}]})); onClose(); }}>Agregar</Btn>
      </Sheet>
    );
  }

  // ── editGoalMonth ─────────────────────────────────────────────────────────
  if(modal.type==="editGoalMonth") {
    return (
      <Sheet title={`Aportación — ${modal.monthLabel}`} onClose={onClose}>
        <F label="APORTACIÓN REAL ($)" hint="Cuánto ahorraste realmente este mes">
          <input style={IS} type="number" min="0" defaultValue={String(modal.currentAmount)} id="goalMonthInput" autoFocus/>
        </F>
        <Btn bg="#4338CA" border="#6366F1" color="#fff" onClick={()=>{
          const el=document.getElementById("goalMonthInput");
          const v=parseFloat(el?.value);
          if(!isNaN(v)) onUpdateGoalMonth(modal.goalId, modal.monthKey, v);
          onClose();
        }}>Guardar</Btn>
      </Sheet>
    );
  }

  // ── editBalanceOverride ─────────────────────────────────────────────────────
  if(modal.type==="editBalanceOverride") {
    return (
      <Sheet title="Saldo inicial del mes" onClose={onClose}>
        <F label="MONTO ($)" hint="Sobreescribe el saldo calculado automáticamente">
          <input style={IS} type="number" defaultValue={String(modal.currentAmount)} id="balOverrideInput" autoFocus/>
        </F>
        <Btn bg="#4338CA" border="#6366F1" color="#fff" onClick={()=>{
          const el=document.getElementById("balOverrideInput");
          const v=parseFloat(el?.value);
          if(!isNaN(v)) updateMD(c=>({...c,balanceOverride:v}));
          onClose();
        }}>Guardar</Btn>
      </Sheet>
    );
  }

  // ── addGoal ────────────────────────────────────────────────────────────
  if(modal.type==="addGoal") {
    const {y:cy,m:cm}=todayObj();
    return (
      <Sheet title="Nueva meta de ahorro" onClose={onClose}>
        <F label="NOMBRE DE LA META">
          <input style={IS} placeholder="Ej: Enganche coche, Viaje..." value={fGoal.name} onChange={e=>setFGoal(p=>({...p,name:e.target.value}))} autoFocus/>
        </F>
        <F label="MONTO OBJETIVO ($)">
          <input style={IS} type="number" min="0" placeholder="0.00" value={fGoal.target} onChange={e=>setFGoal(p=>({...p,target:e.target.value}))}/>
        </F>
        <div style={{background:"#0D2418",borderRadius:10,padding:"10px 14px",marginBottom:14,border:"1px solid #059669",color:"#34D399",fontSize:12}}>
          La meta empezará a acumular desde el mes actual. Cada mes suma automáticamente tu sobrante proyectado.
        </div>
        <Btn bg="#4338CA" border="#6366F1" color="#fff" onClick={()=>{
          if(!fGoal.name.trim()||!parseFloat(fGoal.target)) return;
          const newGoal={id:Date.now().toString(),name:fGoal.name.trim(),target:parseFloat(fGoal.target),startYear:cy,startMonth:cm,overrides:{}};
          setQuincenas(prev=>prev); // trigger re-render
          onSaveGoal(newGoal);
          onClose();
        }}>Crear meta</Btn>
      </Sheet>
    );
  }

  // ── editGoal ──────────────────────────────────────────────────────────────
  if(modal.type==="editGoal") {
    return (
      <Sheet title={`Editar ${modal.goal.name}`} onClose={onClose}>
        <F label="NOMBRE">
          <input style={IS} value={fGoal.name} onChange={e=>setFGoal(p=>({...p,name:e.target.value}))}/>
        </F>
        <F label="MONTO OBJETIVO ($)">
          <input style={IS} type="number" min="0" value={fGoal.target} onChange={e=>setFGoal(p=>({...p,target:e.target.value}))}/>
        </F>
        <Btn bg="#4338CA" border="#6366F1" color="#fff" onClick={()=>{
          if(!fGoal.name.trim()||!parseFloat(fGoal.target)) return;
          onUpdateGoal(modal.goal.id, {name:fGoal.name.trim(), target:parseFloat(fGoal.target)});
          onClose();
        }}>Guardar</Btn>
      </Sheet>
    );
  }

  // ── addExtraIncome ────────────────────────────────────────────────────────
  if(modal.type==="addExtraIncome") {
    return (
      <Sheet title="Ingreso extra (este mes)" onClose={onClose}>
        <F label="CONCEPTO"><input style={IS} placeholder="Ej: Freelance, venta, bono..." value={f11.name} onChange={e=>setF11(p=>({...p,name:e.target.value}))}/></F>
        <F label="MONTO ($)"><input style={IS} type="number" min="0" value={f11.amount} onChange={e=>setF11(p=>({...p,amount:e.target.value}))}/></F>
        <F label="FECHA"><input style={IS} type="date" value={f11.date} onChange={e=>setF11(p=>({...p,date:e.target.value}))}/></F>
        <Btn bg="#064E3B" border="#059669" color="#34D399" onClick={()=>{ if(!f11.name.trim()||!parseFloat(f11.amount)) return; updateMD(cur=>({...cur,extraIncomes:[...(cur.extraIncomes||[]),{id:Date.now().toString(),paid:false,name:f11.name.trim(),amount:parseFloat(f11.amount),date:f11.date}]})); onClose(); }}>Agregar ingreso</Btn>
      </Sheet>
    );
  }

  return null;
}

// ─── Month Nav ────────────────────────────────────────────────────────────────
function MonthNav({ year, month, onChange }) {
  const prev=()=>{ let m=month-1,y=year; if(m<1){m=12;y--;} onChange(y,m); };
  const next=()=>{ let m=month+1,y=year; if(m>12){m=1;y++;} onChange(y,m); };
  const t=todayObj();
  return (
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <button onClick={prev} style={{background:"#1F2937",border:"none",color:"#9CA3AF",borderRadius:8,padding:"6px 13px",cursor:"pointer",fontSize:18}}>‹</button>
      <div style={{textAlign:"center",minWidth:110}}>
        <div style={{color:"#F9FAFB",fontWeight:800,fontSize:17}}>{MONTHS[month-1]}</div>
        <div style={{color:"#6B7280",fontSize:12}}>{year}</div>
      </div>
      <button onClick={next} style={{background:"#1F2937",border:"none",color:"#9CA3AF",borderRadius:8,padding:"6px 13px",cursor:"pointer",fontSize:18}}>›</button>
      {!(year===t.y&&month===t.m)&&<button onClick={()=>onChange(t.y,t.m)} style={{background:"#1D4ED8",border:"none",color:"#93C5FD",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700}}>HOY</button>}
    </div>
  );
}

// ─── Card Ficha ───────────────────────────────────────────────────────────────
function CardFicha({ card, cardMd, cardPayments, totalThisMonth, totalDebt, onAddPurchase, onViewPurchases, onEditCard, onTogglePaid }) {
  const paid = cardMd?.paid || false;
  const limit = card.limit || 0;
  const debt = totalDebt || 0;
  const usedPct = limit > 0 ? Math.min(100, (debt / limit) * 100) : 0;
  const available = limit > 0 ? limit - debt : null;
  const barColor = usedPct >= 90 ? "#EF4444" : usedPct >= 70 ? "#F59E0B" : "#34D399";
  return (
    <div style={{background:"#111827",borderRadius:16,overflow:"hidden",border:"1px solid #1F2937",marginBottom:12}}>
      <div style={{background:`linear-gradient(135deg,${card.color}22,#111827)`,padding:"14px 16px",borderBottom:"1px solid #1F2937",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:4,height:36,background:card.color,borderRadius:2}}/>
          <div>
            <div style={{color:"#F9FAFB",fontWeight:800,fontSize:16}}>{card.name}</div>
            <div style={{color:"#6B7280",fontSize:12}}>Pago día {card.payDay}</div>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{color:paid?"#34D399":"#F9FAFB",fontWeight:800,fontSize:20,textDecoration:paid?"line-through":"none"}}>{fmt(totalThisMonth)}</div>
          <span style={{fontSize:11,fontWeight:700,padding:"2px 10px",borderRadius:20,color:paid?"#34D399":"#F59E0B",background:paid?"#064E3B":"#3D2C00"}}>{paid?"PAGADO":"PENDIENTE PAGO"}</span>
        </div>
      </div>
      {limit > 0 && (
        <div style={{padding:"10px 16px 0",borderBottom:"1px solid #1F2937"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
            <div style={{display:"flex",gap:14}}>
              <div>
                <div style={{color:"#4B5563",fontSize:10,letterSpacing:1,fontWeight:700}}>DEUDA TOTAL</div>
                <div style={{color:barColor,fontWeight:700,fontSize:13}}>{fmt(debt)}</div>
              </div>
              <div>
                <div style={{color:"#4B5563",fontSize:10,letterSpacing:1,fontWeight:700}}>DISPONIBLE</div>
                <div style={{color:available>=0?"#34D399":"#EF4444",fontWeight:700,fontSize:13}}>{fmt(available)}</div>
              </div>
              <div>
                <div style={{color:"#4B5563",fontSize:10,letterSpacing:1,fontWeight:700}}>LÍMITE</div>
                <div style={{color:"#6B7280",fontWeight:700,fontSize:13}}>{fmt(limit)}</div>
              </div>
            </div>
            <div style={{color:barColor,fontWeight:800,fontSize:15,alignSelf:"flex-end"}}>{usedPct.toFixed(0)}%</div>
          </div>
          <div style={{height:6,background:"#1F2937",borderRadius:3,marginBottom:10,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${usedPct}%`,background:barColor,borderRadius:3,transition:"width .4s"}}/>
          </div>
        </div>
      )}
      <div style={{padding:"10px 16px"}}>
        {cardPayments.length===0 && <div style={{color:"#4B5563",fontSize:12,marginBottom:8,textAlign:"center"}}>Sin compras este mes</div>}
        {cardPayments.map(p=>(
          <div key={p.purchaseId} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:10,background:p.isMSI?"#1E1B4B":"#064E3B",color:p.isMSI?"#818CF8":"#34D399",padding:"1px 7px",borderRadius:20,fontWeight:700}}>
                {p.isMSI?`${p.installment}/${p.totalInstallments}`:"1/1"}
              </span>
              <span style={{color:"#9CA3AF",fontSize:12}}>{p.desc}</span>
            </div>
            <span style={{color:p.isMSI?"#818CF8":"#34D399",fontSize:13,fontWeight:600}}>{fmt(p.amount)}</span>
          </div>
        ))}
        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button onClick={onTogglePaid} style={{flex:1,padding:"8px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,background:paid?"#1F2937":"#064E3B",border:`1px solid ${paid?"#374151":"#059669"}`,color:paid?"#9CA3AF":"#34D399"}}>{paid?"↩ Revertir":"✓ Pagar"}</button>
          <button onClick={onViewPurchases} style={{flex:1,padding:"8px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,background:"#1F2937",border:"1px solid #374151",color:"#9CA3AF"}}>📋 Compras</button>
          <button onClick={onAddPurchase} style={{flex:1,padding:"8px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,background:"#1E1B4B",border:"1px solid #4338CA",color:"#818CF8"}}>+ Compra</button>
          <button onClick={onEditCard} style={{padding:"8px 10px",borderRadius:8,cursor:"pointer",fontSize:12,background:"#1F2937",border:"1px solid #374151",color:"#6B7280"}}>⚙</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
export default function App({ initialData, onSave, user, onLogout }) {
  const {y:CY,m:CM} = todayObj();
  const d = initialData || {};
  const initCards = (d.cards || DEFAULT_CARDS).map(c=>({...c,limit:c.limit??0}));
  const initFixed = d.fixedExpenses || DEFAULT_FIXED;

  const [tab,setTab]             = useState("timeline");
  const [viewYear,setViewYear]   = useState(CY);
  const [viewMonth,setViewMonth] = useState(CM);
  const [cards,setCards]         = useState(initCards);
  const [fixedExpenses,setFixed] = useState(initFixed);
  const [quincenas,setQuincenas] = useState(d.quincenas || DEFAULT_QUINCENAS);
  const [purchases,setPurchases] = useState(d.purchases || []);
  const [startingBalance,setStartingBalance] = useState(d.startingBalance || { amount:0, year:CY, month:CM });
  const [goals,setGoals]         = useState(d.goals || []);
  const [monthData,setMonthData] = useState(d.monthData || {});
  const [modal,setModal]         = useState(null);

  // Save to Firebase on any change
  useEffect(()=>{
    onSave({ cards, fixedExpenses, quincenas, purchases, startingBalance, goals, monthData });
  },[cards,fixedExpenses,quincenas,purchases,startingBalance,goals,monthData]);

  const mk = `${viewYear}-${pad(viewMonth)}`;
  const md = monthData[mk]||{};
  const updateMD = (fn)=>setMonthData(prev=>({...prev,[mk]:fn(prev[mk]||{})}));

  // Carry-over: accumulated balance from startingBalance up to (not including) current view month
  const carryOver = useMemo(()=>{
    // Manual override wins
    if(md.balanceOverride != null) return md.balanceOverride;
    const sb = startingBalance;
    if(!sb || sb.amount == null) return 0;
    let bal = sb.amount;
    let y = sb.year, m = sb.month;
    // If viewing a month before or at the starting month, no carry-over
    if(viewYear < y || (viewYear === y && viewMonth <= m)) return sb.amount;
    while(y < viewYear || (y === viewYear && m < viewMonth)) {
      const k = `${y}-${pad(m)}`;
      const mmd = monthData[k]||{};
      quincenas.forEach(q=>{ bal += (mmd.quincenas?.[q.id]?.amount ?? (q.grossAmount-q.deductions)); });
      (mmd.extraIncomes||[]).forEach(ei=>{ bal += ei.amount; });
      cards.forEach(card=>{
        purchases.flatMap(p=>p.cardId===card.id?getPurchasePayments(p):[])
          .filter(p=>p.year===y&&p.month===m).forEach(p=>{ bal -= p.amount; });
      });
      fixedExpenses.forEach(fe=>{ bal -= (mmd.fixed?.[fe.id]??fe.amount); });
      (mmd.variables||[]).forEach(v=>{ bal -= v.amount; });
      (mmd.extras||[]).forEach(ex=>{ bal -= ex.amount; });
      m++; if(m>12){m=1;y++;}
    }
    return bal;
  },[startingBalance,monthData,viewYear,viewMonth,quincenas,cards,purchases,fixedExpenses]);

  // Payments per card for current view month
  const purchasePaymentsByCard = useMemo(()=>{
    const map={};
    purchases.forEach(p=>{
      getPurchasePayments(p).forEach(pay=>{
        if(pay.year===viewYear&&pay.month===viewMonth){
          if(!map[p.cardId]) map[p.cardId]=[];
          map[p.cardId].push(pay);
        }
      });
    });
    return map;
  },[purchases,viewYear,viewMonth]);

  const cardTotals = useMemo(()=>{
    const map={};
    cards.forEach(card=>{ map[card.id]=(purchasePaymentsByCard[card.id]||[]).reduce((s,p)=>s+p.amount,0); });
    return map;
  },[purchasePaymentsByCard,cards]);

  // Total remaining debt per card (current + future months, minus months already paid)
  const totalDebtByCard = useMemo(()=>{
    const map={};
    const now = new Date();
    const curY = now.getFullYear(), curM = now.getMonth()+1;
    cards.forEach(card=>{
      let debt = 0;
      purchases.filter(p=>p.cardId===card.id).forEach(p=>{
        getPurchasePayments(p).forEach(pay=>{
          if(pay.year > curY || (pay.year === curY && pay.month >= curM)) {
            // Check if this month's card payment was marked as paid
            const k = `${pay.year}-${pad(pay.month)}`;
            const isPaid = monthData[k]?.cards?.[card.id]?.paid;
            if(!isPaid) debt += pay.amount;
          }
        });
      });
      map[card.id] = debt;
    });
    return map;
  },[purchases,cards,monthData]);

  const timeline = useMemo(()=>{
    const items=[];
    // Carry-over from previous months
    if(carryOver !== 0 || (startingBalance.year===viewYear && startingBalance.month===viewMonth)) {
      const isStartMonth = startingBalance.year===viewYear && startingBalance.month===viewMonth;
      items.push({
        id:"carry-over", type:"income", isCarryOver:true,
        name: isStartMonth ? "Saldo inicial" : "Saldo anterior",
        sub: isStartMonth ? "Saldo de arranque" : `Acumulado de meses anteriores`,
        date:`${viewYear}-${pad(viewMonth)}-01`,
        amount: carryOver, status:"pagado",
      });
    }
    quincenas.forEach(q=>{
      const net=q.grossAmount-q.deductions;
      const ov=md.quincenas?.[q.id]||{};
      items.push({id:`q-${q.id}`,type:"income",name:q.label,sub:`${fmt(q.grossAmount)} − ${fmt(q.deductions)}`,
        date:`${viewYear}-${pad(viewMonth)}-${pad(q.day)}`,amount:ov.amount??net,status:ov.paid?"pagado":"pendiente",qId:q.id});
    });
    (md.extraIncomes||[]).forEach(ei=>{
      items.push({id:ei.id,type:"income",name:ei.name,sub:"Ingreso extra",date:ei.date,amount:ei.amount,status:ei.paid?"pagado":"pendiente",eiId:ei.id});
    });
    cards.forEach(card=>{
      const total=cardTotals[card.id]||0;
      if(total>0) {
        const pays=purchasePaymentsByCard[card.id]||[];
        const sub=pays.map(p=>`${p.desc}${p.isMSI?` (${p.installment}/${p.totalInstallments})`:""}` ).join(" · ");
        items.push({id:`c-${card.id}`,type:"expense",name:card.name,sub:sub||undefined,
          date:`${viewYear}-${pad(viewMonth)}-${pad(card.payDay)}`,amount:total,
          status:md.cards?.[card.id]?.paid?"pagado":"pendiente",cardId:card.id,cardColor:card.color});
      }
    });
    fixedExpenses.forEach(fe=>{
      const amt=md.fixed?.[fe.id]??fe.amount;
      if(amt>0) items.push({id:`fe-${fe.id}`,type:"expense",name:fe.name,date:`${viewYear}-${pad(viewMonth)}-${pad(fe.day)}`,amount:amt,status:md.fixedPaid?.[fe.id]?"pagado":"pendiente",feId:fe.id});
    });
    (md.variables||[]).forEach(v=>items.push({id:v.id,type:"expense",name:v.name,sub:"Variable",date:v.date,amount:v.amount,status:v.paid?"pagado":"pendiente",varId:v.id}));
    (md.extras||[]).forEach(ex=>items.push({id:ex.id,type:"expense",name:ex.name,sub:ex.sub,date:ex.date,amount:ex.amount,status:ex.paid?"pagado":"pendiente",exId:ex.id}));
    items.sort((a,b)=>(!a.date?1:!b.date?-1:a.date.localeCompare(b.date)));
    let bal=0;
    return items.map(item=>{ if(item.type==="income"||item.isCarryOver)bal+=item.amount; else bal-=item.amount; return {...item,balAfter:bal}; });
  },[cards,fixedExpenses,quincenas,md,viewYear,viewMonth,cardTotals,purchasePaymentsByCard,carryOver,startingBalance]);

  const totIn   = timeline.filter(i=>i.type==="income"&&!i.isCarryOver).reduce((s,i)=>s+i.amount,0);
  const totEx   = timeline.filter(i=>i.type==="expense").reduce((s,i)=>s+i.amount,0);
  const proj    = carryOver + totIn - totEx;
  const pending = timeline.filter(i=>i.type==="expense"&&i.status==="pendiente").reduce((s,i)=>s+i.amount,0);
  const paidAmt = timeline.filter(i=>i.type==="expense"&&i.status==="pagado").reduce((s,i)=>s+i.amount,0);

  // Alerts: overdue, due today, due tomorrow — only pending expenses in current real month
  const alerts = useMemo(()=>{
    const {y:nowY,m:nowM} = todayObj();
    const nowDate = new Date(); nowDate.setHours(0,0,0,0);
    const tomorrow = new Date(nowDate); tomorrow.setDate(tomorrow.getDate()+1);
    const dayAfter = new Date(nowDate); dayAfter.setDate(dayAfter.getDate()+2);
    const threeDays = new Date(nowDate); threeDays.setDate(threeDays.getDate()+3);
    // Only alert for the real current month
    if(viewYear !== nowY || viewMonth !== nowM) return [];
    const out = [];
    timeline.forEach(item=>{
      if(item.type!=="expense" || item.status==="pagado" || item.isCarryOver || !item.date) return;
      const d = new Date(item.date+"T12:00:00"); d.setHours(0,0,0,0);
      if(d < nowDate) out.push({...item, alertType:"overdue", icon:"🔴", label:"Vencido"});
      else if(d.getTime()===nowDate.getTime()) out.push({...item, alertType:"today", icon:"🟠", label:"Vence hoy"});
      else if(d.getTime()===tomorrow.getTime()) out.push({...item, alertType:"tomorrow", icon:"🟡", label:"Vence mañana"});
      else if(d < threeDays) out.push({...item, alertType:"soon", icon:"🔵", label:`Vence el ${pad(d.getDate())}`});
    });
    return out;
  },[timeline,viewYear,viewMonth]);

  // Saldo hoy: carry-over + paid incomes - paid expenses (reflects actual cash)
  const saldoHoy = useMemo(()=>{
    const {y:nowY,m:nowM} = todayObj();
    if(viewYear !== nowY || viewMonth !== nowM) return null;
    let bal = carryOver;
    timeline.forEach(item=>{
      if(item.isCarryOver) return;
      if(item.status!=="pagado") return;
      if(item.type==="income") bal += item.amount;
      else bal -= item.amount;
    });
    return bal;
  },[timeline,carryOver,viewYear,viewMonth]);

  // Saldo quincenal: projection at each quincena for non-current months
  const saldoQuincenal = useMemo(()=>{
    const {y:nowY,m:nowM} = todayObj();
    if(viewYear === nowY && viewMonth === nowM) return null; // current month uses saldoHoy
    if(quincenas.length === 0) return null;
    const sorted = [...quincenas].sort((a,b)=>a.day-b.day);
    const q = sorted[0];
    if(!q) return null;
    const qDate = `${viewYear}-${pad(viewMonth)}-${pad(q.day)}`;
    let bal = carryOver;
    timeline.forEach(item=>{
      if(item.isCarryOver) return;
      if(!item.date) return;
      if(item.date <= qDate) {
        if(item.type==="income") bal += item.amount;
        else bal -= item.amount;
      }
    });
    return { label: q.label, day: q.day, balance: bal };
  },[timeline,carryOver,viewYear,viewMonth,quincenas]);

  const deleteItem=(item,e)=>{
    e.stopPropagation();
    if(item.exId) updateMD(c=>({...c,extras:(c.extras||[]).filter(e=>e.id!==item.exId)}));
    else if(item.varId) updateMD(c=>({...c,variables:(c.variables||[]).filter(v=>v.id!==item.varId)}));
    else if(item.eiId) updateMD(c=>({...c,extraIncomes:(c.extraIncomes||[]).filter(e=>e.id!==item.eiId)}));
  };

  const toggle=(item)=>{
    if(item.isCarryOver) return;
    if(item.qId)    updateMD(c=>({...c,quincenas:{...(c.quincenas||{}),[item.qId]:{...(c.quincenas?.[item.qId]||{}),paid:!(c.quincenas?.[item.qId]||{}).paid}}}));
    else if(item.cardId) updateMD(c=>({...c,cards:{...(c.cards||{}),[item.cardId]:{...(c.cards?.[item.cardId]||{}),paid:!(c.cards?.[item.cardId]||{}).paid}}}));
    else if(item.feId)   updateMD(c=>({...c,fixedPaid:{...(c.fixedPaid||{}),[item.feId]:!c.fixedPaid?.[item.feId]}}));
    else if(item.varId)  updateMD(c=>({...c,variables:(c.variables||[]).map(v=>v.id===item.varId?{...v,paid:!v.paid}:v)}));
    else if(item.eiId)   updateMD(c=>({...c,extraIncomes:(c.extraIncomes||[]).map(e=>e.id===item.eiId?{...e,paid:!e.paid}:e)}));
    else if(item.exId)   updateMD(c=>({...c,extras:(c.extras||[]).map(e=>e.id===item.exId?{...e,paid:!e.paid}:e)}));
  };

  // Calculate projected surplus for a given month
  const getMonthSurplus = (y, m) => {
    const k = `${y}-${pad(m)}`;
    const mmd = monthData[k]||{};
    let income = 0, expense = 0;
    quincenas.forEach(q=>{ income += (mmd.quincenas?.[q.id]?.amount ?? (q.grossAmount-q.deductions)); });
    (mmd.extraIncomes||[]).forEach(ei=>{ income += ei.amount; });
    cards.forEach(card=>{
      purchases.flatMap(p=>p.cardId===card.id?getPurchasePayments(p):[])
        .filter(p=>p.year===y&&p.month===m).forEach(p=>{ expense += p.amount; });
    });
    fixedExpenses.forEach(fe=>{ expense += (mmd.fixed?.[fe.id]??fe.amount); });
    (mmd.variables||[]).forEach(v=>{ expense += v.amount; });
    (mmd.extras||[]).forEach(ex=>{ expense += ex.amount; });
    return income - expense;
  };

  // Calculate goal progress up to the viewed month
  const goalProgress = useMemo(()=>{
    return goals.map(goal=>{
      let accumulated = 0;
      const months = [];
      let y = goal.startYear, m = goal.startMonth;
      const {y:nowY,m:nowM} = todayObj();
      let reachedAt = null;
      // Iterate from start month up to the viewed month
      let safety = 0;
      while(safety < 120) {
        // Stop after the viewed month
        if(y > viewYear || (y === viewYear && m > viewMonth)) break;
        const k = `${y}-${pad(m)}`;
        const override = goal.overrides?.[k];
        const surplus = getMonthSurplus(y, m);
        const contribution = override != null ? override : Math.max(0, surplus);
        const isPast = (y < nowY || (y === nowY && m <= nowM));
        accumulated += contribution;
        months.push({ y, m, surplus, contribution, override: override != null, accumulated, isPast });
        if(reachedAt === null && accumulated >= goal.target) reachedAt = { y, m, monthsFromStart: safety+1 };
        m++; if(m>12){m=1;y++;}
        safety++;
      }
      // Average contribution from months so far
      const avgContribution = months.length > 0 ? months.reduce((s,mm)=>s+mm.contribution,0)/months.length : 0;
      const pct = goal.target > 0 ? Math.min(100, (accumulated/goal.target)*100) : 0;
      const remaining = Math.max(0, goal.target - accumulated);
      const monthsToGo = avgContribution > 0 ? Math.ceil(remaining / avgContribution) : null;
      // Project reachedAt if not yet reached
      if(reachedAt === null && avgContribution > 0) {
        const mToGo = Math.ceil(remaining / avgContribution);
        const projDate = new Date(viewYear, viewMonth - 1 + mToGo, 1);
        reachedAt = { y: projDate.getFullYear(), m: projDate.getMonth()+1, monthsFromStart: months.length + mToGo };
      }
      return { ...goal, currentAccumulated: accumulated, pct, remaining, avgContribution, monthsToGo, reachedAt, months };
    });
  },[goals,monthData,quincenas,cards,purchases,fixedExpenses,viewYear,viewMonth]);

  const TABS=[{id:"timeline",icon:"📅",label:"Timeline"},{id:"cards",icon:"💳",label:"TDC"},{id:"fixed",icon:"🏠",label:"Fijos"},{id:"goals",icon:"🎯",label:"Metas"},{id:"config",icon:"⚙️",label:"Config"}];



  return (
    <div style={{fontFamily:"'Outfit','Segoe UI',sans-serif",background:"#0A0F1E",minHeight:"100vh",color:"#F9FAFB",maxWidth:560,margin:"0 auto",paddingBottom:90}}>

      {/* Header */}
      <div style={{background:"#0D1424",borderBottom:"1px solid #1F2937",padding:"16px 18px 12px",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div>
            <div style={{color:"#6B7280",fontSize:11,letterSpacing:2,fontWeight:700,marginBottom:4}}>FINANZAS CONTROL</div>
            <MonthNav year={viewYear} month={viewMonth} onChange={(y,m)=>{setViewYear(y);setViewMonth(m);}}/>
          </div>
          <div style={{display:"flex",gap:14,alignItems:"flex-start",flexWrap:"wrap",justifyContent:"flex-end"}}>
            {saldoHoy !== null && (
              <div style={{textAlign:"right"}}>
                <div style={{color:"#059669",fontSize:10,letterSpacing:1,fontWeight:700}}>SALDO HOY</div>
                <div style={{fontWeight:800,fontSize:20,color:saldoHoy<0?"#EF4444":saldoHoy<5000?"#F59E0B":"#34D399"}}>{fmt(saldoHoy)}</div>
              </div>
            )}
            {saldoQuincenal && (
              <div style={{textAlign:"right"}}>
                <div style={{color:"#818CF8",fontSize:10,letterSpacing:1,fontWeight:700}}>{saldoQuincenal.label.toUpperCase()}</div>
                <div style={{color:"#6B7280",fontSize:10}}>Día {saldoQuincenal.day}</div>
                <div style={{fontWeight:800,fontSize:18,color:saldoQuincenal.balance<0?"#EF4444":saldoQuincenal.balance<5000?"#F59E0B":"#34D399"}}>{fmt(saldoQuincenal.balance)}</div>
              </div>
            )}
            <div style={{textAlign:"right"}}>
              <div style={{color:"#6B7280",fontSize:10,letterSpacing:1}}>PROYECCIÓN</div>
              <div style={{fontWeight:800,fontSize:20,color:proj<0?"#EF4444":proj<5000?"#F59E0B":"#34D399"}}>{fmt(proj)}</div>
            </div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[["Ingresos",fmt(totIn),"#34D399"],["Por pagar",fmt(pending),"#F59E0B"],["Pagado",fmt(paidAmt),"#6B7280"]].map(([l,v,c])=>(
            <div key={l} style={{background:"#111827",borderRadius:10,padding:"8px 10px",border:"1px solid #1F2937"}}>
              <div style={{color:"#4B5563",fontSize:10,letterSpacing:1,marginBottom:2}}>{l.toUpperCase()}</div>
              <div style={{color:c,fontWeight:700,fontSize:13}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TIMELINE */}
      {tab==="timeline" && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px 8px",flexWrap:"wrap",gap:6}}>
            <span style={{color:"#9CA3AF",fontSize:13,fontWeight:600}}>Movimientos del mes</span>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setModal({type:"addVariable"})} style={{padding:"6px 10px",borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:700,background:"#1F2937",border:"1px solid #374151",color:"#9CA3AF"}}>+ Variable</button>
              <button onClick={()=>setModal({type:"addExtra"})} style={{padding:"6px 10px",borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:700,background:"#1E1B4B",border:"1px solid #4338CA",color:"#818CF8"}}>+ Extra</button>
              <button onClick={()=>setModal({type:"addExtraIncome"})} style={{padding:"6px 10px",borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:700,background:"#064E3B",border:"1px solid #059669",color:"#34D399"}}>+ Ingreso</button>
            </div>
          </div>
          {/* Alerts */}
          {alerts.length>0 && (
            <div style={{padding:"0 18px 8px"}}>
              <div style={{background:"#1C1017",border:"1px solid #7F1D1D",borderRadius:14,overflow:"hidden"}}>
                <div style={{padding:"10px 14px 6px",display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:14}}>🔔</span>
                  <span style={{color:"#FBBF24",fontSize:12,fontWeight:700,letterSpacing:1}}>ALERTAS DE PAGO</span>
                </div>
                {alerts.map(a=>(
                  <div key={a.id} onClick={()=>toggle(a)} style={{padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",borderTop:"1px solid #2A1215"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:13}}>{a.icon}</span>
                      {a.cardColor && <div style={{width:3,height:20,borderRadius:2,background:a.cardColor}}/>}
                      <div>
                        <div style={{color:"#F9FAFB",fontSize:13,fontWeight:600}}>{a.name}</div>
                        <div style={{color:a.alertType==="overdue"?"#EF4444":"#F59E0B",fontSize:11,fontWeight:700}}>{a.label} · {fmt(a.amount)}</div>
                      </div>
                    </div>
                    <span style={{color:"#6B7280",fontSize:11}}>Toca para marcar pagado</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {timeline.length===0?(
            <div style={{textAlign:"center",color:"#374151",padding:"48px 0"}}><div style={{fontSize:36,marginBottom:10}}>📭</div>Agrega compras a tus tarjetas para empezar.</div>
          ):(
          <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:"#111827"}}>
                  {["CONCEPTO","DÍA","MONTO","SALDO"].map((h,i)=>(
                    <th key={h} style={{padding:"8px",textAlign:i>=2?"right":i===1?"center":"left",color:"#4B5563",fontSize:11,letterSpacing:1,fontWeight:700,borderBottom:"1px solid #1F2937"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeline.map((item,i)=>{
                  const isInc=item.type==="income";
                  const ov=(()=>{if(isInc||item.status!=="pendiente"||!item.date) return false;const {y:ny,m:nm}=todayObj();if(viewYear!==ny||viewMonth!==nm) return false;return new Date(item.date+"T12:00:00")<new Date();})();
                  return (
                    <tr key={item.id} onClick={()=>toggle(item)} style={{cursor:"pointer",background:i%2===1?"#0F172A":"#111827"}}>
                      <td style={{padding:"10px 8px",borderBottom:"1px solid #1F2937"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          {item.cardColor&&<div style={{width:3,height:30,borderRadius:2,background:item.cardColor,flexShrink:0}}/>}
                          <div>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <span style={{color:item.status==="pagado"?"#6B7280":"#F9FAFB",fontSize:13,fontWeight:600,textDecoration:item.status==="pagado"?"line-through":"none"}}>{item.name}</span>
                              {(item.exId||item.varId||item.eiId)&&<button onClick={e=>deleteItem(item,e)} style={{fontSize:9,background:"#1F0000",border:"1px solid #EF444433",borderRadius:4,color:"#EF4444",padding:"1px 5px",cursor:"pointer",lineHeight:1}}>✕</button>}
                            </div>
                            {(ov||item.sub)&&<div style={{fontSize:11,color:"#4B5563",marginTop:1,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ov&&<span style={{color:"#EF4444"}}>⚠ vencido · </span>}{item.sub}{item.isCarryOver&&<button onClick={e=>{e.stopPropagation();setModal({type:"editBalanceOverride",currentAmount:item.amount});}} style={{marginLeft:8,fontSize:10,background:"#1F2937",border:"1px solid #374151",borderRadius:6,color:"#9CA3AF",padding:"1px 7px",cursor:"pointer"}}>✏ editar</button>}{item.isCarryOver&&md.balanceOverride!=null&&<span style={{marginLeft:6,fontSize:10,color:"#F59E0B"}}>✎ manual</span>}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{padding:"10px 4px",borderBottom:"1px solid #1F2937",textAlign:"center"}}>
                        <span style={{color:"#6B7280",fontSize:12}}>{item.date?pad(new Date(item.date+"T12:00:00").getDate()):"—"}</span>
                      </td>
                      <td style={{padding:"10px 8px",borderBottom:"1px solid #1F2937",textAlign:"right"}}>
                        <span style={{fontWeight:700,fontSize:13,color:isInc?"#34D399":item.status==="pagado"?"#6B7280":"#F87171"}}>{isInc?"+":"-"}{fmt(item.amount)}</span>
                      </td>
                      <td style={{padding:"10px 8px",borderBottom:"1px solid #1F2937",textAlign:"right"}}>
                        <span style={{fontWeight:700,fontSize:13,color:item.balAfter<0?"#EF4444":item.balAfter<5000?"#F59E0B":"#D1D5DB"}}>{fmt(item.balAfter)}</span>
                      </td>
                    </tr>
                  );
                })}
                <tr style={{background:"#0D1424"}}>
                  <td colSpan={2} style={{padding:"12px 8px",color:"#6B7280",fontSize:12,fontWeight:700}}>SALDO FINAL PROYECTADO</td>
                  <td colSpan={2} style={{padding:"12px 8px",textAlign:"right",fontWeight:800,fontSize:16,color:proj<0?"#EF4444":proj<5000?"#F59E0B":"#34D399"}}>{fmt(proj)}</td>
                </tr>
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* CARDS */}
      {tab==="cards" && (
        <div style={{padding:"14px 18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <span style={{color:"#9CA3AF",fontSize:13,fontWeight:600}}>Tarjetas de crédito</span>
            <button onClick={()=>setModal({type:"addCard"})} style={{padding:"7px 14px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,background:"#1E1B4B",border:"1px solid #4338CA",color:"#818CF8"}}>+ Nueva TDC</button>
          </div>
          {cards.map(card=>(
            <CardFicha key={card.id} card={card}
              cardMd={md.cards?.[card.id]}
              cardPayments={purchasePaymentsByCard[card.id]||[]}
              totalThisMonth={cardTotals[card.id]||0}
              totalDebt={totalDebtByCard[card.id]||0}
              onAddPurchase={()=>setModal({type:"addPurchase",card})}
              onViewPurchases={()=>setModal({type:"viewCardPurchases",card,onAddPurchase:()=>setModal({type:"addPurchase",card})})}
              onEditCard={()=>setModal({type:"editCard",card})}
              onTogglePaid={()=>updateMD(c=>({...c,cards:{...(c.cards||{}),[card.id]:{...(c.cards?.[card.id]||{}),paid:!(c.cards?.[card.id]||{}).paid}}}))}
            />
          ))}
        </div>
      )}

      {/* FIXED */}
      {tab==="fixed" && (
        <div style={{padding:"14px 18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <span style={{color:"#9CA3AF",fontSize:13,fontWeight:600}}>Gastos fijos y variables</span>
            <button onClick={()=>setModal({type:"addFixed"})} style={{padding:"7px 14px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,background:"#1F2937",border:"1px solid #374151",color:"#9CA3AF"}}>+ Nuevo</button>
          </div>
          {fixedExpenses.map(fe=>{
            const amt=md.fixed?.[fe.id]??fe.amount;
            const isPaid=md.fixedPaid?.[fe.id]||false;
            return (
              <div key={fe.id} style={{background:"#111827",borderRadius:14,padding:"14px 16px",marginBottom:10,border:"1px solid #1F2937"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{color:"#F9FAFB",fontWeight:700,fontSize:15}}>{fe.name}</div>
                    <div style={{color:"#6B7280",fontSize:12}}>Día {fe.day} · {fe.type==="fixed"?"Fijo":"Variable"}</div>
                  </div>
                  <div style={{color:isPaid?"#6B7280":"#F9FAFB",fontWeight:800,fontSize:18,textDecoration:isPaid?"line-through":"none"}}>{fmt(amt)}</div>
                </div>
                <div style={{display:"flex",gap:8,marginTop:10}}>
                  <button onClick={()=>updateMD(c=>({...c,fixedPaid:{...(c.fixedPaid||{}),[fe.id]:!isPaid}}))}
                    style={{flex:1,padding:"7px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,background:isPaid?"#1F2937":"#064E3B",border:`1px solid ${isPaid?"#374151":"#059669"}`,color:isPaid?"#9CA3AF":"#34D399"}}>{isPaid?"↩ Revertir":"✓ Pagar"}</button>
                  <button onClick={()=>setModal({type:"editFixed",fe})} style={{padding:"7px 12px",borderRadius:8,cursor:"pointer",fontSize:12,background:"#1F2937",border:"1px solid #374151",color:"#9CA3AF"}}>✏</button>
                  <button onClick={()=>{setFixed(prev=>prev.filter(f=>f.id!==fe.id));}} style={{padding:"7px 12px",borderRadius:8,cursor:"pointer",fontSize:12,background:"#1F0000",border:"1px solid #EF444433",color:"#EF4444"}}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CONFIG */}
      {/* GOALS */}
      {tab==="goals" && (
        <div style={{padding:"14px 18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <span style={{color:"#9CA3AF",fontSize:13,fontWeight:600}}>Mis metas de ahorro</span>
            <button onClick={()=>setModal({type:"addGoal"})} style={{padding:"7px 14px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,background:"#1E1B4B",border:"1px solid #4338CA",color:"#818CF8"}}>+ Nueva meta</button>
          </div>
          {goalProgress.length===0 && (
            <div style={{textAlign:"center",color:"#374151",padding:"48px 0"}}><div style={{fontSize:36,marginBottom:10}}>🎯</div>Crea tu primera meta de ahorro.</div>
          )}
          {goalProgress.map(gp=>{
            const barColor = gp.pct >= 100 ? "#34D399" : gp.pct >= 50 ? "#818CF8" : "#F59E0B";
            return (
              <div key={gp.id} style={{background:"#111827",borderRadius:16,overflow:"hidden",border:"1px solid #1F2937",marginBottom:14}}>
                <div style={{padding:"16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                    <div>
                      <div style={{color:"#F9FAFB",fontWeight:800,fontSize:17}}>{gp.name}</div>
                      <div style={{color:"#6B7280",fontSize:12}}>Desde {MONTHS[gp.startMonth-1]} {gp.startYear}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{color:"#F9FAFB",fontWeight:800,fontSize:18}}>{fmt(gp.target)}</div>
                      <div style={{color:"#6B7280",fontSize:11}}>objetivo</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{color:barColor,fontWeight:700,fontSize:14}}>{gp.pct.toFixed(1)}%</span>
                      <span style={{color:"#9CA3AF",fontSize:12}}>{fmt(gp.currentAccumulated)} / {fmt(gp.target)}</span>
                    </div>
                    <div style={{height:8,background:"#1F2937",borderRadius:4,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${gp.pct}%`,background:`linear-gradient(90deg,${barColor},${barColor}cc)`,borderRadius:4,transition:"width .5s"}}/>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                    <div style={{background:"#0F172A",borderRadius:8,padding:"8px 10px"}}>
                      <div style={{color:"#4B5563",fontSize:10,letterSpacing:1,fontWeight:700}}>ACUMULADO</div>
                      <div style={{color:"#34D399",fontWeight:700,fontSize:13}}>{fmt(gp.currentAccumulated)}</div>
                    </div>
                    <div style={{background:"#0F172A",borderRadius:8,padding:"8px 10px"}}>
                      <div style={{color:"#4B5563",fontSize:10,letterSpacing:1,fontWeight:700}}>FALTANTE</div>
                      <div style={{color:"#F59E0B",fontWeight:700,fontSize:13}}>{fmt(gp.remaining)}</div>
                    </div>
                    <div style={{background:"#0F172A",borderRadius:8,padding:"8px 10px"}}>
                      <div style={{color:"#4B5563",fontSize:10,letterSpacing:1,fontWeight:700}}>PROMEDIO/MES</div>
                      <div style={{color:"#818CF8",fontWeight:700,fontSize:13}}>{fmt(gp.avgContribution)}</div>
                    </div>
                  </div>

                  {/* Estimation */}
                  {gp.pct < 100 && gp.monthsToGo !== null && (
                    <div style={{background:"#1E1B4B",borderRadius:10,padding:"10px 14px",marginBottom:12,border:"1px solid #4338CA33"}}>
                      <div style={{color:"#C7D2FE",fontSize:13}}>📊 A este ritmo llegas en <strong>{gp.monthsToGo} mes{gp.monthsToGo!==1?"es":""}</strong></div>
                      {gp.reachedAt && <div style={{color:"#818CF8",fontSize:12,marginTop:2}}>Estimado: {MONTHS[gp.reachedAt.m-1]} {gp.reachedAt.y}</div>}
                    </div>
                  )}
                  {gp.pct >= 100 && (
                    <div style={{background:"#064E3B",borderRadius:10,padding:"10px 14px",marginBottom:12,border:"1px solid #05966333"}}>
                      <div style={{color:"#34D399",fontSize:14,fontWeight:700}}>🎉 ¡Meta alcanzada!</div>
                    </div>
                  )}

                  {/* Monthly breakdown */}
                  {gp.months.length > 0 && (
                    <div style={{marginBottom:12}}>
                      <div style={{color:"#6B7280",fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:6}}>HISTORIAL MENSUAL</div>
                      {gp.months.map(mm=>(
                        <div key={`${mm.y}-${mm.m}`} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #1F2937"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{color:"#9CA3AF",fontSize:12,minWidth:70}}>{MONTHS[mm.m-1].slice(0,3)} {mm.y}</span>
                            {mm.override && <span style={{fontSize:9,background:"#3D2C00",color:"#F59E0B",padding:"1px 6px",borderRadius:10,fontWeight:700}}>MANUAL</span>}
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:12}}>
                            <span style={{color:mm.contribution>0?"#34D399":"#6B7280",fontSize:13,fontWeight:600}}>{fmt(mm.contribution)}</span>
                            <button onClick={()=>{setModal({type:"editGoalMonth",goalId:gp.id,monthKey:`${mm.y}-${pad(mm.m)}`,monthLabel:`${MONTHS[mm.m-1]} ${mm.y}`,currentAmount:mm.contribution});}} style={{fontSize:10,background:"#1F2937",border:"1px solid #374151",borderRadius:6,color:"#9CA3AF",padding:"2px 8px",cursor:"pointer"}}>✏</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>setModal({type:"editGoal",goal:gp})} style={{flex:1,padding:"8px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,background:"#1F2937",border:"1px solid #374151",color:"#9CA3AF"}}>✏ Editar</button>
                    <button onClick={()=>{setGoals(prev=>prev.filter(g=>g.id!==gp.id));}} style={{padding:"8px 14px",borderRadius:8,cursor:"pointer",fontSize:12,background:"#1F0000",border:"1px solid #EF444433",color:"#EF4444"}}>🗑</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab==="config" && (
        <div style={{padding:"14px 18px"}}>
          {/* Starting Balance */}
          <div style={{background:"#111827",borderRadius:14,padding:"14px 16px",marginBottom:20,border:"1px solid #1F2937"}}>
            <div style={{color:"#F9FAFB",fontWeight:700,fontSize:15,marginBottom:4}}>💰 Saldo inicial</div>
            <div style={{color:"#6B7280",fontSize:12,marginBottom:12}}>Cuánto tenías cuando empezaste a usar la app. A partir de ese mes, el saldo se acumula automáticamente.</div>
            <div style={{display:"flex",gap:10,marginBottom:10}}>
              <div style={{flex:2}}>
                <div style={{color:"#9CA3AF",fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:5}}>MONTO ($)</div>
                <input style={IS} type="number" min="0" value={startingBalance.amount||""} placeholder="0.00"
                  onChange={e=>setStartingBalance(p=>({...p,amount:parseFloat(e.target.value)||0}))}/>
              </div>
              <div style={{flex:1}}>
                <div style={{color:"#9CA3AF",fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:5}}>MES</div>
                <MonthYearSelect year={startingBalance.year} month={startingBalance.month}
                  onChange={(y,m)=>setStartingBalance(p=>({...p,year:y,month:m}))}/>
              </div>
            </div>
            <div style={{background:"#064E3B",borderRadius:10,padding:"8px 12px",color:"#34D399",fontSize:13}}>
              La app suma automáticamente lo que sobra (o falta) de cada mes y lo lleva al siguiente.
            </div>
          </div>

          <div style={{color:"#9CA3AF",fontSize:13,fontWeight:600,marginBottom:14}}>Quincenas / Ingresos recurrentes</div>
          {quincenas.map(q=>(
            <div key={q.id} style={{background:"#111827",borderRadius:14,padding:"14px 16px",marginBottom:10,border:"1px solid #1F2937"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{color:"#F9FAFB",fontWeight:700}}>{q.label}</div>
                  <div style={{color:"#6B7280",fontSize:12}}>Día {q.day} · {fmt(q.grossAmount)} − {fmt(q.deductions)}</div>
                  <div style={{color:"#34D399",fontSize:13,fontWeight:700,marginTop:2}}>Neto: {fmt(q.grossAmount-q.deductions)}</div>
                </div>
                <button onClick={()=>setModal({type:"editQuincena",q})} style={{padding:"7px 12px",borderRadius:8,cursor:"pointer",fontSize:12,background:"#1F2937",border:"1px solid #374151",color:"#9CA3AF"}}>✏</button>
              </div>
            </div>
          ))}
          <button onClick={()=>setModal({type:"addQuincena"})} style={{width:"100%",padding:"11px",borderRadius:10,cursor:"pointer",fontSize:13,fontWeight:700,background:"#064E3B",border:"1px solid #059669",color:"#34D399",marginBottom:24}}>+ Agregar ingreso recurrente</button>

          {/* Account */}
          {user && (
            <div style={{background:"#111827",borderRadius:14,padding:"14px 16px",marginBottom:20,border:"1px solid #1F2937"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div>
                  <div style={{color:"#F9FAFB",fontWeight:700,fontSize:15}}>👤 {user.displayName}</div>
                  <div style={{color:"#6B7280",fontSize:12}}>{user.email}</div>
                </div>
                <button onClick={onLogout} style={{padding:"7px 14px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,background:"#1F0000",border:"1px solid #EF444433",color:"#EF4444"}}>Cerrar sesión</button>
              </div>
            </div>
          )}

          {/* Export / Import */}
          <div style={{background:"#111827",borderRadius:14,padding:"14px 16px",marginBottom:20,border:"1px solid #1F2937"}}>
            <div style={{color:"#F9FAFB",fontWeight:700,fontSize:15,marginBottom:4}}>📦 Datos</div>
            <div style={{color:"#6B7280",fontSize:12,marginBottom:12}}>Exporta o importa tus datos.</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setModal({type:"exportData"})} style={{flex:1,padding:"10px",borderRadius:10,cursor:"pointer",fontSize:13,fontWeight:700,background:"#1E1B4B",border:"1px solid #4338CA",color:"#818CF8"}}>
                📤 Exportar
              </button>
              <button onClick={()=>setModal({type:"importData"})} style={{flex:1,padding:"10px",borderRadius:10,cursor:"pointer",fontSize:13,fontWeight:700,background:"#064E3B",border:"1px solid #059669",color:"#34D399"}}>
                📥 Importar
              </button>
            </div>
          </div>

          <div style={{color:"#9CA3AF",fontSize:13,fontWeight:600,marginBottom:14}}>Todas las compras registradas</div>
          {purchases.length===0&&<div style={{color:"#374151",fontSize:13}}>Sin compras registradas aún.</div>}
          {purchases.map(p=>{
            const card=cards.find(c=>c.id===p.cardId);
            const pays=getPurchasePayments(p);
            const t=todayObj();
            const remaining=p.isMSI?pays.filter(pay=>new Date(pay.year,pay.month-1)>=new Date(t.y,t.m-1)).length:null;
            return (
              <div key={p.id} style={{background:"#111827",borderRadius:12,padding:"12px 14px",marginBottom:8,border:"1px solid #1F2937"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                      {card&&<div style={{width:3,height:16,borderRadius:2,background:card.color}}/>}
                      <span style={{color:"#F9FAFB",fontWeight:600,fontSize:14}}>{p.description}</span>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,color:"#6B7280"}}>{card?.name}</span>
                      <span style={{fontSize:11,background:p.isMSI?"#1E1B4B":"#064E3B",color:p.isMSI?"#818CF8":"#34D399",padding:"1px 7px",borderRadius:20,fontWeight:700}}>{p.isMSI?`${p.months} MSI`:"Pago único"}</span>
                      {p.isMSI&&<span style={{fontSize:11,color:"#9CA3AF"}}>{fmt(p.total/p.months)}/mes</span>}
                      {remaining!==null&&<span style={{fontSize:11,color:"#6B7280"}}>{remaining} restante{remaining!==1?"s":""}</span>}
                    </div>
                  </div>
                  <div style={{textAlign:"right",marginLeft:8}}>
                    <div style={{color:"#F9FAFB",fontWeight:700,fontSize:14}}>{fmt(p.total)}</div>
                    <button onClick={()=>{setPurchases(prev=>prev.filter(x=>x.id!==p.id));}}
                      style={{fontSize:11,color:"#EF4444",background:"#1F0000",border:"1px solid #EF444433",borderRadius:6,padding:"2px 8px",cursor:"pointer",marginTop:4}}>✕</button>
                    {p.isMSI && remaining > 1 && (()=>{
                      const now2=new Date();const cY=now2.getFullYear();const cM=now2.getMonth()+1;
                      const allPays=getPurchasePayments(p);
                      const remPays=allPays.filter(pay=>new Date(pay.year,pay.month-1)>=new Date(cY,cM-1));
                      const remTotal=remPays.reduce((s,pay)=>s+pay.amount,0);
                      return (
                        <button onClick={()=>{
                          setPurchases(prev=>{
                            const without=prev.filter(x=>x.id!==p.id);
                            return [...without,{id:Date.now().toString(),cardId:p.cardId,description:p.description+" (liquidación)",total:remTotal,isMSI:false,months:1,chargeYear:cY,chargeMonth:cM}];
                          });
                        }} style={{fontSize:11,color:"#818CF8",background:"#1E1B4B",border:"1px solid #4338CA",borderRadius:6,padding:"2px 8px",cursor:"pointer",marginTop:4}}>💰</button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom nav */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:560,background:"#0D1424",borderTop:"1px solid #1F2937",display:"flex",zIndex:100}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"12px 4px 14px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <span style={{fontSize:20}}>{t.icon}</span>
            <span style={{fontSize:10,fontWeight:700,letterSpacing:.5,color:tab===t.id?"#818CF8":"#4B5563"}}>{t.label.toUpperCase()}</span>
            {tab===t.id&&<div style={{width:20,height:2,background:"#818CF8",borderRadius:1}}/>}
          </button>
        ))}
      </div>

      {modal?.type==="importData" && (()=>{
        return (
          <Sheet title="📥 Importar datos" onClose={()=>setModal(null)}>
            <div style={{color:"#6B7280",fontSize:12,marginBottom:10}}>Pega el JSON que exportaste desde la versión anterior.</div>
            <textarea id="importArea" style={{width:"100%",height:180,background:"#0F172A",border:"1px solid #374151",borderRadius:10,padding:12,color:"#9CA3AF",fontSize:11,fontFamily:"monospace",resize:"vertical",boxSizing:"border-box"}} placeholder="Pega el JSON aquí..."/>
            <div style={{marginTop:10}}>
              <button onClick={()=>{
                try {
                  const raw=document.getElementById("importArea").value;
                  const d=JSON.parse(raw);
                  if(d.cards) setCards(d.cards.map(c=>({...c,limit:c.limit??0})));
                  if(d.fixedExpenses) setFixed(d.fixedExpenses);
                  if(d.quincenas) setQuincenas(d.quincenas);
                  if(d.purchases) setPurchases(d.purchases);
                  if(d.goals) setGoals(d.goals);
                  if(d.monthData) setMonthData(d.monthData);
                  if(d.startingBalance) setStartingBalance(d.startingBalance);
                  setModal(null);
                } catch(e){ alert("Error: JSON inválido"); }
              }} style={{width:"100%",padding:"13px",borderRadius:12,background:"#064E3B",border:"1px solid #059669",color:"#34D399",fontSize:15,fontWeight:700,cursor:"pointer"}}>
                Importar datos
              </button>
            </div>
          </Sheet>
        );
      })()}

      {modal?.type==="exportData" && (()=>{
        const data = JSON.stringify({ cards, fixedExpenses, quincenas, purchases, goals, monthData, startingBalance, exportDate: new Date().toISOString(), version: "finanzas-control-v1" }, null, 2);
        return (
          <Sheet title="📦 Exportar datos" onClose={()=>setModal(null)}>
            <div style={{color:"#6B7280",fontSize:12,marginBottom:10}}>Copia todo el texto de abajo y guárdalo en un archivo. Lo usaremos para importar en la nueva versión.</div>
            <textarea readOnly value={data} style={{width:"100%",height:200,background:"#0F172A",border:"1px solid #374151",borderRadius:10,padding:12,color:"#9CA3AF",fontSize:11,fontFamily:"monospace",resize:"vertical",boxSizing:"border-box"}} onClick={e=>e.target.select()}/>
            <div style={{marginTop:10}}>
              <button onClick={()=>{navigator.clipboard.writeText(data).then(()=>{}).catch(()=>{});}} style={{width:"100%",padding:"13px",borderRadius:12,background:"#4338CA",border:"1px solid #6366F1",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer"}}>
                📋 Copiar al portapapeles
              </button>
            </div>
          </Sheet>
        );
      })()}

      <ActiveModal
        modal={modal}
        cards={cards} fixedExpenses={fixedExpenses} purchases={purchases} quincenas={quincenas}
        viewYear={viewYear} viewMonth={viewMonth} md={md}
        setCards={setCards} setFixed={setFixed} setPurchases={setPurchases} setQuincenas={setQuincenas}
        updateMD={updateMD}
        onSaveGoal={(g)=>setGoals(prev=>[...prev,g])}
        onUpdateGoal={(id,data)=>setGoals(prev=>prev.map(g=>g.id===id?{...g,...data}:g))}
        onUpdateGoalMonth={(goalId,monthKey,amount)=>setGoals(prev=>prev.map(g=>g.id===goalId?{...g,overrides:{...(g.overrides||{}),[monthKey]:amount}}:g))}
        onClose={()=>setModal(null)}
      />
    </div>
  );
}
