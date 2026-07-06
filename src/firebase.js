import { useState, useEffect, useCallback, useRef } from "react";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

export function useFirestoreData(userId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const saving = useRef(false);
  const pending = useRef(null);

  // Load + listen for realtime changes
  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, "users", userId), (snap) => {
      if (snap.exists()) setData(snap.data());
      else setData({});
      setLoading(false);
    }, (err) => {
      console.error("Firestore error:", err);
      setData({});
      setLoading(false);
    });
    return unsub;
  }, [userId]);

  // Save with debounce
  const save = useCallback((newData) => {
    if (!userId) return;
    setData(newData);
    pending.current = newData;
    if (saving.current) return;
    saving.current = true;
    setTimeout(async () => {
      try {
        await setDoc(doc(db, "users", userId), pending.current);
      } catch (e) { console.error("Save error:", e); }
      saving.current = false;
    }, 800);
  }, [userId]);

  return { data, loading, save };
}
