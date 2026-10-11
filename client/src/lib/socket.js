// Uygulama genelinde tek gerçek zamanlı bağlantı. Bildirim zili, alt menü
// rozeti, sohbet ve kulüp ekranları aynı bağlantıyı paylaşır; her ekranın
// kendi bağlantısını açması gereksiz yük ve tutarsız "çevrimiçi" bilgisi
// yaratıyordu. Ekranlar kendi dinleyicilerini ekleyip kaldırır, bağlantıyı
// kapatmaz.
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';

let socket = null;
let socketToken = null;

export function getSocket(token) {
  if (!token) return null;
  if (socket && socketToken === token) return socket;
  socket?.disconnect();
  socketToken = token;
  socket = io(API_BASE_URL || undefined, { auth: { token } });
  // Sunucu oturumu sonlandırdı (askıya alma, tüm cihazlardan çıkış, şifre değişikliği)
  socket.on('session_ended', ({ reason } = {}) => {
    window.dispatchEvent(new CustomEvent('kp-session-ended', { detail: { reason } }));
  });
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}

// Oturum açıksa paylaşılan bağlantı
export function useSocket() {
  const { token } = useAuth();
  const [s, setS] = useState(() => getSocket(token));
  useEffect(() => {
    setS(getSocket(token));
  }, [token]);
  return s;
}

// Bağlantı kopup yeniden kurulunca sunucu odalardan çıkarır: ekran odasına
// (sohbet, kulüp) yeniden katılmak için hem şimdi hem her bağlanışta çalışır
export function onEveryConnect(s, fn) {
  if (!s) return () => {};
  if (s.connected) fn();
  s.on('connect', fn);
  return () => s.off('connect', fn);
}
