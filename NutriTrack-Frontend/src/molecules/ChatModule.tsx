import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import Card from "../atoms/Card";
import Button from "../atoms/Button";
import { sendMessage, subscribeToMessages } from "../services/chat";
import { useAuth } from "../context/AuthContext";
import { FiSend, FiMessageSquare } from "react-icons/fi";

import { useNotification } from "../context/NotificationContext";

interface Message {
  id: string | number;
  sender_id: string;
  receiver_id: string;
  content: string;
  timestamp: string;
}

interface ChatModuleProps {
  recipientId?: string;
  recipientName?: string;
}

const ChatModule: React.FC<ChatModuleProps> = ({
  recipientId,
  recipientName,
}) => {
  const { user } = useAuth();
  const location = useLocation();
  const { error } = useNotification();

  // Extract recipient from props, OR location state
  const actualRecipientId = recipientId || location.state?.recipientId;
  const actualRecipientName = recipientName || location.state?.recipientName;

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.uid) return;

    const receiverId = actualRecipientId;
    if (!receiverId) return;

    const unsubscribe = subscribeToMessages(
      user.uid,
      receiverId,
      (msgs: Message[]) => {
        setMessages(msgs);
      },
    );

    return () => unsubscribe();
  }, [user?.uid, actualRecipientId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user?.uid) return;

    setLoading(true);
    try {
      if (!actualRecipientId) throw new Error("No recipient selected");

      await sendMessage({
        sender_id: user.uid,
        receiver_id: actualRecipientId,
        content: newMessage,
        sender_name: user.name,
      });
      setNewMessage("");
      // No need to fetchMessages, the onSnapshot listener will trigger automatically!
    } catch (err) {
      error("Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-[500px] p-0 overflow-hidden border-emerald-100">
      {/* Header */}
      <div className="bg-emerald-500 p-4 text-white flex items-center gap-3">
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
          <FiMessageSquare className="text-xl" />
        </div>
        <div>
          <h3 className="font-bold">
            Chat with {actualRecipientName || "Nutritionist"}
          </h3>
          <p className="text-xs text-emerald-100">
            Online • Get professional advice
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50"
      >
        {!actualRecipientId ? (
          <div className="text-center py-20 px-10">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiMessageSquare className="w-8 h-8 text-slate-300" />
            </div>
            <h4 className="font-bold text-slate-800">No Chat Selected</h4>
            <p className="text-slate-400 text-sm mt-1 italic">
              Please select a nutritionist from your dashboard to start a
              conversation.
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 text-sm italic">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_id === user?.uid ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                  msg.sender_id === user?.uid
                    ? "bg-emerald-600 text-white rounded-tr-none"
                    : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
                }`}
              >
                {msg.content}
                <p
                  className={`text-[10px] mt-1 opacity-70 ${msg.sender_id === user?.uid ? "text-right" : "text-left"}`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSendMessage}
        className="p-4 bg-white border-t border-slate-100 flex gap-2"
      >
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your question..."
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
        />
        <Button
          type="submit"
          disabled={loading || !newMessage.trim()}
          className="aspect-square p-0 w-10 h-10 flex items-center justify-center rounded-xl"
        >
          <FiSend />
        </Button>
      </form>
    </Card>
  );
};

export default ChatModule;
