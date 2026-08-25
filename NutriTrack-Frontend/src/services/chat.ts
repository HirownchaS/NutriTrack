import { db } from "../firebase/config";
import {
  collection,
  addDoc,
  setDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { addNotification } from "./firestore";

export const sendMessage = async (data: any) => {
  const chatId = [data.sender_id, data.receiver_id].sort().join("_");
  await addDoc(collection(db, "chats", chatId, "messages"), {
    senderId: data.sender_id,
    receiverId: data.receiver_id,
    content: data.content,
    timestamp: serverTimestamp(),
  });
  await setDoc(
    doc(db, "chats", chatId),
    {
      userId: data.sender_id,
      nutritionistId: data.receiver_id,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await addNotification({
    receiverId: data.receiver_id,
    senderId: data.sender_id,
    senderName: data.sender_name || "User",
    message: `New message from ${data.sender_name || "User"}: ${data.content.substring(0, 40)}${data.content.length > 40 ? "..." : ""}`,
    type: "chat",
  });

  return { success: true };
};

export const subscribeToMessages = (uid: string, rid: string, cb: any) => {
  if (!uid || !rid) return () => {};
  const q = query(
    collection(db, "chats", [uid, rid].sort().join("_"), "messages"),
    orderBy("timestamp", "asc"),
  );
  return onSnapshot(q, (s) => {
    cb(
      s.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          sender_id: data.senderId,
          receiver_id: data.receiverId,
          content: data.content,
          timestamp:
            data.timestamp?.toDate?.().toISOString() ||
            new Date().toISOString(),
        };
      }),
    );
  });
};
