import React, { useState, useEffect, useRef } from 'react';
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, X, User, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  ride_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface ChatProps {
  rideId: string;
  onClose: () => void;
  receiverName: string;
}

export const ChatInterface: React.FC<ChatProps> = ({ rideId, onClose, receiverName }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    
    // Subscribe to new messages
    const channel = supabase
      .channel(`ride_chat:${rideId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ride_messages',
        filter: `ride_id=eq.${rideId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rideId]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('ride_messages')
        .select('*')
        .eq('ride_id', rideId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error("Error fetching messages:", err);
      toast.error("Failed to load chat history");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const content = newMessage.trim();
    setNewMessage("");

    try {
      const { error } = await supabase
        .from('ride_messages')
        .insert({
          ride_id: rideId,
          sender_id: user.id,
          content: content
        });

      if (error) throw error;
    } catch (err: any) {
      toast.error("Failed to send message");
      console.error(err);
    }
  };

  return (
    <Card className="fixed bottom-0 left-0 right-0 sm:right-4 sm:left-auto sm:bottom-4 sm:w-[400px] h-[500px] sm:h-[600px] z-[100] flex flex-col shadow-2xl border-2 border-primary/20 rounded-t-[32px] sm:rounded-[32px] overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
      {/* Header */}
      <div className="bg-primary p-4 flex items-center justify-between text-black">
        <div className="flex items-center space-x-3">
          <div className="bg-black/10 p-2 rounded-xl">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 leading-none mb-1">Chatting with</p>
            <h3 className="font-black text-sm tracking-tight">{receiverName}</h3>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-black/10 rounded-full h-10 w-10">
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 bg-slate-50 relative overflow-hidden">
        <ScrollArea className="h-full p-4">
          <div className="space-y-4 pb-4">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div className={`
                  max-w-[85%] px-4 py-3 shadow-md
                  ${msg.sender_id === user?.id 
                    ? 'bg-primary text-black rounded-[20px] rounded-br-none' 
                    : 'bg-white text-slate-800 rounded-[20px] rounded-bl-none border border-slate-100'
                  }
                `}>
                  <p className="text-sm font-bold leading-normal">
                    {msg.content}
                  </p>
                  <p className={`text-[9px] mt-1 font-black uppercase opacity-40 ${msg.sender_id === user?.id ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            
            <div ref={messagesEndRef} />

            {messages.length === 0 && !loading && (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4 pt-20">
                <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-black text-slate-400 uppercase text-[10px] tracking-widest">Start Conversation</p>
                  <p className="text-xs text-slate-400 mt-1">Send a message to coordinate your ride.</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-4 bg-white border-t border-slate-100 flex items-center space-x-2">
        <Input 
          placeholder="Type a message..." 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="h-14 bg-slate-50 border-none rounded-2xl font-bold px-4 focus-visible:ring-primary focus-visible:ring-offset-0"
        />
        <Button type="submit" size="icon" className="h-14 w-14 shrink-0 rounded-2xl bg-primary hover:bg-primary-hover shadow-lg shadow-primary/20">
          <Send className="w-6 h-6 text-black" />
        </Button>
      </form>
    </Card>
  );
};
