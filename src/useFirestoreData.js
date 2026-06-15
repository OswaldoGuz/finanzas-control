import { useState, useEffect, useCallback, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// Single document per user with all their data
export function useFirestoreData(userId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const saving = useRef(false);
  const pending = useRef(null);

  // Load
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", userId));
        if (snap.exists()) setData(snap.data());
        else setData({});
      } catch (e) { console.error("Load error:", e); setData({}); }
      setLoading(false);
    })();
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
