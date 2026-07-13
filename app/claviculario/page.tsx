"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {ArrowLeft,CloudSun,Expand,KeyRound,Monitor,PenLine,RefreshCw,RotateCcw,Save,UserRound} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
import {getPirassunungaWeather,type CurrentWeather} from "@/lib/weather";
type Slot={id:string;slot_number:number;status:string}; type Ev={key_slot_id:string;event_type:string;holder_name:string;mission:string|null;occurred_at:string};
type DutyRosterRow={profiles:{full_name:string;rank:string|null}|null};

function todayInPirassununga(){
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const value=(type:Intl.DateTimeFormatPartTypes)=>parts.find(part=>part.type===type)?.value??"";
 return `${value("year")}-${value("month")}-${value("day")}`;
}
export default function Claviculario(){
 const[slots,setSlots]=useState<Slot[]>([]),[events,setEvents]=useState<Ev[]>([]),[selected,setSelected]=useState<Slot|null>(null),[monitor,setMonitor]=useState(false);
 const[mission,setMission]=useState(""),[destination,setDestination]=useState(""),[external,setExternal]=useState(""),[message,setMessage]=useState(""),[saving,setSaving]=useState(false);
 const[hasSignature,setHasSignature]=useState(false);
 const[dutySergeant,setDutySergeant]=useState("carregando...");
 const[weather,setWeather]=useState<CurrentWeather|null>(null),[weatherStatus,setWeatherStatus]=useState<"loading"|"ready"|"error">("loading");
 const canvas=useRef<HTMLCanvasElement>(null),drawing=useRef(false),lastPoint=useRef<{x:number;y:number}|null>(null);
 async function load(){const supabase=createClient();const[{data:s},{data:e}]=await Promise.all([supabase.from("key_slots").select("*").eq("active",true).order("slot_number"),supabase.from("key_events").select("key_slot_id,event_type,holder_name,mission,occurred_at").order("occurred_at",{ascending:false}).limit(200)]);setSlots(s||[]);setEvents(e||[])}
 useEffect(()=>{const supabase=createClient();queueMicrotask(()=>{void load()});const c=supabase.channel("keys").on("postgres_changes",{event:"*",schema:"public",table:"key_events"},load).subscribe();return()=>{void supabase.removeChannel(c)}},[]);
 useEffect(()=>{const supabase=createClient(),dutyDate=todayInPirassununga();
  const loadDutySergeant=async()=>{const{data,error}=await supabase.from("duty_rosters").select("profiles!duty_rosters_profile_id_fkey(full_name,rank)").eq("duty_date",dutyDate).maybeSingle();
   if(error){setDutySergeant("indisponível");return}const row=data as DutyRosterRow|null,profile=row?.profiles;
   setDutySergeant(profile?[profile.rank,profile.full_name].filter(Boolean).join(" "):"não definido")};
  void loadDutySergeant();const channel=supabase.channel(`duty-roster-${dutyDate}`).on("postgres_changes",{event:"*",schema:"public",table:"duty_rosters",filter:`duty_date=eq.${dutyDate}`},()=>{void loadDutySergeant()}).subscribe();
  return()=>{void supabase.removeChannel(channel)};
 },[]);
 useEffect(()=>{let active=true;const loadWeather=async()=>{try{const current=await getPirassunungaWeather();if(active){setWeather(current);setWeatherStatus("ready")}}catch{if(active){setWeather(null);setWeatherStatus("error")}}};
  void loadWeather();const timer=window.setInterval(()=>{void loadWeather()},20*60*1000);return()=>{active=false;window.clearInterval(timer)};
 },[]);
 const latest=(id:string)=>events.find(e=>e.key_slot_id===id),out=(id:string)=>["checkout","transfer"].includes(latest(id)?.event_type||"");
 function pos(e:React.PointerEvent<HTMLCanvasElement>){const c=canvas.current!,r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height}}
 function start(e:React.PointerEvent<HTMLCanvasElement>){drawing.current=true;const p=pos(e),x=canvas.current!.getContext("2d")!;lastPoint.current=p;x.beginPath();x.moveTo(p.x,p.y);canvas.current!.setPointerCapture(e.pointerId)}
 function draw(e:React.PointerEvent<HTMLCanvasElement>){if(!drawing.current)return;const p=pos(e),previous=lastPoint.current,x=canvas.current!.getContext("2d")!;if(previous&&Math.hypot(p.x-previous.x,p.y-previous.y)>=1)setHasSignature(true);lastPoint.current=p;x.lineWidth=3;x.lineCap="round";x.strokeStyle="#071f3c";x.lineTo(p.x,p.y);x.stroke()}
 function stop(){drawing.current=false;lastPoint.current=null}
 function clear(){canvas.current?.getContext("2d")?.clearRect(0,0,700,220);setHasSignature(false);lastPoint.current=null}
 async function save(){if(!selected||!mission.trim()){setMessage("Informe a missão.");return}if(!hasSignature){setMessage("Faça a assinatura antes de salvar.");return}setSaving(true);const supabase=createClient();const{data:{user}}=await supabase.auth.getUser();if(!user){setMessage("Sessão expirada.");setSaving(false);return}
  const blob=await new Promise<Blob|null>(r=>canvas.current?.toBlob(r,"image/webp",.55));if(!blob){setMessage("Faça a assinatura.");setSaving(false);return}
  const buffer=await blob.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",buffer))).map(b=>b.toString(16).padStart(2,"0")).join(""),clientId=crypto.randomUUID(),path=user.id+"/"+new Date().toISOString().slice(0,10)+"/"+clientId+".webp";
  const up=await supabase.storage.from("key-signatures").upload(path,blob,{contentType:"image/webp"});if(up.error){setMessage("Erro ao salvar assinatura.");setSaving(false);return}const type=out(selected.id)?"return":"checkout";
  const{error}=await supabase.rpc("record_key_event",{p_key_slot_id:selected.id,p_event_type:type,p_mission:mission,p_destination:destination||null,p_notes:external?"Viatura externa: "+external:null,p_signature_path:path,p_signature_sha256:hash,p_client_event_id:clientId});
  if(error){await supabase.storage.from("key-signatures").remove([path]);setMessage(error.message);setSaving(false);return}setMessage(type==="checkout"?"Retirada assinada.":"Devolução assinada.");setSelected(null);setMission("");clear();await load();setSaving(false)}
 return <main className={monitor?"key-page monitor-mode":"key-page"}><header className="key-header"><div className="key-brand"><Link href="/"><ArrowLeft/></Link><img src="/ssv-logo-transparent.png" alt="SSV"/><span><b>Claviculário Digital</b><small>Retirada e devolução de chaves</small></span></div><div className="key-context"><span><UserRound/><small>Sargento de Dia</small><b>{dutySergeant}</b></span><span><CloudSun/><small>Pirassununga</small><b>{weatherStatus==="loading"?"Carregando clima...":weatherStatus==="error"||!weather?"Clima indisponível":`${Math.round(weather.temperatureCelsius)} °C · ${weather.description}`}</b></span></div><div className="key-actions"><button onClick={load}><RefreshCw/>Atualizar</button><button onClick={()=>setMonitor(!monitor)}><Monitor/>Monitor</button><button onClick={()=>document.documentElement.requestFullscreen?.()}><Expand/>Tela cheia</button></div></header>
 <section className="key-summary"><div><b>{slots.length}</b><small>Posições</small></div><div><b>{slots.filter(s=>!out(s.id)).length}</b><small>Disponíveis</small></div><div><b>{slots.filter(s=>out(s.id)).length}</b><small>Retiradas</small></div></section>
 <section className="key-grid">{slots.map(s=>{const e=latest(s.id),busy=out(s.id);return <button key={s.id} className={busy?"key-slot busy":"key-slot"} onClick={()=>!monitor&&setSelected(s)}><strong>{s.slot_number}</strong><KeyRound/><b>{busy?"RETIRADA":"DISPONÍVEL"}</b>{e&&<><small>{e.holder_name}</small><em>{e.mission||"Sem missão"}</em><time>{new Date(e.occurred_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</time></>}</button>})}</section>
 {selected&&<div className="key-modal-bg"><section className="key-modal"><div className="key-modal-title"><strong>{selected.slot_number}</strong><div><small>{out(selected.id)?"DEVOLUÇÃO":"RETIRADA"}</small><h2>Posição {selected.slot_number}</h2></div></div><label>Viatura externa/temporária<input value={external} onChange={e=>setExternal(e.target.value)} placeholder="Ex.: Prefeitura — 10DP174"/></label><label>Missão<input value={mission} onChange={e=>setMission(e.target.value)} required/></label><label>Destino<input value={destination} onChange={e=>setDestination(e.target.value)}/></label><label className="signature-label"><span><PenLine/>Assine com o dedo</span><canvas ref={canvas} width="700" height="220" onPointerDown={start} onPointerMove={draw} onPointerUp={stop} onPointerCancel={stop}/><button onClick={clear}><RotateCcw/>Limpar</button></label>{message&&<p>{message}</p>}<div className="key-modal-actions"><button onClick={()=>{clear();setSelected(null)}}>Cancelar</button><button className="key-save" onClick={save} disabled={saving||!hasSignature}><Save/>{saving?"Salvando...":"Assinar e salvar"}</button></div></section></div>}</main>
}
