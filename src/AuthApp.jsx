import { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { useFirestoreData } from "./useFirestoreData";
import App from "./App";

export default function AuthApp() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  const login = () => signInWithPopup(auth, googleProvider).catch(console.error);
  const logout = () => signOut(auth);

  if (authLoading) return (
    <div style={{display:"flex",height:"100vh",alignItems:"center",justifyContent:"center",background:"#0A0F1E",color:"#818CF8",fontSize:16}}>
      Cargando…
    </div>
  );

  if (!user) return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",alignItems:"center",justifyContent:"center",background:"#0A0F1E",padding:20}}>
      <div style={{fontSize:40,marginBottom:12}}>💰</div>
      <h1 style={{color:"#F9FAFB",fontWeight:800,fontSize:28,marginBottom:4}}>Finanzas Control</h1>
      <p style={{color:"#6B7280",fontSize:14,marginBottom:32,textAlign:"center"}}>Control de gastos, tarjetas y metas de ahorro</p>
      <button onClick={login} style={{
        padding:"14px 32px",borderRadius:12,cursor:"pointer",fontSize:16,fontWeight:700,
        background:"#4338CA",border:"none",color:"#fff",
        display:"flex",alignItems:"center",gap:10,
      }}>
        <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.9 33.5 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.9 5.9 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.5 18.8 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.9 5.9 29.2 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5 0 9.5-1.8 13-4.7l-6-5.1C28.7 36 26.5 36.7 24 36.7c-5.3 0-9.8-3.5-11.3-8.3l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4-4 5.2l6 5.1c-.4.4 6.7-4.9 6.7-14.3 0-1.3-.1-2.7-.4-3.9z"/></svg>
        Iniciar sesión con Google
      </button>
    </div>
  );

  return <AppWithData user={user} onLogout={logout} />;
}

function AppWithData({ user, onLogout }) {
  const { data, loading, save } = useFirestoreData(user.uid);

  if (loading) return (
    <div style={{display:"flex",height:"100vh",alignItems:"center",justifyContent:"center",background:"#0A0F1E",color:"#818CF8",fontSize:16}}>
      Cargando datos…
    </div>
  );

  console.log("DATA FROM FIRESTORE:", JSON.stringify(data));
return <App initialData={data} onSave={save} user={user} onLogout={onLogout} />;
}
