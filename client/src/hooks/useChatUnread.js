import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../lib/socket';

// Okunmamış mesajı olan sohbet sayısı (alt menü / kenar çubuğu rozeti).
// Yeni mesaj ya da okuma olunca anında, ayrıca dakikada bir yenilenir.
export function useChatUnread() {
  const { token } = useAuth();
  const socket = useSocket();
  const [count, setCount] = useState(0);

  const load = useCallback(() => {
    if (!token) return;
    api
      .get('/matches/unread-count')
      .then((res) => setCount(res.data.chats))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    socket.on('chat_activity', load);
    socket.on('chat_read', load);
    socket.on('match_removed', load);
    return () => {
      socket.off('chat_activity', load);
      socket.off('chat_read', load);
      socket.off('match_removed', load);
    };
  }, [socket, load]);

  return count;
}
