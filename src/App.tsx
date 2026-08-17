import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { ParticleSphereMenu, type SphereMenuItem } from './ParticleSphereMenu';

const Icon=({kind}:{kind:string})=><svg viewBox="0 0 24 24" aria-hidden="true"><path d={kind}/></svg>;
export const menuItems:SphereMenuItem[]=[
  {id:'profilo',title:'Profilo',summary:'Il percorso, le ossessioni e il modo in cui affronto problemi complessi.',href:'/profilo',accentColor:'#ff4fa3',position:{latitudeDeg:24,longitudeDeg:-28},icon:<Icon kind="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c.8-4 3.1-6 7-6s6.2 2 7 6"/>},
  {id:'progetti',title:'Progetti',summary:'Prodotti digitali, sistemi visivi ed esperimenti costruiti per durare.',href:'/progetti',accentColor:'#77f6ff',position:{latitudeDeg:-8,longitudeDeg:22},icon:<Icon kind="M4 6h16v12H4zM8 3v6m8-6v6"/>},
  {id:'lab',title:'Lab',summary:'Prototipi, WebGPU e idee ancora abbastanza strane da essere interessanti.',href:'/lab',accentColor:'#ff8a3d',position:{latitudeDeg:43,longitudeDeg:95},icon:<Icon kind="m9 3 1 7-5 9h14l-5-9 1-7M8 14h8"/>},
  {id:'note',title:'Note',summary:'Appunti su design, tecnologia e tutto ciò che merita una seconda occhiata.',href:'/note',accentColor:'#b990ff',position:{latitudeDeg:-42,longitudeDeg:-62},icon:<Icon kind="M6 3h12v18H6zM9 8h6m-6 4h6m-6 4h4"/>},
  {id:'contatti',title:'Contatti',summary:'Hai un progetto in mente? Apriamo un canale e vediamo dove porta.',href:'/contatti',accentColor:'#baff63',position:{latitudeDeg:-27,longitudeDeg:116},icon:<Icon kind="M4 6h16v12H4zM4 7l8 6 8-6"/>},
];

function Home(){const navigate=useNavigate(),debug=new URLSearchParams(location.search).get('debug');return <ParticleSphereMenu items={menuItems} debugControls={debug!=='0'} onNavigate={(item,e)=>{if(item.target!=='_blank'){e.preventDefault();navigate(item.href)}}}/>}
function Page({item}:{item:SphereMenuItem}){return <main className="placeholder" style={{'--accent':item.accentColor} as React.CSSProperties}><a href="/" className="back">← Torna all’orbita</a><span className="eyebrow">SEZIONE / {item.id.toUpperCase()}</span><div className="page-icon">{item.icon}</div><h1>{item.title}</h1><p>{item.summary}</p><span className="coming">Contenuti in arrivo</span></main>}
export function App(){return <Routes><Route path="/" element={<Home/>}/>{menuItems.map(item=><Route key={item.id} path={item.href} element={<Page item={item}/>}/>)}<Route path="*" element={<Navigate to="/" replace/>}/></Routes>}
